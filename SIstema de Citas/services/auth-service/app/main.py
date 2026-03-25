from datetime import datetime, timedelta, timezone
import os
import time
from typing import Literal

import psycopg
from psycopg.rows import dict_row
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

APP_NAME = "auth-service"
DB_DSN = os.getenv("AUTH_DB_DSN", "postgresql://citas_user:citas_pass@db:5432/citas_db")
JWT_SECRET = os.getenv("JWT_SECRET", "dev_secret_change_me")
JWT_ALGORITHM = "HS256"
JWT_EXP_MINUTES = int(os.getenv("JWT_EXP_MINUTES", "120"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterPayload(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: Literal["admin", "provider", "client"] = "client"


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


class RolePayload(BaseModel):
    role: Literal["admin", "provider", "client"]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def get_conn() -> psycopg.Connection:
    return psycopg.connect(DB_DSN, row_factory=dict_row)


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS credentials (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
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


def create_access_token(user_id: int, email: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXP_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def get_token_from_header(authorization: str = Header(default="")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    return authorization.replace("Bearer ", "", 1)


def ensure_admin(token: str) -> dict:
    caller = decode_token(token)
    if caller.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return caller


@app.get("/health")
def health() -> dict:
    return {"service": APP_NAME, "status": "ok"}


@app.post("/register")
def register(payload: RegisterPayload) -> dict:
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM credentials WHERE email = %s", (payload.email.lower(),)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        password_hash = pwd_context.hash(payload.password)
        created_at = datetime.now(timezone.utc)

        row = conn.execute(
            """
            INSERT INTO credentials (full_name, email, password_hash, role, created_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (payload.full_name.strip(), payload.email.lower(), password_hash, payload.role, created_at),
        ).fetchone()
        user_id = row["id"]

    token = create_access_token(user_id, payload.email.lower(), payload.role)
    return {
        "id": user_id,
        "full_name": payload.full_name,
        "email": payload.email.lower(),
        "role": payload.role,
        "access_token": token,
    }


@app.post("/login", response_model=TokenResponse)
def login(payload: LoginPayload) -> TokenResponse:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, role, is_active FROM credentials WHERE email = %s",
            (payload.email.lower(),),
        ).fetchone()

    if not row or not pwd_context.verify(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not row["is_active"]:
        raise HTTPException(status_code=403, detail="Account disabled")

    token = create_access_token(row["id"], row["email"], row["role"])
    return TokenResponse(access_token=token)


@app.get("/verify")
def verify(token: str = Depends(get_token_from_header)) -> dict:
    payload = decode_token(token)
    user_id = int(payload["sub"])
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, role, is_active FROM credentials WHERE id = %s",
            (user_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not row["is_active"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    return {
        "user_id": user_id,
        "email": row["email"],
        "role": row["role"],
        "valid": True,
    }


@app.get("/users")
def list_users(token: str = Depends(get_token_from_header)) -> dict:
    ensure_admin(token)
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, full_name, email, role, is_active, created_at FROM credentials ORDER BY id DESC"
        ).fetchall()
    return {"items": rows}


@app.get("/users/{user_id}")
def get_user(user_id: int, token: str = Depends(get_token_from_header)) -> dict:
    ensure_admin(token)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, full_name, email, role, is_active, created_at FROM credentials WHERE id = %s",
            (user_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row


@app.patch("/users/{user_id}/deactivate")
def deactivate_user(user_id: int, token: str = Depends(get_token_from_header)) -> dict:
    ensure_admin(token)

    with get_conn() as conn:
        cur = conn.execute("UPDATE credentials SET is_active = FALSE WHERE id = %s", (user_id,))

    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deactivated"}


@app.patch("/users/{user_id}/activate")
def activate_user(user_id: int, token: str = Depends(get_token_from_header)) -> dict:
    ensure_admin(token)
    with get_conn() as conn:
        cur = conn.execute("UPDATE credentials SET is_active = TRUE WHERE id = %s", (user_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User activated"}


@app.patch("/users/{user_id}/role")
def update_role(user_id: int, payload: RolePayload, token: str = Depends(get_token_from_header)) -> dict:
    ensure_admin(token)
    with get_conn() as conn:
        cur = conn.execute("UPDATE credentials SET role = %s WHERE id = %s", (payload.role, user_id))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Role updated"}


@app.patch("/change-password")
def change_password(payload: ChangePasswordPayload, token: str = Depends(get_token_from_header)) -> dict:
    caller = decode_token(token)
    user_id = int(caller["sub"])

    with get_conn() as conn:
        row = conn.execute("SELECT password_hash FROM credentials WHERE id = %s", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        if not pwd_context.verify(payload.current_password, row["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        new_hash = pwd_context.hash(payload.new_password)
        conn.execute("UPDATE credentials SET password_hash = %s WHERE id = %s", (new_hash, user_id))
    return {"message": "Password changed successfully"}
