import { useNavigate } from "react-router-dom";
import { useSelection } from "@/hooks/useSelection";
import { Button } from "@/components/ui/button";

interface CheckoutBarProps {
  pricePerNumber: number | null;
}

export const CheckoutBar = ({ pricePerNumber }: CheckoutBarProps) => {
  const navigate = useNavigate();
  const { selected } = useSelection();

  if (selected.length === 0) return null;

  const totalCents = pricePerNumber ? pricePerNumber * selected.length : 0;

  return (
    <div
      role="region"
      aria-label="Resumo do pagamento"
      className="animate-fade-in-up border-t"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        zIndex: 9999,
        backgroundColor: "hsl(var(--hero-bg) / 0.97)",
        borderColor: "hsl(var(--hero-gold) / 0.45)",
        boxShadow: "0 -10px 30px rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="container flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
        <div className="min-w-0 text-white">
          <p className="text-sm font-semibold sm:text-base">
            {selected.length} {selected.length === 1 ? "número selecionado" : "números selecionados"}
          </p>
          <p className="text-lg font-extrabold sm:text-2xl" style={{ color: "hsl(var(--hero-gold))" }}>
            Total: R$ {(totalCents / 100).toFixed(2).replace(".", ",")}
          </p>
        </div>

        <Button
          size="lg"
          onClick={() => navigate("/checkout")}
          className="w-full font-extrabold sm:w-auto sm:min-w-[220px]"
          style={{
            backgroundColor: "hsl(var(--hero-gold))",
            color: "hsl(var(--hero-bg))",
          }}
        >
          Finalizar pagamento
        </Button>
      </div>
    </div>
  );
};