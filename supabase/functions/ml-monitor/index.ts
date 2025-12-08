import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonitorRequest {
  action: 'evaluate' | 'check_alerts' | 'update_actuals' | 'get_performance';
  commodity?: string;
  market?: string;
  horizon?: number;
  threshold_mape?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: MonitorRequest = await req.json();
    const { action, commodity, market, horizon, threshold_mape = 15 } = request;

    console.log('[ML-Monitor] Action:', action);

    if (action === 'update_actuals') {
      // Update predictions with actual values where target_date has passed
      const today = new Date().toISOString().split('T')[0];
      
      // Get predictions that need actuals
      const { data: pendingPredictions, error: fetchError } = await supabase
        .from('ml_predictions')
        .select('id, state, district, market, commodity, variety, target_date')
        .lte('target_date', today)
        .is('actual_price', null)
        .limit(500);

      if (fetchError) throw fetchError;

      let updated = 0;
      for (const pred of pendingPredictions || []) {
        // Fetch actual price for target date
        let query = supabase
          .from('mandi_timeseries')
          .select('modal_price')
          .eq('state', pred.state)
          .eq('district', pred.district)
          .eq('market', pred.market)
          .eq('commodity', pred.commodity)
          .eq('arrival_date', pred.target_date)
          .maybeSingle();

        if (pred.variety) query = query.eq('variety', pred.variety);

        const { data: actual } = await query;

        if (actual?.modal_price) {
          // Get the prediction value
          const { data: predData } = await supabase
            .from('ml_predictions')
            .select('ensemble_prediction')
            .eq('id', pred.id)
            .single();

          const predicted = predData?.ensemble_prediction;
          const actualPrice = actual.modal_price;
          const absoluteError = Math.abs(predicted - actualPrice);
          const percentageError = (absoluteError / actualPrice) * 100;

          await supabase
            .from('ml_predictions')
            .update({
              actual_price: actualPrice,
              absolute_error: absoluteError,
              percentage_error: percentageError,
            })
            .eq('id', pred.id);

          updated++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'update_actuals',
        updated_count: updated,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'evaluate') {
      // Calculate model performance metrics
      let query = supabase
        .from('ml_predictions')
        .select('*')
        .not('actual_price', 'is', null);

      if (commodity) query = query.eq('commodity', commodity);
      if (market) query = query.eq('market', market);
      if (horizon) query = query.eq('horizon_days', horizon);

      const { data: predictions, error } = await query;
      if (error) throw error;

      if (!predictions || predictions.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No evaluated predictions found',
          metrics: null,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Calculate metrics
      const errors = predictions.map(p => ({
        absolute: p.absolute_error,
        percentage: p.percentage_error,
        predicted: p.ensemble_prediction,
        actual: p.actual_price,
      }));

      const mae = errors.reduce((s, e) => s + e.absolute, 0) / errors.length;
      const mape = errors.reduce((s, e) => s + e.percentage, 0) / errors.length;
      const rmse = Math.sqrt(errors.reduce((s, e) => s + Math.pow(e.absolute, 2), 0) / errors.length);

      // R² score
      const actualMean = errors.reduce((s, e) => s + e.actual, 0) / errors.length;
      const ssTot = errors.reduce((s, e) => s + Math.pow(e.actual - actualMean, 2), 0);
      const ssRes = errors.reduce((s, e) => s + Math.pow(e.actual - e.predicted, 2), 0);
      const r2 = 1 - (ssRes / ssTot);

      // Store performance record
      const performanceRecord = {
        model_name: 'ensemble',
        model_version: predictions[0]?.model_version || 'unknown',
        commodity: commodity || 'all',
        market: market || 'all',
        horizon_days: horizon || null,
        mae,
        rmse,
        mape,
        r2_score: r2,
        evaluation_start: predictions[predictions.length - 1].target_date,
        evaluation_end: predictions[0].target_date,
        sample_size: predictions.length,
      };

      await supabase.from('ml_model_performance').insert(performanceRecord);

      // Check if performance is degrading
      if (mape > threshold_mape) {
        await supabase.from('ml_alerts').insert({
          alert_type: 'accuracy_degradation',
          severity: mape > threshold_mape * 1.5 ? 'critical' : 'warning',
          commodity,
          market,
          model_name: 'ensemble',
          message: `Model MAPE (${mape.toFixed(2)}%) exceeds threshold (${threshold_mape}%)`,
          metric_name: 'MAPE',
          metric_value: mape,
          threshold_value: threshold_mape,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'evaluate',
        metrics: {
          mae: Math.round(mae * 100) / 100,
          rmse: Math.round(rmse * 100) / 100,
          mape: Math.round(mape * 100) / 100,
          r2_score: Math.round(r2 * 1000) / 1000,
          sample_size: predictions.length,
        },
        status: mape <= threshold_mape ? 'healthy' : 'degraded',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'check_alerts') {
      // Get unresolved alerts
      const { data: alerts, error } = await supabase
        .from('ml_alerts')
        .select('*')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        action: 'check_alerts',
        alerts: alerts || [],
        alert_count: alerts?.length || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_performance') {
      // Get latest performance metrics
      let query = supabase
        .from('ml_model_performance')
        .select('*')
        .eq('is_active', true)
        .order('evaluated_at', { ascending: false });

      if (commodity) query = query.eq('commodity', commodity);
      if (market) query = query.eq('market', market);

      const { data: performance, error } = await query.limit(20);
      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        action: 'get_performance',
        performance: performance || [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action. Use: evaluate, check_alerts, update_actuals, get_performance',
    }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('[ML-Monitor] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
