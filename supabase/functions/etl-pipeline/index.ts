import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ETLOptions {
  state?: string;
  commodity?: string;
  startDate?: string;
  endDate?: string;
  computeFeatures?: boolean;
  limit?: number;
}

// MSP data for major crops (₹ per quintal, 2024-25)
const MSP_DATA: Record<string, number> = {
  'PADDY': 2300,
  'WHEAT': 2275,
  'JOWAR': 3180,
  'BAJRA': 2625,
  'MAIZE': 2225,
  'RAGI': 4290,
  'ARHAR': 7550,
  'MOONG': 8682,
  'URAD': 7400,
  'GROUNDNUT': 6783,
  'SOYABEAN': 4892,
  'SUNFLOWER': 7280,
  'COTTON': 7121,
  'SUGARCANE': 315,
  'MUSTARD': 5650,
};

// Festival dates (approximate, varies by year)
const FESTIVAL_PERIODS = [
  { start: '01-14', end: '01-15', name: 'Makar Sankranti' },
  { start: '03-20', end: '03-25', name: 'Holi' },
  { start: '04-10', end: '04-15', name: 'Baisakhi' },
  { start: '08-15', end: '08-20', name: 'Raksha Bandhan' },
  { start: '09-15', end: '09-25', name: 'Ganesh Chaturthi' },
  { start: '10-15', end: '10-25', name: 'Dussehra' },
  { start: '10-25', end: '11-05', name: 'Diwali' },
  { start: '11-10', end: '11-15', name: 'Guru Nanak Jayanti' },
  { start: '12-25', end: '12-26', name: 'Christmas' },
];

// Crop calendar (month numbers)
const CROP_CALENDAR: Record<string, { sowing: number[]; harvest: number[] }> = {
  'PADDY': { sowing: [6, 7], harvest: [10, 11, 12] },
  'WHEAT': { sowing: [10, 11], harvest: [3, 4] },
  'MAIZE': { sowing: [6, 7], harvest: [9, 10] },
  'COTTON': { sowing: [4, 5, 6], harvest: [10, 11, 12] },
  'GROUNDNUT': { sowing: [6, 7], harvest: [10, 11] },
  'SOYABEAN': { sowing: [6, 7], harvest: [9, 10] },
  'MUSTARD': { sowing: [9, 10], harvest: [2, 3] },
  'SUGARCANE': { sowing: [2, 3, 10], harvest: [11, 12, 1, 2, 3, 4] },
  'ONION': { sowing: [6, 7, 10, 11], harvest: [1, 2, 3, 4, 5] },
  'POTATO': { sowing: [10, 11], harvest: [1, 2, 3] },
  'TOMATO': { sowing: [6, 7, 8, 9], harvest: [10, 11, 12, 1, 2] },
};

function isFestivalPeriod(date: Date): boolean {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return FESTIVAL_PERIODS.some(f => monthDay >= f.start && monthDay <= f.end);
}

function getCropSeasonFlags(commodity: string, date: Date): { isSowing: boolean; isHarvest: boolean } {
  const month = date.getMonth() + 1;
  const calendar = CROP_CALENDAR[commodity.toUpperCase()] || { sowing: [], harvest: [] };
  return {
    isSowing: calendar.sowing.includes(month),
    isHarvest: calendar.harvest.includes(month),
  };
}

