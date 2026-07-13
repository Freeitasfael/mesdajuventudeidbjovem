import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Plus, Trash2, Copy, Trophy, Bell, Upload, Move, Image as ImageIcon, Eye, EyeOff, RefreshCw, RotateCw, Radio, Download, Users, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHidePrivacy } from "@/hooks/useHidePrivacy";

import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeroRifa } from "@/components/HeroRifa";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { netFromOrders } from "@/lib/fees";
import { computePaymentKpis } from "@/services/dashboardMetrics";
import { isPaid, isPending, isCancelledLike } from "@/lib/orderStatus";
import { EntradaPanel } from "@/components/admin/EntradaPanel";
import { VSLPanel } from "@/components/admin/VSLPanel";
import { AdminsPanel } from "@/components/admin/AdminsPanel";
import { DashboardConsolidado } from "@/components/admin/DashboardConsolidado";
import { ExpensesPanel } from "@/components/admin/ExpensesPanel";
import { SponsorshipsPanel } from "@/components/admin/SponsorshipsPanel";
import { OfferingsPanel } from "@/components/admin/OfferingsPanel";
import { RecapPanel } from "@/components/admin/RecapPanel";
import { AboutPanel } from "@/components/admin/AboutPanel";
import { SystemHealthPanel } from "@/components/admin/SystemHealthPanel";
import { FinancialAudit } from "@/components/admin/FinancialAudit";
import { NetValueCell } from "@/components/admin/NetValueCell";

import { WhatsAppLink } from "@/components/WhatsAppLink";

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
  referral_label: string | null;
  payment_method: string | null;
  notified_at: string | null;
}


interface PaymentRow {
  id: string;
  order_id: string;
  status: string;
  amount_cents: number;
  provider_payment_id: string | null;
  created_at: string;
  updated_at: string;
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
  const [tab, setTab] = useState<string>(() => {
    if (typeof window === "undefined") return "dashboard";
    const h = window.location.hash.replace("#", "");
    return h || "dashboard";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.location.hash = tab;
  }, [tab]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [buyers, setBuyers] = useState<Record<string, BuyerRow>>({});
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [revalidatingId, setRevalidatingId] = useState<string | null>(null);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [salesClosed, setSalesClosed] = useState<boolean>(false);
  const [savingSalesClosed, setSavingSalesClosed] = useState(false);


  // Ranking de vendedores (apenas para o painel Vendedores)
  const [sellerRanking, setSellerRanking] = useState<Array<{
    seller_id: string;
    seller_name: string;
    ref_code: string;
    total_numbers: number;
    total_cents: number;
    total_orders: number;
  }>>([]);

  // Pagamentos da Camiseta (sub-aba Pagamentos > Camiseta)
  const [shirtPayments, setShirtPayments] = useState<Array<{
    id: string;
    created_at: string;
    buyer_name: string;
    total_cents: number;
    status: string;
    mp_payment_id: string | null;
    payment_method: string | null;
  }>>([]);

  // Order detail dialog
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);
  const [detailNumbers, setDetailNumbers] = useState<number[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refunding, setRefunding] = useState(false);


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

