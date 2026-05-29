import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Option = "pulseira" | "kit";

const DEFAULT_PRICES: Record<Option, number> = { pulseira: 15, kit: 60 };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialOption?: Option;
}

interface PaymentData {
  order_id: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  total_cents: number;
}

export function PurchaseDialog({ open, onOpenChange, initialOption = "pulseira" }: Props) {
  const [step, setStep] = useState<"form" | "payment" | "done">("form");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [option, setOption] = useState<Option>(initialOption);
  const [tamanho, setTamanho] = useState("");
  const [qtd, setQtd] = useState(1);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<Option, number>>(DEFAULT_PRICES);
  const pollRef = useRef<number | null>(null);

  const total = useMemo(() => prices[option] * qtd, [option, qtd, prices]);
  const pulseiraStock = stock["pulseira"] ?? 0;
  const sizeStock = (s: string) => stock[`camiseta_${s}`] ?? 0;
  const sizes = ["PP", "P", "M", "G", "GG", "XGG"];
  const kitAvailable = pulseiraStock > 0 && sizes.some((s) => sizeStock(s) > 0);
  const fmtPrice = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const LABELS: Record<Option, string> = {
    pulseira: `Pulseira de acesso — ${fmtPrice(prices.pulseira)}`,
    kit: `Kit pulseira + camiseta — ${fmtPrice(prices.kit)}`,
  };

  // Carrega estoque e preços públicos quando abre o diálogo
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
  }, [open]);

  const reset = () => {
    setStep("form");
    setNome(""); setTelefone(""); setOption(initialOption); setTamanho(""); setQtd(1);
    setPayment(null); setLoading(false);
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleClose = (v: boolean) => {
    if (!v) setTimeout(reset, 200);
    onOpenChange(v);
  };

  // Polling do status do pedido enquanto está em payment
  useEffect(() => {
    if (step !== "payment" || !payment?.order_id) return;
    const tick = async () => {
      const { data, error } = await supabase.functions.invoke("entrada-status", {
        body: { order_id: payment.order_id },
      });
      if (!error && data?.status === "paid") {
        setStep("done");
      }
    };
    pollRef.current = window.setInterval(tick, 4000);
    return () => {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [step, payment?.order_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) {
      toast.error("Preencha nome e telefone");
      return;
    }
    if (option === "kit" && !tamanho) {
      toast.error("Selecione o tamanho da camiseta");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-entrada-payment", {
        body: {
          buyer_name: nome.trim(),
          buyer_phone: telefone.trim(),
          product: option,
          size: option === "kit" ? tamanho : null,
          quantity: qtd,
        },
      });
      if (error) throw error;
      if (!data?.qr_code) {
        toast.error("Não foi possível gerar o PIX. Tente novamente.");
        return;
      }
      setPayment(data as PaymentData);
      setStep("payment");
    } catch (err: any) {
      const msg = err?.message || "Erro ao gerar pagamento";
      toast.error(msg);
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
        style={{
          backgroundColor: "hsl(var(--hero-bg))",
          borderColor: "hsl(var(--hero-gold) / 0.3)",
        }}
      >
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-extrabold uppercase tracking-wide text-white">
                Faça seu pedido
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Preencha os dados para gerar o pagamento via Pix.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-white/85">Nome completo</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={100}
                  required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-[hsl(var(--hero-gold))]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tel" className="text-white/85">Telefone / WhatsApp</Label>
                <Input
                  id="tel"
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  maxLength={20}
                  placeholder="(11) 99999-9999"
                  required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-[hsl(var(--hero-gold))]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/85">Opção escolhida</Label>
                <RadioGroup value={option} onValueChange={(v) => setOption(v as Option)}>
                  <label
                    className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.1)] ${pulseiraStock <= 0 ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <RadioGroupItem value="pulseira" disabled={pulseiraStock <= 0} className="border-white/40 text-[hsl(var(--hero-gold))]" />
                    <span className="font-medium text-white">{LABELS.pulseira}</span>
                    {pulseiraStock <= 0 && <span className="ml-auto text-xs font-semibold text-destructive">Indisponível</span>}
                  </label>
                  <label
                    className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition bg-white/5 border-white/15 hover:border-[hsl(var(--hero-gold))] has-[:checked]:border-[hsl(var(--hero-gold))] has-[:checked]:bg-[hsl(var(--hero-gold)/0.1)] ${!kitAvailable ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <RadioGroupItem value="kit" disabled={!kitAvailable} className="border-white/40 text-[hsl(var(--hero-gold))]" />
                    <span className="font-medium text-white">{LABELS.kit}</span>
                    {!kitAvailable && <span className="ml-auto text-xs font-semibold text-destructive">Indisponível</span>}
                  </label>
                </RadioGroup>
              </div>
              {option === "kit" && (
                <div className="space-y-2">
                  <Label className="text-white/85">Tamanho da camiseta</Label>
                  <Select value={tamanho} onValueChange={setTamanho}>
                    <SelectTrigger className="bg-white/5 border-white/15 text-white focus:ring-[hsl(var(--hero-gold))]">
                      <SelectValue placeholder="Selecione o tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.map((t) => {
                        const left = sizeStock(t);
                        return (
                          <SelectItem key={t} value={t} disabled={left <= 0}>
                            {t} {left <= 0 ? "— esgotado" : `(${left} disp.)`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="qtd" className="text-white/85">Quantidade</Label>
                <Input
                  id="qtd"
                  type="number"
                  min={1}
                  max={99}
                  value={qtd}
                  onChange={(e) => setQtd(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-white/5 border-white/15 text-white focus-visible:ring-[hsl(var(--hero-gold))]"
                />
              </div>
              <div
                className="rounded-lg p-4 flex items-center justify-between border"
                style={{
                  backgroundColor: "hsl(var(--hero-gold) / 0.08)",
                  borderColor: "hsl(var(--hero-gold) / 0.3)",
                }}
              >
                <span className="font-semibold uppercase tracking-wider text-sm text-white/85">Total</span>
                <span className="text-2xl font-extrabold text-glow-gold" style={{ color: "hsl(var(--hero-gold))" }}>
                  R$ {total.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full text-base h-12 rounded-2xl font-extrabold uppercase tracking-wider shadow-gold-glow hover:brightness-110"
                style={{ backgroundColor: "hsl(var(--hero-gold))", color: "hsl(var(--hero-bg))" }}
                disabled={loading}
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando PIX...</> : "Continuar para pagamento"}
              </Button>
            </form>
          </>
        )}

        {step === "payment" && payment && (
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
              <div
                className="rounded-xl p-6 border"
                style={{
                  backgroundColor: "hsl(var(--hero-gold))",
                  color: "hsl(var(--hero-bg))",
                  borderColor: "hsl(var(--hero-gold))",
                }}
              >
                <p className="text-sm opacity-80 font-semibold uppercase tracking-wider">Valor total</p>
                <p className="text-4xl font-extrabold">R$ {(payment.total_cents / 100).toFixed(2).replace(".", ",")}</p>
              </div>

              {payment.qr_code_base64 && (
                <div
                  className="flex flex-col items-center gap-3 rounded-xl border-2 bg-white p-5"
                  style={{ borderColor: "hsl(var(--hero-gold) / 0.4)" }}
                >
                  <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">QR Code Mercado Pago</span>
                  <img
                    src={`data:image/png;base64,${payment.qr_code_base64}`}
                    alt="QR Code Pix"
                    className="w-56 h-56"
                  />
                </div>
              )}

              {payment.qr_code && (
                <div className="space-y-2">
                  <Label className="text-white/85">Pix Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={payment.qr_code}
                      onFocus={(e) => e.target.select()}
                      className="font-mono text-xs bg-white/5 border-white/15 text-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyPayload}
                      className="border-[hsl(var(--hero-gold))] bg-transparent text-[hsl(var(--hero-gold))] hover:bg-[hsl(var(--hero-gold)/0.1)]"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div
                className="rounded-lg border-l-4 p-4 text-sm flex items-center gap-3 text-white/85"
                style={{
                  borderLeftColor: "hsl(var(--hero-gold))",
                  backgroundColor: "hsl(var(--hero-gold) / 0.08)",
                }}
              >
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: "hsl(var(--hero-gold))" }} />
                <span>Aguardando confirmação do pagamento... assim que o Pix for aprovado, esta tela será atualizada automaticamente.</span>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("form")}
                className="w-full text-white/80 hover:text-white hover:bg-white/5"
              >
                Voltar
              </Button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="text-center py-6 space-y-4">
            <div
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center shadow-gold-glow"
              style={{ backgroundColor: "hsl(var(--hero-gold))" }}
            >
              <Check className="h-8 w-8" style={{ color: "hsl(var(--hero-bg))" }} />
            </div>
            <DialogTitle className="text-2xl font-extrabold uppercase tracking-wide text-white">Pagamento confirmado!</DialogTitle>
            <p className="text-white/70">
              Recebemos seu pagamento. Em breve você receberá mais informações sobre a retirada da sua pulseira{option === "kit" ? " e camiseta" : ""}.
            </p>
            <Button
              onClick={() => handleClose(false)}
              size="lg"
              className="w-full rounded-2xl font-extrabold uppercase tracking-wider shadow-gold-glow"
              style={{ backgroundColor: "hsl(var(--hero-gold))", color: "hsl(var(--hero-bg))" }}
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

