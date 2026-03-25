import os
import time
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

import httpx
import psycopg
from psycopg.rows import dict_row
from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_NAME = "appointments-service"
DB_DSN = os.getenv("APPOINTMENTS_DB_DSN", "postgresql://citas_user:citas_pass@db:5432/citas_db")
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001")
USERS_SERVICE_URL = os.getenv("USERS_SERVICE_URL", "http://users-service:8002")

app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ServicePayload(BaseModel):
    name: str
    description: str | None = None
    duration_min: int = Field(ge=15, le=240)
    price: float = Field(ge=0)


class AvailabilityPayload(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str


class AppointmentPayload(BaseModel):
    provider_id: int
    service_id: int
    date: date
    start_time: str
    notes: str | None = None


class StatusPayload(BaseModel):
    status: Literal["pendiente", "confirmada", "completada", "cancelada"]


def parse_hhmm(value: str) -> time:
    try:
        return datetime.strptime(value, "%H:%M").time()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Time must be HH:MM") from exc


def get_conn() -> psycopg.Connection:
    return psycopg.connect(DB_DSN, row_factory=dict_row)


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                provider_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                duration_min INTEGER NOT NULL,
                price DOUBLE PRECISION NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS availability (
                id SERIAL PRIMARY KEY,
                provider_id INTEGER NOT NULL,
                day_of_week INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS appointments (
                id SERIAL PRIMARY KEY,
                client_id INTEGER NOT NULL,
                provider_id INTEGER NOT NULL,
                service_id INTEGER NOT NULL,
                date DATE NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                status TEXT NOT NULL,
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL
            )
            """
        )


def wait_for_db() -> None:
    for _ in range(30):
        try:
            with get_conn() as conn:
                conn.execute("SELECT 1")
            return
        except psycopg.OperationalError:
            time.sleep(1)
    raise RuntimeError("Database not ready after waiting")


@app.on_event("startup")
def on_startup() -> None:
    wait_for_db()
    init_db()


def get_token_from_header(authorization: str = Header(default="")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    return authorization.replace("Bearer ", "", 1)


async def verify_token(token: str = Depends(get_token_from_header)) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{AUTH_SERVICE_URL}/verify",
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Auth service unavailable") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid token")
    payload = response.json()
    payload["token"] = token
    return payload


async def get_user_basic(user_id: int, token: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{USERS_SERVICE_URL}/internal/users/{user_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Users service unavailable") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found in users-service")
    return response.json()


@app.get("/health")
def health() -> dict:
    return {"service": APP_NAME, "status": "ok"}


@app.post("/services")
async def create_service(payload: ServicePayload, user: dict = Depends(verify_token)) -> dict:
    if user["role"] not in ("provider", "admin"):
        raise HTTPException(status_code=403, detail="Provider role required")

    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO services (provider_id, name, description, duration_min, price)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (user["user_id"], payload.name.strip(), payload.description, payload.duration_min, payload.price),
        ).fetchone()
    return dict(row)


@app.get("/services")
def list_services(provider_id: int | None = Query(default=None)) -> dict:
    with get_conn() as conn:
        if provider_id:
            rows = conn.execute(
                "SELECT * FROM services WHERE is_active = TRUE AND provider_id = %s ORDER BY id DESC",
                (provider_id,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM services WHERE is_active = TRUE ORDER BY id DESC").fetchall()
    return {"items": [dict(r) for r in rows]}


@app.post("/availability")
async def create_availability(payload: AvailabilityPayload, user: dict = Depends(verify_token)) -> dict:
    if user["role"] not in ("provider", "admin"):
        raise HTTPException(status_code=403, detail="Provider role required")

    start_t = parse_hhmm(payload.start_time)
    end_t = parse_hhmm(payload.end_time)
    if start_t >= end_t:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")

    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO availability (provider_id, day_of_week, start_time, end_time)
            VALUES (%s, %s, %s, %s)
            RETURNING *
            """,
            (user["user_id"], payload.day_of_week, payload.start_time, payload.end_time),
        ).fetchone()
    return dict(row)


@app.get("/availability/{provider_id}")
def get_availability(provider_id: int) -> dict:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM availability WHERE provider_id = %s ORDER BY day_of_week, start_time",
            (provider_id,),
        ).fetchall()
    return {"items": [dict(r) for r in rows]}


def ensure_slot_available(
    conn: psycopg.Connection,
    provider_id: int,
    appointment_date: date,
    start_time_s: str,
    end_time_s: str,
) -> None:
    rows = conn.execute(
        """
        SELECT start_time, end_time FROM appointments
        WHERE provider_id = %s AND date = %s AND status != 'cancelada'
        """,
        (provider_id, appointment_date),
    ).fetchall()

    for row in rows:
        existing_start = parse_hhmm(row["start_time"])
        existing_end = parse_hhmm(row["end_time"])
        current_start = parse_hhmm(start_time_s)
        current_end = parse_hhmm(end_time_s)

        overlap = current_start < existing_end and current_end > existing_start
        if overlap:
            raise HTTPException(status_code=409, detail="Provider already has an appointment in this range")


