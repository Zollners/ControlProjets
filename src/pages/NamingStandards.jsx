import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";

const TYPES = ["TAG de Componente", "Régua de Bornes", "Cabo", "Documento"];
const empty = { tipo: "TAG de Componente", mascara: "", descricao: "", exemplo: "" };

export default function NamingStandards() {
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
      setItems(await base44.entities.NamingStandard.list("-created_date", 200));
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
      if (editId) await base44.entities.NamingStandard.update(editId, form);
      else await base44.entities.NamingStandard.create(form);
      setOpen(false); load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este padrão?")) return;
    await base44.entities.NamingStandard.delete(id); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Padrões de Nomenclatura</h1>
          <p className="text-muted-foreground text-sm mt-1">Máscaras de TAGs e réguas de bornes (X1 potência, X2 comando...)</p>
        </div>
        {isAdmin && <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Padrão</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Tags className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum padrão cadastrado.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map(item => (
            <Card key={item.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">{item.tipo}</span>
                    <p className="text-2xl font-heading font-semibold mt-1">{item.mascara}</p>
                    <p className="text-sm mt-2">{item.descricao}</p>
                    {item.exemplo && <p className="text-xs text-muted-foreground mt-2">Ex: {item.exemplo}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(item)} className="text-muted-foreground hover:text-primary"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Editar Padrão" : "Novo Padrão"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Máscara *</Label><Input value={form.mascara} onChange={e => setForm({ ...form, mascara: e.target.value })} placeholder="Q1, K1, X1" required /></div>
            <div className="space-y-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="X1 para potência" required /></div>
            <div className="space-y-2"><Label>Exemplo</Label><Input value={form.exemplo} onChange={e => setForm({ ...form, exemplo: e.target.value })} /></div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}