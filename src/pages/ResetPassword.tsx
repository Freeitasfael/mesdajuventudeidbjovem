import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getSiteUrl } from "@/lib/site-url";

type Status =
  | "loading"
  | "ready"        // valid recovery session OR already logged-in user
  | "invalid"      // token missing / invalid / expired
  | "success";     // password updated

const translateError = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes("same as") || m.includes("should be different"))
    return "A nova senha precisa ser diferente da atual.";
  if (m.includes("pwned") || m.includes("compromised"))
    return "Esta senha apareceu em vazamentos públicos. Escolha outra.";
  if (m.includes("password should be at least"))
    return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("expired") || m.includes("invalid")) return "Link expirado ou inválido.";
  return msg;
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  // Parse hash/query for recovery errors (Supabase returns errors via URL fragment)
  const urlHints = useMemo(() => {
    if (typeof window === "undefined") return { hasRecovery: false, error: null as string | null };
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);
    const error =
      hashParams.get("error_description") ||
      queryParams.get("error_description") ||
      hashParams.get("error") ||
      queryParams.get("error");
    const hasRecovery =
      hashParams.get("type") === "recovery" ||
      queryParams.get("type") === "recovery" ||
      hashParams.has("access_token") ||
      queryParams.has("code");
    return { hasRecovery, error };
  }, []);

  useEffect(() => {
    document.title = "Redefinir senha — Rifa IDB Jovem";

    // Surface explicit recovery errors from the URL immediately.
    if (urlHints.error) {
      setErrorMsg(translateError(urlHints.error.replace(/\+/g, " ")));
      setStatus("invalid");
      return;
    }

    let cancelled = false;
    let settled = false;
    const markReady = () => {
      if (cancelled || settled) return;
      settled = true;
      setStatus("ready");
    };

    // Supabase JS auto-processes the recovery hash/code on load. We listen
    // for both PASSWORD_RECOVERY and an existing session (covers the
    // "logged-in user changing their own password" case too).
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) markReady();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        markReady();
      }
    });

    // If after a short grace period nothing came through AND the URL didn't
    // look like a recovery link, treat as invalid so we can offer a resend.
    const timeout = window.setTimeout(() => {
      if (cancelled || settled) return;
      if (!urlHints.hasRecovery) {
        setErrorMsg("Link de recuperação ausente ou expirado.");
        setStatus("invalid");
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [urlHints]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus("success");
      toast.success("Senha redefinida com sucesso!");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao redefinir senha";
      toast.error(translateError(raw));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
        redirectTo: `${getSiteUrl()}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos um novo link para seu e-mail.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reenviar o link.");
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">Redefinir senha</h1>

        {status === "loading" && (
          <p className="mt-2 text-sm text-muted-foreground">
            Validando link de recuperação...
          </p>
        )}

        {status === "ready" && (
          <>
            <p className="mb-6 mt-2 text-sm text-muted-foreground">
              Defina uma nova senha para sua conta.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          </>
        )}

        {status === "success" && (
          <div className="mt-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Sua senha foi atualizada. Agora você pode entrar com a nova senha.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate("/auth", { replace: true })} className="w-full">
                Ir para o login
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/revendedor", { replace: true })}
                className="w-full"
              >
                Ir para o painel
              </Button>
            </div>
          </div>
        )}

        {status === "invalid" && (
          <div className="mt-2 space-y-4">
            <p className="text-sm text-destructive">
              {errorMsg ?? "Link inválido ou expirado."}
            </p>
            <form onSubmit={handleResend} className="space-y-3">
              <Label htmlFor="resend-email">Reenviar link de recuperação</Label>
              <Input
                id="resend-email"
                type="email"
                required
                placeholder="seu@email.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
              />
              <Button type="submit" disabled={resending} className="w-full">
                {resending ? "Enviando..." : "Enviar novo link"}
              </Button>
            </form>
            <Link
              to="/auth"
              className="block text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Voltar para o login
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
};

export default ResetPassword;
