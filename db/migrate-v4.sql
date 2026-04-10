-- ============================================================
-- migrate-v4.sql: Message templates + Terms & Conditions
-- Run AFTER schema.sql, migrate-v2.sql, migrate-v3.sql
-- ============================================================

-- 1. Add message template columns to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS invite_message_template TEXT,
  ADD COLUMN IF NOT EXISTS pass_message_template    TEXT,
  ADD COLUMN IF NOT EXISTS pass_terms_conditions    TEXT;