// Compute all features for a single record given historical data
function computeFeatures(
  current: any,
  history: any[],
  stateAvg: number | null,
  nationalAvg: number | null
): Record<string, any> {
  const price = current.modal_price;
  const date = new Date(current.arrival_date);
  const arrivals = current.arrivals_tonnes || 0;
  
  // Sort history by date descending
  const sorted = [...history].sort((a, b) => 
    new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime()
  );
  
  // Lagged prices
  const lag1 = sorted[0]?.modal_price || null;
  const lag7 = sorted[6]?.modal_price || null;
  const lag30 = sorted[29]?.modal_price || null;
  const arrivalsLag1 = sorted[0]?.arrivals_tonnes || null;
  const arrivalsLag7 = sorted[6]?.arrivals_tonnes || null;
  
  // Rolling statistics
  const last7 = sorted.slice(0, 7).map(r => r.modal_price).filter(p => p != null);
  const last30 = sorted.slice(0, 30).map(r => r.modal_price).filter(p => p != null);
  const last90 = sorted.slice(0, 90).map(r => r.modal_price).filter(p => p != null);
  
  const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const std = (arr: number[]) => {
    if (arr.length < 2) return null;
    const m = mean(arr)!;
    return Math.sqrt(arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / arr.length);
  };
  
  const rollingMean7 = mean(last7);
  const rollingMean30 = mean(last30);
  const rollingMean90 = mean(last90);
  const rollingStd7 = std(last7);
  const rollingStd30 = std(last30);
  const rollingStd90 = std(last90);
  
  // Momentum
  const momentum7 = rollingMean7 ? price - rollingMean7 : null;
  const momentum30 = rollingMean30 ? price - rollingMean30 : null;
  
  // Volatility
  const volatility7 = rollingMean7 && rollingStd7 ? rollingStd7 / rollingMean7 : null;
  const volatility30 = rollingMean30 && rollingStd30 ? rollingStd30 / rollingMean30 : null;
  
  // MSP gap
  const msp = MSP_DATA[current.commodity.toUpperCase()] || null;
  const mspGap = msp ? price - msp : null;
  const mspGapPct = msp ? ((price - msp) / msp) * 100 : null;
  
  // Arrivals deviation (from weekly average)
  const weeklyArrivals = sorted.slice(0, 7).map(r => r.arrivals_tonnes).filter(a => a != null);
  const avgWeeklyArrivals = mean(weeklyArrivals as number[]);
  const arrivalsDeviation = avgWeeklyArrivals ? arrivals - avgWeeklyArrivals : null;
  const arrivalsZscore = avgWeeklyArrivals && weeklyArrivals.length > 1 
    ? (arrivals - avgWeeklyArrivals) / (std(weeklyArrivals as number[]) || 1)
    : null;
  
  // Cumulative rainfall
  const rainfall7 = sorted.slice(0, 7).reduce((sum, r) => sum + (r.rainfall_mm || 0), 0);
  const rainfall30 = sorted.slice(0, 30).reduce((sum, r) => sum + (r.rainfall_mm || 0), 0);
  
  // Calendar features
  const dayOfWeek = date.getDay();
  const weekOfYear = Math.ceil((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  const month = date.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isMonthStart = date.getDate() <= 5;
  const isMonthEnd = date.getDate() >= 25;
  const isFestival = isFestivalPeriod(date);
  const { isSowing, isHarvest } = getCropSeasonFlags(current.commodity, date);
  
  // Interaction features
  const rainfallXCrop = (current.rainfall_mm || 0) * (isHarvest ? -1 : 1);
  const arrivalsXMspGap = mspGap ? arrivals * mspGap : null;
  const volatilityXArrivals = volatility7 ? volatility7 * arrivals : null;
  
  return {
    price_lag_1: lag1,
    price_lag_7: lag7,
    price_lag_30: lag30,
    arrivals_lag_1: arrivalsLag1,
    arrivals_lag_7: arrivalsLag7,
    rolling_mean_7: rollingMean7,
    rolling_mean_30: rollingMean30,
    rolling_mean_90: rollingMean90,
    rolling_std_7: rollingStd7,
    rolling_std_30: rollingStd30,
    rolling_std_90: rollingStd90,
    momentum_7: momentum7,
    momentum_30: momentum30,
    volatility_7: volatility7,
    volatility_30: volatility30,
    state_modal_price: stateAvg,
    national_modal_price: nationalAvg,
    msp_gap: mspGap,
    msp_gap_pct: mspGapPct,
    neighbor_avg_price: null, // Would need neighbor market data
    arrivals_deviation: arrivalsDeviation,
    arrivals_zscore: arrivalsZscore,
    cumulative_rainfall_7: rainfall7,
    cumulative_rainfall_30: rainfall30,
    day_of_week: dayOfWeek,
    week_of_year: weekOfYear,
    month: month,
    quarter: quarter,
    is_weekend: isWeekend,
    is_month_start: isMonthStart,
    is_month_end: isMonthEnd,
    is_festival: isFestival,
    is_sowing: isSowing,
    is_harvest: isHarvest,
    rainfall_x_crop: rainfallXCrop,
    arrivals_x_msp_gap: arrivalsXMspGap,
    volatility_x_arrivals: volatilityXArrivals,
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

    // Verify authentication - this function requires admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const options: ETLOptions = await req.json().catch(() => ({}));
    const { state, commodity, startDate, endDate, computeFeatures: shouldCompute = true, limit = 1000 } = options;

    console.log('[ETL] Starting pipeline with options:', options);

    // Step 1: Query raw data from mandi_prices (existing table)
    let query = supabase
      .from('mandi_prices')
      .select('*')
      .order('arrival_date', { ascending: false })
      .limit(limit);

    if (state) query = query.eq('state', state);
    if (commodity) query = query.eq('commodity', commodity);
    if (startDate) query = query.gte('arrival_date', startDate);
    if (endDate) query = query.lte('arrival_date', endDate);

    const { data: rawData, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    console.log(`[ETL] Fetched ${rawData?.length || 0} records from mandi_prices`);

    if (!rawData || rawData.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No data to process',
        stats: { fetched: 0, inserted: 0, features_computed: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 2: Transform and upsert to mandi_timeseries
    const timeseriesRecords = rawData.map(r => ({
      state: r.state,
      district: r.district,
      market: r.market,
      commodity: r.commodity,
      variety: r.variety,
      grade: r.grade,
      arrival_date: r.arrival_date,
      min_price: r.min_price,
      max_price: r.max_price,
      modal_price: r.modal_price,
      arrivals_tonnes: r.arrivals_tonnes,
      rainfall_mm: r.rainfall_mm,
      temp_max: r.temp_max,
      temp_min: r.temp_min,
      humidity: r.humidity,
      is_festival: r.is_festival || isFestivalPeriod(new Date(r.arrival_date)),
      is_sowing_season: r.is_sowing_season,
      is_harvest_season: r.is_harvest_season,
      week_of_year: Math.ceil((new Date(r.arrival_date).getTime() - new Date(new Date(r.arrival_date).getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)),
      month: new Date(r.arrival_date).getMonth() + 1,
      msp_price: MSP_DATA[r.commodity?.toUpperCase()] || null,
      policy_event: r.policy_event,
      data_source: 'agmarknet',
    }));

    const { error: upsertError } = await supabase
      .from('mandi_timeseries')
      .upsert(timeseriesRecords, { 
        onConflict: 'state,district,market,commodity,variety,arrival_date',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error('[ETL] Upsert error:', upsertError);
    }

    console.log(`[ETL] Upserted ${timeseriesRecords.length} records to mandi_timeseries`);

    // Step 3: Compute features if requested
    let featuresComputed = 0;
    if (shouldCompute) {
      // Get aggregates for cross-market features
      const { data: stateAvgs } = await supabase
        .from('mandi_prices')
        .select('state, modal_price')
        .order('arrival_date', { ascending: false })
        .limit(5000);

      const stateAvgMap: Record<string, number> = {};
      if (stateAvgs) {
        const stateGroups: Record<string, number[]> = {};
        stateAvgs.forEach(r => {
          if (!stateGroups[r.state]) stateGroups[r.state] = [];
          stateGroups[r.state].push(r.modal_price);
        });
        for (const [s, prices] of Object.entries(stateGroups)) {
          stateAvgMap[s] = prices.reduce((a, b) => a + b, 0) / prices.length;
        }
      }

      const nationalAvg = stateAvgs?.length 
        ? stateAvgs.reduce((sum, r) => sum + r.modal_price, 0) / stateAvgs.length 
        : null;

      // Group by market-commodity for historical lookups
      const groups = new Map<string, any[]>();
      rawData.forEach(r => {
        const key = `${r.state}|${r.district}|${r.market}|${r.commodity}|${r.variety || ''}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      });

      const featureRecords: any[] = [];
      for (const [key, records] of groups.entries()) {
        const [state, district, market, commodity, variety] = key.split('|');
        const sortedRecords = records.sort((a, b) => 
          new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime()
        );

        for (let i = 0; i < sortedRecords.length; i++) {
          const record = sortedRecords[i];
          const history = sortedRecords.slice(i + 1, i + 91); // 90 days of history

          const features = computeFeatures(
            record,
            history,
            stateAvgMap[state] || null,
            nationalAvg
          );

          featureRecords.push({
            state,
            district,
            market,
            commodity,
            variety: variety || null,
            arrival_date: record.arrival_date,
            ...features,
          });
        }
      }

      if (featureRecords.length > 0) {
        // Batch insert features
        const batchSize = 500;
        for (let i = 0; i < featureRecords.length; i += batchSize) {
          const batch = featureRecords.slice(i, i + batchSize);
          const { error: featureError } = await supabase
            .from('mandi_features')
            .upsert(batch, { 
              onConflict: 'state,district,market,commodity,variety,arrival_date',
              ignoreDuplicates: false 
            });

          if (featureError) {
            console.error('[ETL] Feature insert error:', featureError);
          } else {
            featuresComputed += batch.length;
          }
        }
      }

      console.log(`[ETL] Computed ${featuresComputed} feature records`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'ETL pipeline completed',
      stats: {
        fetched: rawData.length,
        timeseries_upserted: timeseriesRecords.length,
        features_computed: featuresComputed,
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[ETL] Pipeline error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
