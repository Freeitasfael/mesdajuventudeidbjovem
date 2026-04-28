import { useEffect } from "react";
import { Shield, CheckCircle, Heart, Calendar, Users, Map, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-rifa-bg.jpg";
import logoIdb from "@/assets/idb-jovem-logo.png";
import prizeIphone from "@/assets/prize-iphone.jpg";
import prizePs5 from "@/assets/prize-ps5.jpg";
import prizeMoto from "@/assets/prize-moto.jpg";

export type Prize = {
  position: string;
  name: string;
  image: string;
};

export type HeroRifaProps = {
  pricePerNumber: number | null; // in cents
  prizes?: Prize[];
  stats?: { years: number; people: string; coverage: string };
  onCtaClick?: () => void;
};

const DEFAULT_PRIZES: Prize[] = [
  { position: "1º PRÊMIO", name: "iPhone 15", image: prizeIphone },
  { position: "2º PRÊMIO", name: "PlayStation 5", image: prizePs5 },
  { position: "3º PRÊMIO", name: "Moto CG 160", image: prizeMoto },
];

const DEFAULT_STATS = { years: 16, people: "MILHARES", coverage: "TODO O PAÍS" };

const formatPrice = (cents: number | null) => {
  const value = typeof cents === "number" && cents > 0 ? cents : 500; // fallback R$ 5,00
  return `R$ ${(value / 100).toFixed(2).replace(".", ",")}`;
};

export const HeroRifa = ({
  pricePerNumber,
  prizes = DEFAULT_PRIZES,
  stats = DEFAULT_STATS,
  onCtaClick,
}: HeroRifaProps) => {
  useEffect(() => {
    console.log("[HeroRifa]", { pricePerNumber, prizes, stats });
  }, [pricePerNumber, prizes, stats]);

  const handleCta = () => {
    if (onCtaClick) return onCtaClick();
    const target = document.getElementById("rifa-grid");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
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
        {/* gold radial glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, hsl(var(--hero-gold) / 0.18), transparent 55%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[90vh] max-w-6xl flex-col items-center justify-center gap-10 px-4 py-16 sm:px-6 sm:py-20">
        {/* Headline */}
        <div className="animate-fade-in-up text-center">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            ESTA RIFA CUSTEIA O
            <br />
            <span
              className="text-glow-gold"
              style={{ color: "hsl(var(--hero-gold))" }}
            >
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

        {/* Price card — most important element */}
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
          <p
            className="mt-3 font-extrabold leading-none tracking-tight text-glow-gold text-6xl sm:text-7xl lg:text-8xl"
            style={{ color: "hsl(var(--hero-gold))" }}
          >
            {formatPrice(pricePerNumber)}
          </p>
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

        {/* Logo */}
        <div className="animate-fade-in flex flex-col items-center">
          <div
            className="rounded-2xl bg-white/95 p-4 shadow-xl ring-1 ring-white/20 transition-transform hover:scale-105"
          >
            <img
              src={logoIdb}
              alt="IDB Jovem Oficial"
              className="h-auto w-48 sm:w-56 lg:w-64"
              loading="lazy"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Calendar, value: `${stats.years} ANOS`, label: "de história" },
            { icon: Users, value: stats.people, label: "de jovens impactados" },
            { icon: Map, value: stats.coverage, label: "alcançado" },
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
            {prizes.map((prize) => (
              <article
                key={prize.position}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:scale-[1.03] hover:shadow-gold-glow"
              >
                <div className="relative aspect-square w-full overflow-hidden">
                  <img
                    src={prize.image}
                    alt={prize.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
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
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroRifa;
