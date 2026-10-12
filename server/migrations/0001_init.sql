-- The dairy's records. One row per real thing; the apps' own wording and rules stay in the app.
--
-- Conventions:
--   * ids are the app's own text ids (cust_…, prod_…), so records already on a phone keep their identity;
--   * days are 'YYYY-MM-DD' text in India time, months 'YYYY-MM'; moments are ISO 8601 UTC text;
--   * money is whole paise-free rupees (INTEGER), as every screen rounds to rupees;
--   * booleans are 0/1; anything the app keeps as a list of its own shape is JSON text.

-- People who can sign in. A customer or delivery boy row points at its own record.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'customer', 'delivery_boy')),
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  avatar_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- A signed-in phone. The token itself is never stored, only its hash.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  device TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

-- A code sent by SMS, and what has been tried against it.
CREATE TABLE otp_challenges (
  id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  resend_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX otp_mobile ON otp_challenges(mobile, created_at);

CREATE TABLE delivery_boys (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  alternate_mobile TEXT,
  primary_route_name TEXT NOT NULL DEFAULT '',
  additional_route_name TEXT,
  joining_date TEXT,
  last_working_date TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  salary_type TEXT NOT NULL DEFAULT 'Fixed Monthly Salary',
  monthly_salary INTEGER NOT NULL DEFAULT 0,
  per_day_salary INTEGER NOT NULL DEFAULT 0,
  app_access_enabled INTEGER NOT NULL DEFAULT 1,
  photo_key TEXT,
  -- Address, bank details, emergency contact, leave rules: the app's own shapes.
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX delivery_boys_mobile ON delivery_boys(mobile);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  alternate_mobile TEXT,
  date_of_birth TEXT,
  flat_no TEXT NOT NULL DEFAULT '',
  society_name TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  landmark TEXT,
  city TEXT NOT NULL DEFAULT '',
  pincode TEXT NOT NULL DEFAULT '',
  map_link TEXT,
  full_address TEXT NOT NULL DEFAULT '',
  route_name TEXT NOT NULL DEFAULT '',
  delivery_boy_id TEXT REFERENCES delivery_boys(id) ON DELETE SET NULL,
  delivery_time TEXT NOT NULL DEFAULT 'Morning',
  billing_type TEXT NOT NULL DEFAULT 'Postpaid',
  billing_cycle_date INTEGER,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  app_access_enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  subscription_start_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX customers_mobile ON customers(mobile);
CREATE INDEX customers_route ON customers(delivery_boy_id, status);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  product_type TEXT NOT NULL DEFAULT 'Milk',
  unit TEXT NOT NULL DEFAULT 'ml',
  description TEXT NOT NULL DEFAULT '',
  image_key TEXT,
  availability TEXT NOT NULL DEFAULT 'Available',
  features_json TEXT NOT NULL DEFAULT '[]',
  is_visible_to_customer INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX products_name ON products(name);

-- A size of a product, with its own price: "Cow Milk 500 ml".
CREATE TABLE product_packs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL DEFAULT 0,
  discount_price INTEGER,
  sku TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX product_packs_product ON product_packs(product_id);

-- A line of a customer's standing order.
CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  pack_id TEXT,
  product_name TEXT NOT NULL,
  pack_label TEXT NOT NULL,
  unit_type TEXT,
  number_of_items INTEGER NOT NULL DEFAULT 1,
  frequency TEXT NOT NULL DEFAULT 'Daily',
  delivery_time TEXT NOT NULL DEFAULT 'Morning',
  start_date TEXT NOT NULL,
  end_date TEXT,
  open_ended INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Active',
  addition_tag TEXT NOT NULL DEFAULT 'Regular',
  original_price INTEGER NOT NULL DEFAULT 0,
  discounted_price INTEGER NOT NULL DEFAULT 0,
  effective_price INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX subscription_plans_customer ON subscription_plans(customer_id, status);

-- A day (or stretch) that differs from the standing order: a skip, or another quantity.
CREATE TABLE subscription_exceptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES subscription_plans(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('skip', 'quantity')),
  from_ymd TEXT NOT NULL,
  to_ymd TEXT NOT NULL,
  number_of_items INTEGER,
  reason TEXT,
  created_by TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX subscription_exceptions_customer ON subscription_exceptions(customer_id, from_ymd, to_ymd);

-- A one-off order for a day: an extra item, or a combo ordered under an offer.
CREATE TABLE extra_orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  delivery_ymd TEXT NOT NULL,
  product_name TEXT NOT NULL,
  pack_label TEXT NOT NULL DEFAULT '',
  pack_id TEXT,
  number_of_items INTEGER NOT NULL DEFAULT 1,
  -- What it is billed at, fixed when the order was placed (an offer price, or the list price).
  price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Delivered', 'Cancelled')),
  offer_id TEXT,
  offer_title_en TEXT,
  offer_title_mr TEXT,
  offer_list_price INTEGER,
  combo_items_json TEXT,
  placed_by TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX extra_orders_customer_day ON extra_orders(customer_id, delivery_ymd);
CREATE INDEX extra_orders_day ON extra_orders(delivery_ymd, status);

-- What the delivery boy marked for a house on a day. Bills count these rows only.
CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  delivery_ymd TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  pack_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('Delivered', 'Missed')),
  subscription_items INTEGER,
  missed_reason TEXT,
  marked_by TEXT,
  delivery_boy_id TEXT REFERENCES delivery_boys(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX deliveries_customer_day ON deliveries(customer_id, delivery_ymd);
CREATE INDEX deliveries_day ON deliveries(delivery_ymd, status);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  payment_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'Cash',
  transaction_id TEXT,
  collected_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX payments_customer ON payments(customer_id, payment_date);

-- A payment the customer says they made from the app, until the dairy finds it in the bank.
CREATE TABLE payment_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  reference TEXT,
  paid_on_ymd TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Rejected', 'Cancelled')),
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX payment_requests_status ON payment_requests(status, created_at);

CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  delivery_boy_id TEXT NOT NULL REFERENCES delivery_boys(id) ON DELETE CASCADE,
  ymd TEXT NOT NULL,
  status TEXT NOT NULL,
  cover_for_id TEXT REFERENCES delivery_boys(id) ON DELETE SET NULL,
  notes TEXT,
  remarks TEXT,
  marked_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX attendance_boy_day ON attendance(delivery_boy_id, ymd);

-- Advances, bonuses, deductions and the month's settled salary.
CREATE TABLE salary_entries (
  id TEXT PRIMARY KEY,
  delivery_boy_id TEXT NOT NULL REFERENCES delivery_boys(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('advance', 'bonus', 'deduction', 'payment')),
  amount INTEGER NOT NULL,
  paid_on TEXT,
  mode TEXT,
  purpose TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX salary_entries_boy_month ON salary_entries(delivery_boy_id, month);

-- A price offer, combo, bill discount or subscription reward.
CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('price', 'combo', 'bill', 'subscription')),
  title_en TEXT NOT NULL,
  title_mr TEXT,
  description_en TEXT,
  description_mr TEXT,
  image_key TEXT,
  start_ymd TEXT NOT NULL,
  end_ymd TEXT,
  ended_at TEXT,
  code TEXT,
  -- The kind's own fields (price items, combo contents, discount rule): the app's shapes, stored as they are.
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX offers_live ON offers(start_ymd, end_ymd);
CREATE UNIQUE INDEX offers_code ON offers(code) WHERE code IS NOT NULL;

CREATE TABLE offer_claims (
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY (offer_id, customer_id)
);

CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'Important',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  title_mr TEXT,
  message_mr TEXT,
  media_json TEXT,
  audience_kind TEXT NOT NULL DEFAULT 'all' CHECK (audience_kind IN ('all', 'customers')),
  audience_customer_ids_json TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX announcements_created ON announcements(created_at);

CREATE TABLE announcement_reads (
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL,
  PRIMARY KEY (announcement_id, customer_id)
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('customer', 'dairy')),
  sender_name TEXT,
  text TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX chat_customer ON chat_messages(customer_id, created_at);

-- One row per thing worth telling somebody about, in both languages.
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  audience TEXT NOT NULL CHECK (audience IN ('Admin', 'Customer', 'DeliveryBoy')),
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  delivery_boy_id TEXT REFERENCES delivery_boys(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  title_mr TEXT,
  body_mr TEXT,
  link TEXT,
  subject_key TEXT,
  date_ymd TEXT,
  month TEXT,
  announcement_id TEXT REFERENCES announcements(id) ON DELETE CASCADE,
  response TEXT,
  responded_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX notifications_reader ON notifications(audience, customer_id, delivery_boy_id, created_at);
CREATE INDEX notifications_subject ON notifications(subject_key, created_at);

-- Where to send a push notification.
CREATE TABLE push_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX push_tokens_user ON push_tokens(user_id);

-- Dairy-wide settings the admin edits: UPI details, contact channels, FAQ, privacy policy, dashboard cover.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
