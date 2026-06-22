import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserPlus, Sparkles } from "lucide-react";
import logoIdb from "@/assets/idb-jovem-logo.png";

export default function Inscricao() {
  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "hsl(var(--hero-bg))" }}
    >
      <SiteHeader variant="dark" />

      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <img
          src={logoIdb}
          alt="IDB Jovem"
          className="h-auto w-28 sm:w-36"
          style={{
            filter: "drop-shadow(0 8px 24px hsl(var(--hero-gold) / 0.35))",
          }}
        />

        <span
          className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.25em]"
          style={{
            borderColor: "hsl(var(--hero-gold) / 0.45)",
            color: "hsl(var(--hero-gold))",
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Inscrições · Mês da Juventude
        </span>

        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Em breve, as{" "}
          <span style={{ color: "hsl(var(--hero-gold))" }}>inscrições</span>{" "}
          serão abertas.
        </h1>
        <p className="mt-5 max-w-xl text-white/80 sm:text-lg">
          Estamos preparando tudo para a próxima edição. Enquanto isso, garanta
          sua participação pela rifa ou pela camiseta oficial.
        </p>

        <div
          className="mt-10 flex h-20 w-20 items-center justify-center rounded-3xl border"
          style={{
            backgroundColor: "hsl(var(--hero-gold) / 0.12)",
            borderColor: "hsl(var(--hero-gold) / 0.4)",
            color: "hsl(var(--hero-gold))",
          }}
        >
          <UserPlus className="h-9 w-9" />
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-13 rounded-2xl px-8 font-extrabold uppercase tracking-wider"
            style={{
              backgroundColor: "hsl(var(--hero-gold))",
              color: "hsl(var(--hero-bg))",
            }}
          >
            <Link to="/rifa">Ir para a rifa</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-13 rounded-2xl border-white/30 bg-white/5 px-8 font-extrabold uppercase tracking-wider text-white hover:bg-white/10"
          >
            <Link to="/camiseta">Comprar camiseta</Link>
          </Button>
        </div>

        <Link
          to="/"
          className="mt-10 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a home
        </Link>
      </section>
    </div>
  );
}
