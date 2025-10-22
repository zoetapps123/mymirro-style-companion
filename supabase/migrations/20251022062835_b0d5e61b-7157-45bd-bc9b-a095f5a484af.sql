-- Create storage bucket for outfit images
INSERT INTO storage.buckets (id, name, public)
VALUES ('outfits', 'outfits', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for outfit images
CREATE POLICY "Anyone can view outfit images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'outfits');

CREATE POLICY "Authenticated users can upload outfit images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'outfits' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own outfit images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'outfits' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own outfit images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'outfits' AND auth.uid() IS NOT NULL);