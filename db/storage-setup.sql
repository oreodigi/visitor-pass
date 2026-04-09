-- ============================================================
-- Supabase Storage: Create bucket for event logos
-- Run this in Supabase SQL Editor AFTER creating the project
-- ============================================================

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-logos', 'event-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to logos
CREATE POLICY "Public read access for event logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-logos');

-- Allow authenticated uploads via service role (already bypasses RLS)
-- This policy is for future use if you switch to client-side uploads
CREATE POLICY "Service upload access for event logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-logos');

CREATE POLICY "Service update access for event logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'event-logos');
