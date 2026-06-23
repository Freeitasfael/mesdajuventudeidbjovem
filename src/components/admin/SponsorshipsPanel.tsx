import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, CheckCircle2, Clock } from "lucide-react";
import beneficiosImg from "@/assets/beneficios-patrocinador.png.asset.json";

interface Sponsorship {
  id: string;
  sponsor_name: string;
  amount_cents: number;
  kind: "cash" | "permuta";
  status: "confirmed" | "pending";
  notes: string | null;
  created_at: string;
}

const fmtBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

export function SponsorshipsPanel() {
  const [items, setItems] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sponsorName, setSponsorName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"cash" | "permuta">("cash");
  const [status, setStatus] = useState<"confirmed" | "pending">("pending");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sponsorships")
      .select("id, sponsor_name, amount_cents, kind, status, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast.error("Erro ao carregar: " + error.message);
    else setItems((data ?? []) as Sponsorship[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const confirmedCash = items
      .filter((s) => s.status === "confirmed" && s.kind === "cash")
      .reduce((a, s) => a + s.amount_cents, 0);
    const confirmedPermuta = items
      .filter((s) => s.status === "confirmed" && s.kind === "permuta")
      .reduce((a, s) => a + s.amount_cents, 0);
    const pending = items
      .filter((s) => s.status === "pending")
      .reduce((a, s) => a + s.amount_cents, 0);
    return { confirmedCash, confirmedPermuta, pending };
  }, [items]);

  const reset = () => {
    setSponsorName("");
    setAmount("");
    setKind("cash");
    setStatus("pending");
    setNotes("");
  };

  const handleSave = async () => {
    const n = sponsorName.trim();
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!n) return toast.error("Informe o nome do patrocinador");
    if (!Number.isFinite(cents) || cents <= 0) return toast.error("Valor inválido");
    setSaving(true);
    const { error } = await supabase.from("sponsorships").insert({
      sponsor_name: n,
      amount_cents: cents,
      kind,
      status,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Patrocinador registrado");
    reset();
    load();
  };

  const toggleStatus = async (s: Sponsorship) => {
    const next = s.status === "confirmed" ? "pending" : "confirmed";
    const { error } = await supabase.from("sponsorships").update({ status: next }).eq("id", s.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(next === "confirmed" ? "Marcado como confirmado" : "Marcado como pendente");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este patrocínio?")) return;
    const { error } = await supabase.from("sponsorships").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Removido");
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-4">
        <div className="mb-3">
          <h3 className="font-semibold">Benefícios do Patrocinador</h3>
          <p className="text-xs text-muted-foreground">
            Use esta visualização ao apresentar a proposta para empresas parceiras.
          </p>
        </div>
        <a href={beneficiosImg.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={beneficiosImg.url}
            alt="Benefícios oferecidos aos patrocinadores"
            className="w-full h-auto rounded-md border border-border"
            loading="lazy"
          />
        </a>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Confirmado (dinheiro)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(totals.confirmedCash)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Confirmado (permuta)</p>
          <p className="mt-1 text-2xl font-bold">{fmtBRL(totals.confirmedPermuta)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pendente</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{fmtBRL(totals.pending)}</p>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Novo patrocínio</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs">Patrocinador</Label>
            <Input value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} placeholder="Ex: Empresa XYZ" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor (R$)</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as "cash" | "permuta")}
            >
              <option value="cash">Dinheiro</option>
              <option value="permuta">Permuta</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as "confirmed" | "pending")}
            >
              <option value="pending">Pendente</option>
              <option value="confirmed">Confirmado</option>
            </select>
          </div>
          <div className="space-y-1 lg:col-span-3">
            <Label className="text-xs">Observação</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Detalhes (opcional)" />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Plus className="mr-1 h-4 w-4" /> {saving ? "Salvando..." : "Adicionar"}
        </Button>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} patrocínio(s) cadastrado(s)</p>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Recarregar
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Patrocinador</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Observação</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{s.sponsor_name}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                    {s.kind === "cash" ? "Dinheiro" : "Permuta"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {s.status === "confirmed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Confirmado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      <Clock className="h-3 w-3" /> Pendente
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{s.notes ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium">{fmtBRL(s.amount_cents)}</td>
                <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => toggleStatus(s)}>
                    {s.status === "confirmed" ? "Marcar pendente" : "Confirmar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum patrocínio cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
