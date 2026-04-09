-- ============================================================
-- Phase 1: Core Schema
-- Run this FIRST in Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── events ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                    TEXT NOT NULL,
  event_date               DATE NOT NULL,
  start_time               TIME NOT NULL,
  end_time                 TIME NOT NULL,
  venue_name               TEXT NOT NULL,
  venue_address            TEXT NOT NULL,
  venue_contact_number     TEXT,
  organizer_contact_number TEXT,
  support_contact_number   TEXT,
  footer_note              TEXT,
  logo_url                 TEXT,
  status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','active','completed','cancelled')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── users ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  mobile         TEXT NOT NULL,
  email          TEXT UNIQUE,
  password_hash  TEXT,
  auth_id        UUID,
  role           TEXT NOT NULL DEFAULT 'gate_staff'
                   CHECK (role IN ('admin','gate_staff')),
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── attendees ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendees (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                 TEXT,
  mobile               TEXT NOT NULL,
  business_name        TEXT,
  source               TEXT NOT NULL DEFAULT 'manual'
                         CHECK (source IN ('missed_call','manual','import','registration')),
  pass_number          TEXT,
  qr_token             TEXT,
  pass_url             TEXT,
  pass_generated_at    TIMESTAMPTZ,
  whatsapp_status      TEXT NOT NULL DEFAULT 'pending'
                         CHECK (whatsapp_status IN ('pending','ready','sent','opened','failed')),
  whatsapp_opened_at       TIMESTAMPTZ,
  whatsapp_sent_marked_at  TIMESTAMPTZ,
  checked_in_at        TIMESTAMPTZ,
  checked_in_by        UUID REFERENCES users(id),
  manual_override_by   UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, mobile)
);

-- ── checkin_logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkin_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendee_id    UUID REFERENCES attendees(id) ON DELETE SET NULL,
  scanned_token  TEXT NOT NULL,
  status         TEXT NOT NULL
                   CHECK (status IN ('valid','duplicate','invalid','manual')),
  scanned_by     UUID REFERENCES users(id),
  gate_name      TEXT,
  device_info    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── message_logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendee_id    UUID REFERENCES attendees(id) ON DELETE SET NULL,
  mobile         TEXT NOT NULL,
  message_text   TEXT,
  whatsapp_link  TEXT,
  status         TEXT NOT NULL DEFAULT 'generated'
                   CHECK (status IN ('generated','sent','opened','failed')),
  opened_by      UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at    BEFORE UPDATE ON events    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_updated_at     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER attendees_updated_at BEFORE UPDATE ON attendees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
