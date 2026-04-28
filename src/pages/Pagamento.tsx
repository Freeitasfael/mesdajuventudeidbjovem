import { useParams, Link } from "react-router-dom";

const Pagamento = () => {
  const { orderId } = useParams();
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <Link to="/rifa" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar para rifa
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Pagamento PIX</h1>
        </div>
      </header>
      <section className="container py-12 max-w-xl">
        <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Pedido</p>
          <p className="font-mono text-xs break-all">{orderId}</p>
          <p className="text-sm text-muted-foreground pt-4">
            A geração do QR Code PIX será habilitada na Fase 3, quando o token do Mercado Pago for configurado.
          </p>
        </div>
      </section>
    </main>
  );
};

export default Pagamento;
