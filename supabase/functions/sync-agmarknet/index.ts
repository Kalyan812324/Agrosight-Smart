import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGMARKNET_API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070";

interface AgmarknetRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  arrival_date: string;
  min_price: string;
  max_price: string;
  modal_price: string;
}

interface SyncOptions {
  state?: string;
  commodity?: string;
  limit?: number;
  offset?: number;
  fromDate?: string;
  toDate?: string;
}

// Fetch data from AGMARKNET API
async function fetchAgmarknetData(apiKey: string, options: SyncOptions = {}): Promise<AgmarknetRecord[]> {
  const params = new URLSearchParams({
    'api-key': apiKey,
    format: 'json',
    limit: (options.limit || 1000).toString(),
    offset: (options.offset || 0).toString(),
  });

  // Add optional filters
  if (options.state) params.append('filters[state]', options.state);
  if (options.commodity) params.append('filters[commodity]', options.commodity);

  const url = `${AGMARKNET_API_URL}?${params.toString()}`;
  console.log(`Fetching from AGMARKNET: ${url.replace(apiKey, '***')}`);

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AGMARKNET API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`Fetched ${data.records?.length || 0} records from AGMARKNET`);
  
  return data.records || [];
}

// Calculate feature engineering columns
function calculateFeatures(
  currentPrice: number,
  historicalPrices: { modal_price: number; arrival_date: string }[]
): Record<string, number | null> {
  const prices = historicalPrices.map(p => p.modal_price);
  
  // Lag features
  const price_lag_1 = prices.length >= 1 ? prices[prices.length - 1] : null;
  const price_lag_7 = prices.length >= 7 ? prices[prices.length - 7] : null;
  const price_lag_30 = prices.length >= 30 ? prices[prices.length - 30] : null;

  // Rolling statistics
  const last7 = prices.slice(-7);
  const last30 = prices.slice(-30);

  const rolling_mean_7 = last7.length >= 7 
    ? last7.reduce((a, b) => a + b, 0) / last7.length 
    : null;
  
  const rolling_mean_30 = last30.length >= 30 
    ? last30.reduce((a, b) => a + b, 0) / last30.length 
    : null;

  // Standard deviation for 7 days
  let rolling_std_7: number | null = null;
  if (last7.length >= 7 && rolling_mean_7 !== null) {
    const variance = last7.reduce((sum, p) => sum + Math.pow(p - rolling_mean_7, 2), 0) / last7.length;
    rolling_std_7 = Math.sqrt(variance);
  }

  // Momentum (7-day price change percentage)
  const momentum_7 = price_lag_7 && price_lag_7 > 0 
    ? ((currentPrice - price_lag_7) / price_lag_7) * 100 
    : null;

  // Volatility (coefficient of variation over 30 days)
  let volatility_30: number | null = null;
  if (last30.length >= 30 && rolling_mean_30 !== null && rolling_mean_30 > 0) {
    const variance30 = last30.reduce((sum, p) => sum + Math.pow(p - rolling_mean_30, 2), 0) / last30.length;
    volatility_30 = (Math.sqrt(variance30) / rolling_mean_30) * 100;
  }

  return {
    price_lag_1,
    price_lag_7,
    price_lag_30,
    rolling_mean_7,
    rolling_mean_30,
    rolling_std_7,
    momentum_7,
    volatility_30,
  };
}

// Get seasonal flags based on date
function getSeasonalFlags(date: Date): { is_harvest_season: boolean; is_sowing_season: boolean; is_festival: boolean } {
  const month = date.getMonth() + 1; // 1-12
  
  // Harvest seasons: Oct-Dec (Kharif), Apr-May (Rabi)
  const is_harvest_season = (month >= 10 && month <= 12) || (month >= 4 && month <= 5);
  
  // Sowing seasons: Jun-Jul (Kharif), Nov-Dec (Rabi)
  const is_sowing_season = (month >= 6 && month <= 7) || (month >= 11 && month <= 12);
  
  // Festival months (approximate): Oct-Nov (Diwali, Dussehra), Mar (Holi)
  const is_festival = month === 10 || month === 11 || month === 3;

  return { is_harvest_season, is_sowing_season, is_festival };
}

