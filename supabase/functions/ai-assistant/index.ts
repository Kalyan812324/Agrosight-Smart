import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Input validation schemas
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "Message cannot be empty").max(4000, "Message too long (max 4000 characters)")
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1, "At least one message required").max(50, "Too many messages (max 50)"),
  language: z.enum(["english", "telugu"]).default("english")
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Parse and validate request body
    const body = await req.json();
    const validationResult = requestSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.issues);
      return new Response(
        JSON.stringify({ 
          error: "Invalid request format", 
          details: validationResult.error.issues.map(i => i.message)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { messages, language } = validationResult.data;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    // Get user context
    const { data: { user } } = await supabase.auth.getUser();
    
    let contextData = "";
    let userPredictions = "";
    let marketData = "";
    let weatherTip = "";
    
    if (user) {
      // Fetch user's crop predictions with more detail
      const { data: predictions } = await supabase
        .from("crop_predictions")
        .select("crop_type, predicted_yield, area_hectares, season, state, district, rainfall_mm, soil_type, confidence_score, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch user's farm finances
      const { data: finances } = await supabase
        .from("farm_finances")
        .select("crop_type, total_expense, expected_revenue, net_profit_loss, predicted_yield, predicted_price")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(3);

      // Fetch recent market prices for user's region
      const { data: marketPrices } = await supabase
        .from("mandi_prices")
        .select("commodity, market, modal_price, min_price, max_price, arrival_date, state")
        .order("arrival_date", { ascending: false })
        .limit(20);

      // Fetch ML predictions for market forecasts
      const { data: mlPredictions } = await supabase
        .from("ml_predictions")
        .select("commodity, market, ensemble_prediction, confidence_lower, confidence_upper, target_date, horizon_days")
        .order("prediction_date", { ascending: false })
        .limit(10);

      // Fetch historical yields for reference
      const { data: yields } = await supabase
        .from("historical_yields")
        .select("crop_type, state, avg_yield, year, rainfall_mm")
        .order("year", { ascending: false })
        .limit(15);

      // Build user predictions context
      if (predictions?.length) {
        userPredictions = `
USER'S CROP PREDICTIONS:
${predictions.map(p => `- ${p.crop_type} in ${p.state}${p.district ? `, ${p.district}` : ''}: ${p.predicted_yield} tonnes/hectare on ${p.area_hectares} hectares (${p.season} season, Soil: ${p.soil_type}, Rainfall: ${p.rainfall_mm}mm, Confidence: ${p.confidence_score || 'N/A'}%)`).join('\n')}`;
      }

      // Build finance context
      if (finances?.length) {
        userPredictions += `

USER'S FARM FINANCES:
${finances.map(f => `- ${f.crop_type || 'General'}: Expenses ₹${f.total_expense?.toLocaleString()}, Expected Revenue ₹${f.expected_revenue?.toLocaleString() || 'N/A'}, Net P/L ₹${f.net_profit_loss?.toLocaleString() || 'N/A'}`).join('\n')}`;
      }

      // Build market data context
      if (marketPrices?.length) {
        const uniqueCommodities = [...new Set(marketPrices.map(p => p.commodity))];
        marketData = `
CURRENT MARKET PRICES (Latest):
${uniqueCommodities.slice(0, 10).map(commodity => {
          const prices = marketPrices.filter(p => p.commodity === commodity);
          const latest = prices[0];
          return `- ${commodity}: ₹${latest.modal_price}/quintal at ${latest.market}, ${latest.state} (Min: ₹${latest.min_price}, Max: ₹${latest.max_price}) [${latest.arrival_date}]`;
        }).join('\n')}`;
      }

      // Add ML forecast context
      if (mlPredictions?.length) {
        marketData += `

PRICE FORECASTS (ML Predictions):
${mlPredictions.slice(0, 5).map(p => `- ${p.commodity} at ${p.market}: ₹${p.ensemble_prediction?.toFixed(0)}/quintal predicted for ${p.target_date} (Range: ₹${p.confidence_lower?.toFixed(0)} - ₹${p.confidence_upper?.toFixed(0)})`).join('\n')}`;
      }

      // Add historical yield context
      if (yields?.length) {
        const cropYields = [...new Set(yields.map(y => y.crop_type))];
        contextData = `
HISTORICAL YIELD REFERENCE (India):
${cropYields.slice(0, 8).map(crop => {
          const cropData = yields.filter(y => y.crop_type === crop);
          const avgYield = (cropData.reduce((sum, y) => sum + Number(y.avg_yield), 0) / cropData.length).toFixed(2);
          return `- ${crop}: Avg ${avgYield} tonnes/ha across ${[...new Set(cropData.map(y => y.state))].slice(0, 3).join(', ')}`;
        }).join('\n')}`;
      }
    }

    // Enhanced system prompt with accurate agricultural knowledge
    const systemPrompt = language === "telugu" 
      ? `మీరు AgroSight Ultra AI అసిస్టెంట్ - భారతదేశంలో రైతులకు సహాయం చేసే అధునాతన వ్యవసాయ AI.

మీ సామర్థ్యాలు:
1. వాతావరణ సమాచారం & అంచనాలు - వర్షపాతం, ఉష్ణోగ్రత, తేమ
2. పంట దిగుబడి అంచనాలు - నేల రకం, వాతావరణం ఆధారంగా
3. మార్కెట్ ధరల అంచనాలు - మండి ధరలు, MSP సమాచారం
4. వ్యవసాయ రుణ లెక్కింపులు - EMI, వడ్డీ రేటులు
5. ఖర్చు విశ్లేషణ - లాభ-నష్ట అంచనాలు

${userPredictions}
${marketData}
${contextData}

ముఖ్యమైన మార్గదర్శకాలు:
- భారతీయ వ్యవసాయ సందర్భంలో సమాధానాలు ఇవ్వండి
- రూపాయల్లో (₹) ధరలు చెప్పండి
- హెక్టార్లు, క్వింటాల్స్ యూనిట్లు వాడండి
- MSP (కనీస మద్దతు ధర) సమాచారం ఇవ్వండి
- స్పష్టంగా, సంక్షిప్తంగా సమాధానాలు ఇవ్వండి
- వినియోగదారు డేటా ఆధారంగా వ్యక్తిగత సలహాలు ఇవ్వండి`
      : `You are AgroSight Ultra AI Assistant - an advanced agricultural AI helping farmers in India.

YOUR CAPABILITIES:
1. Weather Information & Forecasts - Rainfall, temperature, humidity patterns
2. Crop Yield Predictions - Based on soil type, weather, historical data
3. Market Price Forecasts - Mandi prices, MSP information, price trends
4. Agricultural Loan Calculations - EMI, interest rates, subsidy schemes
5. Expense Analysis - Cost-benefit analysis, profit-loss projections

${userPredictions}
${marketData}
${contextData}

IMPORTANT GUIDELINES:
- Provide answers in Indian agricultural context
- Quote prices in Indian Rupees (₹)
- Use hectares, quintals, and tonnes as units
- Reference MSP (Minimum Support Price) when discussing crop prices
- Be accurate with current market rates and seasonal patterns
- Give personalized advice based on user's data when available
- For crop yields, reference typical ranges for Indian conditions:
  * Rice: 2.5-4.5 tonnes/hectare
  * Wheat: 2.5-4.0 tonnes/hectare
  * Cotton: 1.5-2.5 tonnes/hectare
  * Sugarcane: 70-100 tonnes/hectare
  * Maize: 2.5-4.0 tonnes/hectare
- Major crop seasons: Kharif (June-Oct), Rabi (Nov-March), Zaid (March-June)
- Be concise but comprehensive. Provide actionable insights.`;

    console.log(`Processing AI request: ${messages.length} messages, language: ${language}, user: ${user?.id || 'anonymous'}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
