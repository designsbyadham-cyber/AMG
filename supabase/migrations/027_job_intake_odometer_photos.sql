-- Job intake enhancements: vehicle mileage at intake + attached photos.
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS odometer   INTEGER,
  ADD COLUMN IF NOT EXISTS image_urls TEXT[];

-- job-photos Storage bucket. Public read (so <img> renders without
-- signed URLs), owner-scoped writes — same trade-off/shape as the
-- avatars (008) and flow-media (016) buckets.
-- Path convention: job-photos/{auth.uid()}/{timestamp}-<basename>.<ext>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  TRUE,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Job photos are publicly readable" ON storage.objects;
CREATE POLICY "Job photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-photos');

DROP POLICY IF EXISTS "Users can upload their own job photos" ON storage.objects;
CREATE POLICY "Users can upload their own job photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'job-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own job photos" ON storage.objects;
CREATE POLICY "Users can update their own job photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'job-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own job photos" ON storage.objects;
CREATE POLICY "Users can delete their own job photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'job-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
