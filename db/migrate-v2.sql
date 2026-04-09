-- ============================================================
-- V2 Migration: Contact-based invitation flow
-- Run this in Supabase SQL Editor AFTER schema.sql + auth-functions.sql
-- ============================================================

-- 1. Extend attendees table
ALTER TABLE attendees
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS seat_number TEXT,
  ADD COLUMN IF NOT EXISTS contact_id UUID;

-- Partial unique index: seat_number is unique per event (ignores NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS attendees_event_seat_unique
  ON attendees (event_id, seat_number)
  WHERE seat_number IS NOT NULL;

-- 2. Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  mobile                 TEXT NOT NULL,
  invitation_token       TEXT UNIQUE NOT NULL,
  invitation_link        TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'uploaded'
                           CHECK (status IN ('uploaded', 'invited', 'confirmed', 'cancelled')),
  whatsapp_invite_status TEXT NOT NULL DEFAULT 'pending'
                           CHECK (whatsapp_invite_status IN ('pending', 'sent')),
  invited_at             TIMESTAMPTZ,
  responded_at           TIMESTAMPTZ,
  attendee_id            UUID REFERENCES attendees(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, mobile)
);

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
