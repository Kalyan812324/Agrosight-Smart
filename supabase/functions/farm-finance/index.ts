import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExpenseCategory {
  id: string;
  name: string;
  amount: number;
  isRequired: boolean;
}

interface OtherExpense {
  id: string;
  name: string;
  amount: number;
}

interface FinanceData {
  expense_categories: ExpenseCategory[];
  other_expenses: OtherExpense[];
  total_expense: number;
  predicted_yield: number | null;
  yield_unit: string;
  predicted_price: number | null;
  price_unit: string;
  crop_type: string | null;
  expected_revenue: number | null;
  net_profit_loss: number | null;
  profit_loss_percentage: number | null;
  break_even_price: number | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No valid auth token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify JWT and get user ID
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("JWT verification failed:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Request from user: ${userId}, method: ${req.method}`);

    // GET - Fetch user's finance data
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("farm_finances")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching finances:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch finance data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return empty object if no record exists yet
      return new Response(
        JSON.stringify({ data: data || null, exists: !!data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PUT - Update or create user's finance data
    if (req.method === "PUT") {
      const body: FinanceData = await req.json();
      
      // Validate required fields
      if (!Array.isArray(body.expense_categories)) {
        return new Response(
          JSON.stringify({ error: "Invalid expense_categories format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if record exists
      const { data: existing } = await supabase
        .from("farm_finances")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      let result;
      
      if (existing) {
        // Update existing record
        result = await supabase
          .from("farm_finances")
          .update({
            expense_categories: body.expense_categories,
            other_expenses: body.other_expenses || [],
            total_expense: body.total_expense || 0,
            predicted_yield: body.predicted_yield,
            yield_unit: body.yield_unit || "kg",
            predicted_price: body.predicted_price,
            price_unit: body.price_unit || "per kg",
            crop_type: body.crop_type,
            expected_revenue: body.expected_revenue,
            net_profit_loss: body.net_profit_loss,
            profit_loss_percentage: body.profit_loss_percentage,
            break_even_price: body.break_even_price,
          })
          .eq("user_id", userId)
          .select()
          .single();
      } else {
        // Create new record
        result = await supabase
          .from("farm_finances")
          .insert({
            user_id: userId,
            expense_categories: body.expense_categories,
            other_expenses: body.other_expenses || [],
            total_expense: body.total_expense || 0,
            predicted_yield: body.predicted_yield,
            yield_unit: body.yield_unit || "kg",
            predicted_price: body.predicted_price,
            price_unit: body.price_unit || "per kg",
            crop_type: body.crop_type,
            expected_revenue: body.expected_revenue,
            net_profit_loss: body.net_profit_loss,
            profit_loss_percentage: body.profit_loss_percentage,
            break_even_price: body.break_even_price,
          })
          .select()
          .single();
      }

      if (result.error) {
        console.error("Error saving finances:", result.error);
        return new Response(
          JSON.stringify({ error: "Failed to save finance data", details: result.error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Finance data ${existing ? "updated" : "created"} for user: ${userId}`);
      
      return new Response(
        JSON.stringify({ 
          data: result.data, 
          message: existing ? "Finance data updated" : "Finance data created" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE - Clear user's finance data
    if (req.method === "DELETE") {
      const { error } = await supabase
        .from("farm_finances")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("Error deleting finances:", error);
        return new Response(
          JSON.stringify({ error: "Failed to delete finance data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message: "Finance data deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
