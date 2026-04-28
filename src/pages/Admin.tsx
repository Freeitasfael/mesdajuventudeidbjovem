import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Plus, Trash2, Copy, Trophy } from "lucide-react";
import { toast } from "sonner";

interface Stats {
  paid_orders: number;
  pending_orders: number;
  total_revenue_cents: number;
  numbers_paid: number;
  numbers_reserved: number;
  numbers_available: number;
  sellers_count: number;
}

interface OrderRow {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
  expires_at: string;
  buyer_id: string;
  seller_id: string | null;
}

interface BuyerRow {
  id: string;
  name: string;
  phone: string;
}

interface SellerRow {
  id: string;
  name: string;
  ref_code: string;
  phone: string | null;
}

const fmtBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR");

const Admin = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [buyers, setBuyers] = useState<Record<string, BuyerRow>>({});
  const [sellers, setSellers] = useState<SellerRow[]>([]);

  // Settings
  const [title, setTitle] = useState("");
  const [priceReais, setPriceReais] = useState("");

  // New seller form
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerRef, setNewSellerRef] = useState("");
  const [newSellerPhone, setNewSellerPhone] = useState("");

  useEffect(() => {
    document.title = "Painel Admin — Rifa";
    loadAll();
  }, []);

  const loadAll = async () => {
    const [s, o, b, sl, st] = await Promise.all([
      supabase.rpc("admin_dashboard_stats"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("buyers").select("*"),
      supabase.from("sellers").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("key,value").in("key", ["raffle_title", "price_per_number_cents"]),
    ]);
    if (s.data && Array.isArray(s.data) && s.data[0]) setStats(s.data[0] as Stats);
    if (o.data) setOrders(o.data as OrderRow[]);
    if (b.data) {
      const map: Record<string, BuyerRow> = {};
      for (const row of b.data) map[row.id] = row as BuyerRow;
      setBuyers(map);
    }
    if (sl.data) setSellers(sl.data as SellerRow[]);
    for (const row of st.data ?? []) {
      if (row.key === "raffle_title" && typeof row.value === "string") setTitle(row.value);
      if (row.key === "price_per_number_cents" && typeof row.value === "number")
        setPriceReais((row.value / 100).toFixed(2));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const saveSettings = async () => {
    const cents = Math.round(parseFloat(priceReais.replace(",", ".")) * 100);
    if (!title.trim() || isNaN(cents) || cents <= 0) {
      toast.error("Preencha título e preço válidos");
      return;
    }
    const { error: e1 } = await supabase
      .from("app_settings")
      .update({ value: title, updated_at: new Date().toISOString() })
      .eq("key", "raffle_title");
    const { error: e2 } = await supabase
      .from("app_settings")
      .update({ value: cents, updated_at: new Date().toISOString() })
      .eq("key", "price_per_number_cents");
    if (e1 || e2) {
      toast.error("Erro ao salvar configurações");
    } else {
      toast.success("Configurações salvas");
    }
  };

  const createSeller = async () => {
    const name = newSellerName.trim();
    const ref = newSellerRef.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (name.length < 2 || ref.length < 3) {
      toast.error("Nome e código (mín. 3 caracteres) obrigatórios");
      return;
    }
    const { error } = await supabase.from("sellers").insert({
      name,
      ref_code: ref,
      phone: newSellerPhone.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vendedor criado");
    setNewSellerName("");
    setNewSellerRef("");
    setNewSellerPhone("");
    loadAll();
  };

  const deleteSeller = async (id: string) => {
    if (!confirm("Excluir este vendedor?")) return;
    const { error } = await supabase.from("sellers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Vendedor excluído");
      loadAll();
    }
  };

  const copyLink = (ref: string) => {
    const url = `${window.location.origin}/v/${ref}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between py-4">
          <div>
            <h1 className="text-xl font-bold">Painel Admin</h1>
            <p className="text-xs text-muted-foreground">Gerencie sua rifa</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin/ranking">
                <Trophy className="mr-2 h-4 w-4" /> Ranking
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/rifa">Ver rifa</Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <section className="container py-6">
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="sellers">Vendedores</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="mt-6">
            {stats ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Arrecadado" value={fmtBRL(stats.total_revenue_cents)} />
                <StatCard label="Pedidos pagos" value={String(stats.paid_orders)} />
                <StatCard label="Pedidos pendentes" value={String(stats.pending_orders)} />
                <StatCard label="Vendedores" value={String(stats.sellers_count)} />
                <StatCard label="Números pagos" value={String(stats.numbers_paid)} />
                <StatCard label="Números reservados" value={String(stats.numbers_reserved)} />
                <StatCard label="Números disponíveis" value={String(stats.numbers_available)} />
              </div>
            ) : (
              <p className="text-muted-foreground">Carregando…</p>
            )}
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders" className="mt-6">
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Comprador</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const buyer = buyers[o.buyer_id];
                    return (
                      <tr key={o.id} className="border-t border-border">
                        <td className="px-4 py-3">{fmtDate(o.created_at)}</td>
                        <td className="px-4 py-3">{buyer?.name ?? "—"}</td>
                        <td className="px-4 py-3">{buyer?.phone ?? "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {fmtBRL(o.total_cents)}
                        </td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum pedido ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          {/* SELLERS */}
          <TabsContent value="sellers" className="mt-6 space-y-6">
            <Card className="p-4">
              <h3 className="mb-3 font-semibold">Novo vendedor</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <Input
                  placeholder="Nome"
                  value={newSellerName}
                  onChange={(e) => setNewSellerName(e.target.value)}
                />
                <Input
                  placeholder="Código (ex: maria)"
                  value={newSellerRef}
                  onChange={(e) => setNewSellerRef(e.target.value)}
                />
                <Input
                  placeholder="Telefone (opcional)"
                  value={newSellerPhone}
                  onChange={(e) => setNewSellerPhone(e.target.value)}
                />
                <Button onClick={createSeller}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar
                </Button>
              </div>
            </Card>

            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-3">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{s.ref_code}</td>
                      <td className="px-4 py-3">{s.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyLink(s.ref_code)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSeller(s.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {sellers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum vendedor cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="mt-6">
            <Card className="max-w-lg space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="title">Título da rifa</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço por número (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={priceReais}
                  onChange={(e) => setPriceReais(e.target.value)}
                />
              </div>
              <Button onClick={saveSettings}>Salvar</Button>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <Card className="p-4">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-bold">{value}</p>
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    paid: "bg-green-500/15 text-green-700 dark:text-green-400",
    pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    expired: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
};

export default Admin;