  // Filtros de pedidos (Admin)
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "pending" | "paid" | "expired" | "cancelled" | "refunded">("all");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderNumberSearch, setOrderNumberSearch] = useState("");
  const [ordersNumbersMap, setOrdersNumbersMap] = useState<Record<string, number[]>>({});

  // Preço de custo (sincronizado via localStorage com EntradaPanel/DashboardConsolidado)
  const COST_STORAGE_KEY = "dashboard_costs_v1";
  const DEFAULT_COST_RIFA_PREMIO = 500;
  const [costRifaPremio, setCostRifaPremio] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.rifaPremio) || DEFAULT_COST_RIFA_PREMIO; } catch { return DEFAULT_COST_RIFA_PREMIO; }
  });
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}");
      localStorage.setItem(COST_STORAGE_KEY, JSON.stringify({ ...s, rifaPremio: costRifaPremio }));
    } catch {
      localStorage.setItem(COST_STORAGE_KEY, JSON.stringify({ rifaPremio: costRifaPremio }));
    }
  }, [costRifaPremio]);
  const rifaPrizeCostCents = Math.round(costRifaPremio * 100);


  useEffect(() => {
    document.title = "Painel Admin";
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

  const filteredOrders = useMemo(() => {
    const fromTs = orderDateFrom ? new Date(orderDateFrom + "T00:00:00").getTime() : null;
    const toTs = orderDateTo ? new Date(orderDateTo + "T23:59:59").getTime() : null;
    const q = orderNumberSearch.replace(/\D/g, "");
    const qNum = q ? parseInt(q, 10) : null;
    return orders.filter((o) => {
      if (orderStatusFilter !== "all" && o.status !== orderStatusFilter) return false;
      const ts = new Date(o.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      if (q) {
        const nums = ordersNumbersMap[o.id] ?? [];
        const hit = nums.some((n) => {
          if (qNum !== null && n === qNum) return true;
          const padded = n.toString().padStart(3, "0");
          return padded.includes(q) || n.toString().includes(q);
        });
        if (!hit) return false;
      }
      return true;
    });
  }, [orders, orderStatusFilter, orderDateFrom, orderDateTo, orderNumberSearch, ordersNumbersMap]);

  // KPIs da Rifa (aba "Rifa") — líquido considera taxa MP por método (PIX 0,99% · Cartão 4,99%)
  const rifaKpis = useMemo(() => {
    const paid = orders.filter((o) => isPaid(o.status));
    const pending = orders.filter((o) => isPending(o.status));
    const canceled = orders.filter((o) => isCancelledLike(o.status));
    const paidAgg = netFromOrders(paid);
    const revPaid = paidAgg.gross;
    const revPaidNet = paidAgg.net;
    const revPaidFee = paidAgg.fee;
    const revPending = pending.reduce((a, o) => a + o.total_cents, 0);
    const ticket = paid.length > 0 ? Math.round(revPaid / paid.length) : 0;
    const totalCreated = orders.length;
    const conv = totalCreated > 0 ? (paid.length / totalCreated) * 100 : 0;
    return { revPaid, revPaidNet, revPaidFee, revPending, paidCount: paid.length, pendingCount: pending.length, canceledCount: canceled.length, ticket, conv };
  }, [orders]);


  // KPIs do Pagamentos — deduplica pagamentos por order_id (D5) e usa o
  // método do pedido vinculado para calcular a taxa correta.
  const paymentKpis = useMemo(() => {
    const orderById = new Map(orders.map((o) => [o.id, o] as const));
    const k = computePaymentKpis(
      payments.map((p) => ({
        order_id: p.order_id,
        amount_cents: p.amount_cents,
        status: p.status,
        created_at: p.created_at,
      })),
      new Map([...orderById].map(([id, o]) => [id, { payment_method: o.payment_method ?? null }])),
    );
    return {
      revPaid: k.revPaidGross,
      revPaidNet: k.revPaidNet,
      revPaidFee: k.revPaidFee,
      revPending: k.revPendingGross,
      approvedCount: k.approvedCount,
      pendingCount: k.pendingCount,
    };
  }, [payments, orders]);

  const exportOrdersCsv = () => {
    if (filteredOrders.length === 0) {
      toast.info("Sem pedidos para exportar nesse filtro");
      return;
    }
    const csv = buildCsv(
      [
        "ID Pedido",
        "Status",
        "Comprador",
        "Telefone",
        "Total (R$)",
        "Criado em",
        "Expira em",
      ],
      filteredOrders.map((o) => [
        o.id,
        o.status,
        buyers[o.buyer_id]?.name ?? "—",
        buyers[o.buyer_id]?.phone ?? "—",
        (o.total_cents / 100).toFixed(2).replace(".", ","),
        fmtDate(o.created_at),
        fmtDate(o.expires_at),
      ]),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`pedidos-admin-${stamp}.csv`, csv);
    toast.success(`${filteredOrders.length} pedidos exportados`);
  };

  const exportRaffleCsv = async () => {
    const t = toast.loading("Gerando lista do sorteio...");
    try {
      // 1. Paid numbers ordered ascending
      const { data: nums, error: nErr } = await supabase
        .from("numbers")
        .select("number, order_id")
        .eq("status", "paid")
        .order("number", { ascending: true });
      if (nErr) throw nErr;
      const list = (nums ?? []) as { number: number; order_id: string | null }[];
      if (list.length === 0) {
        toast.dismiss(t);
        toast.info("Nenhum número pago para exportar");
        return;
      }

      // 2. Fetch related orders (with buyer + seller ids)
      const orderIds = Array.from(
        new Set(list.map((n) => n.order_id).filter(Boolean) as string[]),
      );
      const { data: ords, error: oErr } = await supabase
        .from("orders")
        .select("id, buyer_id, seller_id")
        .in("id", orderIds);
      if (oErr) throw oErr;
      const orderMap = new Map(
        (ords ?? []).map((o) => [
          o.id as string,
          { buyer_id: o.buyer_id as string, seller_id: o.seller_id as string | null },
        ]),
      );

      // 3. Buyers map
      const buyerIds = Array.from(
        new Set(Array.from(orderMap.values()).map((o) => o.buyer_id)),
      );
      const { data: bs, error: bErr } = await supabase
        .from("buyers")
        .select("id, name, phone")
        .in("id", buyerIds);
      if (bErr) throw bErr;
      const buyerMap = new Map(
        (bs ?? []).map((b) => [b.id as string, b as BuyerRow]),
      );

      // 4. Sellers map (use state, already loaded for all sellers)
      const sellerMap = new Map(sellers.map((s) => [s.id, s]));

      const rows = list.map((n) => {
        const ord = n.order_id ? orderMap.get(n.order_id) : undefined;
        const buyer = ord ? buyerMap.get(ord.buyer_id) : undefined;
        const seller = ord?.seller_id ? sellerMap.get(ord.seller_id) : undefined;
        return [
          n.number.toString().padStart(3, "0"),
          buyer?.name ?? "—",
          buyer?.phone ?? "—",
          seller?.ref_code ? seller.ref_code.toUpperCase() : "Sem código de indicação",
        ];
      });

      const csv = buildCsv(
        ["Número", "Comprador", "Telefone", "Indicado por"],
        rows,
      );
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`sorteio-${stamp}.csv`, csv);
      toast.dismiss(t);
      toast.success(`${rows.length} números exportados para sorteio`);
    } catch (err) {
      toast.dismiss(t);
      console.error("[exportRaffleCsv]", err);
      const anyErr = err as { message?: string; details?: string; hint?: string; code?: string };
      const msg =
        (err instanceof Error && err.message) ||
        anyErr?.message ||
        anyErr?.details ||
        anyErr?.hint ||
        (typeof err === "string" ? err : JSON.stringify(err));
      toast.error("Falha ao exportar: " + msg);
    }
  };


  const loadAll = async () => {
    const [s, o, p, b, sl, st] = await Promise.all([
      supabase.rpc("admin_dashboard_stats"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase
        .from("payments")
        .select("id, order_id, status, amount_cents, provider_payment_id, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(5000),
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
          "raffle_sales_closed",
        ]),

    ]);
    if (s.data && Array.isArray(s.data) && s.data[0]) setStats(s.data[0] as Stats);
    if (o.data) {
      const rows = o.data as unknown as OrderRow[];
      setOrders(rows);
      // Load numbers per order to enable number search
      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        const { data: onData } = await supabase
          .from("order_numbers")
          .select("order_id, number")
          .in("order_id", ids);
        const map: Record<string, number[]> = {};
        for (const row of onData ?? []) {
          const oid = (row as { order_id: string }).order_id;
          const num = (row as { number: number }).number;
          (map[oid] ??= []).push(num);
        }
        setOrdersNumbersMap(map);
      } else {
        setOrdersNumbersMap({});
      }
    }
    if (p.data) setPayments(p.data as PaymentRow[]);
    if (b.data) {
      const map: Record<string, BuyerRow> = {};
      for (const row of b.data) map[row.id] = row as BuyerRow;
      setBuyers(map);
    }

    // Ranking de vendedores (somente admin)
    try {
      const r = await supabase.rpc("get_seller_ranking");
      if (r.data) setSellerRanking(r.data as typeof sellerRanking);
    } catch {}

    // Pagamentos da camiseta
    try {
      const sp = await supabase
        .from("entrada_orders")
        .select("id, created_at, buyer_name, total_cents, status, mp_payment_id, payment_method")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (sp.data) setShirtPayments(sp.data as typeof shirtPayments);
    } catch {}
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
      if (row.key === "raffle_sales_closed") {
        setSalesClosed(row.value === true);
      }
    }
  };

  const toggleSalesClosed = async (next: boolean) => {
    if (next) {
      // Verifica quantas pessoas estão com compra em andamento (reserva ativa)
      const { count, error: cErr } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString());
      if (cErr) {
        toast.error("Falha ao verificar compras em andamento: " + cErr.message);
        return;
      }
      const pend = count ?? 0;
      const msg = pend > 0
        ? `Existem ${pend} compra(s) em andamento agora (reservas ativas).\n\nAo desativar, novos compradores verão o aviso de encerramento imediatamente. As reservas em andamento continuam válidas até expirarem ou serem pagas.\n\nDeseja realmente desativar as vendas?`
        : "Nenhuma compra em andamento no momento.\n\nDeseja realmente desativar as vendas?";
      if (!window.confirm(msg)) return;
    }
    setSavingSalesClosed(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert([{ key: "raffle_sales_closed", value: next as unknown as never }], { onConflict: "key" });
    setSavingSalesClosed(false);
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      return;
    }
    setSalesClosed(next);
    toast.success(next ? "Vendas da rifa desativadas" : "Vendas da rifa reativadas");
  };



  // Realtime: revalida stats e listas quando orders/payments mudarem
  useEffect(() => {
    let statsTimer: number | undefined;
    const debouncedReload = () => {
      if (statsTimer) window.clearTimeout(statsTimer);
      statsTimer = window.setTimeout(() => {
        supabase.rpc("admin_dashboard_stats").then(({ data }) => {
          if (data && Array.isArray(data) && data[0]) setStats(data[0] as Stats);
        });
      }, 400);
    };

    const channel = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const row = (payload.new ?? payload.old) as OrderRow;
        if (!row?.id) return;
        setOrders((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((o) => o.id !== row.id);
          const next = (payload.new as OrderRow);
          const idx = prev.findIndex((o) => o.id === next.id);
          // Toast quando o status muda (pendente → pago/expirado/cancelado)
          if (idx !== -1 && payload.eventType === "UPDATE") {
            const prevStatus = prev[idx].status;
            if (prevStatus !== next.status) {
              const shortId = next.id.slice(0, 8);
              if (next.status === "paid") {
                toast.success(`💰 Pedido ${shortId} foi PAGO (${fmtBRL(next.total_cents)})`);
              } else if (next.status === "expired") {
                toast.warning(`⏱️ Pedido ${shortId} expirou`);
              } else if (next.status === "cancelled") {
                toast.warning(`Pedido ${shortId} foi cancelado`);
              }
            }
          } else if (payload.eventType === "INSERT") {
            toast.info(`🆕 Novo pedido ${next.id.slice(0, 8)}`);
          }
          if (idx === -1) return [next, ...prev].slice(0, 100);
          const copy = [...prev]; copy[idx] = next; return copy;
        });
        debouncedReload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, (payload) => {
        const row = (payload.new ?? payload.old) as PaymentRow;
        if (!row?.id) return;
        setPayments((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== row.id);
          const next = payload.new as PaymentRow;
          const idx = prev.findIndex((p) => p.id === next.id);
          if (idx === -1) return [next, ...prev].slice(0, 100);
          const copy = [...prev]; copy[idx] = next; return copy;
        });
        debouncedReload();
      })
      .subscribe((status) => setRealtimeOk(status === "SUBSCRIBED"));

    return () => {
      if (statsTimer) window.clearTimeout(statsTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const revalidatePayment = async (paymentId: string, orderId: string) => {
    setRevalidatingId(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke("revalidate-payment", {
        body: { payment_id: paymentId, order_id: orderId },
      });
      if (error) throw error;
      const r = data as { new_status?: string; mp_status?: string; confirmed?: boolean };
      toast.success(`Status: ${r?.new_status ?? "?"}${r?.confirmed ? " (confirmado)" : ""}`);
    } catch (e: unknown) {
      console.log("[Admin] revalidate error", e);
      toast.error("Falha ao revalidar pagamento");
    } finally {
      setRevalidatingId(null);
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

  const openOrderDetail = async (o: OrderRow) => {
    setDetailOrder(o);
    setDetailNumbers([]);
    setDetailLoading(true);
    const { data, error } = await supabase
      .from("order_numbers")
      .select("number")
      .eq("order_id", o.id)
      .order("number", { ascending: true });
    setDetailLoading(false);
    if (error) {
      toast.error("Erro ao carregar números: " + error.message);
      return;
    }
    setDetailNumbers((data ?? []).map((r) => r.number as number));
  };

  const toggleNotified = async (orderId: string, currentlyNotified: boolean) => {
    const nextValue = currentlyNotified ? null : new Date().toISOString();
    const { error } = await supabase
      .from("orders")
      .update({ notified_at: nextValue })
      .eq("id", orderId);
    if (error) {
      toast.error("Falha ao atualizar: " + error.message);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, notified_at: nextValue } : o)));
    setDetailOrder((prev) => (prev && prev.id === orderId ? { ...prev, notified_at: nextValue } : prev));
    toast.success(currentlyNotified ? "Marcado como não avisado" : "Marcado como avisado ✅");
  };


  const refundOrder = async () => {
    if (!detailOrder) return;
    if (
      !confirm(
        "Marcar este pedido como ESTORNADO?\n\nEsta é uma ação apenas de controle interno — nenhum estorno automático será feito no Mercado Pago. O reembolso do valor deve ser realizado manualmente por você.\n\nOs números do pedido serão liberados de volta para 'disponíveis'.",
      )
    ) {
      return;
    }
    setRefunding(true);
    const { data, error } = await supabase.rpc("admin_refund_order", {
      _order_id: detailOrder.id,
    });
    setRefunding(false);
    if (error) {
      toast.error("Erro ao estornar pedido: " + error.message);
      return;
    }
    const freed = Array.isArray(data) && data[0] ? (data[0] as { freed_numbers: number }).freed_numbers : 0;
    toast.success(`Pedido estornado. ${freed} número(s) liberado(s). Lembre de reembolsar manualmente.`);
    setDetailOrder(null);
    setDetailNumbers([]);
    loadAll();
  };

  const assignSellerToOrder = async () => {
    if (!detailOrder) return;
    const current = detailOrder.referral_label ?? "";
    const code = window.prompt(
      `Atribuir/alterar código de indicação do pedido ${detailOrder.id.slice(0, 8)}.\n\nDigite o código do revendedor (ex: IDB001) ou deixe em branco para remover o vínculo.`,
      current,
    );
    if (code === null) return;
    const { error } = await supabase.rpc("admin_set_order_seller" as never, {
      _order_id: detailOrder.id,
      _ref_code: code.trim(),
    } as never);
    if (error) {
      toast.error(
        error.message.includes("seller_not_found")
          ? "Código não encontrado."
          : "Erro: " + error.message,
      );
      return;
    }
    toast.success(code.trim() ? "Código de indicação atualizado." : "Vínculo removido.");
    setDetailOrder(null);
    setDetailNumbers([]);
    loadAll();
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

  const [hidePrivacy, setHidePrivacy] = useHidePrivacy();

  return (
    <main className={`min-h-screen bg-background dashboard-privacy ${hidePrivacy ? "is-hidden" : ""}`}>
      <header className="border-b border-border bg-card">
        <div className="container flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
          <div>
            <h1 className="text-lg font-bold sm:text-xl">Painel Admin</h1>
            <p className="text-xs text-muted-foreground">Gerencie sua rifa</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={hidePrivacy ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHidePrivacy((v) => !v)}
                    aria-label={hidePrivacy ? "Mostrar valores" : "Ocultar valores"}
                    aria-pressed={hidePrivacy}
                  >
                    {hidePrivacy ? <EyeOff className="h-4 w-4 sm:mr-2" /> : <Eye className="h-4 w-4 sm:mr-2" />}
                    <span className="hidden sm:inline">{hidePrivacy ? "Mostrar" : "Ocultar"}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {hidePrivacy ? "Clique para revelar os valores" : "Clique para ocultar valores (modo apresentação)"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" size="sm" asChild>
              <Link to="/revendedor">
                <Users className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Revendedor</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/alertas">
                <Bell className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Alertas</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/ranking">
                <Trophy className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Ranking</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/rifa">Ver rifa</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>


      <section className="container py-4 sm:py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="-mx-2 overflow-x-auto px-2 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-max min-w-full sm:w-auto sm:min-w-0">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="orders">Rifa</TabsTrigger>
              <TabsTrigger value="entrada">Camiseta</TabsTrigger>
              <TabsTrigger value="expenses">Gastos</TabsTrigger>
              <TabsTrigger value="sponsors">Patrocínios</TabsTrigger>
              <TabsTrigger value="offerings">Ofertas</TabsTrigger>
              <TabsTrigger value="sellers">Vendedores</TabsTrigger>
              <TabsTrigger value="payments">Pagamentos</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
              <TabsTrigger value="hero">Hero</TabsTrigger>
              <TabsTrigger value="vsl">VSL</TabsTrigger>
              <TabsTrigger value="recap">Novidades</TabsTrigger>
              <TabsTrigger value="about">Sobre</TabsTrigger>
              <TabsTrigger value="admins">Admins</TabsTrigger>
              <TabsTrigger value="health">Saúde Técnica</TabsTrigger>

            </TabsList>
          </div>


          {/* GASTOS */}
          <TabsContent value="expenses" className="mt-6">
            <ExpensesPanel />
          </TabsContent>

          {/* PATROCÍNIOS */}
          <TabsContent value="sponsors" className="mt-6">
            <SponsorshipsPanel />
          </TabsContent>

          {/* OFERTAS */}
          <TabsContent value="offerings" className="mt-6">
            <OfferingsPanel />
          </TabsContent>

          {/* ENTRADA — transações, estoque e preços do /entrada */}
          <TabsContent value="entrada" className="mt-6">
            <EntradaPanel />
          </TabsContent>

          {/* VSL — vídeo da Home */}
          <TabsContent value="vsl" className="mt-6">
            <VSLPanel />
          </TabsContent>

          {/* NOVIDADES & AVISOS (Recap Gallery) */}
          <TabsContent value="recap" className="mt-6">
            <RecapPanel />
          </TabsContent>

          {/* SOBRE O EVENTO — texto, foto e legenda */}
          <TabsContent value="about" className="mt-6">
            <AboutPanel />
          </TabsContent>



          {/* ADMINS */}
          <TabsContent value="admins" className="mt-6">
            <AdminsPanel />
          </TabsContent>

          {/* SAÚDE DO SISTEMA — health check das métricas + auditoria financeira */}
          <TabsContent value="health" className="mt-6 space-y-6">
            <FinancialAudit />
            <SystemHealthPanel />
          </TabsContent>

          {/* DASHBOARD — consolidado (rifa + entrada) com filtro por período */}
          <TabsContent value="dashboard" className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-xs">
              <Radio className={`h-3 w-3 ${realtimeOk ? "text-green-500 animate-pulse" : "text-muted-foreground"}`} />
              <span className="text-muted-foreground">
                {realtimeOk ? "Atualizando em tempo real" : "Conectando ao tempo real..."}
              </span>
            </div>
            <DashboardConsolidado onNavigate={setTab} rifaStatus={stats ? {
              pending_orders: stats.pending_orders,
              numbers_available: stats.numbers_available,
              numbers_paid: stats.numbers_paid,
              numbers_reserved: stats.numbers_reserved,
              sellers_count: stats.sellers_count,
            } : undefined} />
          </TabsContent>

          {/* PAYMENTS */}
          <TabsContent value="payments" className="mt-6 space-y-4">
            <Card className="p-4 bg-muted/30">
              <p className="text-sm font-semibold mb-1">Para que serve esta aba?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Aqui você acompanha <strong>todos os pagamentos PIX gerados via Mercado Pago</strong> — tanto da Rifa quanto da Camiseta.
                Use para conferir status (aprovado, pendente, expirado), copiar o ID do pagamento (MP ID) para conciliação
                no painel do Mercado Pago, e <strong>revalidar manualmente</strong> um pagamento que ficou pendente
                (caso o webhook não tenha chegado).
              </p>
            </Card>

            {/* Resumo financeiro consolidado */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <StatCard label="Recebido (bruto)" value={fmtBRL(paymentKpis.revPaid)} />
              <StatCard label="Líquido (taxa MP)" value={fmtBRL(paymentKpis.revPaidNet)} />
              <StatCard label="Pendente" value={fmtBRL(paymentKpis.revPending)} />
              <StatCard label="Aprovados" value={String(paymentKpis.approvedCount)} />
            </div>
            <p className="text-[11px] text-muted-foreground -mt-2">
              Taxa Mercado Pago aplicada por pedido: PIX 0,99% · Cartão 4,99%. Líquido = bruto − {fmtBRL(paymentKpis.revPaidFee)} de taxas.
            </p>

            <Tabs defaultValue="rifa">
              <TabsList>
                <TabsTrigger value="rifa">Rifa</TabsTrigger>
                <TabsTrigger value="camiseta">Camiseta</TabsTrigger>
              </TabsList>

              <TabsContent value="rifa" className="mt-4">
                <Card className="overflow-x-auto">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold">Pagamentos da Rifa</p>
                    <span className="text-xs text-muted-foreground">{payments.length} registros</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Pedido</th>
                        <th className="px-4 py-3">MP ID</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-4 py-3 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{p.order_id.slice(0, 8)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{p.provider_payment_id ?? "—"}</td>
                          <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                          <td className="px-4 py-3 text-right font-medium">{fmtBRL(p.amount_cents)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!p.provider_payment_id || revalidatingId === p.id}
                              onClick={() => revalidatePayment(p.id, p.order_id)}
                              title="Revalidar com Mercado Pago"
                            >
                              <RotateCw className={`h-4 w-4 ${revalidatingId === p.id ? "animate-spin" : ""}`} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                            Nenhum pagamento registrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </TabsContent>

              <TabsContent value="camiseta" className="mt-4">
                <Card className="overflow-x-auto">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold">Pagamentos da Camiseta / Entrada</p>
                    <span className="text-xs text-muted-foreground">{shirtPayments.length} registros</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Pedido</th>
                        <th className="px-4 py-3">Comprador</th>
                        <th className="px-4 py-3">MP ID</th>
                        <th className="px-4 py-3">Método</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shirtPayments.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-4 py-3 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{p.id.slice(0, 8)}</td>
                          <td className="px-4 py-3">{p.buyer_name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{p.mp_payment_id ?? "—"}</td>
                          <td className="px-4 py-3 text-xs uppercase">{p.payment_method ?? "—"}</td>
                          <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                          <td className="px-4 py-3 text-right font-medium">{fmtBRL(p.total_cents)}</td>
                        </tr>
                      ))}
                      {shirtPayments.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            Nenhum pagamento de camiseta registrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>


          {/* ORDERS */}
          <TabsContent value="orders" className="mt-6 space-y-4">
            {/* Status das vendas da rifa */}
            <Card className={`p-4 border-2 ${salesClosed ? "border-red-500/60 bg-red-500/10" : "border-emerald-500/40 bg-emerald-500/5"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide">
                    Status das vendas
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {salesClosed
                      ? "As vendas da rifa estão DESATIVADAS. Compradores veem um aviso e não conseguem finalizar novas compras. Pedidos já pagos e números disponíveis não são alterados."
                      : "As vendas da rifa estão ATIVAS. Compradores podem escolher números e finalizar pagamentos normalmente."}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={savingSalesClosed}
                  onClick={() => toggleSalesClosed(!salesClosed)}
                  variant={salesClosed ? "default" : "destructive"}
                  className="w-full sm:w-auto"
                >
                  {salesClosed ? "Reativar vendas" : "Desativar vendas"}
                </Button>
              </div>
            </Card>


            {/* Configuração do Preço de Custo do prêmio (alimenta Lucro Líquido) */}
            <Card className="p-4 border-primary/30 bg-primary/5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                    Preço de Custo do Prêmio
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Alimenta o cálculo do <strong>Lucro Líquido</strong> = Receita paga − (Preço de custo + Taxa MP).
                  </p>
                </div>
                <div className="flex items-end gap-2 w-full sm:w-auto">
                  <div className="space-y-1 flex-1 sm:w-48">
                    <Label className="text-xs" htmlFor="costRifaPremio">Prêmio (R$)</Label>
                    <Input id="costRifaPremio" type="number" step="0.01" min="0" value={costRifaPremio}
                      onChange={(e) => setCostRifaPremio(Number(e.target.value) || 0)} />
                  </div>
                  <Button variant="outline" size="sm" onClick={loadAll} title="Atualizar dados">
                    <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
                  </Button>
                </div>
              </div>
            </Card>

            {/* KPIs individuais da Rifa */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Resumo da Rifa
              </h2>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Receita paga"
                  value={fmtBRL(rifaKpis.revPaid)}
                  tone="positive"
                  hint="Soma do valor bruto (total_cents) de todos os pedidos com status 'paid'. É a receita bruta antes de descontar custos e taxas."
                />
                <StatCard
                  label="Preço de custo (prêmio)"
                  value={fmtBRL(rifaPrizeCostCents)}
                  tone="negative"
                  hint="Valor configurável no campo 'Preço de Custo do Prêmio' acima. Representa quanto sai do caixa para pagar o vencedor da rifa."
                />
                <StatCard
                  label="Taxa de Mercado Pago"
                  value={fmtBRL(rifaKpis.revPaidFee)}
                  tone="negative"
                  hint="Taxa cobrada pelo Mercado Pago por pedido pago: PIX 0,99% · Cartão 4,99%. Calculada individualmente por pedido conforme o método de pagamento."
                />
                <StatCard
                  label="Lucro líquido"
                  value={fmtBRL(rifaKpis.revPaid - (rifaPrizeCostCents + rifaKpis.revPaidFee))}
                  tone={rifaKpis.revPaid - (rifaPrizeCostCents + rifaKpis.revPaidFee) >= 0 ? "positive" : "negative"}
                  hint={`Fórmula: Receita paga − (Preço de custo + Taxa MP). Cálculo atual: ${fmtBRL(rifaKpis.revPaid)} − (${fmtBRL(rifaPrizeCostCents)} + ${fmtBRL(rifaKpis.revPaidFee)}) = ${fmtBRL(rifaKpis.revPaid - (rifaPrizeCostCents + rifaKpis.revPaidFee))}.`}
                />
                <StatCard
                  label="Números vendidos"
                  value={String(stats?.numbers_paid ?? 0)}
                  hint="Quantidade de números da rifa com status 'paid' na tabela numbers (contagem direta no banco)."
                />
                <StatCard
                  label="Vendas pendentes"
                  value={String(rifaKpis.pendingCount)}
                  hint="Pedidos com status 'pending' — aguardando confirmação de pagamento. Ainda podem virar 'paid' ou 'expired'."
                />
                <StatCard
                  label="Vendas canceladas"
                  value={String(rifaKpis.canceledCount)}
                  hint="Soma dos pedidos com status 'cancelled', 'expired', 'refunded' ou 'rejected'. Não geram receita nem consomem números."
                />
              </div>

              <p className="text-[11px] text-muted-foreground mt-2">
                Lucro líquido = Receita paga − (Preço de custo {fmtBRL(rifaPrizeCostCents)} + Taxa Mercado Pago). Taxa aplicada por pedido: PIX 0,99% · Cartão 4,99%.
              </p>
            </div>




            <Card className="space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs" htmlFor="adNumSearch">Buscar por número</Label>
                  <Input
                    id="adNumSearch"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 07, 123"
                    value={orderNumberSearch}
                    onChange={(e) => setOrderNumberSearch(e.target.value)}
                    className="w-full lg:w-56"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={orderStatusFilter}
                    onValueChange={(v) => setOrderStatusFilter(v as typeof orderStatusFilter)}
                  >
                    <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                      <SelectItem value="refunded">Reembolsado</SelectItem>

                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="adFrom">De</Label>
                  <Input id="adFrom" type="date" value={orderDateFrom} onChange={(e) => setOrderDateFrom(e.target.value)} className="w-full lg:w-44" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="adTo">Até</Label>
                  <Input id="adTo" type="date" value={orderDateTo} onChange={(e) => setOrderDateTo(e.target.value)} className="w-full lg:w-44" />
                </div>
                <Button variant="outline" size="sm" onClick={() => { setOrderStatusFilter("all"); setOrderDateFrom(""); setOrderDateTo(""); setOrderNumberSearch(""); }} className="w-full sm:w-auto">
                  Limpar
                </Button>
                <Button size="sm" onClick={exportOrdersCsv} className="w-full sm:w-auto lg:ml-auto">
                  <Download className="mr-2 h-4 w-4" /> Exportar pedidos ({filteredOrders.length})
                </Button>
                <Button size="sm" variant="secondary" onClick={exportRaffleCsv} className="w-full sm:w-auto">
                  <Trophy className="mr-2 h-4 w-4" /> Exportar sorteio (números pagos)
                </Button>

              </div>
            </Card>

            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Comprador</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Indicação</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Avisado</th>
                    <th className="px-4 py-3 text-right">Total (bruto)</th>
                    <th className="px-4 py-3 text-right">Líquido recebido</th>

                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => {
                    const buyer = buyers[o.buyer_id];
                    const seller = o.seller_id
                      ? sellers.find((s) => s.id === o.seller_id)
                      : null;
                    return (
                      <tr
                        key={o.id}
                        className="border-t border-border cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => openOrderDetail(o)}
                      >
                        <td className="px-4 py-3">{fmtDate(o.created_at)}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {o.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3">{buyer?.name ?? "—"}</td>
                        <td className="px-4 py-3">{buyer?.phone ? <WhatsAppLink phone={buyer.phone} /> : "—"}</td>
                        <td className="px-4 py-3">
                          {seller ? (
                            <span className="inline-flex flex-col">
                              <span className="font-medium">{seller.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {seller.ref_code}
                              </span>
                            </span>
                          ) : o.referral_label ? (
                            <span className="inline-flex flex-col">
                              <span className="font-medium text-amber-600 dark:text-amber-400">{o.referral_label}</span>
                              <span className="text-[10px] text-muted-foreground">informado, não vinculado</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-emerald-500"
                            checked={!!o.notified_at}
                            onChange={() => toggleNotified(o.id, !!o.notified_at)}
                            title={o.notified_at ? `Avisado em ${fmtDate(o.notified_at)}` : "Marcar como avisado"}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {fmtBRL(o.total_cents)}
                        </td>

                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {isPaid(o.status) ? (
                            <NetValueCell grossCents={o.total_cents} method={o.payment_method} />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );

                  })}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum pedido nesse filtro.
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </Card>

            {/* Order detail dialog */}
            <Dialog
              open={!!detailOrder}
              onOpenChange={(open) => {
                if (!open) {
                  setDetailOrder(null);
                  setDetailNumbers([]);
                }
              }}
            >
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Detalhes do pedido</DialogTitle>
                </DialogHeader>
                {detailOrder && (() => {
                  const buyer = buyers[detailOrder.buyer_id];
                  const seller = detailOrder.seller_id
                    ? sellers.find((s) => s.id === detailOrder.seller_id)
                    : null;
                  const canRefund = ["paid", "pending"].includes(detailOrder.status);
                  return (
                    <div className="space-y-4 text-sm">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Pedido</p>
                          <p className="font-mono text-xs">{detailOrder.id}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Status</p>
                          <StatusBadge status={detailOrder.status} />
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Comprador</p>
                          <p className="font-medium">{buyer?.name ?? "—"}</p>
                          <div className="text-xs text-muted-foreground">{buyer?.phone ? <WhatsAppLink phone={buyer.phone} /> : "—"}</div>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Total (bruto)</p>
                          <p className="font-semibold">{fmtBRL(detailOrder.total_cents)}</p>
                          {isPaid(detailOrder.status) && (
                            <div className="mt-1 text-xs">
                              <span className="text-muted-foreground">Líquido: </span>
                              <NetValueCell grossCents={detailOrder.total_cents} method={detailOrder.payment_method} compact />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Data</p>
                          <p>{fmtDate(detailOrder.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Expira em</p>
                          <p>{fmtDate(detailOrder.expires_at)}</p>
                        </div>
                      </div>

                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs uppercase text-muted-foreground">Indicação</p>
                        {seller ? (
                          <div className="mt-1">
                            <p className="font-medium">{seller.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              Código: {seller.ref_code}
                            </p>
                            {seller.phone && (
                              <div className="text-xs text-muted-foreground inline-flex items-center gap-1">Tel: <WhatsAppLink phone={seller.phone} /></div>
                            )}
                            {detailOrder.referral_label && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Informado pelo comprador: <span className="font-medium text-foreground">{detailOrder.referral_label}</span>
                              </p>
                            )}
                          </div>
                        ) : detailOrder.referral_label ? (
                          <div className="mt-1">
                            <p className="font-medium text-amber-600 dark:text-amber-400">{detailOrder.referral_label}</p>
                            <p className="text-xs text-muted-foreground">
                              Nome/código informado pelo comprador — não vinculado a um revendedor cadastrado.
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-muted-foreground">Sem indicação</p>
                        )}
                      </div>

                      <div>
                        <p className="mb-2 text-xs uppercase text-muted-foreground">
                          Números comprados ({detailNumbers.length})
                        </p>
                        {detailLoading ? (
                          <p className="text-xs text-muted-foreground">Carregando...</p>
                        ) : detailNumbers.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum número.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                            {detailNumbers.map((n) => (
                              <span
                                key={n}
                                className="inline-flex h-8 min-w-[2.5rem] items-center justify-center rounded-md bg-primary px-2 font-mono text-xs font-semibold text-primary-foreground"
                              >
                                {n.toString().padStart(3, "0")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailOrder(null);
                      setDetailNumbers([]);
                    }}
                  >
                    Fechar
                  </Button>
                  {detailOrder && (() => {
                    const buyer = buyers[detailOrder.buyer_id];
                    const phone = buyer?.phone ? buyer.phone.replace(/\D/g, "") : "";
                    const phoneE164 = phone ? (phone.startsWith("55") ? phone : `55${phone}`) : "";
                    const disabled = !phoneE164 || detailNumbers.length === 0;
                    const sendMsg = () => {
                      const nums = [...detailNumbers].sort((a, b) => a - b).map((n) => n.toString().padStart(3, "0")).join(", ");
                      const nome = (buyer?.name ?? "").split(" ")[0] || "";
                      const msg =
                        `Olá${nome ? ` ${nome}` : ""}! 🎉\n\n` +
                        `Passando para confirmar que está tudo certo com a sua compra na Rifa da IDB Jovem Minas. Deus abençoe sua participação!\n\n` +
                        `🎟️ Seus números (${detailNumbers.length}): ${nums}\n\n` +
                        `📺 Acompanhe o sorteio ao vivo pelo nosso Instagram e YouTube:\n` +
                        `Instagram: https://www.instagram.com/idbjovemminas\n` +
                        `YouTube: https://www.youtube.com/idbjovemminas\n\n` +
                        `Qualquer dúvida, estamos à disposição. Obrigado! 🙌`;
                      window.open(`https://wa.me/${phoneE164}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
                      if (!detailOrder.notified_at) toggleNotified(detailOrder.id, false);
                    };
                    return (
                      <>
                        <Button
                          variant={detailOrder.notified_at ? "secondary" : "outline"}
                          onClick={() => toggleNotified(detailOrder.id, !!detailOrder.notified_at)}
                          title={detailOrder.notified_at ? `Avisado em ${fmtDate(detailOrder.notified_at)}` : "Marcar como avisado"}
                        >
                          {detailOrder.notified_at ? "✅ Avisado" : "Marcar como avisado"}
                        </Button>
                        <Button variant="default" onClick={sendMsg} disabled={disabled} title={disabled ? "Telefone ou números indisponíveis" : "Abrir WhatsApp"}>
                          Enviar confirmação (WhatsApp)
                        </Button>
                      </>
                    );
                  })()}

                  {detailOrder && (
                    <Button variant="secondary" onClick={assignSellerToOrder}>
                      {detailOrder.seller_id || detailOrder.referral_label
                        ? "Alterar código de indicação"
                        : "Adicionar código de indicação"}
                    </Button>
                  )}
                  {detailOrder &&
                    ["paid", "pending"].includes(detailOrder.status) && (
                      <Button
                        variant="destructive"
                        onClick={refundOrder}
                        disabled={refunding}
                      >
                        {refunding ? "Estornando..." : "Marcar como estornado"}
                      </Button>
                    )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>


          {/* SELLERS */}
          <TabsContent value="sellers" className="mt-6 space-y-6">
            {/* KPIs individuais de Vendedores */}
            {(() => {
              const totalRev = sellerRanking.reduce((a, r) => a + (r.total_cents || 0), 0);
              const totalNums = sellerRanking.reduce((a, r) => a + (r.total_numbers || 0), 0);
              const active = sellerRanking.filter((r) => (r.total_orders || 0) > 0).length;
              const top = sellerRanking.slice(0, 5);
              return (
                <>
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                      Resumo de Vendedores
                    </h2>
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                      <StatCard label="Total cadastrados" value={String(sellers.length)} />
                      <StatCard label="Com vendas" value={String(active)} />
                      <StatCard label="Receita por indicação" value={fmtBRL(totalRev)} />
                      <StatCard label="Números vendidos (indicados)" value={String(totalNums)} />
                    </div>
                  </div>

                  {top.length > 0 && (
                    <Card className="overflow-x-auto">
                      <div className="border-b border-border px-4 py-3">
                        <p className="text-sm font-semibold">🏆 Top 5 vendedores</p>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left">
                          <tr>
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Vendedor</th>
                            <th className="px-4 py-3">Código</th>
                            <th className="px-4 py-3 text-right">Pedidos</th>
                            <th className="px-4 py-3 text-right">Números</th>
                            <th className="px-4 py-3 text-right">Receita</th>
                          </tr>
                        </thead>
                        <tbody>
                          {top.map((r, i) => (
                            <tr key={r.seller_id} className="border-t border-border">
                              <td className="px-4 py-3 font-semibold">{i + 1}º</td>
                              <td className="px-4 py-3">{r.seller_name}</td>
                              <td className="px-4 py-3 font-mono text-xs">{r.ref_code}</td>
                              <td className="px-4 py-3 text-right">{r.total_orders}</td>
                              <td className="px-4 py-3 text-right">{r.total_numbers}</td>
                              <td className="px-4 py-3 text-right font-medium">{fmtBRL(r.total_cents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  )}
                </>
              );
            })()}


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
                      <td className="px-4 py-3">{s.phone ? <WhatsAppLink phone={s.phone} /> : "—"}</td>
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

            <ResetAllDataCard onDone={loadAll} />
          </TabsContent>


          {/* HERO */}
          <TabsContent value="hero" className="mt-6 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Prévia da HeroSection pública</h3>
                <p className="text-xs text-muted-foreground">
                  Atualiza em tempo real conforme você edita.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPreview((v) => !v)}
                className="w-full sm:w-auto"
              >
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? "Ocultar prévia" : "Mostrar prévia"}
              </Button>
            </div>
            {showPreview && (
              <Card className="overflow-hidden p-0">
                <div className="max-h-[560px] overflow-auto">
                  <HeroRifa
                    pricePerNumber={previewPrice}
                    prizes={previewPrizes}
                    stats={heroStats}
                    onCtaClick={() => toast.info("Prévia: botão desativado no admin")}
                  />
                </div>
              </Card>
            )}
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

const StatCard = ({ label, value, tone = "neutral", hint }: { label: string; value: string; tone?: "positive" | "negative" | "warning" | "neutral"; hint?: string }) => {
  const toneCls =
    tone === "positive" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "negative" ? "text-red-600 dark:text-red-400" :
    tone === "warning" ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {hint ? (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={`Como é calculado: ${label}`} className="text-muted-foreground/70 hover:text-foreground transition-colors">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
      <p className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</p>
    </Card>
  );
};


const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    paid: "bg-green-500/15 text-green-700 dark:text-green-400",
    pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    expired: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
    refunded: "bg-orange-500/15 text-orange-700 dark:text-orange-400",

  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
};


const RESET_PASSWORD = "IDBJOVEM";

const ResetAllDataCard = ({ onDone }: { onDone: () => void }) => {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pwd !== RESET_PASSWORD) {
      toast.error("Senha incorreta");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_reset_all_data");
    setBusy(false);
    if (error) {
      toast.error("Falha ao resetar: " + error.message);
      return;
    }
    const row = Array.isArray(data) && data[0]
      ? (data[0] as { orders_deleted: number; numbers_reset: number })
      : { orders_deleted: 0, numbers_reset: 0 };
    toast.success(
      `Sistema resetado. ${row.orders_deleted} pedidos apagados e ${row.numbers_reset} números liberados.`,
    );
    setPwd("");
    setOpen(false);
    onDone();
  };

  return (
    <Card className="mt-6 max-w-lg border-destructive/40 p-6">
      <h3 className="text-base font-semibold text-destructive">Zona de perigo</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Apaga todos os pedidos, compradores, pagamentos e libera todos os números da rifa.
        Vendedores e configurações são preservados. Esta ação não pode ser desfeita.
      </p>
      <Button
        variant="destructive"
        className="mt-4"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" /> Resetar todos os dados
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPwd(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reset</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Esta ação irá <strong>apagar todos os pedidos, pagamentos e compradores</strong>{" "}
              e <strong>liberar todos os números</strong> da rifa.
            </p>
            <div className="space-y-1">
              <Label htmlFor="reset-pwd">Senha de confirmação</Label>
              <Input
                id="reset-pwd"
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Digite a senha"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setPwd(""); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={submit} disabled={busy || !pwd}>
              {busy ? "Resetando..." : "Confirmar reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default Admin;

