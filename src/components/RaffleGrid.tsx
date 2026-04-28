import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type NumberStatus = "available" | "reserved" | "paid";

interface RaffleNumber {
  number: number;
  status: NumberStatus;
}

export const RaffleGrid = () => {
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
          console.log("[RaffleGrid] realtime", payload);
          const next = (payload.new ?? payload.old) as RaffleNumber | null;
          if (!next) return;
          setNumbers((prev) =>
            prev.map((n) =>
              n.number === next.number
                ? { number: next.number, status: next.status }
                : n
            )
          );
        }
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

  const handleClick = (n: RaffleNumber) => {
    if (n.status !== "available") return;
    toast.info("Checkout disponível em breve", {
      description: `Número ${n.number.toString().padStart(3, "0")} selecionado.`,
    });
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm">
        <LegendDot className="bg-number-available" label={`Disponíveis (${counts.available})`} />
        <LegendDot className="bg-number-reserved" label={`Reservados (${counts.reserved})`} />
        <LegendDot className="bg-number-paid" label={`Pagos (${counts.paid})`} />
      </div>

      {loading ? (
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {Array.from({ length: 60 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {numbers.map((n) => (
            <button
              key={n.number}
              onClick={() => handleClick(n)}
              disabled={n.status !== "available"}
              className={cn(
                "aspect-square rounded-md font-mono text-xs sm:text-sm font-semibold",
                "transition-all duration-150 select-none",
                "flex items-center justify-center",
                n.status === "available" &&
                  "bg-number-available text-number-available-foreground hover:bg-number-available-hover hover:scale-105 active:scale-95 cursor-pointer",
                n.status === "reserved" &&
                  "bg-number-reserved text-number-reserved-foreground cursor-not-allowed opacity-90",
                n.status === "paid" &&
                  "bg-number-paid text-number-paid-foreground cursor-not-allowed opacity-90"
              )}
              aria-label={`Número ${n.number} - ${n.status}`}
            >
              {n.number.toString().padStart(3, "0")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const LegendDot = ({ className, label }: { className: string; label: string }) => (
  <div className="flex items-center gap-2">
    <span className={cn("h-3 w-3 rounded-sm", className)} />
    <span className="text-muted-foreground">{label}</span>
  </div>
);
