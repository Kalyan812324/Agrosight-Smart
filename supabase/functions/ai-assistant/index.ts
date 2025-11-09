import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, language = "english" } = await req.json();
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
    
    if (user) {
      // Fetch user's crop predictions
      const { data: predictions } = await supabase
        .from("crop_predictions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch recent historical yields
      const { data: yields } = await supabase
        .from("historical_yields")
        .select("*")
        .order("year", { ascending: false })
        .limit(10);

      contextData = `
User's Recent Data:
${predictions?.length ? `Recent Crop Predictions: ${JSON.stringify(predictions)}` : "No predictions yet."}

Agricultural Reference Data:
${yields?.length ? `Historical Yields: ${JSON.stringify(yields)}` : ""}
`;
    }

    const systemPrompt = language === "telugu" 
      ? `మీరు AgroSight AI సహాయకుడు. మీరు వ్యవసాయ డేటా, వాతావరణ సమాచారం, పంట అంచనాలు, మార్కెట్ అంచనాలు మరియు రుణ లెక్కింపులపై సహాయం చేస్తారు. మీరు తెలుగు మరియు ఇంగ్లీష్ రెండింటినీ స్పష్టంగా అర్థం చేసుకుంటారు. స్పష్టమైన, ఖచ్చితమైన సమాధానాలు అందించండి.

${contextData}

వినియోగదారు ఏమి అడిగినా, వారికి సహాయం చేయండి:
- వాతావరణం గురించి ప్రశ్నలు
- పంట దిగుబడి అంచనాలు
- మార్కెట్ ధరల అంచనాలు
- వ్యవసాయ రుణ లెక్కింపులు
- వారి డేటా మరియు అంచనాల విశ్లేషణ

సంక్షిప్తంగా మరియు స్పష్టంగా ఉండండి.`
      : `You are AgroSight AI Assistant. You help with agricultural data, weather information, crop predictions, market forecasts, and loan calculations. You understand both Telugu and English clearly. Provide clear, accurate responses.

${contextData}

Help users with:
- Weather queries
- Crop yield predictions
- Market price forecasts
- Agricultural loan calculations
- Analysis of their data and predictions

Be concise and clear.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
