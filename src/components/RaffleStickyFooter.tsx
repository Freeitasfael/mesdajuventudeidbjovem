import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useSelection } from "@/hooks/useSelection";
import { Button } from "@/components/ui/button";

interface Props {
  pricePerNumber: number | null;
}

/**
 * Rodapé fixo de pagamento — renderizado via portal direto no <body>
 * para não ser afetado por overflow, transform ou backdrop-filter de ancestrais.
 */
export const RaffleStickyFooter = ({ pricePerNumber }: Props) => {
  const navigate = useNavigate();
  const { selected, clear } = useSelection();

  if (selected.length === 0) return null;

  const totalCents = pricePerNumber ? pricePerNumber * selected.length : 0;

  const node = (
    <div
      role="region"
      aria-label="Resumo da seleção"
      className="animate-fade-in-up border-t"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        zIndex: 9999,
        backgroundColor: "hsl(var(--hero-bg) / 0.96)",
        borderColor: "hsl(var(--hero-gold) / 0.4)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <div className="container py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0 text-white">
          <p className="text-sm font-semibold">
            {selected.length}{" "}
            {selected.length === 1
              ? "número selecionado"
              : "números selecionados"}
            {pricePerNumber !== null && (
              <>
                {" · "}
                <span
                  className="font-bold"
                  style={{ color: "hsl(var(--hero-gold))" }}
                >
                  R$ {(totalCents / 100).toFixed(2).replace(".", ",")}
                </span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-white/70 truncate font-mono">
            {[...selected]
              .sort((a, b) => a - b)
              .map((n) => n.toString().padStart(3, "0"))
              .join(", ")}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={clear}
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            Limpar
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/checkout")}
            className="font-bold flex-1 sm:flex-initial min-w-[200px]"
            style={{
              backgroundColor: "hsl(var(--hero-gold))",
              color: "hsl(var(--hero-bg))",
            }}
          >
            Finalizar pagamento
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
};
