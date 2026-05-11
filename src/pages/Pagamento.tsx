import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, Copy, Clock, AlertCircle } from "lucide-react";
import { useSelection } from "@/hooks/useSelection";

interface OrderStatus {
  order: {
    id: string;
    status: "pending" | "paid" | "expired" | "cancelled";
    total_cents: number;
    expires_at: string;
  };
  payment: {
    id: string;
    status: "pending" | "approved" | "rejected" | "refunded" | "expired";
    qr_code: string | null;
    qr_code_base64: string | null;
    amount_cents: number;
  } | null;
}

const formatBRL = (cents: number) =>
  `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

const Pagamento = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { clear } = useSelection();
  const [data, setData] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef<number | null>(null);

  const loadStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const r = await fetch(
        `${SUPA_URL}/functions/v1/order-status?order_id=${orderId}`,
        { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY } },
      );
      const json = (await r.json()) as OrderStatus | { error: string };
      if ("error" in json) {
        setError(json.error);
      } else {
        setData(json);
        setError(null);
      }
    } catch (e) {
      console.log("[Pagamento] status error", e);
      setError("Não foi possível consultar o pedido");
    }
  }, [orderId]);

  // Initial load
  useEffect(() => {
    document.title = "Pagamento PIX — Rifa Digital";
    setLoading(true);
    loadStatus().finally(() => setLoading(false));
  }, [loadStatus]);

  const createPayment = useCallback(async () => {
    if (!data) return;
    if (data.order.status !== "pending") return;
    if (data.payment) return;

    setCreating(true);
    setError(null);

    const timeoutMs = 20000;
    const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
      setTimeout(() => resolve({ timeout: true }), timeoutMs),
    );

    try {
      const result = await Promise.race([
        supabase.functions.invoke("create-payment", {
          body: { order_id: data.order.id },
        }),
        timeoutPromise,
      ]);

      if ("timeout" in result) {
        setError(
          "O Mercado Pago está demorando para responder. Tente novamente.",
        );
        return;
      }

      const { data: res, error: err } = result;
      if (err) {
        console.log("[Pagamento] create-payment error", err);
        const ctx = (err as { context?: Response }).context;
        let msg = "Não foi possível gerar o PIX. Tente novamente.";
        try {
          const body = ctx ? await ctx.json() : null;
          if (body?.error === "mp_not_configured") msg = body.message;
          else if (body?.message) msg = body.message;
        } catch {
          // ignore
        }
        setError(msg);
        return;
      }
      if (res?.qr_code) {
        await loadStatus();
      } else {
        setError("Resposta inválida do servidor. Tente novamente.");
      }
    } catch (e) {
      console.log("[Pagamento] create-payment exception", e);
      setError("Falha de conexão ao gerar o PIX. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }, [data, loadStatus]);

  // Auto-create payment if order is pending and has none yet
  useEffect(() => {
    if (!data || creating || error) return;
    if (data.order.status !== "pending") return;
    if (data.payment) return;
    createPayment();
  }, [data, creating, error, createPayment]);

  // Poll while pending
  useEffect(() => {
    if (!data) return;
    if (data.order.status !== "pending") return;

    pollRef.current = window.setInterval(() => {
      loadStatus();
    }, 5000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [data, loadStatus]);

  // Clear cart on successful payment
  useEffect(() => {
    if (data?.order.status === "paid") {
      clear();
      if (pollRef.current) window.clearInterval(pollRef.current);
    }
  }, [data?.order.status, clear]);

  // Countdown ticker
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const expiresMs = data ? new Date(data.order.expires_at).getTime() - now : 0;
  const expired = data && data.order.status === "pending" && expiresMs <= 0;

  const copyPix = async () => {
    if (!data?.payment?.qr_code) return;
    try {
      await navigator.clipboard.writeText(data.payment.qr_code);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const formatTime = (ms: number) => {
    if (ms <= 0) return "00:00";
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60).toString().padStart(2, "0");
    const s = (total % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <Link to="/rifa" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar para rifa
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Pagamento PIX</h1>
        </div>
      </header>

      <section className="container py-8 max-w-xl">
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {!loading && error && !data && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" onClick={() => loadStatus()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Status banners */}
            {data.order.status === "paid" && (
              <div className="rounded-lg border border-number-available/40 bg-number-available/10 p-6 text-center space-y-3 mb-6">
                <Check className="h-12 w-12 mx-auto text-number-available" />
                <h2 className="text-xl font-bold">Pagamento confirmado!</h2>
                <p className="text-sm text-muted-foreground">
                  Seus números foram registrados. Boa sorte!
                </p>
                <Button asChild>
                  <Link to="/rifa">Ver rifa</Link>
                </Button>
              </div>
            )}

            {(data.order.status === "expired" || expired) && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center space-y-3 mb-6">
                <Clock className="h-10 w-10 mx-auto text-destructive" />
                <h2 className="text-lg font-bold">Reserva expirada</h2>
                <p className="text-sm text-muted-foreground">
                  Os números foram liberados. Faça uma nova reserva.
                </p>
                <Button asChild>
                  <Link to="/rifa">Voltar para rifa</Link>
                </Button>
              </div>
            )}

            {data.order.status === "cancelled" && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center space-y-3 mb-6">
                <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
                <h2 className="text-lg font-bold">Pedido cancelado</h2>
                <Button asChild>
                  <Link to="/rifa">Voltar para rifa</Link>
                </Button>
              </div>
            )}

            {data.order.status === "pending" && !expired && (
              <div className="space-y-6">
                {/* Countdown + total */}
                <div className="rounded-lg border border-border bg-card p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">
                      {formatBRL(data.order.total_cents)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      Expira em
                    </p>
                    <p className="text-xl font-bold font-mono tabular-nums">
                      {formatTime(expiresMs)}
                    </p>
                  </div>
                </div>

                {/* QR Code */}
                {creating || (!data.payment && !error) ? (
                  <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3">
                    <Skeleton className="h-64 w-64 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Gerando código PIX...
                    </p>
                  </div>
                ) : error ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
                    <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
                    <p className="text-sm">{error}</p>
                  </div>
                ) : data.payment?.qr_code_base64 ? (
                  <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${data.payment.qr_code_base64}`}
                        alt="QR Code PIX"
                        className="w-64 h-64 rounded-md"
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Abra o app do seu banco e escaneie o QR Code, ou copie o código abaixo:
                    </p>
                    {data.payment.qr_code && (
                      <div className="space-y-2">
                        <div className="rounded-md bg-muted p-3 font-mono text-xs break-all">
                          {data.payment.qr_code}
                        </div>
                        <Button onClick={copyPix} variant="outline" className="w-full">
                          {copied ? (
                            <>
                              <Check className="h-4 w-4 mr-2" /> Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" /> Copiar código PIX
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-center text-muted-foreground pt-2 border-t border-border">
                      A confirmação aparece automaticamente assim que o banco processar.
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            <p className="mt-6 text-center text-xs text-muted-foreground font-mono">
              Pedido: {data.order.id.slice(0, 8)}
            </p>
          </>
        )}
      </section>
    </main>
  );
};

export default Pagamento;
