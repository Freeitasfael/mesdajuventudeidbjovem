import { useEffect, useState } from "react";
import { Shield, CheckCircle, Heart, Calendar, Users, Map, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TransparentLogo } from "@/components/TransparentLogo";
import heroBg from "@/assets/hero-rifa-bg.jpg";
import logoIdb from "@/assets/idb-jovem-logo.png";
import prizeIphone from "@/assets/prize-iphone.jpg";
import prizePs5 from "@/assets/prize-ps5.jpg";
import prizeMoto from "@/assets/prize-moto.jpg";

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

const FALLBACK_IMAGES = [prizeIphone, prizePs5, prizeMoto];

const FALLBACK_PRIZES: Prize[] = [
  { position: "1º PRÊMIO", name: "Prêmio principal", image: null, fit: "cover", scale: 1, posX: 0, posY: 0, mediaType: "image" },
  { position: "2º PRÊMIO", name: "Prêmio secundário", image: null, fit: "cover", scale: 1, posX: 0, posY: 0, mediaType: "image" },
  { position: "3º PRÊMIO", name: "Prêmio bônus", image: null, fit: "cover", scale: 1, posX: 0, posY: 0, mediaType: "image" },
];

const FALLBACK_STATS: HeroStats = {
  years: 16,
  people: "MILHARES",
  coverage: "TODO O PAÍS",
};

