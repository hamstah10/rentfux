"""Backend tests for RentFux new features:
- DELETE /api/vehicles/{vid} soft & hard delete
- DELETE /api/admin/bookings/{bid}
- DELETE /api/admin/customers/{uid} + anonymisation
- POST/GET/DELETE/PATCH /api/admin/vehicles/{vid}/images...
- POST/PUT /api/vehicles accept images[] and features[]
- GET /api/vehicles/{vid} returns location_name
- Non-admin gets 403 on admin endpoints
- Existing endpoints regression
"""
import io
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://drive-book-8.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@rentfux.de"
ADMIN_PASS = "Admin123!"

# ---------- minimal valid 1x1 PNG (~70 bytes) ----------
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x5b\xd4\xfe\xcd"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def user_token():
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@rentfux.de"
    payload = {
        "email": email, "password": "User12345!", "full_name": "Test User",
        "address": "Hauptstr 1", "postal_code": "20095", "city": "Hamburg",
        "phone": "+491700000000", "birth_date": "1990-01-01",
        "license_number": "B1234567", "license_country": "DE",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def user_h(user_token):
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
def created_vehicle(admin_h):
    payload = {
        "name": "TEST_Car_" + uuid.uuid4().hex[:6],
        "brand": "Testo", "category": "Kleinwagen", "price_per_day": 50,
        "image_url": "", "description": "test", "features": [],
        "active": True, "transmission": "manuell", "fuel": "Benzin",
        "seats": 4, "doors": 4, "images": [],
    }
    r = requests.post(f"{API}/vehicles", json=payload, headers=admin_h, timeout=20)
    assert r.status_code == 200, r.text
    vid = r.json()["id"]
    yield r.json()
    # cleanup: hard delete
    requests.delete(f"{API}/vehicles/{vid}?hard=true", headers=admin_h, timeout=20)


# ===================== Vehicle CRUD + images list + features =====================

class TestVehicleImagesAndFeaturesField:
    def test_create_with_images_and_features(self, admin_h):
        payload = {
            "name": "TEST_ImgCar_" + uuid.uuid4().hex[:6],
            "brand": "T", "category": "Kleinwagen", "price_per_day": 80,
            "image_url": "", "description": "x",
            "features": ["Klimaautomatik", "Apple CarPlay", "Custom Feature"],
            "images": ["https://example.com/a.jpg", "https://example.com/b.jpg"],
            "active": True, "transmission": "manuell", "fuel": "Benzin",
            "seats": 5, "doors": 5,
        }
        r = requests.post(f"{API}/vehicles", json=payload, headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        v = r.json()
        assert len(v["images"]) == 2
        assert len(v["features"]) == 3
        # image_url should default to first image
        assert v["image_url"] == "https://example.com/a.jpg"
        # cleanup
        requests.delete(f"{API}/vehicles/{v['id']}?hard=true", headers=admin_h, timeout=20)

    def test_image_url_inserted_into_images_if_missing(self, admin_h):
        payload = {
            "name": "TEST_PrimCar_" + uuid.uuid4().hex[:6],
            "brand": "T", "category": "Kleinwagen", "price_per_day": 60,
            "image_url": "https://example.com/primary.jpg",
            "description": "x", "features": [], "active": True,
            "transmission": "manuell", "fuel": "Benzin", "seats": 5, "doors": 5,
            "images": ["https://example.com/other.jpg"],
        }
        r = requests.post(f"{API}/vehicles", json=payload, headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        v = r.json()
        assert "https://example.com/primary.jpg" in v["images"]
        assert v["images"][0] == "https://example.com/primary.jpg"
        requests.delete(f"{API}/vehicles/{v['id']}?hard=true", headers=admin_h, timeout=20)

    def test_update_persists_features_and_images(self, admin_h, created_vehicle):
        vid = created_vehicle["id"]
        payload = dict(created_vehicle)
        payload["features"] = ["Sitzheizung vorne", "Allradantrieb (4x4)"]
        payload["images"] = ["https://example.com/x1.jpg"]
        payload["image_url"] = ""
        # remove non-input fields
        for k in ["id", "created_at", "_id"]:
            payload.pop(k, None)
        r = requests.put(f"{API}/vehicles/{vid}", json=payload, headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        # GET to verify persistence
        g = requests.get(f"{API}/vehicles/{vid}", timeout=20).json()
        assert g["features"] == ["Sitzheizung vorne", "Allradantrieb (4x4)"]
        assert g["images"] == ["https://example.com/x1.jpg"]
        assert g["image_url"] == "https://example.com/x1.jpg"


# ===================== get_vehicle resolves location_name =====================

class TestGetVehicleLocationName:
    def test_returns_location_name(self, admin_h):
        loc = requests.get(f"{API}/locations", timeout=20).json()
        assert len(loc) >= 1
        loc_id = loc[0]["id"]
        # create vehicle bound to location
        payload = {
            "name": "TEST_LocCar_" + uuid.uuid4().hex[:6], "brand": "T",
            "category": "Kleinwagen", "price_per_day": 50,
            "image_url": "", "description": "x", "features": [], "active": True,
            "transmission": "manuell", "fuel": "Benzin", "seats": 4, "doors": 4,
            "images": [], "location_id": loc_id,
        }
        r = requests.post(f"{API}/vehicles", json=payload, headers=admin_h, timeout=20).json()
        vid = r["id"]
        g = requests.get(f"{API}/vehicles/{vid}", timeout=20).json()
        assert g.get("location_name") == loc[0]["name"]
        requests.delete(f"{API}/vehicles/{vid}?hard=true", headers=admin_h, timeout=20)


# ===================== Image upload/serve/delete/reorder =====================

class TestVehicleImageEndpoints:
    def test_upload_invalid_ext_400(self, admin_h, created_vehicle):
        files = {"file": ("test.gif", io.BytesIO(b"GIF89a"), "image/gif")}
        r = requests.post(
            f"{API}/admin/vehicles/{created_vehicle['id']}/images",
            files=files, headers=admin_h, timeout=30,
        )
        assert r.status_code == 400

    def test_upload_too_large_413(self, admin_h, created_vehicle):
        big = b"\x00" * (5 * 1024 * 1024 + 100)
        files = {"file": ("big.png", io.BytesIO(big), "image/png")}
        r = requests.post(
            f"{API}/admin/vehicles/{created_vehicle['id']}/images",
            files=files, headers=admin_h, timeout=60,
        )
        assert r.status_code == 413

    def test_upload_success_and_serve_and_delete(self, admin_h, created_vehicle):
        vid = created_vehicle["id"]
        files = {"file": ("test.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(
            f"{API}/admin/vehicles/{vid}/images",
            files=files, headers=admin_h, timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body and body["url"].startswith(f"/api/vehicles/{vid}/images/")
        assert body["size"] == len(PNG_BYTES)
        assert body["url"] in body["images"]

        # Public serve (no auth)
        url = BASE + body["url"]
        g = requests.get(url, timeout=20)
        assert g.status_code == 200
        assert g.headers.get("Cache-Control", "").startswith("public")
        assert g.content == PNG_BYTES

        # Path traversal & invalid file rejected
        bad = requests.get(f"{API}/vehicles/{vid}/images/..png", timeout=20)
        assert bad.status_code == 400
        nf = requests.get(f"{API}/vehicles/{vid}/images/{uuid.uuid4().hex}.png", timeout=20)
        assert nf.status_code == 404

        # image_url auto-set since vehicle had none
        v = requests.get(f"{API}/vehicles/{vid}", timeout=20).json()
        assert v["image_url"] == body["url"]

        # Delete image
        d = requests.delete(
            f"{API}/admin/vehicles/{vid}/images",
            params={"url": body["url"]}, headers=admin_h, timeout=20,
        )
        assert d.status_code == 200
        assert body["url"] not in d.json()["images"]
        # image_url reset to "" since it was the only one
        v2 = requests.get(f"{API}/vehicles/{vid}", timeout=20).json()
        assert v2["image_url"] == ""

    def test_reorder(self, admin_h, created_vehicle):
        vid = created_vehicle["id"]
        # upload 2 images
        urls = []
        for _ in range(2):
            files = {"file": ("t.png", io.BytesIO(PNG_BYTES), "image/png")}
            r = requests.post(
                f"{API}/admin/vehicles/{vid}/images",
                files=files, headers=admin_h, timeout=30,
            )
            assert r.status_code == 200
            urls.append(r.json()["url"])
        # reverse order
        new_order = list(reversed(urls)) + ["https://invalid.example/should-be-filtered.jpg"]
        rr = requests.patch(
            f"{API}/admin/vehicles/{vid}/images/reorder",
            json={"images": new_order}, headers=admin_h, timeout=20,
        )
        assert rr.status_code == 200, rr.text
        body = rr.json()
        assert body["images"] == list(reversed(urls))
        assert body["image_url"] == list(reversed(urls))[0]


# ===================== Delete vehicle (soft + hard) =====================

class TestDeleteVehicle:
    def test_soft_then_hard_delete(self, admin_h):
        r = requests.post(f"{API}/vehicles", json={
            "name": "TEST_Del_" + uuid.uuid4().hex[:6], "brand": "T",
            "category": "Kleinwagen", "price_per_day": 50, "image_url": "",
            "description": "x", "features": [], "active": True,
            "transmission": "manuell", "fuel": "Benzin", "seats": 4, "doors": 4,
            "images": [],
        }, headers=admin_h, timeout=20).json()
        vid = r["id"]

        s = requests.delete(f"{API}/vehicles/{vid}", headers=admin_h, timeout=20)
        assert s.status_code == 200 and s.json().get("deactivated") is True
        g = requests.get(f"{API}/vehicles/{vid}", timeout=20).json()
        assert g["active"] is False

        h = requests.delete(f"{API}/vehicles/{vid}?hard=true", headers=admin_h, timeout=20)
        assert h.status_code == 200 and h.json().get("deleted") is True
        assert requests.get(f"{API}/vehicles/{vid}", timeout=20).status_code == 404

    def test_hard_delete_blocked_with_active_booking(self, admin_h, user_h):
        # create vehicle
        v = requests.post(f"{API}/vehicles", json={
            "name": "TEST_HBlock_" + uuid.uuid4().hex[:6], "brand": "T",
            "category": "Kleinwagen", "price_per_day": 50, "image_url": "",
            "description": "x", "features": [], "active": True,
            "transmission": "manuell", "fuel": "Benzin", "seats": 4, "doors": 4,
            "images": [],
        }, headers=admin_h, timeout=20).json()
        vid = v["id"]
        loc = requests.get(f"{API}/locations", timeout=20).json()[0]["id"]
        # create booking
        b = requests.post(f"{API}/bookings", json={
            "vehicle_id": vid, "location_id": loc,
            "start_date": "2030-01-01", "end_date": "2030-01-03",
            "extras": {}, "discount_code": "",
        }, headers=user_h, timeout=20)
        assert b.status_code == 200, b.text
        bid = b.json()["id"]

        h = requests.delete(f"{API}/vehicles/{vid}?hard=true", headers=admin_h, timeout=20)
        assert h.status_code == 409
        # cleanup: cancel booking and hard delete vehicle
        requests.patch(f"{API}/admin/bookings/{bid}", json={"status": "cancelled"}, headers=admin_h, timeout=20)
        requests.delete(f"{API}/admin/bookings/{bid}", headers=admin_h, timeout=20)
        requests.delete(f"{API}/vehicles/{vid}?hard=true", headers=admin_h, timeout=20)


# ===================== Delete booking =====================

class TestDeleteBooking:
    def test_delete_unpaid_booking_ok(self, admin_h, user_h, created_vehicle):
        loc = requests.get(f"{API}/locations", timeout=20).json()[0]["id"]
        b = requests.post(f"{API}/bookings", json={
            "vehicle_id": created_vehicle["id"], "location_id": loc,
            "start_date": "2030-02-01", "end_date": "2030-02-03",
            "extras": {}, "discount_code": "",
        }, headers=user_h, timeout=20)
        assert b.status_code == 200
        bid = b.json()["id"]
        d = requests.delete(f"{API}/admin/bookings/{bid}", headers=admin_h, timeout=20)
        assert d.status_code == 200

    def test_delete_paid_active_blocked(self, admin_h, user_h, created_vehicle):
        loc = requests.get(f"{API}/locations", timeout=20).json()[0]["id"]
        b = requests.post(f"{API}/bookings", json={
            "vehicle_id": created_vehicle["id"], "location_id": loc,
            "start_date": "2030-03-01", "end_date": "2030-03-03",
            "extras": {}, "discount_code": "",
        }, headers=user_h, timeout=20).json()
        bid = b["id"]
        # pay
        p = requests.post(f"{API}/payments/mock-pay", json={"booking_id": bid}, headers=user_h, timeout=20)
        assert p.status_code == 200, p.text
        d = requests.delete(f"{API}/admin/bookings/{bid}", headers=admin_h, timeout=20)
        assert d.status_code == 409
        # cleanup
        requests.patch(f"{API}/admin/bookings/{bid}", json={"status": "cancelled"}, headers=admin_h, timeout=20)
        requests.delete(f"{API}/admin/bookings/{bid}", headers=admin_h, timeout=20)


# ===================== Delete customer =====================

class TestDeleteCustomer:
    def test_delete_admin_forbidden(self, admin_h):
        me = requests.get(f"{API}/auth/me", headers=admin_h, timeout=20).json()
        d = requests.delete(f"{API}/admin/customers/{me['user']['id']}", headers=admin_h, timeout=20)
        assert d.status_code == 403

    def test_delete_with_active_booking_409_then_force(self, admin_h, created_vehicle):
        # Create a temp user
        email = f"TEST_del_{uuid.uuid4().hex[:6]}@rentfux.de"
        reg = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "User12345!", "full_name": "Tmp",
            "address": "Hauptstr 1", "postal_code": "20095", "city": "Hamburg",
            "phone": "+491700000001", "birth_date": "1990-01-01",
            "license_number": "B9999998", "license_country": "DE",
        }, timeout=20).json()
        uid = reg["user"]["id"]
        utok = reg["token"]
        loc = requests.get(f"{API}/locations", timeout=20).json()[0]["id"]
        b = requests.post(f"{API}/bookings", json={
            "vehicle_id": created_vehicle["id"], "location_id": loc,
            "start_date": "2031-01-01", "end_date": "2031-01-03",
            "extras": {}, "discount_code": "",
        }, headers={"Authorization": f"Bearer {utok}"}, timeout=20)
        assert b.status_code == 200, b.text
        bid = b.json()["id"]

        # 409 without force
        d = requests.delete(f"{API}/admin/customers/{uid}", headers=admin_h, timeout=20)
        assert d.status_code == 409, d.text
        # force = delete + anonymise
        d2 = requests.delete(f"{API}/admin/customers/{uid}?force=true", headers=admin_h, timeout=20)
        assert d2.status_code == 200

        # Check booking anonymised
        bk = requests.get(f"{API}/admin/bookings/{bid}", headers=admin_h, timeout=20)
        if bk.status_code == 200:
            booking = bk.json()
            assert booking.get("user_id") is None
            assert booking.get("user_deleted") is True
        # cleanup
        requests.delete(f"{API}/admin/bookings/{bid}", headers=admin_h, timeout=20)


# ===================== Non-admin 403 =====================

class TestAdminAuthGuards:
    def test_non_admin_blocked(self, user_h, created_vehicle):
        vid = created_vehicle["id"]
        endpoints = [
            ("DELETE", f"{API}/vehicles/{vid}"),
            ("POST", f"{API}/admin/vehicles/{vid}/images"),
            ("DELETE", f"{API}/admin/vehicles/{vid}/images?url=foo"),
            ("PATCH", f"{API}/admin/vehicles/{vid}/images/reorder"),
            ("DELETE", f"{API}/admin/bookings/some-id"),
            ("DELETE", f"{API}/admin/customers/some-id"),
        ]
        for method, url in endpoints:
            r = requests.request(method, url, headers=user_h, json={}, timeout=20)
            assert r.status_code == 403, f"{method} {url} returned {r.status_code}"

    def test_public_image_serve_no_auth(self, created_vehicle):
        # 400 path traversal even without auth (we just need to confirm it's reachable without auth)
        r = requests.get(f"{API}/vehicles/{created_vehicle['id']}/images/..png", timeout=20)
        assert r.status_code == 400


# ===================== Regression =====================

class TestRegression:
    def test_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
        assert r.status_code == 200

    def test_public_vehicles(self):
        r = requests.get(f"{API}/vehicles", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_guest_booking(self):
        loc = requests.get(f"{API}/locations", timeout=20).json()[0]["id"]
        vehicles = requests.get(f"{API}/vehicles", timeout=20).json()
        assert vehicles
        vid = vehicles[0]["id"]
        payload = {
            "vehicle_id": vid, "location_id": loc,
            "start_date": "2032-01-01", "end_date": "2032-01-03",
            "extras": {}, "discount_code": "",
            "guest": {
                "email": f"TEST_guest_{uuid.uuid4().hex[:6]}@rentfux.de",
                "full_name": "Guest", "phone": "+491700000003",
                "address": "Hauptstr 1", "postal_code": "20095", "city": "Hamburg",
                "birth_date": "1990-01-01", "license_number": "B0001234",
                "license_country": "DE",
            },
        }
        r = requests.post(f"{API}/bookings/guest", json=payload, timeout=20)
        assert r.status_code == 200, r.text

    def test_admin_customers(self, admin_h):
        r = requests.get(f"{API}/admin/customers", headers=admin_h, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
