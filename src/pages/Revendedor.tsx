import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LogOut, Plus, FileText, User, Copy, ExternalLink } from "lucide-react";

interface ManualSale {
  id: string;
  buyer_name: string;
  amount_cents: number | null;
  receipt_path: string;
  created_at: string;
}

interface SellerLite {
  id: string;
  name: string;
  ref_code: string;
}

const formatBRL = (cents: number | null) =>
  cents == null ? "—" : `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const Revendedor = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [seller, setSeller] = useState<SellerLite | null>(null);
  const [sales, setSales] = useState<ManualSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Minhas vendas — Revendedor";
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sellerData, error: sellerErr } = await supabase
        .rpc("ensure_my_seller")
        .maybeSingle();
      if (sellerErr) throw sellerErr;
      if (sellerData) setSeller(sellerData as SellerLite);

      const { data, error } = await supabase.rpc("get_my_manual_sales");
      if (error) throw error;
      setSales((data ?? []) as ManualSale[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const resetForm = () => {
    setBuyerName("");
    setAmount("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Anexe o comprovante PIX");
      return;
    }
    if (buyerName.trim().length < 2) {
      toast.error("Informe o nome do comprador");
      return;
    }
    // Validate file type & size: image or PDF, up to 8MB
    const okType =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!okType) {
      toast.error("Comprovante deve ser imagem ou PDF");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 8MB)");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada");

      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${uid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("manual-sale-receipts")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const cents = amount
        ? Math.round(parseFloat(amount.replace(",", ".")) * 100)
        : null;

      const { error: rpcErr } = await supabase.rpc("register_my_manual_sale", {
        _buyer_name: buyerName.trim(),
        _receipt_path: path,
        _amount_cents: cents && !isNaN(cents) ? cents : null,
      });
      if (rpcErr) throw rpcErr;

      toast.success("Venda registrada!");
      resetForm();
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    } finally {
      setSubmitting(false);
    }
  };

  const viewReceipt = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("manual-sale-receipts")
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o comprovante");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  if (!authed) {
    return <Navigate to="/auth?next=/revendedor" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Revendedor
            </p>
            <h1 className="text-lg font-bold">{seller?.name ?? "—"}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="container space-y-6 py-8">
        {/* Link de divulgação + código IDB */}
        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ExternalLink className="h-4 w-4 text-primary" />
              Seu link de divulgação
            </div>
            {seller?.ref_code && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-0.5 font-mono text-xs font-bold text-primary">
                {seller.ref_code}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs">
              {seller ? `${window.location.origin}/v/${seller.ref_code}` : "—"}
            </code>
            <Button
              size="sm"
              onClick={async () => {
                if (!seller) return;
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/v/${seller.ref_code}`,
                  );
                  toast.success("Link copiado!");
                } catch {
                  toast.error("Não foi possível copiar");
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Toda compra feita pelo seu link é registrada automaticamente no seu nome.
          </p>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Minhas vendas</h2>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar venda
          </Button>
        </div>

        <Card className="divide-y divide-border">
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : sales.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma venda registrada ainda.
            </p>
          ) : (
            sales.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-muted p-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{s.buyer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(s.created_at)}
                      {s.amount_cents != null && ` · ${formatBRL(s.amount_cents)}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => viewReceipt(s.receipt_path)}
                >
                  <FileText className="mr-2 h-4 w-4" /> Comprovante
                </Button>
              </div>
            ))
          )}
        </Card>
      </main>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar venda manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="buyer">Nome do comprador *</Label>
              <Input
                id="buyer"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (opcional)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt">Comprovante PIX *</Label>
              <Input
                ref={fileRef}
                id="receipt"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Imagem ou PDF, até 8MB. Obrigatório para validar a venda.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Enviando…" : "Registrar venda"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Revendedor;
