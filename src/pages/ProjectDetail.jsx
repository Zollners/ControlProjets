import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ProjectMTD from "@/components/project/ProjectMTD";
import ProjectNotes from "@/components/project/ProjectNotes";
import ProjectKanban from "@/components/project/ProjectKanban";
import ProjectSchedule from "@/components/project/ProjectSchedule";
import ProjectBom from "@/components/project/ProjectBom";
import ProjectAsBuilt from "@/components/project/ProjectAsBuilt";
import ProjectShareDialog from "@/components/project/ProjectShareDialog";
import { DirtyGuardProvider } from "@/components/project/DirtyGuardContext";

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentTab, setCurrentTab] = useState("mtd");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const guardApi = useRef(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const p = await base44.entities.Project.get(id);
      setProject(p);
      try {
        setShares(await base44.entities.ProjectShare.filter({ projeto_id: id }));
      } catch (e) { /* ignore */ }
    } catch (e) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const handler = (e) => {
      if (guardApi.current?.isAnyDirty?.()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }
  if (notFound) {
    return <Card><CardContent className="py-16 text-center"><p className="text-muted-foreground">Projeto não encontrado.</p><Button variant="outline" className="mt-4" onClick={() => navigate("/projetos")}>Voltar</Button></CardContent></Card>;
  }

  const isOwner = project.created_by_id === user?.id;
  const isAdmin = user?.role === "admin";
  const canManage = isOwner || isAdmin;
  const myShare = shares.find(s => s.shared_with_email === user?.email && s.status === "aceito");
  const canEdit = isAdmin || isOwner || myShare?.permissao === "editor";

  const concluir = async () => {
    if (!window.confirm("Deseja concluir este projeto? O status será definido como Concluído e a data de conclusão será registrada.")) return;
    const today = new Date().toISOString().slice(0, 10);
    const updated = await base44.entities.Project.update(project.id, { status: "Concluído", data_conclusao: project.data_conclusao || today, progresso: 100 });
    setProject(updated);
    toast({ title: "Projeto concluído" });
  };
  const reabrir = async () => {
    if (!window.confirm("Reabrir este projeto? O status voltará para Em Projeto.")) return;
    const updated = await base44.entities.Project.update(project.id, { status: "Em Projeto" });
    setProject(updated);
    try {
      const res = await base44.functions.invoke("updateProjectProgress", { project_id: project.id });
      const prog = res?.data?.progresso ?? res?.progresso;
      if (typeof prog === "number") setProject(p => p ? { ...p, progresso: prog } : p);
    } catch (e) {}
    toast({ title: "Projeto reaberto" });
  };

  const handleProgressChange = (prog) => setProject(p => p ? { ...p, progresso: prog } : p);

  const leaveTo = () => {
    if (pendingTab === "__back__") navigate("/projetos");
    else setCurrentTab(pendingTab);
  };
  const handleTabChange = (newTab) => {
    if (guardApi.current?.isAnyDirty?.()) {
      setPendingTab(newTab);
      setConfirmOpen(true);
    } else {
      setCurrentTab(newTab);
    }
  };
  const handleBack = () => {
    if (guardApi.current?.isAnyDirty?.()) {
      setPendingTab("__back__");
      setConfirmOpen(true);
    } else {
      navigate("/projetos");
    }
  };
  const salvarESair = async () => {
    try { await guardApi.current?.saveAll?.(); } catch (e) { /* ignore */ }
    leaveTo();
    setConfirmOpen(false);
  };
  const sairSemSalvar = () => { leaveTo(); setConfirmOpen(false); };
  const cancelar = () => { setConfirmOpen(false); setPendingTab(null); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-heading font-semibold">{project.nome}</h1>
          <p className="text-sm text-muted-foreground">{project.cliente}</p>
          {myShare && (
            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              Compartilhado · {myShare.permissao === "editor" ? "Editor" : "Visualizador"}
            </span>
          )}
        </div>
        {canEdit && project.status !== "Concluído" && (
          <Button size="sm" variant="outline" onClick={concluir}><CheckCircle2 className="w-4 h-4 mr-1" /> Concluir</Button>
        )}
        {canEdit && project.status === "Concluído" && (
          <Button size="sm" variant="outline" onClick={reabrir}><RotateCcw className="w-4 h-4 mr-1" /> Reabrir</Button>
        )}
        {canManage && <ProjectShareDialog project={project} />}
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Progresso</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-32 h-2.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${project.progresso || 0}%` }} />
            </div>
            <span className="font-semibold">{project.progresso || 0}%</span>
          </div>
        </div>
      </div>

      <DirtyGuardProvider apiRef={guardApi}>
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="flex w-full overflow-x-auto max-w-2xl h-auto">
          <TabsTrigger value="mtd" className="flex-1 min-w-[80px]">MTD</TabsTrigger>
          <TabsTrigger value="anotacoes" className="flex-1 min-w-[80px]">Anotações</TabsTrigger>
          <TabsTrigger value="tarefas" className="flex-1 min-w-[80px]">Tarefas</TabsTrigger>
          <TabsTrigger value="cronograma" className="flex-1 min-w-[80px]">Cronograma</TabsTrigger>
          <TabsTrigger value="bom" className="flex-1 min-w-[80px]">BOM</TabsTrigger>
          <TabsTrigger value="asbuilt" className="flex-1 min-w-[80px]">As-Built</TabsTrigger>
        </TabsList>
        <TabsContent value="mtd" className="mt-6">
          <ProjectMTD project={project} onUpdate={setProject} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="anotacoes" className="mt-6">
          <ProjectNotes projectId={project.id} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="tarefas" className="mt-6">
          <ProjectKanban projectId={project.id} canEdit={canEdit} onProgressChange={handleProgressChange} />
        </TabsContent>
        <TabsContent value="cronograma" className="mt-6">
          <ProjectSchedule projectId={project.id} canEdit={canEdit} onProgressChange={handleProgressChange} />
        </TabsContent>
        <TabsContent value="bom" className="mt-6">
          <ProjectBom project={project} canEdit={canEdit} onProjectUpdate={setProject} />
        </TabsContent>
        <TabsContent value="asbuilt" className="mt-6">
          <ProjectAsBuilt projectId={project.id} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
      </DirtyGuardProvider>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Alterações não salvas</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Você tem alterações não salvas. Deseja sair sem salvar e perder os dados?</p>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch">
            {guardApi.current?.hasSaveableDirty?.() && (
              <Button onClick={salvarESair} className="w-full">Salvar e sair</Button>
            )}
            <Button variant="outline" onClick={sairSemSalvar} className="w-full">Sair sem salvar</Button>
            <Button variant="ghost" onClick={cancelar} className="w-full">Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}