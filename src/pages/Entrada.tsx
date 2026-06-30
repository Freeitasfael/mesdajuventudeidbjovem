import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Instagram, MapPin, ArrowRight, Shield, Heart, Ticket } from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import heroBg from "@/assets/hero-rifa-bg.jpg";
import logoIdb from "@/assets/idb-jovem-logo.png";
import modeloImg from "@/assets/modelo-camiseta-pulseira.png.asset.json";
import camisetaCostasImg from "@/assets/camiseta-costas-jesus-never-changes.jpeg.asset.json";


export default function Entrada() {
  const [open, setOpen] = useState(false);
  const [frenteLoaded, setFrenteLoaded] = useState(false);
  const [costasLoaded, setCostasLoaded] = useState(false);

  // Pré-carregamento das imagens da camiseta (reduz flicker na 1ª visita)
  useEffect(() => {
    const urls = [modeloImg.url, camisetaCostasImg.url];
    const links: HTMLLinkElement[] = urls.map((href) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      link.fetchPriority = "high" as any;
      document.head.appendChild(link);
      return link;
    });
    // Dispara também o decode via Image() — popula o cache do navegador
    urls.forEach((href) => {
      const img = new Image();
      img.decoding = "async";
      img.src = href;
    });
    return () => {
      links.forEach((l) => l.parentNode?.removeChild(l));
    };
  }, []);

  const buy = () => setOpen(true);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });


  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "hsl(var(--hero-bg))" }}
    >
      <Toaster position="top-center" richColors theme="dark" />

      <SiteHeader variant="dark" />

      {/* Hero */}
      <section
        className="relative overflow-hidden pb-20 pt-12 md:pb-28 md:pt-16"
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
              CAMISETA OFICIAL
            </span>
          </h1>

          <p className="animate-fade-in max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-white/85 mb-10">
            A camiseta oficial do <span className="font-semibold text-white">Mês da Juventude</span> é a sua
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
              Camiseta oficial garantida
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
            alegria, comunhão, fé, amizade e celebração. Garanta sua camiseta oficial e venha
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
                  Camiseta Oficial
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
                    Camiseta Oficial
                  </h3>
                  <p className="text-white/70 mb-6">
                    Garanta sua camiseta oficial do Mês da Juventude.
                  </p>
                  <ul className="space-y-2 mb-8 text-sm text-white/85">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4" style={{ color: "hsl(var(--hero-gold))" }} /> Camiseta
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

            {/* Coluna direita — Showcase editorial das camisetas */}
            <div className="order-1 lg:order-2 relative">
              <div className="relative w-full max-w-[640px] mx-auto lg:mx-0 lg:ml-auto">
                {/* Tipografia ambiente ao fundo */}
                <div
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
                >
                  <span
                    className="leading-none whitespace-nowrap italic"
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "clamp(8rem, 22vw, 18rem)",
                      color: "hsl(var(--hero-gold))",
                      opacity: 0.05,
                      transform: "translateY(8%)",
                    }}
                  >
                    Estações
                  </span>
                </div>

                {/* Cantos dourados decorativos */}
                <div
                  aria-hidden
                  className="absolute -top-2 -right-2 w-20 h-20 border-t border-r pointer-events-none z-0"
                  style={{ borderColor: "hsl(var(--hero-gold) / 0.35)" }}
                />
                <div
                  aria-hidden
                  className="absolute -bottom-2 -left-2 w-20 h-20 border-b border-l pointer-events-none z-0"
                  style={{ borderColor: "hsl(var(--hero-gold) / 0.35)" }}
                />

                <div className="relative z-10 grid grid-cols-2 gap-4 sm:gap-6 md:gap-8 items-start">
                  {/* Frente */}
                  <figure
                    className="group relative animate-fade-in"
                    style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
                  >
                    <div
                      className="relative w-full aspect-[441/753] overflow-hidden transform-gpu [backface-visibility:hidden] motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:will-change-transform motion-safe:group-hover:-translate-y-1"
                      style={{
                        backgroundColor: "hsl(var(--hero-bg-deep))",
                        boxShadow:
                          "20px 24px 60px -20px rgba(0,0,0,0.65), 0 0 0 1px hsl(var(--hero-gold) / 0.12)",
                      }}
                    >
                      <img
                        src={modeloImg.url}
                        alt="Modelo vestindo a camiseta oficial Estações"
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover object-top transform-gpu [backface-visibility:hidden] motion-safe:transition-transform motion-safe:duration-[1200ms] motion-safe:ease-out motion-safe:will-change-transform motion-safe:group-hover:scale-[1.04]"
                      />
                      {/* Moldura dourada interna */}
                      <div
                        aria-hidden
                        className="absolute inset-2 border pointer-events-none"
                        style={{ borderColor: "hsl(var(--hero-gold) / 0.25)" }}
                      />
                      {/* Shimmer dourado */}
                      <div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none opacity-0 transform-gpu motion-safe:transition-opacity motion-safe:duration-700 motion-safe:group-hover:opacity-100"
                        style={{
                          background:
                            "linear-gradient(115deg, transparent 35%, hsl(var(--hero-gold) / 0.18) 50%, transparent 65%)",
                        }}
                      />

                      {/* Vinheta */}
                      <div
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(to top, hsl(0 0% 0% / 0.7), transparent)",
                        }}
                      />
                      {/* Label vertical */}
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 origin-center flex items-center gap-2 sm:gap-3">
                        <div
                          className="h-px w-5 sm:w-7"
                          style={{ backgroundColor: "hsl(var(--hero-gold))" }}
                        />
                        <span
                          className="text-[8px] sm:text-[9px] tracking-[0.4em] uppercase whitespace-nowrap"
                          style={{ color: "hsl(var(--hero-gold))" }}
                        >
                          Frente
                        </span>
                      </div>
                    </div>
                    <figcaption className="mt-5 hidden sm:block">
                      <h3
                        className="text-white text-2xl italic leading-tight"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                      >
                        Estações
                      </h3>
                      <p className="text-white/40 text-[10px] tracking-[0.25em] uppercase font-light mt-1">
                        Algodão Premium
                      </p>
                    </figcaption>
                  </figure>

                  {/* Costas — desencaixado para baixo */}
                  <figure
                    className="group relative mt-10 md:mt-20 animate-fade-in"
                    style={{ animationDelay: "260ms", animationFillMode: "backwards" }}
                  >
                    <div
                      className="relative w-full aspect-[441/753] overflow-hidden transform-gpu [backface-visibility:hidden] motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:will-change-transform motion-safe:group-hover:-translate-y-1"
                      style={{
                        backgroundColor: "hsl(var(--hero-bg-deep))",
                        boxShadow:
                          "20px 24px 60px -20px rgba(0,0,0,0.65), 0 0 0 1px hsl(var(--hero-gold) / 0.12)",
                      }}
                    >
                      <img
                        src={camisetaCostasImg.url}
                        alt="Costas da camiseta oficial com estampa Jesus never changes"
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover object-center transform-gpu [backface-visibility:hidden] motion-safe:transition-transform motion-safe:duration-[1200ms] motion-safe:ease-out motion-safe:will-change-transform motion-safe:group-hover:scale-[1.04]"
                      />
                      <div
                        aria-hidden
                        className="absolute inset-2 border pointer-events-none"
                        style={{ borderColor: "hsl(var(--hero-gold) / 0.25)" }}
                      />
                      <div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none opacity-0 transform-gpu motion-safe:transition-opacity motion-safe:duration-700 motion-safe:group-hover:opacity-100"
                        style={{
                          background:
                            "linear-gradient(115deg, transparent 35%, hsl(var(--hero-gold) / 0.18) 50%, transparent 65%)",
                        }}
                      />

                      <div
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(to top, hsl(0 0% 0% / 0.7), transparent)",
                        }}
                      />
                      <div className="absolute -right-1 top-1/2 -translate-y-1/2 rotate-90 origin-center flex items-center gap-2 sm:gap-3">
                        <div
                          className="h-px w-5 sm:w-7"
                          style={{ backgroundColor: "hsl(var(--hero-gold))" }}
                        />
                        <span
                          className="text-[8px] sm:text-[9px] tracking-[0.4em] uppercase whitespace-nowrap"
                          style={{ color: "hsl(var(--hero-gold))" }}
                        >
                          Costas
                        </span>
                      </div>
                    </div>
                    <figcaption className="mt-5 text-right hidden sm:flex flex-col items-end">
                      <p
                        className="text-white text-lg italic leading-snug"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                      >
                        “Jesus never changes.”
                      </p>
                      <div
                        className="h-px w-10 my-2"
                        style={{ backgroundColor: "hsl(var(--hero-gold) / 0.5)" }}
                      />
                      <p
                        className="text-[9px] tracking-[0.3em] uppercase"
                        style={{ color: "hsl(var(--hero-gold))" }}
                      >
                        Edição Limitada 2026
                      </p>
                    </figcaption>
                  </figure>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      <SiteFooter />

      <PurchaseDialog open={open} onOpenChange={setOpen} initialOption="kit" />

      <WhatsAppFab message="Olá! Quero comprar a camiseta oficial do Mês da Juventude IDB e preciso de ajuda." />
    </div>
  );
}
