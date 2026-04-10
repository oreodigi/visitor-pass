-- Migration v7: Partners & sponsors per event
-- Run this in Supabase SQL Editor

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS partners JSONB NOT NULL DEFAULT '[]'::jsonb;

-- partners JSON shape:
-- [
--   { "name": "Company A", "logo_url": "https://..." },
--   { "name": "Company B", "logo_url": null }
-- ]
