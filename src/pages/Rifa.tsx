import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RaffleGrid } from "@/components/RaffleGrid";
import { CheckoutBar } from "@/components/CheckoutBar";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { useSelection } from "@/hooks/useSelection";
import { HeroRifa, type Prize, type HeroStats } from "@/components/HeroRifa";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Handshake, Sparkles, History, Search, ArrowRight, Instagram, Youtube, Radio } from "lucide-react";

const REF_STORAGE_KEY = "raffle_ref_code";


const Rifa = () => {
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState("Rifa IDB Jovem");
  const [pricePerNumber, setPricePerNumber] = useState<number | null>(null);
  const [prizes, setPrizes] = useState<Prize[] | null>(null);
  const [stats, setStats] = useState<HeroStats | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [salesClosed, setSalesClosed] = useState(false);
  const [closedModalOpen, setClosedModalOpen] = useState(false);
  const { selected } = useSelection();


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
          "raffle_sales_closed",
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
        if (row.key === "raffle_sales_closed" && row.value === true) {
          setSalesClosed(true);
          setClosedModalOpen(true);
        }
      }
      setHeroLoading(false);
    };

    loadSettings();
    // Failsafe: nunca deixe o hero preso em skeleton mais que 4s
    const failsafe = window.setTimeout(() => setHeroLoading(false), 4000);

    // Polling: detecta se admin encerrou as vendas enquanto o usuário está na página
    const poll = window.setInterval(async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "raffle_sales_closed")
        .maybeSingle();
      const closed = data?.value === true;
      setSalesClosed((prev) => {
        if (closed && !prev) setClosedModalOpen(true);
        return closed;
      });
    }, 15000);

    return () => {
      window.clearTimeout(failsafe);
      window.clearInterval(poll);
    };
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

      {/* Consultar meu número — destaque acima da rifa */}
      <section
        className="border-y border-white/10"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--hero-gold) / 0.15), hsl(var(--hero-gold) / 0.05))",
        }}
      >
        <div className="container flex flex-col items-center gap-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="max-w-xl">
            <p className="text-base font-bold text-white sm:text-lg">
              Já comprou seu número e quer consultar seu bilhete?
            </p>
            <p className="mt-1 text-sm text-white/70">
              Digite seu telefone e acompanhe o status do seu pagamento ou
              recupere uma compra que ficou pendente.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="rounded-full font-bold shadow-lg"
            style={{
              backgroundColor: "hsl(var(--hero-gold))",
              color: "hsl(var(--hero-bg))",
            }}
          >
            <Link to="/acompanhar">
              <Search className="mr-2 h-5 w-5" />
              Consultar meu número
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

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
            className="rounded-3xl border bg-white/[0.03] px-4 pt-4 pb-4 shadow-2xl backdrop-blur-md scroll-mt-6 sm:px-6 sm:pt-6 sm:pb-5"
            style={{ borderColor: "hsl(var(--hero-gold) / 0.25)" }}
          >
            <RaffleGrid />
          </div>
        </div>
      </section>

      {/* Quero me afiliar — rodapé com copy estratégica */}
      <section className="border-t border-white/10 bg-black/40">
        <div className="container max-w-3xl py-12 text-center">
          <Handshake
            className="mx-auto h-10 w-10"
            style={{ color: "hsl(var(--hero-gold))" }}
          />
          <h3 className="mt-3 text-2xl font-extrabold sm:text-3xl">
            Quer contribuir com o evento divulgando essa rifa?
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/75 sm:text-base">
            Você pode compartilhar seu link exclusivo e fazer parte ativa da construção
            do Mês da Juventude. Sua divulgação ajuda a custear tudo com excelência e honrar
            os participantes. <span className="font-semibold text-white">Obrigado a quem contribuir!</span>
          </p>
          <div className="mt-6 flex items-center justify-center">
            <Button
              asChild
              size="lg"
              className="rounded-full font-bold text-base sm:text-lg px-8 py-6 sm:px-10 sm:py-7 shadow-xl"
              style={{
                backgroundColor: "hsl(var(--hero-gold))",
                color: "hsl(var(--hero-bg))",
              }}
            >
              <Link to="/afiliacao">
                <Handshake className="mr-2 h-6 w-6" /> Quero me afiliar agora
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />

      {!salesClosed && <CheckoutBar pricePerNumber={pricePerNumber} />}

      <WhatsAppFab
        bottomOffset={!salesClosed && selected.length > 0 ? 96 : 0}
        message="Olá! Estou na página da Rifa IDB Jovem e gostaria de tirar uma dúvida antes de finalizar minha compra."
      />

      <Dialog
        open={closedModalOpen}
        onOpenChange={(o) => {
          // Se as vendas estão encerradas, o aviso não pode ser fechado por clique fora
          if (salesClosed && !o) return;
          setClosedModalOpen(o);
        }}
      >
        <DialogContent
          className="sm:max-w-2xl border-4 border-red-500 bg-background"
          onPointerDownOutside={(e) => salesClosed && e.preventDefault()}
          onEscapeKeyDown={(e) => salesClosed && e.preventDefault()}
        >
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 ring-4 ring-red-500/40 animate-pulse">
              <Radio className="h-9 w-9 text-red-500" />
            </div>
            <DialogTitle className="text-center text-3xl font-extrabold text-red-500 sm:text-4xl">
              VENDAS ENCERRADAS
            </DialogTitle>
            <DialogDescription className="pt-3 text-center text-lg leading-relaxed">
              As vendas da rifa do <strong>Mês da Juventude</strong> foram <strong>encerradas</strong>.
              <br className="hidden sm:block" />
              O sorteio será realizado <strong>AO VIVO</strong> no Instagram e YouTube da{" "}
              <strong>IDB Jovem Minas</strong>. Acompanhe por lá para saber o resultado!
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild variant="outline" size="lg" className="justify-start">
              <a href="https://www.instagram.com/idbjovemminas" target="_blank" rel="noopener noreferrer">
                <Instagram className="mr-2 h-5 w-5 text-pink-500" />
                @idbjovemminas no Instagram
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="justify-start">
              <a href="https://www.youtube.com/idbjovemminas" target="_blank" rel="noopener noreferrer">
                <Youtube className="mr-2 h-5 w-5 text-red-500" />
                IDB Jovem Minas no YouTube
              </a>
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setClosedModalOpen(false)} size="lg" className="w-full">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};



export default Rifa;
