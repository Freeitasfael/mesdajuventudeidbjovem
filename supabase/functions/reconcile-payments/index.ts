// reconcile-payments: pega pagamentos pendentes e consulta o MP para atualizar status.
// Cobre webhooks perdidos. Roda via cron a cada 2 minutos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const mapStatus = (s: string): "pending" | "approved" | "rejected" | "refunded" | "expired" => {
  switch (s) {
    case "approved":
      return "approved";
    case "rejected":
    case "cancelled":
      return "rejected";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const result = {
    expired: { orders: 0, numbers: 0 },
    reconciled: 0,
    approved: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("server_misconfig");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // 1) Expire reservations past their 10-min window
    const { data: expRes, error: expErr } = await admin.rpc("expire_reservations");
    if (expErr) {
      console.log("[reconcile] expire error", expErr);
      result.errors++;
    } else if (expRes && Array.isArray(expRes) && expRes[0]) {
      result.expired.orders = expRes[0].expired_orders ?? 0;
      result.expired.numbers = expRes[0].freed_numbers ?? 0;
    }

    // 2) Reconcile pending payments against Mercado Pago
    if (MP_ACCESS_TOKEN) {
      // Limit batch size + only reconcile recent pending payments
      const { data: pendings, error: pendErr } = await admin
        .from("payments")
        .select("id, order_id, provider_payment_id, status")
        .eq("status", "pending")
        .not("provider_payment_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (pendErr) {
        console.log("[reconcile] list error", pendErr);
        result.errors++;
      } else {
        for (const p of pendings ?? []) {
          if (!p.provider_payment_id) {
            result.skipped++;
            continue;
          }
          try {
            const mpRes = await fetch(
              `https://api.mercadopago.com/v1/payments/${p.provider_payment_id}`,
              { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
            );
            if (!mpRes.ok) {
              if (mpRes.status === 404) {
                result.skipped++;
                continue;
              }
              console.log("[reconcile] mp error", p.id, mpRes.status);
              result.errors++;
              continue;
            }
            const mpData = await mpRes.json();
            const newStatus = mapStatus(mpData.status);
            if (newStatus === "pending") {
              result.skipped++;
              continue;
            }

            await admin
              .from("payments")
              .update({ status: newStatus, raw: mpData })
              .eq("id", p.id);
            result.reconciled++;

            if (newStatus === "approved") {
              const { error: confErr } = await admin.rpc("confirm_payment", {
                _order_id: p.order_id,
              });
              if (confErr) {
                console.log("[reconcile] confirm error", p.order_id, confErr);
                result.errors++;
              } else {
                result.approved++;
              }
            }
          } catch (e) {
            console.log("[reconcile] payment loop error", p.id, e);
            result.errors++;
          }
        }
      }
    } else {
      console.log("[reconcile] MP_ACCESS_TOKEN not set, skipping reconciliation");
    }

    console.log("[reconcile] done", result);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.log("[reconcile] unexpected", message);
    return new Response(
      JSON.stringify({ error: "internal_error", message, ...result }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
