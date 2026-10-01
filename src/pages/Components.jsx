import React, { useEffect, useState, useRef } from "react";
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
import { Plus, Pencil, Trash2, Cpu, Search, Download, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIES = ["Disjuntor", "Contator", "Relé", "Borne", "Fusível", "Inversor", "Driver", "Cabo", "Barramento", "Sensores", "Comando", "Outros"];

const empty = { fabricante: "", modelo: "", part_number: "", categoria: "Disjuntor", codigo_erp: "", cod_totvs: "", tensao: "", corrente: "", capacidade_ruptura: "", dissipacao_termica: "", especificacoes: "" };

export default function Components() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Component.list("-created_date", 500);
      setItems(data);
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
      if (editId) await base44.entities.Component.update(editId, form);
      else await base44.entities.Component.create(form);
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este componente?")) return;
    await base44.entities.Component.delete(id);
    load();
  };

  const downloadTemplate = () => {
    const csv = "Fabricante;Modelo;Part Number;Codigo ERP;Cod. Totvs;Categoria;Tensao;Corrente;Capacidade de Ruptura;Dissipacao (W);Especificacoes\n" +
      "WEG;CWM63;123456;ERP001;EX001;Disjuntor;380V;63A;36kA;2.5;Disjuntor tripolar 3P\n" +
      "Siemens;3RT2016;3RT2016-1BB40;ERP002;EX002;Contator;24Vdc;25A;;1.2;Contator de comando\n" +
      "Phoenix;ST-UK-5;3031091;ERP003;EX003;Borne;;;;0.5;Borne de passagem cinza\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo_componentes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke("importComponentsFromExcel", { file_url });
      toast({ title: `${res.data.imported} componentes importados` });
      load();
    } catch (err) {
      toast({ title: "Erro ao importar", description: err?.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return !q || (i.fabricante + i.modelo + i.part_number + i.categoria).toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Biblioteca de Componentes</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastro de peças com Fabricante, Modelo e Part Number</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate}><FileSpreadsheet className="w-4 h-4 mr-1" /> Modelo</Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Importar
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
              <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Componente</Button>
            </>
          )}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar componente..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Cpu className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum componente cadastrado.</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Part Number</th>
                <th className="px-4 py-2.5 font-medium">Cód. ERP</th>
                <th className="px-4 py-2.5 font-medium">Cód. Totvs</th>
                <th className="px-4 py-2.5 font-medium">Fabricante</th>
                <th className="px-4 py-2.5 font-medium">Modelo</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium">Tensão</th>
                <th className="px-4 py-2.5 font-medium">Corrente</th>
                <th className="px-4 py-2.5 font-medium">Ruptura</th>
                <th className="px-4 py-2.5 font-medium">Dissipação (W)</th>
                {isAdmin && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr key={item.id} className={idx % 2 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-2.5 font-medium">{item.part_number}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{item.codigo_erp || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{item.cod_totvs || "—"}</td>
                  <td className="px-4 py-2.5">{item.fabricante}</td>
                  <td className="px-4 py-2.5">{item.modelo}</td>
                  <td className="px-4 py-2.5">{item.categoria}</td>
                  <td className="px-4 py-2.5">{item.tensao || "—"}</td>
                  <td className="px-4 py-2.5">{item.corrente || "—"}</td>
                  <td className="px-4 py-2.5">{item.capacidade_ruptura || "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{item.dissipacao_termica != null ? `${item.dissipacao_termica} W` : "—"}</td>
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
          <DialogHeader><DialogTitle>{editId ? "Editar Componente" : "Novo Componente"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Fabricante *</Label><Input value={form.fabricante} onChange={e => setForm({ ...form, fabricante: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Modelo *</Label><Input value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Part Number *</Label><Input value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Código ERP</Label><Input value={form.codigo_erp} onChange={e => setForm({ ...form, codigo_erp: e.target.value })} placeholder="ERP001" /></div>
              <div className="space-y-2"><Label>Cód. Totvs</Label><Input value={form.cod_totvs} onChange={e => setForm({ ...form, cod_totvs: e.target.value })} placeholder="EX001" /></div>
              <div className="space-y-2"><Label>Categoria *</Label>
                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Tensão</Label><Input value={form.tensao} onChange={e => setForm({ ...form, tensao: e.target.value })} placeholder="380V" /></div>
              <div className="space-y-2"><Label>Corrente</Label><Input value={form.corrente} onChange={e => setForm({ ...form, corrente: e.target.value })} placeholder="63A" /></div>
              <div className="space-y-2"><Label>Capacidade de Ruptura</Label><Input value={form.capacidade_ruptura} onChange={e => setForm({ ...form, capacidade_ruptura: e.target.value })} placeholder="36kA" /></div>
              <div className="space-y-2"><Label>Dissipação Térmica (W)</Label><Input type="number" step="0.1" value={form.dissipacao_termica ?? ""} onChange={e => setForm({ ...form, dissipacao_termica: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="Ex: 15" /></div>
              <div className="space-y-2 col-span-2"><Label>Especificações</Label><Input value={form.especificacoes} onChange={e => setForm({ ...form, especificacoes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}