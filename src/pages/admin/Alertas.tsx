import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, RefreshCw, Check, BellOff } from "lucide-react";
import { toast } from "sonner";

interface AlertRow {
  id: string;
  created_at: string;
  level: string;
  alert_type: string;
  message: string;
  details: Record<string, unknown> | null;
  acknowledged_at: string | null;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }) : "—";

const ALERT_LABELS: Record<string, string> = {
  reconcile_errors_high: "Erros acima do limite na reconciliação",
  mp_recurring_failures: "Falhas consecutivas no Mercado Pago",
  mp_event_failures_burst: "Pico de falhas Mercado Pago",
};

const Alertas = () => {
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAcked, setShowAcked] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    let q = supabase
      .from("admin_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!showAcked) q = q.is("acknowledged_at", null);
    const { data, error } = await q;
    if (error) setError(error.message);
    setAlerts((data as AlertRow[]) ?? []);
    setLoading(false);
  }, [showAcked]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const acknowledge = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("admin_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id ?? null })
      .eq("id", id);
    if (error) {
      toast.error("Falha ao confirmar alerta", { description: error.message });
      return;
    }
    toast.success("Alerta marcado como lido");
    load();
  };

  const acknowledgeAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("admin_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id ?? null })
      .is("acknowledged_at", null);
    if (error) {
      toast.error("Falha", { description: error.message });
      return;
    }
    toast.success("Todos os alertas marcados como lidos");
    load();
  };

  const unackCount = (alerts ?? []).filter((a) => !a.acknowledged_at).length;

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar para admin
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Alertas administrativos</h1>
          <p className="text-sm text-muted-foreground">
            Notificações automáticas de erros recorrentes na reconciliação e no Mercado Pago.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAcked((v) => !v)}>
            <BellOff className="h-4 w-4 mr-1" />
            {showAcked ? "Ocultar lidos" : "Mostrar lidos"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); load(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          {unackCount > 0 && (
            <Button size="sm" onClick={acknowledgeAll}>
              <Check className="h-4 w-4 mr-1" /> Marcar todos como lidos
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        <Link to="/admin/reconciliacao" className="underline text-muted-foreground">Reconciliação</Link>
        <span className="text-muted-foreground">·</span>
        <Link to="/admin/eventos" className="underline text-muted-foreground">Eventos</Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
              </TableRow>
            ))}
            {!loading && (alerts?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum alerta {showAcked ? "" : "ativo"}.
                </TableCell>
              </TableRow>
            )}
            {!loading && alerts?.map((a) => (
              <TableRow key={a.id} className={a.acknowledged_at ? "opacity-60" : ""}>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(a.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={a.level === "error" ? "destructive" : "secondary"}>
                    {a.level}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {ALERT_LABELS[a.alert_type] ?? a.alert_type}
                </TableCell>
                <TableCell className="text-sm">
                  <div>{a.message}</div>
                  {a.details && (
                    <details className="text-xs text-muted-foreground mt-1">
                      <summary className="cursor-pointer">detalhes</summary>
                      <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all">
                        {JSON.stringify(a.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {a.acknowledged_at ? (
                    <span className="text-xs text-muted-foreground">lido {formatDate(a.acknowledged_at)}</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => acknowledge(a.id)}>
                      <Check className="h-3 w-3 mr-1" /> Marcar como lido
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Alertas;
