import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { toast } from "sonner";
import {
  CheckCircle2,
  Handshake,
  Link2,
  Trophy,
  Sparkles,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const Schema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo")
    .max(120)
    .refine(
      (v) => v.trim().split(/\s+/).length >= 2,
      "Informe nome e sobrenome",
    ),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10,11}$/, "Telefone deve conter 10 ou 11 dígitos (DDD + número)"),
});

type FormData = z.infer<typeof Schema>;

const Afiliacao = () => {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Quero me afiliar — Rifa IDB Jovem";
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setAuthed(false);
        return;
      }
      // If already a seller, jump straight to dashboard
      const { data: existing } = await supabase
        .rpc("get_my_seller")
        .maybeSingle();
      if (existing) {
        navigate("/seller", { replace: true });
        return;
      }
      setAuthed(true);
    });
  }, [navigate]);

  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "", phone: "" },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    const { data: result, error } = await supabase.rpc("register_seller_self", {
      _name: data.name,
      _phone: data.phone,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message ?? "Não foi possível concluir o cadastro.");
      return;
    }
    const row = Array.isArray(result) ? result[0] : result;
    toast.success(`Afiliação concluída! Seu código: ${row?.ref_code}`);
    navigate("/seller", { replace: true });
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "hsl(var(--hero-bg))" }}
    >
      <SiteHeader
        variant="dark"
        breadcrumbs={[
          { label: "Início", to: "/rifa" },
          { label: "Quero me afiliar" },
        ]}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, hsl(var(--hero-gold) / 0.18), transparent 60%)",
          }}
        />
        <div className="container relative max-w-3xl py-16 text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.25em]"
            style={{
              borderColor: "hsl(var(--hero-gold) / 0.5)",
              color: "hsl(var(--hero-gold))",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Programa de Revendedores
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Quer{" "}
            <span style={{ color: "hsl(var(--hero-gold))" }}>contribuir com o evento</span>{" "}
            divulgando essa rifa?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/75">
            Compartilhe seu link exclusivo e faça parte ativa da construção do evento.
            Sua divulgação ajuda a custear tudo com excelência e honrar os participantes.{" "}
            <span className="font-semibold text-white">Obrigado a quem contribuir!</span>
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="container max-w-4xl pb-12">
        <div className="grid gap-4 sm:grid-cols-3">
          <Step
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="1. Cadastre-se"
            text="Crie sua conta e preencha seus dados. É grátis e leva menos de 1 minuto."
          />
          <Step
            icon={<Link2 className="h-5 w-5" />}
            title="2. Receba seu link único"
            text="Compartilhe no WhatsApp, redes sociais ou pessoalmente. Toda venda é registrada para você."
          />
          <Step
            icon={<Trophy className="h-5 w-5" />}
            title="3. Acompanhe e contribua"
            text="Use o painel para ver suas vendas, recuperar pendentes e subir no ranking."
          />
        </div>
      </section>

      {/* CTA / Form */}
      <section className="container max-w-2xl pb-16">
        {authed === null ? (
          <Card className="bg-white/5 p-8 text-center text-white/70 backdrop-blur">
            Carregando…
          </Card>
        ) : !authed ? (
          <Card className="space-y-4 bg-white/5 p-8 text-center text-white backdrop-blur">
            <Handshake className="mx-auto h-10 w-10 text-[hsl(var(--hero-gold))]" />
            <h2 className="text-xl font-bold">Quero me afiliar agora</h2>
            <p className="text-sm text-white/75">
              Você precisa criar uma conta (ou entrar) antes de gerar seu link
              exclusivo.
            </p>
            <Button
              asChild
              size="lg"
              className="rounded-full font-bold"
              style={{
                backgroundColor: "hsl(var(--hero-gold))",
                color: "hsl(var(--hero-bg))",
              }}
            >
              <Link to="/auth?next=/afiliacao&mode=signup">
                Criar conta de revendedor
              </Link>
            </Button>
            <p className="text-xs text-white/50">
              Já tem conta?{" "}
              <Link to="/auth?next=/afiliacao" className="underline">
                Entrar
              </Link>
            </p>
          </Card>
        ) : (
          <Card className="bg-white text-foreground p-6 sm:p-8">
            <h2 className="text-xl font-bold">Complete seu cadastro</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirme seus dados para gerar seu código de revendedor.
            </p>

            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="mt-6 space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
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
                  inputMode="numeric"
                  placeholder="11987654321"
                  autoComplete="tel"
                  {...form.register("phone")}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                    form.setValue("phone", v, { shouldValidate: true });
                  }}
                />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.phone.message}
                  </p>
                )}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Gerando seu link…" : "Gerar meu link de revendedor"}
              </Button>
            </form>
          </Card>
        )}

        {/* Why join */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Bullet
            icon={<TrendingUp className="h-5 w-5" />}
            title="Faça parte do evento"
            text="Cada venda pelo seu link ajuda a custear o Mês da Juventude."
          />
          <Bullet
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Acompanhe tudo"
            text="Monitore suas vendas e ajude os compradores a finalizar o PIX."
          />
          <Bullet
            icon={<Trophy className="h-5 w-5" />}
            title="Ranking de contribuição"
            text="Veja sua posição entre quem mais ajudou na divulgação."
          />
        </div>
      </section>
    </div>
  );
};

const Step = ({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) => (
  <Card className="border-white/10 bg-white/5 p-5 text-white backdrop-blur">
    <div
      className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full"
      style={{
        backgroundColor: "hsl(var(--hero-gold))",
        color: "hsl(var(--hero-bg))",
      }}
    >
      {icon}
    </div>
    <p className="font-bold">{title}</p>
    <p className="mt-1 text-sm text-white/70">{text}</p>
  </Card>
);

const Bullet = ({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) => (
  <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-white backdrop-blur">
    <div className="mb-2 inline-flex items-center gap-2 text-[hsl(var(--hero-gold))]">
      {icon}
      <span className="text-sm font-semibold">{title}</span>
    </div>
    <p className="text-xs text-white/65">{text}</p>
  </div>
);

export default Afiliacao;