@app.post("/appointments")
async def create_appointment(payload: AppointmentPayload, user: dict = Depends(verify_token)) -> dict:
    if user["role"] not in ("client", "admin"):
        raise HTTPException(status_code=403, detail="Client role required")

    with get_conn() as conn:
        service = conn.execute(
            "SELECT id, provider_id, duration_min FROM services WHERE id = %s AND is_active = TRUE",
            (payload.service_id,),
        ).fetchone()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        if payload.provider_id != service["provider_id"]:
            raise HTTPException(status_code=400, detail="Service does not belong to provider")

        start_t = parse_hhmm(payload.start_time)
        end_dt = datetime.combine(date.today(), start_t) + timedelta(minutes=service["duration_min"])
        end_t = end_dt.time()

        day_of_week = payload.date.weekday()
        blocks = conn.execute(
            "SELECT start_time, end_time FROM availability WHERE provider_id = %s AND day_of_week = %s",
            (payload.provider_id, day_of_week),
        ).fetchall()
        if not blocks:
            raise HTTPException(status_code=400, detail="Provider has no availability for this day")

        in_available_block = False
        for block in blocks:
            block_start = parse_hhmm(block["start_time"])
            block_end = parse_hhmm(block["end_time"])
            if start_t >= block_start and end_t <= block_end:
                in_available_block = True
                break
        if not in_available_block:
            raise HTTPException(status_code=400, detail="Appointment is outside provider availability")

        await get_user_basic(payload.provider_id, user["token"])
        await get_user_basic(user["user_id"], user["token"])

        ensure_slot_available(conn, payload.provider_id, payload.date, payload.start_time, end_t.strftime("%H:%M"))

        created_at = datetime.now(timezone.utc)
        row = conn.execute(
            """
            INSERT INTO appointments (client_id, provider_id, service_id, date, start_time, end_time, status, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'pendiente', %s, %s)
            RETURNING *
            """,
            (
                user["user_id"],
                payload.provider_id,
                payload.service_id,
                payload.date,
                payload.start_time,
                end_t.strftime("%H:%M"),
                payload.notes,
                created_at,
            ),
        ).fetchone()
    return dict(row)


@app.get("/appointments")
def list_appointments(user: dict = Depends(verify_token)) -> dict:
    with get_conn() as conn:
        if user["role"] == "admin":
            rows = conn.execute("SELECT * FROM appointments ORDER BY id DESC").fetchall()
        elif user["role"] == "provider":
            rows = conn.execute(
                "SELECT * FROM appointments WHERE provider_id = %s ORDER BY id DESC",
                (user["user_id"],),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM appointments WHERE client_id = %s ORDER BY id DESC",
                (user["user_id"],),
            ).fetchall()
    return {"items": [dict(r) for r in rows]}


@app.patch("/appointments/{appointment_id}/status")
def update_status(appointment_id: int, payload: StatusPayload, user: dict = Depends(verify_token)) -> dict:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM appointments WHERE id = %s", (appointment_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Appointment not found")

        if user["role"] not in ("provider", "admin"):
            raise HTTPException(status_code=403, detail="Provider or admin required")
        if user["role"] == "provider" and row["provider_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="Cannot modify this appointment")

        current = row["status"]
        next_status = payload.status
        valid_transitions = {
            "pendiente": {"confirmada", "cancelada"},
            "confirmada": {"completada", "cancelada"},
            "completada": set(),
            "cancelada": set(),
        }

        if next_status not in valid_transitions[current]:
            raise HTTPException(status_code=400, detail=f"Invalid transition from {current} to {next_status}")

        conn.execute("UPDATE appointments SET status = %s WHERE id = %s", (next_status, appointment_id))
        updated = conn.execute("SELECT * FROM appointments WHERE id = %s", (appointment_id,)).fetchone()
    return dict(updated)


@app.patch("/appointments/{appointment_id}/cancel")
def cancel_appointment(appointment_id: int, user: dict = Depends(verify_token)) -> dict:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM appointments WHERE id = %s", (appointment_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Appointment not found")

        is_owner = row["client_id"] == user["user_id"] or row["provider_id"] == user["user_id"] or user["role"] == "admin"
        if not is_owner:
            raise HTTPException(status_code=403, detail="Cannot cancel this appointment")
        if row["status"] == "completada":
            raise HTTPException(status_code=400, detail="Completed appointment cannot be cancelled")

        conn.execute("UPDATE appointments SET status = 'cancelada' WHERE id = %s", (appointment_id,))
        updated = conn.execute("SELECT * FROM appointments WHERE id = %s", (appointment_id,)).fetchone()
    return dict(updated)
