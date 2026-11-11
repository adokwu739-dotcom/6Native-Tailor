import base64
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import time
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pwdlib import PasswordHash
from pydantic import BaseModel, Field, field_validator

from .customer_auth import router as customer_router

app = FastAPI(
    title="6Native Tailor API",
    description="Catalog, image management, and clothing certificate API for the 6Native Tailor storefront.",
    version="0.2.0",
)
app.include_router(customer_router)

DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
SESSION_COOKIE = "6native_admin"
SESSION_MAX_AGE = 8 * 60 * 60
PASSWORD_HASHER = PasswordHash.recommended()


class CatalogItem(BaseModel):
    id: str
    name: str
    category: str
    price: int
    currency: str = "NGN"


class AdminLogin(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=1024)


class MediaAsset(BaseModel):
    id: str
    filename: str
    url: str
    alt: str
    slot: str
    uploaded_at: str


class CertificateInput(BaseModel):
    order_reference: str = Field(min_length=1, max_length=80)
    garment: str = Field(min_length=1, max_length=120)
    fabric: str = Field(min_length=1, max_length=120)
    tailoring_date: date
    care_instructions: str = Field(min_length=1, max_length=2000)
    authenticity_info: str | None = Field(default=None, max_length=1000)

    @field_validator("order_reference", "garment", "fabric", "care_instructions")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("authenticity_info")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None


class ClothingCertificate(CertificateInput):
    id: str
    issued_at: datetime


CATALOG = [
    CatalogItem(id="season-dress", name="All-Season Ankara Dress", category="New arrivals", price=98500),
    CatalogItem(id="green-palm-coord", name="Green Palm Co-ord", category="Ready to wear", price=112000),
    CatalogItem(id="purple-agbada", name="Purple Agbada Set", category="Ready to wear", price=42000),
    CatalogItem(id="green-mens-kaftan", name="Green Men's Kaftan", category="Ready to wear", price=76000),
]
PRODUCT_SLOTS = {
    f"product-{item.id}"
    for item in CATALOG
}
SINGLE_IMAGE_SLOTS = {"hero-1", "hero-2", "hero-3", *PRODUCT_SLOTS}
MULTI_IMAGE_SLOTS = {"homepage-gallery", "pieces-gallery"}
VALID_IMAGE_SLOTS = SINGLE_IMAGE_SLOTS | MULTI_IMAGE_SLOTS


def media_directory() -> Path:
    configured = os.getenv("MEDIA_DIRECTORY")
    default = Path(__file__).resolve().parents[1] / "media"
    return Path(configured).expanduser().resolve() if configured else default


def certificate_directory() -> Path:
    configured = os.getenv("CERTIFICATE_DIRECTORY")
    default = Path(__file__).resolve().parents[1] / "certificates"
    return Path(configured).expanduser().resolve() if configured else default


def load_certificates() -> list[ClothingCertificate]:
    root = certificate_directory()
    if not root.exists():
        return []
    try:
        certificates: list[ClothingCertificate] = []
        for path in root.glob("*.json"):
            certificate = ClothingCertificate.model_validate_json(path.read_text(encoding="utf-8"))
            if certificate.id != path.stem:
                raise ValueError("Certificate ID does not match its stored filename.")
            certificates.append(certificate)
        return sorted(certificates, key=lambda certificate: certificate.issued_at, reverse=True)
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=500, detail="The certificate library contains invalid data.") from error


def require_admin_configuration() -> tuple[str, str, str]:
    email = os.getenv("ADMIN_EMAIL", "").strip()
    password_hash = os.getenv("ADMIN_PASSWORD_HASH", "").strip()
    session_secret = os.getenv("ADMIN_SESSION_SECRET", "")
    if not email or not password_hash or len(session_secret) < 32:
        raise HTTPException(
            status_code=503,
            detail="Admin access is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH, and a 32-character ADMIN_SESSION_SECRET.",
        )
    return email, password_hash, session_secret


def encode_session(email: str, secret: str) -> str:
    payload = json.dumps(
        {"email": email, "expires": int(time.time()) + SESSION_MAX_AGE, "nonce": secrets.token_hex(8)},
        separators=(",", ":"),
    ).encode()
    encoded_payload = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
    signature = hmac.new(secret.encode(), encoded_payload.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).rstrip(b"=").decode()
    return f"{encoded_payload}.{encoded_signature}"


