import { useEffect, useState } from "react";
import { Shield, CheckCircle, Heart, Calendar, Users, Map, Trophy, Zap } from "lucide-react";
import { PixIcon } from "@/components/PixIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TransparentLogo } from "@/components/TransparentLogo";
import heroBg from "@/assets/hero-rifa-bg.jpg";
import logoIdb from "@/assets/idb-jovem-logo.png";

export type Prize = {
  position: string;
  name: string;
  image?: string | null;
  /** Tipo de mídia. Se omitido, é inferido pela extensão. */
  mediaType?: "image" | "video" | null;
  /** Como a mídia preenche o card: cover (preenche, pode cortar) ou contain (mostra inteira). */
  fit?: "cover" | "contain" | null;
  /** Zoom da mídia. Limitado entre 0.6 e 1.6 para não desproporcional. */
  scale?: number | null;
  /** Posição horizontal em %. Entre -50 e 50. */
  posX?: number | null;
  /** Posição vertical em %. Entre -50 e 50. */
  posY?: number | null;
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const inferType = (url?: string | null): "image" | "video" =>
  url && VIDEO_EXT.test(url) ? "video" : "image";

export type HeroStats = {
  years: number;
  people: string;
  coverage: string;
};

export type HeroRifaProps = {
  pricePerNumber: number | null;
  prizes?: Prize[] | null;
  stats?: HeroStats | null;
  loading?: boolean;
  onCtaClick?: () => void;
};

const formatPrice = (cents: number | null | undefined) => {
  if (typeof cents !== "number" || cents <= 0) return "—";
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
};

const isValidPrizes = (p: unknown): p is Prize[] =>
  Array.isArray(p) && p.every((x) => x && typeof (x as Prize).name === "string");

const isValidStats = (s: unknown): s is HeroStats =>
  !!s &&
  typeof (s as HeroStats).years === "number" &&
  typeof (s as HeroStats).people === "string" &&
  typeof (s as HeroStats).coverage === "string";

export const HeroRifa = ({
  pricePerNumber,
  prizes,
  stats,
  loading = false,
  onCtaClick,
}: HeroRifaProps) => {
  useEffect(() => {
    console.log("[HeroRifa]", { pricePerNumber, prizes, stats, loading });
  }, [pricePerNumber, prizes, stats, loading]);

  // IMPORTANTE: nunca usar dados falsos como fallback.
  // Se a configuração real não chegar, mostramos skeleton em vez
  // de inventar prêmios/valores que não correspondem à rifa atual.
  const safePrizes = isValidPrizes(prizes) && prizes.length > 0 ? prizes : null;
  const safeStats = isValidStats(stats) ? stats : null;
  const safePrice =
    typeof pricePerNumber === "number" && pricePerNumber > 0 ? pricePerNumber : null;


  const handleCta = () => {
    if (onCtaClick) return onCtaClick();
    const target = document.getElementById("rifa-grid");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.add("ring-highlight");
    window.setTimeout(() => target.classList.remove("ring-highlight"), 2200);
  };

  return (
    <section
      className="relative w-full overflow-hidden text-white"
      style={{ backgroundColor: "hsl(var(--hero-bg))" }}
      aria-label="Rifa IDB Jovem - Mês da Juventude"
    >
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-cover opacity-60"
          width={1920}
          height={1280}
        />

        <div
          className="absolute inset-0"
          style={{ background: "var(--gradient-hero-dark)", backdropFilter: "blur(2px)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, hsl(var(--hero-gold) / 0.18), transparent 55%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[90vh] max-w-6xl flex-col items-center justify-center gap-10 px-4 py-16 sm:px-6 sm:py-20">
        {/* Logo no topo (fundo transparente garantido) */}
        <div className="animate-fade-in flex flex-col items-center">
          <img
            src={logoIdb}
            alt="IDB Jovem Oficial"
            width={320}
            height={320}
            fetchPriority="high"
            decoding="async"
            className="h-auto w-48 sm:w-64 lg:w-80 transition-transform hover:scale-105"
            style={{
              backgroundColor: "transparent",
              filter: "drop-shadow(0 8px 24px hsl(var(--hero-gold) / 0.35))",
            }}
          />

        </div>

        {/* Headline */}
        <div className="animate-fade-in-up text-center">
          <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            COMO FUNCIONA A RIFA DO
            <br />
            <span className="text-glow-gold" style={{ color: "hsl(var(--hero-gold))" }}>
              MÊS DA JUVENTUDE
            </span>
          </h1>
        </div>

        {/* Explicação */}
        <div className="animate-fade-in max-w-3xl space-y-5 text-center">
          <p className="text-base text-white/85 sm:text-lg">
            Essa rifa faz parte da construção do <span className="font-semibold text-white">Mês da Juventude</span>,
            um evento que há anos reúne jovens de todo o Brasil com um único propósito:
            viver algo real com Deus.
          </p>

          <div
            className="mx-auto max-w-xl rounded-2xl border px-5 py-5 text-left backdrop-blur-md"
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              borderColor: "hsl(var(--hero-gold) / 0.35)",
            }}
          >
            <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-white/80">
              Participar é simples
            </p>
            <ul className="mt-4 space-y-2 text-sm text-white/90 sm:text-base">
              <li className="flex gap-2">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "hsl(var(--hero-gold))" }} />
                <span>Cada número custa <span className="font-semibold text-white">R$ 10,00</span></span>
              </li>
              <li className="flex gap-2">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "hsl(var(--hero-gold))" }} />
                <span>Você escolhe seus números</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "hsl(var(--hero-gold))" }} />
                <span>Após o pagamento, eles ficam vinculados ao seu nome</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "hsl(var(--hero-gold))" }} />
                <span>No final, será realizado o sorteio conforme as regras do evento</span>
              </li>
            </ul>
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-bold uppercase tracking-wider sm:text-base"
            style={{
              backgroundColor: "hsl(var(--hero-gold) / 0.15)",
              borderColor: "hsl(var(--hero-gold) / 0.5)",
              color: "hsl(var(--hero-gold))",
            }}
          >
            <Calendar className="h-4 w-4" />
            Sorteio: 13/07/2026
          </div>

          <p className="text-base text-white/85 sm:text-lg">
            Além de concorrer, você também está contribuindo diretamente para que esse
            movimento aconteça. Cada número ajuda a viabilizar estrutura, organização e
            tudo o que envolve esse projeto.
          </p>

          <p
            className="text-2xl font-extrabold tracking-wide text-glow-gold sm:text-3xl md:text-4xl"
            style={{ color: "hsl(var(--hero-gold))" }}
          >
            JESUS TRANSFORMA.
          </p>

          <p className="text-base font-semibold text-white sm:text-lg">
            Escolha seus números e faça parte disso.
          </p>
        </div>


        {/* Price card */}
        <div
          className="animate-fade-in-up relative w-full max-w-xl rounded-3xl border px-6 py-8 text-center shadow-gold-glow backdrop-blur-md sm:px-10 sm:py-10"
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            borderColor: "hsl(var(--hero-gold) / 0.4)",
          }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70 sm:text-base">
            Cada Número por apenas
          </p>
          <p
            className="mt-3 font-extrabold leading-none tracking-tight text-glow-gold text-6xl sm:text-7xl lg:text-8xl"
            style={{ color: "hsl(var(--hero-gold))" }}
          >
            R$ 10,00
          </p>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.3em] text-white/70 sm:text-base">
            cada número
          </p>

          <Button
            size="lg"
            onClick={handleCta}
            className="mt-7 h-14 w-full rounded-2xl text-base font-extrabold uppercase tracking-wider shadow-xl transition-all hover:scale-[1.02] hover:brightness-110 sm:text-lg"
            style={{
              backgroundColor: "hsl(var(--hero-gold))",
              color: "hsl(var(--hero-bg))",
            }}
          >
            Quero comprar um número
          </Button>
        </div>

        {/* Prizes */}
        <div className="w-full">
          {/* Featured Pix prize highlight */}
          <div className="relative mb-8 overflow-hidden rounded-3xl border-2 p-6 sm:p-8"
            style={{
              borderColor: "hsl(var(--hero-gold))",
              background:
                "radial-gradient(circle at 20% 20%, rgba(50,188,173,0.25), transparent 60%), radial-gradient(circle at 80% 80%, hsl(var(--hero-gold) / 0.18), transparent 60%), hsl(var(--hero-bg) / 0.6)",
              boxShadow: "0 0 40px hsl(var(--hero-gold) / 0.35)",
            }}
          >
            {/* shimmer accent */}
            <div className="pointer-events-none absolute -top-1/2 -right-1/2 h-[200%] w-[200%] opacity-30"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, rgba(50,188,173,0.4) 30deg, transparent 60deg)",
                animation: "spin 12s linear infinite",
              }}
              aria-hidden
            />
            <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
              <div className="relative shrink-0">
                <div
                  className="absolute inset-0 rounded-full blur-2xl"
                  style={{ background: "rgba(50,188,173,0.55)" }}
                  aria-hidden
                />
                <div
                  className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-white shadow-2xl sm:h-32 sm:w-32"
                  style={{ boxShadow: "0 0 30px rgba(50,188,173,0.6)" }}
                >
                  <PixIcon className="h-20 w-20 sm:h-24 sm:w-24 animate-pulse" />
                </div>
              </div>
              <div className="flex-1">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] shadow-md"
                  style={{
                    backgroundColor: "hsl(var(--hero-gold))",
                    color: "hsl(var(--hero-bg))",
                  }}
                >
                  <Zap className="h-3.5 w-3.5" /> Prêmio principal
                </span>
                <h3 className="mt-3 text-2xl font-extrabold uppercase tracking-wider text-white sm:text-3xl">
                  Concorra a
                </h3>
                <p
                  className="mt-1 font-extrabold leading-none tracking-tight text-glow-gold text-6xl sm:text-7xl lg:text-8xl"
                  style={{ color: "hsl(var(--hero-gold))" }}
                >
                  R$ 500
                </p>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] sm:text-base" style={{ color: "#32BCAD" }}>
                  em PIX na sua conta
                </p>
                <p className="mt-2 text-sm text-white/75 sm:text-base">
                  Rápido, seguro e direto — sem burocracia.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

type PrizeMediaProps = {
  src: string;
  type: "image" | "video";
  alt: string;
  style: React.CSSProperties;
};

const PrizeMedia = ({ src, type, alt, style }: PrizeMediaProps) => {
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [src]);

  if (type === "video" && !videoFailed) {
    return (
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full transition-transform duration-500 group-hover:scale-110"
        style={style}
        onError={() => {
          console.log("[HeroRifa] video failed", src);
          setVideoFailed(true);
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-full w-full transition-transform duration-500 group-hover:scale-110"
      style={style}
    />
  );
};

export default HeroRifa;
