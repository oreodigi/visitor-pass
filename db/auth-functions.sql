-- ============================================================
-- Password hashing functions using pgcrypto
-- Run this in Supabase SQL Editor AFTER the Phase 1 schema.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Hash a plain password using bcrypt
CREATE OR REPLACE FUNCTION crypt_password(plain_password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(plain_password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify a password against a bcrypt hash
CREATE OR REPLACE FUNCTION verify_password(plain_password TEXT, hashed_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN crypt(plain_password, hashed_password) = hashed_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Seed an admin user (change email/password before production!)
-- Password: admin123 (CHANGE THIS)
-- ============================================================
INSERT INTO users (name, mobile, email, password_hash, role, active)
VALUES (
  'Admin',
  '9999999999',
  'admin@msme.local',
  crypt('admin123', gen_salt('bf', 10)),
  'admin',
  true
)
ON CONFLICT (email) DO NOTHING;

-- Seed a gate staff user
INSERT INTO users (name, mobile, email, password_hash, role, active)
VALUES (
  'Gate Staff',
  '8888888888',
  'staff@msme.local',
  crypt('staff123', gen_salt('bf', 10)),
  'gate_staff',
  true
)
ON CONFLICT (email) DO NOTHING;
