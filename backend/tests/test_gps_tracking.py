"""GPS-Tracking endpoints regression tests."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@rentfux.de"
ADMIN_PASS = "Admin123!"

ANCHOR_LAT = 53.5396
ANCHOR_LNG = 8.5809


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="module")
def user_session():
    email = f"TEST_gps_{uuid.uuid4().hex[:8]}@rentfux.de"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "TestPass123!", "name": "GPS Test User", "phone": "+491701234567"
    }, timeout=20)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def first_vehicle_id():
    r = requests.get(f"{API}/vehicles", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    return items[0]["id"]


# ---------- Fleet endpoint ----------
def test_fleet_locations_returns_seeded(admin_session):
    r = admin_session.get(f"{API}/admin/fleet/locations", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 8, f"Expected 8+ vehicles with positions, got {len(data)}"
    sample = data[0]
    for key in ("vehicle_id", "name", "brand", "lat", "lng", "speed_kmh", "status", "fence_km"):
        assert key in sample, f"Missing key {key} in fleet item"
    assert "_id" not in sample
    assert sample["status"] in ("parked", "city", "highway")


# ---------- Auth/Authorization ----------
def test_fleet_locations_403_for_non_admin(user_session):
    r = user_session.get(f"{API}/admin/fleet/locations", timeout=20)
    assert r.status_code == 403, f"Expected 403 for non-admin, got {r.status_code}"


def test_post_location_403_for_non_admin(user_session, first_vehicle_id):
    r = user_session.post(
        f"{API}/admin/vehicles/{first_vehicle_id}/location",
        json={"lat": 53.5, "lng": 8.6, "speed_kmh": 10, "heading": 90, "source": "manual"},
        timeout=20,
    )
    assert r.status_code == 403


def test_get_location_403_for_non_admin(user_session, first_vehicle_id):
    r = user_session.get(f"{API}/admin/vehicles/{first_vehicle_id}/location", timeout=20)
    assert r.status_code == 403


def test_get_track_403_for_non_admin(user_session, first_vehicle_id):
    r = user_session.get(f"{API}/admin/vehicles/{first_vehicle_id}/track", timeout=20)
    assert r.status_code == 403


# ---------- POST location & response shape ----------
def test_post_location_parked_inside_fence(admin_session, first_vehicle_id):
    payload = {"lat": ANCHOR_LAT + 0.01, "lng": ANCHOR_LNG + 0.01,
               "speed_kmh": 0.0, "heading": 0.0, "source": "manual"}
    r = admin_session.post(f"{API}/admin/vehicles/{first_vehicle_id}/location",
                           json=payload, timeout=20)
    assert r.status_code == 200, r.text
    doc = r.json()
    for key in ("id", "vehicle_id", "lat", "lng", "speed_kmh", "heading",
                "status", "fence_km", "geofence_alert", "ts", "source"):
        assert key in doc, f"Missing key {key}"
    assert "_id" not in doc
    assert doc["vehicle_id"] == first_vehicle_id
    assert doc["status"] == "parked", f"speed=0 should be parked, got {doc['status']}"
    assert doc["geofence_alert"] is False, f"Inside fence; got fence_km={doc['fence_km']}"
    assert doc["source"] == "manual"


def test_post_location_city_speed(admin_session, first_vehicle_id):
    payload = {"lat": ANCHOR_LAT, "lng": ANCHOR_LNG, "speed_kmh": 15.0,
               "heading": 90.0, "source": "manual"}
    r = admin_session.post(f"{API}/admin/vehicles/{first_vehicle_id}/location",
                           json=payload, timeout=20)
    assert r.status_code == 200
    doc = r.json()
    assert doc["status"] == "city", f"speed=15 should be city, got {doc['status']}"


def test_post_location_highway_speed(admin_session, first_vehicle_id):
    payload = {"lat": ANCHOR_LAT, "lng": ANCHOR_LNG, "speed_kmh": 80.0,
               "heading": 270.0, "source": "manual"}
    r = admin_session.post(f"{API}/admin/vehicles/{first_vehicle_id}/location",
                           json=payload, timeout=20)
    assert r.status_code == 200
    doc = r.json()
    assert doc["status"] == "highway", f"speed=80 should be highway, got {doc['status']}"


def test_post_location_geofence_alert_munich(admin_session, first_vehicle_id):
    # Munich is ~600km from Bremerhaven, well outside 50km
    payload = {"lat": 48.0, "lng": 11.0, "speed_kmh": 100.0,
               "heading": 180.0, "source": "manual"}
    r = admin_session.post(f"{API}/admin/vehicles/{first_vehicle_id}/location",
                           json=payload, timeout=20)
    assert r.status_code == 200
    doc = r.json()
    assert doc["geofence_alert"] is True, f"Munich must trigger alert (fence_km={doc['fence_km']})"
    assert doc["fence_km"] > 50


def test_post_location_geofence_just_outside(admin_session, first_vehicle_id):
    # lat=54.5, lng=10.0 should be > 50km from Bremerhaven
    payload = {"lat": 54.5, "lng": 10.0, "speed_kmh": 50.0,
               "heading": 45.0, "source": "manual"}
    r = admin_session.post(f"{API}/admin/vehicles/{first_vehicle_id}/location",
                           json=payload, timeout=20)
    assert r.status_code == 200
    doc = r.json()
    assert doc["geofence_alert"] is True
    assert doc["fence_km"] > 50


def test_post_location_404_for_unknown_vehicle(admin_session):
    r = admin_session.post(
        f"{API}/admin/vehicles/nonexistent-{uuid.uuid4().hex[:8]}/location",
        json={"lat": 53.0, "lng": 8.0, "speed_kmh": 0.0},
        timeout=20,
    )
    assert r.status_code == 404


# ---------- GET latest location ----------
def test_get_location_reflects_last_post(admin_session, first_vehicle_id):
    # Push known position
    payload = {"lat": 53.6, "lng": 8.7, "speed_kmh": 42.0,
               "heading": 123.0, "source": "manual"}
    r = admin_session.post(f"{API}/admin/vehicles/{first_vehicle_id}/location",
                           json=payload, timeout=20)
    assert r.status_code == 200
    # GET latest
    r2 = admin_session.get(f"{API}/admin/vehicles/{first_vehicle_id}/location", timeout=20)
    assert r2.status_code == 200
    pos = r2.json()
    assert pos is not None
    # Simulator runs every 15s; just verify shape + recent-ish values
    for k in ("lat", "lng", "speed_kmh", "status", "fence_km", "geofence_alert", "ts"):
        assert k in pos, f"Missing key {k} in last_position"


def test_get_location_404_for_unknown(admin_session):
    r = admin_session.get(f"{API}/admin/vehicles/does-not-exist-xyz/location", timeout=20)
    assert r.status_code == 404


# ---------- GET track history ----------
def test_get_track_history_chronological(admin_session, first_vehicle_id):
    # Add a few positions
    for i, sp in enumerate([5.0, 30.0, 70.0]):
        admin_session.post(f"{API}/admin/vehicles/{first_vehicle_id}/location",
                           json={"lat": ANCHOR_LAT + 0.001 * i,
                                 "lng": ANCHOR_LNG + 0.001 * i,
                                 "speed_kmh": sp, "heading": 0.0,
                                 "source": "manual"}, timeout=20)
    r = admin_session.get(f"{API}/admin/vehicles/{first_vehicle_id}/track?limit=10", timeout=20)
    assert r.status_code == 200
    pts = r.json()
    assert isinstance(pts, list)
    assert len(pts) >= 3
    # chronological: ts_epoch ascending
    epochs = [p["ts_epoch"] for p in pts]
    assert epochs == sorted(epochs), "Track should be chronological asc"
    assert "_id" not in pts[0]


def test_get_track_respects_limit(admin_session, first_vehicle_id):
    r = admin_session.get(f"{API}/admin/vehicles/{first_vehicle_id}/track?limit=2", timeout=20)
    assert r.status_code == 200
    pts = r.json()
    assert len(pts) <= 2


# ---------- Regression on critical existing endpoints ----------
def test_regression_login_works():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200
    assert "token" in r.json()


def test_regression_public_vehicles():
    r = requests.get(f"{API}/vehicles", timeout=20)
    assert r.status_code == 200
    assert len(r.json()) >= 8


def test_regression_public_locations():
    r = requests.get(f"{API}/locations", timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_regression_admin_customers(admin_session):
    r = admin_session.get(f"{API}/admin/customers", timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_regression_bookings_guest(first_vehicle_id):
    from datetime import date, timedelta
    import random
    offset = random.randint(500, 1500)
    start = (date.today() + timedelta(days=offset)).isoformat()
    end = (date.today() + timedelta(days=offset + 2)).isoformat()
    payload = {
        "vehicle_id": first_vehicle_id,
        "location_id": "loc-hamburg-hbf",
        "start_date": start, "end_date": end,
        "extras": [],
        "customer": {"email": f"TEST_guest_{uuid.uuid4().hex[:6]}@rentfux.de",
                     "name": "Guest GPS", "phone": "+491701112222",
                     "date_of_birth": "1990-05-15",
                     "address": {"street": "Teststr", "house_number": "1", "postal_code": "28195", "city": "Bremen"},
                     "license_number": "DE123456789"},
        "payment_method": "stripe",
    }
    r = requests.post(f"{API}/bookings/guest", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"guest booking failed: {r.status_code} {r.text}"
