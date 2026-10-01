import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FolderKanban, Share2, Check, X, Bookmark, RotateCcw, Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const statusColors = {
  "Em Orçamentação": "bg-slate-100 text-slate-700",
  "Em Projeto": "bg-blue-100 text-blue-700",
  "Em Montagem": "bg-amber-100 text-amber-700",
  "Aguardando Cliente": "bg-purple-100 text-purple-700",
  "Concluído": "bg-green-100 text-green-700",
};
const STATUS_OPTS = ["Em Orçamentação", "Em Projeto", "Em Montagem", "Aguardando Cliente", "Concluído"];
const fmtDate = (d) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };

export default function Projects() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [projects, setProjects] = useState([]);
  const [myShares, setMyShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cliente: "", descricao: "" });
  const [saving, setSaving] = useState(false);
  const saved = (() => { try { return JSON.parse(localStorage.getItem("voltflow_projects_filter") || "null"); } catch { return null; } })();
  const [statusFilter, setStatusFilter] = useState(saved?.statusFilter || "todos");
  const [sortBy, setSortBy] = useState(saved?.sortBy || "recentes");
  const [dateFilter, setDateFilter] = useState(saved?.dateFilter || "todos");
  const [dateFrom, setDateFrom] = useState(saved?.dateFrom || "");
  const [dateTo, setDateTo] = useState(saved?.dateTo || "");
  const [search, setSearch] = useState(saved?.search || "");
  const { toast } = useToast();

  const saveFilter = () => {
    localStorage.setItem("voltflow_projects_filter", JSON.stringify({ statusFilter, sortBy, dateFilter, dateFrom, dateTo, search }));
    toast({ title: "Filtro salvo", description: "Será aplicado nas próximas visitas." });
  };
  const clearFilters = () => {
    setStatusFilter("todos"); setSortBy("recentes"); setDateFilter("todos"); setDateFrom(""); setDateTo(""); setSearch("");
    localStorage.removeItem("voltflow_projects_filter");
    toast({ title: "Filtros limpos" });
  };

  const inDateRange = (created) => {
    if (dateFilter === "todos") return true;
    if (!created) return false;
    const d = new Date(created);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (dateFilter) {
      case "hoje": return d >= startOfToday && d < new Date(startOfToday.getTime() + 86400000);
      case "semana": { const start = new Date(startOfToday); start.setDate(start.getDate() - start.getDay()); return d >= start && d < new Date(start.getTime() + 7 * 86400000); }
      case "mes": return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      case "30d": return d >= new Date(startOfToday.getTime() - 30 * 86400000);
      case "90d": return d >= new Date(startOfToday.getTime() - 90 * 86400000);
      case "intervalo": {
        if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
        if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
        return true;
      }
      default: return true;
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [projs, shares] = await Promise.all([
        base44.entities.Project.list("-created_date", 200),
        base44.entities.ProjectShare.list("-created_date", 200),
      ]);
      setProjects(projs);
      setMyShares(shares.filter(s => s.shared_with_email === user?.email));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.Project.create({ ...form, status: "Em Orçamentação", progresso: 0 });
      setOpen(false);
      setForm({ nome: "", cliente: "", descricao: "" });
      load();
      toast({ title: "Projeto criado" });
    } finally {
      setSaving(false);
    }
  };

  const accept = async (s) => { await base44.entities.ProjectShare.update(s.id, { status: "aceito" }); load(); toast({ title: "Convite aceito" }); };
  const decline = async (s) => { await base44.entities.ProjectShare.update(s.id, { status: "recusado" }); load(); toast({ title: "Convite recusado" }); };

  const pending = myShares.filter(s => s.status === "pendente");
  const accepted = myShares.filter(s => s.status === "aceito");
  const shareMap = Object.fromEntries(accepted.map(s => [s.projeto_id, s.permissao]));

  const filtered = () => {
    let list = [...projects].filter(p => inDateRange(p.created_date));
    if (statusFilter === "concluidos") list = list.filter(p => p.status === "Concluído");
    else if (statusFilter === "ativos") list = list.filter(p => p.status !== "Concluído");
    else if (statusFilter !== "todos") list = list.filter(p => p.status === statusFilter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => (p.nome + " " + p.cliente + " " + (p.descricao || "")).toLowerCase().includes(q));
    }

    switch (sortBy) {
      case "nome-asc": list.sort((a, b) => (a.nome || "").localeCompare(b.nome || "")); break;
      case "nome-desc": list.sort((a, b) => (b.nome || "").localeCompare(a.nome || "")); break;
      case "prog-asc": list.sort((a, b) => (a.progresso || 0) - (b.progresso || 0)); break;
      case "prog-desc": list.sort((a, b) => (b.progresso || 0) - (a.progresso || 0)); break;
      default: break;
    }
    return list;
  };

  const list = filtered();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Projetos</h1>
          <p className="text-muted-foreground text-sm mt-1">Fichas técnicas e workflow de montagem</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" /> Novo Projeto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Abrir Novo Projeto</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2"><Label>Nome do Projeto *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Cliente *</Label><Input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar Projeto"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {pending.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-indigo-600" />
              <h3 className="font-medium text-sm">Convites de compartilhamento</h3>
            </div>
            <div className="space-y-2">
              {pending.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.projeto_nome || "Projeto"}</p>
                    <p className="text-xs text-muted-foreground">{s.permissao === "editor" ? "Editor" : "Visualizador"}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => accept(s)}><Check className="w-4 h-4 mr-1" /> Aceitar</Button>
                    <Button size="sm" variant="outline" onClick={() => decline(s)}><X className="w-4 h-4 mr-1" /> Recusar</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar projeto..." className="h-8 w-56 text-xs pl-8" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativos">Ativos (em execução)</SelectItem>
              <SelectItem value="concluidos">Concluídos</SelectItem>
              {STATUS_OPTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ordenar:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Recentes</SelectItem>
              <SelectItem value="nome-asc">Nome (A-Z)</SelectItem>
              <SelectItem value="nome-desc">Nome (Z-A)</SelectItem>
              <SelectItem value="prog-asc">Progresso (menor)</SelectItem>
              <SelectItem value="prog-desc">Progresso (maior)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Criação:</span>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Esta semana</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="intervalo">Período...</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {dateFilter === "intervalo" && (
          <div className="flex items-center gap-1">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-36 text-xs" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={saveFilter}><Bookmark className="w-3.5 h-3.5 mr-1" /> Salvar filtro</Button>
          <Button size="sm" variant="ghost" onClick={clearFilters}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Limpar</Button>
          <span className="text-xs text-muted-foreground">{list.length} projeto(s)</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
      ) : list.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum projeto encontrado com os filtros atuais.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map(p => {
            const shared = shareMap[p.id];
            return (
              <Link key={p.id} to={`/projetos/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.cliente}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${statusColors[p.status] || "bg-gray-100 text-gray-600"}`}>{p.status}</span>
                    </div>
                    {shared && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 mb-3">
                        Compartilhado · {shared === "editor" ? "Editor" : "Visualizador"}
                      </span>
                    )}
                    <div className="text-xs text-muted-foreground space-y-0.5 mb-4">
                      {p.tensao_nominal && <p>Tensão: {p.tensao_nominal}</p>}
                      {p.corrente_curto_circuito && <p>Icc: {p.corrente_curto_circuito}</p>}
                      {p.norma_aplicavel && <p>Norma: {p.norma_aplicavel}</p>}
                      {p.status === "Concluído" && p.data_conclusao && <p className="text-green-600">Concluído em {fmtDate(p.data_conclusao)}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${p.progresso || 0}%` }} />
                      </div>
                      <span className="text-xs font-medium w-9 text-right">{p.progresso || 0}%</span>
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