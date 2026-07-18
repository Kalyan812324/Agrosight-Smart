import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCropPredictionsTool from "./tools/list-crop-predictions";
import listFarmFinancesTool from "./tools/list-farm-finances";
import getMandiPricesTool from "./tools/get-mandi-prices";

// Build the OAuth issuer from the project ref (Vite inlines this at build time,
// so the entry stays import-safe). Never derive from SUPABASE_URL — mcp-js
// verifies the issuer against the direct supabase.co host in the discovery doc.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "agrosight-mcp",
  title: "AgroSight MCP",
  version: "0.1.0",
  instructions:
    "AgroSight tools for Indian farmers. Read the signed-in user's saved crop yield predictions, farm finance records, and the latest mandi (market) prices.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCropPredictionsTool, listFarmFinancesTool, getMandiPricesTool],
});