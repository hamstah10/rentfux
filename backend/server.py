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
async def delete_location(loc_id: str, _: dict = Depends(require_admin)):
    await db.locations.update_one({"id": loc_id}, {"$set": {"active": False}})
    return {"ok": True}


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
    return v


@api.post("/vehicles")
async def create_vehicle(body: VehicleIn, _: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.vehicles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/vehicles/{vid}")
async def update_vehicle(vid: str, body: VehicleIn, _: dict = Depends(require_admin)):
    r = await db.vehicles.update_one({"id": vid}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    return await db.vehicles.find_one({"id": vid}, {"_id": 0})


@api.delete("/vehicles/{vid}")
async def delete_vehicle(vid: str, _: dict = Depends(require_admin)):
    await db.vehicles.update_one({"id": vid}, {"$set": {"active": False}})
    return {"ok": True}


@api.get("/admin/vehicles")
async def admin_list_vehicles(_: dict = Depends(require_admin)):
    return await db.vehicles.find({}, {"_id": 0}).to_list(500)


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
    total = round(subtotal + extras_total, 2)

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
        "total": total,
        "status": "pending",
        "payment_status": "unpaid",
        "payment_method": None,
        "customer_note": body.customer_note,
        "notifications": {"email_sent": False, "whatsapp_sent": False},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    return doc


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
    await seed_admin()
    await seed_data()
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init skipped: {e}")


@app.on_event("shutdown")
async def on_shutdown():
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
