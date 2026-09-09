-- Migration 0012: Sales campaigns table
-- Campaigns created in developer portal persist here and are read by customer portal
-- to show discounted unit prices.

CREATE TABLE IF NOT EXISTS sales_campaigns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  project_id  TEXT    NOT NULL DEFAULT 'all',   -- 'all' = applies to all projects
  unit_type   TEXT    NOT NULL DEFAULT 'all',   -- 'all' = applies to all unit types
  discount    REAL    NOT NULL DEFAULT 0,        -- discount percentage, e.g. 5 = 5%
  velocity_boost REAL DEFAULT 0,                -- % boost to sales velocity (for forecast)
  commission  REAL    DEFAULT 0,                -- agent commission %
  budget      REAL    DEFAULT 0,                -- marketing budget OMR
  target_units INTEGER DEFAULT 0,
  notes       TEXT    DEFAULT '',
  start_date  TEXT    NOT NULL,                 -- ISO date YYYY-MM-DD
  end_date    TEXT    NOT NULL,                 -- ISO date YYYY-MM-DD
  status      TEXT    NOT NULL DEFAULT 'scheduled'
                CHECK(status IN ('active','scheduled','ended')),
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status    ON sales_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_project   ON sales_campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates     ON sales_campaigns(start_date, end_date);
