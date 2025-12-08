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
  horizon: number; // 1, 3, 7, 30 days
  ml_api_url?: string; // External ML API endpoint
}

interface HistoricalData {
  date: string;
  modal_price: number;
  min_price: number;
  max_price: number;
  arrivals?: number;
  // Feature columns from mandi_prices
  price_lag_1?: number;
  price_lag_7?: number;
  price_lag_30?: number;
  rolling_mean_7?: number;
  rolling_mean_30?: number;
  momentum_7?: number;
  volatility_30?: number;
}

// Statistical forecasting with ML-ready features
function statisticalForecast(history: HistoricalData[], horizon: number) {
  if (history.length < 7) {
    throw new Error("Insufficient historical data for forecasting");
  }

  const prices = history.map(h => h.modal_price);
  const n = prices.length;
  
  // Calculate statistics
  const mean = prices.reduce((a, b) => a + b, 0) / n;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const std = Math.sqrt(variance);
  
  // Calculate trend using linear regression
  const xMean = (n - 1) / 2;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (prices[i] - mean);
    denominator += Math.pow(i - xMean, 2);
  }
  const slope = denominator !== 0 ? numerator / denominator : 0;
  
  // Calculate seasonality (7-day pattern)
  const seasonality = new Array(7).fill(0);
  const seasonCount = new Array(7).fill(0);
  for (let i = 0; i < n; i++) {
    const dayOfWeek = i % 7;
    seasonality[dayOfWeek] += prices[i] - (mean + slope * (i - xMean));
    seasonCount[dayOfWeek]++;
  }
  for (let i = 0; i < 7; i++) {
    seasonality[i] = seasonCount[i] > 0 ? seasonality[i] / seasonCount[i] : 0;
  }
  
  // Use stored features if available, otherwise calculate
  const lastRecord = history[history.length - 1];
  const momentum = lastRecord.momentum_7 !== undefined 
    ? lastRecord.momentum_7 / 100 
    : (() => {
        const recentPrices = prices.slice(-7);
        const recentMean = recentPrices.reduce((a, b) => a + b, 0) / 7;
        return (recentMean - mean) / mean;
      })();
  
  const volatility = lastRecord.volatility_30 !== undefined
    ? lastRecord.volatility_30 / 100
    : (() => {
        const recentPrices = prices.slice(-7);
        const recentMean = recentPrices.reduce((a, b) => a + b, 0) / 7;
        const recentVariance = recentPrices.reduce((a, b) => a + Math.pow(b - recentMean, 2), 0) / 7;
        return Math.sqrt(recentVariance) / recentMean;
      })();
  
  // Generate forecasts
  const forecasts = [];
  const lastPrice = prices[n - 1];
  
  for (let h = 1; h <= horizon; h++) {
    const trendComponent = slope * h;
    const seasonComponent = seasonality[(n + h - 1) % 7];
    const momentumComponent = momentum * lastPrice * Math.exp(-0.1 * h);
    
    const predictedModal = lastPrice + trendComponent + seasonComponent + momentumComponent;
    const uncertainty = std * Math.sqrt(h) * 1.96; // 95% CI
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + h);
    
    // Min/Max based on historical ratios
    const minRatio = history.reduce((a, b) => a + b.min_price / b.modal_price, 0) / n;
    const maxRatio = history.reduce((a, b) => a + b.max_price / b.modal_price, 0) / n;
    
    forecasts.push({
      target_date: targetDate.toISOString().split('T')[0],
      horizon_days: h,
      predicted_min: Math.round(predictedModal * minRatio),
      predicted_modal: Math.round(predictedModal),
      predicted_max: Math.round(predictedModal * maxRatio),
      confidence_lower: Math.round(predictedModal - uncertainty),
      confidence_upper: Math.round(predictedModal + uncertainty),
      confidence_level: 0.95
    });
  }
  
  // Feature importance for explainability
  const featureImportance = {
    trend: Math.abs(slope * horizon) / (std + 1),
    seasonality: Math.max(...seasonality.map(Math.abs)) / (std + 1),
    momentum: Math.abs(momentum),
    recent_volatility: volatility
  };
  
  // Normalize to percentages
  const total = Object.values(featureImportance).reduce((a, b) => a + b, 0) || 1;
  const normalizedImportance = Object.fromEntries(
    Object.entries(featureImportance).map(([k, v]) => [k, Math.round((v / total) * 100)])
  );
  
  // Generate insights
  const topDrivers = [];
  if (slope > 0) topDrivers.push({ driver: "Upward price trend", impact: "positive", strength: Math.min(Math.abs(slope) * 10, 100) });
  if (slope < 0) topDrivers.push({ driver: "Downward price trend", impact: "negative", strength: Math.min(Math.abs(slope) * 10, 100) });
  if (momentum > 0.02) topDrivers.push({ driver: "Strong recent momentum", impact: "positive", strength: Math.round(momentum * 100) });
  if (momentum < -0.02) topDrivers.push({ driver: "Weak recent momentum", impact: "negative", strength: Math.round(Math.abs(momentum) * 100) });
  if (volatility > 0.1) topDrivers.push({ driver: "High market volatility", impact: "uncertain", strength: Math.round(volatility * 100) });
  
  return {
    forecasts,
    model_used: "Statistical Ensemble (Trend + Seasonality + Momentum)",
    model_version: "1.1.0",
    feature_importance: normalizedImportance,
    top_drivers: topDrivers,
    statistics: {
      historical_mean: Math.round(mean),
      historical_std: Math.round(std),
      trend_per_day: Math.round(slope * 100) / 100,
      momentum_7d: Math.round(momentum * 1000) / 10,
      volatility_7d: Math.round(volatility * 1000) / 10
    }
  };
}

