import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListTodo, Search, AlertTriangle, CalendarClock } from "lucide-react";

const STATUS_COLORS = {
  "Em Espera": "bg-slate-100 text-slate-700",
  "Em Execução": "bg-blue-100 text-blue-700",
  "Aguardando Terceiros": "bg-purple-100 text-purple-700",
  "Finalizado": "bg-green-100 text-green-700",
};
const FASES = ["Projeto Lógico", "Layout Mecânico", "Suprimentos", "Montagem de Barramento", "Fiação", "Ensaios de Rotina"];
const STATUS_OPTS = ["Em Espera", "Em Execução", "Aguardando Terceiros"];

const fmtDate = (d) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const daysLabel = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return { text: `Atrasada ${Math.abs(diff)}d`, overdue: true };
  if (diff === 0) return { text: "Hoje", overdue: false };
  if (diff === 1) return { text: "Amanhã", overdue: false };
  return { text: `Em ${diff}d`, overdue: false };
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pendentes");
  const [faseFilter, setFaseFilter] = useState("todas");

  useEffect(() => {
    (async () => {
      try {
        const [t, p] = await Promise.all([
          base44.entities.Task.list("-data_fim", 500),
          base44.entities.Project.list("-created_date", 200),
        ]);
        setTasks(t);
        setProjects(p);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);

  const filtered = useMemo(() => {
    let list = tasks.filter(t => t.status !== "Finalizado");
    if (statusFilter !== "pendentes") list = list.filter(t => t.status === statusFilter);
    if (faseFilter !== "todas") list = list.filter(t => t.fase === faseFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t => {
        const proj = projectMap[t.projeto_id];
        return (t.titulo + " " + (t.responsavel || "") + " " + (proj?.nome || "") + " " + (proj?.cliente || "")).toLowerCase().includes(q);
      });
    }
    list.sort((a, b) => {
      if (!a.data_fim) return 1;
      if (!b.data_fim) return -1;
      return new Date(a.data_fim) - new Date(b.data_fim);
    });
    return list;
  }, [tasks, projectMap, search, statusFilter, faseFilter]);

  const overdueCount = filtered.filter(t => {
    const d = daysLabel(t.data_fim); return d?.overdue;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><ListTodo className="w-6 h-6" /> Tarefas Pendentes</h1>
        <p className="text-muted-foreground text-sm mt-1">Todas as tarefas não concluídas, ordenadas pelo prazo mais próximo</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por tarefa, projeto, responsável..." className="h-9 pl-8 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">Todas pendentes</SelectItem>
            {STATUS_OPTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={faseFilter} onValueChange={setFaseFilter}>
          <SelectTrigger className="w-48 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as fases</SelectItem>
            {FASES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} tarefa(s){overdueCount > 0 && <span className="text-red-600 font-medium"> · {overdueCount} atrasada(s)</span>}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <ListTodo className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhuma tarefa pendente encontrada. 🎉</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const proj = projectMap[t.projeto_id];
            const dl = daysLabel(t.data_fim);
            return (
              <Link key={t.id} to={proj ? `/projetos/${t.projeto_id}` : "/projetos"} className="block">
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{t.titulo}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[t.status] || "bg-gray-100 text-gray-600"}`}>{t.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {proj?.nome || "—"} · {t.fase}{t.responsavel ? ` · ${t.responsavel}` : ""}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 max-w-[160px] h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${t.progresso || 0}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{t.progresso || 0}%</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {dl && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${dl.overdue ? "bg-red-50 text-red-700 border border-red-100" : "bg-amber-50 text-amber-700 border border-amber-100"}`}>
                            {dl.overdue ? <AlertTriangle className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
                            {dl.text}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{fmtDate(t.data_fim)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}