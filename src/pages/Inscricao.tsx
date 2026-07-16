import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import {
  ArrowLeft,
  ArrowRight,
  QrCode,
  ShieldCheck,
  Ticket,
  MousePointerClick,
  ExternalLink,
  ClipboardList,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  Church,
  AlertTriangle,
} from "lucide-react";
import logoIdb from "@/assets/idb-jovem-logo.png";

const SYMPLA_URL =
  "https://www.sympla.com.br/evento/congresso-de-jovens-estacoes-2026/3472910?share_id=whatsapp";

const gold = "hsl(var(--hero-gold))";

function PrimaryCTA({ children }: { children: React.ReactNode }) {
  return (
    <Button
      asChild
      size="lg"
      className="h-16 w-full rounded-2xl px-8 text-base font-extrabold uppercase tracking-wider shadow-lg sm:h-20 sm:w-auto sm:text-lg"
      style={{
        backgroundColor: gold,
        color: "hsl(var(--hero-bg))",
        boxShadow: "0 12px 36px hsl(var(--hero-gold) / 0.35)",
      }}
    >
      <a href={SYMPLA_URL} target="_blank" rel="noopener noreferrer">
        {children}
        <ArrowRight className="ml-2 h-5 w-5 sm:h-6 sm:w-6" />
      </a>
    </Button>
  );
}

