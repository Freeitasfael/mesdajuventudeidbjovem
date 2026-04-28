import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const REF_STORAGE_KEY = "raffle_ref_code";

/**
 * Public seller landing page: /v/:refCode
 * Validates the ref_code and persists it before redirecting to the raffle.
 */
const Vendedor = () => {
  const { refCode } = useParams<{ refCode: string }>();
  const [status, setStatus] = useState<"loading" | "valid" | "invalid">(
    "loading"
  );

  useEffect(() => {
    const validate = async () => {
      if (!refCode) {
        setStatus("invalid");
        return;
      }
      const { data, error } = await supabase.rpc("get_seller_by_ref", {
        _ref_code: refCode,
      });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setStatus("invalid");
        return;
      }
      localStorage.setItem(REF_STORAGE_KEY, refCode);
      setStatus("valid");
    };
    validate();
  }, [refCode]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Validando link do vendedor…</p>
      </main>
    );
  }

  if (status === "invalid") {
    return <Navigate to="/rifa" replace />;
  }

  return <Navigate to={`/rifa?ref=${refCode}`} replace />;
};

export default Vendedor;
