-- A desk at the dairy that sells over the counter, and a tier above the admin.
--
-- Two roles arrive together: `desk`, who rings up a walk-in sale and prints the bill, and `super_admin`, the
-- dairy's own login, which keeps the things an admin should not change on their own — prices, payment details,
-- and who works here. The owner's login becomes the super admin; a plain admin is somebody they add later to run
-- the day without being able to re-price the milk.
--
-- SQLite cannot widen a CHECK, so `users` is rebuilt. `defer_foreign_keys` holds the references in sessions,
-- customers, delivery_boys and push_tokens still while the old table goes and the new one takes its name.

PRAGMA defer_foreign_keys = on;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'desk', 'customer', 'delivery_boy')),
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  avatar_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  pin_hash TEXT,
  pin_set_at TEXT,
  pin_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until TEXT
);

INSERT INTO users_new (id, mobile, role, display_name, status, avatar_key, created_at, updated_at, pin_hash, pin_set_at, pin_attempts, pin_locked_until)
SELECT id, mobile, role, display_name, status, avatar_key, created_at, updated_at, pin_hash, pin_set_at, pin_attempts, pin_locked_until FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- The dairy's own login is the one that owns everything.
UPDATE users SET role = 'super_admin', updated_at = '2026-10-13T00:00:00.000Z' WHERE role = 'admin';

-- The people on the desk. Kept like the delivery team: a record the dairy owns, and a login made on first sign-in.
CREATE TABLE desk_users (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  app_access_enabled INTEGER NOT NULL DEFAULT 1,
  counter_name TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One sale rung up at the counter: paid there and then, so it never reaches a monthly bill.
CREATE TABLE counter_sales (
  id TEXT PRIMARY KEY,
  -- Readable on the paper bill, unique within the day: 001, 002…
  sale_no TEXT NOT NULL,
  ymd TEXT NOT NULL,
  sold_at TEXT NOT NULL,
  desk_user_id TEXT REFERENCES desk_users(id) ON DELETE SET NULL,
  -- The name on the bill, kept even if that desk user is removed later.
  sold_by_name TEXT NOT NULL DEFAULT '',
  -- A walk-in has none; a regular who happened to buy at the counter can be pointed at their record.
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_mobile TEXT NOT NULL DEFAULT '',
  items_total INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  paid_by TEXT NOT NULL DEFAULT 'Cash' CHECK (paid_by IN ('Cash', 'UPI')),
  note TEXT NOT NULL DEFAULT '',
  printed_at TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX counter_sales_no ON counter_sales(ymd, sale_no);
CREATE INDEX counter_sales_day ON counter_sales(ymd, sold_at);
CREATE INDEX counter_sales_desk ON counter_sales(desk_user_id, ymd);

-- What was on it. The name, pack and price are copied here, not looked up: a price changed next month must never
-- rewrite a bill somebody has already been handed.
CREATE TABLE counter_sale_lines (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES counter_sales(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 0,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  pack_id TEXT,
  product_name TEXT NOT NULL,
  pack_label TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX counter_sale_lines_sale ON counter_sale_lines(sale_id, line_no);
