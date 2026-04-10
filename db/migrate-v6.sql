-- Migration v6: Event capacity settings
-- Run this in Supabase SQL Editor

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS max_visitors INTEGER,
  ADD COLUMN IF NOT EXISTS vip_seats    INTEGER NOT NULL DEFAULT 0;

-- max_visitors: cap on total registered passes (NULL = unlimited)
-- vip_seats:    number of seats reserved/blocked for VIP or management use (default 0)
