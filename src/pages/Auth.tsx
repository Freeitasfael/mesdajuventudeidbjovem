import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const resolveDestination = async (uid?: string): Promise<string> => {
    if (next) return next;
    if (!uid) return "/revendedor";
    // Admin → /admin; todos os demais usuários são revendedores por padrão
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (roleRow) return "/admin";
    return "/revendedor";
  };

  useEffect(() => {
    document.title = "Acesso — Rifa IDB Jovem";
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const dest = await resolveDestination(data.session.user.id);
        navigate(dest, { replace: true });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session) {
        const dest = await resolveDestination(session.user.id);
        navigate(dest, { replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, next]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${next || "/revendedor"}` },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu e-mail para confirmar.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro de autenticação");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${next || "/revendedor"}`,
    });
    if (result.error) {
      toast.error("Erro ao entrar com Google");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6">
        <Link
          to="/rifa"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Voltar para rifa
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          {mode === "signin" ? "Entrar" : "Criar sua conta"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Acesse o painel de revendedor ou administrador.
        </p>

        <form onSubmit={handleEmail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          ou
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={loading}
        >
          Continuar com Google
        </Button>

        <button
          type="button"
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin"
            ? "Não tem conta? Criar uma"
            : "Já tem conta? Entrar"}
        </button>
      </Card>
    </main>
  );
};

export default Auth;
