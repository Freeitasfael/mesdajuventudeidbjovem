import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Plus, Trash2, Copy, Trophy, Bell, Upload, Move, Image as ImageIcon, Eye } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeroRifa } from "@/components/HeroRifa";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const ALLOWED_EXT = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "mp4", "webm", "mov", "m4v",
]);
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const HERO_BUCKET = "hero-media";
const extractStoragePath = (url: string): string | null => {
  const marker = `/storage/v1/object/public/${HERO_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.substring(i + marker.length).split("?")[0];
};

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

  // Hero settings
  type HeroPrize = {
    position: string;
    name: string;
    image: string;
    mediaType?: "image" | "video";
    fit?: "cover" | "contain";
    scale?: number;
    posX?: number;
    posY?: number;
  };
  const [heroPrizes, setHeroPrizes] = useState<HeroPrize[]>([
    { position: "1º PRÊMIO", name: "", image: "" },
    { position: "2º PRÊMIO", name: "", image: "" },
    { position: "3º PRÊMIO", name: "", image: "" },
  ]);
  const [heroStats, setHeroStats] = useState({ years: 16, people: "MILHARES", coverage: "TODO O PAÍS" });
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [adjustIdx, setAdjustIdx] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);

  // New seller form
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerRef, setNewSellerRef] = useState("");
  const [newSellerPhone, setNewSellerPhone] = useState("");

  useEffect(() => {
    document.title = "Painel Admin — Rifa";
    loadAll();
  }, []);

  useEffect(() => {
    const cents = Math.round(parseFloat(priceReais.replace(",", ".")) * 100);
    setPreviewPrice(Number.isFinite(cents) && cents > 0 ? cents : null);
  }, [priceReais]);

  const previewPrizes = useMemo(
    () =>
      heroPrizes
        .filter((p) => p.name.trim().length > 0)
        .map((p) => ({
          position: p.position,
          name: p.name,
          image: p.image || null,
          mediaType: p.mediaType ?? null,
          fit: p.fit ?? null,
          scale: p.scale ?? null,
          posX: p.posX ?? null,
          posY: p.posY ?? null,
        })),
    [heroPrizes],
  );

  const loadAll = async () => {
    const [s, o, b, sl, st] = await Promise.all([
      supabase.rpc("admin_dashboard_stats"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("buyers").select("*"),
      supabase.from("sellers").select("*").order("created_at", { ascending: false }),
      supabase
        .from("app_settings")
        .select("key,value")
        .in("key", [
          "raffle_title",
          "price_per_number_cents",
          "hero_prizes",
          "hero_stats",
        ]),
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
      if (row.key === "hero_prizes" && Array.isArray(row.value)) {
        setHeroPrizes(row.value as typeof heroPrizes);
      }
      if (row.key === "hero_stats" && row.value && typeof row.value === "object") {
        setHeroStats(row.value as typeof heroStats);
      }
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

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const deleteHeroMedia = async (url?: string | null) => {
    if (!url) return;
    const path = extractStoragePath(url);
    if (!path) return;
    const { error } = await supabase.storage.from(HERO_BUCKET).remove([path]);
    if (error) console.log("[Admin] failed to delete hero media", path, error);
    else console.log("[Admin] removed hero media", path);
  };

  const handleHeroUpload = async (idx: number, file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mime = (file.type || "").toLowerCase();
    const isVideo = mime.startsWith("video/");
    const mimeOk = ALLOWED_MIME.has(mime);
    const extOk = ALLOWED_EXT.has(ext);
    if (!mimeOk || !extOk) {
      toast.error("Formato não suportado. Use PNG, JPG, WEBP, GIF, MP4, WEBM ou MOV.");
      return;
    }
    // Cross-check: extension must match MIME family
    const expectedExt = MIME_TO_EXT[mime];
    const isImageMime = mime.startsWith("image/");
    const isVideoMime = mime.startsWith("video/");
    const isImageExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
    const isVideoExt = ["mp4", "webm", "mov", "m4v"].includes(ext);
    if ((isImageMime && !isImageExt) || (isVideoMime && !isVideoExt)) {
      toast.error("Extensão e tipo do arquivo não conferem.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo maior que 50MB");
      return;
    }
    setUploadingIdx(idx);
    try {
      const safeExt = expectedExt || ext;
      const path = `prizes/${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
      const { error } = await supabase.storage.from(HERO_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: mime,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(HERO_BUCKET).getPublicUrl(path);
      // Delete previous media (if it lived in our bucket)
      const prev = heroPrizes[idx]?.image;
      if (prev) await deleteHeroMedia(prev);
      const next = [...heroPrizes];
      next[idx] = {
        ...next[idx],
        image: data.publicUrl,
        mediaType: isVideo ? "video" : "image",
      };
      setHeroPrizes(next);
      toast.success("Mídia enviada");
    } catch (e) {
      console.log("[Admin] upload hero media error", e);
      toast.error("Falha ao enviar mídia");
    } finally {
      setUploadingIdx(null);
    }
  };

  const updatePrize = (idx: number, patch: Partial<HeroPrize>) => {
    const next = [...heroPrizes];
    next[idx] = { ...next[idx], ...patch };
    setHeroPrizes(next);
  };

  const saveHero = async () => {
    const cleanedPrizes = heroPrizes
      .map((p) => ({
        position: p.position.trim(),
        name: p.name.trim(),
        image: p.image.trim(),
        mediaType: p.mediaType ?? (/(\.mp4|\.webm|\.mov|\.m4v)(\?|$)/i.test(p.image) ? "video" : "image"),
        fit: p.fit ?? "cover",
        scale: clamp(typeof p.scale === "number" ? p.scale : 1, 0.6, 1.6),
        posX: clamp(typeof p.posX === "number" ? p.posX : 0, -50, 50),
        posY: clamp(typeof p.posY === "number" ? p.posY : 0, -50, 50),
      }))
      .filter((p) => p.name.length > 0);
    const years = Number(heroStats.years);
    if (!Number.isFinite(years) || years <= 0) {
      toast.error("Anos de história inválido");
      return;
    }
    const cleanedStats = {
      years,
      people: heroStats.people.trim() || "MILHARES",
      coverage: heroStats.coverage.trim() || "TODO O PAÍS",
    };
    const nowIso = new Date().toISOString();
    const { error: e1 } = await supabase
      .from("app_settings")
      .upsert(
        { key: "hero_prizes", value: cleanedPrizes, updated_at: nowIso },
        { onConflict: "key" },
      );
    const { error: e2 } = await supabase
      .from("app_settings")
      .upsert(
        { key: "hero_stats", value: cleanedStats, updated_at: nowIso },
        { onConflict: "key" },
      );
    if (e1 || e2) {
      toast.error("Erro ao salvar Hero");
      console.log("[Admin] saveHero", e1, e2);
    } else {
      toast.success("Hero atualizado");
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
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <Link to="/admin/alertas">
                <Bell className="mr-2 h-4 w-4" /> Alertas
              </Link>
            </Button>
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
            <TabsTrigger value="hero">Hero</TabsTrigger>
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

          {/* HERO */}
          <TabsContent value="hero" className="mt-6">
            <Card className="max-w-3xl space-y-6 p-6">
              <div>
                <h3 className="font-semibold">Estatísticas do Hero</h3>
                <p className="text-xs text-muted-foreground">
                  Aparecem em destaque acima dos prêmios.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Anos</Label>
                    <Input
                      type="number"
                      min="1"
                      value={heroStats.years}
                      onChange={(e) =>
                        setHeroStats({ ...heroStats, years: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Pessoas impactadas</Label>
                    <Input
                      value={heroStats.people}
                      onChange={(e) => setHeroStats({ ...heroStats, people: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Alcance</Label>
                    <Input
                      value={heroStats.coverage}
                      onChange={(e) =>
                        setHeroStats({ ...heroStats, coverage: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold">Prêmios</h3>
                  <p className="text-xs text-muted-foreground">
                    Deixe a URL da imagem em branco para usar a imagem padrão.
                  </p>
                </div>
                {heroPrizes.map((p, idx) => {
                  const isVideo = p.mediaType === "video" || /(\.mp4|\.webm|\.mov|\.m4v)(\?|$)/i.test(p.image);
                  return (
                    <div key={idx} className="rounded-md border border-border p-3 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Posição</Label>
                          <Input
                            value={p.position}
                            onChange={(e) => updatePrize(idx, { position: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Nome do prêmio</Label>
                          <Input
                            value={p.name}
                            onChange={(e) => updatePrize(idx, { name: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                        <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-muted">
                          {p.image ? (
                            isVideo ? (
                              <video
                                src={p.image}
                                muted
                                autoPlay
                                loop
                                playsInline
                                className="h-full w-full"
                                style={{
                                  objectFit: p.fit ?? "cover",
                                  objectPosition: `${50 + (p.posX ?? 0)}% ${50 + (p.posY ?? 0)}%`,
                                  transform: `scale(${p.scale ?? 1})`,
                                }}
                              />
                            ) : (
                              <img
                                src={p.image}
                                alt=""
                                className="h-full w-full"
                                style={{
                                  objectFit: p.fit ?? "cover",
                                  objectPosition: `${50 + (p.posX ?? 0)}% ${50 + (p.posY ?? 0)}%`,
                                  transform: `scale(${p.scale ?? 1})`,
                                }}
                              />
                            )
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-8 w-8" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Mídia (imagem, GIF ou vídeo) — máx 50MB</Label>
                          <div className="flex flex-wrap gap-2">
                            <label className="inline-flex">
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleHeroUpload(idx, f);
                                  e.currentTarget.value = "";
                                }}
                              />
                              <Button
                                asChild
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={uploadingIdx === idx}
                              >
                                <span>
                                  <Upload className="mr-2 h-4 w-4" />
                                  {uploadingIdx === idx ? "Enviando..." : "Enviar arquivo"}
                                </span>
                              </Button>
                            </label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!p.image}
                              onClick={() => setAdjustIdx(idx)}
                            >
                              <Move className="mr-2 h-4 w-4" /> Ajustar tamanho/posição
                            </Button>
                            {p.image && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  await deleteHeroMedia(p.image);
                                  updatePrize(idx, { image: "", mediaType: undefined });
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Remover
                              </Button>
                            )}
                          </div>
                          <Input
                            placeholder="ou cole uma URL https://..."
                            value={p.image}
                            onChange={(e) =>
                              updatePrize(idx, {
                                image: e.target.value,
                                mediaType: /(\.mp4|\.webm|\.mov|\.m4v)(\?|$)/i.test(e.target.value)
                                  ? "video"
                                  : "image",
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setHeroPrizes([
                        ...heroPrizes,
                        { position: `${heroPrizes.length + 1}º PRÊMIO`, name: "", image: "" },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar prêmio
                  </Button>
                  {heroPrizes.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHeroPrizes(heroPrizes.slice(0, -1))}
                    >
                      <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Remover último
                    </Button>
                  )}
                </div>
              </div>

              <Button onClick={saveHero}>Salvar Hero</Button>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={adjustIdx !== null} onOpenChange={(o) => !o && setAdjustIdx(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajustar tamanho e posição</DialogTitle>
          </DialogHeader>
          {adjustIdx !== null && heroPrizes[adjustIdx] && (() => {
            const p = heroPrizes[adjustIdx];
            const isVid = p.mediaType === "video" || /(\.mp4|\.webm|\.mov|\.m4v)(\?|$)/i.test(p.image);
            const fit = p.fit ?? "cover";
            const scale = p.scale ?? 1;
            const posX = p.posX ?? 0;
            const posY = p.posY ?? 0;
            const style: React.CSSProperties = {
              objectFit: fit,
              objectPosition: `${50 + posX}% ${50 + posY}%`,
              transform: `scale(${scale})`,
            };
            return (
              <div className="space-y-4">
                <div className="mx-auto aspect-square w-64 overflow-hidden rounded-2xl border border-border bg-muted">
                  {p.image ? (
                    isVid ? (
                      <video src={p.image} muted autoPlay loop playsInline className="h-full w-full" style={style} />
                    ) : (
                      <img src={p.image} alt="" className="h-full w-full" style={style} />
                    )
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label>Ajuste</Label>
                  <Select
                    value={fit}
                    onValueChange={(v) => updatePrize(adjustIdx, { fit: v as "cover" | "contain" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cover">Preencher (pode cortar)</SelectItem>
                      <SelectItem value="contain">Mostrar inteiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Zoom: {scale.toFixed(2)}x</Label>
                  <Slider
                    min={0.6}
                    max={1.6}
                    step={0.05}
                    value={[scale]}
                    onValueChange={([v]) => updatePrize(adjustIdx, { scale: v })}
                  />
                  <p className="text-xs text-muted-foreground">Limite 0.6x a 1.6x para evitar desproporção.</p>
                </div>
                <div className="space-y-1">
                  <Label>Posição horizontal: {posX}%</Label>
                  <Slider
                    min={-50} max={50} step={1}
                    value={[posX]}
                    onValueChange={([v]) => updatePrize(adjustIdx, { posX: v })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Posição vertical: {posY}%</Label>
                  <Slider
                    min={-50} max={50} step={1}
                    value={[posY]}
                    onValueChange={([v]) => updatePrize(adjustIdx, { posY: v })}
                  />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                if (adjustIdx !== null)
                  updatePrize(adjustIdx, { fit: "cover", scale: 1, posX: 0, posY: 0 });
              }}
            >
              Resetar
            </Button>
            <Button onClick={() => setAdjustIdx(null)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
