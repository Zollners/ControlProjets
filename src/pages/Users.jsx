import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users as UsersIcon, Shield, Wrench } from "lucide-react";

const roleLabel = (role) => (role === "admin" ? "Engenharia / Admin" : "Operacional / Montador");

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await base44.entities.User.list());
    } catch (e) {
      setError("Sem permissão para listar usuários. Acesso restrito a administradores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (id, role) => {
    try {
      await base44.entities.User.update(id, { role });
      load();
    } catch (e) {
      alert("Sem permissão para alterar este usuário.");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold">Usuários</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie o acesso das contas. Apenas administradores podem alterar.</p>
      </div>

      {error ? (
        <Card><CardContent className="py-12 text-center"><p className="text-destructive text-sm">{error}</p></CardContent></Card>
      ) : users.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <UsersIcon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum usuário cadastrado.</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">E-mail</th>
                <th className="px-4 py-2.5 font-medium">Acesso</th>
                <th className="px-4 py-2.5 font-medium">Alterar acesso</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => {
                const isSelf = u.id === user?.id;
                return (
                  <tr key={u.id} className={idx % 2 ? "bg-muted/20" : ""}>
                    <td className="px-4 py-2.5 font-medium">
                      <div className="flex items-center gap-2">
                        {u.role === "admin" ? <Shield className="w-4 h-4 text-primary" /> : <Wrench className="w-4 h-4 text-muted-foreground" />}
                        {u.full_name || "—"}{isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{u.email}</td>
                    <td className="px-4 py-2.5">{roleLabel(u.role)}</td>
                    <td className="px-4 py-2.5">
                      <Select value={u.role} onValueChange={v => changeRole(u.id, v)} disabled={isSelf}>
                        <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Engenharia / Admin</SelectItem>
                          <SelectItem value="user">Operacional / Montador</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}