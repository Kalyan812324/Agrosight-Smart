import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, ShieldCheck, ShieldX } from "lucide-react";

// Supabase's OAuth 2.1 auth namespace is in beta; type it locally rather than
// depend on it being in the generated client types.
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
function getOAuth(): OAuthNs | null {
  return (supabase.auth as unknown as { oauth?: OAuthNs }).oauth ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const oauth = getOAuth();
      if (!oauth) return setError("OAuth 2.1 is not enabled on this Supabase project. Please enable the OAuth 2.1 authorization server in the Supabase dashboard.");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const oauth = getOAuth();
    if (!oauth) return;
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) { setBusy(false); return setError(error.message); }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); return setError("No redirect returned by the authorization server."); }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-12">
      <Card className="w-full max-w-md border-border/50 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-gradient-primary p-3 rounded-xl w-fit">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle>Authorize access to AgroSight</CardTitle>
          <CardDescription>Review this request before approving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          )}
          {!error && !details && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          )}
          {details && (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-semibold">{details.client?.name ?? "An external client"}</span>{" "}
                is requesting access to your AgroSight account.
              </p>
              <p className="text-sm text-muted-foreground">
                It will be able to act as you when calling AgroSight MCP tools
                (reading your crop predictions, farm finances, and mandi prices).
              </p>
            </div>
          )}
        </CardContent>
        {details && !error && (
          <CardFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
              <ShieldX className="h-4 w-4 mr-2" /> Deny
            </Button>
            <Button className="flex-1 bg-gradient-primary" disabled={busy} onClick={() => decide(true)}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Approve
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}