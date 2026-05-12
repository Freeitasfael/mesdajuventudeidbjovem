// reconcile-payments: pega pagamentos pendentes e consulta o MP para atualizar status.
// Cobre webhooks perdidos. Roda via cron. Usa backoff exponencial por pagamento
// e registra auditoria em reconcile_runs e payment_events.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const mapStatus = (s: string): "pending" | "approved" | "rejected" | "refunded" | "expired" => {
  switch (s) {
    case "approved": return "approved";
    case "rejected":
    case "cancelled": return "rejected";
    case "refunded":
    case "charged_back": return "refunded";
    case "expired": return "expired";
    default: return "pending";
  }
};

// Backoff exponencial em segundos por número de tentativas já feitas.
// 30s, 1m, 2m, 5m, 10m, 30m, 1h... limitado a 1h.
const BACKOFF_SECONDS = [30, 60, 120, 300, 600, 1800, 3600];
const nextDelaySec = (attemptsDone: number) =>
  BACKOFF_SECONDS[Math.min(attemptsDone, BACKOFF_SECONDS.length - 1)];

// Máximo de tentativas antes de marcar como erro definitivo e parar de tentar.
const MAX_ATTEMPTS = 20;

async function logEvent(
  admin: SupabaseClient,
  level: "info" | "warn" | "error",
  event_type: string,
  message: string,
  ctx: {
    order_id?: string | null;
    payment_id?: string | null;
    provider_payment_id?: string | null;
    details?: unknown;
  } = {},
) {
  console.log(JSON.stringify({
    fn: "reconcile-payments", level, event_type, message,
    order_id: ctx.order_id ?? null,
    payment_id: ctx.payment_id ?? null,
    provider_payment_id: ctx.provider_payment_id ?? null,
    details: ctx.details ?? null,
  }));
  try {
    await admin.from("payment_events").insert({
      level, event_type,
      order_id: ctx.order_id ?? null,
      payment_id: ctx.payment_id ?? null,
      provider_payment_id: ctx.provider_payment_id ?? null,
      message,
      details: ctx.details ?? null,
    });
  } catch (e) {
    console.log(JSON.stringify({ fn: "reconcile-payments", level: "warn", event_type: "log_persist_failed", err: String(e) }));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = new Date();
  const result = {
    expired_orders: 0,
    freed_numbers: 0,
    candidates: 0,
    processed: 0,
    reconciled: 0,
    approved: 0,
    skipped: 0,
    errors: 0,
  };
  let notes: string | null = null;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(
      JSON.stringify({ error: "server_misconfig" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Cria a linha de auditoria já no início para sabermos se o run sequer chegou a rodar
  const { data: runRow } = await admin
    .from("reconcile_runs")
    .insert({ started_at: startedAt.toISOString() })
    .select("id")
    .single();
  const runId = runRow?.id as string | undefined;

  try {
    // 1) Expirar reservas vencidas (10min)
    const { data: expRes, error: expErr } = await admin.rpc("expire_reservations");
    if (expErr) {
      await logEvent(admin, "error", "expire_reservations_failed", expErr.message);
      result.errors++;
    } else if (expRes && Array.isArray(expRes) && expRes[0]) {
      result.expired_orders = expRes[0].expired_orders ?? 0;
      result.freed_numbers = expRes[0].freed_numbers ?? 0;
    }

    // 2) Reconciliar pagamentos pendentes
    if (!MP_ACCESS_TOKEN) {
      notes = "MP_ACCESS_TOKEN ausente — reconciliação ignorada";
      await logEvent(admin, "warn", "mp_not_configured", notes);
    } else {
      const nowIso = new Date().toISOString();
      // Pega apenas pagamentos pendentes cuja próxima tentativa já chegou
      const { data: pendings, error: pendErr } = await admin
        .from("payments")
        .select("id, order_id, provider_payment_id, reconcile_attempts")
        .eq("status", "pending")
        .not("provider_payment_id", "is", null)
        .lt("reconcile_attempts", MAX_ATTEMPTS)
        .or(`next_reconcile_at.is.null,next_reconcile_at.lte.${nowIso}`)
        .order("next_reconcile_at", { ascending: true, nullsFirst: true })
        .limit(50);

      if (pendErr) {
        await logEvent(admin, "error", "list_pendings_failed", pendErr.message);
        result.errors++;
      } else {
        result.candidates = (pendings ?? []).length;

        for (const p of pendings ?? []) {
          if (!p.provider_payment_id) {
            result.skipped++;
            continue;
          }
          result.processed++;
          const attemptsDone = (p.reconcile_attempts ?? 0) + 1;
          const lastReconcileAt = new Date().toISOString();

          try {
            const mpRes = await fetch(
              `https://api.mercadopago.com/v1/payments/${p.provider_payment_id}`,
              { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
            );

            if (!mpRes.ok) {
              const errText = await mpRes.text().catch(() => "");
              const isFinal = mpRes.status === 404;
              const nextAt = isFinal
                ? null
                : new Date(Date.now() + nextDelaySec(attemptsDone) * 1000).toISOString();

              await admin
                .from("payments")
                .update({
                  reconcile_attempts: attemptsDone,
                  last_reconcile_at: lastReconcileAt,
                  next_reconcile_at: nextAt,
                  last_reconcile_error: `HTTP ${mpRes.status}: ${errText.slice(0, 300)}`,
                })
                .eq("id", p.id);

              await logEvent(
                admin,
                isFinal ? "warn" : "error",
                "reconcile_mp_fetch_failed",
                `MP retornou HTTP ${mpRes.status} (tentativa ${attemptsDone})`,
                { order_id: p.order_id, payment_id: p.id, provider_payment_id: p.provider_payment_id,
                  details: { http_status: mpRes.status, attempt: attemptsDone, next_at: nextAt } },
              );

              if (isFinal) result.skipped++;
              else result.errors++;
              continue;
            }

            const mpData = await mpRes.json();
            const newStatus = mapStatus(mpData.status);

            if (newStatus === "pending") {
              const nextAt = new Date(Date.now() + nextDelaySec(attemptsDone) * 1000).toISOString();
              await admin
                .from("payments")
                .update({
                  reconcile_attempts: attemptsDone,
                  last_reconcile_at: lastReconcileAt,
                  next_reconcile_at: nextAt,
                  last_reconcile_error: null,
                })
                .eq("id", p.id);
              result.skipped++;
              continue;
            }

            // Status mudou — atualiza e zera retries
            await admin
              .from("payments")
              .update({
                status: newStatus,
                raw: mpData,
                reconcile_attempts: attemptsDone,
                last_reconcile_at: lastReconcileAt,
                next_reconcile_at: null,
                last_reconcile_error: null,
              })
              .eq("id", p.id);
            result.reconciled++;

            await logEvent(admin, "info", "reconcile_status_synced",
              `Reconciliação: status ${newStatus} (tentativa ${attemptsDone})`,
              { order_id: p.order_id, payment_id: p.id, provider_payment_id: p.provider_payment_id,
                details: { mp_status: mpData.status, mp_status_detail: mpData.status_detail, attempt: attemptsDone } });

            if (newStatus === "approved") {
              const { error: confErr } = await admin.rpc("confirm_payment", { _order_id: p.order_id });
              if (confErr) {
                await logEvent(admin, "error", "confirm_failed",
                  `Falha ao confirmar pedido: ${confErr.message}`,
                  { order_id: p.order_id, payment_id: p.id, provider_payment_id: p.provider_payment_id });
                result.errors++;
              } else {
                result.approved++;
                await logEvent(admin, "info", "order_confirmed", "Pedido confirmado via reconciliação",
                  { order_id: p.order_id, payment_id: p.id, provider_payment_id: p.provider_payment_id });
              }
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const nextAt = new Date(Date.now() + nextDelaySec(attemptsDone) * 1000).toISOString();
            await admin
              .from("payments")
              .update({
                reconcile_attempts: attemptsDone,
                last_reconcile_at: lastReconcileAt,
                next_reconcile_at: nextAt,
                last_reconcile_error: msg.slice(0, 300),
              })
              .eq("id", p.id);
            await logEvent(admin, "error", "reconcile_loop_error", msg,
              { order_id: p.order_id, payment_id: p.id, provider_payment_id: p.provider_payment_id,
                details: { attempt: attemptsDone, next_at: nextAt } });
            result.errors++;
          }
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await logEvent(admin, "error", "reconcile_unexpected", message);
    result.errors++;
    notes = message;
  } finally {
    const finishedAt = new Date();
    const duration = finishedAt.getTime() - startedAt.getTime();
    if (runId) {
      await admin.from("reconcile_runs").update({
        finished_at: finishedAt.toISOString(),
        duration_ms: duration,
        expired_orders: result.expired_orders,
        freed_numbers: result.freed_numbers,
        candidates: result.candidates,
        processed: result.processed,
        reconciled: result.reconciled,
        approved: result.approved,
        skipped: result.skipped,
        errors: result.errors,
        notes,
      }).eq("id", runId);
    }
    console.log(JSON.stringify({ fn: "reconcile-payments", event_type: "run_done", duration_ms: duration, ...result }));
  }

  return new Response(JSON.stringify({ run_id: runId, ...result }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
