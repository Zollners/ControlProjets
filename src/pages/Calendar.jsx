import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Trash2, ExternalLink, CalendarDays } from "lucide-react";

const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const TIPO_COLOR = { "Reunião": "bg-purple-500", "Pessoal": "bg-emerald-500", "Outros": "bg-slate-500" };
const STATUS_COLOR = { "Em Espera": "bg-slate-400", "Em Execução": "bg-blue-500", "Finalizado": "bg-green-600", "Aguardando Terceiros": "bg-amber-500" };

const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = keyOf(new Date());
const fmtBr = (d) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const eachDay = (start, end) => {
  const res = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  if (isNaN(cur.getTime()) || isNaN(last.getTime())) return res;
  while (cur <= last) { res.push(keyOf(cur)); cur.setDate(cur.getDate() + 1); }
  return res;
};

export default function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sharedIds, setSharedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [dayKey, setDayKey] = useState(null);
  const [form, setForm] = useState({ titulo: "", data: "", hora: "09:00", tipo: "Reunião", descricao: "", responsavel: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [evs, tks, prjs, shares] = await Promise.all([
        base44.entities.CalendarEvent.list("-created_date", 500),
        base44.entities.Task.list("-created_date", 500),
        base44.entities.Project.list("-created_date", 200),
        base44.entities.ProjectShare.list("-created_date", 200),
      ]);
      setEvents(evs);
      setTasks(tks);
      setProjects(prjs);
      const mine = shares.filter(s => s.shared_with_email === user?.email && s.status === "aceito");
      setSharedIds(new Set(mine.map(s => s.projeto_id)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const byDate = {};
  tasks.forEach(t => {
    if (!t.data_inicio) return;
    if (projectMap[t.projeto_id]?.status === "Concluído") return;
    const end = t.data_fim || t.data_inicio;
    const shared = sharedIds.has(t.projeto_id);
    const color = shared ? "bg-indigo-500" : (STATUS_COLOR[t.status] || "bg-slate-400");
    eachDay(t.data_inicio, end).forEach(key => {
      (byDate[key] ||= []).push({
        kind: "task", title: t.titulo, projeto: projectMap[t.projeto_id]?.nome || "—",
        color, shared, projeto_id: t.projeto_id, status: t.status,
        data_inicio: t.data_inicio, data_fim: t.data_fim,
        progresso: t.status === "Finalizado" ? 100 : (Number(t.progresso) || 0),
      });
    });
  });
  events.forEach(e => {
    const d = e.data_inicio?.slice(0, 10);
    if (d) (byDate[d] ||= []).push({ kind: "event", title: e.titulo, tipo: e.tipo, color: TIPO_COLOR[e.tipo] || "bg-slate-500", event: e });
  });

  const year = month.getFullYear();
  const m = month.getMonth();
  const startDay = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const openNew = (dateStr) => {
    const ds = dateStr || keyOf(new Date());
    setForm({ titulo: "", data: ds, hora: "09:00", tipo: "Reunião", descricao: "", responsavel: "" });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.CalendarEvent.create({
        titulo: form.titulo, descricao: form.descricao, data_inicio: `${form.data}T${form.hora}:00`, tipo: form.tipo, responsavel: form.responsavel,
      });
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (ev) => { await base44.entities.CalendarEvent.delete(ev.id); load(); };
  const canDeleteEvent = (ev) => user?.role === "admin" || ev.created_by_id === user?.id;
  const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  const dayItems = dayKey ? (byDate[dayKey] || []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Calendário Geral</h1>
          <p className="text-sm text-muted-foreground">Projetos ativos por dia — clique em um dia para ver as tarefas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(new Date(year, m - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="font-medium min-w-[130px] text-center text-sm">{MONTHS[m]} {year}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth(new Date(year, m + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); }}>Hoje</Button>
          <Button size="sm" onClick={() => openNew(null)}><Plus className="w-4 h-4 mr-1" /> Evento</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Em execução</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Aguardando terceiros</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Projeto compartilhado</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Reunião</span>
        <span className="text-muted-foreground/70">Projetos concluídos não aparecem</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 bg-muted/50">
              {WEEK.map(w => <div key={w} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground border-r border-border last:border-r-0">{w}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                const key = d ? `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
                const dayEvents = key ? (byDate[key] || []) : [];
                const isToday = key === todayKey;
                const uniqueProjects = [...new Set(dayEvents.filter(e => e.kind === "task").map(e => e.projeto).filter(Boolean))];
                const eventCount = dayEvents.filter(e => e.kind === "event").length;
                return (
                  <div key={i} onClick={() => d && setDayKey(key)}
                    className={`min-h-[96px] border-r border-b border-border p-1 ${d ? "bg-background cursor-pointer hover:bg-muted/30" : "bg-muted/20"} ${isToday ? "ring-1 ring-inset ring-primary" : ""}`}>
                    {d && (
                      <>
                        <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>{d}</div>
                        <div className="space-y-1">
                          {uniqueProjects.slice(0, 2).map((p, j) => (
                            <div key={j} className="text-[10px] truncate rounded bg-muted/60 px-1 py-0.5" title={p}>{p}</div>
                          ))}
                          {uniqueProjects.length > 2 && <div className="text-[10px] text-muted-foreground px-1">+{uniqueProjects.length - 2} projetos</div>}
                          {eventCount > 0 && (
                            <div className="text-[10px] text-muted-foreground px-1 flex items-center gap-1"><CalendarDays className="w-2.5 h-2.5" /> {eventCount} evento(s)</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data *</Label><Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Hora</Label><Input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reunião">Reunião</SelectItem>
                  <SelectItem value="Pessoal">Pessoal</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dayKey} onOpenChange={(o) => !o && setDayKey(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{dayKey ? fmtBr(dayKey) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {dayItems.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum compromisso neste dia.</p>}
            {dayItems.map((ev, i) => (
              ev.kind === "task" ? (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ev.color}`} />
                      <span className="text-sm font-medium truncate">{ev.projeto}</span>
                      {ev.shared && <span className="text-[10px] px-1 rounded bg-indigo-100 text-indigo-700">compart.</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{ev.title} · {ev.status}</p>
                    <p className="text-xs text-muted-foreground">{fmtBr(ev.data_inicio)} → {fmtBr(ev.data_fim)} · {ev.progresso}%</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { const pid = ev.projeto_id; setDayKey(null); navigate(`/projetos/${pid}`); }}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                  </Button>
                </div>
              ) : (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ev.color}`} />
                      <span className="text-sm font-medium truncate">{ev.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{ev.tipo} · {fmtDateTime(ev.event.data_inicio)}</p>
                    {ev.event.responsavel && <p className="text-xs text-muted-foreground">Resp.: {ev.event.responsavel}</p>}
                    {ev.event.descricao && <p className="text-xs text-muted-foreground truncate">{ev.event.descricao}</p>}
                  </div>
                  {canDeleteEvent(ev.event) && (
                    <Button size="sm" variant="ghost" onClick={() => deleteEvent(ev.event)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  )}
                </div>
              )
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { const dk = dayKey; setDayKey(null); openNew(dk); }}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar evento neste dia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}