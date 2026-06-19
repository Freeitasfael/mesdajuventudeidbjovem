import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, RefreshCw, Save, Undo2, UserPlus } from "lucide-react";
import { buildCsv, downloadCsv } from "@/lib/csv";

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
}

interface StockRow {
  sku: string;
  label: string;
  stock: number;
}

const fmtBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR");

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
      {status}
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
    const msg = o.status === "paid"
      ? `Reembolsar este pedido de ${fmtBRL(o.total_cents)}? O estoque será reposto e você deve estornar o valor manualmente no Mercado Pago. Esta ação não pode ser desfeita.`
      : `Cancelar este pedido pendente? Esta ação não pode ser desfeita.`;
    if (!confirm(msg)) return;
    setRefundingId(o.id);
    const { error } = await supabase.rpc("admin_refund_entrada_order" as any, { _order_id: o.id });
    setRefundingId(null);
    if (error) {
      toast.error("Erro ao reembolsar: " + error.message);
      return;
    }
    toast.success(o.status === "paid" ? "Pedido marcado como reembolsado e estoque reposto." : "Pedido cancelado.");
    load();
  };

  const load = async () => {
    setLoading(true);
    const [o, s, p] = await Promise.all([
      supabase
        .from("entrada_orders")
        .select("id, created_at, buyer_name, buyer_phone, product, model, size, quantity, total_cents, status, mp_payment_id, payment_method, seller_id, referral_label")
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

  const totalReceived = filteredOrders
    .filter((o) => o.status === "paid")
    .reduce((acc, o) => acc + o.total_cents, 0);

  const exportCsv = () => {
    if (filteredOrders.length === 0) {
      toast.info("Sem pedidos para exportar nesse filtro");
      return;
    }
    const csv = buildCsv(
      ["ID Pedido", "Status", "Comprador", "Telefone", "Produto", "Modelo", "Tam/Idade", "Qtd", "Pagamento", "Revendedor", "Total (R$)", "Criado em"],
      filteredOrders.map((o) => [
        o.id,
        o.status,
        o.buyer_name,
        o.buyer_phone,
        o.product,
        o.product === "kit" ? (o.model ?? "adulto") : "—",
        o.size ?? "—",
        o.quantity,
        o.payment_method ?? "pix",
        o.referral_label ?? "—",
        (o.total_cents / 100).toFixed(2).replace(".", ","),
        fmtDate(o.created_at),
      ]),
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
        <Card className="p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                  <SelectItem value="refunded">Reembolsados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Produto</Label>
              <Select value={productFilter} onValueChange={(v) => setProductFilter(v as typeof productFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pulseira">Pulseira</SelectItem>
                  <SelectItem value="kit">Kit (pulseira + camiseta)</SelectItem>
                </SelectContent>
              </Select>
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
            {filteredOrders.length} de {orders.length} pedidos · {fmtBRL(totalReceived)} recebido
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
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Tam/Idade</th>
                <th className="px-4 py-3">Qtd</th>
                <th className="px-4 py-3">Pgto</th>
                <th className="px-4 py-3">Revendedor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const canRefund = o.status === "paid" || o.status === "pending";
                return (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                    <td className="px-4 py-3">{o.buyer_name}</td>
                    <td className="px-4 py-3">{o.buyer_phone}</td>
                    <td className="px-4 py-3 capitalize">{o.product}</td>
                    <td className="px-4 py-3 capitalize">{o.product === "kit" ? (o.model ?? "adulto") : "—"}</td>
                    <td className="px-4 py-3">{o.size ?? "—"}</td>
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
                          {refundingId === o.id ? "..." : o.status === "paid" ? "Reembolsar" : "Cancelar"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma transação ainda.
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
