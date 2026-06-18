from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import secrets as _secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File, Header
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# ---------- Setup ----------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("rentfux")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 8  # 8h for nicer UX
REFRESH_TTL_DAYS = 7

app = FastAPI(title="RentFux API")
api = APIRouter(prefix="/api")


# ---------- Helpers ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie(
        key="access_token", value=access, httponly=True, secure=True,
        samesite="none", max_age=ACCESS_TTL_MIN * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh, httponly=True, secure=True,
        samesite="none", max_age=REFRESH_TTL_DAYS * 86400, path="/",
    )


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "user"),
        "phone": u.get("phone", ""),
        "date_of_birth": u.get("date_of_birth", ""),
        "address": u.get("address", {}),
        "license_number": u.get("license_number", ""),
        "license_expiry": u.get("license_expiry", ""),
        "id_card_number": u.get("id_card_number", ""),
        "is_business": bool(u.get("is_business", False)),
        "company": u.get("company", {}),
        "documents": {
            "license": _doc_meta((u.get("documents") or {}).get("license")),
            "id_card": _doc_meta((u.get("documents") or {}).get("id_card")),
        },
        "created_at": u.get("created_at"),
    }


def check_booking_profile(user: dict) -> List[str]:
    """Returns list of missing required fields for booking."""
    missing = []
    if not user.get("name"):
        missing.append("Name")
    if not user.get("phone"):
        missing.append("Telefon")
    if not user.get("date_of_birth"):
        missing.append("Geburtsdatum")
    if not user.get("license_number"):
        missing.append("Führerscheinnummer")
    addr = user.get("address") or {}
    if not addr.get("street") or not addr.get("postal_code") or not addr.get("city"):
        missing.append("Vollständige Adresse")
    docs = user.get("documents") or {}
    if not docs.get("license"):
        missing.append("Führerschein-Upload")
    if not docs.get("id_card"):
        missing.append("Personalausweis-Upload")
    if user.get("is_business"):
        company = user.get("company") or {}
        if not company.get("company_name"):
            missing.append("Firmenname")
    return missing


def _doc_meta(d):
    if not d:
        return None
    return {
        "filename": d.get("filename"),
        "content_type": d.get("content_type"),
        "size": d.get("size"),
        "uploaded_at": d.get("uploaded_at"),
    }


# ---------- Object Storage ----------
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = os.environ.get("APP_NAME", "rentfux")
_storage_key = None


def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        logger.warning("EMERGENT_LLM_KEY not set - uploads disabled")
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": key}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        logger.info("Object storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(503, "Dateispeicher nicht verfügbar")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    r.raise_for_status()
    return r.json()


def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(503, "Dateispeicher nicht verfügbar")
    r = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


ALLOWED_EXT = {"jpg", "jpeg", "png", "pdf", "webp"}
MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "webp": "image/webp", "pdf": "application/pdf",
}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Ungültiger Token-Typ")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Administratorrechte erforderlich")
    return user


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    phone: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AddressIn(BaseModel):
    street: Optional[str] = ""
    house_number: Optional[str] = ""
    postal_code: Optional[str] = ""
    city: Optional[str] = ""
    country: Optional[str] = "Deutschland"


class CompanyIn(BaseModel):
    company_name: Optional[str] = ""
    vat_id: Optional[str] = ""
    contact_person: Optional[str] = ""


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[AddressIn] = None
    license_number: Optional[str] = None
    license_expiry: Optional[str] = None
    id_card_number: Optional[str] = None
    is_business: Optional[bool] = None
    company: Optional[CompanyIn] = None


class LocationIn(BaseModel):
    name: str
    address: str
    city: str
    postal_code: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    active: bool = True


class VehicleIn(BaseModel):
    name: str
    brand: str
    category: Literal["Kleinwagen", "Kompakt", "Mittelklasse", "SUV", "Van", "Luxus", "Transporter"]
    transmission: Literal["Automatik", "Schaltgetriebe"]
    fuel: Literal["Benzin", "Diesel", "Elektro", "Hybrid"]
    seats: int
    doors: int = 4
    price_per_day: float
    image_url: str
    images: List[str] = []
    description: str = ""
    features: List[str] = []
    active: bool = True
    location_id: Optional[str] = None


class BookingIn(BaseModel):
    vehicle_id: str
    location_id: str
    start_date: str  # ISO date YYYY-MM-DD
    end_date: str
    extras: List[str] = []
    customer_note: str = ""
    discount_code: Optional[str] = None


class GuestCustomerIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1)
    phone: str = Field(min_length=3)
    date_of_birth: str = Field(min_length=8)
    address: AddressIn
    license_number: str = Field(min_length=3)
    license_expiry: Optional[str] = ""
    id_card_number: Optional[str] = ""


class GuestBookingIn(BaseModel):
    vehicle_id: str
    location_id: str
    start_date: str
    end_date: str
    extras: List[str] = []
    customer_note: str = ""
    customer: GuestCustomerIn
    payment_method: Literal["stripe", "paypal"]
    create_account: bool = False
    password: Optional[str] = None
    discount_code: Optional[str] = None


class DiscountCodeIn(BaseModel):
    code: str = Field(min_length=2)
    type: Literal["percent", "fixed"]
    value: float = Field(gt=0)
    max_uses: Optional[int] = None
    min_total: Optional[float] = 0
    valid_until: Optional[str] = None
    active: bool = True


class ApplyDiscountIn(BaseModel):
    code: str
    subtotal: float


class AdminCustomerUpdateIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[AddressIn] = None
    license_number: Optional[str] = None
    license_expiry: Optional[str] = None
    id_card_number: Optional[str] = None
    is_business: Optional[bool] = None
    company: Optional[CompanyIn] = None


class PaymentIn(BaseModel):
    booking_id: str
    method: Literal["stripe", "paypal"]


class BookingStatusIn(BaseModel):
    status: Literal["pending", "confirmed", "active", "completed", "cancelled"]


class BookingAdminUpdateIn(BaseModel):
    status: Optional[Literal["pending", "confirmed", "active", "completed", "cancelled"]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location_id: Optional[str] = None
    customer_note: Optional[str] = None
    extras: Optional[List[str]] = None


# ---------- Auth Routes ----------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-Mail ist bereits registriert")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "phone": (body.phone or "").strip(),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(uid, email, "user")
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"user": user_public(doc), "token": access}


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    ident = f"{ip}:{email}"
    attempts = await db.login_attempts.find_one({"identifier": ident})
    now = datetime.now(timezone.utc)
    if attempts and attempts.get("lock_until"):
        lu = datetime.fromisoformat(attempts["lock_until"])
        if lu > now:
            raise HTTPException(status_code=429, detail="Zu viele Fehlversuche. Bitte später erneut versuchen.")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        new_count = (attempts.get("count", 0) if attempts else 0) + 1
        update = {"identifier": ident, "count": new_count, "updated_at": now.isoformat()}
        if new_count >= 5:
            update["lock_until"] = (now + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="Ungültige E-Mail oder Passwort")
    await db.login_attempts.delete_one({"identifier": ident})
    access = create_access_token(user["id"], user["email"], user.get("role", "user"))
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": user_public(user), "token": access}


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user_public(user)}