def authenticated_admin(request: Request) -> str:
    expected_email, _, secret = require_admin_configuration()
    token = request.cookies.get(SESSION_COOKIE, "")
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        provided_signature = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
        expected_signature = hmac.new(secret.encode(), encoded_payload.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(provided_signature, expected_signature):
            raise ValueError("Invalid signature")
        payload_bytes = base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4))
        payload = json.loads(payload_bytes)
        if payload["expires"] < int(time.time()) or not hmac.compare_digest(payload["email"], expected_email):
            raise ValueError("Expired or invalid session")
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Admin sign-in is required.") from None
    return expected_email


def check_request_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and origin not in ALLOWED_ORIGINS:
        raise HTTPException(status_code=403, detail="This request origin is not allowed.")


def load_media_assets(request: Request) -> list[MediaAsset]:
    root = media_directory()
    if not root.exists():
        return []
    assets: list[MediaAsset] = []
    for metadata_path in root.glob("*.json"):
        try:
            data = json.loads(metadata_path.read_text(encoding="utf-8"))
            filename = data["filename"]
            if not re.fullmatch(r"[a-f0-9]{32}\.webp", filename):
                raise ValueError("Invalid stored image filename.")
            if not (root / filename).is_file():
                continue
            assets.append(
                MediaAsset(
                    id=data["id"],
                    filename=filename,
                    url=f"{str(request.base_url).rstrip('/')}/api/media/assets/{filename}",
                    alt=data["alt"],
                    slot=data["slot"],
                    uploaded_at=data["uploaded_at"],
                )
            )
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise HTTPException(status_code=500, detail="The image library contains invalid metadata.") from error
    return sorted(assets, key=lambda asset: asset.uploaded_at, reverse=True)


