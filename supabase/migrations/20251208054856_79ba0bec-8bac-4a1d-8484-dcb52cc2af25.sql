-- Create API sync logs table for monitoring ETL runs
CREATE TABLE IF NOT EXISTS api_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(50) NOT NULL,
  sync_status VARCHAR(50) NOT NULL,
  records_fetched INT DEFAULT 0,
  records_inserted INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  error_message TEXT,
  sync_start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_end_time TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_api_sync_logs_type ON api_sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_api_sync_logs_status ON api_sync_logs(sync_status);
CREATE INDEX IF NOT EXISTS idx_api_sync_logs_created ON api_sync_logs(created_at DESC);

-- Enable RLS
ALTER TABLE api_sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read access for monitoring
CREATE POLICY "API sync logs are viewable by everyone"
ON api_sync_logs
FOR SELECT
USING (true);

-- Only admins can manage logs
CREATE POLICY "Admins can manage sync logs"
ON api_sync_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));