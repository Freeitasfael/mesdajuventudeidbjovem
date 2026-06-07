// mp-public-key: returns the Mercado Pago PUBLIC keys (safe for client SDK).
// Public keys are not secrets — they identify the MP account on the browser side.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      rifa: Deno.env.get("MP_PUBLIC_KEY") ?? null,
      entrada: Deno.env.get("MP_PUBLIC_KEY_ENTRADA") ?? null,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
