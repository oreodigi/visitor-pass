-- Migration v9: Profile pictures for users + app logo setting
-- Run this in Supabase SQL Editor

-- Add profile picture URL to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add extra app_settings defaults (safe to re-run)
INSERT INTO app_settings (key, value) VALUES
  ('app_logo_url',   ''),
  ('app_tagline',    ''),
  ('support_email',  ''),
  ('support_phone',  '')
ON CONFLICT (key) DO NOTHING;

-- ── Storage bucket for user avatars ──────────────────────
-- Run in Supabase SQL Editor:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Public read access for avatars"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');
--
-- CREATE POLICY "Service upload access for avatars"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'avatars');
--
-- CREATE POLICY "Service update access for avatars"
--   ON storage.objects FOR UPDATE
--   USING (bucket_id = 'avatars');
