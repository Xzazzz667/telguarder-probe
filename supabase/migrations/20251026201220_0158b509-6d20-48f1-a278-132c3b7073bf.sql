-- Création du cron job pour qu'il s'exécute toutes les 4 heures
SELECT cron.schedule(
  'scrape-telguarder-auto',
  '0 */4 * * *', -- Toutes les 4 heures
  $$
  SELECT net.http_post(
    url := 'https://adktmoxwxcuslwthadvp.supabase.co/functions/v1/scrape-telguarder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFka3Rtb3h3eGN1c2x3dGhhZHZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQyNzM0OCwiZXhwIjoyMDc3MDAzMzQ4fQ.gCNnCkiW5d_RVDGVBqTyRbO3YQA-h4KpmwGNO3K0z8M'
    ),
    body := jsonb_build_object(
      'auto_scrape', true
    )
  ) as request_id;
  $$
);