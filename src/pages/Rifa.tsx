import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RaffleGrid } from "@/components/RaffleGrid";
import { HeroRifa, type Prize, type HeroStats } from "@/components/HeroRifa";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Handshake, Sparkles, History, Search, ArrowRight } from "lucide-react";

const REF_STORAGE_KEY = "raffle_ref_code";

const Rifa = () => {
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState("Rifa IDB Jovem");
  const [pricePerNumber, setPricePerNumber] = useState<number | null>(null);
  const [prizes, setPrizes] = useState<Prize[] | null>(null);
  const [stats, setStats] = useState<HeroStats | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [sellerName, setSellerName] = useState<string | null>(null);

  // Capture ?ref=CODE and persist; lookup seller name
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem(REF_STORAGE_KEY, ref);
      console.log("[Rifa] ref_code captured:", ref);
    }
    const stored = ref ?? localStorage.getItem(REF_STORAGE_KEY);
    if (!stored) return;
    supabase.rpc("get_seller_by_ref", { _ref_code: stored }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : null;
      if (row?.name) setSellerName(row.name);
    });
  }, [searchParams]);

  // Load public settings (title, price, prizes, stats)
  useEffect(() => {
    document.title = "Rifa IDB Jovem — Mês da Juventude";
    const loadSettings = async () => {
      setHeroLoading(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "raffle_title",
          "price_per_number_cents",
          "hero_prizes",
          "hero_stats",
        ]);

      if (error) {
        console.log("[Rifa] settings error", error);
        setHeroLoading(false);
        return;
      }
      for (const row of data ?? []) {
        if (row.key === "raffle_title" && typeof row.value === "string") {
          setTitle(row.value);
          document.title = `${row.value} — Escolha seu número`;
        }
        if (row.key === "price_per_number_cents" && typeof row.value === "number") {
          setPricePerNumber(row.value);
        }
        if (row.key === "hero_prizes" && Array.isArray(row.value)) {
          setPrizes(row.value as unknown as Prize[]);
        }
        if (row.key === "hero_stats" && row.value && typeof row.value === "object") {
          setStats(row.value as unknown as HeroStats);
        }
      }
      setHeroLoading(false);
    };
    loadSettings();
  }, []);

  return (
    <main
      className="min-h-screen text-white"
      style={{ backgroundColor: "hsl(var(--hero-bg))" }}
    >
      <SiteHeader variant="dark" />

      <HeroRifa
        pricePerNumber={pricePerNumber}
        prizes={prizes}
        stats={stats}
        loading={heroLoading}
      />

      {/* Affiliate strip — dark themed */}
      <div className="border-y border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="container flex flex-col items-center gap-3 py-4 text-center text-sm sm:flex-row sm:justify-between sm:text-left">
          <p className="text-white/75">
            Quer se tornar um <span className="font-semibold text-white">revendedor</span> e
            ganhar com cada número vendido?
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-full border-white/30 bg-white/5 text-white hover:bg-white/10"
            >
              <Link to="/acompanhar">
                <History className="mr-2 h-4 w-4" /> Acompanhar compra
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-full font-bold"
              style={{
                backgroundColor: "hsl(var(--hero-gold))",
                color: "hsl(var(--hero-bg))",
              }}
            >
              <Link to="/afiliacao">
                <Handshake className="mr-2 h-4 w-4" /> Quero me afiliar
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Raffle grid section — hero-styled */}
      <section className="relative">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, hsl(var(--hero-gold) / 0.12), transparent 60%)",
          }}
        />
        <div className="container relative py-12 sm:py-16">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.25em]"
              style={{
                borderColor: "hsl(var(--hero-gold) / 0.5)",
                color: "hsl(var(--hero-gold))",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {title}
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
              Escolha seus{" "}
              <span className="text-glow-gold" style={{ color: "hsl(var(--hero-gold))" }}>
                números da sorte
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/75 sm:text-base">
              Toque nos números livres, finalize com{" "}
              <span className="font-semibold text-white">PIX</span> e pronto. Reserva válida
              por tempo limitado para garantir sua sorte.
            </p>
            {sellerName && (
              <p
                className="mt-4 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs backdrop-blur-sm"
                style={{
                  borderColor: "hsl(var(--hero-gold) / 0.4)",
                  color: "hsl(var(--hero-gold))",
                }}
              >
                Indicado por <span className="font-semibold">{sellerName}</span>
              </p>
            )}
          </div>

          <div
            id="rifa-grid"
            className="rounded-3xl border bg-white/[0.03] p-4 shadow-2xl backdrop-blur-md scroll-mt-6 sm:p-6"
            style={{ borderColor: "hsl(var(--hero-gold) / 0.25)" }}
          >
            <RaffleGrid pricePerNumber={pricePerNumber} />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/60">
        Sistema de rifa automatizado · Pagamento seguro via PIX · IDB Jovem Oficial
      </footer>
    </main>
  );
};

export default Rifa;
