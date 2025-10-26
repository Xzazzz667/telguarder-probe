-- Fix function search path security issue
DROP TRIGGER IF EXISTS update_scraped_numbers_updated_at ON public.scraped_numbers;
DROP FUNCTION IF EXISTS public.update_scraped_numbers_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_scraped_numbers_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_scraped_numbers_updated_at
BEFORE UPDATE ON public.scraped_numbers
FOR EACH ROW
EXECUTE FUNCTION public.update_scraped_numbers_updated_at();