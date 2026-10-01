import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Download,
  Crosshair,
  Flag,
  Trash2,
  Pencil,
  Search,
} from "lucide-react";
import GanttTimeline from "@/components/gantt/GanttTimeline";
import { ZOOM, STATUS_COLOR, FASE_COLOR, fmtBr } from "@/components/gantt/ganttUtils";

const FASES = [
  "Projeto Lógico",
  "Layout Mecânico",
  "Suprimentos",
  "Montagem de Barramento",
  "Fiação",
  "Ensaios de Rotina",
];
const STATUS = ["Em Espera", "Em Execução", "Finalizado", "Aguardando Terceiros"];

const emptyForm = {
  titulo: "",
  projeto_id: "",
  fase: "Projeto Lógico",
  status: "Em Espera",
  responsavel: "",
  descricao: "",
  data_inicio: "",
  data_fim: "",
  progresso: 0,
  dependencias: [],
};

export default function Gantt() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = user?.role === "admin";

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoomKey, setZoomKey] = useState("Semana");
  const [showCritical, setShowCritical] = useState(false);
  const [filters, setFilters] = useState({ projeto: "all", fase: "all", status: "all", q: "" });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [tks, prjs] = await Promise.all([
        base44.entities.Task.list("-created_date", 1000),
        base44.entities.Project.list("-created_date", 500),
      ]);
      setTasks(tks);
      setProjects(prjs);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => (filters.projeto === "all" ? true : t.projeto_id === filters.projeto))
      .filter((t) => (filters.fase === "all" ? true : t.fase === filters.fase))
      .filter((t) => (filters.status === "all" ? true : t.status === filters.status))
      .filter((t) =>
        filters.q ? (t.titulo || "").toLowerCase().includes(filters.q.toLowerCase()) : true
      )
      .sort((a, b) => {
        const pa = projectMap[a.projeto_id]?.nome || "";
        const pb = projectMap[b.projeto_id]?.nome || "";
        if (pa !== pb) return pa.localeCompare(pb);
        return (a.ordem || 0) - (b.ordem || 0);
      });
  }, [tasks, filters, projectMap]);

  const datedCount = filtered.filter((t) => t.data_inicio && t.data_fim).length;

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, projeto_id: filters.projeto !== "all" ? filters.projeto : projects[0]?.id || "" });
    setOpen(true);
  };
  const openEdit = (task) => {
    setEditing(task);
    setForm({
      titulo: task.titulo || "",
      projeto_id: task.projeto_id || "",
      fase: task.fase || "Projeto Lógico",
      status: task.status || "Em Espera",
      responsavel: task.responsavel || "",
      descricao: task.descricao || "",
      data_inicio: task.data_inicio || "",
      data_fim: task.data_fim || "",
      progresso: Number(task.progresso) || 0,
      dependencias: task.dependencias || [],
    });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.titulo || !form.projeto_id) return;
    setSaving(true);
    try {
      const payload = {
        projeto_id: form.projeto_id,
        titulo: form.titulo,
        fase: form.fase,
        status: form.status,
        responsavel: form.responsavel,
        descricao: form.descricao,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        progresso: Number(form.progresso) || 0,
        dependencias: form.dependencias,
      };
      if (editing) {
        await base44.entities.Task.update(editing.id, payload);
        setTasks((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...payload } : t)));
        toast({ title: "Tarefa atualizada" });
      } else {
        const created = await base44.entities.Task.create(payload);
        setTasks((prev) => [created, ...prev]);
        toast({ title: "Tarefa criada" });
      }
      setOpen(false);
    } catch (err) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    await base44.entities.Task.delete(editing.id);
    setTasks((prev) => prev.filter((t) => t.id !== editing.id));
    toast({ title: "Tarefa removida" });
    setOpen(false);
  };

  const toggleDep = (id) => {
    setForm((f) => ({
      ...f,
      dependencias: f.dependencias.includes(id)
        ? f.dependencias.filter((x) => x !== id)
        : [...f.dependencias, id],
    }));
  };

  const updateTaskDates = async (task) => {
    try {
      const updated = await base44.entities.Task.update(task.id, {
        data_inicio: task.data_inicio,
        data_fim: task.data_fim,
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)));
    } catch (err) {
      toast({ title: "Erro ao mover tarefa", variant: "destructive" });
      load();
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Projeto", "Título", "Fase", "Status", "Responsável", "Início", "Fim", "Progresso", "Dependências"],
      ...filtered.map((t) => [
        projectMap[t.projeto_id]?.nome || "",
        t.titulo,
        t.fase,
        t.status,
        t.responsavel || "",
        t.data_inicio || "",
        t.data_fim || "",
        t.status === "Finalizado" ? 100 : Number(t.progresso) || 0,
        (t.dependencias || []).join(";"),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gantt.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sameProjectTasks = useMemo(
    () =>
      form.projeto_id
        ? tasks.filter((t) => t.projeto_id === form.projeto_id && t.id !== editing?.id)
        : [],
    [tasks, form.projeto_id, editing]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Diagrama de Gantt</h1>
          <p className="text-sm text-muted-foreground">
            Cronograma consolidado de todas as tarefas — arraste as barras para ajustar datas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border border-border overflow-hidden">
            {Object.keys(ZOOM).map((k) => (
              <button
                key={k}
                onClick={() => setZoomKey(k)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  zoomKey === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <Button
            variant={showCritical ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCritical((v) => !v)}
          >
            <Flag className="w-4 h-4 mr-1" /> Caminho crítico
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          {canEdit && (
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Nova tarefa
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefa..."
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="pl-8 w-48"
          />
        </div>
        <Select value={filters.projeto} onValueChange={(v) => setFilters({ ...filters, projeto: v })}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.fase} onValueChange={(v) => setFilters({ ...filters, fase: v })}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Fase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fases</SelectItem>
            {FASES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} tarefas · {datedCount} com datas
        </span>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {STATUS.map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_COLOR[s] }} /> {s}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rotate-45 bg-slate-400" /> Marco (início = fim)
        </span>
        {showCritical && (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm border-2 border-red-500" /> Caminho crítico
          </span>
        )}
        <span className="flex items-center gap-1">
          <Crosshair className="w-3 h-3 text-primary" /> Hoje
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : (
        <GanttTimeline
          tasks={filtered}
          projectMap={projectMap}
          zoom={ZOOM[zoomKey]}
          canEdit={canEdit}
          showCritical={showCritical}
          onUpdateTask={updateTaskDates}
          onBarClick={openEdit}
        />
      )}

      {/* Dialog criar/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Projeto *</Label>
                <Select value={form.projeto_id} onValueChange={(v) => setForm({ ...form, projeto_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fase</Label>
                <Select value={form.fase} onValueChange={(v) => setForm({ ...form, fase: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FASES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Progresso: {form.progresso}%</Label>
              <input
                type="range" min={0} max={100} step={5} value={form.progresso}
                onChange={(e) => setForm({ ...form, progresso: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            {sameProjectTasks.length > 0 && (
              <div className="space-y-2">
                <Label>Dependências (predecessoras)</Label>
                <div className="max-h-32 overflow-y-auto rounded-md border border-border p-2 space-y-1.5">
                  {sameProjectTasks.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.dependencias.includes(t.id)}
                        onCheckedChange={() => toggleDep(t.id)}
                      />
                      <span className="truncate">
                        {t.titulo} <span className="text-muted-foreground">({fmtBr(t.data_inicio)}–{fmtBr(t.data_fim)})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter className="flex items-center justify-between">
              {editing ? (
                <Button type="button" variant="ghost" onClick={remove} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}