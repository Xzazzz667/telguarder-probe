-- Fix PUBLIC_DATA_EXPOSURE: Restrict database access to authenticated users only
DROP POLICY IF EXISTS "Anyone can view scraped numbers" ON scraped_numbers;

CREATE POLICY "Authenticated users can view scraped numbers"
ON scraped_numbers FOR SELECT
TO authenticated
USING (true);

-- Keep the existing insert policy for service role
-- Policy "Service role can insert scraped numbers" remains unchanged