import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Check, Clock, Search, RefreshCw } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

interface OrderRow {
  id: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  total_cents: number;
  expires_at: string;
  created_at: string;
  buyer_name: string | null;
  referral_label: string | null;
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

const STATUS_META: Record<
  OrderRow["status"],
  { label: string; tone: string; icon: typeof Check }
> = {
  paid: {
    label: "Pago",
    tone: "border-number-available/40 bg-number-available/10 text-number-available",
    icon: Check,
  },
  pending: {
    label: "Aguardando pagamento",
    tone: "border-primary/40 bg-primary/10 text-primary",
    icon: Clock,
  },
  expired: {
    label: "Expirado",
    tone: "border-destructive/40 bg-destructive/5 text-destructive",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelado",
    tone: "border-destructive/40 bg-destructive/5 text-destructive",
    icon: AlertCircle,
  },
};

const PHONE_KEY = "rifa.last_phone";

const Acompanhar = () => {
  const [searchParams] = useSearchParams();
  const highlightOrderId = searchParams.get("orderId");
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const autoLoadedRef = useRef(false);

  useEffect(() => {
    document.title = "Acompanhar compra — Rifa Digital";
    const saved = localStorage.getItem(PHONE_KEY);
    if (saved) setPhone(saved);
  }, []);

  const sanitizedPhone = phone.replace(/\D/g, "");

  const fetchOrders = useCallback(async (silent = false) => {
    if (sanitizedPhone.length < 10 || sanitizedPhone.length > 11) {
      if (!silent) setError("Informe um telefone válido (DDD + número, 10 ou 11 dígitos).");
      return;
    }
    if (!silent) setLoading(true);
    setError(null);

    const timeoutMs = 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const r = await fetch(`${SUPA_URL}/functions/v1/find-orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`,
          apikey: KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: sanitizedPhone }),
        signal: controller.signal,
      });
      const json = await r.json();
      if (!r.ok) {
        setError(
          json?.message ??
            "Não foi possível consultar seus pedidos. Tente novamente.",
        );
        setOrders(null);
        return;
      }
      setOrders(json.orders ?? []);
      setHasSearched(true);
      localStorage.setItem(PHONE_KEY, sanitizedPhone);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("A consulta demorou demais. Verifique sua conexão e tente novamente.");
      } else {
        setError("Falha de conexão. Verifique sua internet e tente novamente.");
      }
      setOrders(null);
    } finally {
      clearTimeout(timer);
      if (!silent) setLoading(false);
    }
  }, [sanitizedPhone]);

  // Auto-busca quando há telefone salvo (vinda do checkout ou retorno do comprador)
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (sanitizedPhone.length >= 10 && sanitizedPhone.length <= 11) {
      autoLoadedRef.current = true;
      fetchOrders(false);
    }
  }, [sanitizedPhone, fetchOrders]);

  // Autoatualização a cada 15s quando houver pedidos pendentes
  useEffect(() => {
    if (!orders) return;
    const hasPending = orders.some((o) => o.status === "pending");
    if (!hasPending) return;
    const id = window.setInterval(() => fetchOrders(true), 15000);
    return () => window.clearInterval(id);
  }, [orders, fetchOrders]);

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader
        breadcrumbs={[
          { label: "Início", to: "/rifa" },
          { label: "Consultar meu número" },
        ]}
      />
      <div className="container py-6">
        <h1 className="text-2xl font-bold">Acompanhar minha compra</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Digite o telefone usado na compra para ver o status dos seus pedidos.
        </p>
      </div>

      <section className="container py-8 max-w-xl space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchOrders();
          }}
          className="rounded-lg border border-border bg-card p-5 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (com DDD)</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="11999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={15}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Buscar pedidos
              </>
            )}
          </Button>
        </form>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchOrders()}
              >
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {loading && !orders && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!loading && hasSearched && orders && orders.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
            <Search className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm">
              Nenhum pedido encontrado para este telefone.
            </p>
            <p className="text-xs text-muted-foreground">
              Verifique se digitou o mesmo número usado no checkout.
            </p>
            <Button asChild variant="outline">
              <Link to="/rifa">Fazer nova compra</Link>
            </Button>
          </div>
        )}

        {orders && orders.length > 0 && (
          <div className="space-y-3">
            {orders.some((o) => o.status === "pending") && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Atualizando automaticamente a cada 15s
              </p>
            )}
            {orders.map((o) => {
              const meta = STATUS_META[o.status];
              const Icon = meta.icon;
              const isHighlighted = highlightOrderId === o.id;
              return (
                <article
                  key={o.id}
                  className={`rounded-lg border bg-card p-4 space-y-3 ${
                    isHighlighted ? "border-primary ring-2 ring-primary/30" : "border-border"
                  }`}
                >
                  {isHighlighted && (
                    <p className="text-xs font-semibold text-primary">
                      ✨ Pedido recém-criado — clique para ver o QR Code
                    </p>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-mono">
                        Pedido {o.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(o.created_at)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full border inline-flex items-center gap-1 ${meta.tone}`}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {o.numbers.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Sem números
                      </span>
                    ) : (
                      o.numbers.map((n) => (
                        <span
                          key={n}
                          className="text-xs font-mono px-2 py-0.5 rounded bg-muted"
                        >
                          {n.toString().padStart(3, "0")}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <p className="text-sm font-semibold">
                      {formatBRL(o.total_cents)}
                    </p>
                    {o.status === "pending" && (
                      <Button asChild size="sm">
                        <Link to={`/pagamento/${o.id}`}>Ver QR Code</Link>
                      </Button>
                    )}
                    {o.status === "paid" && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/pagamento/${o.id}`}>Ver comprovante</Link>
                      </Button>
                    )}
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

export default Acompanhar;
