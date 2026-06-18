# RentFux — Product Requirements Document

## Original Problem Statement
Eine vollständige Web-Plattform für Autovermietung (RentFux) – für Privat- und Geschäftskunden mit Online-Buchung, Bezahlung und Admin-Verwaltung. Stack: React + FastAPI + MongoDB. Sprache: Deutsch.

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Shadcn UI, Lucide Icons, React Leaflet
- **Backend**: FastAPI, Motor (async MongoDB), PyJWT, Pydantic, Reportlab
- **Storage**: Emergent Object Storage (uploads)
- **Design**: Chiptuningfile Design System (dark, red Ignition-Rot accents, mechanical/telemetry style, Orbitron + Archivo + IBM Plex Mono)

## Core Features (Implemented)
- JWT Auth + Admin role + Brute-force lockout
- Vehicle catalog with filters (kategorie, transmission, fuel, sitze, preis)
- Booking flow for **guests** and **registered users** (4 steps, stepper UI)
- User profile wizard with B2C/B2B fields
- Document uploads (Führerschein + Ausweis) via Object Storage
- Discount codes (PERCENT/FIXED)
- PDF invoice generation (reportlab)
- Admin Dashboard: KPIs, Charts, Tables
- Admin CRUD: Fahrzeuge, Buchungen, Kunden, Standorte, Rabattcodes
- **GPS Tracking (Admin)**: Live-Karte (Leaflet/OSM) mit Mock-Positionen, Track-History, Status (parked/city/highway), Geofence-Alert
- **Delete operations**: Hard delete für Fahrzeuge, Buchungen, Kunden, **Standorte** (mit Soft-Delete-Vorstufe wenn aktiv)
- Mehrere Standorte mit dynamischer Footer-Anzeige

## Implemented in this session (Feb 2026)
- Verifikation des Chiptuningfile Design Systems über alle Inner-Pages (Account, Booking, Admin)
- Fix: Account.jsx – fehlender "Geschäftskunde"-Tab-Trigger hinzugefügt
- Fix: BookingFlow.jsx / ProfileSetup.jsx / Footer.jsx – stray `slate-*` Klassen ersetzt durch Design-Tokens
- **GPS Tracking Feature** (Backend + Frontend):
  - 4 neue Admin-Endpoints (`POST/GET /admin/vehicles/{id}/location`, `GET /admin/vehicles/{id}/track`, `GET /admin/fleet/locations`)
  - Mock-Simulator (15s Tick, Random-Walk um Bremerhaven mit Anchor-Pull)
  - Geofence-Logik (50km um Anchor → `geofence_alert: true`)
  - Status-Logik (Speed→parked/city/highway)
  - Frontend: AdminTracking.jsx mit Leaflet-Karte, Sidebar-Liste, Filter, Search, Pause, Live-Indikator
  - 20/20 Backend-Tests grün in test_gps_tracking.py
- **Delete-Funktion in Admin**:
  - Fahrzeug: Soft-Delete (deaktivieren) wenn aktiv, Hard-Delete wenn inaktiv (mit Schutz vor aktiven Buchungen)
  - Buchung: Hard-Delete (außer aktive + bezahlte)
  - Kunde: Hard-Delete (mit Anonymisierung historischer Buchungen, force=true bei aktiven Buchungen, Admin-Schutz)

## Test Credentials
Siehe `/app/memory/test_credentials.md`. Admin: `admin@rentfux.de` / `Admin123!`.

## Backend Architecture
- `/app/backend/server.py` (monolithisch, ~1700 Zeilen)
  - Auth, Vehicles, Bookings, Locations, Discounts, Uploads, PDF, Admin, **GPS Tracking**, Health
- Background-Task: `_gps_simulator_loop` (15s)
- MongoDB Collections: `users`, `vehicles`, `bookings`, `locations`, `discount_codes`, `vehicle_positions`, `login_attempts`

## Mocked / Pending Integrations
- **Payments**: Stripe / PayPal — `POST /api/payments/mock-pay` immer success (P1)
- **Emails**: SendGrid — Mock (P1)
- **WhatsApp/SMS**: Twilio — Mock (P1)
- **GPS-Tracker**: Mock-Simulator statt echter Hardware (Endpoint bereit für reale POSTs)

## P1 Backlog
- Stripe-Integration für echte Zahlungen
- SendGrid + Twilio-Integration für Benachrichtigungen
- E-Mail beim Booking (Bestätigung + Stornierung + Rechnung)

## P2 Backlog
- Multi-Location Suche im UI (DB unterstützt es bereits)
- Review-System für Fahrzeuge
- Mehrsprachigkeit (DE/EN)
- Refactor: `server.py` in modulare Router aufteilen (auth, bookings, vehicles, admin, tracking)
- Pause-Button-UX: visueller Toggle des Live-Indicators

## Known Issues (non-blocking)
- ESLint Warnings in AdminBookingDetail.jsx / AdminCustomerDetail.jsx (missing useEffect deps)
- Brute-force Lockout funktioniert nicht hinter K8s-Ingress (alle Requests von einer IP)
- Recharts Console-Warnings auf Admin-Dashboard (width/height -1) wenn schmaler Container
