import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { Download, RefreshCw, Save, Undo2, UserPlus } from "lucide-react";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { WhatsAppLink } from "@/components/WhatsAppLink";

interface EntradaOrderItem {
  model: string;
  size: string;
  quantity: number;
}
interface EntradaOrder {
  id: string;
  created_at: string;
  buyer_name: string;
  buyer_phone: string;
  product: string;
  model: string | null;
  size: string | null;
  quantity: number;
  total_cents: number;
  status: string;
  mp_payment_id: string | null;
  payment_method: string | null;
  seller_id: string | null;
  referral_label: string | null;
  items: EntradaOrderItem[] | null;
}

const MODEL_LABEL: Record<string, string> = {
  adulto: "Adulto",
  baby: "Babylook",
  infantil: "Infantil",
};

function normalizeItems(o: EntradaOrder): EntradaOrderItem[] {
  if (Array.isArray(o.items) && o.items.length > 0) {
    return o.items.map((it) => ({
      model: it.model || "adulto",
      size: it.size || "—",
      quantity: Number(it.quantity) || 0,
    }));
  }
  if (o.product === "kit" && o.size) {
    return [{ model: o.model || "adulto", size: o.size, quantity: o.quantity }];
  }
  return [];
}

function ItemsCell({ o }: { o: EntradaOrder }) {
  if (o.product !== "kit") return <span className="text-muted-foreground">—</span>;
  const items = normalizeItems(o);
  if (items.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="space-y-0.5">
      {items.map((it, i) => (
        <li key={i} className="text-xs whitespace-nowrap">
          <span className="font-medium">{MODEL_LABEL[it.model] ?? it.model}</span>
          {" · "}
          <span>Tam {it.size}</span>
          {it.quantity > 1 && (
            <>
              {" · "}
              <span className="text-muted-foreground">x{it.quantity}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

interface StockRow {
  sku: string;
  label: string;
  stock: number;
}

const fmtBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR");

// Taxa de transação Mercado Pago aplicada por método (PIX 0,99% · Cartão 4,99%).
import { netFromOrders } from "@/lib/fees";

// Custos unitários de fabricação (R$) — sincronizados com a Dashboard
const DEFAULT_COST_CAMISETA = 38;
const DEFAULT_COST_PULSEIRA = 1.05;
const COST_STORAGE_KEY = "dashboard_costs_v1";

const STATUS_LABEL: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  expired: "Expirado",
  cancelled: "Cancelado",
  refunded: "Reembolso",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    expired: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
    refunded: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function EntradaPanel() {
  const [orders, setOrders] = useState<EntradaOrder[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [pulseiraReais, setPulseiraReais] = useState("");
  const [kitReais, setKitReais] = useState("");
  const [savingPrices, setSavingPrices] = useState(false);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Custos de fabricação (sincronizados com a Dashboard via localStorage)
  const [costCamiseta, setCostCamiseta] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.camiseta) || DEFAULT_COST_CAMISETA; } catch { return DEFAULT_COST_CAMISETA; }
  });
  const [costPulseira, setCostPulseira] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.pulseira) || DEFAULT_COST_PULSEIRA; } catch { return DEFAULT_COST_PULSEIRA; }
  });
  useEffect(() => {
    localStorage.setItem(COST_STORAGE_KEY, JSON.stringify({ camiseta: costCamiseta, pulseira: costPulseira }));
  }, [costCamiseta, costPulseira]);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "expired" | "cancelled" | "refunded">("all");
  const [productFilter, setProductFilter] = useState<"all" | "pulseira" | "kit">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const assignSeller = async (o: EntradaOrder) => {
    const current = o.referral_label ?? "";
    const code = window.prompt(
      `Atribuir/alterar revendedor do pedido ${o.id.slice(0, 8)}.\n\nDigite o código (ex: IDB001) ou deixe em branco para remover.`,
      current,
    );
    if (code === null) return;
    setAssigningId(o.id);
    const { error } = await supabase.rpc("admin_set_entrada_order_seller" as never, {
      _order_id: o.id, _ref_code: code.trim(),
    } as never);
    setAssigningId(null);
    if (error) {
      toast.error(error.message.includes("seller_not_found") ? "Código não encontrado" : "Erro: " + error.message);
      return;
    }
    toast.success(code.trim() ? "Revendedor atualizado" : "Vínculo removido");
    load();
  };

  const refundOrder = async (o: EntradaOrder) => {
    if (!confirm(
      `Marcar o pedido de ${o.buyer_name} (${fmtBRL(o.total_cents)}) como Reembolso?\n\nEsta ação é apenas para controle interno — nenhum estorno automático será feito. Caso necessário, o valor deve ser devolvido manualmente.`,
    )) return;
    setRefundingId(o.id);
    const { error } = await supabase.rpc("admin_mark_entrada_refunded" as never, { _order_id: o.id } as never);
    setRefundingId(null);
    if (error) {
      toast.error("Erro ao marcar reembolso: " + error.message);
      return;
    }
    toast.success("Pedido marcado como Reembolso.");
    load();
  };

  const load = async () => {
    setLoading(true);
    const [o, s, p] = await Promise.all([
      supabase
        .from("entrada_orders")
        .select("id, created_at, buyer_name, buyer_phone, product, model, size, quantity, total_cents, status, mp_payment_id, payment_method, seller_id, referral_label, items")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("entrada_stock").select("sku, label, stock").order("sku"),
      supabase.from("app_settings").select("value").eq("key", "entrada_prices").maybeSingle(),
    ]);
    if (o.data) setOrders(o.data as unknown as EntradaOrder[]);
    if (s.data) setStock(s.data as StockRow[]);
    if (p.data?.value) {
      const v = p.data.value as { pulseira_cents?: number; kit_cents?: number };
      if (v.pulseira_cents) setPulseiraReais((v.pulseira_cents / 100).toFixed(2));
      if (v.kit_cents) setKitReais((v.kit_cents / 100).toFixed(2));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-entrada")
      .on("postgres_changes", { event: "*", schema: "public", table: "entrada_orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "entrada_stock" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveStock = async (sku: string) => {
    const raw = editing[sku];
    if (raw === undefined) return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Valor inválido");
      return;
    }
    const { error } = await supabase
      .from("entrada_stock")
      .update({ stock: n, updated_at: new Date().toISOString() })
      .eq("sku", sku);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Estoque atualizado");
    setEditing((p) => {
      const c = { ...p };
      delete c[sku];
      return c;
    });
    load();
  };

  const savePrices = async () => {
    const p = Math.round(parseFloat(pulseiraReais.replace(",", ".")) * 100);
    const k = Math.round(parseFloat(kitReais.replace(",", ".")) * 100);
    if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(k) || k <= 0) {
      toast.error("Informe valores válidos para pulseira e kit");
      return;
    }
    setSavingPrices(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "entrada_prices", value: { pulseira_cents: p, kit_cents: k }, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    setSavingPrices(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Preços atualizados");
  };

  const filteredOrders = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (productFilter !== "all" && o.product !== productFilter) return false;
      const ts = new Date(o.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      if (q) {
        const hay = `${o.buyer_name} ${o.buyer_phone} ${o.referral_label ?? ""} ${o.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, productFilter, dateFrom, dateTo, search]);

  const paidFiltered = filteredOrders.filter((o) => o.status === "paid");
  const totalAgg = netFromOrders(paidFiltered);
  const totalReceivedGross = totalAgg.gross;
  const totalReceived = totalAgg.net;
  const totalReceivedFee = totalAgg.fee;

  // KPIs individuais da Camiseta
  const shirtKpis = (() => {
    const paid = orders.filter((o) => o.status === "paid");
    const pending = orders.filter((o) => o.status === "pending");
    const canceled = orders.filter((o) => o.status === "canceled" || o.status === "cancelled" || o.status === "rejected");
    const paidAgg = netFromOrders(paid);
    const revPaid = paidAgg.gross;
    const revPaidNet = paidAgg.net;
    const fee = paidAgg.fee;
    const revPending = pending.reduce((a, o) => a + o.total_cents, 0);
    const itemsSold = paid.reduce((a, o) => a + (o.quantity || 0), 0);
    return { revPaid, revPaidNet, fee, revPending, paidCount: paid.length, pendingCount: pending.length, canceledCount: canceled.length, itemsSold };
  })();


  // Custos & Lucro (baseado em pedidos pagos)
  const costMetrics = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid");
    const pulseiraOrders = paid.filter((o) => o.product === "pulseira");
    const kitOrders = paid.filter((o) => o.product === "kit");
    const pulseiraUnits = pulseiraOrders.reduce((a, o) => a + (o.quantity || 0), 0);
    // Cada kit = 1 camiseta + 1 pulseira
    const kitUnits = kitOrders.reduce((a, o) => a + (o.quantity || 0), 0);

    const pulseiraAgg = netFromOrders(pulseiraOrders);
    const kitAgg = netFromOrders(kitOrders);
    const grossPulseira = pulseiraAgg.gross;
    const grossKit = kitAgg.gross;
    const netPulseira = pulseiraAgg.net;
    const netKit = kitAgg.net;
    const gross = grossPulseira + grossKit;
    const net = netPulseira + netKit;
    const fee = pulseiraAgg.fee + kitAgg.fee;

    const costPulseiraTotal = Math.round((pulseiraUnits + kitUnits) * costPulseira * 100);
    const costCamisetaTotal = Math.round(kitUnits * costCamiseta * 100);
    const costTotal = costPulseiraTotal + costCamisetaTotal;

    const profit = net - costTotal;
    const margin = net > 0 ? (profit / net) * 100 : 0;

    return {
      pulseiraUnits, kitUnits,
      grossPulseira, grossKit, netPulseira, netKit,
      gross, net, fee,
      costPulseiraTotal, costCamisetaTotal, costTotal,
      profit, margin,
    };
  }, [orders, costCamiseta, costPulseira]);

  const exportCsv = () => {
    if (filteredOrders.length === 0) {
      toast.info("Sem pedidos para exportar nesse filtro");
      return;
    }
    const csv = buildCsv(
      ["ID Pedido", "Status", "Comprador", "Telefone", "Produto", "Itens (modelo/tamanho/qtd)", "Qtd total", "Pagamento", "Revendedor", "Total (R$)", "Criado em"],
      filteredOrders.map((o) => {
        const its = normalizeItems(o);
        const itensLabel = o.product === "kit"
          ? (its.length > 0 ? its.map((it) => `${MODEL_LABEL[it.model] ?? it.model} ${it.size}${it.quantity > 1 ? ` x${it.quantity}` : ""}`).join(" | ") : "—")
          : "—";
        return [
          o.id,
          o.status,
          o.buyer_name,
          o.buyer_phone,
          o.product,
          itensLabel,
          o.quantity,
          o.payment_method ?? "pix",
          o.referral_label ?? "—",
          (o.total_cents / 100).toFixed(2).replace(".", ","),
          fmtDate(o.created_at),
        ];
      }),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`camisetas-pulseiras-${stamp}.csv`, csv);
    toast.success(`${filteredOrders.length} pedidos exportados`);
  };

  return (
    <Tabs defaultValue="transacoes" className="space-y-4">
      <TabsList>
        <TabsTrigger value="transacoes">Transações</TabsTrigger>
        <TabsTrigger value="estoque">Estoque</TabsTrigger>
        <TabsTrigger value="precos">Preços</TabsTrigger>
      </TabsList>

      <TabsContent value="transacoes" className="space-y-3">
        {/* KPIs individuais da Camiseta */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Resumo da Camiseta
          </h3>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Receita paga" value={fmtBRL(shirtKpis.revPaid)} />
            <KpiCard label="Receita pendente" value={fmtBRL(shirtKpis.revPending)} />
            <KpiCard label="Pedidos pagos" value={String(shirtKpis.paidCount)} />
            <KpiCard label="Itens vendidos" value={String(shirtKpis.itemsSold)} />
            <KpiCard label="Ticket médio" value={fmtBRL(shirtKpis.ticket)} />
            <KpiCard label="Conversão" value={`${shirtKpis.conv.toFixed(1)}%`} />
            <KpiCard label="Pendentes" value={String(shirtKpis.pendingCount)} />
            <KpiCard label="Líquido (taxa MP)" value={fmtBRL(shirtKpis.revPaidNet)} />
          </div>
        </div>

        {/* Custos & Lucro */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Custos & Lucro
          </h3>
          <Card className="p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 max-w-md">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="costCamEnt">Custo camiseta (R$)</Label>
                <Input id="costCamEnt" type="number" step="0.01" min="0" value={costCamiseta}
                  onChange={(e) => setCostCamiseta(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="costPulEnt">Custo pulseira (R$)</Label>
                <Input id="costPulEnt" type="number" step="0.01" min="0" value={costPulseira}
                  onChange={(e) => setCostPulseira(Number(e.target.value) || 0)} />
              </div>
            </div>

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Valor bruto" value={fmtBRL(costMetrics.gross)} />
              <KpiCard label="Líquido (após taxa MP)" value={fmtBRL(costMetrics.net)} />
              <KpiCard label="Custo total (fabricação)" value={fmtBRL(costMetrics.costTotal)} />
              <KpiCard
                label="Lucro"
                value={fmtBRL(costMetrics.profit)}
                tone={costMetrics.profit > 0 ? "positive" : costMetrics.profit < 0 ? "negative" : "neutral"}
              />
              <KpiCard label="Margem" value={`${costMetrics.margin.toFixed(1)}%`}
                tone={costMetrics.margin >= 20 ? "positive" : costMetrics.margin >= 0 ? "warning" : "negative"} />
              <KpiCard label="Taxa MP descontada" value={fmtBRL(costMetrics.fee)} />
              <KpiCard label="Pulseiras vendidas" value={`${costMetrics.pulseiraUnits} un · ${fmtBRL(costMetrics.costPulseiraTotal)}`} />
              <KpiCard label="Kits (camiseta+pulseira)" value={`${costMetrics.kitUnits} un · ${fmtBRL(costMetrics.costCamisetaTotal + Math.round(costMetrics.kitUnits * costPulseira * 100))}`} />
            </div>

            <p className="text-xs text-muted-foreground">
              Cálculo: cada <strong>kit</strong> usa 1 camiseta ({fmtBRL(Math.round(costCamiseta * 100))}) + 1 pulseira ({fmtBRL(Math.round(costPulseira * 100))}); cada <strong>pulseira avulsa</strong> usa 1 pulseira.
              Lucro = líquido (após taxa Mercado Pago) − custo de fabricação. Os custos são sincronizados com a Dashboard.
            </p>
          </Card>
        </div>

        <Card className="p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="all">Todos</option>
                <option value="paid">Pagos</option>
                <option value="pending">Pendentes</option>
                <option value="expired">Expirados</option>
                <option value="cancelled">Cancelados</option>
                <option value="refunded">Reembolsados</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Produto</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value as typeof productFilter)}
              >
                <option value="all">Todos</option>
                <option value="pulseira">Pulseira</option>
                <option value="kit">Kit (pulseira + camiseta)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <Input placeholder="Nome, telefone, código..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            {filteredOrders.length} de {orders.length} pedidos · {fmtBRL(totalReceived)} líquido <span className="text-xs">(bruto {fmtBRL(totalReceivedGross)} – taxa MP {fmtBRL(totalReceivedFee)})</span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredOrders.length === 0}>
              <Download className="mr-2 h-3 w-3" /> Exportar CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Recarregar
            </Button>
          </div>
        </div>

        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Comprador</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Itens (modelo · tamanho · qtd)</th>
                <th className="px-4 py-3">Qtd total</th>
                <th className="px-4 py-3">Pgto</th>
                <th className="px-4 py-3">Revendedor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const canRefund = o.status !== "refunded";
                return (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                    <td className="px-4 py-3">{o.buyer_name}</td>
                    <td className="px-4 py-3">{o.buyer_phone ? <WhatsAppLink phone={o.buyer_phone} /> : "—"}</td>
                    <td className="px-4 py-3 capitalize">{o.product}</td>
                    <td className="px-4 py-3"><ItemsCell o={o} /></td>
                    <td className="px-4 py-3">{o.quantity}</td>
                    <td className="px-4 py-3 uppercase text-xs">{o.payment_method ?? "pix"}</td>
                    <td className="px-4 py-3 text-xs">
                      {o.referral_label ? <span className="font-medium">{o.referral_label}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right font-medium">{fmtBRL(o.total_cents)}</td>
                    <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => assignSeller(o)} disabled={assigningId === o.id}>
                        <UserPlus className="mr-1 h-3 w-3" />
                        {assigningId === o.id ? "..." : "Revend."}
                      </Button>
                      {canRefund && (
                        <Button size="sm" variant="outline" onClick={() => refundOrder(o)} disabled={refundingId === o.id}>
                          <Undo2 className="mr-1 h-3 w-3" />
                          {refundingId === o.id ? "..." : "Reembolso"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    {orders.length === 0 ? "Nenhuma transação ainda." : "Nenhum pedido corresponde aos filtros."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </TabsContent>

      <TabsContent value="estoque" className="space-y-3">
        <Card className="p-4">
          <h3 className="font-semibold mb-1">Controle de estoque</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Defina manualmente a quantidade disponível. A cada pagamento confirmado o sistema baixa automaticamente. Quando chega a 0, o produto fica indisponível para compra.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {stock.map((s) => {
              const isEditing = editing[s.sku] !== undefined;
              const value = isEditing ? editing[s.sku] : String(s.stock);
              const isOut = s.stock <= 0;
              return (
                <div key={s.sku} className={`flex items-end gap-2 rounded-md border p-3 ${isOut ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs flex items-center justify-between">
                      <span>{s.label}</span>
                      {isOut && <span className="text-destructive font-semibold">Esgotado</span>}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={value}
                      onChange={(e) => setEditing((p) => ({ ...p, [s.sku]: e.target.value }))}
                    />
                  </div>
                  <Button size="sm" disabled={!isEditing} onClick={() => saveStock(s.sku)}>
                    <Save className="mr-1 h-4 w-4" /> Salvar
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="precos" className="space-y-3">
        <Card className="p-4 max-w-xl space-y-4">
          <div>
            <h3 className="font-semibold">Preços dos produtos</h3>
            <p className="text-xs text-muted-foreground">
              Aplica-se a novas compras em /entrada. Pedidos já criados mantêm o valor original.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Pulseira (R$)</Label>
              <Input
                type="number" step="0.01" min="0.01"
                value={pulseiraReais}
                onChange={(e) => setPulseiraReais(e.target.value)}
                placeholder="15.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Kit pulseira + camiseta (R$)</Label>
              <Input
                type="number" step="0.01" min="0.01"
                value={kitReais}
                onChange={(e) => setKitReais(e.target.value)}
                placeholder="60.00"
              />
            </div>
          </div>
          <Button onClick={savePrices} disabled={savingPrices}>
            <Save className="mr-2 h-4 w-4" /> {savingPrices ? "Salvando..." : "Salvar preços"}
          </Button>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function KpiCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "warning" | "neutral" }) {
  const toneClass = {
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    neutral: "",
  }[tone];
  const borderClass = {
    positive: "border-emerald-500/30 bg-emerald-500/5",
    negative: "border-red-500/30 bg-red-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    neutral: "",
  }[tone];
  return (
    <Card className={`p-3 ${borderClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</p>
    </Card>
  );
}
