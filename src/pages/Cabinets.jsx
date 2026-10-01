import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Box } from "lucide-react";

const empty = { modelo: "", fabricante: "", largura: 0, altura: 0, profundidade: 0, ip_protecao: "", observacoes: "" };

export default function Cabinets() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await base44.entities.Cabinet.list("-created_date", 200));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (item) => { setForm(item); setEditId(item.id); setOpen(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, largura: Number(form.largura), altura: Number(form.altura), profundidade: Number(form.profundidade) };
      if (editId) await base44.entities.Cabinet.update(editId, payload);
      else await base44.entities.Cabinet.create(payload);
      setOpen(false); load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este gabinete?")) return;
    await base44.entities.Cabinet.delete(id); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Gabinetes</h1>
          <p className="text-muted-foreground text-sm mt-1">Dimensões de painéis homologados (para cálculos de espaço e dissipação)</p>
        </div>
        {isAdmin && <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Gabinete</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Box className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum gabinete cadastrado.</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Modelo</th>
                <th className="px-4 py-2.5 font-medium">Fabricante</th>
                <th className="px-4 py-2.5 font-medium">Largura (mm)</th>
                <th className="px-4 py-2.5 font-medium">Altura (mm)</th>
                <th className="px-4 py-2.5 font-medium">Profundidade (mm)</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
                {isAdmin && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className={idx % 2 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-2.5 font-medium">{item.modelo}</td>
                  <td className="px-4 py-2.5">{item.fabricante || "—"}</td>
                  <td className="px-4 py-2.5">{item.largura}</td>
                  <td className="px-4 py-2.5">{item.altura}</td>
                  <td className="px-4 py-2.5">{item.profundidade}</td>
                  <td className="px-4 py-2.5">{item.ip_protecao || "—"}</td>
                  {isAdmin && (
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(item)} className="text-muted-foreground hover:text-primary"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Editar Gabinete" : "Novo Gabinete"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Modelo *</Label><Input value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Fabricante</Label><Input value={form.fabricante} onChange={e => setForm({ ...form, fabricante: e.target.value })} /></div>
              <div className="space-y-2"><Label>Largura (mm) *</Label><Input type="number" value={form.largura} onChange={e => setForm({ ...form, largura: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Altura (mm) *</Label><Input type="number" value={form.altura} onChange={e => setForm({ ...form, altura: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Profundidade (mm) *</Label><Input type="number" value={form.profundidade} onChange={e => setForm({ ...form, profundidade: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Grau de Proteção</Label><Input value={form.ip_protecao} onChange={e => setForm({ ...form, ip_protecao: e.target.value })} placeholder="IP55" /></div>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={3} /></div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}