-- Create storage bucket for composite images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'composite-images',
  'composite-images',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for composite images bucket
CREATE POLICY "Users can view their own composite images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'composite-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own composite images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'composite-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own composite images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'composite-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add composite_image_url column to wardrobe_items table
ALTER TABLE wardrobe_items
ADD COLUMN IF NOT EXISTS composite_image_url TEXT;

-- Create index for faster composite image lookups
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_composite_url 
ON wardrobe_items(composite_image_url);