def write_asset_metadata(root: Path, asset: MediaAsset) -> None:
    metadata_path = root / f"{asset.id}.json"
    temporary_path = root / f".{asset.id}.tmp"
    temporary_path.write_text(
        json.dumps(
            {
                "id": asset.id,
                "filename": asset.filename,
                "alt": asset.alt,
                "slot": asset.slot,
                "uploaded_at": asset.uploaded_at,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    temporary_path.replace(metadata_path)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/products", response_model=list[CatalogItem])
def list_products() -> list[CatalogItem]:
    return CATALOG


@app.get("/api/admin/certificates", response_model=list[ClothingCertificate])
def admin_certificates(_: Annotated[str, Depends(authenticated_admin)]) -> list[ClothingCertificate]:
    return load_certificates()


@app.post("/api/admin/certificates", response_model=ClothingCertificate, status_code=201)
def create_certificate(
    certificate_input: CertificateInput,
    request: Request,
    _: Annotated[str, Depends(authenticated_admin)],
) -> ClothingCertificate:
    check_request_origin(request)
    certificate_id = uuid.uuid4().hex
    certificate = ClothingCertificate(
        **certificate_input.model_dump(),
        id=certificate_id,
        issued_at=datetime.now(timezone.utc),
    )
    root = certificate_directory()
    try:
        root.mkdir(parents=True, exist_ok=True)
        temporary_path = root / f".{certificate_id}.tmp"
        temporary_path.write_text(certificate.model_dump_json(), encoding="utf-8")
        temporary_path.replace(root / f"{certificate_id}.json")
    except OSError as error:
        raise HTTPException(status_code=500, detail="Could not save this clothing certificate.") from error
    return certificate


@app.get("/api/certificates/{certificate_id}", response_model=ClothingCertificate)
def public_certificate(certificate_id: str) -> ClothingCertificate:
    if not re.fullmatch(r"[a-f0-9]{32}", certificate_id):
        raise HTTPException(status_code=404, detail="Clothing certificate not found.")
    certificate_path = certificate_directory() / f"{certificate_id}.json"
    try:
        certificate = ClothingCertificate.model_validate_json(certificate_path.read_text(encoding="utf-8"))
        if certificate.id != certificate_id:
            raise ValueError("Certificate ID does not match its stored filename.")
        return certificate
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Clothing certificate not found.") from None
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=500, detail="Could not read this clothing certificate.") from error


@app.post("/api/admin/login")
def admin_login(credentials: AdminLogin, request: Request, response: Response) -> dict[str, str]:
    check_request_origin(request)
    expected_email, password_hash, secret = require_admin_configuration()
    email_matches = hmac.compare_digest(credentials.email.strip().casefold(), expected_email.casefold())
    try:
        password_matches = PASSWORD_HASHER.verify(credentials.password, password_hash)
    except (ValueError, TypeError):
        password_matches = False
    if not email_matches or not password_matches:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")

    secure_cookie = os.getenv("ADMIN_COOKIE_SECURE", "true").casefold() == "true"
    response.set_cookie(
        key=SESSION_COOKIE,
        value=encode_session(expected_email, secret),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=secure_cookie,
        samesite="none" if secure_cookie else "lax",
        path="/api/admin",
    )
    return {"email": expected_email}


@app.get("/api/admin/session")
def admin_session(email: Annotated[str, Depends(authenticated_admin)]) -> dict[str, str]:
    return {"email": email}


@app.post("/api/admin/logout")
def admin_logout(request: Request, response: Response, _: Annotated[str, Depends(authenticated_admin)]) -> dict[str, str]:
    check_request_origin(request)
    response.delete_cookie(key=SESSION_COOKIE, path="/api/admin", httponly=True, secure=os.getenv("ADMIN_COOKIE_SECURE", "true").casefold() == "true", samesite="none" if os.getenv("ADMIN_COOKIE_SECURE", "true").casefold() == "true" else "lax")
    return {"status": "signed out"}


@app.get("/api/media", response_model=list[MediaAsset])
def public_media_library(request: Request) -> list[MediaAsset]:
    return load_media_assets(request)


@app.get("/api/admin/images", response_model=list[MediaAsset])
def admin_media_library(
    request: Request,
    _: Annotated[str, Depends(authenticated_admin)],
) -> list[MediaAsset]:
    return load_media_assets(request)


@app.get("/api/media/assets/{filename}")
def read_media_asset(filename: str) -> FileResponse:
    if not re.fullmatch(r"[a-f0-9]{32}\.webp", filename):
        raise HTTPException(status_code=404, detail="Image not found.")
    image_path = media_directory() / filename
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found.")
    return FileResponse(image_path, media_type="image/webp", headers={"Cache-Control": "public, max-age=3600"})


@app.post("/api/admin/images", response_model=MediaAsset)
async def upload_media_asset(
    request: Request,
    file: Annotated[UploadFile, File()],
    alt: Annotated[str, Form(max_length=120)],
    slot: Annotated[str, Form()],
    _: Annotated[str, Depends(authenticated_admin)],
) -> MediaAsset:
    check_request_origin(request)
    if slot not in VALID_IMAGE_SLOTS:
        raise HTTPException(status_code=422, detail="Choose a valid storefront image location.")
    alt = alt.strip()
    if not alt:
        raise HTTPException(status_code=422, detail="Add descriptive alt text for accessibility.")
    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Images must be 10 MB or smaller.")

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Images must be 10 MB or smaller.")

    try:
        with Image.open(io.BytesIO(contents)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(status_code=415, detail="Use a JPEG, PNG, or WEBP image.")
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="Image dimensions are too large.")
            image.load()
            image.thumbnail((2600, 2600))
            output = io.BytesIO()
            image.save(output, format="WEBP", quality=86, method=5)
            processed = output.getvalue()
    except UnidentifiedImageError:
        raise HTTPException(status_code=415, detail="The uploaded file is not a supported image.") from None
    except Image.DecompressionBombError:
        raise HTTPException(status_code=413, detail="Image dimensions are too large.") from None

    root = media_directory()
    root.mkdir(parents=True, exist_ok=True)
    asset_id = uuid.uuid4().hex
    filename = f"{asset_id}.webp"
    image_path = root / filename
    asset = MediaAsset(
        id=asset_id,
        filename=filename,
        url=f"{str(request.base_url).rstrip('/')}/api/media/assets/{filename}",
        alt=alt,
        slot=slot,
        uploaded_at=datetime.now(timezone.utc).isoformat(),
    )
    try:
        image_path.write_bytes(processed)
        write_asset_metadata(root, asset)
    except OSError as error:
        image_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Could not save this image. Check server storage permissions.") from error

    if slot in SINGLE_IMAGE_SLOTS:
        for previous in load_media_assets(request):
            if previous.slot == slot and previous.id != asset_id:
                (root / previous.filename).unlink(missing_ok=True)
                (root / f"{previous.id}.json").unlink(missing_ok=True)
    return asset


@app.delete("/api/admin/images/{asset_id}")
def delete_media_asset(
    asset_id: str,
    request: Request,
    _: Annotated[str, Depends(authenticated_admin)],
) -> dict[str, str]:
    check_request_origin(request)
    if not re.fullmatch(r"[a-f0-9]{32}", asset_id):
        raise HTTPException(status_code=404, detail="Image not found.")
    root = media_directory()
    metadata_path = root / f"{asset_id}.json"
    if not metadata_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found.")
    try:
        data = json.loads(metadata_path.read_text(encoding="utf-8"))
        filename = data["filename"]
        if not re.fullmatch(r"[a-f0-9]{32}\.webp", filename):
            raise ValueError("Invalid stored image filename.")
        (root / filename).unlink(missing_ok=True)
        metadata_path.unlink()
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=500, detail="Could not remove this image from the library.") from error
    return {"status": "deleted"}
