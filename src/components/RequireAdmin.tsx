import { useEffect, useState, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}

/** Guards admin routes — requires authenticated session AND admin role. */
export const RequireAdmin = ({ children }: Props) => {
  const [state, setState] = useState<"loading" | "ok" | "noauth" | "noadmin">(
    "loading"
  );

  useEffect(() => {
    let active = true;

    const check = async (userId: string | undefined) => {
      if (!userId) {
        if (active) setState("noauth");
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!active) return;
      if (error || !data) setState("noadmin");
      else setState("ok");
    };

    // Listener first so we don't miss session restore events
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      check(session?.user?.id);
    });
    supabase.auth.getSession().then(({ data }) => {
      check(data.session?.user?.id);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);


  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Verificando acesso…</p>
      </main>
    );
  }
  if (state === "noauth") return <Navigate to="/auth" replace />;
  if (state === "noadmin") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-4 text-center">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="text-sm text-muted-foreground">
          Sua conta está autenticada, mas não possui permissão de
          administrador. Peça a um admin existente para conceder o papel
          <code className="mx-1 rounded bg-muted px-1">admin</code>
          ao seu usuário.
        </p>
      </main>
    );
  }
  return <>{children}</>;
};
