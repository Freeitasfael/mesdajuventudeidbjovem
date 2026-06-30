import { useState } from "react";
import { HelpCircle, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const CHURCH_CODES = [
  "IDBMONTESCLAROS",
  "IDBCANAA",
  "IDBSETORSUL02",
  "IDBSERINGUEIRAS",
  "IDBPATROCINIO",
  "IDBDONAZULMIRA",
  "IDBROOSEVELT",
  "IDBLUIZOTE1",
  "IDBSETORSUL1",
  "IDBSARAIVA",
  "IDBMANSOUR2",
  "IDBARAXA",
  "IDBSHOPPINGPARK",
  "IDBMASOUR",
  "IDBUBERABA",
  "IDBARAGUARI",
  "IDBMARTINS",
];

interface Props {
  onPick?: (code: string) => void;
  className?: string;
}

export function ChurchCodesHelp({ onPick, className }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handlePick = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
    if (onPick) {
      onPick(code);
      toast.success(`Código ${code} selecionado`);
      setOpen(false);
    } else {
      toast.success(`Código ${code} copiado`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={
            "inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline " +
            (className ?? "")
          }
          aria-label="Ver lista de códigos por igreja"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Não sabe o código? Ver lista
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Códigos de identificação por igreja</DialogTitle>
          <DialogDescription>
            Toque em um código para {onPick ? "usá-lo" : "copiá-lo"}. Em caso de dúvida, confirme com o líder da sua igreja.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {CHURCH_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handlePick(code)}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-mono hover:bg-accent transition-colors"
            >
              <span>{code}</span>
              {copied === code ? (
                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
