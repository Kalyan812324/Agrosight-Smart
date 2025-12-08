-- =====================================================
-- ULTRA SUPER ML FORECASTING SCHEMA
-- =====================================================

-- 1. Clean time-series table at mandi level
CREATE TABLE IF NOT EXISTS public.mandi_timeseries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Location hierarchy
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  market TEXT NOT NULL,
  -- Commodity info
  commodity TEXT NOT NULL,
  variety TEXT,
  grade TEXT,
  -- Date and prices
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
  -- Calendar flags
  is_festival BOOLEAN DEFAULT false,
  is_sowing_season BOOLEAN DEFAULT false,
  is_harvest_season BOOLEAN DEFAULT false,
  week_of_year INTEGER,
  month INTEGER,
  -- MSP and policy
  msp_price NUMERIC,
  policy_event TEXT,
  -- Metadata
  data_source TEXT DEFAULT 'agmarknet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Unique constraint for upserts
  CONSTRAINT mandi_timeseries_unique UNIQUE (state, district, market, commodity, variety, arrival_date)
);

-- 2. Feature store table for precomputed ML features
CREATE TABLE IF NOT EXISTS public.mandi_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Reference to timeseries
  timeseries_id UUID REFERENCES public.mandi_timeseries(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  market TEXT NOT NULL,
  commodity TEXT NOT NULL,
  variety TEXT,
  arrival_date DATE NOT NULL,
  -- Lagged prices
  price_lag_1 NUMERIC,
  price_lag_7 NUMERIC,
  price_lag_30 NUMERIC,
  arrivals_lag_1 NUMERIC,
  arrivals_lag_7 NUMERIC,
  -- Rolling statistics
  rolling_mean_7 NUMERIC,
  rolling_mean_30 NUMERIC,
  rolling_mean_90 NUMERIC,
  rolling_std_7 NUMERIC,
  rolling_std_30 NUMERIC,
  rolling_std_90 NUMERIC,
  -- Momentum and volatility
  momentum_7 NUMERIC,  -- today - 7day mean
  momentum_30 NUMERIC,
  volatility_7 NUMERIC,  -- std / mean
  volatility_30 NUMERIC,
  -- Cross-market features
  state_modal_price NUMERIC,
  national_modal_price NUMERIC,
  msp_gap NUMERIC,  -- price - MSP
  msp_gap_pct NUMERIC,
  neighbor_avg_price NUMERIC,
  -- Demand-supply proxies
  arrivals_deviation NUMERIC,  -- deviation from historical weekly avg
  arrivals_zscore NUMERIC,
  cumulative_rainfall_7 NUMERIC,
  cumulative_rainfall_30 NUMERIC,
  -- Calendar features
  day_of_week INTEGER,
  week_of_year INTEGER,
  month INTEGER,
  quarter INTEGER,
  is_weekend BOOLEAN,
  is_month_start BOOLEAN,
  is_month_end BOOLEAN,
  is_festival BOOLEAN,
  is_sowing BOOLEAN,
  is_harvest BOOLEAN,
  -- Interaction features
  rainfall_x_crop NUMERIC,
  arrivals_x_msp_gap NUMERIC,
  volatility_x_arrivals NUMERIC,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mandi_features_unique UNIQUE (state, district, market, commodity, variety, arrival_date)
);

-- 3. Model predictions and tracking
CREATE TABLE IF NOT EXISTS public.ml_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Location and commodity
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  market TEXT NOT NULL,
  commodity TEXT NOT NULL,
  variety TEXT,
  -- Prediction details
  prediction_date DATE NOT NULL,  -- when prediction was made
  target_date DATE NOT NULL,  -- what date we're predicting for
  horizon_days INTEGER NOT NULL,  -- 1, 3, 7, 30
  -- Predictions from each model
  arima_prediction NUMERIC,
  xgboost_prediction NUMERIC,
  lstm_prediction NUMERIC,
  ensemble_prediction NUMERIC NOT NULL,
  -- Confidence intervals
  confidence_lower NUMERIC,
  confidence_upper NUMERIC,
  confidence_level NUMERIC DEFAULT 0.95,
  -- Feature importance and drivers
  feature_importance JSONB,
  top_drivers JSONB,
  -- Model metadata
  model_version TEXT,
  model_weights JSONB,  -- weights for ensemble
  -- Actual value (filled after target_date passes)
  actual_price NUMERIC,
  absolute_error NUMERIC,
  percentage_error NUMERIC,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Model performance tracking
