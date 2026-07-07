import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

import { toast } from "sonner";
import { Download, FileSpreadsheet, Plus, RefreshCw, Save, Undo2, UserPlus } from "lucide-react";
import { buildCsv, downloadCsv } from "@/lib/csv";
import ExcelJS from "exceljs";
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
import { isPaid, isPending, isRefunded, isCancelledLike } from "@/lib/orderStatus";

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

  const paidFiltered = filteredOrders.filter((o) => isPaid(o.status));
  const totalAgg = netFromOrders(paidFiltered);
  const totalReceivedGross = totalAgg.gross;
  const totalReceived = totalAgg.net;
  const totalReceivedFee = totalAgg.fee;

  // KPIs individuais da Camiseta — considera SOMENTE pedidos pagos (kit).
  // Reembolsos, cancelamentos, pendentes e expirados NÃO entram na receita nem na contagem de vendas.
  const shirtKpis = (() => {
    const kitPaid = orders.filter((o) => isPaid(o.status) && o.product === "kit");
    const kitPending = orders.filter((o) => isPending(o.status) && o.product === "kit");
    const kitCanceled = orders.filter((o) => o.product === "kit" && isCancelledLike(o.status) && !isRefunded(o.status));
    const kitRefunded = orders.filter((o) => isRefunded(o.status) && o.product === "kit");
    const paidAgg = netFromOrders(kitPaid);
    const revPaid = paidAgg.gross;
    const revPaidNet = paidAgg.net;
    const fee = paidAgg.fee;
    const revPending = kitPending.reduce((a, o) => a + o.total_cents, 0);
    const itemsSold = kitPaid.reduce((a, o) => a + (o.quantity || 0), 0);
    return {
      revPaid, revPaidNet, fee, revPending,
      paidCount: kitPaid.length,
      pendingCount: kitPending.length,
      canceledCount: kitCanceled.length,
      refundedCount: kitRefunded.length,
      itemsSold,
    };
  })();



  // Custos & Lucro (baseado em pedidos pagos)
  const costMetrics = useMemo(() => {
    const paid = orders.filter((o) => isPaid(o.status));
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

  const exportSizesXlsx = async () => {
    // Consolida apenas pedidos PAGOS (camisetas efetivamente vendidas)
    const paidOrders = filteredOrders.filter((o) => isPaid(o.status));
    if (paidOrders.length === 0) {
      toast.info("Sem pedidos pagos para exportar nesse filtro");
      return;
    }

    // Agrega quantidade por modelo x tamanho
    const bucket = new Map<string, Map<string, number>>();
    const modelOrder: string[] = [];
    const sizeSet = new Set<string>();
    for (const o of paidOrders) {
      if (o.product !== "kit") continue;
      for (const it of normalizeItems(o)) {
        const model = it.model || "adulto";
        const size = it.size || "—";
        if (!bucket.has(model)) { bucket.set(model, new Map()); modelOrder.push(model); }
        const m = bucket.get(model)!;
        m.set(size, (m.get(size) || 0) + (it.quantity || 0));
        sizeSet.add(size);
      }
    }
    if (bucket.size === 0) {
      toast.info("Nenhuma camiseta vendida no filtro atual");
      return;
    }

    const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XGG", "2", "4", "6", "8", "10", "12", "14"];
    const sizes = Array.from(sizeSet).sort((a, b) => {
      const ia = SIZE_ORDER.indexOf(a); const ib = SIZE_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "IDB Jovem";
    wb.created = new Date();
    const ws = wb.addWorksheet("Camisetas por tamanho", {
      views: [{ state: "frozen", ySplit: 4 }],
    });

    // Título
    const totalCols = 2 + sizes.length; // Modelo + tamanhos + Total
    ws.mergeCells(1, 1, 1, totalCols);
    const title = ws.getCell(1, 1);
    title.value = "Camisetas vendidas por tamanho";
    title.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    title.alignment = { vertical: "middle", horizontal: "center" };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E3D" } };
    ws.getRow(1).height = 28;

    // Subtítulo com filtros
    ws.mergeCells(2, 1, 2, totalCols);
    const sub = ws.getCell(2, 1);
    const stamp = new Date().toLocaleString("pt-BR");
    sub.value = `Gerado em ${stamp}  ·  ${paidOrders.length} pedidos pagos considerados`;
    sub.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF666666" } };
    sub.alignment = { horizontal: "center" };

    // Cabeçalho
    const headerRowIdx = 4;
    const headers = ["Modelo", ...sizes, "Total"];
    const headerRow = ws.getRow(headerRowIdx);
    headers.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D5B" } };
      c.border = {
        top: { style: "thin", color: { argb: "FF1F4E3D" } },
        bottom: { style: "thin", color: { argb: "FF1F4E3D" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });
    headerRow.height = 22;

    // Linhas por modelo
    let rowIdx = headerRowIdx + 1;
    const totalsBySize = new Map<string, number>();
    let grandTotal = 0;
    for (const model of modelOrder) {
      const perSize = bucket.get(model)!;
      let rowTotal = 0;
      const row = ws.getRow(rowIdx);
      row.getCell(1).value = MODEL_LABEL[model] ?? model;
      row.getCell(1).font = { name: "Calibri", size: 11, bold: true };
      row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
      sizes.forEach((s, i) => {
        const q = perSize.get(s) || 0;
        rowTotal += q;
        totalsBySize.set(s, (totalsBySize.get(s) || 0) + q);
        const c = row.getCell(2 + i);
        c.value = q;
        c.alignment = { horizontal: "center" };
        c.font = { name: "Calibri", size: 11, color: { argb: q === 0 ? "FFBBBBBB" : "FF000000" } };
      });
      const totalCell = row.getCell(2 + sizes.length);
      totalCell.value = rowTotal;
      totalCell.font = { name: "Calibri", size: 11, bold: true };
      totalCell.alignment = { horizontal: "center" };
      totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F8F5" } };
      // zebra
      if ((rowIdx - headerRowIdx) % 2 === 0) {
        for (let i = 1; i <= totalCols; i++) {
          const cc = row.getCell(i);
          if (!cc.fill || (cc.fill as any).fgColor?.argb !== "FFF3F8F5") {
            cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
          }
        }
      }
      for (let i = 1; i <= totalCols; i++) {
        row.getCell(i).border = {
          bottom: { style: "thin", color: { argb: "FFEEEEEE" } },
        };
      }
      grandTotal += rowTotal;
      rowIdx++;
    }

    // Linha total geral
    const totalRow = ws.getRow(rowIdx);
    totalRow.getCell(1).value = "Total geral";
    sizes.forEach((s, i) => {
      totalRow.getCell(2 + i).value = totalsBySize.get(s) || 0;
    });
    totalRow.getCell(2 + sizes.length).value = grandTotal;
    for (let i = 1; i <= totalCols; i++) {
      const c = totalRow.getCell(i);
      c.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E3D" } };
    }
    totalRow.height = 22;

    // Larguras
    ws.getColumn(1).width = 18;
    for (let i = 0; i < sizes.length; i++) ws.getColumn(2 + i).width = 10;
    ws.getColumn(2 + sizes.length).width = 12;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `camisetas-por-tamanho-${dateStamp}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Relatório de tamanhos exportado (${grandTotal} camisetas)`);
  };

  return (
    <Tabs defaultValue="transacoes" className="space-y-4">
      <TabsList>
        <TabsTrigger value="transacoes">Transações</TabsTrigger>
        <TabsTrigger value="estoque">Estoque</TabsTrigger>
        <TabsTrigger value="precos">Preços</TabsTrigger>
      </TabsList>

      <TabsContent value="transacoes" className="space-y-3">
        {/* Configuração do Preço de Custo (alimenta o Lucro Líquido) */}
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                Preço de Custo
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Usado automaticamente no cálculo do <strong>Lucro Líquido</strong> (Receita paga − Custo − Taxa MP). Sincronizado com a Dashboard.
              </p>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:max-w-xs w-full">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="costCamTop">Camiseta (R$)</Label>
                <Input id="costCamTop" type="number" step="0.01" min="0" value={costCamiseta}
                  onChange={(e) => setCostCamiseta(Number(e.target.value) || 0)} />
              </div>
            </div>
          </div>
        </Card>

        {/* KPIs individuais da Camiseta — apenas pedidos PAGOS. Reembolsos não contam na receita. */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Resumo da Camiseta <span className="text-[10px] normal-case tracking-normal text-muted-foreground/80">(somente pedidos pagos · reembolsos não contam)</span>
          </h3>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Receita paga"
              value={fmtBRL(shirtKpis.revPaid)}
              tone="positive"
              hint="Valor bruto recebido em kits pagos. Reembolsos/cancelamentos/pendentes NÃO entram."
            />
            <KpiCard
              label="Preço de custo"
              value={fmtBRL(costMetrics.costCamisetaTotal)}
              tone="warning"
              hint="Custo unitário × camisetas efetivamente vendidas (pagas)."
            />
            <KpiCard
              label="Taxa de Mercado Pago"
              value={fmtBRL(shirtKpis.fee)}
              tone="warning"
              hint="PIX 0,99% · Cartão 4,99% sobre o valor bruto pago."
            />
            <KpiCard
              label="Lucro líquido"
              value={fmtBRL(shirtKpis.revPaid - costMetrics.costCamisetaTotal - shirtKpis.fee)}
              tone={shirtKpis.revPaid - costMetrics.costCamisetaTotal - shirtKpis.fee >= 0 ? "positive" : "negative"}
              hint="Receita paga − (Preço de custo + Taxa MP). Só considera vendas pagas."
            />
            <KpiCard label="Camisetas vendidas" value={String(shirtKpis.itemsSold)} hint="Total de camisetas em pedidos pagos." />
            <KpiCard label="Vendas pendentes" value={String(shirtKpis.pendingCount)} hint="Não incluídas na receita." />
            <KpiCard label="Vendas canceladas" value={String(shirtKpis.canceledCount)} hint="Cancelados/expirados/rejeitados." />
            <KpiCard label="Reembolsadas" value={String(shirtKpis.refundedCount)} tone="warning" hint="Reembolsos não entram na receita nem no lucro." />
          </div>
        </div>

        {/* KPIs individuais da Pulseira — apenas pagos */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Resumo da Pulseira <span className="text-[10px] normal-case tracking-normal text-muted-foreground/80">(somente pedidos pagos · reembolsos não contam)</span>
          </h3>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Receita paga"
              value={fmtBRL(costMetrics.grossPulseira)}
              tone="positive"
              hint="Valor bruto recebido em pulseiras pagas."
            />
            <KpiCard
              label="Taxa de Mercado Pago"
              value={fmtBRL(costMetrics.grossPulseira - costMetrics.netPulseira)}
              tone="warning"
              hint="PIX 0,99% · Cartão 4,99% sobre o valor bruto."
            />
            <KpiCard
              label="Receita líquida"
              value={fmtBRL(costMetrics.netPulseira)}
              tone={costMetrics.netPulseira >= 0 ? "positive" : "negative"}
              hint="Receita paga − Taxa MP."
            />
            <KpiCard label="Pulseiras vendidas" value={String(costMetrics.pulseiraUnits)} hint="Somente pedidos pagos." />
          </div>
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
          <div className="flex gap-2 flex-wrap">
            <ManualSaleDialog onCreated={load} />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredOrders.length === 0}>
              <Download className="mr-2 h-3 w-3" /> Exportar CSV
            </Button>
            <Button variant="default" size="sm" onClick={exportSizesXlsx} disabled={filteredOrders.length === 0}>
              <FileSpreadsheet className="mr-2 h-3 w-3" /> Exportar tamanhos (Excel)
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

function KpiCard({ label, value, tone = "neutral", hint }: { label: string; value: string; tone?: "positive" | "negative" | "warning" | "neutral"; hint?: string }) {
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
    <Card className={`p-3 ${borderClass}`} title={hint}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground leading-tight">{hint}</p>}
    </Card>
  );
}

const SIZE_OPTIONS_BY_MODEL: Record<string, string[]> = {
  adulto: ["PP", "P", "M", "G", "GG", "XG", "XGG"],
  baby: ["PP", "P", "M", "G", "GG"],
  infantil: ["2", "4", "6", "8", "10", "12", "14"],
};

function ManualSaleDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [product, setProduct] = useState<"pulseira" | "kit">("pulseira");
  const [quantity, setQuantity] = useState("1");
  const [model, setModel] = useState<"adulto" | "baby" | "infantil">("adulto");
  const [size, setSize] = useState("M");
  const [totalReais, setTotalReais] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [refCode, setRefCode] = useState("");
  const [status, setStatus] = useState<"paid" | "pending">("paid");

  const reset = () => {
    setBuyerName(""); setBuyerPhone(""); setProduct("pulseira"); setQuantity("1");
    setModel("adulto"); setSize("M"); setTotalReais(""); setPaymentMethod("pix"); setRefCode(""); setStatus("paid");
  };

  const submit = async () => {
    const qty = parseInt(quantity, 10);
    const cents = Math.round(parseFloat(totalReais.replace(",", ".")) * 100);
    if (!buyerName.trim() || buyerName.trim().length < 2) return toast.error("Informe o nome do comprador");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Quantidade inválida");
    if (!Number.isFinite(cents) || cents <= 0) return toast.error("Valor total inválido");
    if (product === "kit" && !size) return toast.error("Selecione o tamanho da camiseta");

    const items = product === "kit"
      ? [{ model, size, quantity: qty }]
      : null;

    setSaving(true);
    const { error } = await supabase.rpc("admin_add_manual_entrada_order" as never, {
      _buyer_name: buyerName.trim(),
      _buyer_phone: buyerPhone.trim(),
      _product: product,
      _items: items as never,
      _quantity: qty,
      _total_cents: cents,
      _payment_method: paymentMethod,
      _seller_ref_code: refCode.trim() || null,
      _model: product === "kit" ? model : null,
      _size: product === "kit" ? size : null,
      _status: status,
    } as never);
    setSaving(false);
    if (error) {
      const msg = error.message.includes("seller_not_found")
        ? "Código de revendedor não encontrado"
        : "Erro: " + error.message;
      toast.error(msg);
      return;
    }
    toast.success("Venda manual registrada!");
    reset();
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus className="mr-2 h-3 w-3" /> Venda manual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar venda manual</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Nome do comprador *</Label>
              <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label>Telefone (opcional)</Label>
              <Input value={buyerPhone} inputMode="numeric" onChange={(e) => setBuyerPhone(e.target.value)} placeholder="11987654321" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Produto *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={product}
                onChange={(e) => setProduct(e.target.value as "pulseira" | "kit")}
              >
                <option value="pulseira">Pulseira</option>
                <option value="kit">Kit (camiseta + pulseira)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Quantidade *</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor total (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="60,00" value={totalReais} onChange={(e) => setTotalReais(e.target.value)} />
            </div>
          </div>

          {product === "kit" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Modelo camiseta *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={model}
                  onChange={(e) => {
                    const m = e.target.value as "adulto" | "baby" | "infantil";
                    setModel(m);
                    setSize(SIZE_OPTIONS_BY_MODEL[m][0]);
                  }}
                >
                  <option value="adulto">Adulto</option>
                  <option value="baby">Babylook</option>
                  <option value="infantil">Infantil</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Tamanho *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                >
                  {SIZE_OPTIONS_BY_MODEL[model].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Forma de pagamento</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="pix">PIX</option>
                <option value="cash">Dinheiro</option>
                <option value="card">Cartão</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Revendedor (código, opcional)</Label>
              <Input value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase())} placeholder="IDB123" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Status do pagamento *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as "paid" | "pending")}
              >
                <option value="paid">Paga</option>
                <option value="pending">Pendente (não paga)</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {status === "paid"
              ? "A venda é registrada como paga e o estoque é abatido automaticamente."
              : "A venda ficará pendente por 7 dias e não abaterá estoque até ser confirmada como paga."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando…" : "Registrar venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

