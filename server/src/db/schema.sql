CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL REFERENCES cities(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  midi_starts TEXT NOT NULL DEFAULT '11:00',
  midi_ends TEXT NOT NULL DEFAULT '15:00',
  soir_starts TEXT NOT NULL DEFAULT '18:00',
  soir_ends TEXT NOT NULL DEFAULT '21:30',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('CENTRAL_ADMIN', 'RU_MANAGER', 'RU_AGENT')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  role TEXT NOT NULL CHECK(role IN ('MANAGER', 'AGENT')),
  UNIQUE(user_id, restaurant_id)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  city_id INTEGER REFERENCES cities(id),
  restaurant_id INTEGER REFERENCES restaurants(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS restaurant_menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  service TEXT NOT NULL CHECK(service IN ('MIDI', 'SOIR')),
  position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 8),
  dish_id INTEGER NOT NULL REFERENCES dishes(id),
  price_fcfa INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(restaurant_id, weekday, service, position)
);

CREATE TABLE IF NOT EXISTS restaurant_menu_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  date TEXT NOT NULL,
  service TEXT NOT NULL CHECK(service IN ('MIDI', 'SOIR')),
  position INTEGER NOT NULL,
  dish_id INTEGER NOT NULL REFERENCES dishes(id),
  price_fcfa INTEGER NOT NULL,
  UNIQUE(restaurant_id, date, service, position)
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  city_id INTEGER NOT NULL REFERENCES cities(id),
  service TEXT NOT NULL CHECK(service IN ('MIDI', 'SOIR')),
  date TEXT NOT NULL,
  dish_id INTEGER NOT NULL REFERENCES dishes(id),
  quantity INTEGER NOT NULL CHECK(quantity >= 1 AND quantity <= 10),
  amount INTEGER NOT NULL,
  reservation_code TEXT NOT NULL UNIQUE,
  payment_status TEXT NOT NULL CHECK(payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  status TEXT NOT NULL CHECK(status IN (
    'PENDING_PAYMENT',
    'RESERVED',
    'CODE_USED',
    'TOKEN_ISSUED',
    'SERVED',
    'CANCELLED',
    'EXPIRED'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  used_at TEXT,
  token_issued_at TEXT,
  served_at TEXT,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_date
  ON reservations(restaurant_id, date, service);
CREATE INDEX IF NOT EXISTS idx_reservations_code ON reservations(reservation_code);
CREATE INDEX IF NOT EXISTS idx_reservations_student ON reservations(student_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id),
  provider TEXT NOT NULL,
  transaction_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);

CREATE TABLE IF NOT EXISTS tokens_issued (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL UNIQUE REFERENCES reservations(id),
  quantity INTEGER NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  issued_by_user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ussd_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  current_step TEXT NOT NULL,
  city_id INTEGER,
  restaurant_id INTEGER,
  service TEXT,
  dish_id INTEGER,
  quantity INTEGER,
  reservation_id INTEGER,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ussd_phone ON ussd_sessions(phone);

CREATE TABLE IF NOT EXISTS sms_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  reservation_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  restaurant_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
