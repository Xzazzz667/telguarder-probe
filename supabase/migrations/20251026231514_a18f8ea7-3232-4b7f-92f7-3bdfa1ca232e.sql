-- Enable extensions pour le cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Créer un job cron qui s'exécute tous les jours à 9h00 (heure serveur UTC)
-- 9h UTC = 10h en France (heure d'hiver) ou 11h (heure d'été)
SELECT cron.schedule(
  'auto-scrape-daily',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://adktmoxwxcuslwthadvp.supabase.co/functions/v1/scrape-telguarder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFka3Rtb3h3eGN1c2x3dGhhZHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MjczNDgsImV4cCI6MjA3NzAwMzM0OH0.qJBd3Obelkp_DteXxAculZSqT2etvrdU5ftt1mD3IKU"}'::jsonb,
        body:='{"auto_scrape": true, "limit": 1000}'::jsonb
    ) as request_id;
  $$
);