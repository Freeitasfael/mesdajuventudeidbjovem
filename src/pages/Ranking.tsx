import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, ArrowLeft } from "lucide-react";

interface RankingRow {
  seller_id: string;
  seller_name: string;
  ref_code: string;
  total_numbers: number;
  total_cents: number;
  total_orders: number;
}

const formatBRL = (cents: number) =>
  `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

const Ranking = () => {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Ranking de Vendedores — Rifa Digital";

    const load = async () => {
      const { data, error } = await supabase.rpc("get_seller_ranking");
      if (error) {
        console.log("[Ranking] error", error);
      } else {
        setRows((data ?? []) as RankingRow[]);
      }
      setLoading(false);
    };

    load();
    const interval = setInterval(load, 30_000); // refresh a cada 30s
    return () => clearInterval(interval);
  }, []);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const medal = (pos: number) => {
    if (pos === 0) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (pos === 1) return <Medal className="h-6 w-6 text-gray-400" />;
    if (pos === 2) return <Award className="h-6 w-6 text-amber-700" />;
    return null;
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between py-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Ranking de Vendedores
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Classificação por valor arrecadado em pedidos pagos.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>
      </header>

      <section className="container py-8">
        {loading ? (
          <p className="text-center text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Nenhum vendedor cadastrado ainda.
          </Card>
        ) : (
          <>
            {podium.length > 0 && (
              <div className="mb-8 grid gap-4 sm:grid-cols-3">
                {podium.map((row, idx) => (
                  <Card
                    key={row.seller_id}
                    className="flex flex-col items-center gap-2 p-6 text-center"
                  >
                    {medal(idx)}
                    <p className="text-lg font-semibold">{row.seller_name}</p>
                    <p className="text-xs text-muted-foreground">
                      ref: {row.ref_code}
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {formatBRL(row.total_cents)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.total_numbers} números · {row.total_orders} pedidos
                    </p>
                  </Card>
                ))}
              </div>
            )}

            {rest.length > 0 && (
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Vendedor</th>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3 text-right">Números</th>
                      <th className="px-4 py-3 text-right">Pedidos</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((row, idx) => (
                      <tr key={row.seller_id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{idx + 4}</td>
                        <td className="px-4 py-3">{row.seller_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.ref_code}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.total_numbers}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.total_orders}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatBRL(row.total_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}
      </section>
    </main>
  );
};

export default Ranking;