// Parse date from various formats
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try common formats
  const formats = [
    /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      } else if (format === formats[1]) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      }
    }
  }
  
  // Fallback to Date.parse
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

  const apiKey = Deno.env.get('DATA_GOV_IN_API_KEY');

  if (!apiKey) {
    console.error('DATA_GOV_IN_API_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  const syncStartTime = new Date();
  let syncLogId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const options: SyncOptions = {
      state: body.state,
      commodity: body.commodity,
      limit: body.limit || 1000,
      offset: body.offset || 0,
    };

    console.log('Starting AGMARKNET sync with options:', options);

    // Create sync log entry
    const { data: logEntry } = await supabase
      .from('api_sync_logs')
      .insert({
        sync_type: 'agmarknet_prices',
        sync_status: 'running',
        sync_start_time: syncStartTime.toISOString(),
        metadata: { options },
      })
      .select('id')
      .single();
    
    syncLogId = logEntry?.id;

    // Fetch data from AGMARKNET
    const records = await fetchAgmarknetData(apiKey, options);
    
    let insertedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        const arrivalDate = parseDate(record.arrival_date);
        if (!arrivalDate) {
          console.warn(`Invalid date: ${record.arrival_date}`);
          continue;
        }

        const minPrice = parseFloat(record.min_price) || 0;
        const maxPrice = parseFloat(record.max_price) || 0;
        const modalPrice = parseFloat(record.modal_price) || 0;

        if (modalPrice <= 0) continue;

        // Get historical prices for feature calculation
        const { data: historicalPrices } = await supabase
          .from('mandi_prices')
          .select('modal_price, arrival_date')
          .eq('state', record.state)
          .eq('market', record.market)
          .eq('commodity', record.commodity)
          .lt('arrival_date', arrivalDate.toISOString().split('T')[0])
          .order('arrival_date', { ascending: true })
          .limit(30);

        // Calculate features
        const features = calculateFeatures(modalPrice, historicalPrices || []);
        const seasonalFlags = getSeasonalFlags(arrivalDate);

        // Prepare upsert data
        const upsertData = {
          state: record.state,
          district: record.district,
          market: record.market,
          commodity: record.commodity,
          variety: record.variety || null,
          grade: record.grade || null,
          arrival_date: arrivalDate.toISOString().split('T')[0],
          min_price: minPrice,
          max_price: maxPrice,
          modal_price: modalPrice,
          ...features,
          ...seasonalFlags,
          updated_at: new Date().toISOString(),
        };

        // Upsert into mandi_prices
        const { error: upsertError } = await supabase
          .from('mandi_prices')
          .upsert(upsertData, {
            onConflict: 'state,district,market,commodity,arrival_date',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          // Try insert if upsert fails (no unique constraint)
          const { error: insertError } = await supabase
            .from('mandi_prices')
            .insert(upsertData);
          
          if (insertError) {
            errors.push(`${record.market}/${record.commodity}: ${insertError.message}`);
          } else {
            insertedCount++;
          }
        } else {
          insertedCount++;
        }
      } catch (recordError: unknown) {
        const err = recordError as Error;
        errors.push(`Record error: ${err.message}`);
      }
    }

    // Update sync log
    if (syncLogId) {
      await supabase
        .from('api_sync_logs')
        .update({
          sync_status: errors.length > 0 ? 'completed_with_errors' : 'completed',
          records_fetched: records.length,
          records_inserted: insertedCount,
          records_updated: updatedCount,
          error_message: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
          sync_end_time: new Date().toISOString(),
        })
        .eq('id', syncLogId);
    }

    console.log(`Sync completed: ${insertedCount} inserted, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        records_fetched: records.length,
        records_inserted: insertedCount,
        errors: errors.slice(0, 10),
        sync_log_id: syncLogId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Sync error:', err);

    // Update sync log with error
    if (syncLogId) {
      await supabase
        .from('api_sync_logs')
        .update({
          sync_status: 'failed',
          error_message: err.message,
          sync_end_time: new Date().toISOString(),
        })
        .eq('id', syncLogId);
    }

    return new Response(
      JSON.stringify({ error: err.message, sync_log_id: syncLogId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