export default function Inscricao() {
  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "hsl(var(--hero-bg))" }}
    >
      <SiteHeader variant="dark" />

      {/* HERO */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-14 text-center sm:px-6 sm:py-20">
        <img
          src={logoIdb}
          alt="IDB Jovem"
          className="h-auto w-32 sm:w-40"
          style={{
            filter: "drop-shadow(0 8px 24px hsl(var(--hero-gold) / 0.35))",
          }}
        />

        <span
          className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.25em]"
          style={{
            borderColor: "hsl(var(--hero-gold) / 0.45)",
            color: gold,
          }}
        >
          <Ticket className="h-3.5 w-3.5" />
          Evento 100% gratuito
        </span>

        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          <span style={{ color: gold }}>INSCRIÇÃO</span> GRATUITA
        </h1>

        <p className="mt-5 max-w-xl text-white/85 sm:text-lg">
          O evento é <strong>gratuito</strong>, mas a inscrição é{" "}
          <strong>obrigatória</strong> para controle de público e segurança.
          Garanta sua vaga em menos de 1 minuto.
        </p>

        <div className="mt-8 w-full sm:w-auto">
          <PrimaryCTA>Garantir minha vaga gratuita</PrimaryCTA>
        </div>

        <p className="mt-4 inline-flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck className="h-3.5 w-3.5" />
          Link oficial Sympla · sem login obrigatório
        </p>
      </section>

      {/* BLOCO DE CLAREZA */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Ticket,
              title: "100% Gratuito",
              text: "Você não paga nada para participar.",
            },
            {
              icon: ClipboardList,
              title: "Inscrição obrigatória",
              text: "Exigência da prefeitura para liberação do evento.",
            },
            {
              icon: ShieldCheck,
              title: "Segurança e capacidade",
              text: "Controle de público para garantir a ordem no local.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border p-5 text-left"
              style={{
                borderColor: "hsl(var(--hero-gold) / 0.25)",
                backgroundColor: "hsl(var(--hero-gold) / 0.05)",
              }}
            >
              <Icon className="h-6 w-6" style={{ color: gold }} />
              <h3 className="mt-3 text-base font-extrabold uppercase tracking-wide">
                {title}
              </h3>
              <p className="mt-1 text-sm text-white/75">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold uppercase tracking-wider sm:text-3xl">
            Como funciona
          </h2>
          <p className="mt-2 text-sm text-white/70">
            4 passos rápidos pra você garantir sua vaga
          </p>
        </div>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: MousePointerClick,
              title: "Clique no botão",
              text: "Toque em “Garantir minha vaga”.",
            },
            {
              icon: ExternalLink,
              title: "Acesse o Sympla",
              text: "Você será redirecionado para o site oficial.",
            },
            {
              icon: ClipboardList,
              title: "Preencha seus dados",
              text: "Rápido e sem necessidade de login.",
            },
            {
              icon: QrCode,
              title: "Receba seu ingresso",
              text: "Um QR Code chegará no seu e-mail.",
            },
          ].map((step, i) => (
            <li
              key={step.title}
              className="relative rounded-2xl border p-5"
              style={{
                borderColor: "hsl(var(--hero-gold) / 0.25)",
                backgroundColor: "hsl(0 0% 100% / 0.03)",
              }}
            >
              <div
                className="absolute -top-3 left-5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold"
                style={{ backgroundColor: gold, color: "hsl(var(--hero-bg))" }}
              >
                {i + 1}
              </div>
              <step.icon className="mt-2 h-6 w-6" style={{ color: gold }} />
              <h3 className="mt-3 text-base font-extrabold">{step.title}</h3>
              <p className="mt-1 text-sm text-white/75">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/70">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" style={{ color: gold }} />
            Link 100% seguro
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" style={{ color: gold }} />
            Pode se inscrever sem criar conta
          </span>
        </div>
      </section>

      {/* DESTAQUE DO INGRESSO */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div
          className="overflow-hidden rounded-3xl border p-6 sm:p-10"
          style={{
            borderColor: "hsl(var(--hero-gold) / 0.55)",
            background:
              "linear-gradient(135deg, hsl(var(--hero-gold) / 0.18), hsl(var(--hero-gold) / 0.04))",
          }}
        >
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: "hsl(var(--hero-bg))",
                border: "1px solid hsl(var(--hero-gold) / 0.5)",
              }}
            >
              <QrCode className="h-10 w-10" style={{ color: gold }} />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-widest"
                style={{
                  backgroundColor: "hsl(var(--hero-gold) / 0.2)",
                  color: gold,
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Atenção
              </div>
              <h3 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">
                Sem ingresso, não será permitida a entrada.
              </h3>
              <p className="mt-2 text-white/85">
                O <strong>QR Code</strong> enviado por e-mail após a inscrição
                no Sympla será exigido na portaria. Salve no celular ou imprima
                antes do evento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAMAÇÃO */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold uppercase tracking-wider sm:text-3xl">
            Programação
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Um dia inteiro de adoração e mover de Deus
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            {
              time: "17:00",
              title: "Culto de Artes",
              text: "Dança, teatro e apresentações",
            },
            {
              time: "19:00",
              title: "Culto Principal",
              text: "Louvor, ministrações e mover de Deus",
            },
          ].map((b) => (
            <div
              key={b.time}
              className="rounded-2xl border p-6"
              style={{
                borderColor: "hsl(var(--hero-gold) / 0.3)",
                backgroundColor: "hsl(0 0% 100% / 0.03)",
              }}
            >
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5" style={{ color: gold }} />
                <span
                  className="text-3xl font-extrabold"
                  style={{ color: gold }}
                >
                  {b.time}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-extrabold">{b.title}</h3>
              <p className="mt-1 text-white/75">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INFORMAÇÕES DO EVENTO */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div
          className="rounded-3xl border p-6 sm:p-8"
          style={{
            borderColor: "hsl(var(--hero-gold) / 0.3)",
            backgroundColor: "hsl(0 0% 100% / 0.03)",
          }}
        >
          <h2 className="text-2xl font-extrabold uppercase tracking-wider sm:text-3xl">
            Informações do evento
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Church className="mt-0.5 h-5 w-5 shrink-0" style={{ color: gold }} />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                  Realização
                </p>
                <p className="text-base font-semibold">Igreja de Deus no Brasil</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 shrink-0" style={{ color: gold }} />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                  Data
                </p>
                <p className="text-base font-semibold">18 de julho de 2026</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0" style={{ color: gold }} />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                  Horário
                </p>
                <p className="text-base font-semibold">A partir das 17h</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0" style={{ color: gold }} />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                  Local
                </p>
                <p className="text-base font-semibold">
                  CDL Uberlândia
                </p>
                <p className="mt-1 text-sm text-white/75">
                  Av. Belo Horizonte, 1290
                  <br />
                  Osvaldo Rezende · Uberlândia – MG
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-3xl px-4 pb-20 pt-6 text-center sm:px-6">
        <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">
          Garanta sua vaga gratuita{" "}
          <span style={{ color: gold }}>e não fique de fora.</span>
        </h2>
        <p className="mt-3 text-white/80">
          A inscrição leva menos de 1 minuto e seu QR Code chega direto no
          e-mail.
        </p>

        <div className="mt-8 flex justify-center">
          <PrimaryCTA>Garantir minha vaga</PrimaryCTA>
        </div>

        <Link
          to="/"
          className="mt-10 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a home
        </Link>
      </section>

      <SiteFooter />

      <WhatsAppFab message="Olá! Quero garantir minha inscrição no Mês da Juventude IDB e preciso de ajuda." />
    </div>
  );
}
