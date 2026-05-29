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

const PRICES: Record<Option, number> = { pulseira: 15, kit: 60 };
const LABELS: Record<Option, string> = {
  pulseira: "Pulseira de acesso — R$ 15,00",
  kit: "Kit pulseira + camiseta — R$ 60,00",
};

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
  const pollRef = useRef<number | null>(null);

  const total = useMemo(() => PRICES[option] * qtd, [option, qtd]);
  const pulseiraStock = stock["pulseira"] ?? 0;
  const sizeStock = (s: string) => stock[`camiseta_${s}`] ?? 0;
  const sizes = ["PP", "P", "M", "G", "GG", "XGG"];
  const kitAvailable = pulseiraStock > 0 && sizes.some((s) => sizeStock(s) > 0);

  // Carrega estoque público quando abre o diálogo
  useEffect(() => {
    if (!open) return;
    supabase.from("entrada_stock").select("sku, stock").then(({ data }) => {
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.sku as string] = r.stock as number;
      setStock(map);
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Faça seu pedido</DialogTitle>
              <DialogDescription>Preencha os dados para gerar o pagamento via Pix.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tel">Telefone / WhatsApp</Label>
                <Input id="tel" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={20} placeholder="(11) 99999-9999" required />
              </div>
              <div className="space-y-2">
                <Label>Opção escolhida</Label>
                <RadioGroup value={option} onValueChange={(v) => setOption(v as Option)}>
                  <label className="flex items-center gap-3 rounded-lg border-2 border-border p-3 cursor-pointer hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-accent">
                    <RadioGroupItem value="pulseira" />
                    <span className="font-medium">{LABELS.pulseira}</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border-2 border-border p-3 cursor-pointer hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-accent">
                    <RadioGroupItem value="kit" />
                    <span className="font-medium">{LABELS.kit}</span>
                  </label>
                </RadioGroup>
              </div>
              {option === "kit" && (
                <div className="space-y-2">
                  <Label>Tamanho da camiseta</Label>
                  <Select value={tamanho} onValueChange={setTamanho}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tamanho" /></SelectTrigger>
                    <SelectContent>
                      {["PP", "P", "M", "G", "GG", "XGG"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="qtd">Quantidade</Label>
                <Input id="qtd" type="number" min={1} max={99} value={qtd} onChange={(e) => setQtd(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div className="rounded-lg bg-accent p-4 flex items-center justify-between">
                <span className="font-medium">Total</span>
                <span className="text-2xl font-bold text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
              <Button type="submit" size="lg" className="w-full text-base h-12" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando PIX...</> : "Continuar para pagamento"}
              </Button>
            </form>
          </>
        )}

        {step === "payment" && payment && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Pagamento via Pix</DialogTitle>
              <DialogDescription>Escaneie o QR Code ou use o código copia e cola.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="rounded-xl bg-primary p-6 text-primary-foreground">
                <p className="text-sm opacity-90">Valor total</p>
                <p className="text-4xl font-bold">R$ {(payment.total_cents / 100).toFixed(2).replace(".", ",")}</p>
              </div>

              {payment.qr_code_base64 && (
                <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-white p-5">
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
                  <Label>Pix Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={payment.qr_code} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={copyPayload}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border-l-4 border-primary bg-accent p-4 text-sm flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                <span>Aguardando confirmação do pagamento... assim que o Pix for aprovado, esta tela será atualizada automaticamente.</span>
              </div>

              <Button type="button" variant="ghost" onClick={() => setStep("form")} className="w-full">Voltar</Button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-8 w-8 text-primary-foreground" />
            </div>
            <DialogTitle className="text-2xl">Pagamento confirmado!</DialogTitle>
            <p className="text-muted-foreground">
              Recebemos seu pagamento. Em breve você receberá mais informações sobre a retirada da sua pulseira{option === "kit" ? " e camiseta" : ""}.
            </p>
            <Button onClick={() => handleClose(false)} size="lg" className="w-full">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
