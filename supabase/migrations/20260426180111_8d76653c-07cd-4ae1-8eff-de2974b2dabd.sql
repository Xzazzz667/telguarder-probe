-- 1) Supprimer les doublons existants (phone_number, source) en gardant la ligne la plus ancienne
DELETE FROM public.scraped_numbers a
USING public.scraped_numbers b
WHERE a.phone_number = b.phone_number
  AND a.source = b.source
  AND a.created_at > b.created_at;

-- 2) Supprimer l'ancienne contrainte unique (phone, source, date)
ALTER TABLE public.scraped_numbers
  DROP CONSTRAINT IF EXISTS scraped_numbers_unique_phone_source_date;

-- 3) Ajouter la nouvelle contrainte unique (phone, source) — sans la date
ALTER TABLE public.scraped_numbers
  ADD CONSTRAINT scraped_numbers_unique_phone_source UNIQUE (phone_number, source);