import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
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
import {
  LogOut,
  Plus,
  FileText,
  User,
  Copy,
  QrCode,
  Lightbulb,
  AlertTriangle,
  Users,
  CheckCircle2,
  Shield,
} from "lucide-react";


interface ManualSale {
  id: string;
  buyer_name: string;
  amount_cents: number | null;
  receipt_path: string;
  created_at: string;
}

interface SellerFull {
  id: string;
  name: string;
  ref_code: string;
  phone: string | null;
  church: string | null;
  neighborhood: string | null;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [seller, setSeller] = useState<SellerFull | null>(null);
  const [sales, setSales] = useState<ManualSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile completion form
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileChurch, setProfileChurch] = useState("");
  const [profileNeighborhood, setProfileNeighborhood] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);


  useEffect(() => {
    document.title = "Minhas vendas — Revendedor";
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setAuthChecked(true);
      if (data.session?.user?.id) {
        checkAdmin(data.session.user.id);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s);
      if (s?.user?.id) {
        checkAdmin(s.user.id);
      } else {
        setIsAdmin(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const checkAdmin = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };


  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure seller row exists (for Google sign-in users without one yet)
      await supabase.rpc("ensure_my_seller");

      const { data: sellerData, error: sellerErr } = await supabase
        .rpc("get_my_seller")
        .maybeSingle();
      if (sellerErr) throw sellerErr;
      if (sellerData) {
        const s = sellerData as SellerFull;
        setSeller(s);
        // pre-fill profile form
        setProfileName(s.name ?? "");
        setProfilePhone(s.phone ?? "");
        setProfileChurch(s.church ?? "");
        setProfileNeighborhood(s.neighborhood ?? "");
      }

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

  const profileComplete = !!seller && !!seller.phone && /^[0-9]{10,11}$/.test(seller.phone);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = profilePhone.replace(/\D/g, "");
    if (profileName.trim().split(/\s+/).length < 2) {
      toast.error("Informe nome e sobrenome");
      return;
    }
    if (!/^[0-9]{10,11}$/.test(cleanPhone)) {
      toast.error("WhatsApp deve ter 10 ou 11 dígitos");
      return;
    }
    setProfileSaving(true);
    try {
      const { error } = await supabase.rpc("register_seller_self", {
        _name: profileName.trim(),
        _phone: cleanPhone,
        _church: profileChurch.trim() || null,
        _neighborhood: profileNeighborhood.trim() || null,
      });
      if (error) throw error;
      toast.success("Cadastro completo! Acesso liberado.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setProfileSaving(false);
    }
  };

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
      {/* Header */}
      <header className="border-b border-border bg-gradient-to-r from-primary/5 to-secondary/30">
        <div className="container flex items-center justify-between py-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Dashboard do Revendedor
            </p>
            <h1 className="text-xl font-bold">
              {seller?.name ? `Olá, ${seller.name.split(" ")[0]}!` : "Bem-vindo!"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">
                  <Shield className="mr-2 h-4 w-4" /> Admin
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container space-y-8 py-8">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !profileComplete ? (
          /* === Profile completion (Google users / incomplete) === */
          <Card className="border-amber-300 bg-amber-50/60 p-6 dark:border-amber-900 dark:bg-amber-950/20">
            <div className="mb-4 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <h2 className="text-lg font-bold text-amber-900 dark:text-amber-200">
                  Complete seu cadastro de revendedor
                </h2>
                <p className="text-sm text-amber-800/90 dark:text-amber-300/90">
                  Para liberar o acesso completo e gerar seu código de indicação, precisamos de algumas informações.
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveProfile} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pname">Nome completo *</Label>
                <Input
                  id="pname"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Maria Silva"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pphone">WhatsApp *</Label>
                <Input
                  id="pphone"
                  type="tel"
                  inputMode="numeric"
                  value={profilePhone}
                  onChange={(e) =>
                    setProfilePhone(e.target.value.replace(/\D/g, "").slice(0, 11))
                  }
                  placeholder="11987654321"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pchurch">Igreja (opcional)</Label>
                <Input
                  id="pchurch"
                  value={profileChurch}
                  onChange={(e) => setProfileChurch(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pneigh">Bairro (opcional)</Label>
                <Input
                  id="pneigh"
                  value={profileNeighborhood}
                  onChange={(e) => setProfileNeighborhood(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={profileSaving} className="w-full sm:w-auto">
                  {profileSaving ? "Salvando…" : "Salvar e liberar acesso"}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <>
            {/* === Código de indicação em destaque === */}
            <section>
              <Card className="relative overflow-hidden border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-[0.06]">
                  <QrCode className="h-44 w-44" />
                </div>
                <div className="relative space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
                    <QrCode className="h-4 w-4" />
                    Seu código de indicação
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="rounded-2xl border-2 border-primary bg-primary/15 px-6 py-3 font-mono text-4xl font-extrabold tracking-widest text-primary shadow-md sm:text-5xl">
                      {seller?.ref_code ?? "—"}
                    </span>
                    <Button
                      size="lg"
                      onClick={async () => {
                        if (!seller?.ref_code) return;
                        try {
                          await navigator.clipboard.writeText(seller.ref_code);
                          toast.success("Código copiado!");
                        } catch {
                          toast.error("Não foi possível copiar");
                        }
                      }}
                    >
                      <Copy className="mr-2 h-5 w-5" /> Copiar código
                    </Button>
                  </div>
                  <div className="rounded-md border border-primary/20 bg-card/60 p-4 text-sm">
                    <p className="font-semibold text-foreground">
                      Como usar:
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Oriente quem for comprar a digitar este código no momento da compra, no checkout, para que a sua indicação seja corretamente contabilizada.
                    </p>
                  </div>
                </div>
              </Card>
            </section>

            {/* === Avisos === */}
            <section className="grid gap-4 md:grid-cols-2">
              <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-300">Atenção</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Se o comprador não informar o seu código, a indicação <strong>não será contabilizada</strong>. Sempre peça para a pessoa confirmar.
                  </p>
                </div>
              </Card>
              <Card className="flex items-start gap-3 border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/20">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
                <div>
                  <h4 className="font-semibold text-sky-800 dark:text-sky-300">Dica</h4>
                  <p className="text-sm text-sky-700 dark:text-sky-400">
                    Ao receber um pagamento PIX, registre a venda em <strong>"Adicionar venda"</strong> anexando o comprovante. Isso comprova sua participação.
                  </p>
                </div>
              </Card>
            </section>

            {/* === MINHAS VENDAS === */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Users className="h-5 w-5 text-primary" />
                  Minhas vendas
                </h2>
                <Button onClick={() => setOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar venda
                </Button>
              </div>

              <Card className="divide-y divide-border">
                {sales.length === 0 ? (
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
            </section>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-number-available" />
              Cada vez que seu código for usado no checkout, a indicação é contabilizada automaticamente.
            </p>
          </>
        )}
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
