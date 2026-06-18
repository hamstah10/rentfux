-- =====================================================================
-- RentFux — MySQL Schema (Migration from MongoDB)
-- Target: MySQL 8.x  /  MariaDB 10.5+
-- Charset: utf8mb4 (full Unicode incl. emojis & German Umlauts)
-- =====================================================================
-- Run order: This file creates tables in correct FK order.
-- Drop in reverse for clean re-init.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS vehicle_positions;
DROP TABLE IF EXISTS booking_extras;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS vehicle_images;
DROP TABLE IF EXISTS vehicle_features;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS discount_codes;
DROP TABLE IF EXISTS user_documents;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS locations;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------
CREATE TABLE locations (
  id              VARCHAR(64)     NOT NULL,
  name            VARCHAR(255)    NOT NULL,
  address         VARCHAR(255)    NOT NULL,
  city            VARCHAR(120)    NOT NULL,
  postal_code     VARCHAR(20)     NOT NULL,
  phone           VARCHAR(40)     NULL,
  email           VARCHAR(190)    NULL,
  active          TINYINT(1)      NOT NULL DEFAULT 1,
  created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY ix_locations_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- users
--   role: 'user' | 'admin'
--   Profile/address/license fields flattened from Mongo's nested {profile:{}}
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                      VARCHAR(64)   NOT NULL,
  email                   VARCHAR(190)  NOT NULL,
  password_hash           VARCHAR(255)  NOT NULL,
  role                    ENUM('user','admin')           NOT NULL DEFAULT 'user',
  name                    VARCHAR(160)  NOT NULL,
  phone                   VARCHAR(40)   NULL,
  -- Address
  address_street          VARCHAR(255)  NULL,
  address_postal_code     VARCHAR(20)   NULL,
  address_city            VARCHAR(120)  NULL,
  address_country         VARCHAR(80)   NULL DEFAULT 'Deutschland',
  -- License
  date_of_birth           DATE          NULL,
  license_number          VARCHAR(60)   NULL,
  license_country         VARCHAR(80)   NULL,
  license_issued_at       DATE          NULL,
  license_expires_at      DATE          NULL,
  -- Business (B2B)
  is_business             TINYINT(1)    NOT NULL DEFAULT 0,
  company_name            VARCHAR(255)  NULL,
  company_vat_id          VARCHAR(40)   NULL,
  company_contact_name    VARCHAR(160)  NULL,
  company_contact_email   VARCHAR(190)  NULL,
  -- System
  profile_complete        TINYINT(1)    NOT NULL DEFAULT 0,
  created_at              DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at              DATETIME(6)   NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- user_documents
--   In Mongo: users.profile.documents = { license: {path,...}, id_card: {...} }
--   Normalised to a 1:N table.
-- ---------------------------------------------------------------------
CREATE TABLE user_documents (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         VARCHAR(64)     NOT NULL,
  doc_type        ENUM('license','id_card')      NOT NULL,
  storage_path    VARCHAR(500)    NOT NULL,
  filename        VARCHAR(255)    NULL,
  content_type    VARCHAR(100)    NULL,
  size_bytes      BIGINT UNSIGNED NULL,
  uploaded_at     DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_doc_user_type (user_id, doc_type),
  CONSTRAINT fk_doc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------
CREATE TABLE vehicles (
  id              VARCHAR(64)     NOT NULL,
  brand           VARCHAR(120)    NOT NULL,
  name            VARCHAR(120)    NOT NULL,
  category        ENUM('Kleinwagen','Kompakt','Mittelklasse','SUV','Van','Luxus','Transporter') NOT NULL,
  transmission    ENUM('Automatik','Schaltgetriebe') NOT NULL,
  fuel            ENUM('Benzin','Diesel','Elektro','Hybrid') NOT NULL,
  seats           TINYINT UNSIGNED NOT NULL DEFAULT 5,
  doors           TINYINT UNSIGNED NOT NULL DEFAULT 4,
  price_per_day   DECIMAL(10,2)   NOT NULL,
  image_url       VARCHAR(1000)   NULL,             -- primary/cover (mirrors images[0])
  description     TEXT            NULL,
  active          TINYINT(1)      NOT NULL DEFAULT 1,
  location_id     VARCHAR(64)     NULL,
  -- Last GPS snapshot (denormalised cache; full track in vehicle_positions)
  last_lat        DOUBLE          NULL,
  last_lng        DOUBLE          NULL,
  last_speed_kmh  FLOAT           NULL,
  last_heading    FLOAT           NULL,
  last_status     VARCHAR(20)     NULL,
  last_ts         DATETIME(6)     NULL,
  created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY ix_vehicles_active (active),
  KEY ix_vehicles_category (category),
  KEY ix_vehicles_location (location_id),
  CONSTRAINT fk_vehicles_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- vehicle_images
--   Mongo stores List[str]; we normalise to ordered rows.
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_images (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehicle_id      VARCHAR(64)     NOT NULL,
  url             VARCHAR(1000)   NOT NULL,
  sort_order      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_url (vehicle_id, url(255)),
  KEY ix_vehicle_images_order (vehicle_id, sort_order),
  CONSTRAINT fk_vehicle_images_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- vehicle_features
--   Mongo stores List[str]; normalise to rows.
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_features (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehicle_id      VARCHAR(64)     NOT NULL,
  feature_name    VARCHAR(190)    NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_feature (vehicle_id, feature_name),
  KEY ix_vehicle_features (vehicle_id),
  CONSTRAINT fk_vehicle_features_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- discount_codes
--   Code is the primary key (matches Mongo behaviour).
-- ---------------------------------------------------------------------
CREATE TABLE discount_codes (
  code            VARCHAR(40)     NOT NULL,
  description     VARCHAR(255)    NULL,
  discount_type   ENUM('percent','fixed') NOT NULL,
  value           DECIMAL(10,2)   NOT NULL,
  min_total       DECIMAL(10,2)   NULL,
  max_uses        INT UNSIGNED    NULL,
  used_count      INT UNSIGNED    NOT NULL DEFAULT 0,
  valid_from      DATETIME(6)     NULL,
  valid_until     DATETIME(6)     NULL,
  active          TINYINT(1)      NOT NULL DEFAULT 1,
  created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (code),
  KEY ix_discounts_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- bookings
--   user_id is NULL-able to support guest bookings + anonymised history.
-- ---------------------------------------------------------------------
CREATE TABLE bookings (
  id                    VARCHAR(64)     NOT NULL,
  user_id               VARCHAR(64)     NULL,        -- NULL for guest or deleted user
  vehicle_id            VARCHAR(64)     NULL,        -- NULL for deleted vehicle (history kept)
  is_guest              TINYINT(1)      NOT NULL DEFAULT 0,
  -- Customer snapshot (for guest + audit trail)
  customer_name         VARCHAR(160)    NULL,
  customer_email        VARCHAR(190)    NULL,
  customer_phone        VARCHAR(40)     NULL,
  customer_dob          DATE            NULL,
  customer_license      VARCHAR(60)     NULL,
  customer_address      VARCHAR(255)    NULL,
  customer_postal       VARCHAR(20)     NULL,
  customer_city         VARCHAR(120)    NULL,
  customer_country      VARCHAR(80)     NULL,
  -- Vehicle snapshot (in case vehicle is later deleted)
  vehicle_brand         VARCHAR(120)    NULL,
  vehicle_name          VARCHAR(120)    NULL,
  -- Location pickup/return
  pickup_location_id    VARCHAR(64)     NULL,
  return_location_id    VARCHAR(64)     NULL,
  -- Period
  start_date            DATE            NOT NULL,
  end_date              DATE            NOT NULL,
  pickup_time           TIME            NULL,
  return_time           TIME            NULL,
  days                  SMALLINT UNSIGNED NOT NULL,
  -- Pricing (all amounts in EUR)
  base_subtotal         DECIMAL(10,2)   NOT NULL,
  extras_total          DECIMAL(10,2)   NOT NULL DEFAULT 0,
  discount_code         VARCHAR(40)     NULL,
  discount_amount       DECIMAL(10,2)   NOT NULL DEFAULT 0,
  total                 DECIMAL(10,2)   NOT NULL,
  -- Status & payment
  status                ENUM('pending','confirmed','active','completed','cancelled') NOT NULL DEFAULT 'pending',
  payment_method        ENUM('stripe','paypal','manual') NULL,
  payment_status        ENUM('pending','paid','refunded','failed') NOT NULL DEFAULT 'pending',
  -- Audit / flags
  vehicle_deleted       TINYINT(1)      NOT NULL DEFAULT 0,
  user_deleted          TINYINT(1)      NOT NULL DEFAULT 0,
  cancelled_at          DATETIME(6)     NULL,
  created_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6)     NULL,
  PRIMARY KEY (id),
  KEY ix_bookings_user (user_id),
  KEY ix_bookings_vehicle (vehicle_id),
  KEY ix_bookings_status (status),
  KEY ix_bookings_payment (payment_status),
  KEY ix_bookings_dates (start_date, end_date),
  CONSTRAINT fk_bookings_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_pickup  FOREIGN KEY (pickup_location_id) REFERENCES locations(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_return  FOREIGN KEY (return_location_id) REFERENCES locations(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_discount FOREIGN KEY (discount_code) REFERENCES discount_codes(code) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- booking_extras
--   Mongo stores extras as List[str] (e.g. "Kindersitz", "Vollkasko").
-- ---------------------------------------------------------------------
CREATE TABLE booking_extras (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id      VARCHAR(64)     NOT NULL,
  extra_name      VARCHAR(190)    NOT NULL,
  extra_price     DECIMAL(10,2)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY ix_extras_booking (booking_id),
  CONSTRAINT fk_extras_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- vehicle_positions  (GPS-Tracking history)
--   In Mongo this collection grows quickly via the simulator.
--   Consider partitioning by week/month for production scale.
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_positions (
  id              VARCHAR(64)     NOT NULL,
  vehicle_id      VARCHAR(64)     NOT NULL,
  lat             DOUBLE          NOT NULL,
  lng             DOUBLE          NOT NULL,
  speed_kmh       FLOAT           NOT NULL DEFAULT 0,
  heading         FLOAT           NOT NULL DEFAULT 0,
  status          VARCHAR(20)     NOT NULL,                -- parked | city | highway
  source          VARCHAR(20)     NOT NULL DEFAULT 'mock',
  fence_km        FLOAT           NOT NULL DEFAULT 0,
  geofence_alert  TINYINT(1)      NOT NULL DEFAULT 0,
  ts              DATETIME(6)     NOT NULL,
  ts_epoch        BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY ix_positions_vehicle_time (vehicle_id, ts_epoch DESC),
  CONSTRAINT fk_positions_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- login_attempts  (Brute-force lockout)
-- ---------------------------------------------------------------------
CREATE TABLE login_attempts (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  identifier      VARCHAR(190)    NOT NULL,             -- email or IP
  attempted_at    DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  success         TINYINT(1)      NOT NULL DEFAULT 0,
  ip              VARCHAR(64)     NULL,
  user_agent      VARCHAR(500)    NULL,
  PRIMARY KEY (id),
  KEY ix_login_identifier_time (identifier, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- END
-- =====================================================================
