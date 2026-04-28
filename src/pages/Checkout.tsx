import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSelection } from "@/hooks/useSelection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const REF_STORAGE_KEY = "raffle_ref_code";

const Schema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo")
    .max(120)
    .refine((v) => v.trim().split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10,11}$/, "Telefone deve conter 10 ou 11 dígitos (DDD + número)"),
});

type FormData = z.infer<typeof Schema>;

const Checkout = () => {
  const navigate = useNavigate();
  const { selected } = useSelection();
  const [pricePerNumber, setPricePerNumber] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "", phone: "" },
  });

  useEffect(() => {
    document.title = "Checkout — Rifa Digital";
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "price_per_number_cents")
        .maybeSingle();
      if (data && typeof data.value === "number") setPricePerNumber(data.value);
    };
    load();
  }, []);

  // Bounce back if no selection
  useEffect(() => {
    if (selected.length === 0) navigate("/rifa", { replace: true });
  }, [selected.length, navigate]);

  const totalCents = pricePerNumber ? pricePerNumber * selected.length : 0;

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    const ref_code = localStorage.getItem(REF_STORAGE_KEY) || null;
    const phone = data.phone.replace(/\D/g, "");

    const { data: result, error } = await supabase.functions.invoke(
      "reserve-numbers",
      {
        body: {
          name: data.name.trim(),
          phone,
          numbers: selected,
          ref_code,
        },
      },
    );

    setSubmitting(false);

    if (error) {
      console.log("[Checkout] invoke error", error);
      // Edge function returns useful body on error
      const ctx = (error as { context?: Response }).context;
      let message = "Não foi possível reservar. Tente novamente.";
      try {
        const body = ctx ? await ctx.json() : null;
        if (body?.error === "numbers_unavailable") {
          message = "Alguns números acabaram de ser reservados. Atualize e tente outros.";
        } else if (body?.error === "invalid_buyer") {
          message = body.message ?? "Dados inválidos.";
        } else if (body?.error === "invalid_input") {
          message = "Verifique os dados informados.";
        }
      } catch {
        // ignore
      }
      toast.error(message);
      return;
    }

    if (!result?.order_id) {
      toast.error("Resposta inválida do servidor.");
      return;
    }

    toast.success("Números reservados! Você tem 10 minutos para pagar.");
    navigate(`/pagamento/${result.order_id}`);
  };

  if (selected.length === 0) return null;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <Link to="/rifa" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar para rifa
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Confirmar pedido</h1>
        </div>
      </header>

      <section className="container py-8 max-w-xl space-y-8">
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Resumo
          </h2>
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              {selected.length}{" "}
              {selected.length === 1 ? "número escolhido" : "números escolhidos"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center justify-center min-w-[2.5rem] h-9 px-2 rounded-md bg-primary text-primary-foreground font-mono text-sm font-semibold"
                >
                  {n.toString().padStart(3, "0")}
                </span>
              ))}
            </div>
          </div>
          {pricePerNumber !== null && (
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold">
                R$ {(totalCents / 100).toFixed(2).replace(".", ",")}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              type="text"
              placeholder="Maria Silva"
              autoComplete="name"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (WhatsApp)</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="11987654321"
              autoComplete="tel"
              {...form.register("phone")}
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 11);
                form.setValue("phone", onlyDigits, { shouldValidate: true });
              }}
            />
            {form.formState.errors.phone && (
              <p className="text-xs text-destructive">
                {form.formState.errors.phone.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Apenas números, com DDD. Ex: 11987654321
            </p>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? "Reservando..." : "Reservar e ir para pagamento"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Os números ficam reservados por 10 minutos.
          </p>
        </form>
      </section>
    </main>
  );
};

export default Checkout;
