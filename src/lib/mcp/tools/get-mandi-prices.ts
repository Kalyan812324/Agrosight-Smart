import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_mandi_prices",
  title: "Get mandi prices",
  description: "Fetch latest Indian mandi (market) prices, optionally filtered by commodity or state.",
  inputSchema: {
    commodity: z.string().trim().min(1).optional().describe("Optional commodity filter, e.g. 'Rice'."),
    state: z.string().trim().min(1).optional().describe("Optional state filter, e.g. 'Telangana'."),
    limit: z.number().int().min(1).max(50).default(20).describe("Max rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ commodity, state, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("mandi_prices")
      .select("commodity, market, state, min_price, max_price, modal_price, arrival_date")
      .order("arrival_date", { ascending: false })
      .limit(limit);
    if (commodity) query = query.ilike("commodity", `%${commodity}%`);
    if (state) query = query.ilike("state", `%${state}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { prices: data ?? [] },
    };
  },
});