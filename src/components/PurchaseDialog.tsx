import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, Loader2, CreditCard, QrCode, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CardForm, type CardTokenPayload } from "@/components/CardForm";
import pulseiraCloseImg from "@/assets/pulseira-close.png.asset.json";
import modeloImg from "@/assets/modelo-camiseta-pulseira.png.asset.json";

type Option = "pulseira" | "kit";
type Model = "adulto" | "baby" | "infantil";
type Method = "pix" | "card";

const DEFAULT_PRICES: Record<Option, number> = { pulseira: 15, kit: 60 };
const REF_KEY = "raffle_ref_code";

const SIZES_BY_MODEL: Record<Model, string[]> = {
  adulto: ["PP", "P", "M", "G", "GG", "XGG"],
  baby: ["P", "M", "G", "GG"],
  infantil: ["02", "04", "06", "08", "10"],
};

const MODEL_LABEL: Record<Model, string> = {
  adulto: "Adulto",
  baby: "Babylook",
  infantil: "Infantil",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialOption?: Option;
}

interface PaymentData {
  order_id: string;
  method: Method;
  qr_code: string | null;
  qr_code_base64: string | null;
  init_point: string | null;
  total_cents: number;
}

export function PurchaseDialog({ open, onOpenChange, initialOption = "pulseira" }: Props) {
  const [step, setStep] = useState<"form" | "card" | "payment" | "done">("form");
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [option, setOption] = useState<Option>(initialOption);
  const [model, setModel] = useState<Model>("adulto");
  const [tamanho, setTamanho] = useState("");
  const [qtd, setQtd] = useState(1);
  const [method, setMethod] = useState<Method>("pix");
  const [hasReferral, setHasReferral] = useState(false);
  const [refInput, setRefInput] = useState("");
  const [refValidating, setRefValidating] = useState(false);
  const [refResult, setRefResult] = useState<
    | { ok: true; name: string; ref_code: string }
    | { ok: false; message: string }
    | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<Option, number>>(DEFAULT_PRICES);
  const pollRef = useRef<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewKey = `${option}-${option === "kit" ? model : "x"}-${option === "kit" ? tamanho || "x" : "x"}`;
  useEffect(() => {
    setPreviewLoading(true);
    const t = window.setTimeout(() => setPreviewLoading(false), 100);
    return () => window.clearTimeout(t);
  }, [previewKey]);
  const previewData = option === "kit"
    ? {
        img: modeloImg,
        title: "Kit Pulseira + Camiseta",
        desc: `Camiseta ${MODEL_LABEL[model]}${tamanho ? ` · ${model === "infantil" ? `${tamanho} anos` : `tam. ${tamanho}`}` : ""} + pulseira oficial de acesso.`,
      }
    : {
        img: pulseiraCloseImg,
        title: "Pulseira de Acesso",
        desc: "Pulseira oficial do evento Mês da Juventude.",
      };

  const total = useMemo(() => prices[option] * qtd, [option, qtd, prices]);
  const pulseiraStock = stock["pulseira"] ?? 0;
  const sizes = SIZES_BY_MODEL[model];
  const sizeStock = (s: string) => stock[`camiseta_${model}_${s}`] ?? 0;
  const kitAvailable = pulseiraStock > 0 && (["adulto", "baby", "infantil"] as Model[]).some(
    (m) => SIZES_BY_MODEL[m].some((s) => (stock[`camiseta_${m}_${s}`] ?? 0) > 0),
  );
  const fmtPrice = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const LABELS: Record<Option, string> = {
    pulseira: `Pulseira de acesso — ${fmtPrice(prices.pulseira)}`,
    kit: `Kit pulseira + camiseta — ${fmtPrice(prices.kit)}`,
  };

  // Carrega estoque + preços + ref_code de localStorage ao abrir
  useEffect(() => {
    if (!open) return;
    supabase.from("entrada_stock").select("sku, stock").then(({ data }) => {
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.sku as string] = r.stock as number;
      setStock(map);
    });
    supabase.from("app_settings").select("value").eq("key", "entrada_prices").maybeSingle().then(({ data }) => {
      const v = (data?.value ?? {}) as { pulseira_cents?: number; kit_cents?: number };
      setPrices({
        pulseira: v.pulseira_cents && v.pulseira_cents > 0 ? v.pulseira_cents / 100 : DEFAULT_PRICES.pulseira,
        kit: v.kit_cents && v.kit_cents > 0 ? v.kit_cents / 100 : DEFAULT_PRICES.kit,
      });
    });
    try {
      const stored = localStorage.getItem(REF_KEY);
      if (stored) {
        setHasReferral(true);
        setRefInput(stored.toUpperCase());
      }
    } catch { /* ignore */ }
  }, [open]);

  // Reset tamanho quando mudar modelo
  useEffect(() => { setTamanho(""); }, [model]);

  // Valida ref_code com debounce
  useEffect(() => {
    if (!hasReferral) { setRefResult(null); return; }
    const code = refInput.trim();
    if (code.length < 3) { setRefResult(null); return; }
    let cancelled = false;
    setRefValidating(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("validate_referral_code", { _code: code });
      if (cancelled) return;
      setRefValidating(false);
      if (error) { setRefResult({ ok: false, message: "Erro ao validar código" }); return; }
      const row = Array.isArray(data) ? data[0] : data;
      if (row && (row as { name?: string }).name) {
        const r = row as { name: string; ref_code: string };
        setRefResult({ ok: true, name: r.name, ref_code: r.ref_code });
      } else {
        setRefResult({ ok: false, message: "Código não encontrado" });
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [refInput, hasReferral]);

  const reset = () => {
    setStep("form");
    setNome(""); setTelefone(""); setEmail(""); setOption(initialOption); setModel("adulto");
    setTamanho(""); setQtd(1); setMethod("pix"); setHasReferral(false); setRefInput(""); setRefResult(null);
    setPayment(null); setLoading(false);
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleClose = (v: boolean) => {
    if (!v) setTimeout(reset, 200);
    onOpenChange(v);
  };

  // Polling
  useEffect(() => {
    if (step !== "payment" || !payment?.order_id || payment.method !== "pix") return;
    const tick = async () => {
      const { data, error } = await supabase.functions.invoke("entrada-status", {
        body: { order_id: payment.order_id },
      });
      if (!error && data?.status === "paid") setStep("done");
    };
    pollRef.current = window.setInterval(tick, 4000);
    return () => { if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; } };
  }, [step, payment?.order_id, payment?.method]);

  const createOrderPayment = async (extra: Partial<CardTokenPayload> & { method: Method } = { method: "pix" }) => {
    const ref_code = hasReferral && refResult && refResult.ok ? refResult.ref_code : null;
    const { data, error } = await supabase.functions.invoke("create-entrada-payment", {
      body: {
        buyer_name: nome.trim(),
        buyer_phone: telefone.trim(),
        buyer_email: email.trim().toLowerCase(),
        product: option,
        model: option === "kit" ? model : "adulto",
        size: option === "kit" ? tamanho : null,
        quantity: qtd,
        ref_code,
        return_url: window.location.href,
        ...extra,
      },
    });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      let msg = "Erro ao gerar pagamento";
      try {
        const body = ctx ? await ctx.json() : null;
        if (body?.message) msg = body.message;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return data as PaymentData & { status?: string; status_detail?: string };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) { toast.error("Preencha nome e telefone"); return; }
    const emailClean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailClean)) {
      toast.error("Informe um e-mail válido"); return;
    }
    if (option === "kit" && !tamanho) { toast.error("Selecione o tamanho da camiseta"); return; }
    if (hasReferral && refInput.trim() && (!refResult || !refResult.ok)) {
      toast.error("Código de revendedor inválido. Corrija ou desmarque a opção."); return;
    }

    if (method === "card") {
      // Don't create order yet — collect card data first
      setCardError(null);
      setStep("card");
      return;
    }

    setLoading(true);
    try {
      const data = await createOrderPayment({ method: "pix" });
      if (!data?.qr_code) { toast.error("Não foi possível gerar o PIX. Tente novamente."); return; }
      setPayment(data as PaymentData);
      setStep("payment");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const handleCardTokenized = async (payload: CardTokenPayload) => {
    setCardError(null);
    setCardSubmitting(true);
    try {
      const data = await createOrderPayment({ method: "card", ...payload });
      if (data?.status === "approved") {
        setStep("done");
        toast.success("Pagamento aprovado!");
      } else if (data?.status === "in_process" || data?.status === "pending") {
        setCardError("Pagamento em análise. Você receberá a confirmação em instantes.");
        // optional: poll mp_payment_id via entrada-status would need order_id; keep simple
      } else {
        setCardError(data?.status_detail ? `Cartão recusado: ${data.status_detail}` : "Cartão recusado.");
      }
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Erro ao processar cartão");
    } finally {
      setCardSubmitting(false);
    }
  };

  const copyPayload = async () => {
    if (!payment?.qr_code) return;
    await navigator.clipboard.writeText(payment.qr_code);
    setCopied(true);
    toast.success("Código Pix copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto border text-white"
        style={{ backgroundColor: "hsl(var(--hero-bg))", borderColor: "hsl(var(--hero-gold) / 0.3)" }}
      >
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-extrabold uppercase tracking-wide text-white">
                Faça seu pedido
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Preencha os dados para gerar o pagamento.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              {/* Preview dinâmico do produto */}
              <div
                className="relative rounded-2xl border overflow-hidden p-3 flex items-center gap-4 group"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderColor: "hsl(var(--hero-gold) / 0.25)",
                }}
              >
                <div
                  className="relative h-24 w-24 shrink-0 rounded-xl overflow-hidden border"
                  style={{ borderColor: "hsl(var(--hero-gold) / 0.3)", backgroundColor: "hsl(0 0% 4%)" }}
                >
                  <div
                    key={previewKey}
                    className={`absolute inset-0 transition-all duration-300 ease-out ${previewLoading ? "opacity-0 scale-95" : "opacity-100 scale-100 animate-fade-in"}`}
                  >
                    <img
                      src={previewData.img}
                      alt={previewData.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.06]"
                    />
                  </div>
                  <div
                    aria-hidden
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 50%, hsl(var(--hero-gold) / 0.25), transparent 70%)",
                      mixBlendMode: "screen",
                    }}
                  />
                  {previewLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--hero-gold))]" />
                    </div>
                  )}
                </div>
                <div key={`${previewKey}-text`} className="min-w-0 animate-fade-in">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(var(--hero-gold))]">
                    Sua escolha
                  </p>
                  <h4 className="text-base font-extrabold text-white truncate">{previewData.title}</h4>
                  <p className="text-xs text-white/65 line-clamp-2">{previewData.desc}</p>
                  <p className="text-sm font-bold text-white mt-1">{fmtPrice(prices[option] * qtd)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-white/85">Nome completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-[hsl(var(--hero-gold))]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tel" className="text-white/85">Telefone / WhatsApp</Label>
                <Input id="tel" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={20}
                  placeholder="(11) 99999-9999" required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-[hsl(var(--hero-gold))]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/85">E-mail</Label>
                <Input id="email" type="email" inputMode="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} maxLength={180}
                  placeholder="seu@email.com" required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-[hsl(var(--hero-gold))]" />
                <p className="text-xs text-white/55">Necessário para confirmar o pagamento e enviar o comprovante.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-white/85">Opção escolhida</Label>
                <RadioGroup value={option} onValueChange={(v) => setOption(v as Option)}>
                  <label className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all duration-200 ease-out bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] hover:scale-[1.01] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.12)] has-[:checked]:shadow-[0_0_0_3px_hsl(var(--hero-gold)/0.18),0_0_24px_hsl(var(--hero-gold)/0.25)] ${pulseiraStock <= 0 ? "opacity-50 pointer-events-none" : ""}`}>
                    <RadioGroupItem value="pulseira" disabled={pulseiraStock <= 0} className="border-white/40 text-[hsl(var(--hero-gold))]" />
                    <span className="font-medium text-white">{LABELS.pulseira}</span>
                    {pulseiraStock <= 0 && <span className="ml-auto text-xs font-semibold text-destructive">Indisponível</span>}
                  </label>
                  {initialOption !== "pulseira" && (
                    <label className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all duration-200 ease-out bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] hover:scale-[1.01] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.12)] has-[:checked]:shadow-[0_0_0_3px_hsl(var(--hero-gold)/0.18),0_0_24px_hsl(var(--hero-gold)/0.25)] ${!kitAvailable ? "opacity-50 pointer-events-none" : ""}`}>
                      <RadioGroupItem value="kit" disabled={!kitAvailable} className="border-white/40 text-[hsl(var(--hero-gold))]" />
                      <span className="font-medium text-white">{LABELS.kit}</span>
                      {!kitAvailable && <span className="ml-auto text-xs font-semibold text-destructive">Indisponível</span>}
                    </label>
                  )}
                </RadioGroup>
              </div>

              {option === "kit" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-white/85">Modelo da camiseta</Label>
                    <RadioGroup value={model} onValueChange={(v) => setModel(v as Model)} className="grid grid-cols-3 gap-2">
                      {(Object.keys(MODEL_LABEL) as Model[]).map((m) => {
                        const hasAny = SIZES_BY_MODEL[m].some((s) => (stock[`camiseta_${m}_${s}`] ?? 0) > 0);
                        return (
                          <label key={m} className={`flex items-center justify-center gap-2 rounded-lg border-2 p-2 cursor-pointer transition-all duration-200 ease-out bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] hover:scale-[1.01] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.12)] has-[:checked]:shadow-[0_0_0_3px_hsl(var(--hero-gold)/0.18),0_0_24px_hsl(var(--hero-gold)/0.25)] ${!hasAny ? "opacity-50 pointer-events-none" : ""}`}>
                            <RadioGroupItem value={m} disabled={!hasAny} className="border-white/40 text-[hsl(var(--hero-gold))]" />
                            <span className="text-sm font-semibold text-white">{MODEL_LABEL[m]}</span>
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/85">
                      {model === "infantil" ? "Idade" : "Tamanho"} da camiseta
                    </Label>
                    <Select value={tamanho} onValueChange={setTamanho}>
                      <SelectTrigger className="bg-white/5 border-white/15 text-white focus:ring-[hsl(var(--hero-gold))]">
                        <SelectValue placeholder={model === "infantil" ? "Selecione a idade" : "Selecione o tamanho"} />
                      </SelectTrigger>
                      <SelectContent>
                        {sizes.map((t) => {
                          const left = sizeStock(t);
                          const display = model === "infantil" ? `${t} anos` : t;
                          return (
                            <SelectItem key={t} value={t} disabled={left <= 0}>
                              {display} {left <= 0 ? "— esgotado" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="qtd" className="text-white/85">Quantidade</Label>
                <Input id="qtd" type="number" min={1} max={99} value={qtd}
                  onChange={(e) => setQtd(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-white/5 border-white/15 text-white focus-visible:ring-[hsl(var(--hero-gold))]" />
              </div>

              <div className="space-y-2">
                <Label className="text-white/85">Forma de pagamento</Label>
                <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)} className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all duration-200 ease-out bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] hover:scale-[1.01] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.12)] has-[:checked]:shadow-[0_0_0_3px_hsl(var(--hero-gold)/0.18),0_0_24px_hsl(var(--hero-gold)/0.25)]">
                    <RadioGroupItem value="pix" className="border-white/40 text-[hsl(var(--hero-gold))]" />
                    <QrCode className="h-4 w-4 text-[hsl(var(--hero-gold))]" />
                    <span className="font-semibold text-white">Pix</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all duration-200 ease-out bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] hover:scale-[1.01] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.12)] has-[:checked]:shadow-[0_0_0_3px_hsl(var(--hero-gold)/0.18),0_0_24px_hsl(var(--hero-gold)/0.25)]">
                    <RadioGroupItem value="card" className="border-white/40 text-[hsl(var(--hero-gold))]" />
                    <CreditCard className="h-4 w-4 text-[hsl(var(--hero-gold))]" />
                    <span className="font-semibold text-white">Cartão (até 12x)</span>
                  </label>
                </RadioGroup>
                {method === "card" && (
                  <p className="text-xs text-white/60">
                    Pagamento seguro pelo Mercado Pago. Você preencherá os dados do cartão na próxima etapa. Parcelamento sujeito a juros do MP.
                  </p>
                )}
              </div>

              {/* Código de revendedor */}
              <div className="space-y-2 rounded-md border border-white/15 p-3">
                <label className="flex items-start gap-2 text-sm font-medium cursor-pointer text-white/85">
                  <input
                    type="checkbox"
                    checked={hasReferral}
                    onChange={(e) => {
                      setHasReferral(e.target.checked);
                      if (!e.target.checked) { setRefInput(""); setRefResult(null); }
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-white/30"
                  />
                  <span>Você recebeu indicação de um revendedor?</span>
                </label>
                {hasReferral && (
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Ex.: IDB001"
                      value={refInput}
                      onChange={(e) => setRefInput(e.target.value.toUpperCase().slice(0, 32))}
                      className="font-mono tracking-wider bg-white/5 border-white/15 text-white focus-visible:ring-[hsl(var(--hero-gold))] focus-visible:ring-offset-0"
                    />
                    {refValidating && (
                      <p className="flex items-center gap-2 text-xs text-white/60">
                        <Loader2 className="h-3 w-3 animate-spin" /> Validando código...
                      </p>
                    )}
                    {!refValidating && refResult?.ok && (
                      <div className="flex items-start gap-2 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5" />
                        <span>Indicação: <strong>{refResult.name}</strong></span>
                      </div>
                    )}
                    {!refValidating && refResult && refResult.ok === false && refInput.trim().length >= 3 && (
                      <div className="flex items-start gap-2 text-xs text-destructive">
                        <XCircle className="h-3.5 w-3.5 mt-0.5" />
                        <span>{refResult.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg p-4 flex items-center justify-between border"
                style={{ backgroundColor: "hsl(var(--hero-gold) / 0.08)", borderColor: "hsl(var(--hero-gold) / 0.3)" }}>
                <span className="font-semibold uppercase tracking-wider text-sm text-white/85">Total</span>
                <span className="text-2xl font-extrabold" style={{ color: "hsl(var(--hero-gold))" }}>
                  R$ {total.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <Button type="submit" size="lg"
                className="w-full text-base h-12 rounded-2xl font-extrabold uppercase tracking-wider shadow-gold-glow hover:brightness-110"
                style={{ backgroundColor: "hsl(var(--hero-gold))", color: "hsl(var(--hero-bg))" }}
                disabled={loading}>
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando PIX...</>
                  : method === "card" ? "Continuar com cartão" : "Continuar com Pix"}
              </Button>
            </form>
          </>
        )}

        {step === "card" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-extrabold uppercase tracking-wide text-white">
                Pagar com cartão
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Preencha os dados do seu cartão. Tokenização segura via Mercado Pago.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 space-y-4">
              <div className="rounded-lg p-4 flex items-center justify-between border"
                style={{ backgroundColor: "hsl(var(--hero-gold) / 0.08)", borderColor: "hsl(var(--hero-gold) / 0.3)" }}>
                <span className="font-semibold uppercase tracking-wider text-sm text-white/85">Total</span>
                <span className="text-2xl font-extrabold" style={{ color: "hsl(var(--hero-gold))" }}>
                  R$ {total.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <CardForm
                account="entrada"
                amount={total}
                variant="dark"
                submitting={cardSubmitting}
                errorMessage={cardError}
                onTokenized={handleCardTokenized}
              />
              <Button type="button" variant="ghost" onClick={() => setStep("form")}
                className="w-full text-white/80 hover:text-white hover:bg-white/5">
                Voltar
              </Button>
            </div>
          </>
        )}


        {step === "payment" && payment && payment.method === "pix" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-extrabold uppercase tracking-wide text-white">
                Pagamento via Pix
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Escaneie o QR Code ou use o código copia e cola.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="rounded-xl p-6 border"
                style={{ backgroundColor: "hsl(var(--hero-gold))", color: "hsl(var(--hero-bg))", borderColor: "hsl(var(--hero-gold))" }}>
                <p className="text-sm opacity-80 font-semibold uppercase tracking-wider">Valor total</p>
                <p className="text-4xl font-extrabold">R$ {(payment.total_cents / 100).toFixed(2).replace(".", ",")}</p>
              </div>

              {payment.qr_code_base64 && (
                <div className="flex flex-col items-center gap-3 rounded-xl border-2 bg-white p-5"
                  style={{ borderColor: "hsl(var(--hero-gold) / 0.4)" }}>
                  <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">QR Code Mercado Pago</span>
                  <img src={`data:image/png;base64,${payment.qr_code_base64}`} alt="QR Code Pix" className="w-56 h-56" />
                </div>
              )}

              {payment.qr_code && (
                <div className="space-y-2">
                  <Label className="text-white/85">Pix Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={payment.qr_code} onFocus={(e) => e.target.select()}
                      className="font-mono text-xs bg-white/5 border-white/15 text-white" />
                    <Button type="button" variant="outline" size="icon" onClick={copyPayload}
                      className="border-[hsl(var(--hero-gold))] bg-transparent text-[hsl(var(--hero-gold))] hover:bg-[hsl(var(--hero-gold)/0.1)]">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border-l-4 p-4 text-sm flex items-center gap-3 text-white/85"
                style={{ borderLeftColor: "hsl(var(--hero-gold))", backgroundColor: "hsl(var(--hero-gold) / 0.08)" }}>
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: "hsl(var(--hero-gold))" }} />
                <span>Aguardando confirmação do pagamento... esta tela atualiza sozinha.</span>
              </div>

              <Button type="button" variant="ghost" onClick={() => setStep("form")}
                className="w-full text-white/80 hover:text-white hover:bg-white/5">
                Voltar
              </Button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center shadow-gold-glow"
              style={{ backgroundColor: "hsl(var(--hero-gold))" }}>
              <Check className="h-8 w-8" style={{ color: "hsl(var(--hero-bg))" }} />
            </div>
            <DialogTitle className="text-2xl font-extrabold uppercase tracking-wide text-white">Pagamento confirmado!</DialogTitle>
            <p className="text-white/70">
              Recebemos seu pagamento. Em breve você receberá mais informações sobre a retirada da sua pulseira{option === "kit" ? " e camiseta" : ""}.
            </p>
            <Button onClick={() => handleClose(false)} size="lg"
              className="w-full rounded-2xl font-extrabold uppercase tracking-wider shadow-gold-glow"
              style={{ backgroundColor: "hsl(var(--hero-gold))", color: "hsl(var(--hero-bg))" }}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
