import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSelection } from "@/hooks/useSelection";
import { AlertTriangle, X, Trash2, Shuffle } from "lucide-react";

type NumberStatus = "available" | "reserved" | "paid";

interface RaffleNumber {
  number: number;
  status: NumberStatus;
}

interface Props {
  pricePerNumber: number | null;
}

export const RaffleGrid = ({ pricePerNumber }: Props) => {
  const navigate = useNavigate();
  const { selected, toggle, clear } = useSelection();
  const [numbers, setNumbers] = useState<RaffleNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInlineVisible, setIsInlineVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Popup for already-reserved number selection
  const [blockedPopup, setBlockedPopup] = useState<{
    number: number;
    status: NumberStatus;
    isInSelection: boolean;
  } | null>(null);

  // Ref callback ensures the observer attaches as soon as the inline node mounts
  const inlineRefCallback = (node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInlineVisible(entry.isIntersecting),
      { threshold: 0.3 },
    );
    observer.observe(node);
    observerRef.current = observer;
  };

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);


  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("numbers")
      .select("number, status")
      .order("number", { ascending: true });
    if (error) {
      console.log("[RaffleGrid] load error", error);
      setError(error.message);
      setLoading(false);
      return;
    }
    setNumbers((data ?? []) as RaffleNumber[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("numbers-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "numbers" },
        (payload) => {
          const next = (payload.new ?? payload.old) as RaffleNumber | null;
          if (!next) return;
          setNumbers((prev) =>
            prev.map((n) =>
              n.number === next.number
                ? { number: next.number, status: next.status }
                : n,
            ),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const counts = useMemo(() => {
    const acc = { available: 0, reserved: 0, paid: 0 };
    for (const n of numbers) acc[n.status]++;
    return acc;
  }, [numbers]);

  // Drop selected numbers that are no longer available
  useEffect(() => {
    if (numbers.length === 0 || selected.length === 0) return;
    const stillAvailable = new Set(
      numbers.filter((n) => n.status === "available").map((n) => n.number),
    );
    const cleaned = selected.filter((n) => stillAvailable.has(n));
    if (cleaned.length !== selected.length) {
      localStorage.setItem("raffle_selection", JSON.stringify(cleaned));
      window.dispatchEvent(new CustomEvent("raffle-selection-change"));
    }
  }, [numbers, selected]);

  const totalCents = pricePerNumber ? pricePerNumber * selected.length : 0;

  const goToCheckout = () => {
    if (selected.length === 0) return;
    navigate("/checkout");
  };

  const handleNumberClick = (n: RaffleNumber) => {
    if (n.status === "available") {
      toggle(n.number);
      return;
    }
    // Show popup for reserved/paid numbers
    setBlockedPopup({
      number: n.number,
      status: n.status,
      isInSelection: selected.includes(n.number),
    });
  };

  const removeBlockedFromSelection = () => {
    if (blockedPopup) {
      toggle(blockedPopup.number);
    }
    setBlockedPopup(null);
  };

  const closeBlockedPopup = () => setBlockedPopup(null);


  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-destructive">Erro ao carregar: {error}</p>
        <button
          onClick={load}
          className="text-sm underline text-muted-foreground hover:text-foreground"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32 sm:pb-24">
      {/* Blocked number popup — fixed top */}
      {blockedPopup && (
        <div className="fixed top-0 left-0 right-0 z-[60] animate-fade-in-down">
          <div className="container pt-4">
            <div className="rounded-xl border-2 border-red-500 bg-red-950/90 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-red-500/20 p-2 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-red-100">
                    Número <span className="font-mono text-lg">{blockedPopup.number.toString().padStart(3, "0")}</span> já foi escolhido
                  </p>
                  <p className="mt-0.5 text-sm text-red-200/80">
                    Este número está <span className="font-semibold">{blockedPopup.status === "reserved" ? "reservado" : "pago"}</span> por outra pessoa. Escolha outro número disponível.
                  </p>
                  {blockedPopup.isInSelection && (
                    <p className="mt-1 text-xs text-red-300/70">
                      Esse número ainda consta na sua seleção atual porque foi reservado por você antes, mas agora não está mais disponível.
                    </p>
                  )}
                </div>
                <button
                  onClick={closeBlockedPopup}
                  className="rounded-full p-1.5 text-red-300 hover:bg-red-500/20 hover:text-red-100 transition-colors"
                  aria-label="Fechar aviso"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {blockedPopup.isInSelection && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={removeBlockedFromSelection}
                    className="border-red-400/50 bg-red-500/10 text-red-100 hover:bg-red-500/20 hover:text-white"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Excluir da minha seleção
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={closeBlockedPopup}
                  className="bg-red-600 text-white hover:bg-red-500 font-semibold"
                >
                  <Shuffle className="mr-1.5 h-4 w-4" />
                  Escolher outro número
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm">
        <LegendDot className="bg-number-available" label="Disponíveis" />
        <LegendDot className="bg-number-reserved" label="Reservados" />
        <LegendDot className="bg-number-paid" label="Pagos" />
      </div>

      {loading ? (
        <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1.5">
          {Array.from({ length: 96 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg bg-white/15" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1.5">
          {numbers.map((n) => {
            const isSelected = selected.includes(n.number);
            return (
              <button
                key={n.number}
                onClick={() => handleNumberClick(n)}
                className={cn(
                  "aspect-square rounded-lg text-[11px] sm:text-xs font-bold tabular-nums tracking-tight",
                  "transition-all duration-150 select-none shadow-sm",
                  "flex items-center justify-center relative",
                  n.status === "available" &&
                    !isSelected &&
                    "bg-number-available text-number-available-foreground hover:bg-number-available-hover hover:scale-110 hover:shadow-md active:scale-95 cursor-pointer",
                  n.status === "available" &&
                    isSelected &&
                    "scale-110 shadow-gold-glow cursor-pointer ring-2 ring-offset-2 ring-offset-transparent",
                  n.status === "reserved" &&
                    "bg-number-reserved text-number-reserved-foreground opacity-90",
                  n.status === "paid" &&
                    "bg-number-paid text-number-paid-foreground opacity-90",
                )}
                style={
                  n.status === "available" && isSelected
                    ? {
                        backgroundColor: "hsl(var(--hero-gold))",
                        color: "hsl(var(--hero-bg))",
                        boxShadow: "var(--shadow-gold-glow)",
                      }
                    : undefined
                }
                aria-label={`Número ${n.number} - ${n.status}`}
                aria-pressed={isSelected}
              >
                {n.number.toString().padStart(3, "0")}
              </button>
            );
          })}
        </div>
      )}

      {/* Inline payment bar (original) — always rendered, visibility controlled by selection */}
      <div
        ref={inlineRefCallback}
        aria-hidden={selected.length === 0}
        className={cn(
          "min-h-[120px] transition-opacity duration-200",
          selected.length > 0 ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <div
          className="rounded-xl border p-4 min-h-[110px] flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
          style={{
            backgroundColor: "hsl(var(--hero-bg) / 0.6)",
            borderColor: "hsl(var(--hero-gold) / 0.4)",
          }}
        >
          <div className="flex-1 min-w-0 text-white">
            <p className="text-sm font-medium">
              {selected.length}{" "}
              {selected.length === 1 ? "número selecionado" : "números selecionados"}
            </p>
            {pricePerNumber !== null && (
              <p className="text-xs text-white/70">
                Total:{" "}
                <span className="font-bold" style={{ color: "hsl(var(--hero-gold))" }}>
                  R$ {(totalCents / 100).toFixed(2).replace(".", ",")}
                </span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clear}
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Limpar
            </Button>
            <Button
              size="sm"
              onClick={goToCheckout}
              className="font-bold"
              style={{
                backgroundColor: "hsl(var(--hero-gold))",
                color: "hsl(var(--hero-bg))",
              }}
            >
              Ir para pagamento
            </Button>
          </div>
        </div>
      </div>

      {/* Fixed payment footer — always in DOM, visible only when selection exists AND inline is off-screen */}
      <div
        aria-hidden={!(selected.length > 0 && !isInlineVisible)}
        className={cn(
          "fixed bottom-0 left-0 right-0 border-t z-50 transition-opacity duration-200",
          selected.length > 0 && !isInlineVisible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        style={{
          backgroundColor: "hsl(var(--hero-bg) / 0.95)",
          borderColor: "hsl(var(--hero-gold) / 0.4)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="container py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 text-white">
            <p className="text-sm font-medium">
              {selected.length}{" "}
              {selected.length === 1 ? "número selecionado" : "números selecionados"}
            </p>
            {pricePerNumber !== null && (
              <p className="text-xs text-white/70">
                Total:{" "}
                <span className="font-bold" style={{ color: "hsl(var(--hero-gold))" }}>
                  R$ {(totalCents / 100).toFixed(2).replace(".", ",")}
                </span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clear}
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Limpar
            </Button>
            <Button
              size="sm"
              onClick={goToCheckout}
              className="font-bold"
              style={{
                backgroundColor: "hsl(var(--hero-gold))",
                color: "hsl(var(--hero-bg))",
              }}
            >
              Ir para pagamento
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};


const LegendDot = ({ className, label }: { className: string; label: string }) => (
  <div className="flex items-center gap-2">
    <span className={cn("h-3 w-3 rounded-sm", className)} />
    <span className="text-white/75">{label}</span>
  </div>
);
