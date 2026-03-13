
-- Create seminars table
CREATE TABLE public.seminars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  speaker TEXT NOT NULL,
  affiliation TEXT NOT NULL,
  university TEXT NOT NULL,
  department TEXT NOT NULL,
  subject_area TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  abstract TEXT,
  type TEXT NOT NULL CHECK (type IN ('Seminar', 'Colloquium')),
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seminars ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Seminars are publicly readable"
  ON public.seminars FOR SELECT
  USING (true);

-- Enable pg_cron and pg_net for scheduled scraping
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_seminars_updated_at
  BEFORE UPDATE ON public.seminars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
