import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSelection } from "@/hooks/useSelection";

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
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm">
        <LegendDot className="bg-number-available" label={`Disponíveis (${counts.available})`} />
        <LegendDot className="bg-number-reserved" label={`Reservados (${counts.reserved})`} />
        <LegendDot className="bg-number-paid" label={`Pagos (${counts.paid})`} />
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
            const disabled = n.status !== "available";
            return (
              <button
                key={n.number}
                onClick={() => !disabled && toggle(n.number)}
                disabled={disabled}
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
                    "bg-number-reserved text-number-reserved-foreground cursor-not-allowed opacity-90",
                  n.status === "paid" &&
                    "bg-number-paid text-number-paid-foreground cursor-not-allowed opacity-90",
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

      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t z-40 animate-in slide-in-from-bottom-2"
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
                  <span
                    className="font-bold"
                    style={{ color: "hsl(var(--hero-gold))" }}
                  >
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
                Continuar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LegendDot = ({ className, label }: { className: string; label: string }) => (
  <div className="flex items-center gap-2">
    <span className={cn("h-3 w-3 rounded-sm", className)} />
    <span className="text-white/75">{label}</span>
  </div>
);
