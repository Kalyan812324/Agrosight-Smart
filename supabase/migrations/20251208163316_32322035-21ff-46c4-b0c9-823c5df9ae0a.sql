-- Fix api_sync_logs public SELECT policy to restrict to admins only
-- Drop the existing public read policy
DROP POLICY IF EXISTS "API sync logs are viewable by everyone" ON public.api_sync_logs;

-- Create admin-only read policy
CREATE POLICY "Sync logs viewable by admins only"
ON public.api_sync_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));