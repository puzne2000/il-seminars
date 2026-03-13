-- Add last_scraped_at column to track when each seminar was last seen by the scraper
ALTER TABLE public.seminars
  ADD COLUMN last_scraped_at TIMESTAMP WITH TIME ZONE;
