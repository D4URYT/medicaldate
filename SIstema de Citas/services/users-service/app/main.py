import os
import time
from datetime import datetime, timezone

import httpx
import psycopg
from psycopg.rows import dict_row
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

APP_NAME = "users-service"
DB_DSN = os.getenv("USERS_DB_DSN", "postgresql://citas_user:citas_pass@db:5432/citas_db")
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001")

app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProfilePayload(BaseModel):
    full_name: str
    phone: str | None = None
    avatar_url: str | None = None


def get_conn() -> psycopg.Connection:
    return psycopg.connect(DB_DSN, row_factory=dict_row)


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                auth_user_id INTEGER UNIQUE NOT NULL,
                email TEXT NOT NULL,
                role TEXT NOT NULL,
                full_name TEXT NOT NULL,
                phone TEXT,
                avatar_url TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
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
    return response.json()


def ensure_profile_exists(user: dict) -> None:
    now = datetime.now(timezone.utc)
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM users WHERE auth_user_id = %s", (user["user_id"],)).fetchone()
        if not existing:
            conn.execute(
                """
                INSERT INTO users (auth_user_id, email, role, full_name, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (user["user_id"], user["email"], user["role"], user["email"], now, now),
            )


@app.get("/health")
def health() -> dict:
    return {"service": APP_NAME, "status": "ok"}


@app.get("/me")
async def get_me(user: dict = Depends(verify_token)) -> dict:
    ensure_profile_exists(user)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT auth_user_id, email, role, full_name, phone, avatar_url, is_active FROM users WHERE auth_user_id = %s",
            (user["user_id"],),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dict(row)


@app.put("/me")
async def update_me(payload: ProfilePayload, user: dict = Depends(verify_token)) -> dict:
    ensure_profile_exists(user)
    now = datetime.now(timezone.utc)
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE users
            SET full_name = %s, phone = %s, avatar_url = %s, updated_at = %s
            WHERE auth_user_id = %s
            """,
            (payload.full_name.strip(), payload.phone, payload.avatar_url, now, user["user_id"]),
        )
        row = conn.execute(
            "SELECT auth_user_id, email, role, full_name, phone, avatar_url, is_active FROM users WHERE auth_user_id = %s",
            (user["user_id"],),
        ).fetchone()
    return dict(row)


@app.get("/users")
async def list_users(user: dict = Depends(verify_token)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    with get_conn() as conn:
        rows = conn.execute(
            "SELECT auth_user_id, email, role, full_name, phone, avatar_url, is_active, created_at FROM users ORDER BY id DESC"
        ).fetchall()
    return {"items": [dict(r) for r in rows]}


@app.get("/internal/users/{auth_user_id}")
async def get_user_internal(auth_user_id: int, user: dict = Depends(verify_token)) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT auth_user_id, email, role, full_name, is_active FROM users WHERE auth_user_id = %s",
            (auth_user_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)
