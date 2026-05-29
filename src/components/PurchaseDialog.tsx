import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { generatePixPayload } from "@/lib/pix";

// Chave Pix
const PIX_KEY = "9da247bc-183a-4cd4-83c8-b54300b67a8d";
// TODO: substitua pelo número de WhatsApp real (formato internacional, somente dígitos)
const WHATSAPP_NUMBER = "5500000000000";

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

export function PurchaseDialog({ open, onOpenChange, initialOption = "pulseira" }: Props) {
  const [step, setStep] = useState<"form" | "payment" | "done">("form");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [option, setOption] = useState<Option>(initialOption);
  const [tamanho, setTamanho] = useState("");
  const [qtd, setQtd] = useState(1);
  const [copied, setCopied] = useState<"key" | "payload" | null>(null);

  const total = useMemo(() => PRICES[option] * qtd, [option, qtd]);

  const pixPayload = useMemo(
    () =>
      generatePixPayload({
        key: PIX_KEY,
        amount: total,
        merchantName: "Mes da Juventude",
        merchantCity: "SAO PAULO",
      }),
    [total],
  );

  const reset = () => {
    setStep("form");
    setNome(""); setTelefone(""); setOption(initialOption); setTamanho(""); setQtd(1);
  };

  const handleClose = (v: boolean) => {
    if (!v) setTimeout(reset, 200);
    onOpenChange(v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) {
      toast.error("Preencha nome e telefone");
      return;
    }
    if (option === "kit" && !tamanho) {
      toast.error("Selecione o tamanho da camiseta");
      return;
    }
    setStep("payment");
  };

  const copyText = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    const which = text === PIX_KEY ? "key" : "payload";
    setCopied(which);
    toast.success(message);
    setTimeout(() => setCopied(null), 2000);
  };

  const sendWhatsApp = () => {
    const msg = `Olá! Quero comprar para o Mês da Juventude.

Nome completo: ${nome}
Telefone: ${telefone}
Opção escolhida: ${LABELS[option]}
Quantidade: ${qtd}${option === "kit" ? `\nTamanho da camiseta: ${tamanho}` : ""}
Valor total: R$ ${total.toFixed(2).replace(".", ",")}

Já realizei ou irei realizar o pagamento via Pix. Por favor, confirme meu pedido.`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
    setStep("done");
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
                    <span className="font-medium">Pulseira de acesso — R$ 15,00</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border-2 border-border p-3 cursor-pointer hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-accent">
                    <RadioGroupItem value="kit" />
                    <span className="font-medium">Kit pulseira + camiseta — R$ 60,00</span>
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
              <Button type="submit" size="lg" className="w-full text-base h-12">Continuar para pagamento</Button>
            </form>
          </>
        )}

        {step === "payment" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Pagamento via Pix</DialogTitle>
              <DialogDescription>Use a chave abaixo para realizar o pagamento.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="rounded-xl bg-primary p-6 text-primary-foreground">
                <p className="text-sm opacity-90">Valor total</p>
                <p className="text-4xl font-bold">R$ {total.toFixed(2).replace(".", ",")}</p>
              </div>

              <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-white p-5">
                <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Escaneie o QR Code</span>
                <div className="rounded-lg bg-white p-2">
                  <QRCodeSVG value={pixPayload} size={200} level="M" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pix Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input readOnly value={pixPayload} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copyText(pixPayload, "Código Pix copiado!")}>
                    {copied === "payload" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Chave Pix</Label>
                <div className="flex gap-2">
                  <Input readOnly value={PIX_KEY} onFocus={(e) => e.target.select()} className="font-mono" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copyText(PIX_KEY, "Chave Pix copiada!")}>
                    {copied === "key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border-l-4 border-primary bg-accent p-4 text-sm">
                Após realizar o Pix, envie o comprovante pelo WhatsApp para confirmar seu pedido.
              </div>
              <Button onClick={sendWhatsApp} size="lg" className="w-full h-12 bg-[#25D366] hover:bg-[#1ebe5a] text-white">
                <MessageCircle className="mr-2 h-5 w-5" />
                Enviar pedido pelo WhatsApp
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("form")} className="w-full">Voltar</Button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-8 w-8 text-primary-foreground" />
            </div>
            <DialogTitle className="text-2xl">Pedido registrado com sucesso!</DialogTitle>
            <p className="text-muted-foreground">
              Agora realize o pagamento via Pix e envie o comprovante pelo WhatsApp para confirmação.
            </p>
            <Button onClick={() => handleClose(false)} size="lg" className="w-full">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
