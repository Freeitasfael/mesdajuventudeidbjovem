import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, RefreshCw, Play } from "lucide-react";
import { toast } from "sonner";

interface RunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  expired_orders: number;
  freed_numbers: number;
  candidates: number;
  processed: number;
  reconciled: number;
  approved: number;
  skipped: number;
  errors: number;
  notes: string | null;
}

interface PendingRow {
  id: string;
  order_id: string;
  provider_payment_id: string | null;
  reconcile_attempts: number;
  last_reconcile_at: string | null;
  next_reconcile_at: string | null;
  last_reconcile_error: string | null;
  created_at: string;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }) : "—";

const Reconciliacao = () => {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [pendings, setPendings] = useState<PendingRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [runsRes, pendingsRes] = await Promise.all([
      supabase.from("reconcile_runs").select("*").order("started_at", { ascending: false }).limit(30),
      supabase.from("payments")
        .select("id, order_id, provider_payment_id, reconcile_attempts, last_reconcile_at, next_reconcile_at, last_reconcile_error, created_at")
        .eq("status", "pending")
        .order("next_reconcile_at", { ascending: true, nullsFirst: true })
        .limit(30),
    ]);
    if (runsRes.error) setError(runsRes.error.message);
    else setRuns((runsRes.data ?? []) as RunRow[]);
    if (!pendingsRes.error) setPendings((pendingsRes.data ?? []) as PendingRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    document.title = "Reconciliação — Admin";
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  const runNow = async () => {
    setTriggering(true);
    try {
      const { error: err } = await supabase.functions.invoke("reconcile-payments", { body: {} });
      if (err) throw err;
      toast.success("Reconciliação executada");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      toast.error(`Falha ao executar: ${msg}`);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6 flex items-center justify-between gap-4">
          <div>
            <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
              ← Voltar para admin
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Reconciliação</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Histórico das execuções do cron e pagamentos pendentes com backoff.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            <Button onClick={runNow} disabled={triggering}>
              <Play className="h-4 w-4 mr-2" /> {triggering ? "Executando..." : "Executar agora"}
            </Button>
          </div>
        </div>
      </header>

      <section className="container py-6 space-y-8">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="font-mono text-xs">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Pagamentos pendentes ({pendings?.length ?? 0})</h2>
          {loading && !pendings ? (
            <Skeleton className="h-40 w-full" />
          ) : pendings && pendings.length > 0 ? (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>MP ID</TableHead>
                    <TableHead className="text-right">Tentativas</TableHead>
                    <TableHead>Última tentativa</TableHead>
                    <TableHead>Próxima</TableHead>
                    <TableHead>Último erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendings.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.order_id.slice(0, 8)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.provider_payment_id ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className={p.reconcile_attempts >= 10 ? "text-destructive font-semibold" : ""}>
                          {p.reconcile_attempts}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(p.last_reconcile_at)}</TableCell>
                      <TableCell className="text-xs">{formatDate(p.next_reconcile_at)}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate text-destructive">
                        {p.last_reconcile_error ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum pagamento pendente no momento.</p>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Últimas execuções</h2>
          {loading && !runs ? (
            <Skeleton className="h-40 w-full" />
          ) : runs && runs.length > 0 ? (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                    <TableHead className="text-right">Candidatos</TableHead>
                    <TableHead className="text-right">Processados</TableHead>
                    <TableHead className="text-right">Aprovados</TableHead>
                    <TableHead className="text-right">Reconciliados</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead className="text-right">Expirados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{formatDate(r.started_at)}</TableCell>
                      <TableCell className="text-right text-xs">
                        {r.duration_ms != null ? `${r.duration_ms}ms` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{r.candidates}</TableCell>
                      <TableCell className="text-right">{r.processed}</TableCell>
                      <TableCell className="text-right text-number-available">{r.approved}</TableCell>
                      <TableCell className="text-right">{r.reconciled}</TableCell>
                      <TableCell className={`text-right ${r.errors > 0 ? "text-destructive font-semibold" : ""}`}>
                        {r.errors}
                      </TableCell>
                      <TableCell className="text-right">{r.expired_orders}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
          )}
        </div>
      </section>
    </main>
  );
};

export default Reconciliacao;
