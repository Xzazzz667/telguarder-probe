-- Fix duplicate insert issue by aligning uniqueness with scraper logic
-- 1) Drop existing unique constraint on phone_number only
ALTER TABLE public.scraped_numbers
DROP CONSTRAINT IF EXISTS scraped_numbers_phone_number_key;

-- 2) Add composite uniqueness on phone_number + source + date
ALTER TABLE public.scraped_numbers
ADD CONSTRAINT scraped_numbers_unique_phone_source_date
UNIQUE (phone_number, source, date);

-- (Optional but helpful) Index to speed up recent-per-source operations
CREATE INDEX IF NOT EXISTS idx_scraped_numbers_source_created_at
ON public.scraped_numbers (source, created_at DESC);
