import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, Pencil, Download } from "lucide-react";

type PaymentMethod = "pix" | "cash" | "card" | "transfer" | "other";

interface Offering {
  id: string;
  description: string;
  amount_cents: number;
  offering_date: string;
  payment_method: PaymentMethod;
  notes: string | null;
  created_at: string;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  card: "Cartão",
  transfer: "Transferência",
  other: "Outra",
};

const METHOD_STYLE: Record<PaymentMethod, string> = {
  pix: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cash: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
  card: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  transfer: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  other: "bg-muted text-foreground/70",
};

const fmtBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const fmtDate = (d: string) => {
  try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
};

export function OfferingsPanel() {
  const [items, setItems] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [offeringDate, setOfferingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");

  const [editing, setEditing] = useState<Offering | null>(null);
  const [eDesc, setEDesc] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [eDate, setEDate] = useState("");
  const [eMethod, setEMethod] = useState<PaymentMethod>("pix");
  const [eNotes, setENotes] = useState("");
  const [eSaving, setESaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("offerings")
      .select("*")
      .order("offering_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar ofertas"); }
    else setItems((data ?? []) as Offering[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const total = useMemo(() => items.reduce((a, o) => a + o.amount_cents, 0), [items]);
  const countByMethod = useMemo(() => {
    const m: Record<PaymentMethod, number> = { pix: 0, cash: 0, card: 0, transfer: 0, other: 0 };
    items.forEach((o) => { m[o.payment_method] += o.amount_cents; });
    return m;
  }, [items]);

  const add = async () => {
    const value = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!description.trim()) { toast.error("Descreva a oferta"); return; }
    if (!Number.isFinite(value) || value <= 0) { toast.error("Valor inválido"); return; }
    setSaving(true);
    const { error } = await supabase.from("offerings").insert({
      description: description.trim(),
      amount_cents: value,
      offering_date: offeringDate,
      payment_method: method,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Oferta registrada");
    setDescription(""); setAmount(""); setNotes(""); setMethod("pix");
    setOfferingDate(new Date().toISOString().slice(0, 10));
    load();
  };

  const openEdit = (o: Offering) => {
    setEditing(o);
    setEDesc(o.description);
    setEAmount((o.amount_cents / 100).toFixed(2));
    setEDate(o.offering_date);
    setEMethod(o.payment_method);
    setENotes(o.notes ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const value = Math.round(parseFloat(eAmount.replace(",", ".")) * 100);
    if (!eDesc.trim()) { toast.error("Descreva a oferta"); return; }
    if (!Number.isFinite(value) || value <= 0) { toast.error("Valor inválido"); return; }
    setESaving(true);
    const { error } = await supabase.from("offerings").update({
      description: eDesc.trim(),
      amount_cents: value,
      offering_date: eDate,
      payment_method: eMethod,
      notes: eNotes.trim() || null,
    }).eq("id", editing.id);
    setESaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Oferta atualizada");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta oferta?")) return;
    const { error } = await supabase.from("offerings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Oferta excluída");
    load();
  };

  const exportCSV = () => {
    const rows = [
      ["Data", "Descrição", "Forma de pagamento", "Valor (R$)", "Observações"],
      ...items.map((o) => [
        fmtDate(o.offering_date),
        o.description,
        METHOD_LABEL[o.payment_method],
        (o.amount_cents / 100).toFixed(2).replace(".", ","),
        o.notes ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ofertas-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total arrecadado</p>
          <p data-priv className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{items.length} oferta(s)</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pix</p>
          <p data-priv className="mt-1 text-2xl font-bold">{fmtBRL(countByMethod.pix)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Dinheiro</p>
          <p data-priv className="mt-1 text-2xl font-bold">{fmtBRL(countByMethod.cash)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cartão / Transferência / Outras</p>
          <p data-priv className="mt-1 text-2xl font-bold">{fmtBRL(countByMethod.card + countByMethod.transfer + countByMethod.other)}</p>
        </Card>
      </div>

      {/* Cadastro */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Registrar nova oferta</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label>Descrição *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Oferta especial culto missões" />
          </div>
          <div>
            <Label>Valor (R$) *</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={offeringDate} onChange={(e) => setOfferingDate(e.target.value)} />
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="pix">Pix</option>
              <option value="cash">Dinheiro</option>
              <option value="card">Cartão</option>
              <option value="transfer">Transferência</option>
              <option value="other">Outra</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ex.: ofertante, culto, contexto..." />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button onClick={add} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Adicionar oferta"}
          </Button>
        </div>
      </Card>

      {/* Lista */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Ofertas registradas</h3>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={items.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma oferta registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {items.map((o) => (
              <div key={o.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{o.description}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${METHOD_STYLE[o.payment_method]}`}>
                      {METHOD_LABEL[o.payment_method]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {fmtDate(o.offering_date)}
                    {o.notes ? ` · ${o.notes}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(o.amount_cents)}</div>
                  <div className="mt-1 flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(o)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(o.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar oferta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descrição</Label>
              <Input value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Valor (R$)</Label>
                <Input value={eAmount} onChange={(e) => setEAmount(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <select
                value={eMethod}
                onChange={(e) => setEMethod(e.target.value as PaymentMethod)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="pix">Pix</option>
                <option value="cash">Dinheiro</option>
                <option value="card">Cartão</option>
                <option value="transfer">Transferência</option>
                <option value="other">Outra</option>
              </select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={eNotes} onChange={(e) => setENotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={eSaving}>{eSaving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
