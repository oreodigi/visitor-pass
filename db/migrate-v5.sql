-- Migration v5: Seat map configuration
-- Run this in Supabase SQL Editor

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS seat_map_config JSONB;

-- seat_map_config JSON shape:
-- {
--   "rows": [
--     { "label": "A", "count": 25, "category": "Gold",   "aisle_after": 12 },
--     { "label": "B", "count": 20, "category": "Silver",  "aisle_after": null }
--   ],
--   "blocked": ["A-5", "A-6", "B-10"]
-- }
