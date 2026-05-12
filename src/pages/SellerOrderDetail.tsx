import { useEffect, useState, useCallback } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/SiteHeader";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MessageCircle,
  QrCode,
  XCircle,
} from "lucide-react";

interface OrderDetail {
  order_id: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  total_cents: number;
  created_at: string;
  expires_at: string;
  buyer_name: string;
  buyer_phone: string;
  numbers: number[];
  payment_id: string | null;
  payment_status: string | null;
  qr_code: string | null;
  qr_code_base64: string | null;
  provider_payment_id: string | null;
}

const formatBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const formatDate = (s: string) =>
  new Date(s).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  paid: { label: "Pago", cls: "bg-emerald-500/15 text-emerald-600", Icon: CheckCircle2 },
  pending: { label: "Pendente", cls: "bg-yellow-500/15 text-yellow-700", Icon: Clock },
  expired: { label: "Expirado", cls: "bg-muted text-muted-foreground", Icon: XCircle },
  cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive", Icon: XCircle },
};

const SellerOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.title = "Detalhes do pedido — Painel do Revendedor";
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setAuthChecked(true);
    });
  }, []);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_seller_order", { _order_id: orderId });
    if (error) {
      console.log("[SellerOrderDetail] error", error);
      toast.error("Não foi possível carregar o pedido");
      setLoading(false);
      return;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      setNotFound(true);
    } else {
      setOrder(row as OrderDetail);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  // Realtime: atualiza quando o status do pedido/pagamento muda
  useEffect(() => {
    if (!orderId || !authed) return;
    const ch = supabase
      .channel(`seller-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `order_id=eq.${orderId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId, authed, load]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando…</p>
      </main>
    );
  }
  if (!authed) return <Navigate to={`/auth?next=/seller/pedido/${orderId}`} replace />;

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader
          breadcrumbs={[
            { label: "Início", to: "/rifa" },
            { label: "Painel do Revendedor", to: "/seller" },
            { label: "Pedido" },
          ]}
        />
        <main className="container max-w-xl py-12 text-center">
          <Card className="space-y-3 p-8">
            <h1 className="text-xl font-bold">Pedido não encontrado</h1>
            <p className="text-sm text-muted-foreground">
              Esse pedido não existe ou não foi gerado pelo seu link de divulgação.
            </p>
            <Button asChild>
              <Link to="/seller">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao painel
              </Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  const s = order ? STATUS[order.status] ?? STATUS.pending : null;
  const waLink =
    order && order.status === "pending"
      ? `https://wa.me/55${order.buyer_phone}?text=${encodeURIComponent(
          `Olá ${order.buyer_name.split(" ")[0]}, vi que sua reserva da Rifa IDB Jovem está pendente. Posso te ajudar a finalizar o PIX?`,
        )}`
      : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        breadcrumbs={[
          { label: "Início", to: "/rifa" },
          { label: "Painel do Revendedor", to: "/seller" },
          { label: order ? `Pedido ${order.order_id.slice(0, 8)}` : "Pedido" },
        ]}
      />
      <main className="container max-w-3xl space-y-5 py-8">
        <Button asChild variant="ghost" size="sm">
          <Link to="/seller">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>

        {loading || !order ? (
          <Card className="space-y-4 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ) : (
          <>
            <Card className="space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Pedido
                  </p>
                  <h1 className="text-xl font-bold sm:text-2xl">
                    #{order.order_id.slice(0, 8)}
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Criado em {formatDate(order.created_at)}
                  </p>
                </div>
                {s && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}
                  >
                    <s.Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Comprador" value={order.buyer_name} />
                <Detail label="Telefone" value={order.buyer_phone} />
                <Detail label="Total" value={formatBRL(order.total_cents)} />
                <Detail
                  label="Expira em"
                  value={order.status === "pending" ? formatDate(order.expires_at) : "—"}
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(order.order_id, "ID do pedido")}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copiar ID do pedido
                </Button>
                {order.provider_payment_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(order.provider_payment_id!, "ID Mercado Pago")}
                  >
                    <Copy className="mr-2 h-4 w-4" /> Copiar ID MP
                  </Button>
                )}
                {order.status === "pending" && (
                  <Button asChild size="sm">
                    <Link to={`/pagamento/${order.order_id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" /> Acessar PIX
                    </Link>
                  </Button>
                )}
                {waLink && (
                  <Button asChild variant="outline" size="sm">
                    <a href={waLink} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" /> Falar com cliente
                    </a>
                  </Button>
                )}
              </div>
            </Card>

            <Card className="space-y-3 p-6">
              <h2 className="text-sm font-semibold">
                Números comprados ({order.numbers.length})
              </h2>
              {order.numbers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum número associado.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {order.numbers.map((n) => (
                    <span
                      key={n}
                      className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold"
                    >
                      {n.toString().padStart(3, "0")}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {order.status === "pending" && order.qr_code && (
              <Card className="space-y-3 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <QrCode className="h-4 w-4 text-primary" /> PIX Copia e Cola
                </div>
                {order.qr_code_base64 && (
                  <img
                    src={`data:image/png;base64,${order.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="mx-auto h-44 w-44 rounded-md border border-border bg-white p-2"
                  />
                )}
                <code className="block max-h-32 overflow-auto break-all rounded-md bg-muted p-3 text-[11px]">
                  {order.qr_code}
                </code>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => copy(order.qr_code!, "Código PIX")}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copiar código PIX
                </Button>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-sm font-medium">{value}</p>
  </div>
);

export default SellerOrderDetail;
