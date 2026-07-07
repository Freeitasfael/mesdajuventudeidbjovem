import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSelection } from "@/hooks/useSelection";
import { AlertTriangle, X, Trash2, Shuffle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type NumberStatus = "available" | "reserved" | "paid";

interface RaffleNumber {
  number: number;
  status: NumberStatus;
}

export const RaffleGrid = () => {
  const { selected, toggle } = useSelection();
  const [numbers, setNumbers] = useState<RaffleNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Popup for already-reserved number selection
  const [blockedPopup, setBlockedPopup] = useState<{
    number: number;
    status: NumberStatus;
    isInSelection: boolean;
  } | null>(null);

  // Busca por número
  const [search, setSearch] = useState("");



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

  // Filtra por número digitado (aceita "7", "07", "007" — casa por inclusão)
  const filteredNumbers = useMemo(() => {
    const q = search.replace(/\D/g, "");
    if (!q) return numbers;
    const qNum = parseInt(q, 10);
    return numbers.filter((n) => {
      if (n.number === qNum) return true;
      const padded = n.number.toString().padStart(3, "0");
      return padded.includes(q) || n.number.toString().includes(q);
    });
  }, [numbers, search]);

  // O(1) lookup do estado de seleção — antes era O(n) por botão = O(n²) por render
  const selectedSet = useMemo(() => new Set(selected), [selected]);

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

  const showBlockedPopup = useCallback(
    (n: RaffleNumber) =>
      setBlockedPopup({
        number: n.number,
        status: n.status,
        isInSelection: selectedSet.has(n.number),
      }),
    [selectedSet],
  );

  const handleNumberClick = useCallback(
    (n: RaffleNumber) => {
      if (n.status === "available") {
        toggle(n.number);
        return;
      }
      showBlockedPopup(n);
    },
    [toggle, showBlockedPopup],
  );

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
    <div className="space-y-4">

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
          {numbers.map((n) => (
            <NumberButton
              key={n.number}
              n={n}
              isSelected={selectedSet.has(n.number)}
              onClick={handleNumberClick}
            />
          ))}
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

// Botão memoizado — só re-renderiza quando o próprio número muda de estado
// ou de seleção, evitando re-render dos 1000+ botões a cada toggle.
type NumberButtonProps = {
  n: RaffleNumber;
  isSelected: boolean;
  onClick: (n: RaffleNumber) => void;
};

const NumberButton = memo(
  ({ n, isSelected, onClick }: NumberButtonProps) => (
    <button
      onClick={() => onClick(n)}
      className={cn(
        "aspect-square rounded-lg text-[11px] sm:text-xs font-bold tabular-nums tracking-tight",
        "select-none shadow-sm will-change-transform",
        "flex items-center justify-center relative",
        "transition-[transform,background-color,box-shadow] duration-200 ease-out",
        "active:scale-95 active:duration-100",
        n.status === "available" &&
          !isSelected &&
          "bg-number-available text-number-available-foreground border border-number-available-border hover:bg-number-available-hover hover:scale-105 hover:shadow-md cursor-pointer",
        n.status === "available" &&
          isSelected &&
          "scale-105 cursor-pointer animate-scale-in",
        n.status === "reserved" &&
          "bg-number-reserved text-number-reserved-foreground cursor-not-allowed opacity-90",
        n.status === "paid" &&
          "bg-number-paid text-number-paid-foreground cursor-not-allowed opacity-80 line-through decoration-2 decoration-number-paid-foreground/70",
      )}
      style={
        n.status === "available" && isSelected
          ? {
              backgroundColor: "hsl(var(--hero-gold))",
              color: "hsl(var(--hero-bg))",
              boxShadow: "0 0 12px rgba(212, 175, 55, 0.6)",
            }
          : undefined
      }
      aria-label={`Número ${n.number} - ${n.status}`}
      aria-pressed={isSelected}
    >
      {n.number.toString().padStart(3, "0")}
    </button>
  ),
  (prev, next) =>
    prev.n.number === next.n.number &&
    prev.n.status === next.n.status &&
    prev.isSelected === next.isSelected &&
    prev.onClick === next.onClick,
);
NumberButton.displayName = "NumberButton";
