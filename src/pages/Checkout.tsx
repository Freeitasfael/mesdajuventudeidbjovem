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
import { SiteHeader } from "@/components/SiteHeader";
import { toast } from "sonner";
import { Clock, Search, CheckCircle2, XCircle, Loader2 } from "lucide-react";

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
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("E-mail inválido")
    .max(180),
});

type FormData = z.infer<typeof Schema>;

const Checkout = () => {
  const navigate = useNavigate();
  const { selected } = useSelection();
  const [pricePerNumber, setPricePerNumber] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Referral (código numérico apenas)
  const [hasReferral, setHasReferral] = useState(false);
  const [refInput, setRefInput] = useState("");
  const [refValidating, setRefValidating] = useState(false);
  const [refResult, setRefResult] = useState<
    | { ok: true; name: string; ref_code: string }
    | { ok: false; message: string }
    | null
  >(null);

  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "", phone: "", email: "" },
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

  // Auto-validate referral code (debounced)
  useEffect(() => {
    if (!hasReferral) {
      setRefResult(null);
      return;
    }
    const code = refInput.trim();
    if (code.length < 3) {
      setRefResult(null);
      return;
    }
    let cancelled = false;
    setRefValidating(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("validate_referral_code", {
        _code: code,
      });
      if (cancelled) return;
      setRefValidating(false);
      if (error) {
        setRefResult({ ok: false, message: "Erro ao validar código" });
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row && row.name) {
        setRefResult({ ok: true, name: row.name, ref_code: row.ref_code });
        toast.success(`Este código pertence a: ${row.name}`);
      } else {
        setRefResult({ ok: false, message: "Código não encontrado" });
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [refInput, hasReferral]);

  const totalCents = pricePerNumber ? pricePerNumber * selected.length : 0;

  const onSubmit = async (data: FormData) => {
    if (hasReferral && refInput.trim() && (!refResult || !refResult.ok)) {
      toast.error("Código de indicação inválido. Corrija ou desmarque a opção.");
      return;
    }
    setSubmitting(true);
    const phone = data.phone.replace(/\D/g, "");
    const validRef = hasReferral && refResult && refResult.ok ? refResult.ref_code : null;

    const { data: result, error } = await supabase.functions.invoke(
      "reserve-numbers",
      {
        body: {
          name: data.name.trim(),
          phone,
          email: data.email.trim().toLowerCase(),
          numbers: selected,
          ref_code: validRef,
          ref_input: null,
        },
      },
    );

    setSubmitting(false);

    if (error) {
      console.log("[Checkout] invoke error", error);
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
      } catch { /* ignore */ }
      toast.error(message);
      return;
    }

    if (!result?.order_id) {
      toast.error("Resposta inválida do servidor.");
      return;
    }

    try { localStorage.setItem("rifa.last_phone", phone); } catch { /* ignore */ }
    toast.success("Números reservados! Você tem 10 minutos para pagar.");
    navigate(`/pagamento/${result.order_id}`);
  };

  if (selected.length === 0) return null;

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader
        breadcrumbs={[
          { label: "Início", to: "/rifa" },
          { label: "Comprar números", to: "/rifa#rifa-grid" },
          { label: "Confirmar pedido" },
        ]}
      />

      <section className="container py-8 max-w-xl space-y-6">
        <h1 className="text-2xl font-bold">Confirmar pedido</h1>

        <div className="rounded-xl border-2 border-number-available/40 bg-number-available/10 p-4 text-sm text-foreground shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-number-available/20 p-2 text-number-available">
              <Clock className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-number-available">
                ⚠️ Atenção: seus números estão reservados por 10 minutos.
              </p>
              <p className="text-sm">
                Se você sair desta página, poderá retornar acessando o menu:{" "}
                <span className="font-semibold text-foreground">
                  Menu ☰ &gt; Consultar número
                </span>
                .
              </p>
            </div>
          </div>
        </div>

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

          {/* Indicação por código */}
          <div className="space-y-3 rounded-md border border-border p-3">
            <label className="flex items-start gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={hasReferral}
                onChange={(e) => {
                  setHasReferral(e.target.checked);
                  if (!e.target.checked) {
                    setRefInput("");
                    setRefResult(null);
                  }
                }}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span>
                Você recebeu indicação de alguém para comprar?
              </span>
            </label>

            {hasReferral && (
              <div className="space-y-2">
                <Label htmlFor="ref-input" className="text-xs">
                  Ele te informou um código? Digite abaixo para validar a indicação.
                </Label>
                <Input
                  id="ref-input"
                  type="text"
                  inputMode="text"
                  placeholder="Ex.: IDB001"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value.toUpperCase().slice(0, 32))}
                  maxLength={32}
                  className="font-mono tracking-wider"
                />
                {refValidating && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Validando código...
                  </p>
                )}
                {!refValidating && refResult?.ok && (
                  <div className="flex items-start gap-2 rounded-md border border-number-available/40 bg-number-available/10 p-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-number-available" />
                    <p>
                      Este código pertence a:{" "}
                      <strong>{refResult.name}</strong>
                    </p>
                  </div>
                )}
                {!refValidating && refResult && refResult.ok === false && refInput.trim().length >= 3 && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <p>{refResult.message}</p>
                  </div>
                )}
              </div>
            )}
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
