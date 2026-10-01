import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderKanban, Cpu, CheckCircle2, Activity, ArrowRight, Plus, CalendarClock, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from "recharts";

const STATUS_COLORS = {
  "Em Orçamentação": "#f59e0b",
  "Em Projeto": "#3b82f6",
  "Em Montagem": "#8b5cf6",
  "Aguardando Cliente": "#f97316",
  "Concluído": "#22c55e",
};

const StatCard = ({ icon: Icon, label, value, to }) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-heading font-semibold mt-1">{value}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
      {to && (
        <Link to={to} className="inline-flex items-center text-xs text-muted-foreground hover:text-primary mt-4">
          Ver todos <ArrowRight className="w-3 h-3 ml-1" />
        </Link>
      )}
    </CardContent>
  </Card>
);

const daysLabel = (dateStr) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return { text: `Atrasada ${Math.abs(diff)}d`, overdue: true };
  if (diff === 0) return { text: "Vence hoje", overdue: false };
  if (diff === 1) return { text: "Vence amanhã", overdue: false };
  return { text: `Vence em ${diff}d`, overdue: false };
};

export default function Home() {
  const [stats, setStats] = useState({ projects: 0, active: 0, done: 0, components: 0 });
  const [recent, setRecent] = useState([]);
  const [avgProgress, setAvgProgress] = useState(0);
  const [statusData, setStatusData] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [projects, components, tasks] = await Promise.all([
          base44.entities.Project.list("-created_date", 50),
          base44.entities.Component.list("-created_date", 1),
          base44.entities.Task.list("-data_fim", 100),
        ]);
        setRecent(projects.slice(0, 5));
        setStats({
          projects: projects.length,
          active: projects.filter(p => p.status !== "Concluído").length,
          done: projects.filter(p => p.status === "Concluído").length,
          components: components.length,
        });
        const avg = projects.length
          ? Math.round(projects.reduce((s, p) => s + (Number(p.progresso) || 0), 0) / projects.length)
          : 0;
        setAvgProgress(avg);
        setStatusData(
          Object.keys(STATUS_COLORS)
            .map(s => ({ name: s, total: projects.filter(p => p.status === s).length, fill: STATUS_COLORS[s] }))
            .filter(s => s.total > 0)
        );

        const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const limit = new Date(today); limit.setDate(limit.getDate() + 7);
        const up = tasks
          .filter(t => t.data_fim && t.status !== "Finalizado")
          .map(t => {
            const d = new Date(t.data_fim); d.setHours(0, 0, 0, 0);
            return { ...t, _d: d, projeto: projectMap[t.projeto_id] };
          })
          .filter(t => t._d <= limit)
          .sort((a, b) => a._d - b._d)
          .slice(0, 6);
        setUpcoming(up);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-semibold">Painel de Controle</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do progresso, status dos projetos e prazos próximos</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FolderKanban} label="Projetos" value={stats.projects} to="/projetos" />
        <StatCard icon={Activity} label="Em Andamento" value={stats.active} to="/projetos" />
        <StatCard icon={CheckCircle2} label="Concluídos" value={stats.done} to="/projetos" />
        <StatCard icon={Cpu} label="Componentes" value={stats.components} to="/componentes" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Progresso Total</CardTitle></CardHeader>
          <CardContent>
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: "progresso", value: avgProgress, fill: "hsl(var(--primary))" }]} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" background cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-heading font-semibold">{avgProgress}%</span>
                <span className="text-xs text-muted-foreground">progresso médio</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Projetos por Status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={statusData.length * 44 + 20}>
                <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 20 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fillOpacity: 0.1 }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5" /> Próximas Tarefas Vencendo</CardTitle>
          <Link to="/calendario"><Button size="sm" variant="outline">Ver calendário</Button></Link>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma tarefa vencendo nos próximos 7 dias. 🎉</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(t => {
                const { text, overdue } = daysLabel(t.data_fim);
                return (
                  <Link
                    key={t.id}
                    to={t.projeto ? `/projetos/${t.projeto_id}` : "/projetos"}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.projeto?.nome || "—"} · {t.fase}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full shrink-0 ml-3 ${overdue ? "bg-red-50 text-red-700 border border-red-100" : "bg-amber-50 text-amber-700 border border-amber-100"}`}>
                      {overdue && <AlertTriangle className="w-3 h-3" />}{text}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Projetos Recentes</CardTitle>
          <Link to="/projetos">
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Novo Projeto
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum projeto cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {recent.map(p => (
                <Link
                  key={p.id}
                  to={`/projetos/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.cliente} · {p.norma_aplicavel}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-28 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${p.progresso || 0}%` }} />
                    </div>
                    <span className="text-sm font-medium w-10 text-right">{p.progresso || 0}%</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}