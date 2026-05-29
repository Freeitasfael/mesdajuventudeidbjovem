import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Instagram, MapPin, ArrowRight } from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import { Toaster } from "@/components/ui/sonner";
import logo from "@/assets/logo-jovem.png";

export default function Entrada() {
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState<"pulseira" | "kit">("pulseira");

  const buy = (opt: "pulseira" | "kit") => {
    setOption(opt);
    setOpen(true);
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-center" richColors />

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Jovem & Teens" className="h-10 w-auto" />
            <span className="font-bold text-lg hidden sm:inline">Mês da Juventude</span>
          </div>
          <Button onClick={() => scrollTo("comprar")} size="sm" className="rounded-full">Comprar</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary text-primary-foreground">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-accent/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-secondary/40 blur-3xl" />
        <div className="relative container mx-auto px-4 text-center">
          <img
            src={logo}
            alt="Jovem & Teens"
            className="mx-auto h-32 md:h-44 w-auto mb-6 drop-shadow-2xl"
          />
          <div className="inline-flex items-center gap-2 rounded-full bg-background/20 backdrop-blur px-4 py-1.5 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" /> Evento especial 2026
          </div>
          <h1 className="font-bold text-5xl md:text-7xl lg:text-8xl leading-[0.95] mb-6 tracking-tight">
            Mês da<br />Juventude
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto opacity-95 mb-10">
            Garanta sua entrada e participe desse momento especial de celebração, comunhão e juventude!
          </p>
          <Button
            onClick={() => scrollTo("comprar")}
            size="lg"
            className="h-14 px-8 text-base rounded-full bg-background text-foreground hover:bg-background/90 shadow-2xl"
          >
            Comprar agora <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Sobre */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <span className="text-sm font-semibold tracking-widest text-primary uppercase">Sobre o evento</span>
          <h2 className="font-bold text-4xl md:text-5xl mt-3 mb-6 tracking-tight">
            Uma experiência <span className="text-primary">inesquecível</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            O Mês da Juventude é um evento especial preparado para reunir jovens em momentos de alegria,
            comunhão, fé, amizade e celebração. Garanta sua pulseira de acesso e venha fazer parte dessa
            experiência inesquecível.
          </p>
        </div>
      </section>

      {/* Comprar */}
      <section id="comprar" className="py-20 md:py-28 bg-accent/40">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold tracking-widest text-primary uppercase">Garanta o seu</span>
            <h2 className="font-bold text-4xl md:text-5xl mt-3 tracking-tight">Escolha sua opção</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Card 1 */}
            <div className="relative bg-card rounded-3xl p-8 shadow-lg border-2 border-border flex flex-col">
              <h3 className="font-bold text-2xl mb-2">Pulseira de Acesso</h3>
              <p className="text-muted-foreground mb-6">Garanta sua entrada para o evento do Mês da Juventude.</p>
              <ul className="space-y-2 mb-8 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Acesso ao evento</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Pulseira oficial</li>
              </ul>
              <div className="mt-auto">
                <div className="mb-6">
                  <span className="text-5xl font-bold text-primary">R$ 15</span>
                  <span className="text-muted-foreground">,00</span>
                </div>
                <Button onClick={() => buy("pulseira")} size="lg" variant="outline" className="w-full h-12 rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                  Comprar Pulseira
                </Button>
              </div>
            </div>

            {/* Card 2 — destaque */}
            <div className="relative bg-card rounded-3xl p-8 shadow-2xl border-2 border-primary flex flex-col md:scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase px-4 py-1.5 rounded-full shadow-lg">
                ★ Mais completo
              </div>
              <h3 className="font-bold text-2xl mb-2">Kit Pulseira + Camiseta</h3>
              <p className="text-muted-foreground mb-6">Receba sua pulseira de acesso e a camiseta oficial do Mês da Juventude.</p>
              <ul className="space-y-2 mb-8 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Acesso ao evento</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Pulseira oficial</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Camiseta oficial do evento</li>
              </ul>
              <div className="mt-auto">
                <div className="mb-6">
                  <span className="text-5xl font-bold text-primary">R$ 60</span>
                  <span className="text-muted-foreground">,00</span>
                </div>
                <Button onClick={() => buy("kit")} size="lg" className="w-full h-12 rounded-full">
                  Comprar Kit
                </Button>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-10">
            Pagamento exclusivo via <strong className="text-foreground">Pix</strong> · Confirmação pelo WhatsApp
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <img src={logo} alt="Jovem & Teens" className="h-16 w-auto mb-3 brightness-0 invert" />
              <p className="text-sm opacity-70">Garanta sua pulseira e participe!</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Siga nas redes</h4>
              <a
                href="https://instagram.com/idbjovemminas"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm opacity-90 hover:opacity-100 transition"
              >
                <span className="w-10 h-10 rounded-full bg-background/10 hover:bg-background/20 flex items-center justify-center transition">
                  <Instagram className="h-4 w-4" />
                </span>
                @idbjovemminas
              </a>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Local e data</h4>
              <p className="text-sm opacity-70 flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Portão 6 — Estádio João Havelange, Uberlândia<br />18 de julho de 2026</span>
              </p>
            </div>
          </div>
          <div className="border-t border-background/10 pt-6 text-center text-xs opacity-60">
            © {new Date().getFullYear()} Mês da Juventude. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      <PurchaseDialog open={open} onOpenChange={setOpen} initialOption={option} />
    </div>
  );
}
