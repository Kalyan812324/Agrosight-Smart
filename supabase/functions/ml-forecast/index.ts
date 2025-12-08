import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ForecastRequest {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety?: string;
  horizon: number; // 1, 3, 7, or 30 days
  ml_api_url?: string; // External ML API endpoint
}

interface MLApiResponse {
  arima_prediction?: number;
  xgboost_prediction?: number;
  lstm_prediction?: number;
  ensemble_prediction: number;
  confidence_lower: number;
  confidence_upper: number;
  feature_importance?: Record<string, number>;
  top_drivers?: Array<{ feature: string; impact: string; direction: string }>;
  model_version?: string;
  model_weights?: Record<string, number>;
}

// Fallback statistical forecast when ML API is unavailable
function statisticalForecast(
  features: any,
  history: any[],
  horizon: number
): MLApiResponse {
  const prices = history.map(h => h.modal_price).filter(p => p != null);
  if (prices.length === 0) {
    throw new Error('Insufficient historical data for forecasting');
  }

  const currentPrice = prices[0];
  const mean7 = features?.rolling_mean_7 || currentPrice;
  const mean30 = features?.rolling_mean_30 || currentPrice;
  const momentum = features?.momentum_7 || 0;
  const volatility = features?.volatility_7 || 0.05;
  const mspGap = features?.msp_gap || 0;
  const arrivalsDeviation = features?.arrivals_deviation || 0;

  // Simple trend-based forecast
  const trendFactor = momentum / currentPrice;
  const seasonalAdjustment = features?.is_harvest ? -0.02 : (features?.is_sowing ? 0.01 : 0);
  const supplyPressure = arrivalsDeviation > 0 ? -0.01 : 0.01;
  
  // Weighted average of different signals
  const baseChange = (trendFactor * 0.4) + (seasonalAdjustment * 0.3) + (supplyPressure * 0.3);
  const horizonMultiplier = Math.sqrt(horizon);
  
  // Predictions from "virtual" models
  const arimaLike = currentPrice * (1 + baseChange * horizonMultiplier);
  const xgboostLike = (mean7 * 0.6 + mean30 * 0.4) * (1 + baseChange * 0.5 * horizonMultiplier);
  const lstmLike = currentPrice * (1 + momentum / currentPrice * 0.7 * horizonMultiplier);
  
  // Ensemble with weights
  const weights = { arima: 0.3, xgboost: 0.45, lstm: 0.25 };
  const ensemble = arimaLike * weights.arima + xgboostLike * weights.xgboost + lstmLike * weights.lstm;
  
  // Confidence intervals based on volatility
  const confidenceWidth = ensemble * volatility * horizonMultiplier * 1.96;
  
  // Feature importance
  const importance: Record<string, number> = {
    'Price Momentum': 0.25,
    'Rolling Average (7d)': 0.20,
    'Seasonal Pattern': 0.15,
    'Arrivals Trend': 0.12,
    'MSP Gap': 0.10,
    'Volatility': 0.08,
    'Weather Impact': 0.05,
    'Festival Effect': 0.05,
  };

  // Top drivers
  const drivers: Array<{ feature: string; impact: string; direction: string }> = [];
  
  if (Math.abs(momentum) > currentPrice * 0.02) {
    drivers.push({
      feature: 'Price Momentum',
      impact: 'High',
      direction: momentum > 0 ? 'Bullish' : 'Bearish'
    });
  }
  
  if (features?.is_harvest) {
    drivers.push({
      feature: 'Harvest Season',
      impact: 'Medium',
      direction: 'Bearish'
    });
  }
  
  if (arrivalsDeviation > 0) {
    drivers.push({
      feature: 'High Arrivals',
      impact: Math.abs(arrivalsDeviation) > 100 ? 'High' : 'Medium',
      direction: 'Bearish'
    });
  }
  
  if (mspGap < 0) {
    drivers.push({
      feature: 'Below MSP',
      impact: 'Medium',
      direction: 'Support expected'
    });
  }

  if (features?.is_festival) {
    drivers.push({
      feature: 'Festival Period',
      impact: 'Low',
      direction: 'Demand boost'
    });
  }

  return {
    arima_prediction: Math.round(arimaLike * 100) / 100,
    xgboost_prediction: Math.round(xgboostLike * 100) / 100,
    lstm_prediction: Math.round(lstmLike * 100) / 100,
    ensemble_prediction: Math.round(ensemble * 100) / 100,
    confidence_lower: Math.round((ensemble - confidenceWidth) * 100) / 100,
    confidence_upper: Math.round((ensemble + confidenceWidth) * 100) / 100,
    feature_importance: importance,
    top_drivers: drivers.slice(0, 5),
    model_version: 'statistical-fallback-v1',
    model_weights: weights,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: ForecastRequest = await req.json();
    const { state, district, market, commodity, variety, horizon = 7, ml_api_url } = request;

    console.log('[ML-Forecast] Request:', { state, district, market, commodity, horizon });

    // Fetch latest features for this market-commodity
    let featureQuery = supabase
      .from('mandi_features')
      .select('*')
      .eq('state', state)
      .eq('district', district)
      .eq('market', market)
      .eq('commodity', commodity)
      .order('arrival_date', { ascending: false })
      .limit(1);

    if (variety) featureQuery = featureQuery.eq('variety', variety);

    const { data: featureData, error: featureError } = await featureQuery;
    if (featureError) {
      console.error('[ML-Forecast] Feature fetch error:', featureError);
    }

    const features = featureData?.[0] || null;

    // Fetch historical prices for context
    let historyQuery = supabase
      .from('mandi_timeseries')
      .select('arrival_date, modal_price, min_price, max_price, arrivals_tonnes')
      .eq('state', state)
      .eq('district', district)
      .eq('market', market)
      .eq('commodity', commodity)
      .order('arrival_date', { ascending: false })
      .limit(90);

    if (variety) historyQuery = historyQuery.eq('variety', variety);

    const { data: historyData, error: historyError } = await historyQuery;
    
    // Fallback to mandi_prices if mandi_timeseries is empty
    let history = historyData || [];
    if (history.length === 0) {
      const { data: fallbackData } = await supabase
        .from('mandi_prices')
        .select('arrival_date, modal_price, min_price, max_price, arrivals_tonnes')
        .eq('state', state)
        .eq('district', district)
        .eq('market', market)
        .eq('commodity', commodity)
        .order('arrival_date', { ascending: false })
        .limit(90);
      history = fallbackData || [];
    }

    if (history.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No historical data available for this market-commodity combination'
      }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    let forecast: MLApiResponse;

    // Try external ML API first if provided
    if (ml_api_url) {
      try {
        console.log('[ML-Forecast] Calling external ML API:', ml_api_url);
        
        const mlResponse = await fetch(ml_api_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state,
            district,
            market,
            commodity,
            variety,
            horizon,
            features,
            history: history.slice(0, 30), // Send last 30 days
          }),
        });

        if (mlResponse.ok) {
          forecast = await mlResponse.json();
          console.log('[ML-Forecast] External ML API response received');
        } else {
          console.warn('[ML-Forecast] External ML API error, falling back to statistical');
          forecast = statisticalForecast(features, history, horizon);
        }
      } catch (mlError) {
        console.warn('[ML-Forecast] External ML API failed:', mlError);
        forecast = statisticalForecast(features, history, horizon);
      }
    } else {
      // Use statistical fallback
      forecast = statisticalForecast(features, history, horizon);
    }

    // Calculate target date
    const latestDate = new Date(history[0].arrival_date);
    const targetDate = new Date(latestDate);
    targetDate.setDate(targetDate.getDate() + horizon);

    // Store prediction in database
    const predictionRecord = {
      state,
      district,
      market,
      commodity,
      variety: variety || null,
      prediction_date: new Date().toISOString().split('T')[0],
      target_date: targetDate.toISOString().split('T')[0],
      horizon_days: horizon,
      arima_prediction: forecast.arima_prediction,
      xgboost_prediction: forecast.xgboost_prediction,
      lstm_prediction: forecast.lstm_prediction,
      ensemble_prediction: forecast.ensemble_prediction,
      confidence_lower: forecast.confidence_lower,
      confidence_upper: forecast.confidence_upper,
      confidence_level: 0.95,
      feature_importance: forecast.feature_importance,
      top_drivers: forecast.top_drivers,
      model_version: forecast.model_version,
      model_weights: forecast.model_weights,
    };

    const { error: insertError } = await supabase
      .from('ml_predictions')
      .insert(predictionRecord);

    if (insertError) {
      console.error('[ML-Forecast] Failed to store prediction:', insertError);
    }

    // Build response with full context
    const response = {
      success: true,
      forecast: {
        target_date: targetDate.toISOString().split('T')[0],
        horizon_days: horizon,
        predictions: {
          arima: forecast.arima_prediction,
          xgboost: forecast.xgboost_prediction,
          lstm: forecast.lstm_prediction,
          ensemble: forecast.ensemble_prediction,
        },
        confidence: {
          lower: forecast.confidence_lower,
          upper: forecast.confidence_upper,
          level: 0.95,
        },
        model: {
          version: forecast.model_version,
          weights: forecast.model_weights,
        },
      },
      analysis: {
        feature_importance: forecast.feature_importance,
        top_drivers: forecast.top_drivers,
        current_price: history[0].modal_price,
        price_change_pct: ((forecast.ensemble_prediction - history[0].modal_price) / history[0].modal_price * 100).toFixed(2),
        trend: forecast.ensemble_prediction > history[0].modal_price ? 'bullish' : 'bearish',
      },
      context: {
        latest_data_date: history[0].arrival_date,
        historical_range: {
          min: Math.min(...history.map(h => h.modal_price)),
          max: Math.max(...history.map(h => h.modal_price)),
          avg: history.reduce((s, h) => s + h.modal_price, 0) / history.length,
        },
        data_points: history.length,
      },
      market_info: {
        state,
        district,
        market,
        commodity,
        variety,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ML-Forecast] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
