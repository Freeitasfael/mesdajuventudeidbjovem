import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Instagram, MapPin, ArrowRight, Shield, Heart, Ticket } from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/SiteHeader";
import heroBg from "@/assets/hero-rifa-bg.jpg";
import logoIdb from "@/assets/idb-jovem-logo.png";
import modeloImg from "@/assets/modelo-camiseta-pulseira.png.asset.json";


export default function Entrada() {
  const [open, setOpen] = useState(false);

  const buy = () => setOpen(true);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "hsl(var(--hero-bg))" }}
    >
      <Toaster position="top-center" richColors theme="dark" />

      {/* Nav */}
      <header
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md border-b"
        style={{
          backgroundColor: "hsl(var(--hero-bg) / 0.75)",
          borderColor: "hsl(var(--hero-gold) / 0.15)",
        }}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoIdb} alt="IDB Jovem" className="h-10 w-auto" />
            <span className="font-extrabold tracking-wider uppercase text-sm hidden sm:inline">
              Mês da Juventude
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/rifa"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold uppercase tracking-wider border transition hover:bg-white/10"
              style={{
                borderColor: "hsl(var(--hero-gold) / 0.4)",
                color: "hsl(var(--hero-gold))",
              }}
            >
              <Ticket className="h-3.5 w-3.5" />
              Rifa
            </a>
            <Button
              onClick={() => scrollTo("comprar")}
              size="sm"
              className="rounded-full font-extrabold uppercase tracking-wider"
              style={{
                backgroundColor: "hsl(var(--hero-gold))",
                color: "hsl(var(--hero-bg))",
              }}
            >
              Comprar
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28"
        aria-label="Mês da Juventude"
      >
        {/* Background */}
        <div className="absolute inset-0">
          <img
            src={heroBg}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-60"
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

        <div className="relative container mx-auto px-4 text-center">
          <div className="animate-fade-in flex justify-center mb-6">
            <img
              src={logoIdb}
              alt="IDB Jovem Oficial"
              className="h-auto w-44 sm:w-56 lg:w-72"
              style={{
                backgroundColor: "transparent",
                filter: "drop-shadow(0 8px 24px hsl(var(--hero-gold) / 0.35))",
              }}
            />
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] mb-6 animate-fade-in"
            style={{
              borderColor: "hsl(var(--hero-gold) / 0.4)",
              color: "hsl(var(--hero-gold))",
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Evento especial 2026
          </div>

          <h1 className="animate-fade-in-up text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[0.95] tracking-tight mb-6">
            ADQUIRA SUA
            <br />
            <span className="text-glow-gold" style={{ color: "hsl(var(--hero-gold))" }}>
              CAMISA OFICIAL
            </span>
          </h1>

          <p className="animate-fade-in max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-white/85 mb-10">
            A camisa oficial do <span className="font-semibold text-white">Mês da Juventude</span> é a sua
            forma de fazer parte desse momento especial de celebração, comunhão e fé.{" "}
            <span
              className="font-extrabold tracking-wide"
              style={{ color: "hsl(var(--hero-gold))" }}
            >
              JESUS TRANSFORMA!
            </span>
          </p>

          <Button
            onClick={() => scrollTo("comprar")}
            size="lg"
            className="h-14 px-8 text-base rounded-2xl font-extrabold uppercase tracking-wider shadow-gold-glow transition-all hover:scale-[1.02] hover:brightness-110"
            style={{
              backgroundColor: "hsl(var(--hero-gold))",
              color: "hsl(var(--hero-bg))",
            }}
          >
            Comprar agora <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          {/* Trust */}
          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-white/85">
            <li className="inline-flex items-center gap-2">
              <Shield className="h-4 w-4" style={{ color: "hsl(var(--hero-gold))" }} />
              Pagamento seguro via Pix
            </li>
            <li className="inline-flex items-center gap-2">
              <Heart className="h-4 w-4" style={{ color: "hsl(var(--hero-gold))" }} />
              Camisa oficial garantida
            </li>
            <li className="inline-flex items-center gap-2">
              <Heart className="h-4 w-4" style={{ color: "hsl(var(--hero-gold))" }} />
              100% para o evento
            </li>
          </ul>
        </div>
      </section>

      {/* Sobre */}
      <section className="py-20 md:py-28 relative">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <span
            className="text-xs font-extrabold tracking-[0.3em] uppercase"
            style={{ color: "hsl(var(--hero-gold))" }}
          >
            Sobre o evento
          </span>
          <h2 className="font-extrabold text-4xl md:text-5xl mt-3 mb-6 tracking-tight uppercase">
            Uma experiência{" "}
            <span className="text-glow-gold" style={{ color: "hsl(var(--hero-gold))" }}>
              inesquecível
            </span>
          </h2>
          <p className="text-lg text-white/75 leading-relaxed">
            O Mês da Juventude é um evento especial preparado para reunir jovens em momentos de
            alegria, comunhão, fé, amizade e celebração. Garanta sua camisa oficial e venha
            fazer parte dessa experiência inesquecível.
          </p>
        </div>
      </section>

      {/* Comprar */}
      <section
        id="comprar"
        className="py-20 md:py-28 relative"
        style={{ backgroundColor: "hsl(var(--hero-bg-deep))" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, hsl(var(--hero-gold) / 0.12), transparent 60%)",
          }}
        />
        <div className="relative container mx-auto px-4">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-stretch">
            {/* Coluna esquerda — conteúdo + card */}
            <div className="order-2 lg:order-1">
              <div className="text-center lg:text-left mb-10 relative">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-6 -z-10 blur-3xl opacity-60"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, hsl(0 0% 0% / 0.9), transparent 70%)",
                  }}
                />
                <span
                  className="text-xs font-extrabold tracking-[0.3em] uppercase"
                  style={{ color: "hsl(var(--hero-gold))" }}
                >
                  Adquira a sua
                </span>
                <h2 className="font-extrabold text-4xl md:text-5xl mt-3 tracking-tight uppercase">
                  Camisa Oficial
                </h2>
              </div>

              <div className="max-w-md mx-auto lg:mx-0">
                {/* Card único — Camiseta Oficial */}
                <div
                  className="relative rounded-3xl p-8 border-2 backdrop-blur-md flex flex-col"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderColor: "hsl(var(--hero-gold))",
                    boxShadow:
                      "0 0 0 1px hsl(var(--hero-gold) / 0.4), 0 0 40px hsl(var(--hero-gold) / 0.35), 0 0 90px hsl(var(--hero-gold) / 0.2)",
                  }}
                >
                  <h3 className="font-extrabold text-2xl mb-2 uppercase tracking-wide">
                    Camisa Oficial
                  </h3>
                  <p className="text-white/70 mb-6">
                    Garanta sua camisa oficial do Mês da Juventude.
                  </p>
                  <ul className="space-y-2 mb-8 text-sm text-white/85">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4" style={{ color: "hsl(var(--hero-gold))" }} /> Camisa
                      oficial do evento
                    </li>
                  </ul>
                  <div className="mt-auto">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60 mb-1">
                      Por apenas
                    </p>
                    <div className="mb-6 flex items-baseline gap-1">
                      <span
                        className="text-6xl font-extrabold text-glow-gold leading-none"
                        style={{ color: "hsl(var(--hero-gold))" }}
                      >
                        R$ 60
                      </span>
                      <span className="text-white/60 text-xl font-bold">,00</span>
                    </div>
                    <Button
                      onClick={buy}
                      size="lg"
                      className="w-full h-12 rounded-2xl font-extrabold uppercase tracking-wider shadow-xl hover:scale-[1.02] hover:brightness-110 transition-all"
                      style={{
                        backgroundColor: "hsl(var(--hero-gold))",
                        color: "hsl(var(--hero-bg))",
                      }}
                    >
                      Comprar agora
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-center lg:text-left text-sm text-white/60 mt-10">
                Pagamento via{" "}
                <strong className="text-white">Pix</strong> ou{" "}
                <strong className="text-white">cartão</strong> · Confirmação automática
              </p>
            </div>

            {/* Coluna direita — Imagem do modelo */}
            <div className="order-1 lg:order-2 relative flex justify-center lg:justify-end">
              <div
                className="relative w-full max-w-[360px] lg:max-w-[420px] aspect-[441/753] rounded-3xl overflow-hidden border"
                style={{
                  borderColor: "hsl(var(--hero-gold) / 0.2)",
                  backgroundColor: "hsl(var(--hero-bg-deep))",
                }}
              >
                <img
                  src={modeloImg.url}
                  alt="Modelo vestindo a camiseta oficial do evento Mês da Juventude"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />

                {/* Gradiente de integração (direita -> esquerda escuro) */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to left, transparent 45%, hsl(0 0% 0% / 0.5) 88%, hsl(0 0% 0% / 0.9) 100%)",
                  }}
                />
                {/* Gradiente inferior sutil */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-28 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, hsl(0 0% 0% / 0.75), transparent)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* Footer */}
      <footer
        className="py-12 border-t"
        style={{
          backgroundColor: "hsl(var(--hero-bg-deep))",
          borderColor: "hsl(var(--hero-gold) / 0.15)",
        }}
      >
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <img src={logoIdb} alt="IDB Jovem" className="h-16 w-auto mb-3" />
              <p className="text-sm text-white/60">Garanta sua camisa oficial!</p>
            </div>
            <div>
              <h4
                className="font-extrabold mb-3 uppercase tracking-wider text-sm"
                style={{ color: "hsl(var(--hero-gold))" }}
              >
                Siga nas redes
              </h4>
              <a
                href="https://instagram.com/idbjovemminas"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition"
              >
                <span
                  className="w-10 h-10 rounded-full flex items-center justify-center transition border"
                  style={{
                    borderColor: "hsl(var(--hero-gold) / 0.3)",
                    backgroundColor: "rgba(255,255,255,0.04)",
                  }}
                >
                  <Instagram
                    className="h-4 w-4"
                    style={{ color: "hsl(var(--hero-gold))" }}
                  />
                </span>
                @idbjovemminas
              </a>
            </div>
            <div>
              <h4
                className="font-extrabold mb-3 uppercase tracking-wider text-sm"
                style={{ color: "hsl(var(--hero-gold))" }}
              >
                Local e data
              </h4>
              <p className="text-sm text-white/70 flex items-start gap-2">
                <MapPin
                  className="h-4 w-4 mt-0.5 flex-shrink-0"
                  style={{ color: "hsl(var(--hero-gold))" }}
                />
                <span>
                  Portão 6 — Estádio João Havelange, Uberlândia
                  <br />
                  18 de julho de 2026
                </span>
              </p>
            </div>
          </div>
          <div
            className="border-t pt-6 text-center text-xs text-white/50"
            style={{ borderColor: "hsl(var(--hero-gold) / 0.1)" }}
          >
            © {new Date().getFullYear()} Mês da Juventude · IDB Jovem. Todos os direitos
            reservados.
          </div>
        </div>
      </footer>

      <PurchaseDialog open={open} onOpenChange={setOpen} initialOption="kit" />
    </div>
  );
}
