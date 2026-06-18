# RentFux

> Komplette Autovermietungs-Plattform für Privat- und Geschäftskunden – mit Online-Buchung, Bezahlung, GPS-Tracking und Admin-Verwaltung.

![Stack](https://img.shields.io/badge/Stack-FastAPI%20%2B%20React%20%2B%20MongoDB-E11226?style=flat-square)
![Lang](https://img.shields.io/badge/UI-Deutsch-262626?style=flat-square)
![Design](https://img.shields.io/badge/Design-Chiptuningfile-0A0A0A?style=flat-square)

---

## Inhalt

1. [Überblick](#überblick)
2. [Tech-Stack](#tech-stack)
3. [Verzeichnisstruktur](#verzeichnisstruktur)
4. [Lokal starten](#lokal-starten)
5. [Environment-Variablen](#environment-variablen)
6. [API-Referenz](#api-referenz)
7. [Datenmodell (MongoDB)](#datenmodell-mongodb)
8. [Migration nach MySQL](#migration-nach-mysql)
9. [Design-System](#design-system)
10. [Test-Zugang](#test-zugang)
11. [Bekannte Limitierungen / Mocks](#bekannte-limitierungen--mocks)
12. [Roadmap](#roadmap)

---

## Überblick

**Funktionen für Kunden**
- Fahrzeug-Katalog mit Filtern (Kategorie, Getriebe, Kraftstoff, Sitze, Preis)
- 4-Schritt-Buchungsflow: Datum → Daten → Zahlung → Bestätigung
- Gäste-Buchung **ohne Registrierung** möglich
- Profil-Wizard mit Adressdaten, Führerschein-/Ausweis-Upload (Object Storage)
- B2B-Modus mit Firmendaten und USt-IdNr.
- Rabattcodes (Prozent oder Fix-Betrag)
- PDF-Rechnung als Download

**Funktionen für Admin**
- Dashboard mit KPIs und Charts
- CRUD: Fahrzeuge, Buchungen, Kunden, Standorte, Rabattcodes
- Multi-Bild-Upload pro Fahrzeug (Object Storage) + Reorder + Cover-Setzen
- Ausstattungs-Katalog mit ~70 vordefinierten Features in 6 Gruppen + Custom
- **GPS-Live-Karte** (Leaflet/OpenStreetMap) der gesamten Flotte
- Track-History, Status (parkend / Stadt / Schnellstraße), Geofence-Alerts
- Hard-Delete mit Sicherheitschecks (offene Buchungen blockieren, historische Daten werden anonymisiert)

---

## Tech-Stack

| Layer       | Technologien                                                       |
| ----------- | ------------------------------------------------------------------ |
| Frontend    | React 19, Tailwind, Shadcn/UI, Lucide, React-Leaflet, Recharts     |
| Backend     | FastAPI, Motor (Async MongoDB), PyJWT, Pydantic v2, Reportlab      |
| DB          | MongoDB 6+                                                         |
| Storage     | Emergent Object Storage (für Dokumente und Fahrzeug-Bilder)        |
| Auth        | JWT (httpOnly Cookies + Bearer) mit Brute-force Lockout            |
| Karten      | Leaflet + OpenStreetMap (kein API-Key notwendig)                   |

---

## Verzeichnisstruktur

```
/app
├── backend/
│   ├── server.py          # FastAPI Monolith (Auth, Vehicles, Bookings, Tracking, PDF, ...)
│   ├── requirements.txt
│   └── tests/             # pytest-Suite
│
├── frontend/
│   └── src/
│       ├── App.js                       # Router + Layout
│       ├── index.css                    # Chiptuningfile Design-Tokens
│       ├── lib/
│       │   ├── api.js                   # Axios-Instanz
│       │   └── featureCatalog.js        # 70+ Ausstattungs-Items
│       ├── components/                  # Navbar, Footer, VehicleCard, ...
│       └── pages/
│           ├── Home.jsx
│           ├── Catalog.jsx
│           ├── VehicleDetail.jsx        # Galerie, Specs, Ausstattung, Buchung
│           ├── BookingFlow.jsx
│           ├── Account.jsx              # Tabs: Buchungen / Profil / Adresse / Geschäftskunde / Dokumente
│           ├── ProfileSetup.jsx
│           └── admin/
│               ├── AdminDashboard.jsx
│               ├── AdminVehicles.jsx
│               ├── AdminTracking.jsx    # GPS-Live-Karte
│               ├── AdminBookings.jsx
│               ├── AdminCustomers.jsx
│               ├── AdminLocations.jsx
│               └── AdminDiscounts.jsx
│
├── export/                # MongoDB → MySQL Migration
│   ├── *.json             # Roh-Exports
│   ├── schema_mysql.sql   # Ziel-Schema
│   ├── migrate_to_mysql.py
│   └── data.sql           # Generierte INSERT Statements
│
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

---

## Lokal starten

> Voraussetzungen: Python 3.11, Node 20, MongoDB 6+.

```bash
# Backend
cd backend
pip install -r requirements.txt
# .env mit MONGO_URL + DB_NAME anlegen (siehe nächster Abschnitt)
uvicorn server:app --reload --port 8001

# Frontend (in neuem Terminal)
cd frontend
yarn install
yarn start    # http://localhost:3000
```

Beim Start seedet das Backend automatisch:
- Admin-User `admin@rentfux.de` / `Admin123!`
- 1 Standort (Bremerhaven) und 8 Demo-Fahrzeuge
- Startpositionen + 15-Sekunden GPS-Simulator

---

## Environment-Variablen

### `backend/.env`

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=rentfux_database
JWT_SECRET=ein-langes-zufaelliges-secret
ADMIN_EMAIL=admin@rentfux.de
ADMIN_PASSWORD=Admin123!
EMERGENT_LLM_KEY=...        # Object Storage Key
CORS_ORIGINS=https://deine-domain.de
```

### `frontend/.env`

```env
REACT_APP_BACKEND_URL=https://api.deine-domain.de
```

> Wichtig: Alle Backend-Endpoints sind unter `/api/...` erreichbar.
> Frontend ruft sie als `${REACT_APP_BACKEND_URL}/api/...` auf.

---

## API-Referenz

### Auth

| Methode | Pfad                      | Beschreibung                                |
| ------- | ------------------------- | ------------------------------------------- |
| POST    | `/api/auth/register`      | Neuer User                                  |
| POST    | `/api/auth/login`         | Liefert `{user, token}` + setzt Cookies     |
| POST    | `/api/auth/logout`        | Cookies löschen                             |
| GET     | `/api/auth/me`            | Eingeloggten User abrufen                   |

### User-Profil

| Methode | Pfad                                            | Beschreibung                            |
| ------- | ----------------------------------------------- | --------------------------------------- |
| PUT     | `/api/users/me`                                 | Profil aktualisieren                    |
| POST    | `/api/uploads/documents/{doc_type}`             | `license` oder `id_card` hochladen      |
| GET     | `/api/uploads/documents/{doc_type}`             | Eigenes Dokument abrufen                |
| DELETE  | `/api/uploads/documents/{doc_type}`             | Eigenes Dokument löschen                |

### Fahrzeuge

| Methode | Pfad                                                          | Beschreibung                                |
| ------- | ------------------------------------------------------------- | ------------------------------------------- |
| GET     | `/api/vehicles?category=...&fuel=...`                         | Katalog mit Filtern                         |
| GET     | `/api/vehicles/{vid}`                                         | Detail (inkl. `location_name`)              |
| POST    | `/api/vehicles`                                               | **Admin**: neues Fahrzeug                   |
| PUT     | `/api/vehicles/{vid}`                                         | **Admin**: Fahrzeug aktualisieren           |
| DELETE  | `/api/vehicles/{vid}?hard=true`                               | **Admin**: hart oder soft löschen           |
| POST    | `/api/admin/vehicles/{vid}/images`                            | **Admin**: Bild hochladen (multipart)       |
| DELETE  | `/api/admin/vehicles/{vid}/images?url=...`                    | **Admin**: Bild entfernen                   |
| PATCH   | `/api/admin/vehicles/{vid}/images/reorder`                    | **Admin**: Reihenfolge ändern               |
| GET     | `/api/vehicles/{vid}/images/{filename}`                       | **Public**: Bild aus Object Storage liefern |

### Buchungen

| Methode | Pfad                                  | Beschreibung                                      |
| ------- | ------------------------------------- | ------------------------------------------------- |
| POST    | `/api/bookings`                       | Neue Buchung (eingeloggter User)                  |
| POST    | `/api/bookings/guest`                 | Buchung **ohne Registrierung**                    |
| GET     | `/api/bookings/me`                    | Eigene Buchungen                                  |
| GET     | `/api/bookings/{bid}/invoice`         | PDF-Rechnung                                      |
| POST    | `/api/payments/mock-pay`              | Mock-Zahlung (immer success)                      |
| POST    | `/api/admin/bookings/{bid}/cancel`    | **Admin**: stornieren                             |
| PATCH   | `/api/admin/bookings/{bid}`           | **Admin**: Status setzen                          |
| DELETE  | `/api/admin/bookings/{bid}`           | **Admin**: hart löschen                           |
| GET     | `/api/admin/bookings`                 | **Admin**: alle Buchungen                         |

### Standorte

| Methode | Pfad                                  | Beschreibung                              |
| ------- | ------------------------------------- | ----------------------------------------- |
| GET     | `/api/locations`                      | Aktive Standorte (public)                 |
| POST    | `/api/locations`                      | **Admin**                                 |
| PUT     | `/api/locations/{loc_id}`             | **Admin**                                 |
| DELETE  | `/api/locations/{loc_id}?hard=true`   | **Admin**                                 |

### Rabattcodes

| Methode | Pfad                                | Beschreibung                              |
| ------- | ----------------------------------- | ----------------------------------------- |
| POST    | `/api/discounts/validate`           | Code prüfen (public)                      |
| GET     | `/api/admin/discounts`              | **Admin**                                 |
| POST    | `/api/admin/discounts`              | **Admin**                                 |
| PUT     | `/api/admin/discounts/{code}`       | **Admin**                                 |
| DELETE  | `/api/admin/discounts/{code}`       | **Admin**                                 |

### Kunden (Admin)

| Methode | Pfad                                              | Beschreibung                              |
| ------- | ------------------------------------------------- | ----------------------------------------- |
| GET     | `/api/admin/customers`                            | Alle Kunden                               |
| GET     | `/api/admin/customers/{uid}`                      | Detail                                    |
| PATCH   | `/api/admin/customers/{uid}`                      | Bearbeiten                                |
| DELETE  | `/api/admin/customers/{uid}?force=true`           | Löschen (force = trotz aktiver Buchungen) |
| GET     | `/api/admin/customers/{uid}/documents/{doc_type}` | Dokument abrufen                          |

### GPS-Tracking (Admin)

| Methode | Pfad                                                    | Beschreibung                              |
| ------- | ------------------------------------------------------- | ----------------------------------------- |
| GET     | `/api/admin/fleet/locations`                            | Aktuelle Position aller Fahrzeuge         |
| GET     | `/api/admin/vehicles/{vid}/location`                    | Letzte Position eines Fahrzeugs           |
| GET     | `/api/admin/vehicles/{vid}/track?limit=50`              | Track-History                             |
| POST    | `/api/admin/vehicles/{vid}/location`                    | Position pushen (mock oder echter Tracker)|

---

## Datenmodell (MongoDB)

### `users`

```yaml
id:                "uuid4"
email:             "lower@case.de"           # unique
password_hash:     "$2b$12$..."              # bcrypt
role:              "user" | "admin"
name:              "Max Muster"
phone:             "+49 ..."
profile:
  address:         "Straße 1"
  postal_code:     "27568"
  city:            "Bremerhaven"
  country:         "Deutschland"
  date_of_birth:   "1990-01-15"
  license_number:  "B123456"
  license_country: "Deutschland"
  license_issued_at:  "2010-05-20"
  license_expires_at: "2030-05-20"
  documents:
    license:       { path, filename, content_type, size, uploaded_at }
    id_card:       { path, filename, content_type, size, uploaded_at }
is_business:       false
company:
  name:             "ACME GmbH"
  vat_id:           "DE123456789"
  contact_name:     "..."
  contact_email:    "..."
profile_complete:  true
created_at:        "ISO-8601"
updated_at:        "ISO-8601"
```

### `vehicles`

```yaml
id:               "uuid4"
brand:            "Volkswagen"
name:             "Polo"
category:         "Kleinwagen" | "Kompakt" | "Mittelklasse" | "SUV" | "Van" | "Luxus" | "Transporter"
transmission:     "Automatik" | "Schaltgetriebe"
fuel:             "Benzin" | "Diesel" | "Elektro" | "Hybrid"
seats:            5
doors:            4
price_per_day:    39.0
image_url:        "..."                # Cover (= images[0])
images:           [ "url1", "url2", ... ]
description:      "..."
features:         [ "Klimaautomatik", "Sitzheizung vorne", ... ]
active:           true
location_id:      "loc-uuid"
last_position:                          # Cache der letzten GPS-Position
  lat:            53.5396
  lng:            8.5809
  speed_kmh:      48.0
  heading:        180
  status:         "parked" | "city" | "highway"
  ts:             "ISO-8601"
created_at:       "ISO-8601"
```

### `bookings`

```yaml
id:                "uuid4"
user_id:           "uuid"               # null bei Guest oder gelöschtem User
vehicle_id:        "uuid"               # null bei gelöschtem Fahrzeug
is_guest:          false
customer:                              # Snapshot zum Buchungszeitpunkt
  name, email, phone, date_of_birth, license_number, address: {...}
vehicle_brand:     "VW"                 # Snapshot für historische Reports
vehicle_name:      "Polo"
pickup_location_id: "loc-uuid"
return_location_id: "loc-uuid"
start_date:        "2026-06-20"
end_date:          "2026-06-23"
days:              3
extras:            [ "Kindersitz", "Vollkasko" ]
base_subtotal:     117.00
extras_total:      30.00
discount_code:     "SUMMER10" | null
discount_amount:   14.70
total:             132.30
status:            "pending" | "confirmed" | "active" | "completed" | "cancelled"
payment_method:    "stripe" | "paypal" | "manual"
payment_status:    "pending" | "paid" | "refunded" | "failed"
vehicle_deleted:   false                # true nach Hard-Delete des Fahrzeugs
user_deleted:      false                # true nach Hard-Delete des Users
cancelled_at:      "ISO-8601" | null
created_at:        "ISO-8601"
updated_at:        "ISO-8601"
```

### `locations`

```yaml
id:           "uuid"
name:         "RentFux Bremerhaven"
address:      "Deichstr. 48"
city:         "Bremerhaven"
postal_code:  "27568"
phone:        "+49 471 ..."
email:        "info@rentfux.de"
active:       true
created_at:   "ISO-8601"
```

### `discount_codes`

```yaml
code:         "SUMMER10"                # primary key
description:  "10% Sommer-Aktion"
type:         "percent" | "fixed"
value:        10.0
min_total:    50.0
max_uses:     100
used_count:   23
valid_from:   "ISO-8601"
valid_until:  "ISO-8601"
active:       true
created_at:   "ISO-8601"
```

### `vehicle_positions`

```yaml
id:             "uuid"
vehicle_id:     "uuid"
lat:            53.5396
lng:            8.5809
speed_kmh:      48.0
heading:        180
status:         "parked" | "city" | "highway"
source:         "mock" | "manual" | "tracker"
fence_km:       2.3
geofence_alert: false
ts:             "ISO-8601"
ts_epoch:       1718745123
```

### `login_attempts`

```yaml
identifier:    "ip:email"
attempted_at:  "ISO-8601"
success:       false
ip:            "10.x.x.x"
user_agent:    "Mozilla/..."
```

---

## Migration nach MySQL

Im Verzeichnis [`/app/export`](./export) liegt alles, was du für die Migration brauchst.

### Inhalt

| Datei                     | Zweck                                                          |
| ------------------------- | -------------------------------------------------------------- |
| `users.json`              | Roh-Export aller User                                          |
| `vehicles.json`           | Roh-Export aller Fahrzeuge                                     |
| `bookings.json`           | Roh-Export aller Buchungen                                     |
| `locations.json`          | Roh-Export aller Standorte                                     |
| `discount_codes.json`     | Roh-Export aller Rabattcodes                                   |
| `vehicle_positions.json`  | Letzte 100 GPS-Positionen                                      |
| `login_attempts.json`     | Roh-Export der Login-Versuche                                  |
| `schema_mysql.sql`        | Vollständiges MySQL-Schema (CREATE TABLE …)                    |
| `migrate_to_mysql.py`     | Konvertiert JSON → `data.sql`                                  |
| `data.sql`                | Generierte INSERT Statements (~45 KB)                          |

### Schema-Highlights gegenüber MongoDB

| Mongo (eingebettet)              | MySQL (normalisiert)                          |
| -------------------------------- | --------------------------------------------- |
| `users.profile.documents.{type}` | Tabelle `user_documents` (1:N)                |
| `vehicles.images: List[str]`     | Tabelle `vehicle_images` mit `sort_order`     |
| `vehicles.features: List[str]`   | Tabelle `vehicle_features`                    |
| `bookings.extras: List[str]`     | Tabelle `booking_extras` mit Preis            |
| `vehicles.last_position`         | flat in `vehicles.last_lat / last_lng / ...`  |

### Migration ausführen (auf deinem Zielsystem)

```bash
# 1. Schema anlegen
mysql -u root -p rentfux < schema_mysql.sql

# 2. Daten konvertieren (erzeugt data.sql)
python3 migrate_to_mysql.py

# 3. Daten einspielen
mysql -u root -p rentfux < data.sql

# 4. Sanity Check
mysql -u root -p rentfux -e "
  SELECT (SELECT COUNT(*) FROM users)     AS users,
         (SELECT COUNT(*) FROM vehicles)  AS vehicles,
         (SELECT COUNT(*) FROM bookings)  AS bookings,
         (SELECT COUNT(*) FROM locations) AS locations;
"
```

### Anpassungen am Backend

Wenn du das FastAPI-Backend ebenfalls auf MySQL umstellen willst:

1. `motor` durch `aiomysql` (oder **SQLAlchemy 2.0 + asyncmy**) ersetzen.
2. `db.users.find_one({"id": uid})` → `SELECT * FROM users WHERE id=%s`.
3. Embedded-Felder über JOIN aufbauen (z.B. `vehicles` LEFT JOIN `vehicle_images` mit `GROUP_CONCAT(url ORDER BY sort_order)`).
4. `last_position`-Cache bleibt im Backend; oder MySQL VIEW darüber legen.
5. Alle Indizes sind bereits im Schema definiert (E-Mail unique, status, dates, …).

---

## Design-System

**Chiptuningfile Design System**

- **Farben:** Schwarz (`#0A0A0A`), Weiß, Ignition-Rot (`#E11226`), Neutral-Greys
- **Schrift:**
  - Display: *Orbitron* (Hero-Headlines)
  - Body: *Archivo*
  - Monospace/Readouts: *IBM Plex Mono* (Mess-/Datenanzeigen)
- **Form:** scharfe Ecken (`rounded-sm`), keine Schatten, mechanische Linien
- **Akzente:** Uppercase-Mono-Labels mit Letter-Spacing (`// LIVE`, `// PREMIUM MIETFLOTTE`)
- **Bewegung:** Subtile Hover-Scales, blinkende Live-Indikatoren

Komponenten in `frontend/src/components/ui/` (Shadcn). Custom Tokens in `frontend/src/index.css`.

---

## Test-Zugang

| Rolle | Zugangsdaten                            |
| ----- | --------------------------------------- |
| Admin | `admin@rentfux.de` / `Admin123!`        |
| User  | über Public-Registrierung anlegen       |

Vollständige Credentials in [`/app/memory/test_credentials.md`](./memory/test_credentials.md).

---

## Bekannte Limitierungen / Mocks

| Bereich            | Status     | Hinweis                                                          |
| ------------------ | ---------- | ---------------------------------------------------------------- |
| **Zahlung**        | Mock       | `/api/payments/mock-pay` immer `success`. Stripe-Anbindung offen |
| **E-Mail**         | Mock       | Keine Versandintegration (SendGrid empfohlen)                    |
| **WhatsApp/SMS**   | Mock       | Twilio-Anbindung offen                                           |
| **GPS-Daten**      | Simulator  | 15-s-Random-Walk um Bremerhaven. Echter Endpoint funktional      |
| **Brute-Force**    | Eingeschränkt | Hinter K8s-Ingress sind alle Requests gleiche IP              |

---

## Roadmap

### P1 (priorisiert)
- Stripe-Zahlung integrieren (statt Mock)
- SendGrid für Buchungsbestätigung/Rechnung als Mail
- Twilio WhatsApp/SMS für Statusbenachrichtigungen

### P2 (mittelfristig)
- Multi-Location-Suche im Katalog-UI (DB unterstützt es bereits)
- Bewertungs-/Review-System pro Fahrzeug
- DE/EN-Mehrsprachigkeit (i18next)
- Refactoring: `server.py` (~1880 Zeilen) in modulare Router

### P3 (Vision)
- Echte GPS-Tracker-Anbindung (Teltonika, Queclink)
- Digitale Mietvertrags-Signatur (Canvas)
- Schnellbuchungs-Widget mit Live-Verfügbarkeitscheck
- Wartungs-/Schadenshistorie pro Fahrzeug

---

## Lizenz

Proprietär. © RentFux. Alle Rechte vorbehalten.