const formatPrice = (cents: number | null | undefined) => {
  const value = typeof cents === "number" && cents > 0 ? cents : 500;
  return `R$ ${(value / 100).toFixed(2).replace(".", ",")}`;
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

  const safePrizes = isValidPrizes(prizes) && prizes.length > 0 ? prizes : (loading ? null : FALLBACK_PRIZES);
  const safeStats = isValidStats(stats) ? stats : (loading ? null : FALLBACK_STATS);
  const safePrice = typeof pricePerNumber === "number" && pricePerNumber > 0
    ? pricePerNumber
    : (loading ? null : 500);

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
            className="h-auto w-48 sm:w-64 lg:w-80 transition-transform hover:scale-105"
            style={{
              backgroundColor: "transparent",
              filter: "drop-shadow(0 8px 24px hsl(var(--hero-gold) / 0.35))",
            }}
          />
        </div>

        {/* Headline */}
        <div className="animate-fade-in-up text-center">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            ESTA RIFA CUSTEIA O
            <br />
            <span className="text-glow-gold" style={{ color: "hsl(var(--hero-gold))" }}>
              MÊS DA JUVENTUDE
            </span>
          </h1>
        </div>

        {/* Subheadline */}
        <div className="animate-fade-in max-w-3xl text-center">
          <p className="text-base text-white/85 sm:text-lg md:text-xl">
            Há <span className="font-semibold text-white">16 anos</span> realizando esse evento
            por todo o país, com milhares de jovens e um só propósito e uma só voz:
          </p>
          <p
            className="mt-3 text-2xl font-extrabold tracking-wide text-glow-gold sm:text-3xl md:text-4xl"
            style={{ color: "hsl(var(--hero-gold))" }}
          >
            JESUS TRANSFORMA!
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
            Por apenas
          </p>
          {loading || pricePerNumber === null ? (
            <div className="mt-4 flex justify-center">
              <Skeleton className="h-20 w-64 rounded-xl bg-white/10 sm:h-24 sm:w-80" />
            </div>
          ) : (
            <p
              className="mt-3 font-extrabold leading-none tracking-tight text-glow-gold text-6xl sm:text-7xl lg:text-8xl"
              style={{ color: "hsl(var(--hero-gold))" }}
            >
              {formatPrice(pricePerNumber)}
            </p>
          )}
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.3em] text-white/70 sm:text-base">
            Por número
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
            Quero Participar!
          </Button>
          <p className="mt-2 text-xs text-white/70 sm:text-sm">
            Escolha seus números e concorra
          </p>
        </div>

        {/* Trust indicators */}
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-white/85 sm:text-base">
          <li className="inline-flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: "hsl(var(--hero-gold))" }} />
            100% transparente
          </li>
          <li className="inline-flex items-center gap-2">
            <CheckCircle className="h-4 w-4" style={{ color: "hsl(var(--hero-gold))" }} />
            100% confiável
          </li>
          <li className="inline-flex items-center gap-2">
            <Heart className="h-4 w-4" style={{ color: "hsl(var(--hero-gold))" }} />
            100% do valor para o evento
          </li>
        </ul>



        {/* Stats */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {loading || !safeStats
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl bg-white/10" />
              ))
            : [
                { icon: Calendar, value: `${safeStats.years} ANOS`, label: "de história" },
                { icon: Users, value: safeStats.people, label: "de jovens impactados" },
                { icon: Map, value: safeStats.coverage, label: "alcançado" },
              ].map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur-sm"
                >
                  <Icon
                    className="mx-auto mb-2 h-6 w-6"
                    style={{ color: "hsl(var(--hero-gold))" }}
                  />
                  <p
                    className="text-xl font-extrabold tracking-wide sm:text-2xl"
                    style={{ color: "hsl(var(--hero-gold))" }}
                  >
                    {value}
                  </p>
                  <p className="text-xs text-white/75 sm:text-sm">{label}</p>
                </div>
              ))}
        </div>

        {/* Prizes */}
        <div className="w-full">
          <div className="mb-6 flex items-center justify-center gap-2 text-center">
            <Trophy className="h-6 w-6" style={{ color: "hsl(var(--hero-gold))" }} />
            <h2
              className="text-2xl font-extrabold uppercase tracking-wider sm:text-3xl"
              style={{ color: "hsl(var(--hero-gold))" }}
            >
              Prêmios da Rifa
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {loading || !safePrizes
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-2xl bg-white/10" />
                ))
              : safePrizes.map((prize, idx) => {
                  const fallback = FALLBACK_IMAGES[idx] || FALLBACK_IMAGES[0];
                  const src = prize.image || fallback;
                  const inferred = prize.mediaType || inferType(prize.image);
                  const type = inferred;
                  const fit = prize.fit === "contain" ? "contain" : "cover";
                  const scale = clamp(typeof prize.scale === "number" ? prize.scale : 1, 0.6, 1.6);
                  const posX = clamp(typeof prize.posX === "number" ? prize.posX : 0, -50, 50);
                  const posY = clamp(typeof prize.posY === "number" ? prize.posY : 0, -50, 50);
                  const objectPosition = `${50 + posX}% ${50 + posY}%`;
                  const mediaStyle: React.CSSProperties = {
                    objectFit: fit,
                    objectPosition,
                    transform: `scale(${scale})`,
                    transformOrigin: "center center",
                  };
                  return (
                    <article
                      key={`${prize.position}-${idx}`}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:scale-[1.03] hover:shadow-gold-glow"
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-black/30">
                        <PrizeMedia
                          src={src}
                          type={type}
                          fallback={fallback}
                          alt={prize.name}
                          style={mediaStyle}
                        />
                        <span
                          className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider shadow-md"
                          style={{
                            backgroundColor: "hsl(var(--hero-gold))",
                            color: "hsl(var(--hero-bg))",
                          }}
                        >
                          {prize.position}
                        </span>
                      </div>
                      <div className="p-4 text-center">
                        <h3 className="text-lg font-bold text-white">{prize.name}</h3>
                      </div>
                    </article>
                  );
                })}
          </div>
        </div>
      </div>
    </section>
  );
};

type PrizeMediaProps = {
  src: string;
  type: "image" | "video";
  fallback: string;
  alt: string;
  style: React.CSSProperties;
};

const PrizeMedia = ({ src, type, fallback, alt, style }: PrizeMediaProps) => {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    setVideoFailed(false);
    setImgSrc(src);
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
          console.log("[HeroRifa] video failed, falling back to image", src);
          setVideoFailed(true);
        }}
      />
    );
  }

  const finalSrc = type === "video" && videoFailed ? fallback : imgSrc;
  return (
    <img
      src={finalSrc}
      alt={alt}
      loading="lazy"
      className="h-full w-full transition-transform duration-500 group-hover:scale-110"
      style={style}
      onError={() => {
        if (imgSrc !== fallback) setImgSrc(fallback);
      }}
    />
  );
};

export default HeroRifa;
