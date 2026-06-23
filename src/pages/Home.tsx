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
import heroBg from "@/assets/hero-rifa-bg.jpg";
import logoIdb from "@/assets/idb-jovem-logo.png";

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

const NEWS = [
  {
    tag: "Programação",
    title: "Veja a grade completa do Mês da Juventude",
    description:
      "Confira datas, atrações e os principais momentos da edição deste ano.",
  },
  {
    tag: "Comunidade",
    title: "16 anos transformando histórias",
    description:
      "Relembre como tudo começou e os impactos do movimento por todo o país.",
  },
  {
    tag: "Bastidores",
    title: "Como sua participação financia o evento",
    description:
      "Entenda como rifa, camisetas e inscrições viabilizam cada edição.",
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
            <p
              className="text-xs font-extrabold uppercase tracking-[0.3em]"
              style={{ color: "hsl(var(--hero-gold))" }}
            >
              Escolha como participar
            </p>
            <h2 className="mt-3 text-fluid-3xl font-extrabold tracking-tight">
              Três caminhos.{" "}
              <span style={{ color: "hsl(var(--hero-gold))" }}>
                Um só movimento.
              </span>
            </h2>
            <p className="mt-4 text-fluid-base text-white/75">
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
              O maior encontro jovem do Brasil
            </h2>
            <p className="mt-5 text-white/80 sm:text-lg">
              O <strong>Mês da Juventude</strong> é a celebração anual da IDB
              Jovem: 30 dias de cultos, atividades, ações sociais e momentos
              marcantes que percorrem cidades de todo o país.
            </p>
            <p className="mt-4 text-white/75">
              Há 16 anos somando histórias, gerações e propósitos — com uma só
              mensagem que transforma vidas e renova a fé de milhares de jovens.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { icon: Calendar, value: "16 ANOS", label: "de história" },
                { icon: Users, value: "+50 MIL", label: "jovens impactados" },
                { icon: Map, value: "BRASIL", label: "todo o país" },
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

      {/* ============ NOVIDADES ============ */}
      <section
        className="relative py-20 sm:py-28"
        style={{ backgroundColor: "hsl(var(--hero-bg-deep))" }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p
                className="text-xs font-extrabold uppercase tracking-[0.3em]"
                style={{ color: "hsl(var(--hero-gold))" }}
              >
                Novidades & avisos
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Acompanhe o movimento
              </h2>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {NEWS.map((n) => (
              <article
                key={n.title}
                className="flex flex-col rounded-2xl border bg-white/5 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-gold-glow"
                style={{ borderColor: "hsl(var(--hero-gold) / 0.18)" }}
              >
                <span
                  className="self-start rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest"
                  style={{
                    borderColor: "hsl(var(--hero-gold) / 0.4)",
                    color: "hsl(var(--hero-gold))",
                  }}
                >
                  {n.tag}
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-white">
                  {n.title}
                </h3>
                <p className="mt-2 flex-1 text-sm text-white/75">
                  {n.description}
                </p>
                <p
                  className="mt-5 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest"
                  style={{ color: "hsl(var(--hero-gold))" }}
                >
                  Em breve <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

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
      <footer
        className="border-t"
        style={{
          backgroundColor: "hsl(var(--hero-bg-deep))",
          borderColor: "hsl(var(--hero-gold) / 0.15)",
        }}
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <img src={logoIdb} alt="IDB Jovem" loading="lazy" decoding="async" className="h-12 w-auto" />
              <div>
                <p className="font-extrabold uppercase tracking-wider text-white">
                  IDB Jovem
                </p>
                <p className="text-xs text-white/60">
                  Mês da Juventude · Jesus Transforma
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-md text-sm text-white/70">
              Há 16 anos percorrendo o Brasil com uma só mensagem que
              transforma. Junte-se à maior celebração jovem do país.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {[
                { href: "https://instagram.com/idbjovemminas", label: "Instagram @idbjovemminas", Icon: Instagram },
                { href: "https://youtube.com", label: "YouTube", Icon: Youtube },
                { href: "https://wa.me/", label: "WhatsApp", Icon: MessageCircle },
              ].map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border transition hover:scale-110"
                  style={{
                    borderColor: "hsl(var(--hero-gold) / 0.35)",
                    color: "hsl(var(--hero-gold))",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-white/90">
              Participe
            </p>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>
                <Link to="/inscricao" className="hover:text-white">
                  Inscrição
                </Link>
              </li>
              <li>
                <Link to="/rifa" className="hover:text-white">
                  Rifa oficial
                </Link>
              </li>
              <li>
                <Link to="/camiseta" className="hover:text-white">
                  Camiseta oficial
                </Link>
              </li>
              <li>
                <Link to="/afiliacao" className="hover:text-white">
                  Quero me afiliar
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-white/90">
              Conta & suporte
            </p>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>
                <Link to="/acompanhar" className="hover:text-white">
                  Consultar número
                </Link>
              </li>
              <li>
                <Link to="/auth" className="hover:text-white">
                  Minha área
                </Link>
              </li>
              <li>
                <a href="mailto:contato@idbjovem.com" className="hover:text-white">
                  Fale conosco
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="border-t"
          style={{ borderColor: "hsl(var(--hero-gold) / 0.12)" }}
        >
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-white/55 sm:flex-row sm:px-6">
            <p>© {new Date().getFullYear()} IDB Jovem — Todos os direitos reservados.</p>
            <p>Feito com fé e propósito.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
