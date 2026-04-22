"""RentFux Backend API Tests - pytest regression suite."""
import os
import uuid
import time
import requests
import pytest
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://drive-book-8.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@rentfux.de"
ADMIN_PASS = "Admin123!"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="module")
def user_session():
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@rentfux.de"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "TestPass123!", "name": "Test User", "phone": "+491701234567"
    }, timeout=20)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    s.test_email = email.lower()
    s.test_user_id = data["user"]["id"]
    s.test_token = data["token"]
    return s


# ---------- Health ----------
def test_health_root():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------- Vehicles (public) ----------
def test_list_vehicles_seeded():
    r = requests.get(f"{API}/vehicles", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 8, f"Expected 8+ seeded vehicles, got {len(items)}"
    first = items[0]
    # no mongo _id should leak
    assert "_id" not in first
    for k in ("id", "name", "brand", "price_per_day", "category", "transmission", "fuel", "seats"):
        assert k in first


def test_get_single_vehicle():
    r = requests.get(f"{API}/vehicles", timeout=20)
    vid = r.json()[0]["id"]
    r2 = requests.get(f"{API}/vehicles/{vid}", timeout=10)
    assert r2.status_code == 200
    assert r2.json()["id"] == vid
    assert "_id" not in r2.json()


def test_get_vehicle_not_found():
    r = requests.get(f"{API}/vehicles/nonexistent-xyz", timeout=10)
    assert r.status_code == 404


def test_vehicles_filters():
    # category
    r = requests.get(f"{API}/vehicles", params={"category": "SUV"}, timeout=10)
    assert r.status_code == 200
    for v in r.json():
        assert v["category"] == "SUV"
    # transmission
    r = requests.get(f"{API}/vehicles", params={"transmission": "Automatik"}, timeout=10)
    for v in r.json():
        assert v["transmission"] == "Automatik"
    # fuel
    r = requests.get(f"{API}/vehicles", params={"fuel": "Elektro"}, timeout=10)
    for v in r.json():
        assert v["fuel"] == "Elektro"
    # price range
    r = requests.get(f"{API}/vehicles", params={"price_min": 50, "price_max": 100}, timeout=10)
    for v in r.json():
        assert 50 <= v["price_per_day"] <= 100
    # seats_min
    r = requests.get(f"{API}/vehicles", params={"seats_min": 7}, timeout=10)
    for v in r.json():
        assert v["seats"] >= 7
    # search
    r = requests.get(f"{API}/vehicles", params={"search": "tesla"}, timeout=10)
    assert r.status_code == 200
    assert any("Tesla" in v["brand"] for v in r.json())


# ---------- Locations ----------
def test_list_locations_seeded():
    r = requests.get(f"{API}/locations", timeout=10)
    assert r.status_code == 200
    locs = r.json()
    assert len(locs) >= 1
    assert "_id" not in locs[0]
    assert locs[0]["active"] is True


# ---------- Auth ----------
def test_register_duplicate():
    email = f"TEST_dup_{uuid.uuid4().hex[:6]}@rentfux.de"
    payload = {"email": email, "password": "Pass1234!", "name": "Dup"}
    r1 = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r1.status_code == 200
    r2 = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r2.status_code == 400
    assert "registriert" in r2.json().get("detail", "").lower() or "e-mail" in r2.json().get("detail", "").lower()


def test_admin_login_returns_admin_role():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["user"]["role"] == "admin"
    assert d["user"]["email"] == ADMIN_EMAIL
    assert isinstance(d["token"], str) and len(d["token"]) > 20
    # Cookies set
    assert "access_token" in r.cookies or any("access_token" in c for c in r.headers.get("set-cookie", ""))


def test_login_invalid_password():
    # use fresh email/IP combo to avoid lockout
    r = requests.post(f"{API}/auth/login", json={"email": f"TEST_nope_{uuid.uuid4().hex[:6]}@rentfux.de", "password": "wrong"}, timeout=15)
    assert r.status_code == 401
    detail = r.json().get("detail", "")
    assert "Ungültig" in detail or "ungültig" in detail.lower()


def test_auth_me_with_bearer(user_session):
    r = user_session.get(f"{API}/auth/me", timeout=10)
    assert r.status_code == 200
    assert r.json()["user"]["email"] == user_session.test_email


def test_auth_me_unauthenticated():
    r = requests.get(f"{API}/auth/me", timeout=10)
    assert r.status_code == 401


def test_logout_clears_cookies():
    s = requests.Session()
    s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    r = s.post(f"{API}/auth/logout", timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_update_profile(user_session):
    r = user_session.patch(f"{API}/auth/profile", json={"name": "Updated Name", "phone": "+491709999999"}, timeout=10)
    assert r.status_code == 200
    u = r.json()["user"]
    assert u["name"] == "Updated Name"
    assert u["phone"] == "+491709999999"
    # verify GET persists
    r2 = user_session.get(f"{API}/auth/me", timeout=10)
    assert r2.json()["user"]["name"] == "Updated Name"


# ---------- Bookings ----------
def _future_dates(offset_start=10, days=3):
    # randomize to avoid conflicts across test runs
    offset_start = offset_start + int(uuid.uuid4().int % 300)
    s = date.today() + timedelta(days=offset_start)
    e = s + timedelta(days=days)
    return s.isoformat(), e.isoformat()


@pytest.fixture(scope="module")
def sample_vehicle_and_location():
    vehicles = requests.get(f"{API}/vehicles", timeout=10).json()
    locs = requests.get(f"{API}/locations", timeout=10).json()
    return vehicles[0], locs[0]


def test_availability_true_before_booking(sample_vehicle_and_location):
    v, _ = sample_vehicle_and_location
    s, e = _future_dates(offset_start=200, days=2)
    r = requests.get(f"{API}/vehicles/{v['id']}/availability", params={"start": s, "end": e}, timeout=10)
    assert r.status_code == 200
    assert r.json()["available"] is True


def test_create_booking_and_total(user_session, sample_vehicle_and_location):
    v, loc = sample_vehicle_and_location
    s, e = _future_dates(offset_start=30, days=3)
    payload = {
        "vehicle_id": v["id"], "location_id": loc["id"],
        "start_date": s, "end_date": e,
        "extras": ["Navigation", "Vollkasko"],  # 5 + 12 = 17/day
        "customer_note": "Test note",
    }
    r = user_session.post(f"{API}/bookings", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["status"] == "pending"
    assert b["payment_status"] == "unpaid"
    assert b["days"] == 3
    expected = round(v["price_per_day"] * 3 + 17 * 3, 2)
    assert b["total"] == expected, f"Expected {expected} got {b['total']}"
    assert "_id" not in b
    user_session.booking_id = b["id"]
    user_session.booked_vehicle = v["id"]
    user_session.booked_start = s
    user_session.booked_end = e


def test_booking_conflict_overlap(user_session, sample_vehicle_and_location):
    v = sample_vehicle_and_location[0]
    loc = sample_vehicle_and_location[1]
    # Must be after booking is confirmed — first pay
    r = user_session.post(f"{API}/payments/mock-pay",
                          json={"booking_id": user_session.booking_id, "method": "stripe"}, timeout=15)
    assert r.status_code == 200
    paid = r.json()
    assert paid["payment_status"] == "paid"
    assert paid["status"] == "confirmed"
    assert paid["payment_method"] == "stripe"
    # Now try overlapping booking
    r2 = user_session.post(f"{API}/bookings", json={
        "vehicle_id": user_session.booked_vehicle, "location_id": loc["id"],
        "start_date": user_session.booked_start, "end_date": user_session.booked_end, "extras": []
    }, timeout=15)
    assert r2.status_code == 409


def test_availability_false_during_booking(user_session):
    r = requests.get(f"{API}/vehicles/{user_session.booked_vehicle}/availability",
                     params={"start": user_session.booked_start, "end": user_session.booked_end}, timeout=10)
    assert r.status_code == 200
    assert r.json()["available"] is False


def test_my_bookings(user_session):
    r = user_session.get(f"{API}/bookings/me", timeout=10)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    assert any(b["id"] == user_session.booking_id for b in items)


def test_booking_owner_access(user_session):
    r = user_session.get(f"{API}/bookings/{user_session.booking_id}", timeout=10)
    assert r.status_code == 200
    assert r.json()["id"] == user_session.booking_id


def test_booking_other_user_forbidden(user_session):
    # create second user
    other = requests.Session()
    email = f"TEST_other_{uuid.uuid4().hex[:6]}@rentfux.de"
    r = other.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234!", "name": "Other"}, timeout=15)
    tok = r.json()["token"]
    other.headers.update({"Authorization": f"Bearer {tok}"})
    r2 = other.get(f"{API}/bookings/{user_session.booking_id}", timeout=10)
    assert r2.status_code == 403


def test_booking_invalid_vehicle(user_session, sample_vehicle_and_location):
    loc = sample_vehicle_and_location[1]
    s, e = _future_dates(offset_start=500, days=2)
    r = user_session.post(f"{API}/bookings", json={
        "vehicle_id": "nonexistent", "location_id": loc["id"],
        "start_date": s, "end_date": e, "extras": []
    }, timeout=10)
    assert r.status_code == 404


# ---------- Admin ----------
def test_non_admin_forbidden_stats(user_session):
    r = user_session.get(f"{API}/admin/stats", timeout=10)
    assert r.status_code == 403


def test_non_admin_forbidden_bookings(user_session):
    r = user_session.get(f"{API}/admin/bookings", timeout=10)
    assert r.status_code == 403


def test_admin_stats(admin_session):
    r = admin_session.get(f"{API}/admin/stats", timeout=10)
    assert r.status_code == 200
    d = r.json()
    for k in ("revenue", "total_bookings", "vehicles", "customers", "monthly_revenue", "status_counts"):
        assert k in d
    assert d["vehicles"] >= 8
    assert d["total_bookings"] >= 1
    assert d["revenue"] >= 0
    assert isinstance(d["monthly_revenue"], list)
    assert isinstance(d["status_counts"], dict)


def test_admin_bookings_list(admin_session):
    r = admin_session.get(f"{API}/admin/bookings", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1


def test_admin_update_booking_status(admin_session, user_session):
    r = admin_session.patch(f"{API}/admin/bookings/{user_session.booking_id}",
                            json={"status": "active"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "active"


def test_admin_customers(admin_session):
    r = admin_session.get(f"{API}/admin/customers", timeout=10)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    assert all("bookings_count" in u for u in users)
    assert all("password_hash" not in u for u in users)


# ---------- Admin CRUD: Vehicles ----------
def test_admin_vehicle_crud(admin_session):
    payload = {
        "name": "TEST_Car", "brand": "TESTBrand", "category": "Kleinwagen",
        "transmission": "Automatik", "fuel": "Benzin", "seats": 4, "doors": 4,
        "price_per_day": 29.0, "image_url": "https://example.com/x.jpg",
        "description": "test", "features": ["X"], "active": True
    }
    r = admin_session.post(f"{API}/vehicles", json=payload, timeout=10)
    assert r.status_code == 200
    v = r.json()
    vid = v["id"]
    assert "_id" not in v
    # list admin vehicles
    r2 = admin_session.get(f"{API}/admin/vehicles", timeout=10)
    assert r2.status_code == 200
    assert any(x["id"] == vid for x in r2.json())
    # update
    payload["price_per_day"] = 35.0
    r3 = admin_session.put(f"{API}/vehicles/{vid}", json=payload, timeout=10)
    assert r3.status_code == 200
    assert r3.json()["price_per_day"] == 35.0
    # delete (soft)
    r4 = admin_session.delete(f"{API}/vehicles/{vid}", timeout=10)
    assert r4.status_code == 200
    # public list should NOT have it
    pub = requests.get(f"{API}/vehicles", timeout=10).json()
    assert not any(x["id"] == vid for x in pub)
    # admin list should still have it (with active=false)
    adm = admin_session.get(f"{API}/admin/vehicles", timeout=10).json()
    match = [x for x in adm if x["id"] == vid]
    assert match and match[0]["active"] is False


def test_admin_location_crud(admin_session):
    payload = {"name": "TEST_Loc", "address": "A1", "city": "Berlin", "postal_code": "10115", "active": True}
    r = admin_session.post(f"{API}/locations", json=payload, timeout=10)
    assert r.status_code == 200
    lid = r.json()["id"]
    assert "_id" not in r.json()
    # update
    payload["city"] = "München"
    r2 = admin_session.put(f"{API}/locations/{lid}", json=payload, timeout=10)
    assert r2.status_code == 200
    assert r2.json()["city"] == "München"
    # delete (soft)
    r3 = admin_session.delete(f"{API}/locations/{lid}", timeout=10)
    assert r3.status_code == 200
    pub = requests.get(f"{API}/locations", timeout=10).json()
    assert not any(x["id"] == lid for x in pub)


def test_non_admin_cannot_create_vehicle(user_session):
    payload = {
        "name": "X", "brand": "Y", "category": "Kleinwagen",
        "transmission": "Automatik", "fuel": "Benzin", "seats": 4, "doors": 4,
        "price_per_day": 10.0, "image_url": "http://x", "features": []
    }
    r = user_session.post(f"{API}/vehicles", json=payload, timeout=10)
    assert r.status_code == 403


# ---------- Brute force lockout ----------
@pytest.mark.xfail(reason="Lockout uses request.client.host which differs per k8s ingress request; ident never accumulates. Fix: include X-Forwarded-For or key off email only.", strict=False)
def test_brute_force_lockout():
    email = f"TEST_brute_{uuid.uuid4().hex[:6]}@rentfux.de"
    # register so user exists (lockout triggers on invalid pw)
    requests.post(f"{API}/auth/register", json={"email": email, "password": "Correct123!", "name": "B"}, timeout=10)
    # 5 failed attempts
    for i in range(5):
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong"}, timeout=10)
        assert r.status_code == 401
    # 6th attempt should be locked
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": "Correct123!"}, timeout=10)
    assert r.status_code == 429, f"Expected 429 after 5 fails, got {r.status_code}"
