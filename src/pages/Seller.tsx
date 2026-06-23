import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/SiteHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  LogOut,
  MessageCircle,
  Radio,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

interface SellerInfo {
  id: string;
  name: string;
  ref_code: string;
  phone: string | null;
}

interface SellerStats {
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  total_numbers_paid: number;
  total_revenue_cents: number;
  pending_revenue_cents: number;
}

interface SellerOrder {
  order_id: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  total_cents: number;
  created_at: string;
  expires_at: string;
  buyer_name: string;
  buyer_phone: string;
  numbers: number[];
}

const formatBRL = (cents: number) =>
  `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_TONE: Record<string, string> = {
  paid: "border-number-available/40 bg-number-available/10 text-number-available",
  pending: "border-primary/40 bg-primary/10 text-primary",
  expired: "border-destructive/40 bg-destructive/5 text-destructive",
  cancelled: "border-destructive/40 bg-destructive/5 text-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  expired: "Expirado",
  cancelled: "Cancelado",
};

const Seller = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "expired" | "cancelled">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [realtimeOk, setRealtimeOk] = useState(false);
  const ordersRef = useRef<SellerOrder[]>([]);

  useEffect(() => {
    document.title = "Painel do Revendedor — Rifa IDB Jovem";
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sellerData } = await supabase
        .rpc("get_my_seller")
        .maybeSingle();
      if (!sellerData) {
        setSeller(null);
        setLoading(false);
        return;
      }
      setSeller(sellerData as SellerInfo);

      const [statsRes, ordersRes] = await Promise.all([
        supabase.rpc("get_my_seller_stats").maybeSingle(),
        supabase.rpc("get_my_seller_orders"),
      ]);
      if (statsRes.data) setStats(statsRes.data as SellerStats);
      if (ordersRes.data) {
        const next = ordersRes.data as SellerOrder[];
        setOrders(next);
        ordersRef.current = next;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  // Realtime: alerta quando algum pedido do vendedor mudar de status
  useEffect(() => {
    if (!authed || !seller) return;
    const ch = supabase
      .channel(`seller-orders-${seller.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `seller_id=eq.${seller.id}` },
        (payload) => {
          const next = payload.new as SellerOrder;
          const prev = ordersRef.current.find((o) => o.order_id === next.order_id);
          if (prev && prev.status !== next.status) {
            if (next.status === "paid") {
              toast.success(`💰 Pagamento aprovado! ${prev.buyer_name ?? "Cliente"} concluiu a compra.`);
            } else if (next.status === "expired") {
              toast.warning(`⏱️ Reserva expirou (${prev.buyer_name ?? "Cliente"}).`);
            } else if (next.status === "cancelled") {
              toast.warning(`Pedido cancelado (${prev.buyer_name ?? "Cliente"}).`);
            }
          }
          load();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `seller_id=eq.${seller.id}` },
        () => {
          toast.info("🆕 Nova reserva pelo seu link!");
          load();
        },
      )
      .subscribe((status) => setRealtimeOk(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(ch);
    };
  }, [authed, seller, load]);

  const sellerLink = useMemo(() => {
    if (!seller) return "";
    return `${window.location.origin}/v/${seller.ref_code}`;
  }, [seller]);

  const copyLink = async () => {
    if (!sellerLink) return;
    try {
      await navigator.clipboard.writeText(sellerLink);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  // Aplicar filtros (status + intervalo de datas)
  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      const ts = new Date(o.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  }, [orders, filter, dateFrom, dateTo]);

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.info("Sem pedidos para exportar nesse filtro");
      return;
    }
    const csv = buildCsv(
      [
        "ID Pedido",
        "Status",
        "Comprador",
        "Telefone",
        "Números",
        "Qtd Números",
        "Total (R$)",
        "Criado em",
        "Expira em",
      ],
      filtered.map((o) => [
        o.order_id,
        STATUS_LABEL[o.status] ?? o.status,
        o.buyer_name,
        o.buyer_phone,
        o.numbers.map((n) => n.toString().padStart(3, "0")).join(" "),
        o.numbers.length,
        (o.total_cents / 100).toFixed(2).replace(".", ","),
        formatDate(o.created_at),
        formatDate(o.expires_at),
      ]),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`vendas-${seller?.ref_code ?? "revendedor"}-${stamp}.csv`, csv);
    toast.success(`${filtered.length} pedidos exportados`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  if (!authed) {
    return <Navigate to="/auth?next=/seller" replace />;
  }

  if (!loading && !seller) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader breadcrumbs={[{ label: "Início", to: "/rifa" }, { label: "Painel do Revendedor" }]} />
        <main className="container max-w-xl py-12">
          <Card className="space-y-4 p-8 text-center">
            <h1 className="text-xl font-bold">Você ainda não é revendedor</h1>
            <p className="text-sm text-muted-foreground">
              Faça seu cadastro de afiliado para receber seu link único e
              começar a vender.
            </p>
            <Button asChild>
              <Link to="/afiliacao">Quero me afiliar</Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        breadcrumbs={[
          { label: "Início", to: "/rifa" },
          { label: "Painel do Revendedor" },
        ]}
      />
      <main className="container space-y-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Olá, revendedor
            </p>
            <h1 className="text-2xl font-bold sm:text-3xl">
              {seller?.name ?? "—"}
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>

        {/* Seller link */}
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ExternalLink className="h-4 w-4 text-primary" />
            Seu link de divulgação
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs">
              {sellerLink}
            </code>
            <Button onClick={copyLink} size="sm">
              <Copy className="mr-2 h-4 w-4" /> Copiar link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Toda compra feita pelo seu link é registrada automaticamente no seu
            nome.
          </p>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total faturado"
            value={loading ? "…" : formatBRL(stats?.total_revenue_cents ?? 0)}
            icon={<TrendingUp className="h-4 w-4" />}
            tone="success"
          />
          <StatCard
            label="Pagamentos aprovados"
            value={loading ? "…" : String(stats?.paid_orders ?? 0)}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="success"
          />
          <StatCard
            label="Pagamentos pendentes"
            value={loading ? "…" : String(stats?.pending_orders ?? 0)}
            icon={<Clock className="h-4 w-4" />}
            tone="warning"
            sublabel={
              stats?.pending_revenue_cents
                ? formatBRL(stats.pending_revenue_cents) + " a receber"
                : undefined
            }
          />
          <StatCard
            label="Números vendidos"
            value={loading ? "…" : String(stats?.total_numbers_paid ?? 0)}
            icon={<Users className="h-4 w-4" />}
          />
        </div>

        {/* Realtime indicator */}
        <div className="flex items-center gap-2 text-xs">
          <Radio className={`h-3 w-3 ${realtimeOk ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
          <span className="text-muted-foreground">
            {realtimeOk ? "Atualizando em tempo real" : "Conectando ao tempo real…"}
          </span>
        </div>

        {/* Orders */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
            <h2 className="text-lg font-semibold">Minhas vendas</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" /> Exportar CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={load}>
                Atualizar
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid gap-3 border-b border-border bg-muted/30 p-4 sm:grid-cols-[1fr_180px_180px]">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <TabsList className="flex-wrap">
                  <TabsTrigger value="all">Todas ({orders.length})</TabsTrigger>
                  <TabsTrigger value="pending">
                    Pendentes ({orders.filter((o) => o.status === "pending").length})
                  </TabsTrigger>
                  <TabsTrigger value="paid">
                    Pagas ({orders.filter((o) => o.status === "paid").length})
                  </TabsTrigger>
                  <TabsTrigger value="expired">
                    Expiradas ({orders.filter((o) => o.status === "expired").length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateFrom" className="text-xs">De</Label>
              <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo" className="text-xs">Até</Label>
              <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3 p-4">
            {loading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma venda nesse filtro.
              </p>
            ) : (
              filtered.map((o) => <OrderRow key={o.order_id} order={o} />)
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  icon,
  tone,
  sublabel,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "success" | "warning";
  sublabel?: string;
}) => {
  const toneCls =
    tone === "success"
      ? "text-number-available"
      : tone === "warning"
        ? "text-primary"
        : "text-foreground";
  return (
    <Card className="p-4">
      <div className={`mb-1 inline-flex items-center gap-2 text-xs font-medium ${toneCls}`}>
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
    </Card>
  );
};

const OrderRow = ({ order }: { order: SellerOrder }) => {
  const tone = STATUS_TONE[order.status] ?? "";
  const label = STATUS_LABEL[order.status] ?? order.status;
  const waMessage = encodeURIComponent(
    `Olá ${order.buyer_name.split(" ")[0]}, vi que sua reserva da Rifa IDB Jovem está pendente. Posso te ajudar a finalizar o pagamento via PIX?`,
  );
  const waLink = `https://wa.me/55${order.buyer_phone}?text=${waMessage}`;

  return (
    <article className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{order.buyer_name}</p>
          <p className="text-xs text-muted-foreground">
            {order.buyer_phone} · {formatDate(order.created_at)}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tone}`}>
          {order.status === "paid" ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : order.status === "pending" ? (
            <Clock className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {order.numbers.length === 0 ? (
          <span className="text-xs text-muted-foreground">Sem números</span>
        ) : (
          order.numbers.map((n) => (
            <span
              key={n}
              className="rounded bg-muted px-2 py-0.5 font-mono text-xs"
            >
              {n.toString().padStart(3, "0")}
            </span>
          ))
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="font-semibold">{formatBRL(order.total_cents)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to={`/seller/pedido/${order.order_id}`}>
              <Eye className="mr-2 h-4 w-4" /> Ver detalhes
            </Link>
          </Button>
          {order.status === "pending" && (
            <Button asChild size="sm" variant="outline">
              <a href={waLink} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                Falar com cliente
              </a>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};

export default Seller;
