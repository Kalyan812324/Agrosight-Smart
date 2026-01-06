import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting (in-memory, per-request)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // 20 requests per minute
const RATE_WINDOW_MS = 60000;

function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIP);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

// SSRF Protection: Validate external URLs
function isValidExternalUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    
    // Only allow HTTPS
    if (url.protocol !== 'https:') {
      return { valid: false, error: 'ML API URL must use HTTPS' };
    }
    
    const hostname = url.hostname.toLowerCase();
    
    // Block localhost and loopback
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname === '::1') {
      return { valid: false, error: 'Cannot access localhost' };
    }
    
    // Block private IP ranges
    if (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
      hostname === '169.254.169.254' || // AWS/GCP metadata
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return { valid: false, error: 'Cannot access internal/private networks' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

interface ForecastRequest {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety?: string;
  horizon: number;
  ml_api_url?: string;
}

interface HistoricalData {
  date: string;
  modal_price: number;
  min_price: number;
  max_price: number;
  arrivals?: number;
  price_lag_1?: number;
  price_lag_7?: number;
  price_lag_30?: number;
  rolling_mean_7?: number;
  rolling_mean_30?: number;
  momentum_7?: number;
  volatility_30?: number;
}

// Seeded random number generator for deterministic results
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Hash string to number for seeding
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Commodity base prices (₹/quintal) - realistic MSP-aligned values
const COMMODITY_CONFIG: Record<string, { basePrice: number; minRatio: number; maxRatio: number; volatility: number; seasonalStrength: number }> = {
  'Paddy': { basePrice: 2203, minRatio: 0.92, maxRatio: 1.08, volatility: 0.03, seasonalStrength: 0.04 },
  'Rice': { basePrice: 3550, minRatio: 0.93, maxRatio: 1.07, volatility: 0.025, seasonalStrength: 0.03 },
  'Wheat': { basePrice: 2275, minRatio: 0.94, maxRatio: 1.06, volatility: 0.02, seasonalStrength: 0.035 },
  'Cotton': { basePrice: 6620, minRatio: 0.90, maxRatio: 1.10, volatility: 0.05, seasonalStrength: 0.06 },
  'Maize': { basePrice: 2090, minRatio: 0.91, maxRatio: 1.09, volatility: 0.04, seasonalStrength: 0.05 },
  'Onion': { basePrice: 2800, minRatio: 0.75, maxRatio: 1.25, volatility: 0.12, seasonalStrength: 0.15 },
  'Potato': { basePrice: 1800, minRatio: 0.80, maxRatio: 1.20, volatility: 0.08, seasonalStrength: 0.10 },
  'Tomato': { basePrice: 3200, minRatio: 0.70, maxRatio: 1.30, volatility: 0.15, seasonalStrength: 0.18 },
  'Soybean': { basePrice: 4600, minRatio: 0.92, maxRatio: 1.08, volatility: 0.035, seasonalStrength: 0.04 },
  'Groundnut': { basePrice: 5850, minRatio: 0.91, maxRatio: 1.09, volatility: 0.04, seasonalStrength: 0.05 },
  'Chilli': { basePrice: 13000, minRatio: 0.85, maxRatio: 1.15, volatility: 0.08, seasonalStrength: 0.10 },
  'Turmeric': { basePrice: 9500, minRatio: 0.88, maxRatio: 1.12, volatility: 0.06, seasonalStrength: 0.07 },
  'Sugarcane': { basePrice: 315, minRatio: 0.95, maxRatio: 1.05, volatility: 0.015, seasonalStrength: 0.02 },
  'Mustard': { basePrice: 5650, minRatio: 0.92, maxRatio: 1.08, volatility: 0.035, seasonalStrength: 0.04 },
  'Jowar': { basePrice: 3180, minRatio: 0.91, maxRatio: 1.09, volatility: 0.04, seasonalStrength: 0.05 },
  'Bajra': { basePrice: 2500, minRatio: 0.90, maxRatio: 1.10, volatility: 0.045, seasonalStrength: 0.055 }
};

// Generate deterministic simulated data based on market/commodity combination
function generateDeterministicData(state: string, market: string, commodity: string): HistoricalData[] {
  const config = COMMODITY_CONFIG[commodity] || { 
    basePrice: 2500, minRatio: 0.90, maxRatio: 1.10, volatility: 0.05, seasonalStrength: 0.05 
  };
  
  // Create deterministic seed from market+commodity+state
  const seedString = `${state}-${market}-${commodity}`;
  const seed = hashString(seedString);
  const rng = seededRandom(seed);
  
  const historicalData: HistoricalData[] = [];
  const today = new Date();
  
  // Regional price modifier based on state (±5%)
  const stateModifier = 1 + (hashString(state) % 11 - 5) / 100;
  const adjustedBase = Math.round(config.basePrice * stateModifier);
  
  // Generate 90 days of deterministic historical data
  let previousPrice = adjustedBase;
  
  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const dayOfWeek = date.getDay();
    
    // Seasonal component (annual cycle) - deterministic
    const annualPhase = (dayOfYear / 365) * 2 * Math.PI;
    const seasonalComponent = Math.sin(annualPhase) * adjustedBase * config.seasonalStrength;
    
    // Weekly pattern (higher on weekends when arrivals are lower)
    const weeklyComponent = (dayOfWeek === 0 || dayOfWeek === 6) ? adjustedBase * 0.01 : -adjustedBase * 0.005;
    
    // Mean reversion with controlled noise
    const noiseComponent = (rng() - 0.5) * adjustedBase * config.volatility;
    const meanReversionStrength = 0.15;
    const meanReversion = (adjustedBase - previousPrice) * meanReversionStrength;
    
    // Slight upward trend (1-2% monthly)
    const trendComponent = (90 - i) * (adjustedBase * 0.0002);
    
    // Calculate modal price with all components
    const modalPrice = Math.round(
      previousPrice + 
      seasonalComponent * 0.1 + 
      weeklyComponent + 
      noiseComponent + 
      meanReversion + 
      trendComponent
    );
    
    // Min/max based on fixed ratios
    const minPrice = Math.round(modalPrice * config.minRatio);
    const maxPrice = Math.round(modalPrice * config.maxRatio);
    
    // Arrivals (tonnes) - deterministic based on day
    const baseArrivals = 500 + (hashString(`${seedString}-${i}`) % 500);
    const arrivals = Math.round(baseArrivals * (dayOfWeek === 0 ? 0.6 : dayOfWeek === 6 ? 0.8 : 1.0));
    
    historicalData.push({
      date: date.toISOString().split('T')[0],
      modal_price: modalPrice,
      min_price: minPrice,
      max_price: maxPrice,
      arrivals: arrivals
    });
    
    previousPrice = modalPrice;
  }
  
  return historicalData;
}

// Precise statistical forecasting
function statisticalForecast(history: HistoricalData[], horizon: number, commodity: string) {
  if (history.length < 7) {
    throw new Error("Insufficient historical data for forecasting (minimum 7 days required)");
  }

  const config = COMMODITY_CONFIG[commodity] || { 
    basePrice: 2500, minRatio: 0.90, maxRatio: 1.10, volatility: 0.05, seasonalStrength: 0.05 
  };
  
  const prices = history.map(h => h.modal_price);
  const n = prices.length;
  
  // Calculate precise statistics
  const mean = prices.reduce((a, b) => a + b, 0) / n;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1); // Sample variance
  const std = Math.sqrt(variance);
  const coefficientOfVariation = std / mean;
  
  // Linear regression for trend (OLS)
  const xMean = (n - 1) / 2;
  let sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumXY += (i - xMean) * (prices[i] - mean);
    sumXX += Math.pow(i - xMean, 2);
  }
  const slope = sumXX !== 0 ? sumXY / sumXX : 0;
  const intercept = mean - slope * xMean;
  
  // R-squared for trend significance
  const ssRes = prices.reduce((sum, p, i) => sum + Math.pow(p - (intercept + slope * i), 2), 0);
  const ssTot = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0);
  const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  
  // Calculate 7-day seasonality pattern
  const seasonality = new Array(7).fill(0);
  const seasonCount = new Array(7).fill(0);
  for (let i = 0; i < n; i++) {
    const dayOfWeek = i % 7;
    const detrended = prices[i] - (intercept + slope * i);
    seasonality[dayOfWeek] += detrended;
    seasonCount[dayOfWeek]++;
  }
  for (let i = 0; i < 7; i++) {
    seasonality[i] = seasonCount[i] > 0 ? seasonality[i] / seasonCount[i] : 0;
  }
  
  // Recent momentum (7-day)
  const recent7 = prices.slice(-7);
  const recent7Mean = recent7.reduce((a, b) => a + b, 0) / 7;
  const older7 = prices.slice(-14, -7);
  const older7Mean = older7.length >= 7 ? older7.reduce((a, b) => a + b, 0) / 7 : mean;
  const momentum = (recent7Mean - older7Mean) / older7Mean;
  
  // Recent volatility (7-day)
  const recent7Variance = recent7.reduce((sum, p) => sum + Math.pow(p - recent7Mean, 2), 0) / 6;
  const recentVolatility = Math.sqrt(recent7Variance) / recent7Mean;
  
  // Generate forecasts
  const forecasts = [];
  const lastPrice = prices[n - 1];
  const lastDate = new Date(history[n - 1].date);
  
  for (let h = 1; h <= horizon; h++) {
    // Trend component (extrapolate linear regression)
    const trendValue = slope * h;
    
    // Seasonal component (based on target day of week)
    const targetDate = new Date(lastDate);
    targetDate.setDate(targetDate.getDate() + h);
    const targetDayOfWeek = (n + h - 1) % 7;
    const seasonalValue = seasonality[targetDayOfWeek];
    
    // Momentum component (decaying influence)
    const momentumDecay = Math.exp(-0.2 * h); // Faster decay
    const momentumValue = momentum * lastPrice * momentumDecay;
    
    // Predicted modal price
    const predictedModal = Math.round(lastPrice + trendValue + seasonalValue * 0.5 + momentumValue);
    
    // Confidence intervals using prediction error
    // SE of prediction increases with sqrt(h)
    const predictionSE = std * Math.sqrt(1 + 1/n + Math.pow(h, 2) / sumXX);
    const criticalValue = 1.96; // 95% CI
    const uncertainty = predictionSE * criticalValue * Math.sqrt(h);
    
    // Min/Max based on commodity-specific ratios
    const predictedMin = Math.round(predictedModal * config.minRatio);
    const predictedMax = Math.round(predictedModal * config.maxRatio);
    
    forecasts.push({
      target_date: targetDate.toISOString().split('T')[0],
      horizon_days: h,
      predicted_min: predictedMin,
      predicted_modal: predictedModal,
      predicted_max: predictedMax,
      confidence_lower: Math.round(Math.max(predictedMin * 0.95, predictedModal - uncertainty)),
      confidence_upper: Math.round(Math.min(predictedMax * 1.05, predictedModal + uncertainty)),
      confidence_level: 0.95
    });
  }
  
  // Feature importance (normalized to 100%)
  const trendImpact = Math.abs(slope * horizon);
  const seasonalImpact = Math.max(...seasonality.map(Math.abs));
  const momentumImpact = Math.abs(momentum * lastPrice);
  const volatilityImpact = recentVolatility * lastPrice;
  
  const totalImpact = trendImpact + seasonalImpact + momentumImpact + volatilityImpact + 0.001;
  const featureImportance = {
    trend: Math.round((trendImpact / totalImpact) * 100),
    seasonality: Math.round((seasonalImpact / totalImpact) * 100),
    momentum: Math.round((momentumImpact / totalImpact) * 100),
    recent_volatility: Math.round((volatilityImpact / totalImpact) * 100)
  };
  
  // Ensure percentages sum to 100
  const sumPercent = Object.values(featureImportance).reduce((a, b) => a + b, 0);
  if (sumPercent !== 100) {
    featureImportance.trend += (100 - sumPercent);
  }
  
  // Generate insights/drivers
  const topDrivers = [];
  
  if (rSquared > 0.1 && slope > 0) {
    topDrivers.push({ 
      driver: "Upward price trend", 
      impact: "positive", 
      strength: Math.round(Math.min(rSquared * 100, 95))
    });
  } else if (rSquared > 0.1 && slope < 0) {
    topDrivers.push({ 
      driver: "Downward price trend", 
      impact: "negative", 
      strength: Math.round(Math.min(rSquared * 100, 95))
    });
  }
  
  if (momentum > 0.01) {
    topDrivers.push({ 
      driver: "Positive 7-day momentum", 
      impact: "positive", 
      strength: Math.round(Math.min(Math.abs(momentum) * 500, 80))
    });
  } else if (momentum < -0.01) {
    topDrivers.push({ 
      driver: "Negative 7-day momentum", 
      impact: "negative", 
      strength: Math.round(Math.min(Math.abs(momentum) * 500, 80))
    });
  }
  
  if (recentVolatility > config.volatility * 1.5) {
    topDrivers.push({ 
      driver: "High market volatility", 
      impact: "uncertain", 
      strength: Math.round(Math.min(recentVolatility * 300, 70))
    });
  }
  
  const maxSeasonalEffect = Math.max(...seasonality.map(Math.abs));
  if (maxSeasonalEffect > mean * 0.02) {
    topDrivers.push({
      driver: "Weekly seasonal pattern",
      impact: seasonality[(n % 7)] > 0 ? "positive" : "negative",
      strength: Math.round(Math.min((maxSeasonalEffect / mean) * 500, 60))
    });
  }
  
  return {
    forecasts,
    model_used: "Statistical Ensemble (OLS Trend + Seasonal Decomposition + Momentum)",
    model_version: "2.0.0",
    feature_importance: featureImportance,
    top_drivers: topDrivers.slice(0, 4), // Top 4 drivers
    statistics: {
      historical_mean: Math.round(mean),
      historical_std: Math.round(std),
      trend_per_day: Math.round(slope * 100) / 100,
      trend_r_squared: Math.round(rSquared * 100) / 100,
      momentum_7d: Math.round(momentum * 1000) / 10,
      volatility_7d: Math.round(recentVolatility * 1000) / 10,
      coefficient_of_variation: Math.round(coefficientOfVariation * 1000) / 10
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as ForecastRequest;
    const { state, district, market, commodity, variety, horizon = 7, ml_api_url } = body;

    console.log(`Forecast request from user ${claimsData.user.id}: state=${state}, market=${market}, commodity=${commodity}, horizon=${horizon}`);

    // Input validation
    if (!state || !market || !commodity) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: state, market, commodity" 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (horizon < 1 || horizon > 30) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Horizon must be between 1 and 30 days" 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try external ML API first if provided - with SSRF protection
    if (ml_api_url) {
      // Validate URL to prevent SSRF attacks
      const urlValidation = isValidExternalUrl(ml_api_url);
      if (!urlValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: urlValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Attempting external ML API: ${ml_api_url}`);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const mlResponse = await fetch(ml_api_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, district, market, commodity, variety, horizon }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (mlResponse.ok) {
          const mlData = await mlResponse.json();
          console.log('External ML API successful');
          return new Response(
            JSON.stringify({ success: true, source: 'external_ml', ...mlData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.warn(`ML API returned status ${mlResponse.status}, falling back to statistical`);
      } catch (mlError: unknown) {
        const err = mlError as Error;
        const errorMsg = err.name === 'AbortError' 
          ? 'ML API timeout (10s)' 
          : `ML API error: ${err.message}`;
        console.warn(errorMsg);
      }
    }

    // Try to fetch real data from mandi_prices
    let historicalData: HistoricalData[] = [];
    let dataSource = 'deterministic_simulated';

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { data, error } = await supabase
          .from('mandi_prices')
          .select(`
            arrival_date, modal_price, min_price, max_price, arrivals_tonnes,
            price_lag_1, price_lag_7, price_lag_30, rolling_mean_7, rolling_mean_30,
            momentum_7, volatility_30
          `)
          .eq('state', state)
          .eq('market', market)
          .eq('commodity', commodity)
          .order('arrival_date', { ascending: true })
          .limit(90);

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
          console.log(`Insufficient real data (${data?.length || 0} records), using deterministic simulation`);
        }
      }
    } catch (dbError) {
      console.warn('Database query error:', dbError);
    }

    // Generate deterministic simulated data if needed
    if (historicalData.length < 7) {
      console.log('Generating deterministic historical data');
      historicalData = generateDeterministicData(state, market, commodity);
    }

    // Run statistical forecast
    const result = statisticalForecast(historicalData, horizon, commodity);

    const response = {
      success: true,
      source: dataSource === 'mandi_prices' ? 'mandi_prices_statistical' : 'deterministic_statistical',
      data_source: dataSource,
      request: { state, district, market, commodity, variety, horizon },
      historical_summary: {
        days_analyzed: historicalData.length,
        latest_price: historicalData[historicalData.length - 1].modal_price,
        latest_date: historicalData[historicalData.length - 1].date,
        price_range: {
          min: Math.min(...historicalData.map(h => h.modal_price)),
          max: Math.max(...historicalData.map(h => h.modal_price))
        }
      },
      ...result
    };

    console.log(`Forecast generated successfully: ${result.forecasts.length} predictions`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Forecast error:', err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message || 'Forecast generation failed',
        details: err.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
