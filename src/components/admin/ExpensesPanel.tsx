import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw } from "lucide-react";

interface Expense {
  id: string;
  name: string;
  category: string;
  amount_cents: number;
  expense_date: string;
  notes: string | null;
  created_at: string;
}

const fmtBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("pt-BR");

const CATEGORIES = ["Geral", "Material", "Produção", "Marketing", "Logística", "Brindes", "Operacional", "Outros"];

export function ExpensesPanel() {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Geral");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("id, name, category, amount_cents, expense_date, notes, created_at")
      .order("expense_date", { ascending: false })
      .limit(1000);
    if (error) toast.error("Erro ao carregar gastos: " + error.message);
    else setItems((data ?? []) as Expense[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const total = useMemo(
    () => items.reduce((acc, e) => acc + e.amount_cents, 0),
    [items],
  );

  const reset = () => {
    setName("");
    setCategory("Geral");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
  };

  const handleSave = async () => {
    const n = name.trim();
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!n) return toast.error("Informe o nome do gasto");
    if (!Number.isFinite(cents) || cents <= 0) return toast.error("Valor inválido");
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      name: n,
      category,
      amount_cents: cents,
      expense_date: date,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Gasto registrado");
    reset();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este gasto?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Removido");
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Novo gasto</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Impressão de banners" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor (R$)</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Observação</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes (opcional)" rows={2} />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Plus className="mr-1 h-4 w-4" /> {saving ? "Salvando..." : "Adicionar gasto"}
        </Button>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} gasto(s) · <strong className="text-foreground">{fmtBRL(total)}</strong> total
        </p>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Recarregar
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Observação</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">{e.category}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{e.notes ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium">{fmtBRL(e.amount_cents)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(e.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum gasto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
