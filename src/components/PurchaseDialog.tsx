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
  const [step, setStep] = useState<"form" | "payment" | "done">("form");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
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
    setNome(""); setTelefone(""); setOption(initialOption); setModel("adulto");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) { toast.error("Preencha nome e telefone"); return; }
    if (option === "kit" && !tamanho) { toast.error("Selecione o tamanho da camiseta"); return; }
    if (hasReferral && refInput.trim() && (!refResult || !refResult.ok)) {
      toast.error("Código de revendedor inválido. Corrija ou desmarque a opção."); return;
    }

    setLoading(true);
    try {
      const ref_code = hasReferral && refResult && refResult.ok ? refResult.ref_code : null;
      const { data, error } = await supabase.functions.invoke("create-entrada-payment", {
        body: {
          buyer_name: nome.trim(),
          buyer_phone: telefone.trim(),
          product: option,
          model: option === "kit" ? model : "adulto",
          size: option === "kit" ? tamanho : null,
          quantity: qtd,
          method,
          ref_code,
          return_url: window.location.href,
        },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        let msg = "Erro ao gerar pagamento";
        try {
          const body = ctx ? await ctx.json() : null;
          if (body?.message) msg = body.message;
        } catch { /* ignore */ }
        toast.error(msg);
        return;
      }
      if (method === "card") {
        if (data?.init_point) {
          window.location.href = data.init_point;
          return;
        }
        toast.error("Não foi possível abrir o pagamento por cartão.");
        return;
      }
      if (!data?.qr_code) { toast.error("Não foi possível gerar o PIX. Tente novamente."); return; }
      setPayment(data as PaymentData);
      setStep("payment");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar pagamento");
    } finally {
      setLoading(false);
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
                <Label className="text-white/85">Opção escolhida</Label>
                <RadioGroup value={option} onValueChange={(v) => setOption(v as Option)}>
                  <label className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.1)] ${pulseiraStock <= 0 ? "opacity-50 pointer-events-none" : ""}`}>
                    <RadioGroupItem value="pulseira" disabled={pulseiraStock <= 0} className="border-white/40 text-[hsl(var(--hero-gold))]" />
                    <span className="font-medium text-white">{LABELS.pulseira}</span>
                    {pulseiraStock <= 0 && <span className="ml-auto text-xs font-semibold text-destructive">Indisponível</span>}
                  </label>
                  <label className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.1)] ${!kitAvailable ? "opacity-50 pointer-events-none" : ""}`}>
                    <RadioGroupItem value="kit" disabled={!kitAvailable} className="border-white/40 text-[hsl(var(--hero-gold))]" />
                    <span className="font-medium text-white">{LABELS.kit}</span>
                    {!kitAvailable && <span className="ml-auto text-xs font-semibold text-destructive">Indisponível</span>}
                  </label>
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
                          <label key={m} className={`flex items-center justify-center gap-2 rounded-lg border-2 p-2 cursor-pointer transition bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.1)] ${!hasAny ? "opacity-50 pointer-events-none" : ""}`}>
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
                              {display} {left <= 0 ? "— esgotado" : `(${left} disp.)`}
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
                  <label className="flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.1)]">
                    <RadioGroupItem value="pix" className="border-white/40 text-[hsl(var(--hero-gold))]" />
                    <QrCode className="h-4 w-4 text-[hsl(var(--hero-gold))]" />
                    <span className="font-semibold text-white">Pix</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.1)]">
                    <RadioGroupItem value="card" className="border-white/40 text-[hsl(var(--hero-gold))]" />
                    <CreditCard className="h-4 w-4 text-[hsl(var(--hero-gold))]" />
                    <span className="font-semibold text-white">Cartão (até 12x)</span>
                  </label>
                </RadioGroup>
                {method === "card" && (
                  <p className="text-xs text-white/60">
                    Você será redirecionado ao ambiente seguro do Mercado Pago. Parcelamento sujeito a juros do MP.
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
                      className="font-mono tracking-wider bg-white/5 border-white/15 text-white"
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
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {method === "card" ? "Abrindo cartão..." : "Gerando PIX..."}</>
                  : method === "card" ? "Pagar com cartão" : "Continuar com Pix"}
              </Button>
            </form>
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
