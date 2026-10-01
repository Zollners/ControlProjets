import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, StickyNote } from "lucide-react";

const COLORS = {
  "Amarelo": "border-l-yellow-400",
  "Verde": "border-l-emerald-500",
  "Azul": "border-l-blue-500",
  "Vermelho": "border-l-red-500",
};

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ titulo: "", conteudo: "", cor: "Amarelo" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setNotes(await base44.entities.Note.list("-created_date", 200));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ titulo: "", conteudo: "", cor: "Amarelo" }); setOpen(true); };
  const openEdit = (n) => { setEditing(n); setForm({ titulo: n.titulo, conteudo: n.conteudo, cor: n.cor || "Amarelo" }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await base44.entities.Note.update(editing.id, form);
      else await base44.entities.Note.create(form);
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const del = async (n) => {
    if (!confirm("Excluir esta anotação?")) return;
    await base44.entities.Note.delete(n.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Anotações</h1>
          <p className="text-sm text-muted-foreground">Anotações gerais da equipe</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova Anotação</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Editar Anotação" : "Nova Anotação"}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Conteúdo *</Label><Textarea value={form.conteudo} onChange={e => setForm({ ...form, conteudo: e.target.value })} rows={5} required /></div>
              <div className="space-y-2"><Label>Marcação</Label>
                <Select value={form.cor} onValueChange={v => setForm({ ...form, cor: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(COLORS).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
      ) : notes.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <StickyNote className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhuma anotação ainda. Crie a primeira com o botão acima.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map(n => (
            <Card key={n.id} className={`border-l-4 ${COLORS[n.cor] || COLORS["Amarelo"]}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium leading-tight">{n.titulo}</h3>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(n)} className="text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(n)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{n.conteudo}</p>
                {n.created_date && <p className="text-[10px] text-muted-foreground/60 mt-3">{new Date(n.created_date).toLocaleDateString("pt-BR")}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}