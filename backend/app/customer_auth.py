import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from pwdlib import PasswordHash
from sqlalchemy import Column, DateTime, MetaData, String, Table, create_engine, insert, select
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/api/customers", tags=["customer accounts"])

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parents[1] / "customers.sqlite3"
DATABASE_URL = os.getenv("DATABASE_URL", "").strip() or f"sqlite:///{DEFAULT_DATABASE_PATH}"
if DATABASE_URL.startswith(("postgres://", "postgresql://")):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
metadata = MetaData()
customers = Table(
    "customers",
    metadata,
    Column("id", String(32), primary_key=True),
    Column("name", String(120), nullable=False),
    Column("email", String(254), nullable=False, unique=True, index=True),
    Column("password_hash", String(512), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
_database_lock = threading.Lock()
_database_ready = False

CUSTOMER_COOKIE = "6native_customer"
CUSTOMER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
PASSWORD_HASHER = PasswordHash.recommended()
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class CustomerRegistration(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=1024)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter your name.")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().casefold()
        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("Enter a valid email address.")
        return value


class CustomerLogin(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().casefold()
        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("Enter a valid email address.")
        return value


class CustomerProfile(BaseModel):
    id: str
    name: str
    email: str
    created_at: str


def ensure_database() -> None:
    global _database_ready
    if _database_ready:
        return
    with _database_lock:
        if not _database_ready:
            metadata.create_all(engine)
            _database_ready = True


def session_secret() -> str:
    secret = os.getenv("CUSTOMER_SESSION_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(
            status_code=503,
            detail="Customer accounts are not configured. Set CUSTOMER_SESSION_SECRET to a random value of at least 32 characters.",
        )
    return secret


def encode_customer_session(customer_id: str) -> str:
    payload = json.dumps(
        {"sub": customer_id, "expires": int(time.time()) + CUSTOMER_COOKIE_MAX_AGE, "nonce": secrets.token_hex(8)},
        separators=(",", ":"),
    ).encode()
    encoded_payload = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
    signature = hmac.new(session_secret().encode(), encoded_payload.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).rstrip(b"=").decode()
    return f"{encoded_payload}.{encoded_signature}"


def customer_profile(record: dict[str, object]) -> CustomerProfile:
    created_at = record["created_at"]
    if not isinstance(created_at, datetime):
        raise HTTPException(status_code=500, detail="Customer account data is invalid.")
    return CustomerProfile(
        id=str(record["id"]),
        name=str(record["name"]),
        email=str(record["email"]),
        created_at=created_at.isoformat(),
    )


def find_customer_by_id(customer_id: str) -> CustomerProfile | None:
    ensure_database()
    with engine.connect() as connection:
        record = connection.execute(select(customers).where(customers.c.id == customer_id)).mappings().first()
    return customer_profile(dict(record)) if record else None


def authenticated_customer(request: Request) -> CustomerProfile:
    token = request.cookies.get(CUSTOMER_COOKIE, "")
    secret = session_secret()
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        provided_signature = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
        expected_signature = hmac.new(secret.encode(), encoded_payload.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(provided_signature, expected_signature):
            raise ValueError("Invalid signature")
        payload_bytes = base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4))
        payload = json.loads(payload_bytes)
        customer_id = payload["sub"]
        if not isinstance(customer_id, str) or payload["expires"] < int(time.time()):
            raise ValueError("Expired or invalid session")
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Customer sign-in is required.") from None
    customer = find_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=401, detail="Customer sign-in is required.")
    return customer


def require_same_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    allowed_origins = {
        item.strip()
        for item in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if item.strip()
    }
    if not origin or origin not in allowed_origins:
        raise HTTPException(status_code=403, detail="This request origin is not allowed.")


def set_customer_cookie(response: Response, customer_id: str) -> None:
    secure_cookie = os.getenv("CUSTOMER_COOKIE_SECURE", "false").casefold() == "true"
    response.set_cookie(
        key=CUSTOMER_COOKIE,
        value=encode_customer_session(customer_id),
        max_age=CUSTOMER_COOKIE_MAX_AGE,
        httponly=True,
        secure=secure_cookie,
        samesite="none" if secure_cookie else "lax",
        path="/api/customers",
    )


@router.post("/register", response_model=CustomerProfile, status_code=201)
def register_customer(
    registration: CustomerRegistration,
    request: Request,
    response: Response,
) -> CustomerProfile:
    require_same_origin(request)
    secret = session_secret()
    ensure_database()
    customer_id = uuid.uuid4().hex
    created_at = datetime.now(timezone.utc)
    password_hash = PASSWORD_HASHER.hash(registration.password)
    try:
        with engine.begin() as connection:
            connection.execute(
                insert(customers).values(
                    id=customer_id,
                    name=registration.name,
                    email=registration.email,
                    password_hash=password_hash,
                    created_at=created_at,
                )
            )
    except IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from None
    set_customer_cookie(response, customer_id)
    return CustomerProfile(
        id=customer_id,
        name=registration.name,
        email=registration.email,
        created_at=created_at.isoformat(),
    )


@router.post("/login", response_model=CustomerProfile)
def login_customer(credentials: CustomerLogin, request: Request, response: Response) -> CustomerProfile:
    require_same_origin(request)
    session_secret()
    ensure_database()
    with engine.connect() as connection:
        record = connection.execute(select(customers).where(customers.c.email == credentials.email)).mappings().first()
    if not record:
        PASSWORD_HASHER.hash(credentials.password)
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    try:
        password_matches = PASSWORD_HASHER.verify(credentials.password, record["password_hash"])
    except (ValueError, TypeError):
        password_matches = False
    if not password_matches:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    set_customer_cookie(response, str(record["id"]))
    return customer_profile(dict(record))


@router.get("/me", response_model=CustomerProfile)
def get_customer_profile(customer: Annotated[CustomerProfile, Depends(authenticated_customer)]) -> CustomerProfile:
    return customer


@router.post("/logout")
def logout_customer(request: Request, response: Response) -> dict[str, str]:
    require_same_origin(request)
    secure_cookie = os.getenv("CUSTOMER_COOKIE_SECURE", "false").casefold() == "true"
    response.delete_cookie(
        key=CUSTOMER_COOKIE,
        path="/api/customers",
        httponly=True,
        secure=secure_cookie,
        samesite="none" if secure_cookie else "lax",
    )
    return {"status": "signed out"}
