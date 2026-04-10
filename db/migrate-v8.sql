-- Migration v8: App settings table for SMTP and general config
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_app_settings_updated_at();

-- Default rows (safe to re-run)
INSERT INTO app_settings (key, value) VALUES
  ('app_name',        'Visitor Pass'),
  ('smtp_host',       ''),
  ('smtp_port',       '587'),
  ('smtp_secure',     'starttls'),
  ('smtp_user',       ''),
  ('smtp_password',   ''),
  ('smtp_from_name',  'Visitor Pass'),
  ('smtp_from_email', '')
ON CONFLICT (key) DO NOTHING;
