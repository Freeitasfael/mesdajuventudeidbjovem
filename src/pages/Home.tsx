import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  Ticket,
  Shirt,
  UserPlus,
  ArrowRight,
  Shield,
  Heart,
  CheckCircle,
  Instagram,
  Youtube,
  MessageCircle,
  Sparkles,
  Calendar,
  Users,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { VSLPlayer } from "@/components/VSLPlayer";
import { SiteFooter } from "@/components/SiteFooter";
import heroBg from "@/assets/hero-rifa-bg.jpg";
import logoIdb from "@/assets/idb-jovem-logo.png";
import { RecapGallery } from "@/components/RecapGallery";

type PathCard = {
  to: string;
  title: string;
  kicker: string;
  description: string;
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
  highlighted?: boolean;
};

const PATHS: PathCard[] = [
  {
    to: "/inscricao",
    title: "Inscrição",
    kicker: "Garanta sua vaga",
    description:
      "Inscreva-se no Mês da Juventude e participe da maior celebração jovem do ano.",
    cta: "Quero me inscrever",
    icon: UserPlus,
  },
  {
    to: "/rifa",
    title: "Rifa Oficial",
    kicker: "Concorra a prêmios",
    description:
      "Compre seus números, apoie o evento e concorra a prêmios incríveis com transparência total.",
    cta: "Comprar números",
    icon: Ticket,
    highlighted: true,
  },
  {
    to: "/camiseta",
    title: "Camiseta Oficial",
    kicker: "Use, viva, marque",
    description:
      "Adquira a camiseta oficial do evento e leve a mensagem para todo lugar.",
    cta: "Comprar camiseta",
    icon: Shirt,
  },
];


