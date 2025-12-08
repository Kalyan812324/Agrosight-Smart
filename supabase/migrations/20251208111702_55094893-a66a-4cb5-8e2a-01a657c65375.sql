-- Add RLS policies to market_prices table
-- This table currently has RLS enabled but no policies defined

-- Allow public read access (consistent with mandi_prices)
CREATE POLICY "Market prices are viewable by everyone"
ON public.market_prices FOR SELECT
USING (true);

-- Restrict modifications to admins only
CREATE POLICY "Admins can manage market prices"
ON public.market_prices FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));