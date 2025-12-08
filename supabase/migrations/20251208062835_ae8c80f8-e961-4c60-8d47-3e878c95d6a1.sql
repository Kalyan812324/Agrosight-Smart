-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule daily AGMARKNET sync at 6:00 AM IST (00:30 UTC)
SELECT cron.schedule(
  'daily-agmarknet-sync',
  '30 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xllpedrhhzoljkfvkgef.supabase.co/functions/v1/sync-agmarknet',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbHBlZHJoaHpvbGprZnZrZ2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNDY2ODQsImV4cCI6MjA2OTcyMjY4NH0.y5uFWQdULq1GFDE4jb64iHtW0u8qZghm83YZlaYBqvk"}'::jsonb,
    body := '{"source": "cron", "scheduled": true}'::jsonb
  ) AS request_id;
  $$
);