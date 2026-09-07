-- Portal authentication tables and default seed users
CREATE TABLE IF NOT EXISTS portal_users (
  id TEXT PRIMARY KEY,
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  portal_access TEXT NOT NULL,
  allowed_sections TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS portal_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  login TEXT NOT NULL,
  role TEXT NOT NULL,
  portal_access TEXT NOT NULL,
  allowed_sections TEXT DEFAULT '[]',
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Default users (password = "password", SHA-256 hash)
INSERT OR IGNORE INTO portal_users VALUES ('pu001','customer01','5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8','Salim Al-Harthy','customer','customer','[]','active','2024-01-01',null);
INSERT OR IGNORE INTO portal_users VALUES ('pu002','pm01','5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8','Fatima Al-Rashdi','product_manager','backoffice','["products","applications","rules","workflows","users","ai_studio"]','active','2024-01-01',null);
INSERT OR IGNORE INTO portal_users VALUES ('pu003','compliance01','5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8','Aisha Al-Balushi','compliance_officer','backoffice','["compliance"]','active','2024-01-01',null);
INSERT OR IGNORE INTO portal_users VALUES ('pu004','rm01','5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8','Omar Al-Mantheri','risk_officer','backoffice','["risk"]','active','2024-01-01',null);
INSERT OR IGNORE INTO portal_users VALUES ('pu005','admin','5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8','System Administrator','admin','all','[]','active','2024-01-01',null);
INSERT OR IGNORE INTO portal_users VALUES ('pu006','developer01','5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8','Ahmed Al-Hinai','developer','developer','[]','active','2024-01-01',null);