@api.patch("/auth/profile")
async def update_profile(body: UserUpdateIn, user: dict = Depends(get_current_user)):
    raw = body.model_dump(exclude_none=True)
    if "address" in raw and raw["address"] is not None:
        raw["address"] = {k: (v or "") for k, v in raw["address"].items()}
    if "company" in raw and raw["company"] is not None:
        raw["company"] = {k: (v or "") for k, v in raw["company"].items()}
    if raw:
        await db.users.update_one({"id": user["id"]}, {"$set": raw})
    refreshed = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"user": user_public(refreshed)}


@api.get("/auth/profile-status")
async def profile_status(user: dict = Depends(get_current_user)):
    missing = check_booking_profile(user)
    return {"complete": len(missing) == 0, "missing": missing}


# ---------- Document Uploads ----------
DOC_TYPES = {"license", "id_card"}


async def _save_user_document(user_id: str, doc_type: str, file: UploadFile) -> dict:
    if doc_type not in DOC_TYPES:
        raise HTTPException(400, "Ungültiger Dokumenttyp")
    if not file.filename:
        raise HTTPException(400, "Datei fehlt")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, "Nur JPG, PNG, WEBP oder PDF erlaubt")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Datei zu groß (max 5 MB)")
    if len(data) == 0:
        raise HTTPException(400, "Datei ist leer")
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    path = f"{APP_NAME}/users/{user_id}/{doc_type}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, content_type)
    meta = {
        "path": result["path"],
        "filename": file.filename,
        "content_type": content_type,
        "size": len(data),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one(
        {"id": user_id},
        {"$set": {f"documents.{doc_type}": meta}},
    )
    return meta


@api.post("/uploads/documents/{doc_type}")
async def upload_my_document(
    doc_type: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    meta = await _save_user_document(user["id"], doc_type, file)
    return _doc_meta(meta)


@api.delete("/uploads/documents/{doc_type}")
async def delete_my_document(doc_type: str, user: dict = Depends(get_current_user)):
    if doc_type not in DOC_TYPES:
        raise HTTPException(400, "Ungültiger Dokumenttyp")
    await db.users.update_one({"id": user["id"]}, {"$unset": {f"documents.{doc_type}": ""}})
    return {"ok": True}


@api.get("/uploads/documents/me/{doc_type}")
async def get_my_document(doc_type: str, user: dict = Depends(get_current_user)):
    if doc_type not in DOC_TYPES:
        raise HTTPException(400, "Ungültiger Dokumenttyp")
    meta = (user.get("documents") or {}).get(doc_type)
    if not meta:
        raise HTTPException(404, "Kein Dokument hochgeladen")
    data, ct = get_object(meta["path"])
    return Response(content=data, media_type=meta.get("content_type", ct))


@api.get("/admin/customers/{uid}/documents/{doc_type}")
async def admin_get_customer_document(uid: str, doc_type: str, _: dict = Depends(require_admin)):
    if doc_type not in DOC_TYPES:
        raise HTTPException(400, "Ungültiger Dokumenttyp")
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Kunde nicht gefunden")
    meta = (target.get("documents") or {}).get(doc_type)
    if not meta:
        raise HTTPException(404, "Kein Dokument hochgeladen")
    data, ct = get_object(meta["path"])
    return Response(content=data, media_type=meta.get("content_type", ct))


# ---------- Locations ----------
@api.get("/locations")
async def list_locations():
    items = await db.locations.find({"active": True}, {"_id": 0}).to_list(200)
    return items


@api.post("/locations")
async def create_location(body: LocationIn, _: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.locations.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/locations/{loc_id}")
async def update_location(loc_id: str, body: LocationIn, _: dict = Depends(require_admin)):
    r = await db.locations.update_one({"id": loc_id}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Standort nicht gefunden")
    return await db.locations.find_one({"id": loc_id}, {"_id": 0})


@api.delete("/locations/{loc_id}")
async def delete_location(loc_id: str, hard: bool = False, _: dict = Depends(require_admin)):
    loc = await db.locations.find_one({"id": loc_id}, {"_id": 0, "id": 1})
    if not loc:
        raise HTTPException(404, "Standort nicht gefunden")
    if hard:
        # Block hard-delete if any vehicles are assigned to this location
        veh_count = await db.vehicles.count_documents({"location_id": loc_id})
        if veh_count > 0:
            raise HTTPException(
                409,
                f"Standort hat {veh_count} zugeordnete Fahrzeug(e). "
                "Bitte erst zuweisen oder Fahrzeuge entfernen."
            )
        await db.locations.delete_one({"id": loc_id})
        return {"ok": True, "deleted": True}
    await db.locations.update_one({"id": loc_id}, {"$set": {"active": False}})
    return {"ok": True, "deactivated": True}


@api.get("/admin/locations")
async def admin_list_locations(_: dict = Depends(require_admin)):
    return await db.locations.find({}, {"_id": 0}).to_list(500)


# ---------- Vehicles ----------
@api.get("/vehicles")
async def list_vehicles(
    category: Optional[str] = None,
    transmission: Optional[str] = None,
    fuel: Optional[str] = None,
    seats_min: Optional[int] = None,
    price_max: Optional[float] = None,
    price_min: Optional[float] = None,
    search: Optional[str] = None,
):
    q: dict = {"active": True}
    if category:
        q["category"] = category
    if transmission:
        q["transmission"] = transmission
    if fuel:
        q["fuel"] = fuel
    if seats_min:
        q["seats"] = {"$gte": seats_min}
    price_q = {}
    if price_min is not None:
        price_q["$gte"] = price_min
    if price_max is not None:
        price_q["$lte"] = price_max
    if price_q:
        q["price_per_day"] = price_q
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}},
        ]
    items = await db.vehicles.find(q, {"_id": 0}).to_list(500)
    return items


@api.get("/vehicles/{vid}")
async def get_vehicle(vid: str):
    v = await db.vehicles.find_one({"id": vid}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    if v.get("location_id"):
        loc = await db.locations.find_one({"id": v["location_id"]}, {"_id": 0, "name": 1})
        if loc:
            v["location_name"] = loc.get("name", "")
    return v


@api.post("/vehicles")
async def create_vehicle(body: VehicleIn, _: dict = Depends(require_admin)):
    data = body.model_dump()
    # Ensure images[] always contains image_url (primary)
    imgs = list(data.get("images") or [])
    primary = (data.get("image_url") or "").strip()
    if primary and primary not in imgs:
        imgs.insert(0, primary)
    if imgs and not primary:
        data["image_url"] = imgs[0]
    data["images"] = imgs
    doc = {"id": str(uuid.uuid4()), **data,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.vehicles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/vehicles/{vid}")
async def update_vehicle(vid: str, body: VehicleIn, _: dict = Depends(require_admin)):
    data = body.model_dump()
    imgs = list(data.get("images") or [])
    primary = (data.get("image_url") or "").strip()
    if primary and primary not in imgs:
        imgs.insert(0, primary)
    if imgs and not primary:
        data["image_url"] = imgs[0]
    data["images"] = imgs
    r = await db.vehicles.update_one({"id": vid}, {"$set": data})
    if r.matched_count == 0:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    return await db.vehicles.find_one({"id": vid}, {"_id": 0})


@api.delete("/vehicles/{vid}")
async def delete_vehicle(vid: str, hard: bool = False, _: dict = Depends(require_admin)):
    veh = await db.vehicles.find_one({"id": vid}, {"_id": 0, "id": 1})
    if not veh:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    if hard:
        # Block only on open bookings (not cancelled/completed)
        active = await db.bookings.count_documents({
            "vehicle_id": vid,
            "status": {"$in": ["pending", "confirmed", "active"]},
        })
        if active > 0:
            raise HTTPException(
                409,
                f"Fahrzeug hat {active} aktive Buchung(en). Bitte erst stornieren oder deaktivieren."
            )
        # Anonymise historical bookings (completed/cancelled) to preserve accounting
        await db.bookings.update_many(
            {"vehicle_id": vid},
            {"$set": {"vehicle_id": None, "vehicle_deleted": True}},
        )
        await db.vehicles.delete_one({"id": vid})
        await db.vehicle_positions.delete_many({"vehicle_id": vid})
        return {"ok": True, "deleted": True}
    # Soft delete: deactivate
    await db.vehicles.update_one({"id": vid}, {"$set": {"active": False}})
    return {"ok": True, "deactivated": True}


@api.get("/admin/vehicles")
async def admin_list_vehicles(_: dict = Depends(require_admin)):
    return await db.vehicles.find({}, {"_id": 0}).to_list(500)


# ---------- Vehicle Image Uploads ----------
IMAGE_EXT = {"jpg", "jpeg", "png", "webp"}


@api.post("/admin/vehicles/{vid}/images")
async def admin_upload_vehicle_image(
    vid: str,
    file: UploadFile = File(...),
    _: dict = Depends(require_admin),
):
    veh = await db.vehicles.find_one({"id": vid}, {"_id": 0})
    if not veh:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    if not file.filename:
        raise HTTPException(400, "Datei fehlt")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in IMAGE_EXT:
        raise HTTPException(400, "Nur JPG, PNG oder WEBP erlaubt")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Bild zu groß (max 5 MB)")
    if len(data) == 0:
        raise HTTPException(400, "Datei ist leer")
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/vehicles/{vid}/{file_id}.{ext}"
    put_object(path, data, content_type)
    api_url = f"/api/vehicles/{vid}/images/{file_id}.{ext}"
    images = list(veh.get("images") or [])
    images.append(api_url)
    update = {"images": images}
    if not veh.get("image_url"):
        update["image_url"] = api_url
    await db.vehicles.update_one({"id": vid}, {"$set": update})
    return {"url": api_url, "images": images, "size": len(data)}


@api.get("/vehicles/{vid}/images/{filename}")
async def serve_vehicle_image(vid: str, filename: str):
    # filename is like "<uuid>.<ext>"; safe characters only
    if "/" in filename or ".." in filename:
        raise HTTPException(400, "Ungültiger Dateiname")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in IMAGE_EXT:
        raise HTTPException(400, "Ungültiger Dateityp")
    path = f"{APP_NAME}/vehicles/{vid}/{filename}"
    try:
        data, ct = get_object(path)
    except Exception:
        raise HTTPException(404, "Bild nicht gefunden")
    return Response(
        content=data,
        media_type=ct or MIME_TYPES.get(ext, "application/octet-stream"),
        headers={"Cache-Control": "public, max-age=86400"},
    )


@api.delete("/admin/vehicles/{vid}/images")
async def admin_delete_vehicle_image(
    vid: str,
    url: str,
    _: dict = Depends(require_admin),
):
    veh = await db.vehicles.find_one({"id": vid}, {"_id": 0})
    if not veh:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    images = [i for i in (veh.get("images") or []) if i != url]
    update = {"images": images}
    if veh.get("image_url") == url:
        update["image_url"] = images[0] if images else ""
    await db.vehicles.update_one({"id": vid}, {"$set": update})
    # Best-effort delete from object storage (only for internal urls)
    if url.startswith(f"/api/vehicles/{vid}/images/"):
        filename = url.rsplit("/", 1)[-1]
        path = f"{APP_NAME}/vehicles/{vid}/{filename}"
        try:
            key = init_storage()
            if key:
                requests.delete(
                    f"{STORAGE_URL}/objects/{path}",
                    headers={"X-Storage-Key": key},
                    timeout=30,
                )
        except Exception as e:
            logger.warning(f"Storage delete failed for {path}: {e}")
    return {"ok": True, "images": images}


@api.patch("/admin/vehicles/{vid}/images/reorder")
async def admin_reorder_vehicle_images(
    vid: str,
    body: dict,
    _: dict = Depends(require_admin),
):
    veh = await db.vehicles.find_one({"id": vid}, {"_id": 0})
    if not veh:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    new_order = body.get("images") or []
    if not isinstance(new_order, list):
        raise HTTPException(400, "images muss eine Liste sein")
    existing = set(veh.get("images") or [])
    filtered = [u for u in new_order if u in existing]
    update = {"images": filtered}
    if filtered:
        update["image_url"] = filtered[0]
    await db.vehicles.update_one({"id": vid}, {"$set": update})
    return {"ok": True, "images": filtered, "image_url": update.get("image_url", "")}


# ---------- Bookings ----------
def _days_between(s: str, e: str) -> int:
    ds = datetime.strptime(s, "%Y-%m-%d").date()
    de = datetime.strptime(e, "%Y-%m-%d").date()
    days = (de - ds).days
    return max(days, 1)


async def _is_available(vehicle_id: str, start: str, end: str) -> bool:
    overlap = await db.bookings.find_one({
        "vehicle_id": vehicle_id,
        "status": {"$in": ["pending", "confirmed", "active"]},
        "start_date": {"$lt": end},
        "end_date": {"$gt": start},
    })
    return overlap is None


@api.get("/vehicles/{vid}/availability")
async def check_availability(vid: str, start: str, end: str):
    ok = await _is_available(vid, start, end)
    return {"available": ok}


async def _resolve_discount(code: Optional[str], subtotal_plus_extras: float):
    """Returns (discount_amount, discount_doc) or (0, None). Raises HTTPException if invalid."""
    if not code:
        return 0.0, None
    code_up = code.strip().upper()
    if not code_up:
        return 0.0, None
    d = await db.discount_codes.find_one({"code": code_up, "active": True}, {"_id": 0})
    if not d:
        raise HTTPException(400, "Rabattcode ungültig")
    if d.get("valid_until"):
        try:
            until = datetime.strptime(d["valid_until"], "%Y-%m-%d").date()
            if datetime.now(timezone.utc).date() > until:
                raise HTTPException(400, "Rabattcode abgelaufen")
        except ValueError:
            pass
    if d.get("max_uses") and d.get("used_count", 0) >= d["max_uses"]:
        raise HTTPException(400, "Rabattcode ist aufgebraucht")
    if d.get("min_total") and subtotal_plus_extras < d["min_total"]:
        raise HTTPException(400, f"Mindestbestellwert {d['min_total']:.2f}€ nicht erreicht")
    if d["type"] == "percent":
        amount = round(subtotal_plus_extras * (d["value"] / 100.0), 2)
    else:
        amount = round(min(d["value"], subtotal_plus_extras), 2)
    return amount, d


async def _consume_discount(d: Optional[dict]):
    if d:
        await db.discount_codes.update_one({"code": d["code"]}, {"$inc": {"used_count": 1}})


@api.post("/bookings")
async def create_booking(body: BookingIn, user: dict = Depends(get_current_user)):
    missing = check_booking_profile(user)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Profil unvollständig. Bitte ergänze: {', '.join(missing)}",
        )
    v = await db.vehicles.find_one({"id": body.vehicle_id, "active": True}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Fahrzeug nicht verfügbar")
    loc = await db.locations.find_one({"id": body.location_id}, {"_id": 0})
    if not loc:
        raise HTTPException(404, "Standort nicht gefunden")
    try:
        days = _days_between(body.start_date, body.end_date)
    except ValueError:
        raise HTTPException(400, "Ungültige Datumsangabe")
    if not await _is_available(body.vehicle_id, body.start_date, body.end_date):
        raise HTTPException(409, "Fahrzeug in diesem Zeitraum nicht verfügbar")

    extras_total = sum(EXTRAS_PRICE_MAP.get(e, 0) for e in body.extras) * days
    subtotal = v["price_per_day"] * days
    gross = subtotal + extras_total
    discount_amount, discount_doc = await _resolve_discount(body.discount_code, gross)
    total = round(max(0.0, gross - discount_amount), 2)

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user.get("name", ""),
        "vehicle_id": body.vehicle_id,
        "vehicle_name": v["name"],
        "vehicle_brand": v["brand"],
        "vehicle_image": v["image_url"],
        "location_id": body.location_id,
        "location_name": loc["name"],
        "start_date": body.start_date,
        "end_date": body.end_date,
        "days": days,
        "extras": body.extras,
        "extras_total": extras_total,
        "subtotal": subtotal,
        "discount_code": discount_doc["code"] if discount_doc else None,
        "discount_amount": discount_amount,
        "total": total,
        "status": "pending",
        "payment_status": "unpaid",
        "payment_method": None,
        "customer_note": body.customer_note,
        "notifications": {"email_sent": False, "whatsapp_sent": False},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bookings.insert_one(doc)
    await _consume_discount(discount_doc)
    doc.pop("_id", None)
    return doc


@api.post("/bookings/guest")
async def create_guest_booking(body: GuestBookingIn, response: Response):
    email = body.customer.email.lower().strip()
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})

    # Handle account creation up-front if requested
    created_user = None
    access_token = None
    if body.create_account:
        if not body.password or len(body.password) < 6:
            raise HTTPException(400, "Passwort erforderlich (mind. 6 Zeichen)")
        if existing_user:
            raise HTTPException(
                400,
                "Ein Konto mit dieser E-Mail existiert bereits. Bitte melde dich an.",
            )
        uid = str(uuid.uuid4())
        created_user = {
            "id": uid,
            "email": email,
            "password_hash": hash_password(body.password),
            "name": body.customer.name.strip(),
            "phone": body.customer.phone.strip(),
            "date_of_birth": body.customer.date_of_birth,
            "address": body.customer.address.model_dump(),
            "license_number": body.customer.license_number,
            "license_expiry": body.customer.license_expiry or "",
            "id_card_number": body.customer.id_card_number or "",
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(created_user)
        access_token = create_access_token(uid, email, "user")
        refresh_token = create_refresh_token(uid)
        set_auth_cookies(response, access_token, refresh_token)

    # Validate vehicle + location + dates
    v = await db.vehicles.find_one({"id": body.vehicle_id, "active": True}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Fahrzeug nicht verfügbar")
    loc = await db.locations.find_one({"id": body.location_id}, {"_id": 0})
    if not loc:
        raise HTTPException(404, "Standort nicht gefunden")
    try:
        days = _days_between(body.start_date, body.end_date)
    except ValueError:
        raise HTTPException(400, "Ungültige Datumsangabe")
    if not await _is_available(body.vehicle_id, body.start_date, body.end_date):
        raise HTTPException(409, "Fahrzeug in diesem Zeitraum nicht verfügbar")

    extras_total = sum(EXTRAS_PRICE_MAP.get(e, 0) for e in body.extras) * days
    subtotal = v["price_per_day"] * days
    gross = subtotal + extras_total
    discount_amount, discount_doc = await _resolve_discount(body.discount_code, gross)
    total = round(max(0.0, gross - discount_amount), 2)

    # Determine booking owner
    owner_id = (created_user or existing_user or {}).get("id")
    is_guest = owner_id is None

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": owner_id or f"guest-{uuid.uuid4()}",
        "user_email": email,
        "user_name": body.customer.name.strip(),
        "is_guest": is_guest,
        "guest_customer": body.customer.model_dump() if is_guest else None,
        "vehicle_id": body.vehicle_id,
        "vehicle_name": v["name"],
        "vehicle_brand": v["brand"],
        "vehicle_image": v["image_url"],
        "location_id": body.location_id,
        "location_name": loc["name"],
        "start_date": body.start_date,
        "end_date": body.end_date,
        "days": days,
        "extras": body.extras,
        "extras_total": extras_total,
        "subtotal": subtotal,
        "discount_code": discount_doc["code"] if discount_doc else None,
        "discount_amount": discount_amount,
        "total": total,
        "status": "confirmed",
        "payment_status": "paid",
        "payment_method": body.payment_method,
        "customer_note": body.customer_note,
        "notifications": {"email_sent": True, "whatsapp_sent": True},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "paid_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bookings.insert_one(doc)
    await _consume_discount(discount_doc)
    doc.pop("_id", None)
    logger.info(f"[MOCK] Guest booking {doc['id']} for {email} confirmed")

    result = {"booking": doc, "account_created": bool(created_user)}
    if created_user:
        result["user"] = user_public(created_user)
        result["token"] = access_token
    return result



@api.post("/payments/mock-pay")
async def mock_pay(body: PaymentIn, user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": body.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Buchung nicht gefunden")
    if booking["user_id"] != user["id"]:
        raise HTTPException(403, "Keine Berechtigung")
    # MOCKED payment — just mark as paid
    await db.bookings.update_one(
        {"id": body.booking_id},
        {"$set": {
            "payment_status": "paid",
            "payment_method": body.method,
            "status": "confirmed",
            "notifications": {"email_sent": True, "whatsapp_sent": True},
            "paid_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    logger.info(f"[MOCK] E-Mail & WhatsApp-Bestätigung an {user['email']} gesendet für Buchung {body.booking_id}")
    updated = await db.bookings.find_one({"id": body.booking_id}, {"_id": 0})
    return updated


@api.get("/bookings/me")
async def my_bookings(user: dict = Depends(get_current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/bookings/{bid}")
async def get_booking(bid: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Buchung nicht gefunden")
    if b["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Keine Berechtigung")
    return b


@api.get("/admin/bookings")
async def admin_bookings(_: dict = Depends(require_admin)):
    return await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.get("/admin/bookings/{bid}")
async def admin_booking_detail(bid: str, _: dict = Depends(require_admin)):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Buchung nicht gefunden")
    return b


EXTRAS_PRICE_MAP = {
    "Navigation": 5, "Kindersitz": 7, "Zusatzfahrer": 8,
    "Vollkasko": 12, "WLAN-Hotspot": 4,
}


@api.patch("/admin/bookings/{bid}")
async def admin_update_booking(bid: str, body: BookingAdminUpdateIn, _: dict = Depends(require_admin)):
    existing = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Buchung nicht gefunden")

    upd: dict = {}
    new_start = body.start_date or existing["start_date"]
    new_end = body.end_date or existing["end_date"]

    # If dates or extras change, recalculate totals
    if body.start_date or body.end_date or body.extras is not None:
        try:
            days = _days_between(new_start, new_end)
        except ValueError:
            raise HTTPException(400, "Ungültige Datumsangabe")
        extras_list = body.extras if body.extras is not None else existing.get("extras", [])
        vehicle = await db.vehicles.find_one({"id": existing["vehicle_id"]}, {"_id": 0})
        if not vehicle:
            raise HTTPException(404, "Fahrzeug nicht gefunden")
        extras_total = sum(EXTRAS_PRICE_MAP.get(e, 0) for e in extras_list) * days
        subtotal = vehicle["price_per_day"] * days
        total = round(subtotal + extras_total, 2)
        upd.update({
            "start_date": new_start, "end_date": new_end, "days": days,
            "extras": extras_list, "extras_total": extras_total,
            "subtotal": subtotal, "total": total,
        })

    if body.status is not None:
        upd["status"] = body.status
    if body.location_id is not None:
        loc = await db.locations.find_one({"id": body.location_id}, {"_id": 0})
        if not loc:
            raise HTTPException(404, "Standort nicht gefunden")
        upd["location_id"] = body.location_id
        upd["location_name"] = loc["name"]
    if body.customer_note is not None:
        upd["customer_note"] = body.customer_note

    if upd:
        upd["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.bookings.update_one({"id": bid}, {"$set": upd})
    return await db.bookings.find_one({"id": bid}, {"_id": 0})


@api.post("/admin/bookings/{bid}/cancel")
async def admin_cancel_booking(bid: str, _: dict = Depends(require_admin)):
    r = await db.bookings.update_one(
        {"id": bid},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Buchung nicht gefunden")
    return await db.bookings.find_one({"id": bid}, {"_id": 0})


@api.delete("/admin/bookings/{bid}")
async def admin_delete_booking(bid: str, _: dict = Depends(require_admin)):
    booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Buchung nicht gefunden")
    if booking.get("status") in ("active", "confirmed") and booking.get("payment_status") == "paid":
        raise HTTPException(
            409,
            "Aktive, bezahlte Buchung kann nicht gelöscht werden. Bitte zuerst stornieren."
        )
    await db.bookings.delete_one({"id": bid})
    return {"ok": True, "deleted_id": bid}


@api.get("/admin/customers")
async def admin_customers(_: dict = Depends(require_admin)):
    users = await db.users.find({"role": "user"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    result = []
    for u in users:
        pub = user_public(u)
        pub["bookings_count"] = await db.bookings.count_documents({"user_id": u["id"]})
        result.append(pub)
    return result


@api.get("/admin/customers/{uid}")
async def admin_customer_detail(uid: str, _: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": uid, "role": "user"}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "Kunde nicht gefunden")
    bookings = await db.bookings.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total_spent = round(sum(b["total"] for b in bookings if b.get("payment_status") == "paid"), 2)
    completed = sum(1 for b in bookings if b.get("status") == "completed")
    cancelled = sum(1 for b in bookings if b.get("status") == "cancelled")
    active = sum(1 for b in bookings if b.get("status") in ("pending", "confirmed", "active"))
    return {
        "user": user_public(user),
        "bookings": bookings,
        "stats": {
            "total_bookings": len(bookings),
            "total_spent": total_spent,
            "completed": completed,
            "cancelled": cancelled,
            "active": active,
        },
    }


# ---------- Admin Stats ----------
@api.get("/admin/stats")
async def admin_stats(_: dict = Depends(require_admin)):
    total_bookings = await db.bookings.count_documents({})
    paid = await db.bookings.find({"payment_status": "paid"}, {"_id": 0, "total": 1, "created_at": 1}).to_list(10000)
    revenue = round(sum(b["total"] for b in paid), 2)
    vehicles_count = await db.vehicles.count_documents({"active": True})
    customers_count = await db.users.count_documents({"role": "user"})

    # monthly revenue last 6 months
    by_month: dict = {}
    for b in paid:
        try:
            dt = datetime.fromisoformat(b["created_at"])
            key = dt.strftime("%Y-%m")
            by_month[key] = round(by_month.get(key, 0) + b["total"], 2)
        except Exception:
            continue
    months = sorted(by_month.keys())[-6:]
    monthly = [{"month": m, "revenue": by_month[m]} for m in months]

    # status breakdown
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    status_counts = {d["_id"]: d["count"] async for d in db.bookings.aggregate(pipeline)}

    return {
        "total_bookings": total_bookings,
        "revenue": revenue,
        "vehicles": vehicles_count,
        "customers": customers_count,
        "monthly_revenue": monthly,
        "status_counts": status_counts,
    }


# ---------- Discount Codes ----------
@api.post("/bookings/apply-discount")
async def apply_discount(body: ApplyDiscountIn):
    amount, d = await _resolve_discount(body.code, body.subtotal)
    return {
        "valid": True,
        "code": d["code"],
        "type": d["type"],
        "value": d["value"],
        "discount": amount,
        "new_total": round(max(0.0, body.subtotal - amount), 2),
    }


@api.get("/admin/discounts")
async def admin_list_discounts(_: dict = Depends(require_admin)):
    return await db.discount_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/admin/discounts")
async def admin_create_discount(body: DiscountCodeIn, _: dict = Depends(require_admin)):
    code = body.code.strip().upper()
    if await db.discount_codes.find_one({"code": code}):
        raise HTTPException(400, "Rabattcode existiert bereits")
    doc = {
        **body.model_dump(),
        "code": code,
        "used_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.discount_codes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/admin/discounts/{code}")
async def admin_update_discount(code: str, body: DiscountCodeIn, _: dict = Depends(require_admin)):
    code_up = code.strip().upper()
    upd = body.model_dump()
    upd["code"] = body.code.strip().upper()
    r = await db.discount_codes.update_one({"code": code_up}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Rabattcode nicht gefunden")
    return await db.discount_codes.find_one({"code": upd["code"]}, {"_id": 0})


@api.delete("/admin/discounts/{code}")
async def admin_delete_discount(code: str, _: dict = Depends(require_admin)):
    r = await db.discount_codes.delete_one({"code": code.strip().upper()})
    return {"ok": r.deleted_count > 0}


# ---------- Admin Customer Edit ----------
@api.patch("/admin/customers/{uid}")
async def admin_update_customer(uid: str, body: AdminCustomerUpdateIn, _: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Kunde nicht gefunden")
    raw = body.model_dump(exclude_none=True)
    if "address" in raw and raw["address"] is not None:
        raw["address"] = {k: (v or "") for k, v in raw["address"].items()}
    if "company" in raw and raw["company"] is not None:
        raw["company"] = {k: (v or "") for k, v in raw["company"].items()}
    if raw:
        await db.users.update_one({"id": uid}, {"$set": raw})
    refreshed = await db.users.find_one({"id": uid}, {"_id": 0})
    return {"user": user_public(refreshed)}


@api.delete("/admin/customers/{uid}")
async def admin_delete_customer(uid: str, force: bool = False, _: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Kunde nicht gefunden")
    if target.get("role") == "admin":
        raise HTTPException(403, "Admin-Konto kann nicht gelöscht werden")

    active_bookings = await db.bookings.count_documents({
        "user_id": uid,
        "status": {"$in": ["pending", "confirmed", "active"]},
    })
    if active_bookings > 0 and not force:
        raise HTTPException(
            409,
            f"Kunde hat {active_bookings} aktive Buchung(en). "
            "Bitte zuerst stornieren oder mit ?force=true wiederholen."
        )

    # Anonymise any historical bookings to keep accounting integrity
    await db.bookings.update_many(
        {"user_id": uid},
        {"$set": {"user_id": None, "user_deleted": True}},
    )
    await db.users.delete_one({"id": uid})
    return {"ok": True, "deleted_id": uid}


# ---------- Invoice PDF ----------
def _render_invoice_pdf(booking: dict, location: Optional[dict]) -> bytes:
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas as rl_canvas

    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 25 * mm
    PRIMARY = colors.HexColor("#0055FF")
    NAVY = colors.HexColor("#0A192F")
    MUTED = colors.HexColor("#64748B")
    LINE = colors.HexColor("#E2E8F0")

    # Header brand
    c.setFillColor(PRIMARY)
    c.rect(20 * mm, y - 2 * mm, 10 * mm, 10 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(25 * mm, y + 1.5 * mm, "RF")
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(33 * mm, y + 2 * mm, "RentFux")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(33 * mm, y - 2 * mm, "Premium Autovermietung")

    # Invoice title (right)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 22)
    c.drawRightString(w - 20 * mm, y + 3 * mm, "Buchungsbestätigung")
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    c.drawRightString(w - 20 * mm, y - 3 * mm, f"Nr. {booking['id'][:8].upper()}")
    created = (booking.get("created_at") or "")[:10]
    c.drawRightString(w - 20 * mm, y - 7 * mm, f"Datum: {created}")

    # Divider
    y -= 20 * mm
    c.setStrokeColor(LINE)
    c.line(20 * mm, y, w - 20 * mm, y)
    y -= 10 * mm

    # Customer + Location blocks
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(20 * mm, y, "KUNDE")
    c.drawString(110 * mm, y, "ABHOLSTATION")
    y -= 5 * mm
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, y, booking.get("user_name") or "—")
    if location:
        c.drawString(110 * mm, y, location.get("name") or "")
    y -= 5 * mm
    c.setFont("Helvetica", 10)
    c.setFillColor(NAVY)
    c.drawString(20 * mm, y, booking.get("user_email") or "")
    if location:
        c.drawString(110 * mm, y, f"{location.get('address','')}")
    y -= 5 * mm

    gc = booking.get("guest_customer") or {}
    phone_line = gc.get("phone") or ""
    if phone_line:
        c.drawString(20 * mm, y, phone_line)
    if location:
        c.drawString(110 * mm, y, f"{location.get('postal_code','')} {location.get('city','')}")
    y -= 5 * mm

    addr = gc.get("address") or {}
    if addr.get("street"):
        addr_line = f"{addr.get('street','')} {addr.get('house_number','')}".strip()
        c.drawString(20 * mm, y, addr_line)
        y -= 5 * mm
        c.drawString(20 * mm, y, f"{addr.get('postal_code','')} {addr.get('city','')}")
        y -= 5 * mm

    # Booking details table
    y -= 10 * mm
    c.setStrokeColor(LINE)
    c.line(20 * mm, y, w - 20 * mm, y)
    y -= 8 * mm
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, y, "Buchungsdetails")
    y -= 8 * mm

    details = [
        ("Fahrzeug", f"{booking.get('vehicle_brand','')} {booking.get('vehicle_name','')}"),
        ("Abholdatum", booking.get("start_date", "")),
        ("Rückgabedatum", booking.get("end_date", "")),
        ("Anzahl Tage", str(booking.get("days", ""))),
        ("Zahlungsmethode", (booking.get("payment_method") or "—").title()),
        ("Status", (booking.get("status") or "").title()),
    ]
    c.setFont("Helvetica", 10)
    c.setFillColor(NAVY)
    for k, v in details:
        c.setFillColor(MUTED)
        c.drawString(20 * mm, y, k)
        c.setFillColor(NAVY)
        c.drawString(80 * mm, y, str(v))
        y -= 6 * mm

    # Items
    y -= 5 * mm
    c.setStrokeColor(LINE)
    c.line(20 * mm, y, w - 20 * mm, y)
    y -= 8 * mm
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, y, "Abrechnung")
    y -= 8 * mm

    c.setFont("Helvetica", 10)
    c.setFillColor(MUTED)
    c.drawString(20 * mm, y, "Position")
    c.drawRightString(w - 20 * mm, y, "Betrag")
    y -= 6 * mm
    c.setStrokeColor(LINE)
    c.line(20 * mm, y + 2 * mm, w - 20 * mm, y + 2 * mm)

    c.setFillColor(NAVY)
    days = booking.get("days", 1)
    per_day = (booking.get("subtotal", 0) / days) if days else 0
    c.drawString(20 * mm, y, f"Fahrzeug ({per_day:.2f}€ × {days} Tage)")
    c.drawRightString(w - 20 * mm, y, f"{booking.get('subtotal', 0):.2f} EUR")
    y -= 6 * mm

    for ex in booking.get("extras", []) or []:
        c.drawString(20 * mm, y, f"Extra: {ex}")
        y -= 6 * mm

    if booking.get("extras_total"):
        c.drawString(20 * mm, y, "Extras gesamt")
        c.drawRightString(w - 20 * mm, y, f"{booking.get('extras_total', 0):.2f} EUR")
        y -= 6 * mm

    if booking.get("discount_amount"):
        c.setFillColor(colors.HexColor("#10B981"))
        c.drawString(20 * mm, y, f"Rabatt ({booking.get('discount_code','')})")
        c.drawRightString(w - 20 * mm, y, f"- {booking.get('discount_amount', 0):.2f} EUR")
        c.setFillColor(NAVY)
        y -= 6 * mm

    y -= 2 * mm
    c.setStrokeColor(NAVY)
    c.setLineWidth(1)
    c.line(20 * mm, y, w - 20 * mm, y)
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(20 * mm, y, "Gesamtbetrag")
    c.setFillColor(PRIMARY)
    c.drawRightString(w - 20 * mm, y, f"{booking.get('total', 0):.2f} EUR")

    # Footer
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawCentredString(w / 2, 20 * mm, "RentFux GmbH · Hachmannplatz 16 · 20099 Hamburg · service@rentfux.de")
    c.drawCentredString(w / 2, 15 * mm, "Vielen Dank für deine Buchung. Bitte bringe Führerschein & Ausweis zur Abholung mit.")

    c.showPage()
    c.save()
    return buf.getvalue()


@api.get("/bookings/{bid}/invoice")
async def booking_invoice(bid: str, request: Request, token: Optional[str] = Query(None)):
    booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Buchung nicht gefunden")
    # Access control: allow owner, admin, or guest with booking_id (anyone who knows the UUID)
    is_guest = booking.get("is_guest", False)
    user = None
    try:
        # Mimic dependency manually since we want optional auth
        t = request.cookies.get("access_token") or token
        if not t:
            auth = request.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                t = auth[7:]
        if t:
            payload = jwt.decode(t, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    except Exception:
        user = None
    if not is_guest:
        if not user or (booking["user_id"] != user["id"] and user.get("role") != "admin"):
            raise HTTPException(403, "Keine Berechtigung")
    location = await db.locations.find_one({"id": booking.get("location_id")}, {"_id": 0})
    pdf = _render_invoice_pdf(booking, location)
    from io import BytesIO
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="RentFux-Buchung-{bid[:8].upper()}.pdf"'},
    )


# ---------- GPS Tracking ----------
# Vehicles are tracked via mocked simulated positions. Real trackers can
# POST to /api/admin/vehicles/{id}/location with the same payload shape.

# Bremerhaven center used as anchor for the mock fleet
GPS_ANCHOR_LAT = 53.5396
GPS_ANCHOR_LNG = 8.5809
GPS_FENCE_RADIUS_KM = 50  # geofence radius in kilometers


class LocationUpdateIn(BaseModel):
    lat: float
    lng: float
    speed_kmh: float = 0.0
    heading: float = 0.0  # degrees, 0=N, 90=E
    source: str = "mock"  # "mock", "manual", "tracker"


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    import math
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(a))


def _status_from_speed(speed_kmh: float) -> str:
    if speed_kmh < 2:
        return "parked"
    if speed_kmh < 25:
        return "city"
    return "highway"


async def _store_position(vehicle_id: str, payload: dict):
    now = datetime.now(timezone.utc)
    speed = float(payload.get("speed_kmh", 0.0))
    lat = float(payload["lat"])
    lng = float(payload["lng"])
    fence_km = _haversine_km(lat, lng, GPS_ANCHOR_LAT, GPS_ANCHOR_LNG)
    doc = {
        "id": str(uuid.uuid4()),
        "vehicle_id": vehicle_id,
        "lat": lat,
        "lng": lng,
        "speed_kmh": speed,
        "heading": float(payload.get("heading", 0.0)),
        "source": payload.get("source", "mock"),
        "status": _status_from_speed(speed),
        "fence_km": round(fence_km, 2),
        "geofence_alert": fence_km > GPS_FENCE_RADIUS_KM,
        "ts": now.isoformat(),
        "ts_epoch": int(now.timestamp()),
    }
    await db.vehicle_positions.insert_one(dict(doc))
    # latest position cache on vehicle row
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"last_position": {k: doc[k] for k in
                                    ("lat", "lng", "speed_kmh", "heading", "status",
                                     "fence_km", "geofence_alert", "ts", "source")}}},
    )
    doc.pop("_id", None)
    return doc


@api.post("/admin/vehicles/{vid}/location")
async def admin_push_vehicle_location(vid: str, body: LocationUpdateIn, _: dict = Depends(require_admin)):
    veh = await db.vehicles.find_one({"id": vid}, {"_id": 0, "id": 1})
    if not veh:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    return await _store_position(vid, body.model_dump())


@api.get("/admin/vehicles/{vid}/location")
async def admin_get_vehicle_location(vid: str, _: dict = Depends(require_admin)):
    veh = await db.vehicles.find_one({"id": vid}, {"_id": 0})
    if not veh:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    return veh.get("last_position") or None


@api.get("/admin/vehicles/{vid}/track")
async def admin_get_vehicle_track(vid: str, limit: int = 50, _: dict = Depends(require_admin)):
    limit = max(1, min(limit, 500))
    cursor = db.vehicle_positions.find({"vehicle_id": vid}, {"_id": 0}).sort("ts_epoch", -1).limit(limit)
    points = [p async for p in cursor]
    points.reverse()  # chronological
    return points


@api.get("/admin/fleet/locations")
async def admin_fleet_locations(_: dict = Depends(require_admin)):
    """Return current position for every vehicle with a last_position."""
    cursor = db.vehicles.find({}, {"_id": 0})
    out = []
    async for v in cursor:
        pos = v.get("last_position")
        if not pos:
            continue
        out.append({
            "vehicle_id": v["id"],
            "name": v["name"],
            "brand": v["brand"],
            "category": v.get("category"),
            "image_url": v.get("image_url"),
            "price_per_day": v.get("price_per_day"),
            "active": v.get("active", True),
            **pos,
        })
    return out


# Mock simulator: small random walk for each vehicle
async def _seed_initial_positions():
    """Seed every vehicle with a starting position around Bremerhaven if not set."""
    import random
    cursor = db.vehicles.find({"last_position": {"$exists": False}}, {"_id": 0})
    async for v in cursor:
        # spread ~ +/- 0.04 deg (~ 4 km lat, ~ 2.5 km lng)
        lat = GPS_ANCHOR_LAT + random.uniform(-0.04, 0.04)
        lng = GPS_ANCHOR_LNG + random.uniform(-0.04, 0.04)
        speed = random.choice([0, 0, 0, 18, 42, 60])
        heading = random.randint(0, 359)
        await _store_position(v["id"], {
            "lat": lat, "lng": lng, "speed_kmh": speed,
            "heading": heading, "source": "mock",
        })


async def _gps_simulator_loop():
    """Background coroutine that nudges every vehicle position every 15s."""
    import asyncio
    import random
    import math
    while True:
        try:
            cursor = db.vehicles.find({"last_position": {"$exists": True}}, {"_id": 0})
            async for v in cursor:
                pos = v.get("last_position") or {}
                lat = float(pos.get("lat", GPS_ANCHOR_LAT))
                lng = float(pos.get("lng", GPS_ANCHOR_LNG))
                speed = float(pos.get("speed_kmh", 0.0))
                heading = float(pos.get("heading", 0.0))

                # 20% chance to flip status (park <-> drive)
                if random.random() < 0.20:
                    speed = random.choice([0.0, 22.0, 48.0, 68.0])
                    heading = (heading + random.uniform(-90, 90)) % 360
                else:
                    heading = (heading + random.uniform(-15, 15)) % 360

                # Move based on speed. 1 deg lat ~ 111 km. interval=15s
                dt_h = 15.0 / 3600.0
                dist_km = speed * dt_h
                dlat = (dist_km / 111.0) * math.cos(math.radians(heading))
                dlng = (dist_km / (111.0 * max(0.0001, math.cos(math.radians(lat))))) * math.sin(math.radians(heading))
                new_lat = lat + dlat
                new_lng = lng + dlng

                # Gentle pull back to anchor if too far (so the demo stays around Bremerhaven)
                if _haversine_km(new_lat, new_lng, GPS_ANCHOR_LAT, GPS_ANCHOR_LNG) > 30:
                    new_lat = lat + (GPS_ANCHOR_LAT - lat) * 0.01
                    new_lng = lng + (GPS_ANCHOR_LNG - lng) * 0.01

                await _store_position(v["id"], {
                    "lat": new_lat, "lng": new_lng,
                    "speed_kmh": speed, "heading": heading,
                    "source": "mock",
                })
        except Exception as e:
            logger.warning(f"GPS simulator tick failed: {e}")
        await asyncio.sleep(15)





# ---------- Health ----------
@api.get("/")
async def root():
    return {"service": "RentFux API", "status": "ok"}


# ---------- Startup: indexes + seed ----------
SEED_LOCATION = {
    "id": "loc-hamburg-hbf",
    "name": "RentFux Hamburg Hauptbahnhof",
    "address": "Hachmannplatz 16",
    "city": "Hamburg",
    "postal_code": "20099",
    "phone": "+49 40 123 456 78",
    "email": "hamburg@rentfux.de",
    "active": True,
}

SEED_VEHICLES = [
    {
        "name": "Polo", "brand": "Volkswagen", "category": "Kleinwagen",
        "transmission": "Schaltgetriebe", "fuel": "Benzin", "seats": 5, "doors": 4,
        "price_per_day": 39.0,
        "image_url": "https://images.unsplash.com/photo-1541443131876-44b03de101c5?auto=format&fit=crop&w=1200&q=80",
        "description": "Wendiger Kleinwagen – ideal für die Stadt und Kurzstrecken.",
        "features": ["Klimaanlage", "Bluetooth", "USB-C"],
    },
    {
        "name": "Golf 8", "brand": "Volkswagen", "category": "Kompakt",
        "transmission": "Automatik", "fuel": "Benzin", "seats": 5, "doors": 5,
        "price_per_day": 59.0,
        "image_url": "https://images.unsplash.com/photo-1520031441872-265e4ff70366?auto=format&fit=crop&w=1200&q=80",
        "description": "Der beliebte Kompaktwagen – effizient, komfortabel und zuverlässig.",
        "features": ["Automatik", "Navigation", "Tempomat", "LED-Scheinwerfer"],
    },
    {
        "name": "A-Klasse", "brand": "Mercedes-Benz", "category": "Mittelklasse",
        "transmission": "Automatik", "fuel": "Diesel", "seats": 5, "doors": 5,
        "price_per_day": 79.0,
        "image_url": "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=1200&q=80",
        "description": "Sportlich-elegante Limousine mit MBUX und Premium-Ausstattung.",
        "features": ["MBUX", "Automatik", "Ledersitze", "Sitzheizung"],
    },
    {
        "name": "3er Touring", "brand": "BMW", "category": "Mittelklasse",
        "transmission": "Automatik", "fuel": "Diesel", "seats": 5, "doors": 5,
        "price_per_day": 89.0,
        "image_url": "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80",
        "description": "Dynamischer Kombi mit viel Platz – perfekt für Geschäftsreisen.",
        "features": ["Navigation", "Head-Up-Display", "Automatik", "Panoramadach"],
    },
    {
        "name": "Tiguan", "brand": "Volkswagen", "category": "SUV",
        "transmission": "Automatik", "fuel": "Diesel", "seats": 5, "doors": 5,
        "price_per_day": 99.0,
        "image_url": "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80",
        "description": "Geräumiger SUV mit 4Motion-Allradantrieb – ideal für Familien.",
        "features": ["Allrad", "Panoramadach", "AppConnect", "Rückfahrkamera"],
    },
    {
        "name": "Model 3", "brand": "Tesla", "category": "Mittelklasse",
        "transmission": "Automatik", "fuel": "Elektro", "seats": 5, "doors": 4,
        "price_per_day": 119.0,
        "image_url": "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80",
        "description": "Vollelektrisch, leise und schnell. Autopilot inklusive.",
        "features": ["Autopilot", "Supercharger-Zugang", "Glasdach", "15'' Display"],
    },
    {
        "name": "Multivan", "brand": "Volkswagen", "category": "Van",
        "transmission": "Automatik", "fuel": "Diesel", "seats": 7, "doors": 5,
        "price_per_day": 149.0,
        "image_url": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80",
        "description": "Das Raumwunder für Großfamilien und Geschäftsteams.",
        "features": ["7 Sitze", "Schiebetüren", "Klimaautomatik", "Anhängerkupplung"],
    },
    {
        "name": "Q5", "brand": "Audi", "category": "Luxus",
        "transmission": "Automatik", "fuel": "Hybrid", "seats": 5, "doors": 5,
        "price_per_day": 169.0,
        "image_url": "https://images.unsplash.com/photo-1606611013016-969c19ba27bf?auto=format&fit=crop&w=1200&q=80",
        "description": "Premium-SUV mit quattro-Allrad und Plug-in-Hybrid.",
        "features": ["quattro", "Virtual Cockpit", "B&O Sound", "Matrix LED"],
    },
]


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower().strip()
    pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(pw),
            "name": "RentFux Admin",
            "phone": "",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin user seeded: {email}")
    elif not verify_password(pw, existing["password_hash"]):
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": hash_password(pw), "role": "admin"}},
        )
        logger.info(f"Admin password refreshed: {email}")


async def seed_data():
    if await db.locations.count_documents({}) == 0:
        await db.locations.insert_one({
            **SEED_LOCATION,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded default location")
    if await db.vehicles.count_documents({}) == 0:
        loc_id = SEED_LOCATION["id"]
        for v in SEED_VEHICLES:
            await db.vehicles.insert_one({
                "id": str(uuid.uuid4()),
                "active": True,
                "location_id": loc_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                **v,
            })
        logger.info(f"Seeded {len(SEED_VEHICLES)} vehicles")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.vehicles.create_index("active")
    await db.bookings.create_index("user_id")
    await db.bookings.create_index("vehicle_id")
    await db.login_attempts.create_index("identifier")
    await db.vehicle_positions.create_index([("vehicle_id", 1), ("ts_epoch", -1)])
    await seed_admin()
    await seed_data()
    await _seed_initial_positions()
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init skipped: {e}")
    # Background GPS simulator
    import asyncio
    app.state.gps_task = asyncio.create_task(_gps_simulator_loop())


@app.on_event("shutdown")
async def on_shutdown():
    task = getattr(app.state, "gps_task", None)
    if task:
        task.cancel()
    client.close()


# ---------- Wire app ----------
app.include_router(api)

_origins_raw = os.environ.get("CORS_ORIGINS", "*")
_origins = [o.strip() for o in _origins_raw.split(",")] if _origins_raw else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Set-Cookie"],
)
