import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, Paperclip, FileDown, ExternalLink, CheckCircle2, Pencil } from "lucide-react";

interface Expense {
  id: string;
  name: string;
  category: string;
  amount_cents: number;
  expense_date: string;
  notes: string | null;
  created_at: string;
  status: string;
  paid_date: string | null;
  receipt_path: string | null;
}

const fmtBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const fmtDate = (s: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");

const CATEGORIES = ["Geral", "Material", "Produção", "Marketing", "Logística", "Brindes", "Operacional", "Outros"];
const STATUS_OPTIONS: { value: "paid" | "scheduled"; label: string }[] = [
  { value: "paid", label: "Pago" },
  { value: "scheduled", label: "Agendado" },
];

export function ExpensesPanel() {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Geral");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"paid" | "scheduled">("paid");
  const [paidDate, setPaidDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Edit dialog state
  const [editing, setEditing] = useState<Expense | null>(null);
  const [eName, setEName] = useState("");
  const [eCategory, setECategory] = useState("Geral");
  const [eAmount, setEAmount] = useState("");
  const [eDate, setEDate] = useState("");
  const [eStatus, setEStatus] = useState<"paid" | "scheduled">("paid");
  const [ePaidDate, setEPaidDate] = useState<string>("");
  const [eNotes, setENotes] = useState("");
  const [eReceiptFile, setEReceiptFile] = useState<File | null>(null);
  const [eRemoveReceipt, setERemoveReceipt] = useState(false);
  const [eSaving, setESaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("id, name, category, amount_cents, expense_date, notes, created_at, status, paid_date, receipt_path")
      .order("expense_date", { ascending: false })
      .limit(1000);
    if (error) toast.error("Erro ao carregar gastos: " + error.message);
    else setItems((data ?? []) as Expense[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const paid = items.filter((e) => e.status === "paid").reduce((a, e) => a + e.amount_cents, 0);
    const scheduled = items.filter((e) => e.status === "scheduled").reduce((a, e) => a + e.amount_cents, 0);
    return { paid, scheduled, total: paid + scheduled };
  }, [items]);

  const reset = () => {
    setName("");
    setCategory("Geral");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setStatus("paid");
    setPaidDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setReceiptFile(null);
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("expense-receipts").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error("Erro no upload do comprovante: " + error.message);
      return null;
    }
    return path;
  };

  const handleSave = async () => {
    const n = name.trim();
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!n) return toast.error("Informe o nome do gasto");
    if (!Number.isFinite(cents) || cents <= 0) return toast.error("Valor inválido");
    setSaving(true);

    let receipt_path: string | null = null;
    if (receiptFile) {
      receipt_path = await uploadReceipt(receiptFile);
      if (!receipt_path) {
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase.from("expenses").insert({
      name: n,
      category,
      amount_cents: cents,
      expense_date: date,
      notes: notes.trim() || null,
      status,
      paid_date: status === "paid" ? paidDate : null,
      receipt_path,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Gasto registrado");
    reset();
    load();
  };

  const handleDelete = async (id: string, receipt_path: string | null) => {
    if (!confirm("Remover este gasto?")) return;
    if (receipt_path) {
      await supabase.storage.from("expense-receipts").remove([receipt_path]);
    }
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Removido");
    load();
  };

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Erro ao abrir: " + (error?.message ?? "sem URL"));
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const markAsPaid = async (e: Expense) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("expenses")
      .update({ status: "paid", paid_date: e.paid_date ?? today })
      .eq("id", e.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Marcado como pago");
    load();
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setEName(e.name);
    setECategory(e.category);
    setEAmount((e.amount_cents / 100).toFixed(2));
    setEDate(e.expense_date);
    setEStatus((e.status === "paid" ? "paid" : "scheduled"));
    setEPaidDate(e.paid_date ?? new Date().toISOString().slice(0, 10));
    setENotes(e.notes ?? "");
    setEReceiptFile(null);
    setERemoveReceipt(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const n = eName.trim();
    const cents = Math.round(parseFloat(eAmount.replace(",", ".")) * 100);
    if (!n) return toast.error("Informe o nome do gasto");
    if (!Number.isFinite(cents) || cents <= 0) return toast.error("Valor inválido");
    setESaving(true);

    let receipt_path: string | null | undefined = undefined; // undefined = do not change
    if (eReceiptFile) {
      const newPath = await uploadReceipt(eReceiptFile);
      if (!newPath) { setESaving(false); return; }
      // remove old
      if (editing.receipt_path) {
        await supabase.storage.from("expense-receipts").remove([editing.receipt_path]);
      }
      receipt_path = newPath;
    } else if (eRemoveReceipt && editing.receipt_path) {
      await supabase.storage.from("expense-receipts").remove([editing.receipt_path]);
      receipt_path = null;
    }

    const payload = {
      name: n,
      category: eCategory,
      amount_cents: cents,
      expense_date: eDate,
      notes: eNotes.trim() || null,
      status: eStatus,
      paid_date: eStatus === "paid" ? ePaidDate : null,
      ...(receipt_path !== undefined ? { receipt_path } : {}),
    };

    const { error } = await supabase.from("expenses").update(payload).eq("id", editing.id);
    setESaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Gasto atualizado");
    setEditing(null);
    load();
  };

  const exportCSV = () => {
    const header = ["Data lançamento", "Data pagamento", "Status", "Nome", "Categoria", "Valor (R$)", "Comprovante", "Observação"];
    const rows = items.map((e) => [
      fmtDate(e.expense_date),
      fmtDate(e.paid_date),
      e.status === "paid" ? "Pago" : "Agendado",
      e.name,
      e.category,
      (e.amount_cents / 100).toFixed(2).replace(".", ","),
      e.receipt_path ? "Sim" : "Não",
      (e.notes ?? "").replace(/\r?\n/g, " "),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Novo gasto</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
            <Label className="text-xs">Data do lançamento</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Situação</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as "paid" | "scheduled")}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data do pagamento (opcional)</Label>
            <Input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              disabled={status !== "paid"}
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs">Comprovante (opcional)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
            {receiptFile && (
              <p className="text-xs text-muted-foreground truncate">
                <Paperclip className="inline h-3 w-3 mr-1" />{receiptFile.name}
              </p>
            )}
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length} gasto(s) · <strong data-priv className="text-foreground">{fmtBRL(totals.total)}</strong> total ·{" "}
          <span data-priv className="text-emerald-600 dark:text-emerald-400">Pago: {fmtBRL(totals.paid)}</span> ·{" "}
          <span data-priv className="text-amber-600 dark:text-amber-400">Agendado: {fmtBRL(totals.scheduled)}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={items.length === 0}>
            <FileDown className="mr-2 h-3 w-3" /> Exportar relatório (CSV)
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
              <th className="px-4 py-3">Lançamento</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Comprovante</th>
              <th className="px-4 py-3">Observação</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(e.paid_date)}</td>
                <td className="px-4 py-3">
                  {e.status === "paid" ? (
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">Pago</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-300">Agendado</Badge>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">{e.category}</span>
                </td>
                <td className="px-4 py-3">
                  {e.receipt_path ? (
                    <Button size="sm" variant="ghost" onClick={() => openReceipt(e.receipt_path!)}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Ver
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{e.notes ?? "—"}</td>
                <td data-priv className="px-4 py-3 text-right font-medium">{fmtBRL(e.amount_cents)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {e.status === "scheduled" && (
                    <Button size="sm" variant="ghost" onClick={() => markAsPaid(e)} title="Marcar como pago">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(e)} title="Editar">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(e.id, e.receipt_path)} title="Remover">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum gasto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar gasto</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Nome</Label>
                  <Input value={eName} onChange={(e) => setEName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={eCategory}
                    onChange={(e) => setECategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0.01" value={eAmount} onChange={(e) => setEAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data do lançamento</Label>
                  <Input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Situação</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={eStatus}
                    onChange={(e) => setEStatus(e.target.value as "paid" | "scheduled")}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Data do pagamento</Label>
                  <Input
                    type="date"
                    value={ePaidDate}
                    onChange={(e) => setEPaidDate(e.target.value)}
                    disabled={eStatus !== "paid"}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Comprovante</Label>
                  {editing.receipt_path && !eReceiptFile && !eRemoveReceipt && (
                    <div className="flex items-center gap-2 text-xs">
                      <Button size="sm" variant="outline" onClick={() => openReceipt(editing.receipt_path!)}>
                        <ExternalLink className="h-3 w-3 mr-1" /> Ver atual
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setERemoveReceipt(true)}>
                        Remover comprovante
                      </Button>
                    </div>
                  )}
                  {eRemoveReceipt && (
                    <p className="text-xs text-amber-600">Comprovante será removido ao salvar. <button className="underline" onClick={() => setERemoveReceipt(false)}>desfazer</button></p>
                  )}
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setEReceiptFile(e.target.files?.[0] ?? null)}
                  />
                  {eReceiptFile && (
                    <p className="text-xs text-muted-foreground truncate">
                      <Paperclip className="inline h-3 w-3 mr-1" />{eReceiptFile.name} (substituirá o atual)
                    </p>
                  )}
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Observação</Label>
                  <Textarea value={eNotes} onChange={(e) => setENotes(e.target.value)} rows={2} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={eSaving}>
              {eSaving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
