-- Create table for storing scraped phone numbers
CREATE TABLE public.scraped_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  raw_number TEXT NOT NULL,
  category TEXT NOT NULL,
  comment TEXT,
  operator TEXT,
  operator_code TEXT,
  source TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.scraped_numbers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (no auth required for this public data)
CREATE POLICY "Anyone can view scraped numbers"
ON public.scraped_numbers
FOR SELECT
USING (true);

-- Create policy to allow the service role to insert (for edge functions)
CREATE POLICY "Service role can insert scraped numbers"
ON public.scraped_numbers
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_scraped_numbers_phone ON public.scraped_numbers(phone_number);
CREATE INDEX idx_scraped_numbers_operator ON public.scraped_numbers(operator);
CREATE INDEX idx_scraped_numbers_date ON public.scraped_numbers(date);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_scraped_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_scraped_numbers_updated_at
BEFORE UPDATE ON public.scraped_numbers
FOR EACH ROW
EXECUTE FUNCTION public.update_scraped_numbers_updated_at();

-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule scraping job to run every 12 hours
SELECT cron.schedule(
  'scrape-phone-numbers-job',
  '0 */12 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://adktmoxwxcuslwthadvp.supabase.co/functions/v1/scrape-telguarder',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFka3Rtb3h3eGN1c2x3dGhhZHZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQyNzM0OCwiZXhwIjoyMDc3MDAzMzQ4fQ.VJLo6ifSd7a8u0KHgPQHI7RuQDsPgZFn8bYGCJMqRzA"}'::jsonb,
      body:='{"limit": 1000, "offset": 0, "auto_scrape": true}'::jsonb
    ) as request_id;
  $$
);