// Generate simulated data as fallback
function generateSimulatedData(commodity: string): HistoricalData[] {
  const basePrice = {
    'Paddy': 2200, 'Rice': 3500, 'Wheat': 2400, 'Cotton': 6500,
    'Maize': 2100, 'Onion': 2500, 'Potato': 1800, 'Tomato': 3000,
    'Soybean': 4500, 'Groundnut': 5500, 'Chilli': 12000, 'Turmeric': 8000,
    'Sugarcane': 350, 'Mustard': 5000, 'Jowar': 2800, 'Bajra': 2300
  }[commodity] || 2500;

  const historicalData: HistoricalData[] = [];
  
  for (let i = 89; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const trend = -i * 0.5;
    const seasonality = Math.sin(i * 2 * Math.PI / 30) * basePrice * 0.05;
    const weeklyPattern = Math.sin(i * 2 * Math.PI / 7) * basePrice * 0.02;
    const noise = (Math.random() - 0.5) * basePrice * 0.08;
    
    const modalPrice = Math.round(basePrice + trend + seasonality + weeklyPattern + noise);
    
    historicalData.push({
      date: date.toISOString().split('T')[0],
      modal_price: modalPrice,
      min_price: Math.round(modalPrice * 0.92),
      max_price: Math.round(modalPrice * 1.08),
      arrivals: Math.round(500 + Math.random() * 1000)
    });
  }
  
  return historicalData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { state, district, market, commodity, variety, horizon = 7, ml_api_url } = await req.json() as ForecastRequest;

    console.log(`Forecast request: ${market}, ${commodity}, horizon=${horizon}`);

    if (!state || !market || !commodity) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: state, market, commodity" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For external ML API, proxy the request
    if (ml_api_url) {
      console.log(`Proxying to external ML API: ${ml_api_url}`);
      try {
        const mlResponse = await fetch(ml_api_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, district, market, commodity, variety, horizon })
        });
        
        if (!mlResponse.ok) {
          throw new Error(`ML API returned ${mlResponse.status}`);
        }
        
        const mlData = await mlResponse.json();
        return new Response(
          JSON.stringify({ success: true, source: 'external_ml', ...mlData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (mlError) {
        console.error('External ML API error, falling back to statistical:', mlError);
      }
    }

    // Try to fetch real data from mandi_prices
    let historicalData: HistoricalData[] = [];
    let dataSource = 'simulated';

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Query mandi_prices for historical data
        let query = supabase
          .from('mandi_prices')
          .select(`
            arrival_date,
            modal_price,
            min_price,
            max_price,
            arrivals_tonnes,
            price_lag_1,
            price_lag_7,
            price_lag_30,
            rolling_mean_7,
            rolling_mean_30,
            momentum_7,
            volatility_30
          `)
          .eq('state', state)
          .eq('commodity', commodity)
          .order('arrival_date', { ascending: true })
          .limit(90);

        // Add market filter if provided
        if (market) {
          query = query.eq('market', market);
        }

        const { data, error } = await query;

        if (!error && data && data.length >= 7) {
          console.log(`Found ${data.length} records in mandi_prices`);
          historicalData = data.map(row => ({
            date: row.arrival_date,
            modal_price: Number(row.modal_price),
            min_price: Number(row.min_price),
            max_price: Number(row.max_price),
            arrivals: row.arrivals_tonnes ? Number(row.arrivals_tonnes) : undefined,
            price_lag_1: row.price_lag_1 ? Number(row.price_lag_1) : undefined,
            price_lag_7: row.price_lag_7 ? Number(row.price_lag_7) : undefined,
            price_lag_30: row.price_lag_30 ? Number(row.price_lag_30) : undefined,
            rolling_mean_7: row.rolling_mean_7 ? Number(row.rolling_mean_7) : undefined,
            rolling_mean_30: row.rolling_mean_30 ? Number(row.rolling_mean_30) : undefined,
            momentum_7: row.momentum_7 ? Number(row.momentum_7) : undefined,
            volatility_30: row.volatility_30 ? Number(row.volatility_30) : undefined,
          }));
          dataSource = 'mandi_prices';
        } else {
          console.log(`Insufficient data in mandi_prices (${data?.length || 0} records), using simulated`);
        }
      }
    } catch (dbError) {
      console.warn('Database query failed, using simulated data:', dbError);
    }

    // Fall back to simulated data if needed
    if (historicalData.length < 7) {
      console.log('Using simulated historical data');
      historicalData = generateSimulatedData(commodity);
      dataSource = 'simulated';
    }

    // Run statistical forecast
    const result = statisticalForecast(historicalData, horizon);

    return new Response(
      JSON.stringify({
        success: true,
        source: dataSource === 'mandi_prices' ? 'mandi_prices_statistical' : 'simulated_statistical',
        data_source: dataSource,
        request: { state, district, market, commodity, variety, horizon },
        historical_summary: {
          days_analyzed: historicalData.length,
          latest_price: historicalData[historicalData.length - 1].modal_price,
          latest_date: historicalData[historicalData.length - 1].date
        },
        ...result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Forecast error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Forecast generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
