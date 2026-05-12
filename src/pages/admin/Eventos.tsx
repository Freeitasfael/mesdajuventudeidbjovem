import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, AlertTriangle, Info, RefreshCw } from "lucide-react";

interface PaymentEvent {
  id: string;
  level: "info" | "warn" | "error";
  event_type: string;
  order_id: string | null;
  payment_id: string | null;
  provider_payment_id: string | null;
  message: string;
  details: unknown;
  created_at: string;
}

const LEVEL_META: Record<PaymentEvent["level"], { label: string; tone: string; icon: typeof Info }> = {
  info: { label: "Info", tone: "border-border bg-muted text-foreground", icon: Info },
  warn: { label: "Aviso", tone: "border-primary/40 bg-primary/10 text-primary", icon: AlertTriangle },
  error: { label: "Erro", tone: "border-destructive/40 bg-destructive/10 text-destructive", icon: AlertCircle },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

const Eventos = () => {
  const [events, setEvents] = useState<PaymentEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<"all" | "info" | "warn" | "error">("all");
  const [orderFilter, setOrderFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    let q = supabase
      .from("payment_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (levelFilter !== "all") q = q.eq("level", levelFilter);
    if (orderFilter.trim().length >= 4) q = q.ilike("order_id", `${orderFilter.trim()}%`);
    if (paymentFilter.trim().length >= 3) q = q.eq("provider_payment_id", paymentFilter.trim());

    const { data, error: err } = await q;
    if (err) {
      setError(err.message);
      setEvents(null);
    } else {
      setEvents((data as PaymentEvent[]) ?? []);
    }
    setLoading(false);
  }, [levelFilter, orderFilter, paymentFilter]);

  useEffect(() => {
    document.title = "Eventos de pagamento — Admin";
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(load, 10000);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  const errorCount = events?.filter((e) => e.level === "error").length ?? 0;
  const warnCount = events?.filter((e) => e.level === "warn").length ?? 0;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6 flex items-center justify-between gap-4">
          <div>
            <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
              ← Voltar para admin
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Eventos de pagamento</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Alertas e logs das integrações PIX com correlação por pedido e pagamento.
            </p>
          </div>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </header>

      <section className="container py-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Eventos carregados</p>
            <p className="text-2xl font-bold">{events?.length ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-xs text-muted-foreground">Erros</p>
            <p className="text-2xl font-bold text-destructive">{errorCount}</p>
          </div>
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">Avisos</p>
            <p className="text-2xl font-bold text-primary">{warnCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-2">
            <input
              id="auto"
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <label htmlFor="auto" className="text-sm">Auto-atualizar (10s)</label>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Nível</Label>
            <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as typeof levelFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="warn">Aviso</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order">Order ID (prefixo)</Label>
            <Input id="order" placeholder="ex: 049d4c06" value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment">Provider Payment ID</Label>
            <Input id="payment" placeholder="ex: 1346526625" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} />
          </div>
        </div>

        {loading && <Skeleton className="h-64 w-full" />}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p>Erro ao carregar eventos:</p>
              <p className="font-mono text-xs mt-1">{error}</p>
            </div>
          </div>
        )}

        {!loading && events && events.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum evento encontrado com os filtros atuais.
          </div>
        )}

        {events && events.length > 0 && (
          <div className="space-y-2">
            {events.map((e) => {
              const meta = LEVEL_META[e.level];
              const Icon = meta.icon;
              return (
                <article key={e.id} className={`rounded-lg border p-3 ${meta.tone}`}>
                  <div className="flex items-start gap-3">
                    <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold uppercase">{meta.label}</span>
                        <span className="font-mono">{e.event_type}</span>
                        <span className="text-muted-foreground">· {formatDate(e.created_at)}</span>
                      </div>
                      <p className="text-sm">{e.message}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono">
                        {e.order_id && <span>order: {e.order_id.slice(0, 8)}</span>}
                        {e.payment_id && <span>payment: {e.payment_id.slice(0, 8)}</span>}
                        {e.provider_payment_id && <span>mp: {e.provider_payment_id}</span>}
                      </div>
                      {e.details !== null && e.details !== undefined && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">Detalhes</summary>
                          <pre className="mt-1 rounded bg-background/60 p-2 overflow-x-auto whitespace-pre-wrap break-all">
                            {typeof e.details === "string" ? e.details : JSON.stringify(e.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};

export default Eventos;
