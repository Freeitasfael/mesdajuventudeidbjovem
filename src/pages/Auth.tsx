import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const translateError = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este e-mail já tem conta. Faça login.";
  if (m.includes("password should be at least")) return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("pwned") || m.includes("compromised"))
    return "Esta senha apareceu em vazamentos públicos. Escolha outra.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos.";
  return msg;
};

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [alreadySignedIn, setAlreadySignedIn] = useState<string | null>(null);

  // Always send users to /revendedor after login unless an explicit
  // `?next=` deep-link was provided. Uses relative paths so it works on
  // the current origin (custom domain included) without touching lovable.app.
  const resolveDestination = (): string => {
    if (
      next &&
      next.startsWith("/") &&
      !next.startsWith("//") &&
      next !== "/auth" &&
      next !== "/afiliacao"
    ) {
      return next;
    }
    return "/revendedor";
  };


  useEffect(() => {
    document.title = "Acesso — Rifa IDB Jovem";
    let cancelled = false;

    // Detect an existing session but DO NOT auto-redirect away from /auth.
    // The /auth route must always be publicly viewable so users can switch
    // accounts, recover passwords, etc. We only surface a banner offering
    // them a shortcut to their dashboard.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      console.log("[Auth] initial session:", data.session?.user?.email ?? null);
      if (data.session) setAlreadySignedIn(data.session.user.email ?? "");
    });

    // Only redirect on an actual SIGNED_IN event (i.e. the user just logged
    // in via this page). This avoids the bounce-to-home loop that happens
    // when a previously authenticated user opens /auth directly.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] event:", event, "hasSession:", !!session);
      if (cancelled) return;
      if (event === "SIGNED_IN" && session) {
        const dest = resolveDestination();

        console.log("[Auth] SIGNED_IN → navigating to", dest);
        navigate(dest, { replace: true });
      }
      if (event === "SIGNED_OUT") {
        setAlreadySignedIn(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, next]);
  const goToDashboard = () => {
    navigate(resolveDestination(), { replace: true });
  };

  };



  const registerAsSeller = async () => {
    const cleanPhone = whatsapp.replace(/\D/g, "");
    if (cleanPhone.length < 10) return;
    try {
      await supabase.rpc("register_seller_self", {
        _name: fullName.trim(),
        _phone: cleanPhone,
      });
    } catch (err) {
      console.log("[Auth] register_seller_self failed", err);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        // Client-side validation for signup-only fields
        const cleanPhone = whatsapp.replace(/\D/g, "");
        if (fullName.trim().split(/\s+/).length < 2) {
          throw new Error("Informe seu nome e sobrenome");
        }
        if (!/^[0-9]{10,11}$/.test(cleanPhone)) {
          throw new Error("WhatsApp deve ter 10 ou 11 dígitos (DDD + número)");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/revendedor`,
            data: { full_name: fullName.trim(), phone: cleanPhone },
          },
        });
        if (error) throw error;
        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) {
            toast.success("Conta criada! Verifique seu e-mail para confirmar antes de entrar.");
            return;
          }
        }
        await registerAsSeller();
        toast.success("Conta criada! Seu código de revendedor está pronto.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para seu e-mail.");
        setMode("signin");
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro de autenticação";
      toast.error(translateError(raw));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/revendedor`,
    });
    if (result.error) {
      toast.error("Erro ao entrar com Google");
      setLoading(false);
    }
  };

  const title =
    mode === "signin" ? "Entrar" : mode === "signup" ? "Criar sua conta" : "Recuperar senha";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6">
        <Link to="/rifa" className="text-xs text-muted-foreground hover:text-foreground">
          ← Voltar para rifa
        </Link>
        {alreadySignedIn && (
          <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs">
            <p className="text-muted-foreground">
              Você já está conectado como <strong>{alreadySignedIn}</strong>.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="text-foreground underline hover:no-underline"
                onClick={goToDashboard}
              >
                Ir para o painel
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                className="text-foreground underline hover:no-underline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setAlreadySignedIn(null);
                }}
              >
                Sair desta conta
              </button>
            </div>
          </div>
        )}
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {mode === "forgot"
            ? "Informe seu e-mail e enviaremos um link para redefinir a senha."
            : mode === "signup"
            ? "Crie sua conta e receba automaticamente seu código de revendedor."
            : "Acesse o painel de revendedor ou administrador."}
        </p>

        <form onSubmit={handleEmail} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  placeholder="Maria Silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  inputMode="numeric"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  autoComplete="tel"
                  placeholder="11987654321"
                />
                <p className="text-xs text-muted-foreground">DDD + número, apenas dígitos.</p>
              </div>
            </>
          )}
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
          {mode !== "forgot" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setMode("forgot")}
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
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
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? "Aguarde..."
              : mode === "signin"
              ? "Entrar"
              : mode === "signup"
              ? "Criar conta"
              : "Enviar link de recuperação"}
          </Button>
        </form>

        {mode !== "forgot" && (
          <>
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
            {mode === "signup" && (
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Após entrar com Google, complete seus dados na tela do revendedor.
              </p>
            )}
          </>
        )}

        <button
          type="button"
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() =>
            setMode(mode === "signin" ? "signup" : "signin")
          }
        >
          {mode === "signup"
            ? "Já tem conta? Entrar"
            : mode === "forgot"
            ? "Voltar para o login"
            : "Não tem conta? Criar uma"}
        </button>
      </Card>
    </main>
  );
};

export default Auth;
