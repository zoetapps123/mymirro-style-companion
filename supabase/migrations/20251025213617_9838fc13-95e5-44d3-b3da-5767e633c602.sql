-- Create outfits table
CREATE TABLE public.outfits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  occasion TEXT,
  preview_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create outfit_items junction table
CREATE TABLE public.outfit_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  outfit_id UUID NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.wardrobe_items(id) ON DELETE CASCADE,
  ai_virtual BOOLEAN NOT NULL DEFAULT false,
  ai_meta JSONB,
  item_type TEXT NOT NULL, -- 'top', 'bottom', 'layer', 'shoes', 'accessories'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create events table for calendar
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  occasion TEXT,
  place TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event_outfits junction table
CREATE TABLE public.event_outfits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  outfit_id UUID NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tryon_sessions table
CREATE TABLE public.tryon_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  outfit_id UUID REFERENCES public.outfits(id) ON DELETE CASCADE,
  user_image_url TEXT NOT NULL,
  render_url TEXT,
  status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tryon_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outfits
CREATE POLICY "Users can view their own outfits"
  ON public.outfits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own outfits"
  ON public.outfits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own outfits"
  ON public.outfits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own outfits"
  ON public.outfits FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for outfit_items
CREATE POLICY "Users can view outfit items for their outfits"
  ON public.outfit_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.outfits
    WHERE outfits.id = outfit_items.outfit_id
    AND outfits.user_id = auth.uid()
  ));

CREATE POLICY "Users can create outfit items for their outfits"
  ON public.outfit_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.outfits
    WHERE outfits.id = outfit_items.outfit_id
    AND outfits.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete outfit items from their outfits"
  ON public.outfit_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.outfits
    WHERE outfits.id = outfit_items.outfit_id
    AND outfits.user_id = auth.uid()
  ));

-- RLS Policies for events
CREATE POLICY "Users can view their own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for event_outfits
CREATE POLICY "Users can view event outfits for their events"
  ON public.event_outfits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_outfits.event_id
    AND events.user_id = auth.uid()
  ));

CREATE POLICY "Users can create event outfits for their events"
  ON public.event_outfits FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_outfits.event_id
    AND events.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete event outfits from their events"
  ON public.event_outfits FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_outfits.event_id
    AND events.user_id = auth.uid()
  ));

-- RLS Policies for tryon_sessions
CREATE POLICY "Users can view their own tryon sessions"
  ON public.tryon_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tryon sessions"
  ON public.tryon_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_outfits_user_id ON public.outfits(user_id);
CREATE INDEX idx_outfit_items_outfit_id ON public.outfit_items(outfit_id);
CREATE INDEX idx_events_user_id ON public.events(user_id);
CREATE INDEX idx_events_dates ON public.events(start_date, end_date);
CREATE INDEX idx_event_outfits_event_id ON public.event_outfits(event_id);
CREATE INDEX idx_tryon_sessions_user_id ON public.tryon_sessions(user_id);