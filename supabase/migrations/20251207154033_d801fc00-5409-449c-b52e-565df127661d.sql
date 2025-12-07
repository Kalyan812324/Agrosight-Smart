-- Create enhanced market prices table with proper schema for ML forecasting
CREATE TABLE IF NOT EXISTS public.mandi_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  market TEXT NOT NULL,
  commodity TEXT NOT NULL,
  variety TEXT,
  grade TEXT,
  arrival_date DATE NOT NULL,
  min_price NUMERIC NOT NULL,
  max_price NUMERIC NOT NULL,
  modal_price NUMERIC NOT NULL,
  arrivals_tonnes NUMERIC,
  
  -- Weather enrichment
  rainfall_mm NUMERIC,
  temp_max NUMERIC,
  temp_min NUMERIC,
  humidity NUMERIC,
  
  -- Calendar and policy flags
  is_festival BOOLEAN DEFAULT FALSE,
  is_harvest_season BOOLEAN DEFAULT FALSE,
  is_sowing_season BOOLEAN DEFAULT FALSE,
  msp_price NUMERIC,
  policy_event TEXT,
  
  -- Computed features (updated by background job)
  price_lag_1 NUMERIC,
  price_lag_7 NUMERIC,
  price_lag_30 NUMERIC,
  rolling_mean_7 NUMERIC,
  rolling_mean_30 NUMERIC,
  rolling_std_7 NUMERIC,
  momentum_7 NUMERIC,
  volatility_30 NUMERIC,
  msp_gap NUMERIC,
  arrivals_deviation NUMERIC,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(state, district, market, commodity, variety, grade, arrival_date)
);

-- Create index for fast queries
CREATE INDEX idx_mandi_prices_lookup ON public.mandi_prices(state, district, market, commodity, arrival_date);
CREATE INDEX idx_mandi_prices_commodity_date ON public.mandi_prices(commodity, arrival_date DESC);
CREATE INDEX idx_mandi_prices_market ON public.mandi_prices(market, arrival_date DESC);

-- Create forecasts table to store ML predictions
CREATE TABLE IF NOT EXISTS public.price_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  market TEXT NOT NULL,
  commodity TEXT NOT NULL,
  variety TEXT,
  
  forecast_date DATE NOT NULL,
  target_date DATE NOT NULL,
  horizon_days INTEGER NOT NULL,
  
  predicted_min NUMERIC NOT NULL,
  predicted_modal NUMERIC NOT NULL,
  predicted_max NUMERIC NOT NULL,
  confidence_lower NUMERIC,
  confidence_upper NUMERIC,
  confidence_level NUMERIC DEFAULT 0.95,
  
  -- Model metadata
  model_used TEXT NOT NULL,
  model_version TEXT,
  feature_importance JSONB,
  top_drivers JSONB,
  
  -- Accuracy tracking
  actual_modal NUMERIC,
  absolute_error NUMERIC,
  percentage_error NUMERIC,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(state, district, market, commodity, variety, forecast_date, target_date)
);

CREATE INDEX idx_forecasts_lookup ON public.price_forecasts(market, commodity, forecast_date);
CREATE INDEX idx_forecasts_accuracy ON public.price_forecasts(commodity, horizon_days) WHERE actual_modal IS NOT NULL;

-- Enable RLS
ALTER TABLE public.mandi_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_forecasts ENABLE ROW LEVEL SECURITY;

-- Public read access for market data (everyone can view)
CREATE POLICY "Market prices are viewable by everyone" 
ON public.mandi_prices FOR SELECT USING (true);

CREATE POLICY "Forecasts are viewable by everyone" 
ON public.price_forecasts FOR SELECT USING (true);

-- Only admins can insert/update market data
CREATE POLICY "Admins can manage market prices" 
ON public.mandi_prices FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage forecasts" 
ON public.price_forecasts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_mandi_prices_updated_at
BEFORE UPDATE ON public.mandi_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();