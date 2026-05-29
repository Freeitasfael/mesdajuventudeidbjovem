import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw } from "lucide-react";

interface AdminRow {
  user_id: string;
  email: string;
  created_at: string;
}

export function AdminsPanel() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: u }] = await Promise.all([
      supabase.rpc("admin_list_admins"),
      supabase.auth.getUser(),
    ]);
    if (data) setAdmins(data as AdminRow[]);
    setMe(u?.user?.id ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addAdmin = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) {
      toast.error("Informe um email válido");
      return;
    }
    setAdding(true);
    const { error } = await supabase.rpc("admin_add_admin_by_email", { _email: e });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Admin adicionado");
    setEmail("");
    load();
  };

  const removeAdmin = async (id: string) => {
    if (!confirm("Remover privilégio de admin deste usuário?")) return;
    const { error } = await supabase.rpc("admin_remove_admin", { _user_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Admin removido");
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 max-w-2xl space-y-3">
        <div>
          <h3 className="font-semibold">Adicionar novo administrador</h3>
          <p className="text-xs text-muted-foreground">
            O usuário precisa já ter conta criada. Informe o email cadastrado.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="adminEmail" className="sr-only">Email</Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAdmin()}
            />
          </div>
          <Button onClick={addAdmin} disabled={adding || !email.trim()}>
            <Plus className="mr-2 h-4 w-4" /> {adding ? "Adicionando..." : "Adicionar"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Administradores ativos ({admins.length})</p>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Recarregar
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Desde</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.user_id} className="border-t border-border">
                <td className="px-4 py-3">
                  {a.email}
                  {a.user_id === me && (
                    <span className="ml-2 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase">
                      você
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={a.user_id === me}
                    onClick={() => removeAdmin(a.user_id)}
                    title={a.user_id === me ? "Você não pode remover a si mesmo" : "Remover admin"}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum admin cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
