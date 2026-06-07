import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface OrderLite { total_cents: number; created_at: string; status: string; }
interface EntradaLite { total_cents: number; created_at: string; status: string; product: string; quantity: number; }

// Custos unitários de fabricação (R$)
const DEFAULT_COST_CAMISETA = 38;
const DEFAULT_COST_PULSEIRA = 1.05;
const COST_STORAGE_KEY = "dashboard_costs_v1";

const fmtBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

export function DashboardConsolidado() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rifa, setRifa] = useState<OrderLite[]>([]);
  const [entrada, setEntrada] = useState<EntradaLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [costCamiseta, setCostCamiseta] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.camiseta) || DEFAULT_COST_CAMISETA; } catch { return DEFAULT_COST_CAMISETA; }
  });
  const [costPulseira, setCostPulseira] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.pulseira) || DEFAULT_COST_PULSEIRA; } catch { return DEFAULT_COST_PULSEIRA; }
  });
  useEffect(() => {
    localStorage.setItem(COST_STORAGE_KEY, JSON.stringify({ camiseta: costCamiseta, pulseira: costPulseira }));
  }, [costCamiseta, costPulseira]);

  const load = async () => {
    setLoading(true);
    let rifaQ = supabase.from("orders").select("total_cents, created_at, status").eq("status", "paid").limit(5000);
    let entQ = supabase.from("entrada_orders").select("total_cents, created_at, status, product, quantity").eq("status", "paid").limit(5000);
    if (from) {
      const f = new Date(from + "T00:00:00").toISOString();
      rifaQ = rifaQ.gte("created_at", f);
      entQ = entQ.gte("created_at", f);
    }
    if (to) {
      const t = new Date(to + "T23:59:59").toISOString();
      rifaQ = rifaQ.lte("created_at", t);
      entQ = entQ.lte("created_at", t);
    }
    const [r, e] = await Promise.all([rifaQ, entQ]);
    if (r.data) setRifa(r.data as OrderLite[]);
    if (e.data) setEntrada(e.data as EntradaLite[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const metrics = useMemo(() => {
    const rifaTotal = rifa.reduce((a, o) => a + o.total_cents, 0);
    const rifaCount = rifa.length;
    const entTotal = entrada.reduce((a, o) => a + o.total_cents, 0);
    const entCount = entrada.length;
    const pulseira = entrada.filter((e) => e.product === "pulseira");
    const kit = entrada.filter((e) => e.product === "kit");
    const pulTotal = pulseira.reduce((a, o) => a + o.total_cents, 0);
    const kitTotal = kit.reduce((a, o) => a + o.total_cents, 0);
    // Soma de unidades (cada pedido pode ter quantity > 1)
    const pulUnits = pulseira.reduce((a, o) => a + (o.quantity || 1), 0);
    const kitUnits = kit.reduce((a, o) => a + (o.quantity || 1), 0);
    const total = rifaTotal + entTotal;
    const totalCount = rifaCount + entCount;
    const ticket = totalCount > 0 ? Math.round(total / totalCount) : 0;

    // Custos (em centavos). Ingresso = 0. Pulseira solo = só pulseira. Kit = camiseta + pulseira.
    const costCents = Math.round(
      pulUnits * costPulseira * 100 +
      kitUnits * (costCamiseta + costPulseira) * 100
    );
    const entradaProfit = entTotal - costCents;
    // Rifa: custo 0 (não há custo de fabricação informado)
    const totalProfit = rifaTotal + entradaProfit;
    const margin = entTotal > 0 ? Math.round((entradaProfit / entTotal) * 100) : 0;

    return {
      total, totalCount, ticket,
      rifaTotal, rifaCount,
      entTotal, entCount,
      pulTotal, pulCount: pulseira.length, pulUnits,
      kitTotal, kitCount: kit.length, kitUnits,
      costCents, entradaProfit, totalProfit, margin,
    };
  }, [rifa, entrada, costCamiseta, costPulseira]);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="dashFrom">De</Label>
            <Input id="dashFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-44" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="dashTo">Até</Label>
            <Input id="dashTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-44" />
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Limpar</Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Considera apenas pedidos pagos. Sem filtro = histórico completo.
        </p>
      </Card>

      {/* Total geral */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Visão geral</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total arrecadado" value={fmtBRL(metrics.total)} highlight />
          <StatCard label="Total de pedidos" value={String(metrics.totalCount)} />
          <StatCard label="Ticket médio" value={fmtBRL(metrics.ticket)} />
          <StatCard
            label="Distribuição"
            value={metrics.total > 0
              ? `Rifa ${Math.round((metrics.rifaTotal / metrics.total) * 100)}% / Entrada ${Math.round((metrics.entTotal / metrics.total) * 100)}%`
              : "—"
            }
          />
        </div>
      </div>

      {/* Rifa */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Rifa</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Arrecadado (rifa)" value={fmtBRL(metrics.rifaTotal)} />
          <StatCard label="Pedidos pagos" value={String(metrics.rifaCount)} />
          <StatCard label="Ticket médio" value={fmtBRL(metrics.rifaCount > 0 ? Math.round(metrics.rifaTotal / metrics.rifaCount) : 0)} />
        </div>
      </div>

      {/* Entrada */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Camisetas & Pulseiras (Entrada)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Arrecadado (entrada)" value={fmtBRL(metrics.entTotal)} />
          <StatCard label="Pedidos pagos" value={String(metrics.entCount)} />
          <StatCard label="Pulseiras vendidas" value={`${metrics.pulCount} · ${fmtBRL(metrics.pulTotal)}`} />
          <StatCard label="Kits vendidos" value={`${metrics.kitCount} · ${fmtBRL(metrics.kitTotal)}`} />
        </div>
      </div>

      {/* Lucro real */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Lucro real</h2>
        <Card className="p-4 mb-4">
          <p className="text-xs text-muted-foreground mb-3">
            Custos unitários de fabricação (ingresso ao evento tem custo zero). Editáveis — salvos neste navegador.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 max-w-md">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="costCam">Custo camiseta (R$)</Label>
              <Input id="costCam" type="number" step="0.01" min="0" value={costCamiseta}
                onChange={(e) => setCostCamiseta(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="costPul">Custo pulseira (R$)</Label>
              <Input id="costPul" type="number" step="0.01" min="0" value={costPulseira}
                onChange={(e) => setCostPulseira(Number(e.target.value) || 0)} />
            </div>
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Lucro total" value={fmtBRL(metrics.totalProfit)} highlight />
          <StatCard label="Custo total (entrada)" value={fmtBRL(metrics.costCents)} />
          <StatCard label="Lucro entrada" value={fmtBRL(metrics.entradaProfit)} />
          <StatCard label="Margem entrada" value={`${metrics.margin}%`} />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {metrics.pulUnits} pulseira(s) × {fmtBRL(Math.round(costPulseira * 100))} + {metrics.kitUnits} kit(s) × {fmtBRL(Math.round((costCamiseta + costPulseira) * 100))} = {fmtBRL(metrics.costCents)} de custo. Rifa considerada sem custo de fabricação.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={`p-4 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-bold ${highlight ? "text-3xl text-primary" : "text-2xl"}`}>{value}</p>
    </Card>
  );
}
