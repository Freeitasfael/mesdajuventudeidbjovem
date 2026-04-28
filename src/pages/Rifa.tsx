import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RaffleGrid } from "@/components/RaffleGrid";
import { Button } from "@/components/ui/button";
import { Handshake } from "lucide-react";

const REF_STORAGE_KEY = "raffle_ref_code";

const Rifa = () => {
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState("Rifa Digital");
  const [pricePerNumber, setPricePerNumber] = useState<number | null>(null);
  const [sellerName, setSellerName] = useState<string | null>(null);

  // Capture ?ref=CODE and persist; lookup seller name
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem(REF_STORAGE_KEY, ref);
      console.log("[Rifa] ref_code captured:", ref);
    }
    const stored = ref ?? localStorage.getItem(REF_STORAGE_KEY);
    if (!stored) return;
    supabase
      .rpc("get_seller_by_ref", { _ref_code: stored })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : null;
        if (row?.name) setSellerName(row.name);
      });
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
        <div className="container flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:py-8">
          <div>
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
            {sellerName && (
              <p className="mt-2 text-xs text-muted-foreground">
                Indicado por <span className="font-semibold text-foreground">{sellerName}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="default" asChild>
              <Link to="/afiliacao">
                <Handshake className="mr-2 h-4 w-4" /> Afiliação
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-primary/5">
        <div className="container flex flex-col items-start gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Quer se tornar um revendedor e ganhar com cada número vendido?
          </p>
          <Link
            to="/afiliacao"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Clique aqui para participar →
          </Link>
        </div>
      </div>

      <section className="container py-8">
        <RaffleGrid pricePerNumber={pricePerNumber} />
      </section>

      <footer className="container py-8 text-center text-xs text-muted-foreground">
        Sistema de rifa automatizado · Pagamento seguro via PIX
      </footer>
    </main>
  );
};

export default Rifa;
