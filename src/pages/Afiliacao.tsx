import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Handshake, Link2, Trophy, CheckCircle2 } from "lucide-react";

const Afiliacao = () => {
  useEffect(() => {
    document.title = "Seja um Revendedor — Rifa";
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between py-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Programa de Afiliação
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Torne-se um revendedor oficial da rifa.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/rifa">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>
      </header>

      <section className="container max-w-3xl space-y-6 py-10">
        <Card className="p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <Handshake className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Como funciona</h2>
          </div>
          <p className="text-muted-foreground">
            Como revendedor, você recebe um link exclusivo para divulgar a
            rifa. Toda venda feita através do seu link é registrada
            automaticamente em seu nome e contabilizada no ranking público.
          </p>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Step
            icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
            title="1. Cadastre-se"
            text="Crie sua conta para solicitar a afiliação."
          />
          <Step
            icon={<Link2 className="h-5 w-5 text-primary" />}
            title="2. Receba seu link"
            text="Você ganha um código único para compartilhar."
          />
          <Step
            icon={<Trophy className="h-5 w-5 text-primary" />}
            title="3. Suba no ranking"
            text="Acompanhe suas vendas em tempo real."
          />
        </div>

        <Card className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
          <h3 className="text-lg font-semibold">Pronto para começar?</h3>
          <p className="text-sm text-muted-foreground">
            Faça seu cadastro agora e nossa equipe libera sua afiliação.
          </p>
          <Button size="lg" asChild>
            <Link to="/auth">Quero ser revendedor</Link>
          </Button>
        </Card>
      </section>
    </main>
  );
};

const Step = ({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) => (
  <Card className="p-4">
    <div className="mb-2 flex items-center gap-2">
      {icon}
      <p className="font-semibold">{title}</p>
    </div>
    <p className="text-sm text-muted-foreground">{text}</p>
  </Card>
);

export default Afiliacao;