export default function Home() {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "hsl(var(--hero-bg))" }}
    >
      <SiteHeader variant="dark" />

      {/* ============ HERO ============ */}
      <section
        className="relative overflow-hidden"
        aria-label="IDB Jovem — Mês da Juventude"
      >
        <div className="absolute inset-0">
          <img
            src={heroBg}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover opacity-50"
          />
          <div
            className="absolute inset-0"
            style={{ background: "var(--gradient-hero-dark)" }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, hsl(var(--hero-gold) / 0.18), transparent 55%)",
            }}
          />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 py-16 sm:px-6 sm:py-24">
          <div className="animate-fade-in flex flex-col items-center text-center">
            <img
              src={logoIdb}
              alt="IDB Jovem"
              width={320}
              height={320}
              decoding="async"
              fetchPriority="high"
              className="h-auto w-56 sm:w-72 md:w-80"
              style={{
                filter: "drop-shadow(0 12px 36px hsl(var(--hero-gold) / 0.5))",
              }}
            />
          </div>

          <div className="animate-fade-in-up w-full max-w-4xl text-center">
            <h1 className="text-fluid-hero font-extrabold leading-[1.05] tracking-tight">
              UM MÊS.
              <br />
              UMA GERAÇÃO.
              <br />
              <span
                className="text-glow-gold"
                style={{ color: "hsl(var(--hero-gold))" }}
              >
                UMA SÓ VOZ.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-fluid-lg font-semibold uppercase tracking-[0.18em] text-white/90 sm:mt-6">
              Congresso Estadual de Jovens
              <br />
              <span style={{ color: "hsl(var(--hero-gold))" }}>Estações</span>
            </p>
          </div>

          {/* VSL */}
          <div className="animate-fade-in-up w-full max-w-3xl">
            <VSLPlayer poster={heroBg} />
          </div>

          {/* CTA hero */}
          <div className="flex w-full max-w-2xl justify-center">
            <Button
              size="lg"
              onClick={() => scrollTo("participar")}
              className="h-16 w-full rounded-2xl text-lg font-extrabold uppercase tracking-wider shadow-xl transition-all hover:scale-[1.02] hover:brightness-110 sm:h-20 sm:text-xl sm:px-16"
              style={{
                backgroundColor: "hsl(var(--hero-gold))",
                color: "hsl(var(--hero-bg))",
              }}
            >
              Quero Participar
              <ArrowRight className="ml-3 h-6 w-6 sm:h-7 sm:w-7" />
            </Button>
          </div>

        </div>
      </section>

      {/* ============ 3 CAMINHOS ============ */}
      <section
        id="participar"
        className="relative py-20 sm:py-28"
        style={{ backgroundColor: "hsl(var(--hero-bg-deep))" }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-fluid-3xl font-extrabold tracking-tight">
              Escolha como{" "}
              <span style={{ color: "hsl(var(--hero-gold))" }}>participar</span>
            </h2>
            <p className="mt-5 text-fluid-lg text-white/85">
              Inscreva-se, apoie pela rifa ou vista a mensagem. Toda forma de
              participar fortalece o Mês da Juventude.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 sm:gap-6 md:grid-cols-3">
            {PATHS.map(({ to, title, kicker, description, cta, icon: Icon, highlighted }) => (
              <article
                key={to}
                className={`group relative flex flex-col overflow-hidden rounded-3xl border p-5 transition-all hover:-translate-y-1 hover:shadow-gold-glow sm:p-7 ${
                  highlighted ? "md:scale-[1.03]" : ""
                }`}
                style={{
                  borderColor: highlighted
                    ? "hsl(var(--hero-gold) / 0.55)"
                    : "hsl(var(--hero-gold) / 0.18)",
                  backgroundColor: highlighted
                    ? "rgba(201,168,76,0.08)"
                    : "rgba(255,255,255,0.04)",
                  backdropFilter: "blur(6px)",
                }}
              >
                {highlighted && (
                  <span
                    className="absolute right-4 top-4 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest"
                    style={{
                      backgroundColor: "hsl(var(--hero-gold))",
                      color: "hsl(var(--hero-bg))",
                    }}
                  >
                    Em destaque
                  </span>
                )}

                <div
                  className="inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: "hsl(var(--hero-gold) / 0.15)",
                    color: "hsl(var(--hero-gold))",
                    border: "1px solid hsl(var(--hero-gold) / 0.35)",
                  }}
                >
                  <Icon className="h-7 w-7" />
                </div>

                <p
                  className="mt-5 text-xs font-extrabold uppercase tracking-[0.25em]"
                  style={{ color: "hsl(var(--hero-gold))" }}
                >
                  {kicker}
                </p>
                <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-white">
                  {title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/75 sm:text-base">
                  {description}
                </p>

                <Button
                  asChild
                  size="lg"
                  className="mt-6 h-12 w-full rounded-2xl text-sm font-extrabold uppercase tracking-wider transition-all hover:brightness-110"
                  style={{
                    backgroundColor: "hsl(var(--hero-gold))",
                    color: "hsl(var(--hero-bg))",
                  }}
                >
                  <Link to={to}>
                    {cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SOBRE O EVENTO ============ */}
      <section
        className="relative py-20 sm:py-28"
        style={{ backgroundColor: "hsl(var(--hero-bg))" }}
      >
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 md:grid-cols-2 md:items-center">
          <div>
            <p
              className="text-xs font-extrabold uppercase tracking-[0.3em]"
              style={{ color: "hsl(var(--hero-gold))" }}
            >
              Sobre o evento
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              O maior movimento jovem da Igreja de Deus no Brasil
            </h2>
            <p className="mt-5 text-white/80 sm:text-lg">
              O <strong>Mês da Juventude</strong> acontece em todo o país, reunindo
              jovens da Igreja de Deus no Brasil para viver esse tempo de forma
              única em cada lugar.
            </p>
            <p className="mt-4 text-white/75">
              Cada estado se movimenta do seu jeito, com ações, encontros e
              momentos que levam uma mensagem simples e real:{" "}
              <strong>Jesus transforma.</strong>
            </p>
            <p className="mt-4 text-white/75">
              E em <strong>Minas Gerais</strong> isso ganha ainda mais força.
              Neste ano, a IDB Jovem Minas Gerais está preparando uma grande
              mobilização em um final de semana especial — um encontro que vai
              reunir jovens de várias cidades para viver algo marcante juntos.
            </p>
            <p className="mt-4 text-white/75">
              Mais do que um evento, é um tempo de{" "}
              <strong>conexão, fé e propósito.</strong>
            </p>
            <p className="mt-4 text-white/75">
              Há 16 anos esse movimento vem impactando gerações dentro da nossa
              igreja, levando uma mensagem que continua transformando vidas.
            </p>
            <p
              className="mt-5 text-lg font-extrabold uppercase tracking-[0.2em]"
              style={{ color: "hsl(var(--hero-gold))" }}
            >
              Jesus transforma.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { icon: Calendar, value: "16 ANOS", label: "de história" },
                { icon: Users, value: "+50 MIL", label: "jovens impactados" },
                { icon: Map, value: "EM TODO", label: "o Brasil" },
              ].map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm"
                >
                  <Icon
                    className="mx-auto mb-2 h-5 w-5"
                    style={{ color: "hsl(var(--hero-gold))" }}
                  />
                  <p
                    className="text-base font-extrabold sm:text-lg"
                    style={{ color: "hsl(var(--hero-gold))" }}
                  >
                    {value}
                  </p>
                  <p className="text-[11px] text-white/70 sm:text-xs">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-3xl border shadow-gold-glow"
            style={{
              borderColor: "hsl(var(--hero-gold) / 0.3)",
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          >
            <img
              src={heroBg}
              alt="Mês da Juventude"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, transparent 40%, hsl(var(--hero-bg) / 0.85) 100%)",
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <p
                className="text-xs font-extrabold uppercase tracking-[0.3em]"
                style={{ color: "hsl(var(--hero-gold))" }}
              >
                Edição atual
              </p>
              <p className="mt-2 text-2xl font-extrabold text-white">
                Jesus Transforma — Tour Nacional
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ RECAP / NOVIDADES ============ */}
      <RecapGallery />

      {/* ============ CTA FINAL ============ */}
      <section
        className="relative overflow-hidden py-20 sm:py-28"
        style={{ backgroundColor: "hsl(var(--hero-bg))" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, hsl(var(--hero-gold) / 0.15), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Sua geração precisa{" "}
            <span style={{ color: "hsl(var(--hero-gold))" }}>de você</span>.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-white/80 sm:text-lg">
            Inscreva-se, apoie a rifa ou vista a camiseta. Cada gesto fortalece
            o Mês da Juventude.
          </p>
          <Button
            size="lg"
            onClick={() => scrollTo("participar")}
            className="mt-8 h-14 rounded-2xl px-10 text-base font-extrabold uppercase tracking-wider shadow-xl transition-all hover:scale-[1.02] hover:brightness-110 sm:text-lg"
            style={{
              backgroundColor: "hsl(var(--hero-gold))",
              color: "hsl(var(--hero-bg))",
            }}
          >
            Quero participar
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <SiteFooter />
    </div>
  );
}
