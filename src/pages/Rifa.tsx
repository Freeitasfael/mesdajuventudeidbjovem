import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RaffleGrid } from "@/components/RaffleGrid";

const REF_STORAGE_KEY = "raffle_ref_code";

const Rifa = () => {
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState("Rifa Digital");
  const [pricePerNumber, setPricePerNumber] = useState<number | null>(null);

  // Capture ?ref=CODE and persist for checkout
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem(REF_STORAGE_KEY, ref);
      console.log("[Rifa] ref_code captured:", ref);
    }
  }, [searchParams]);

  // Load public settings
  useEffect(() => {
    document.title = "Rifa Digital — Escolha seu número";

    const loadSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["raffle_title", "price_per_number_cents"]);

      if (error) {
        console.log("[Rifa] settings error", error);
        return;
      }
      for (const row of data ?? []) {
        if (row.key === "raffle_title" && typeof row.value === "string") {
          setTitle(row.value);
          document.title = `${row.value} — Escolha seu número`;
        }
        if (row.key === "price_per_number_cents" && typeof row.value === "number") {
          setPricePerNumber(row.value);
        }
      }
    };
    loadSettings();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6 sm:py-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha seu número da sorte e pague via PIX.
            {pricePerNumber !== null && (
              <>
                {" "}
                <span className="font-medium text-foreground">
                  R$ {(pricePerNumber / 100).toFixed(2).replace(".", ",")}
                </span>{" "}
                por número.
              </>
            )}
          </p>
        </div>
      </header>

      <section className="container py-8">
        <RaffleGrid />
      </section>

      <footer className="container py-8 text-center text-xs text-muted-foreground">
        Sistema de rifa automatizado · Pagamento seguro via PIX
      </footer>
    </main>
  );
};

export default Rifa;
