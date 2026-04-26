ALTER TABLE public.scrape_schedule_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read schedule state" ON public.scrape_schedule_state;
CREATE POLICY "Authenticated can read schedule state"
ON public.scrape_schedule_state
FOR SELECT
TO authenticated
USING (true);