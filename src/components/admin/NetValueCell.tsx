import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { feeCents, feeRate, netCents, type PayMethod } from "@/lib/fees";

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function methodLabel(method: PayMethod): string {
  const m = (method ?? "").toString().trim().toLowerCase();
  if (["card", "credit", "credit_card", "debit", "debit_card"].includes(m)) return "Cartão";
  if (["cash", "dinheiro", "manual", "other", "outro", "none"].includes(m)) return "Manual";
  return "PIX";
}

interface Props {
  grossCents: number;
  method: PayMethod;
  compact?: boolean;
}

/**
 * Exibe o valor líquido recebido após taxa do meio de pagamento,
 * com tooltip detalhando bruto, taxa aplicada e desconto.
 */
export function NetValueCell({ grossCents, method, compact = false }: Props) {
  const rate = feeRate(method);
  const fee = feeCents(grossCents, method);
  const net = netCents(grossCents, method);
  const label = methodLabel(method);
  const rateLabel = (rate * 100).toFixed(2).replace(".", ",") + "%";

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span data-priv className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400 cursor-help">
            {fmtBRL(net)}
            {!compact && <Info className="h-3 w-3 opacity-60" />}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-xs">
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Valor bruto</span>
              <span data-priv className="font-medium">{fmtBRL(grossCents)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Pagamento</span>
              <span className="font-medium">{label}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Taxa aplicada</span>
              <span className="font-medium">{rateLabel}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Valor da taxa</span>
              <span data-priv className="font-medium text-destructive">− {fmtBRL(fee)}</span>
            </div>
            <div className="border-t border-border pt-1 mt-1 flex justify-between gap-4">
              <span className="text-muted-foreground">Valor líquido</span>
              <span data-priv className="font-semibold text-emerald-700 dark:text-emerald-400">{fmtBRL(net)}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
