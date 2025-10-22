-- Create wardrobe items table
CREATE TABLE IF NOT EXISTS public.wardrobe_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  color TEXT,
  image_url TEXT NOT NULL,
  processed_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own wardrobe items" 
ON public.wardrobe_items 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wardrobe items" 
ON public.wardrobe_items 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wardrobe items" 
ON public.wardrobe_items 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wardrobe items" 
ON public.wardrobe_items 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create style checks table
CREATE TABLE IF NOT EXISTS public.style_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  overall_score DECIMAL(3,1) NOT NULL,
  color_score DECIMAL(3,1) NOT NULL,
  fit_score DECIMAL(3,1) NOT NULL,
  texture_score DECIMAL(3,1) NOT NULL,
  occasion_score DECIMAL(3,1) NOT NULL,
  verdict_positive TEXT NOT NULL,
  verdict_improvements TEXT NOT NULL,
  occasion TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.style_checks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own style checks" 
ON public.style_checks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own style checks" 
ON public.style_checks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create battles table
CREATE TABLE IF NOT EXISTS public.battles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  participants JSONB NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own battles" 
ON public.battles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own battles" 
ON public.battles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_wardrobe_items_updated_at
BEFORE UPDATE ON public.wardrobe_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();