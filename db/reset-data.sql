-- ⚠️  RESET ALL DATA — run in Supabase SQL Editor
-- This deletes ALL events, contacts, attendees, and passes.
-- Admin/staff user accounts are preserved.
-- This cannot be undone.

TRUNCATE TABLE contacts  RESTART IDENTITY CASCADE;
TRUNCATE TABLE attendees RESTART IDENTITY CASCADE;
TRUNCATE TABLE events    RESTART IDENTITY CASCADE;
