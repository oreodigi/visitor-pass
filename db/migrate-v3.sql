-- ============================================================
-- migrate-v3.sql: Role expansion + event staff assignments
-- Run AFTER schema.sql and migrate-v2.sql in Supabase SQL Editor
-- ============================================================

-- 1. Extend users role constraint to include 'manager'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'gate_staff', 'manager'));

-- 2. Add optional designation column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation TEXT;

-- 3. Event-staff assignment join table
CREATE TABLE IF NOT EXISTS user_event_assignments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  event_id      UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  assigned_role TEXT        NOT NULL
                              CHECK (assigned_role IN ('manager', 'gate_staff')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_uea_user_id  ON user_event_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_uea_event_id ON user_event_assignments(event_id);

-- 5. Seed a test manager user (idempotent)
INSERT INTO users (name, mobile, email, password_hash, role, active, designation)
SELECT
  'Event Manager',
  '9000000002',
  'manager@msme.local',
  crypt('manager123', gen_salt('bf')),
  'manager',
  true,
  'Event Operations Manager'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'manager@msme.local'
);