CREATE TABLE IF NOT EXISTS public.ml_model_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Model info
  model_name TEXT NOT NULL,  -- arima, xgboost, lstm, ensemble
  model_version TEXT NOT NULL,
  -- Scope
  commodity TEXT,
  market TEXT,
  horizon_days INTEGER,
  -- Performance metrics
  mae NUMERIC,
  rmse NUMERIC,
  mape NUMERIC,
  r2_score NUMERIC,
  -- Period info
  evaluation_start DATE,
  evaluation_end DATE,
  sample_size INTEGER,
  -- Volatility regime performance
  normal_period_mae NUMERIC,
  high_volatility_mae NUMERIC,
  -- Metadata
  trained_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  hyperparameters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Retraining logs
CREATE TABLE IF NOT EXISTS public.ml_retraining_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Training info
  training_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  training_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',  -- running, completed, failed
  -- Scope
  commodities_trained JSONB,
  markets_trained JSONB,
  -- Results
  models_updated INTEGER DEFAULT 0,
  best_model_selected JSONB,
  performance_improvement JSONB,
  -- Errors
  error_message TEXT,
  error_details JSONB,
  -- Metadata
  triggered_by TEXT,  -- cron, manual, alert
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Alert thresholds and monitoring
CREATE TABLE IF NOT EXISTS public.ml_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Alert info
  alert_type TEXT NOT NULL,  -- accuracy_degradation, data_quality, model_drift
  severity TEXT NOT NULL DEFAULT 'warning',  -- info, warning, critical
  -- Context
  commodity TEXT,
  market TEXT,
  model_name TEXT,
  -- Details
  message TEXT NOT NULL,
  metric_name TEXT,
  metric_value NUMERIC,
  threshold_value NUMERIC,
  -- Status
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mandi_timeseries_lookup ON public.mandi_timeseries(state, district, market, commodity, arrival_date);
CREATE INDEX IF NOT EXISTS idx_mandi_timeseries_date ON public.mandi_timeseries(arrival_date DESC);
CREATE INDEX IF NOT EXISTS idx_mandi_features_lookup ON public.mandi_features(state, district, market, commodity, arrival_date);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_lookup ON public.ml_predictions(market, commodity, target_date);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_accuracy ON public.ml_predictions(prediction_date, target_date) WHERE actual_price IS NOT NULL;

-- Enable RLS
ALTER TABLE public.mandi_timeseries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_retraining_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - public read access
CREATE POLICY "Timeseries data is viewable by everyone" ON public.mandi_timeseries FOR SELECT USING (true);
CREATE POLICY "Features are viewable by everyone" ON public.mandi_features FOR SELECT USING (true);
CREATE POLICY "Predictions are viewable by everyone" ON public.ml_predictions FOR SELECT USING (true);
CREATE POLICY "Model performance is viewable by everyone" ON public.ml_model_performance FOR SELECT USING (true);
CREATE POLICY "Retraining logs viewable by admins" ON public.ml_retraining_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Alerts viewable by admins" ON public.ml_alerts FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin write policies
CREATE POLICY "Admins can manage timeseries" ON public.mandi_timeseries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage features" ON public.mandi_features FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage predictions" ON public.ml_predictions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage model performance" ON public.ml_model_performance FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage retraining logs" ON public.ml_retraining_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage alerts" ON public.ml_alerts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_mandi_timeseries_updated_at
  BEFORE UPDATE ON public.mandi_timeseries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();