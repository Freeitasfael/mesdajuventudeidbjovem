import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, Copy, Clock, AlertCircle, Download, Share2 } from "lucide-react";
import { useSelection } from "@/hooks/useSelection";
import { SiteHeader } from "@/components/SiteHeader";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface OrderStatus {
  order: {
    id: string;
    status: "pending" | "paid" | "expired" | "cancelled";
    total_cents: number;
    expires_at: string;
    created_at?: string;
    buyer_name?: string | null;
    numbers?: number[];
  };
  payment: {
    id: string;
    status: "pending" | "approved" | "rejected" | "refunded" | "expired";
    qr_code: string | null;
    qr_code_base64: string | null;
    amount_cents: number;
    provider_payment_id?: string | null;
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
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [generatingReceipt, setGeneratingReceipt] = useState(false);

  const renderReceiptCanvas = async () => {
    if (!receiptRef.current) return null;
    receiptRef.current.style.display = "block";
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      return canvas;
    } finally {
      receiptRef.current.style.display = "none";
    }
  };

  const downloadReceiptPdf = async () => {
    if (!data) return;
    setGeneratingReceipt(true);
    try {
      const canvas = await renderReceiptCanvas();
      if (!canvas) return;
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`comprovante-${data.order.id.slice(0, 8)}.pdf`);
      toast.success("Comprovante baixado!");
    } catch (e) {
      console.log("[Pagamento] pdf error", e);
      toast.error("Não foi possível gerar o PDF");
    } finally {
      setGeneratingReceipt(false);
    }
  };

  const shareReceipt = async () => {
    if (!data) return;
    setGeneratingReceipt(true);
    try {
      const canvas = await renderReceiptCanvas();
      if (!canvas) return;
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/png"),
      );
      if (!blob) throw new Error("blob_failed");
      const shortId = data.order.id.slice(0, 8);
      const fileName = `comprovante-${shortId}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const shareText = `Comprovante do pedido ${shortId} - Rifa IDB Jovem`;

      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };

      // 1) Mobile: usa share nativo com arquivo (usuário escolhe WhatsApp e envia para qualquer contato)
      if (nav.canShare && nav.canShare({ files: [file] }) && typeof navigator.share === "function") {
        try {
          await navigator.share({
            files: [file],
            title: "Comprovante Rifa",
            text: shareText,
          });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }

      // 2) Desktop: baixa o comprovante e abre o WhatsApp Web para o usuário anexar e enviar
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const waUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
      toast.success("Comprovante baixado! Anexe no WhatsApp para enviar.");
    } catch (e) {
      console.log("[Pagamento] share error", e);
      toast.error("Não foi possível compartilhar");
    } finally {
      setGeneratingReceipt(false);
    }
  };


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

  const createPayment = useCallback(async (overrideMethod?: "pix" | "card") => {
    if (!data) return;
    if (data.order.status !== "pending") return;
    const useMethod = overrideMethod ?? "pix";
    if (useMethod === "pix" && data.payment) return;

    setCreating(true);
    setError(null);

    const timeoutMs = 20000;
    const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
      setTimeout(() => resolve({ timeout: true }), timeoutMs),
    );

    try {
      const result = await Promise.race([
        supabase.functions.invoke("create-payment", {
          body: { order_id: data.order.id, method: useMethod, return_url: window.location.href },
        }),
        timeoutPromise,
      ]);

      if ("timeout" in result) {
        setError("O Mercado Pago está demorando para responder. Tente novamente.");
        return;
      }

      const { data: res, error: err } = result;
      if (err) {
        console.log("[Pagamento] create-payment error", err);
        const ctx = (err as { context?: Response }).context;
        let msg = "Não foi possível gerar o pagamento. Tente novamente.";
        try {
          const body = ctx ? await ctx.json() : null;
          if (body?.error === "mp_not_configured") msg = body.message;
          else if (body?.message) msg = body.message;
        } catch { /* ignore */ }
        setError(msg);
        return;
      }
      if (useMethod === "card" && res?.init_point) {
        window.location.href = res.init_point;
        return;
      }
      if (res?.qr_code) {
        await loadStatus();
      } else if (useMethod === "pix") {
        setError("Resposta inválida do servidor. Tente novamente.");
      }
    } catch (e) {
      console.log("[Pagamento] create-payment exception", e);
      setError("Falha de conexão ao gerar o pagamento. Tente novamente.");
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
      <SiteHeader
        breadcrumbs={[
          { label: "Início", to: "/rifa" },
          { label: "Acompanhar", to: "/acompanhar" },
          { label: "Pagamento PIX" },
        ]}
      />
      <div className="container py-6">
        <h1 className="text-2xl font-bold">Pagamento PIX</h1>
      </div>

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
                <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                  <Button onClick={downloadReceiptPdf} disabled={generatingReceipt}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar comprovante (PDF)
                  </Button>
                  <Button variant="outline" onClick={shareReceipt} disabled={generatingReceipt}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar
                  </Button>
                </div>
                <div className="pt-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/acompanhar">Ver meus números</Link>
                  </Button>
                </div>
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
                    <Button variant="outline" onClick={() => createPayment("pix")}>
                      Tentar novamente
                    </Button>
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

                {/* Alternativa: pagar com cartão */}
                <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    Prefere pagar com cartão? Até 12x (juros do MP).
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => createPayment("card")}
                    disabled={creating}
                  >
                    Pagar com cartão de crédito
                  </Button>
                </div>
              </div>
            )}

            <p className="mt-6 text-center text-xs text-muted-foreground font-mono">
              Pedido: {data.order.id.slice(0, 8)}
            </p>
          </>
        )}
      </section>

      {/* Comprovante oculto (renderizado para PDF/imagem) */}
      {data && (
        <div
          ref={receiptRef}
          style={{ display: "none", position: "absolute", left: -9999, top: 0, width: 640, padding: 40, background: "#ffffff", color: "#111", fontFamily: "system-ui, -apple-system, sans-serif" }}
        >
          <div style={{ borderBottom: "2px solid #0ea5e9", paddingBottom: 16, marginBottom: 24 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Comprovante de pagamento</h2>
            <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>Rifa Digital · PIX</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "12px 16px", fontSize: 14 }}>
            <span style={{ color: "#666" }}>Status</span>
            <span style={{ fontWeight: 700, color: data.order.status === "paid" ? "#16a34a" : "#666" }}>
              {data.order.status === "paid" ? "✓ PAGO" : data.order.status.toUpperCase()}
            </span>
            <span style={{ color: "#666" }}>Pedido</span>
            <span style={{ fontFamily: "monospace" }}>{data.order.id}</span>
            <span style={{ color: "#666" }}>Comprador</span>
            <span>{data.order.buyer_name ?? "—"}</span>
            <span style={{ color: "#666" }}>Data</span>
            <span>{data.order.created_at ? new Date(data.order.created_at).toLocaleString("pt-BR") : "—"}</span>
            <span style={{ color: "#666" }}>Valor</span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{formatBRL(data.order.total_cents)}</span>
            {data.payment?.provider_payment_id && (
              <>
                <span style={{ color: "#666" }}>ID Mercado Pago</span>
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>{data.payment.provider_payment_id}</span>
              </>
            )}
          </div>
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>
              Números ({data.order.numbers?.length ?? 0})
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(data.order.numbers ?? []).map((n) => (
                <span key={n} style={{
                  display: "inline-block", padding: "4px 10px", background: "#f1f5f9",
                  borderRadius: 6, fontFamily: "monospace", fontSize: 13, fontWeight: 600,
                }}>
                  {n.toString().padStart(3, "0")}
                </span>
              ))}
            </div>
          </div>
          <p style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #e5e7eb", fontSize: 11, color: "#999", textAlign: "center" }}>
            Documento gerado em {new Date().toLocaleString("pt-BR")} · Guarde este comprovante.
          </p>
        </div>
      )}
    </main>
  );
};

export default Pagamento;
