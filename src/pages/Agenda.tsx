import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  Trello,
  StickyNote,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  Pencil,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Database,
  Link as LinkIcon,
  Table2,
  User,
  Paperclip,
  ChevronDown,
  Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEquipLabel } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; }
interface Empresa { id: string; nome: string; }
interface Contrato { id: string; empresa_id: string; empresas: { nome: string } | null; equipamento_id: string; equipamentos: { tipo: string; modelo: string } | null; }

interface Etapa {
  id: string;
  titulo: string;
  responsavel_nome: string;
  solicitante_nome: string;
  status: "A Fazer" | "Em Andamento" | "Concluído";
  observacoes?: string;
  created_at: string;
}

interface HistoricoEntry {
  data: string;
  usuario: string;
  acao: string;
  detalhes: string;
}

interface AgendaEvent {
  id: string;
  titulo: string;
  descricao: string;
  data_inicio: string;
  data_fim: string | null;
  status: "A Fazer" | "Em Andamento" | "Concluído";
  prioridade: "Baixa" | "Média" | "Alta";
  categoria: "Geral" | "Manutenção" | "Faturamento" | "Reunião" | "Outros";
  equipamento_id: string | null;
  contrato_id: string | null;
  empresa_id: string | null;
  orcamento?: number;
  notas?: string;
  responsavel_nome?: string;
  criador_nome?: string;
  etapas?: Etapa[];
  historico?: HistoricoEntry[];
  arquivos?: string[];
  created_at?: string;
  updated_at?: string;
  // Join references
  equipamentos?: Equipamento | null;
  contratos?: Contrato | null;
  empresas?: Empresa | null;
}

interface StickyItem {
  id: string;
  content: string;
  color: "yellow" | "blue" | "green" | "pink";
  created_at: string;
}

const CATEGORIES = ["Geral", "Manutenção", "Faturamento", "Reunião", "Outros"] as const;
const PRIORITIES = ["Baixa", "Média", "Alta"] as const;
const STATUSES = ["A Fazer", "Em Andamento", "Concluído"] as const;

const stickyColors = {
  yellow: "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-900/50",
  blue: "bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-900/50",
  green: "bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-900/50",
  pink: "bg-pink-100 dark:bg-pink-950/30 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-900/50",
};

export default function Agenda() {
  const { profile } = useAuth();
  const currentUserNome = profile?.nome || "Sistema";
  const [activeTab, setActiveTab] = useState<"kanban" | "calendar" | "notes" | "board">("board");
  const [calendarMode, setCalendarMode] = useState<"day" | "month" | "year">("month");
  
  // Data lists
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [stickies, setStickies] = useState<StickyItem[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [usuarios, setUsuarios] = useState<{ user_id: string; nome: string; }[]>([]);

  // States
  const [loading, setLoading] = useState(true);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Event Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewEvent, setViewEvent] = useState<AgendaEvent | null>(null);

  // Monday Board View & Files States
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [activeFilesEvent, setActiveFilesEvent] = useState<AgendaEvent | null>(null);
  const [newFileUrl, setNewFileUrl] = useState("");
  const [newStageTitle, setNewStageTitle] = useState("");
  const [newStageAssignee, setNewStageAssignee] = useState("");
  const [stageObsInput, setStageObsInput] = useState("");
  const [editingStageObsId, setEditingStageObsId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    titulo: string;
    descricao: string;
    data_inicio: string;
    data_fim: string;
    status: "A Fazer" | "Em Andamento" | "Concluído";
    prioridade: "Baixa" | "Média" | "Alta";
    categoria: "Geral" | "Manutenção" | "Faturamento" | "Reunião" | "Outros";
    equipamento_id: string;
    contrato_id: string;
    empresa_id: string;
    orcamento: number;
    notas: string;
    responsavel_nome: string;
    arquivos: string[];
  }>({
    titulo: "",
    descricao: "",
    data_inicio: new Date().toISOString().slice(0, 16),
    data_fim: "",
    status: "A Fazer",
    prioridade: "Média",
    categoria: "Geral",
    equipamento_id: "none",
    contrato_id: "none",
    empresa_id: "none",
    orcamento: 0,
    notas: "",
    responsavel_nome: "",
    arquivos: [],
  });

  // Calendar date tracker
  const [currentDate, setCurrentDate] = useState(new Date());

  const { toast } = useToast();

  const migrationSql = `-- Copie e execute este comando no SQL Editor da Supabase:

CREATE TABLE IF NOT EXISTS public.agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fim TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'A Fazer',
  prioridade TEXT NOT NULL DEFAULT 'Média',
  categoria TEXT NOT NULL DEFAULT 'Geral',
  equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to agenda" ON public.agenda FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Adiciona novos campos estilo Monday.com caso já tenha a tabela criada:
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS orcamento NUMERIC DEFAULT 0;
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT '';
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS responsavel_nome TEXT DEFAULT '';
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS arquivos TEXT[] DEFAULT '{}';
`;

  // Fetch relations + initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch relations
      const [equipRes, empRes, ctRes, profilesRes] = await Promise.all([
        supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").order("tipo"),
        supabase.from("empresas").select("id, nome").order("nome"),
        supabase.from("contratos").select("id, empresa_id, empresas(nome), equipamento_id, equipamentos(tipo, modelo)"),
        supabase.from("profiles").select("user_id, nome").order("nome")
      ]);

      if (equipRes.data) setEquipamentos(equipRes.data as any);
      if (empRes.data) setEmpresas(empRes.data as any);
      if (ctRes.data) setContratos(ctRes.data as any);
      if (profilesRes.data) setUsuarios(profilesRes.data as any);

      // 2. Fetch agenda events
      const { data: dbEvents, error: dbError } = await supabase
        .from("agenda")
        .select("*, equipamentos:equipamento_id(id, tipo, modelo, tag_placa), empresas:empresa_id(id, nome), contratos:contrato_id(id)")
        .order("data_inicio", { ascending: true });

      if (dbError) {
        // Table doesn't exist
        if (
          dbError.code === "42P01" ||
          dbError.code === "PGRST116" ||
          dbError.message?.includes("schema cache") ||
          dbError.message?.includes("does not exist")
        ) {
          setIsLocalMode(true);
          const localEvents = localStorage.getItem("busato-agenda-events");
          if (localEvents) {
            setEvents(JSON.parse(localEvents));
          }
        } else {
          throw dbError;
        }
      } else if (dbEvents) {
        setIsLocalMode(false);
        setEvents(dbEvents as any);
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar dados", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Fetch stickies
  const fetchStickies = () => {
    const localStickies = localStorage.getItem("busato-agenda-stickies");
    if (localStickies) {
      setStickies(JSON.parse(localStickies));
    } else {
      // Default sticky helper
      const defaults: StickyItem[] = [
        { id: "1", content: "Bem-vindo aos Lembretes Rápidos! Dê dois cliques para editar ou clique no '+' para criar um novo.", color: "yellow", created_at: new Date().toISOString() },
        { id: "2", content: "Lembrar de verificar faturamentos pendentes até sexta-feira.", color: "blue", created_at: new Date().toISOString() }
      ];
      setStickies(defaults);
      localStorage.setItem("busato-agenda-stickies", JSON.stringify(defaults));
    }
  };

  useEffect(() => {
    fetchData();
    fetchStickies();
  }, []);

  // Save events to local storage helper (in local mode)
  const saveLocalEvents = (updated: AgendaEvent[]) => {
    setEvents(updated);
    if (isLocalMode) {
      localStorage.setItem("busato-agenda-events", JSON.stringify(updated));
    }
  };

  // Open Event Dialog for creation
  const openNew = (defaultDate?: Date) => {
    setEditingEvent(null);
    let dateStr = new Date().toISOString().slice(0, 16);
    if (defaultDate) {
      const offsetDate = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000);
      dateStr = offsetDate.toISOString().slice(0, 16);
    }
    setForm({
      titulo: "",
      descricao: "",
      data_inicio: dateStr,
      data_fim: "",
      status: "A Fazer",
      prioridade: "Média",
      categoria: "Geral",
      equipamento_id: "none",
      contrato_id: "none",
      empresa_id: "none",
      orcamento: 0,
      notas: "",
      responsavel_nome: "",
      arquivos: [],
    });
    setDialogOpen(true);
  };

  // Open Event Dialog for editing
  const openEdit = (e: AgendaEvent) => {
    setEditingEvent(e);
    setForm({
      titulo: e.titulo,
      descricao: e.descricao,
      data_inicio: new Date(e.data_inicio).toISOString().slice(0, 16),
      data_fim: e.data_fim ? new Date(e.data_fim).toISOString().slice(0, 16) : "",
      status: e.status,
      prioridade: e.prioridade,
      categoria: e.categoria,
      equipamento_id: e.equipamento_id || "none",
      contrato_id: e.contrato_id || "none",
      empresa_id: e.empresa_id || "none",
      orcamento: Number(e.orcamento || 0),
      notas: e.notas || "",
      responsavel_nome: e.responsavel_nome || "",
      arquivos: e.arquivos || [],
    });
    setDialogOpen(true);
  };

  // Save Event handler
  const handleSaveEvent = async () => {
    if (!form.titulo.trim() || !form.data_inicio) {
      toast({ title: "Erro", description: "O título e a data de início são obrigatórios.", variant: "destructive" });
      return;
    }

    const payload: Partial<AgendaEvent> = {
      titulo: form.titulo,
      descricao: form.descricao,
      data_inicio: new Date(form.data_inicio).toISOString(),
      data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
      status: form.status,
      prioridade: form.prioridade,
      categoria: form.categoria,
      equipamento_id: form.equipamento_id === "none" ? null : form.equipamento_id,
      contrato_id: form.contrato_id === "none" ? null : form.contrato_id,
      empresa_id: form.empresa_id === "none" ? null : form.empresa_id,
      orcamento: Number(form.orcamento || 0),
      notas: form.notas,
      responsavel_nome: form.responsavel_nome,
      arquivos: form.arquivos,
    };

    if (editingEvent) {
      // Log changes to history
      const history = [...(editingEvent.historico || [])];
      const changes: string[] = [];
      if (editingEvent.titulo !== payload.titulo) changes.push(`título para '${payload.titulo}'`);
      if (editingEvent.status !== payload.status) changes.push(`status para '${payload.status}'`);
      if (editingEvent.prioridade !== payload.prioridade) changes.push(`prioridade para '${payload.prioridade}'`);
      if (editingEvent.responsavel_nome !== payload.responsavel_nome) changes.push(`responsável para '${payload.responsavel_nome || "Nenhum"}'`);
      if (Number(editingEvent.orcamento || 0) !== Number(payload.orcamento || 0)) changes.push(`orçamento para '${payload.orcamento}'`);
      if (editingEvent.notas !== payload.notas) changes.push("notas rápidas");

      if (changes.length > 0) {
        history.unshift({
          data: new Date().toISOString(),
          usuario: currentUserNome,
          acao: "Atualizou a tarefa via formulário",
          detalhes: `Campos alterados: ${changes.join(", ")}`
        });
      }
      payload.historico = history;
    } else {
      payload.criador_nome = currentUserNome;
      payload.etapas = [];
      payload.historico = [
        {
          data: new Date().toISOString(),
          usuario: currentUserNome,
          acao: "Criou a tarefa",
          detalhes: "Criada pelo formulário"
        }
      ];
    }

    if (isLocalMode) {
      // Local Storage Save
      if (editingEvent) {
        const updated = events.map(e => (e.id === editingEvent.id ? {
          ...e,
          ...payload,
          equipamentos: equipamentos.find(eq => eq.id === payload.equipamento_id) || null,
          empresas: empresas.find(emp => emp.id === payload.empresa_id) || null,
          contratos: contratos.find(c => c.id === payload.contrato_id) || null
        } as AgendaEvent : e));
        saveLocalEvents(updated);
        toast({ title: "Sucesso", description: "Evento atualizado localmente." });
      } else {
        const newEvent: AgendaEvent = {
          ...payload,
          id: crypto.randomUUID(),
          equipamentos: equipamentos.find(eq => eq.id === payload.equipamento_id) || null,
          empresas: empresas.find(emp => emp.id === payload.empresa_id) || null,
          contratos: contratos.find(c => c.id === payload.contrato_id) || null
        } as AgendaEvent;
        saveLocalEvents([...events, newEvent]);
        toast({ title: "Sucesso", description: "Evento criado localmente." });
      }
      setDialogOpen(false);
    } else {
      // Database Save
      try {
        if (editingEvent) {
          const { error } = await supabase.from("agenda").update(payload).eq("id", editingEvent.id);
          if (error) throw error;
          toast({ title: "Sucesso", description: "Compromisso atualizado." });
        } else {
          const { error } = await supabase.from("agenda").insert({ ...payload, id: crypto.randomUUID() });
          if (error) throw error;
          toast({ title: "Sucesso", description: "Compromisso agendado." });
        }
        setDialogOpen(false);
        fetchData();
      } catch (err: any) {
        toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
      }
    }
  };

  // Delete Event handler
  const handleDeleteEvent = async (id: string) => {
    if (isLocalMode) {
      saveLocalEvents(events.filter(e => e.id !== id));
      toast({ title: "Sucesso", description: "Evento removido localmente." });
    } else {
      try {
        const { error } = await supabase.from("agenda").delete().eq("id", id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Compromisso removido." });
        fetchData();
      } catch (err: any) {
        toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
      }
    }
  };

  // Helper for inline updates in Monday table with history logging and workflow logic
  const updateEventField = async (eventId: string, field: string, value: any) => {
    const targetEvent = events.find(e => e.id === eventId);
    if (!targetEvent) return;

    let updatedEvent = { ...targetEvent };
    let historyMessage = "";
    let historyDetails = "";

    // Check if updating status on a task with active stage assigned to current user
    if (field === "status") {
      const stages = targetEvent.etapas || [];
      const activeStageIndex = stages.findIndex(st => st.status !== "Concluído");
      if (activeStageIndex !== -1 && stages[activeStageIndex].responsavel_nome === currentUserNome) {
        // Update stage status instead
        const updatedStages = [...stages];
        const prevStatus = updatedStages[activeStageIndex].status;
        updatedStages[activeStageIndex] = {
          ...updatedStages[activeStageIndex],
          status: value
        };
        updatedEvent.etapas = updatedStages;
        historyMessage = `Alterou status da etapa '${stages[activeStageIndex].titulo}'`;
        historyDetails = `De '${prevStatus}' para '${value}'`;
        if (value === "Concluído") {
          historyMessage = `Concluiu a etapa '${stages[activeStageIndex].titulo}'`;
          historyDetails = `Tarefa retornada para '${stages[activeStageIndex].solicitante_nome}'`;
        }
      } else {
        historyMessage = `Alterou o status`;
        historyDetails = `De '${targetEvent.status}' para '${value}'`;
        updatedEvent.status = value;
      }
    } else {
      updatedEvent[field] = value;
      if (field === "titulo") {
        historyMessage = "Alterou o título";
        historyDetails = `Novo título: '${value}'`;
      } else if (field === "responsavel_nome") {
        historyMessage = "Alterou o responsável";
        historyDetails = value ? `Atribuído a '${value}'` : "Removido responsável";
      } else if (field === "orcamento") {
        historyMessage = "Alterou o orçamento";
        historyDetails = `Novo valor: ${Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
      } else if (field === "notas") {
        historyMessage = "Atualizou as notas";
        historyDetails = value;
      } else if (field === "prioridade") {
        historyMessage = "Alterou a prioridade";
        historyDetails = `De '${targetEvent.prioridade}' para '${value}'`;
      } else if (field === "data_inicio") {
        historyMessage = "Alterou a data de início";
        historyDetails = `Nova data: ${new Date(value).toLocaleDateString("pt-BR")}`;
      } else {
        historyMessage = `Atualizou campo '${field}'`;
      }
    }

    // Add to history
    const newEntry: HistoricoEntry = {
      data: new Date().toISOString(),
      usuario: currentUserNome,
      acao: historyMessage,
      detalhes: historyDetails || ""
    };
    updatedEvent.historico = [newEntry, ...(targetEvent.historico || [])];
    updatedEvent.updated_at = new Date().toISOString();

    // Update state
    setEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e));
    if (viewEvent?.id === eventId) {
      setViewEvent(updatedEvent);
    }

    if (isLocalMode) {
      saveLocalEvents(events.map(e => e.id === eventId ? updatedEvent : e));
    } else {
      try {
        const { error } = await supabase
          .from("agenda")
          .update({
            status: updatedEvent.status,
            titulo: updatedEvent.titulo,
            responsavel_nome: updatedEvent.responsavel_nome,
            orcamento: updatedEvent.orcamento,
            notas: updatedEvent.notas,
            prioridade: updatedEvent.prioridade,
            data_inicio: updatedEvent.data_inicio,
            etapas: updatedEvent.etapas,
            historico: updatedEvent.historico,
            updated_at: updatedEvent.updated_at
          })
          .eq("id", eventId);
        if (error) throw error;
      } catch (err: any) {
        toast({ title: "Erro ao atualizar campo", description: err.message, variant: "destructive" });
        fetchData();
      }
    }
  };

  // Helper for quick adding events from the Monday spreadsheet view with history logging
  const handleQuickAddEvent = async (titulo: string, status: "A Fazer" | "Em Andamento" | "Concluído") => {
    const newId = crypto.randomUUID();
    const newEvent: AgendaEvent = {
      id: newId,
      titulo,
      descricao: "",
      data_inicio: new Date().toISOString().slice(0, 16),
      data_fim: null,
      status,
      prioridade: "Média",
      categoria: "Geral",
      equipamento_id: null,
      contrato_id: null,
      empresa_id: null,
      orcamento: 0,
      notas: "",
      responsavel_nome: "",
      arquivos: [],
      criador_nome: currentUserNome,
      etapas: [],
      historico: [
        {
          data: new Date().toISOString(),
          usuario: currentUserNome,
          acao: "Criou a tarefa",
          detalhes: `Status inicial: ${status}`
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setEvents(prev => [...prev, newEvent]);

    if (isLocalMode) {
      saveLocalEvents([...events, newEvent]);
      toast({ title: "Tarefa criada", description: `"${titulo}" adicionado localmente.` });
    } else {
      try {
        const { error } = await supabase.from("agenda").insert(newEvent);
        if (error) throw error;
        toast({ title: "Tarefa criada", description: `"${titulo}" adicionada com sucesso.` });
        fetchData();
      } catch (err: any) {
        toast({ title: "Erro ao criar tarefa", description: err.message, variant: "destructive" });
        fetchData();
      }
    }
  };

  // Helper to add workflow sub-step (etapa) inside View Dialog
  const handleAddStage = async () => {
    if (!viewEvent || !newStageTitle.trim() || !newStageAssignee) {
      toast({ title: "Aviso", description: "Informe o título e o responsável para a etapa.", variant: "destructive" });
      return;
    }

    const newEtapa: Etapa = {
      id: crypto.randomUUID(),
      titulo: newStageTitle.trim(),
      responsavel_nome: newStageAssignee,
      solicitante_nome: currentUserNome,
      status: "A Fazer",
      created_at: new Date().toISOString()
    };

    const updatedStages = [...(viewEvent.etapas || []), newEtapa];
    
    // Add history entry
    const newEntry: HistoricoEntry = {
      data: new Date().toISOString(),
      usuario: currentUserNome,
      acao: `Criou a etapa '${newStageTitle.trim()}'`,
      detalhes: `Atribuída para: '${newStageAssignee}'`
    };
    const updatedHistory = [newEntry, ...(viewEvent.historico || [])];

    const updatedEvent = {
      ...viewEvent,
      etapas: updatedStages,
      historico: updatedHistory,
      updated_at: new Date().toISOString()
    };

    setEvents(prev => prev.map(e => e.id === viewEvent.id ? updatedEvent : e));
    setViewEvent(updatedEvent);

    if (isLocalMode) {
      saveLocalEvents(events.map(e => e.id === viewEvent.id ? updatedEvent : e));
    } else {
      try {
        const { error } = await supabase
          .from("agenda")
          .update({
            etapas: updatedStages,
            historico: updatedHistory,
            updated_at: updatedEvent.updated_at
          })
          .eq("id", viewEvent.id);
        if (error) throw error;
      } catch (err: any) {
        toast({ title: "Erro ao salvar etapa", description: err.message, variant: "destructive" });
      }
    }

    setNewStageTitle("");
    setNewStageAssignee("");
    toast({ title: "Etapa criada", description: `Etapa atribuída a ${newStageAssignee}.` });
  };

  // Helper to update stage status inside View Dialog
  const handleUpdateStageStatus = async (stageId: string, newStatus: "A Fazer" | "Em Andamento" | "Concluído", overrideObs?: string) => {
    if (!viewEvent) return;

    const stages = viewEvent.etapas || [];
    const stageIndex = stages.findIndex(st => st.id === stageId);
    if (stageIndex === -1) return;

    // If changing to Concluído and no overrideObs is passed, trigger observations panel input first
    if (newStatus === "Concluído" && overrideObs === undefined) {
      setEditingStageObsId(stageId);
      setStageObsInput("");
      return;
    }

    const updatedStages = [...stages];
    const oldStatus = updatedStages[stageIndex].status;
    
    updatedStages[stageIndex] = {
      ...updatedStages[stageIndex],
      status: newStatus,
      observacoes: overrideObs || updatedStages[stageIndex].observacoes
    };

    let actionStr = `Alterou status da etapa '${updatedStages[stageIndex].titulo}'`;
    let detailsStr = `De '${oldStatus}' para '${newStatus}'`;
    if (newStatus === "Concluído") {
      actionStr = `Concluiu a etapa '${updatedStages[stageIndex].titulo}'`;
      detailsStr = `Tarefa retornada para '${updatedStages[stageIndex].solicitante_nome}'${overrideObs ? ` - Obs: "${overrideObs}"` : ""}`;
    }

    const newEntry: HistoricoEntry = {
      data: new Date().toISOString(),
      usuario: currentUserNome,
      acao: actionStr,
      detalhes: detailsStr
    };
    const updatedHistory = [newEntry, ...(viewEvent.historico || [])];

    const updatedEvent = {
      ...viewEvent,
      etapas: updatedStages,
      historico: updatedHistory,
      updated_at: new Date().toISOString()
    };

    setEvents(prev => prev.map(e => e.id === viewEvent.id ? updatedEvent : e));
    setViewEvent(updatedEvent);
    setEditingStageObsId(null);
    setStageObsInput("");

    if (isLocalMode) {
      saveLocalEvents(events.map(e => e.id === viewEvent.id ? updatedEvent : e));
    } else {
      try {
        const { error } = await supabase
          .from("agenda")
          .update({
            etapas: updatedStages,
            historico: updatedHistory,
            updated_at: updatedEvent.updated_at
          })
          .eq("id", viewEvent.id);
        if (error) throw error;
      } catch (err: any) {
        toast({ title: "Erro ao atualizar status da etapa", description: err.message, variant: "destructive" });
      }
    }
  };

  // Helper to calculate days overdue
  const getDaysOverdue = (dataInicioStr: string, status: string) => {
    if (status === "Concluído" || !dataInicioStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(dataInicioStr);
    deadline.setHours(0, 0, 0, 0);
    if (deadline < today) {
      const diffTime = Math.abs(today.getTime() - deadline.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    return 0;
  };

  // Files attachment helpers
  const handleAddFileLink = async () => {
    if (!activeFilesEvent || !newFileUrl.trim()) return;
    const currentFiles = activeFilesEvent.arquivos || [];
    if (currentFiles.includes(newFileUrl.trim())) {
      toast({ title: "Arquivo já existe", description: "Este link já foi adicionado.", variant: "destructive" });
      return;
    }
    const updatedFiles = [...currentFiles, newFileUrl.trim()];
    
    await updateEventField(activeFilesEvent.id, "arquivos", updatedFiles);
    setActiveFilesEvent(prev => prev ? { ...prev, arquivos: updatedFiles } : null);
    setNewFileUrl("");
    toast({ title: "Sucesso", description: "Link de arquivo adicionado." });
  };

  const handleRemoveFileLink = async (urlToRemove: string) => {
    if (!activeFilesEvent) return;
    const currentFiles = activeFilesEvent.arquivos || [];
    const updatedFiles = currentFiles.filter(url => url !== urlToRemove);
    
    await updateEventField(activeFilesEvent.id, "arquivos", updatedFiles);
    setActiveFilesEvent(prev => prev ? { ...prev, arquivos: updatedFiles } : null);
    toast({ title: "Sucesso", description: "Link de arquivo removido." });
  };

  // Drag and Drop handlers for Kanban
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, status: "A Fazer" | "Em Andamento" | "Concluído") => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    if (isLocalMode) {
      const updated = events.map(ev => (ev.id === id ? { ...ev, status } : ev));
      saveLocalEvents(updated);
      toast({ title: "Mover Card", description: `Card movido para '${status}'` });
    } else {
      try {
        const { error } = await supabase.from("agenda").update({ status }).eq("id", id);
        if (error) throw error;
        setEvents(prev => prev.map(ev => (ev.id === id ? { ...ev, status } : ev)));
        toast({ title: "Mover Card", description: `Card movido para '${status}'` });
      } catch (err: any) {
        toast({ title: "Erro ao mover", description: err.message, variant: "destructive" });
      }
    }
  };

  // Sticky Notes logic
  const handleAddSticky = () => {
    const colors: StickyItem["color"][] = ["yellow", "blue", "green", "pink"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newSticky: StickyItem = {
      id: crypto.randomUUID(),
      content: "",
      color: randomColor,
      created_at: new Date().toISOString()
    };
    const updated = [newSticky, ...stickies];
    setStickies(updated);
    localStorage.setItem("busato-agenda-stickies", JSON.stringify(updated));
  };

  const handleUpdateSticky = (id: string, content: string) => {
    const updated = stickies.map(s => (s.id === id ? { ...s, content } : s));
    setStickies(updated);
    localStorage.setItem("busato-agenda-stickies", JSON.stringify(updated));
  };

  const handleDeleteSticky = (id: string) => {
    const updated = stickies.filter(s => s.id !== id);
    setStickies(updated);
    localStorage.setItem("busato-agenda-stickies", JSON.stringify(updated));
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(migrationSql);
    setCopiedSql(true);
    toast({ title: "Copiado", description: "Script SQL copiado para a área de transferência." });
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Filters events
  const filteredEvents = events.filter(e => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      e.titulo.toLowerCase().includes(q) ||
      e.descricao.toLowerCase().includes(q) ||
      e.categoria.toLowerCase().includes(q)
    );
  });

  // Process workflow stages and read-only logic for viewing user
  const processedEvents = filteredEvents.map(event => {
    const stages = event.etapas || [];
    const activeStage = stages.find(st => st.status !== "Concluído");
    
    if (activeStage) {
      if (activeStage.responsavel_nome === currentUserNome) {
        return {
          ...event,
          status: activeStage.status, // Override status for stage assignee
          readOnly: false,
          isActiveStageAssignee: true,
          activeStageId: activeStage.id
        };
      } else {
        return {
          ...event,
          status: "Em Andamento" as const, // Override status to Em Andamento for requestor/creator/others
          readOnly: true,
          isActiveStageAssignee: false,
          activeStageId: activeStage.id
        };
      }
    }
    
    return {
      ...event,
      readOnly: event.status === "Concluído",
      isActiveStageAssignee: false,
      activeStageId: null
    };
  });

  // Calendar calculations
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return { firstDay, totalDays };
  };

  // Render month view calendar grid
  const renderMonthCalendar = () => {
    const { firstDay, totalDays } = getDaysInMonth(currentDate);
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const grid: React.ReactNode[] = [];

    // Header row
    dayNames.forEach(name => {
      grid.push(
        <div key={`header-${name}`} className="p-2 text-center text-xs font-semibold text-muted-foreground border-b border-border bg-muted/40">
          {name}
        </div>
      );
    });

    // Empty spaces before first day
    for (let i = 0; i < firstDay; i++) {
      grid.push(<div key={`empty-${i}`} className="p-2 min-h-24 bg-muted/10 border-b border-r border-border" />);
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
      const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isToday = new Date().toDateString() === cellDate.toDateString();

      // Find events for this day
      const dayEvents = filteredEvents.filter(e => {
        const evDate = new Date(e.data_inicio);
        return evDate.getFullYear() === cellDate.getFullYear() &&
               evDate.getMonth() === cellDate.getMonth() &&
               evDate.getDate() === cellDate.getDate();
      });

      grid.push(
        <div
          key={`day-${day}`}
          onClick={() => openNew(cellDate)}
          className={`p-2 min-h-24 border-b border-r border-border hover:bg-accent/10 transition-colors cursor-pointer flex flex-col justify-between ${
            isToday ? "bg-accent/5 font-semibold border-accent" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs ${isToday ? "h-6 w-6 flex items-center justify-center rounded-full bg-accent text-accent-foreground" : "text-foreground"}`}>
              {day}
            </span>
            {dayEvents.length > 0 && (
              <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-medium">
                {dayEvents.length}
              </span>
            )}
          </div>
          <div className="mt-1 space-y-1 overflow-y-auto max-h-16 scrollbar-none flex-1">
            {dayEvents.slice(0, 3).map(e => (
              <div
                key={e.id}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setViewEvent(e);
                  setViewDialogOpen(true);
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${
                  e.prioridade === "Alta"
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : e.prioridade === "Média"
                    ? "bg-warning/10 border-warning/20 text-warning"
                    : "bg-success/10 border-success/20 text-success"
                }`}
              >
                {e.titulo}
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-[9px] text-muted-foreground pl-1 italic">
                + {dayEvents.length - 3} mais
              </div>
            )}
          </div>
        </div>
      );
    }

    return <div className="grid grid-cols-7 border-t border-l border-border rounded-lg overflow-hidden bg-card">{grid}</div>;
  };

  // Render day view calendar grid
  const renderDayCalendar = () => {
    const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 to 18:00
    const dayEvents = filteredEvents.filter(e => {
      const evDate = new Date(e.data_inicio);
      return evDate.toDateString() === currentDate.toDateString();
    });

    return (
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between">
          <span className="font-semibold text-sm">
            {currentDate.toLocaleDateString("pt-BR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <Button size="xs" onClick={() => openNew(currentDate)} className="bg-accent text-accent-foreground">
            <Plus className="h-3 w-3 mr-1" /> Novo Evento
          </Button>
        </div>
        <div className="divide-y divide-border">
          {hours.map(hour => {
            const hourEvents = dayEvents.filter(e => {
              const startHour = new Date(e.data_inicio).getHours();
              return startHour === hour;
            });

            return (
              <div key={hour} className="flex min-h-16 group hover:bg-muted/10 transition-colors">
                <div className="w-16 flex items-center justify-center border-r border-border text-xs text-muted-foreground font-semibold bg-muted/10">
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div className="flex-1 p-2 flex flex-col gap-1 justify-center">
                  {hourEvents.length > 0 ? (
                    hourEvents.map(e => (
                      <div
                        key={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setViewEvent(e);
                          setViewDialogOpen(true);
                        }}
                        className={`text-xs p-2 rounded border cursor-pointer hover:shadow-sm transition-all flex justify-between items-center ${
                          e.prioridade === "Alta"
                            ? "bg-destructive/10 border-destructive/20 text-destructive"
                            : e.prioridade === "Média"
                            ? "bg-warning/10 border-warning/20 text-warning"
                            : "bg-success/10 border-success/20 text-success"
                        }`}
                      >
                        <div>
                          <span className="font-bold mr-2">[{e.categoria}]</span>
                          <span>{e.titulo}</span>
                          {e.descricao && <span className="text-muted-foreground text-[10px] ml-2">— {e.descricao}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {e.equipamentos && (
                            <Badge variant="outline" className="text-[9px] bg-background">
                              {e.equipamentos.tipo} ({e.equipamentos.tag_placa || "—"})
                            </Badge>
                          )}
                          <Badge className={
                            e.status === "Concluído" ? "bg-success/20 text-success border-0" :
                            e.status === "Em Andamento" ? "bg-accent/20 text-accent border-0" :
                            "bg-muted text-muted-foreground border-0"
                          }>
                            {e.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <button
                      onClick={() => {
                        const d = new Date(currentDate);
                        d.setHours(hour);
                        openNew(d);
                      }}
                      className="opacity-0 group-hover:opacity-100 self-start text-xs text-muted-foreground flex items-center hover:text-accent transition-all pl-2"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Reservar Horário
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render yearly overview heat map
  const renderYearlyCalendar = () => {
    const months = Array.from({ length: 12 }, (_, i) => i);
    const monthsLabels = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {months.map(month => {
          const monthDate = new Date(currentDate.getFullYear(), month, 1);
          const { firstDay, totalDays } = getDaysInMonth(monthDate);
          const grid: React.ReactNode[] = [];

          // Padding empty spaces
          for (let i = 0; i < firstDay; i++) {
            grid.push(<div key={`empty-${month}-${i}`} className="h-4 w-4" />);
          }

          // Days
          for (let day = 1; day <= totalDays; day++) {
            const d = new Date(currentDate.getFullYear(), month, day);
            const count = filteredEvents.filter(e => {
              const evD = new Date(e.data_inicio);
              return evD.toDateString() === d.toDateString();
            }).length;

            const isToday = new Date().toDateString() === d.toDateString();

            // Color code based on count
            let color = "bg-muted/30";
            if (count > 0 && count <= 2) color = "bg-accent/20 text-accent";
            if (count > 2 && count <= 5) color = "bg-accent/40 text-accent-foreground";
            if (count > 5) color = "bg-accent text-accent-foreground";

            grid.push(
              <div
                key={`day-${month}-${day}`}
                onClick={() => openNew(d)}
                title={`${day} de ${monthsLabels[month]}: ${count} evento(s)`}
                className={`h-5 w-5 rounded-sm flex items-center justify-center text-[8px] cursor-pointer hover:scale-110 transition-transform ${color} ${
                  isToday ? "border-2 border-primary" : ""
                }`}
              >
                {day}
              </div>
            );
          }

          return (
            <Card key={month} className="border border-border">
              <CardHeader className="p-3 bg-muted/20 border-b border-border">
                <CardTitle className="text-xs font-bold text-center uppercase tracking-wider">{monthsLabels[month]}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 flex justify-center">
                <div className="grid grid-cols-7 gap-1">
                  {["D", "S", "T", "Q", "Q", "S", "S"].map(d => (
                    <span key={d} className="h-5 w-5 flex items-center justify-center text-[8px] font-bold text-muted-foreground">{d}</span>
                  ))}
                  {grid}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // Navigations in Calendar Mode
  const navigateCalendar = (direction: "prev" | "next") => {
    const offset = direction === "prev" ? -1 : 1;
    if (calendarMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    } else if (calendarMode === "day") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + offset);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear() + offset, 0, 1));
    }
  };

  return (
    <Layout title="Agenda & Lembretes" subtitle="Monitore e coordene seus compromissos, lembretes e programações de equipamentos.">
      <div className="space-y-6">
        {/* Local Mode Warning Banner */}
        {isLocalMode && (
          <div className="bg-warning/15 border border-warning/30 text-warning px-4 py-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-warning shrink-0" />
              <div className="text-sm">
                <span className="font-bold">Modo Local Ativo:</span> A tabela <code className="px-1.5 py-0.5 rounded bg-warning/10 font-mono">agenda</code> não foi encontrada no Supabase. Os compromissos estão salvos localmente.
              </div>
            </div>
            <Button size="xs" variant="secondary" onClick={() => setSqlModalOpen(true)} className="bg-warning/20 hover:bg-warning/30 text-warning border border-warning/40 shadow-sm self-stretch sm:self-auto text-center justify-center">
              Ativar Sincronização em Nuvem
            </Button>
          </div>
        )}

        {/* Tab Headers */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "board" ? "default" : "outline"}
              onClick={() => setActiveTab("board")}
              size="sm"
              className={activeTab === "board" ? "bg-accent text-accent-foreground" : "bg-background"}
            >
              <Table2 className="h-4 w-4 mr-2" /> Quadro Principal
            </Button>
            <Button
              variant={activeTab === "kanban" ? "default" : "outline"}
              onClick={() => setActiveTab("kanban")}
              size="sm"
              className={activeTab === "kanban" ? "bg-accent text-accent-foreground" : "bg-background"}
            >
              <Trello className="h-4 w-4 mr-2" /> Cartões
            </Button>
            <Button
              variant={activeTab === "calendar" ? "default" : "outline"}
              onClick={() => setActiveTab("calendar")}
              size="sm"
              className={activeTab === "calendar" ? "bg-accent text-accent-foreground" : "bg-background"}
            >
              <CalendarIcon className="h-4 w-4 mr-2" /> Calendário
            </Button>
            <Button
              variant={activeTab === "notes" ? "default" : "outline"}
              onClick={() => setActiveTab("notes")}
              size="sm"
              className={activeTab === "notes" ? "bg-accent text-accent-foreground" : "bg-background"}
            >
              <StickyNote className="h-4 w-4 mr-2" /> Lembretes
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:ml-auto">
            {activeTab !== "notes" && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar agenda..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background h-9 text-sm"
                />
              </div>
            )}

            {activeTab === "notes" ? (
              <Button onClick={handleAddSticky} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm h-9">
                <Plus className="h-4 w-4 mr-2" /> Novo Lembrete
              </Button>
            ) : (
              <Button onClick={() => openNew()} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm h-9">
                <Plus className="h-4 w-4 mr-2" /> Novo Compromisso
              </Button>
            )}
          </div>
        </div>

        {/* Tab Contents */}
        {activeTab === "board" && (
          <div className="space-y-8 bg-card border border-border rounded-xl p-6 shadow-sm overflow-x-auto">
            {STATUSES.map(colStatus => {
              const statusEvents = processedEvents.filter(e => e.status === colStatus);
              const isCollapsed = collapsedGroups.includes(colStatus);
              
              // Calculate aggregations
              const totalBudget = statusEvents.reduce((acc, curr) => acc + Number(curr.orcamento || 0), 0);
              const totalFilesCount = statusEvents.reduce((acc, curr) => acc + (curr.arquivos?.length || 0), 0);
              
              // Timeline aggregation
              const validDates = statusEvents
                .map(e => e.data_inicio ? new Date(e.data_inicio) : null)
                .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
              
              let timelineStr = "—";
              if (validDates.length > 0) {
                const minDate = new Date(Math.min(...validDates.map(d => d.getTime())));
                const maxDate = new Date(Math.max(...validDates.map(d => d.getTime())));
                const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
                timelineStr = `${minDate.toLocaleDateString("pt-BR", options)} - ${maxDate.toLocaleDateString("pt-BR", options)}`;
              }

              // Status colors for left indicator bar
              const groupColors = {
                "A Fazer": { border: "border-l-4 border-l-[#A1343C]", bg: "bg-[#A1343C]", text: "text-[#A1343C]" },
                "Em Andamento": { border: "border-l-4 border-l-[#E66C37]", bg: "bg-[#E66C37]", text: "text-[#E66C37]" },
                "Concluído": { border: "border-l-4 border-l-[#3F7343]", bg: "bg-[#3F7343]", text: "text-[#3F7343]" }
              }[colStatus];

              return (
                <div key={colStatus} className={`rounded-xl border border-border bg-card overflow-hidden ${groupColors.border} transition-all shadow-sm`}>
                  {/* Status Group Header */}
                  <div className="flex items-center gap-2 p-3 bg-muted/20 border-b border-border/80">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setCollapsedGroups(prev => isCollapsed ? prev.filter(g => g !== colStatus) : [...prev, colStatus])}
                      className="h-6 w-6 p-0"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? "-rotate-90 text-muted-foreground/60" : "text-foreground"}`} />
                    </Button>
                    <span className="font-bold text-sm text-foreground flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold text-white ${groupColors.bg}`}>
                        {colStatus}
                      </span>
                      <span className="text-xs text-muted-foreground/75 font-medium">({statusEvents.length} tarefas)</span>
                    </span>
                  </div>

                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-muted/15 border-b border-border text-muted-foreground font-semibold">
                            <th className="p-2 w-8 text-center">#</th>
                            <th className="p-2 min-w-[200px]">Tarefa</th>
                            <th className="p-2 min-w-[120px]">Responsável</th>
                            <th className="p-2 min-w-[110px] text-center">Status</th>
                            <th className="p-2 min-w-[110px] text-center">Prioridade</th>
                            <th className="p-2 min-w-[120px] text-center">Prazo / Início</th>
                            {colStatus !== "Concluído" && <th className="p-2 min-w-[90px] text-center">Trabalho</th>}
                            <th className="p-2 min-w-[100px] text-right">Orçamento</th>
                            <th className="p-2 min-w-[180px]">Notas</th>
                            <th className="p-2 w-20 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statusEvents.map((item, index) => (
                            <tr key={item.id} className="hover:bg-muted/5 transition-colors group">
                              {/* Row Index */}
                              <td className="p-2 text-center text-muted-foreground/60 font-mono font-medium border-r border-border/60">
                                {index + 1}
                              </td>

                              {/* Task Title */}
                              <td className="p-2 border-r border-border/60">
                                {item.readOnly ? (
                                  <span className="font-semibold text-foreground px-1 py-0.5 block truncate max-w-[280px]">
                                    {item.titulo}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    value={item.titulo}
                                    onChange={(e) => updateEventField(item.id, "titulo", e.target.value)}
                                    className="bg-transparent border-0 focus:ring-1 focus:ring-accent rounded-sm outline-none px-1 py-0.5 w-full font-medium text-foreground hover:bg-muted/30 focus:bg-background"
                                  />
                                )}
                              </td>

                              {/* Responsavel */}
                              <td className="p-2 border-r border-border/60">
                                {item.readOnly ? (
                                  <div className="flex items-center gap-1.5 px-1 py-0.5">
                                    <div className="h-4 w-4 rounded-full bg-accent/10 text-accent/80 flex items-center justify-center text-[8px] font-bold shrink-0">
                                      {item.responsavel_nome ? item.responsavel_nome.slice(0, 2).toUpperCase() : <User className="h-2.5 w-2.5" />}
                                    </div>
                                    <span className="text-foreground/75 truncate text-xs">
                                      {item.responsavel_nome || <span className="text-muted-foreground/40 italic">Sem responsável</span>}
                                    </span>
                                  </div>
                                ) : (
                                  <Select
                                    value={item.responsavel_nome || "none"}
                                    onValueChange={(val) => updateEventField(item.id, "responsavel_nome", val === "none" ? "" : val)}
                                  >
                                    <SelectTrigger className="h-7 text-xs border-0 rounded-sm shadow-none focus:ring-0 w-full bg-transparent hover:bg-muted/30 px-1">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <div className="h-4 w-4 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[8px] font-bold shrink-0">
                                          {item.responsavel_nome ? item.responsavel_nome.slice(0, 2).toUpperCase() : <User className="h-2.5 w-2.5" />}
                                        </div>
                                        <span className="truncate text-left text-foreground">
                                          {item.responsavel_nome || <span className="text-muted-foreground/50 italic">Sem responsável</span>}
                                        </span>
                                      </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none" className="text-xs italic text-muted-foreground">Sem responsável</SelectItem>
                                      {usuarios.map(u => (
                                        <SelectItem key={u.user_id} value={u.nome} className="text-xs">{u.nome}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </td>

                              {/* Status badge dropdown */}
                              <td className="p-2 border-r border-border/60 text-center">
                                {item.readOnly ? (
                                  <div className="h-7 flex items-center justify-center text-[11px] font-bold text-white px-3 rounded-sm bg-[#3F7343] select-none">
                                    {item.status}
                                  </div>
                                ) : (
                                  <Select
                                    value={item.status}
                                    onValueChange={(val: any) => updateEventField(item.id, "status", val)}
                                  >
                                    <SelectTrigger className={`h-7 text-[11px] font-bold text-white border-0 rounded-sm shadow-none focus:ring-0 ${
                                      item.status === "Concluído" ? "bg-[#3F7343] hover:bg-[#3F7343]/90" :
                                      item.status === "Em Andamento" ? "bg-[#E66C37] hover:bg-[#E66C37]/90" : "bg-[#A1343C] hover:bg-[#A1343C]/90"
                                    }`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STATUSES.map(st => (
                                        <SelectItem key={st} value={st} className="text-xs font-semibold">{st}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </td>

                              {/* Priority badge dropdown */}
                              <td className="p-2 border-r border-border/60 text-center">
                                {item.readOnly ? (
                                  <div className={`h-7 flex items-center justify-center text-[11px] font-bold text-white px-3 rounded-sm select-none ${
                                    item.prioridade === "Alta" ? "bg-[#A1343C]" :
                                    item.prioridade === "Média" ? "bg-[#E66C37]" : "bg-[#3F7343]"
                                  }`}>
                                    {item.prioridade}
                                  </div>
                                ) : (
                                  <Select
                                    value={item.prioridade}
                                    onValueChange={(val: any) => updateEventField(item.id, "prioridade", val)}
                                  >
                                    <SelectTrigger className={`h-7 text-[11px] font-bold text-white border-0 rounded-sm shadow-none focus:ring-0 ${
                                      item.prioridade === "Alta" ? "bg-[#A1343C] hover:bg-[#A1343C]/90" :
                                      item.prioridade === "Média" ? "bg-[#E66C37] hover:bg-[#E66C37]/90" : "bg-[#3F7343] hover:bg-[#3F7343]/90"
                                    }`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PRIORITIES.map(pr => (
                                        <SelectItem key={pr} value={pr} className="text-xs font-semibold">{pr}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </td>

                              {/* Prazo (Timeline) */}
                              <td className="p-2 border-r border-border/60 text-center">
                                {item.readOnly ? (
                                  <span className="text-foreground/80 font-mono text-[11px] text-center block py-1.5">
                                    {item.data_inicio ? new Date(item.data_inicio).toLocaleDateString("pt-BR") : "—"}
                                  </span>
                                ) : (
                                  <input
                                    type="date"
                                    value={item.data_inicio ? item.data_inicio.slice(0, 10) : ""}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const updatedDate = new Date(e.target.value);
                                        updateEventField(item.id, "data_inicio", updatedDate.toISOString());
                                      }
                                    }}
                                    className="bg-transparent border-0 outline-none text-xs w-full text-center hover:bg-muted/30 rounded-sm focus:ring-1 focus:ring-accent"
                                  />
                                )}
                              </td>

                              {/* Atraso (Trabalho) */}
                              {colStatus !== "Concluído" && (
                                <td className="p-2 border-r border-border/60 text-center font-medium">
                                  {(() => {
                                    const days = getDaysOverdue(item.data_inicio, item.status);
                                    if (days > 0) {
                                      if (item.status === "Em Andamento") {
                                        return (
                                          <Badge className="bg-[#E66C37]/15 text-[#E66C37] border-0 font-bold hover:bg-[#E66C37]/20 text-[10px] whitespace-nowrap">
                                            {days} {days === 1 ? "dia" : "dias"}
                                          </Badge>
                                        );
                                      }
                                      return (
                                        <Badge className="bg-[#A1343C]/15 text-[#A1343C] border-0 font-bold hover:bg-[#A1343C]/20 text-[10px] whitespace-nowrap">
                                          {days} {days === 1 ? "dia" : "dias"}
                                        </Badge>
                                      );
                                    }
                                    return <span className="text-muted-foreground/45">—</span>;
                                  })()}
                                </td>
                              )}

                              {/* Budget (Orcamento) */}
                              <td className="p-2 border-r border-border/60 text-right font-mono font-medium">
                                {item.readOnly ? (
                                  <span className="text-foreground/80 font-mono text-[11px] text-right block py-1.5 px-1">
                                    {Number(item.orcamento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    value={item.orcamento || ""}
                                    placeholder="R$ 0"
                                    onChange={(e) => updateEventField(item.id, "orcamento", Number(e.target.value || 0))}
                                    className="bg-transparent border-0 focus:ring-1 focus:ring-accent rounded-sm outline-none px-1 py-0.5 w-full text-right hover:bg-muted/30 focus:bg-background placeholder:text-muted-foreground/35"
                                  />
                                )}
                              </td>

                              {/* Notes */}
                              <td className="p-2 border-r border-border/60">
                                {item.readOnly ? (
                                  <span className="text-foreground/75 px-1 py-0.5 block truncate max-w-[220px]" title={item.notas || ""}>
                                    {item.notes || item.notas || <span className="text-muted-foreground/30 italic">—</span>}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    value={item.notes || item.notas || ""}
                                    placeholder="Notas rápidas..."
                                    onChange={(e) => updateEventField(item.id, "notas", e.target.value)}
                                    className="bg-transparent border-0 focus:ring-1 focus:ring-accent rounded-sm outline-none px-1 py-0.5 w-full text-foreground/80 hover:bg-muted/30 focus:bg-background placeholder:text-muted-foreground/35"
                                  />
                                )}
                              </td>

                              {/* Row Actions */}
                              <td className="p-2 text-center">
                                {item.readOnly ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setViewEvent(item);
                                        setViewDialogOpen(true);
                                      }}
                                      className="h-6 w-6 hover:bg-muted text-muted-foreground hover:text-foreground"
                                      title="Visualizar Detalhes"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => openEdit(item)}
                                      className="h-6 w-6 hover:bg-muted"
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleDeleteEvent(item.id)}
                                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}

                          {/* Quick Add Row */}
                          {colStatus !== "Concluído" && (
                            <tr className="bg-muted/5 group">
                              <td className="p-2 text-center">
                                <Plus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                              </td>
                              <td className="p-2 border-r border-border/60" colSpan={colStatus === "Concluído" ? 8 : 9}>
                                <input
                                  type="text"
                                  placeholder="+ Adicionar nova tarefa..."
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                      handleQuickAddEvent(e.currentTarget.value.trim(), colStatus);
                                      e.currentTarget.value = "";
                                    }
                                  }}
                                  className="bg-transparent border-0 outline-none w-full text-xs text-foreground placeholder:text-muted-foreground/50 font-medium py-1"
                                />
                              </td>
                            </tr>
                          )}
                        </tbody>
                        
                        {/* Summary Footer */}
                        <tfoot>
                          <tr className="bg-muted/20 border-t border-border font-bold text-muted-foreground text-[11px]">
                            <td className="p-2 border-r border-border/60"></td>
                            <td className="p-2 border-r border-border/60 text-right font-semibold">Resumo do Grupo</td>
                            <td className="p-2 border-r border-border/60"></td>
                            <td className="p-2 border-r border-border/60"></td>
                            <td className="p-2 border-r border-border/60"></td>
                            <td className="p-2 border-r border-border/60 text-center font-mono font-semibold">
                              {timelineStr}
                            </td>
                            {colStatus !== "Concluído" && <td className="p-2 border-r border-border/60"></td>}
                            <td className="p-2 border-r border-border/60 text-right font-mono text-foreground font-bold">
                              {totalBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </td>
                            <td className="p-2 border-r border-border/60"></td>
                            <td className="p-2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STATUSES.map(colStatus => {
              const statusEvents = processedEvents.filter(e => e.status === colStatus);

              return (
                <div
                  key={colStatus}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, colStatus)}
                  className="rounded-xl border border-border bg-muted/10 flex flex-col min-h-[500px]"
                >
                  <div className="p-4 border-b border-border bg-muted/40 rounded-t-xl flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground flex items-center gap-2">
                      {colStatus === "A Fazer" && <Clock className="h-4 w-4 text-muted-foreground" />}
                      {colStatus === "Em Andamento" && <AlertTriangle className="h-4 w-4 text-warning" />}
                      {colStatus === "Concluído" && <CheckCircle2 className="h-4 w-4 text-success" />}
                      {colStatus}
                    </span>
                    <Badge variant="secondary" className="bg-muted/80 text-muted-foreground text-[10px] font-semibold">
                      {statusEvents.length}
                    </Badge>
                  </div>

                  <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[650px] scrollbar-thin">
                    {statusEvents.map(item => (
                      <Card
                        key={item.id}
                        draggable={item.status !== "Concluído"}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onClick={() => {
                          setViewEvent(item);
                          setViewDialogOpen(true);
                        }}
                        className={`bg-card hover:shadow-lg border border-border rounded-xl group overflow-hidden ${
                          item.status === "Concluído" ? "cursor-pointer" : "cursor-pointer cursor-grab active:cursor-grabbing"
                        }`}
                      >
                        {/* Monday Card Top Placeholder (Avatar Container) */}
                        <div className="bg-muted/40 relative flex items-center justify-center py-5 border-b border-border/50 bg-slate-50 dark:bg-slate-900/50">
                          <div className="h-16 w-16 rounded-full border-2 border-card bg-background flex items-center justify-center shadow-sm">
                            <User className="h-8 w-8 text-muted-foreground/60" />
                          </div>
                          
                          {/* Quick "+" or edit button on hover */}
                          {item.status !== "Concluído" && (
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(item);
                                }}
                                className="h-6 w-6 bg-background hover:bg-muted border shadow-sm"
                              >
                                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          )}
                        </div>

                        <CardContent className="p-4 space-y-4">
                          {/* Title and Notes Icon Row */}
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-bold text-sm leading-tight text-foreground block group-hover:text-accent transition-colors">
                              {item.titulo}
                            </span>
                            {item.notas && (
                              <Badge variant="outline" className="border-0 p-0 text-muted-foreground/60 shrink-0">
                                <StickyNote className="h-3.5 w-3.5" />
                              </Badge>
                            )}
                          </div>

                          {/* Monday Card attributes layout (matching screenshot) */}
                          <div className="space-y-2 pt-2 text-xs border-t border-border/40">
                            {/* Responsavel Row */}
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Responsável</span>
                              <div className="flex items-center gap-1 font-semibold text-foreground">
                                <div className="h-5 w-5 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[9px] font-bold shrink-0">
                                  {item.responsavel_nome ? item.responsavel_nome.slice(0, 2).toUpperCase() : <User className="h-3 w-3" />}
                                </div>
                                <span className="text-[11px] max-w-[100px] truncate">{item.responsavel_nome || "—"}</span>
                              </div>
                            </div>
                            
                            {/* Status Row */}
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Status</span>
                              <div className={`text-[10px] text-white py-0.5 px-2 rounded-sm text-center font-bold min-w-[90px] shadow-sm ${
                                item.status === "Concluído" ? "bg-[#3F7343]" :
                                item.status === "Em Andamento" ? "bg-[#E66C37]" : "bg-[#A1343C]"
                              }`}>
                                {item.status}
                              </div>
                            </div>

                            {/* Prioridade Row */}
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Prioridade</span>
                              <div className={`text-[10px] text-white py-0.5 px-2 rounded-sm text-center font-bold min-w-[90px] shadow-sm ${
                                item.prioridade === "Alta" ? "bg-[#A1343C]" :
                                item.prioridade === "Média" ? "bg-[#E66C37]" : "bg-[#3F7343]"
                              }`}>
                                {item.prioridade}
                              </div>
                            </div>

                            {/* Prazo Row */}
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Prazo</span>
                              <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 rounded text-[11px] font-medium text-foreground">
                                {item.status === "Concluído" ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                ) : item.data_inicio && new Date(item.data_inicio) < new Date() ? (
                                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <span>
                                  {item.data_inicio ? new Date(item.data_inicio).toLocaleDateString("pt-BR", { month: "short", day: "numeric" }) : "—"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick delete/edit buttons bar */}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-2.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-muted-foreground/60 italic">Categoria: {item.categoria}</span>
                            <div className="flex gap-1">
                              {item.status === "Concluído" ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewEvent(item);
                                    setViewDialogOpen(true);
                                  }}
                                  className="h-5 w-5 p-0 hover:bg-muted"
                                  title="Visualizar Detalhes"
                                >
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEdit(item);
                                    }}
                                    className="h-5 w-5 p-0 hover:bg-muted"
                                  >
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteEvent(item.id);
                                    }}
                                    className="h-5 w-5 p-0 hover:bg-muted text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {statusEvents.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-muted/5">
                        <Trello className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <span className="text-xs">Arraste tarefas aqui</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-6">
            {/* Calendar Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" onClick={() => navigateCalendar("prev")} className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold capitalize min-w-[120px] text-center">
                  {calendarMode === "month" && currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  {calendarMode === "day" && currentDate.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
                  {calendarMode === "year" && `${currentDate.getFullYear()}`}
                </span>
                <Button size="icon" variant="outline" onClick={() => navigateCalendar("next")} className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setCurrentDate(new Date())} className="text-xs text-muted-foreground hover:text-foreground">
                  Hoje
                </Button>
              </div>

              <div className="flex items-center rounded-lg border border-border p-1 bg-muted/30">
                <Button
                  size="xs"
                  variant={calendarMode === "day" ? "secondary" : "ghost"}
                  onClick={() => setCalendarMode("day")}
                  className="text-xs h-7"
                >
                  Dia
                </Button>
                <Button
                  size="xs"
                  variant={calendarMode === "month" ? "secondary" : "ghost"}
                  onClick={() => setCalendarMode("month")}
                  className="text-xs h-7"
                >
                  Mês
                </Button>
                <Button
                  size="xs"
                  variant={calendarMode === "year" ? "secondary" : "ghost"}
                  onClick={() => setCalendarMode("year")}
                  className="text-xs h-7"
                >
                  Ano
                </Button>
              </div>
            </div>

            {/* Calendar Grids */}
            {calendarMode === "month" && renderMonthCalendar()}
            {calendarMode === "day" && renderDayCalendar()}
            {calendarMode === "year" && renderYearlyCalendar()}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {stickies.map(s => (
              <div
                key={s.id}
                className={`p-5 rounded-xl border shadow-sm relative group min-h-[160px] flex flex-col justify-between transition-all hover:shadow-md ${
                  stickyColors[s.color]
                }`}
              >
                <Textarea
                  value={s.content}
                  placeholder="Escreva algo..."
                  onChange={(e) => handleUpdateSticky(s.id, e.target.value)}
                  className="bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm resize-none h-full scrollbar-none flex-1 leading-relaxed"
                />
                <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-2.5 mt-2 text-[10px] opacity-75">
                  <span>
                    {new Date(s.created_at).toLocaleDateString("pt-BR", { month: "short", day: "numeric" })}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteSticky(s.id)}
                    className="h-5 w-5 p-0 hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <button
              onClick={handleAddSticky}
              className="p-5 rounded-xl border-2 border-dashed border-border hover:bg-muted/10 hover:border-accent/40 flex flex-col items-center justify-center gap-2 group min-h-[160px] transition-colors"
            >
              <Plus className="h-8 w-8 text-muted-foreground/30 group-hover:text-accent transition-colors" />
              <span className="text-sm font-semibold text-muted-foreground group-hover:text-accent transition-colors">Novo Lembrete</span>
            </button>
          </div>
        )}
      </div>

      {/* Form Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-accent" />
              {editingEvent ? "Editar Compromisso" : "Agendar Compromisso"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ex: Manutenção do Caminhão Pipa"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Detalhes adicionais sobre o compromisso..."
                className="min-h-16"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data_inicio">Início</Label>
                <Input
                  id="data_inicio"
                  type="datetime-local"
                  value={form.data_inicio}
                  onChange={(e) => setForm(prev => ({ ...prev, data_inicio: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data_fim">Fim (Opcional)</Label>
                <Input
                  id="data_fim"
                  type="datetime-local"
                  value={form.data_fim}
                  onChange={(e) => setForm(prev => ({ ...prev, data_fim: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: any) => setForm(prev => ({ ...prev, status: v }))}
                >
                  <SelectTrigger id="status"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(v: any) => setForm(prev => ({ ...prev, prioridade: v }))}
                >
                  <SelectTrigger id="prioridade"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="categoria">Categoria</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v: any) => setForm(prev => ({ ...prev, categoria: v }))}
                >
                  <SelectTrigger id="categoria"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-border/60 pt-4 mt-2 space-y-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Associações (Opcional)</span>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="equipamento_id">Equipamento</Label>
                  <Select
                    value={form.equipamento_id}
                    onValueChange={(v) => setForm(prev => ({ ...prev, equipamento_id: v }))}
                  >
                    <SelectTrigger id="equipamento_id"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {equipamentos.map(eq => (
                        <SelectItem key={eq.id} value={eq.id}>{getEquipLabel(eq)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="empresa_id">Empresa</Label>
                  <Select
                    value={form.empresa_id}
                    onValueChange={(v) => setForm(prev => ({ ...prev, empresa_id: v }))}
                  >
                    <SelectTrigger id="empresa_id"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {empresas.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contrato_id">Contrato</Label>
                <Select
                  value={form.contrato_id}
                  onValueChange={(v) => setForm(prev => ({ ...prev, contrato_id: v }))}
                >
                  <SelectTrigger id="contrato_id"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {contratos.map(c => {
                      const label = `Contrato #${c.id.slice(0, 8)} — ${c.empresas?.nome || "Empresa"} / ${c.equipamentos?.tipo || "Equip."}`;
                      return (
                        <SelectItem key={c.id} value={c.id}>{label}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-border/60 pt-4 mt-2 space-y-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Informações Monday (Opcional)</span>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="responsavel_nome">Responsável</Label>
                  <Select
                    value={form.responsavel_nome || "none"}
                    onValueChange={(v) => setForm(prev => ({ ...prev, responsavel_nome: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger id="responsavel_nome">
                      <SelectValue placeholder="Selecione um responsável..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {usuarios.map(u => (
                        <SelectItem key={u.user_id} value={u.nome}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="orcamento">Orçamento (R$)</Label>
                  <Input
                    id="orcamento"
                    type="number"
                    value={form.orcamento || ""}
                    onChange={(e) => setForm(prev => ({ ...prev, orcamento: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notas">Notas / Observações</Label>
                <Textarea
                  id="notas"
                  value={form.notas}
                  onChange={(e) => setForm(prev => ({ ...prev, notas: e.target.value }))}
                  placeholder="Notas rápidas..."
                  className="min-h-12"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            {editingEvent && (
              <Button
                variant="destructive"
                onClick={() => {
                  handleDeleteEvent(editingEvent.id);
                  setDialogOpen(false);
                }}
                className="sm:mr-auto"
              >
                Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEvent} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Event Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                {viewEvent?.titulo}
              </DialogTitle>
              <Badge className={
                viewEvent?.prioridade === "Alta" ? "bg-[#A1343C]/15 text-[#A1343C] border-0 font-bold" :
                viewEvent?.prioridade === "Média" ? "bg-[#E66C37]/15 text-[#E66C37] border-0 font-bold" :
                "bg-[#3F7343]/15 text-[#3F7343] border-0 font-bold"
              }>
                {viewEvent?.prioridade}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3 text-sm">
            {viewEvent?.descricao ? (
              <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Descrição</span>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed break-words">
                  {viewEvent.descricao}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem descrição informada.</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Status</span>
                <Badge className={
                  viewEvent?.status === "Concluído" ? "bg-[#3F7343]/15 text-[#3F7343] border-0 font-semibold" :
                  viewEvent?.status === "Em Andamento" ? "bg-[#E66C37]/15 text-[#E66C37] border-0 font-semibold" :
                  "bg-[#A1343C]/15 text-[#A1343C] border-0 font-semibold"
                }>
                  {viewEvent?.status}
                </Badge>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Categoria</span>
                <Badge variant="outline" className="bg-muted/20 border-border text-muted-foreground font-semibold">
                  {viewEvent?.categoria}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Data Início</span>
                <span className="text-sm text-foreground flex items-center gap-1.5 mt-0.5">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  {viewEvent?.data_inicio ? new Date(viewEvent.data_inicio).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Data Término</span>
                <span className="text-sm text-foreground flex items-center gap-1.5 mt-0.5">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  {viewEvent?.data_fim ? new Date(viewEvent.data_fim).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Responsável</span>
                <span className="text-sm font-medium text-foreground block mt-0.5">
                  {viewEvent?.responsavel_nome || <span className="text-muted-foreground italic">Sem responsável</span>}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Orçamento</span>
                <span className="text-sm font-semibold text-foreground font-mono block mt-0.5">
                  {Number(viewEvent?.orcamento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </div>

            {(viewEvent?.notas || viewEvent?.notes) && (
              <div className="border-t border-border/40 pt-3 space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Notas</span>
                <p className="text-xs text-foreground bg-muted/20 p-2.5 rounded border border-border/50 break-words mt-0.5 leading-relaxed">
                  {viewEvent.notes || viewEvent.notas}
                </p>
              </div>
            )}

            {(viewEvent?.equipamentos || viewEvent?.empresas) && (
              <div className="border-t border-border/40 pt-3 space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Associações</span>
                
                {viewEvent?.equipamentos && (
                  <div className="flex items-center gap-2 text-sm bg-muted/20 p-2 rounded border border-border/50">
                    <LinkIcon className="h-4 w-4 text-accent shrink-0" />
                    <span className="text-xs text-muted-foreground font-medium mr-1">Equipamento:</span>
                    <span className="font-medium text-foreground text-xs">
                      {viewEvent.equipamentos.tipo} {viewEvent.equipamentos.modelo} {viewEvent.equipamentos.tag_placa ? `(${viewEvent.equipamentos.tag_placa})` : ""}
                    </span>
                  </div>
                )}

                {viewEvent?.empresas && (
                  <div className="flex items-center gap-2 text-sm bg-muted/20 p-2 rounded border border-border/50">
                    <LinkIcon className="h-4 w-4 text-success shrink-0" />
                    <span className="text-xs text-muted-foreground font-medium mr-1">Empresa:</span>
                    <span className="font-medium text-foreground text-xs">{viewEvent.empresas.nome}</span>
                  </div>
                )}
              </div>
            )}

            {/* Etapas de Trabalho / Workflow Stages */}
            <div className="border-t border-border/40 pt-4 space-y-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Etapas da Demanda</span>
              
              {/* Stages List */}
              <div className="space-y-2">
                {viewEvent?.etapas && viewEvent.etapas.length > 0 ? (
                  viewEvent.etapas.map(etapa => {
                    const isAssignee = etapa.responsavel_nome === currentUserNome;
                    const isConcludingThis = editingStageObsId === etapa.id;

                    return (
                      <div key={etapa.id} className="space-y-1.5 p-2.5 rounded bg-muted/20 border border-border/50 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="font-semibold text-foreground">{etapa.titulo}</span>
                            <div className="text-muted-foreground text-[10px] flex flex-wrap gap-x-2">
                              <span>Resp: <strong>{etapa.responsavel_nome}</strong></span>
                              <span>Solicitado por: <strong>{etapa.solicitante_nome}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isAssignee && etapa.status !== "Concluído" ? (
                              <Select
                                value={etapa.status}
                                onValueChange={(val: any) => handleUpdateStageStatus(etapa.id, val)}
                              >
                                <SelectTrigger className={`h-6 text-[10px] font-bold text-white border-0 rounded-sm shadow-none focus:ring-0 ${
                                  etapa.status === "Concluído" ? "bg-[#3F7343]" :
                                  etapa.status === "Em Andamento" ? "bg-[#E66C37]" : "bg-[#A1343C]"
                                }`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUSES.map(st => (
                                    <SelectItem key={st} value={st} className="text-xs font-semibold">{st}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={
                                etapa.status === "Concluído" ? "bg-[#3F7343]/15 text-[#3F7343] border-0 font-semibold" :
                                etapa.status === "Em Andamento" ? "bg-[#E66C37]/15 text-[#E66C37] border-0 font-semibold" :
                                "bg-[#A1343C]/15 text-[#A1343C] border-0 font-semibold"
                              }>
                                {etapa.status}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Exibir observações cadastradas na etapa */}
                        {etapa.observacoes && (
                          <div className="mt-1.5 p-2 rounded bg-background/50 border border-border/40 text-[11px] text-foreground/90">
                            <strong className="text-muted-foreground font-semibold">Obs. de Conclusão:</strong> {etapa.observacoes}
                          </div>
                        )}

                        {/* Formulário inline para preenchimento de observações de conclusão */}
                        {isConcludingThis && (
                          <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground">Observações / Considerações de Conclusão (Opcional)</Label>
                            <Textarea
                              placeholder="Digite aqui observações adicionais sobre a conclusão desta etapa..."
                              value={stageObsInput}
                              onChange={(e) => setStageObsInput(e.target.value)}
                              className="h-14 text-xs bg-background/60"
                            />
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setEditingStageObsId(null)}
                                className="h-6 text-[10px]"
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="xs"
                                onClick={() => handleUpdateStageStatus(etapa.id, "Concluído", stageObsInput.trim())}
                                className="h-6 text-[10px] bg-[#3F7343] text-white hover:bg-[#3F7343]/90"
                              >
                                Confirmar Conclusão
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-1">Esta tarefa ainda não possui sub-etapas definidas.</p>
                )}
              </div>

              {/* Add New Stage Form - Only if task is not completed */}
              {viewEvent?.status !== "Concluído" && (
                <div className="bg-muted/10 p-3 rounded-lg border border-dashed border-border/80 space-y-2 mt-2">
                  <span className="text-[11px] font-bold text-muted-foreground block">Nova Etapa</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Descrição da etapa..."
                      value={newStageTitle}
                      onChange={(e) => setNewStageTitle(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                    <Select
                      value={newStageAssignee || "none"}
                      onValueChange={(val) => setNewStageAssignee(val === "none" ? "" : val)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Responsável..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione...</SelectItem>
                        {usuarios.map(u => (
                          <SelectItem key={u.user_id} value={u.nome} className="text-xs">{u.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="xs" onClick={handleAddStage} className="w-full bg-accent text-accent-foreground text-xs mt-1">
                    <Plus className="h-3 w-3 mr-1" /> Adicionar Etapa
                  </Button>
                </div>
              )}
            </div>

            {/* Histórico da Demanda / Full Audit Logs */}
            <div className="border-t border-border/40 pt-4 space-y-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Histórico de Atividades</span>
              <div className="max-h-48 overflow-y-auto divide-y divide-border border border-border rounded-lg bg-muted/5 scrollbar-thin">
                {viewEvent?.historico && viewEvent.historico.length > 0 ? (
                  viewEvent.historico.map((log, index) => (
                    <div key={index} className="p-2.5 text-xs space-y-0.5">
                      <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                        <span className="font-semibold text-foreground/80">{log.usuario}</span>
                        <span>{new Date(log.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                      <p className="font-medium text-foreground">{log.acao}</p>
                      {log.detalhes && <p className="text-muted-foreground text-[10px] italic">{log.detalhes}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic p-3 text-center">Nenhum registro de atividades cadastrado.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row sm:justify-end gap-2 border-t border-border/40 pt-3 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewDialogOpen(false)}
              className="mr-auto sm:mr-0"
            >
              Fechar
            </Button>
            {viewEvent?.status !== "Concluído" && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setViewDialogOpen(false);
                    if (viewEvent) openEdit(viewEvent);
                  }}
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setViewDialogOpen(false);
                    if (viewEvent) handleDeleteEvent(viewEvent.id);
                  }}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SQL Script Migration Modal */}
      <Dialog open={sqlModalOpen} onOpenChange={setSqlModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-accent" />
              Sincronizar com Banco de Dados Supabase
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3 text-sm">
            <p className="text-muted-foreground leading-relaxed">
              Para ativar o salvamento na nuvem e o compartilhamento da Agenda entre os computadores da empresa, você deve executar o script de migração na sua plataforma Supabase.
            </p>
            <div className="space-y-2">
              <span className="font-semibold block">Passo a Passo:</span>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Acesse o seu dashboard da **Supabase** (https://supabase.com).</li>
                <li>Selecione o projeto correspondente à sua aplicação.</li>
                <li>Acesse o menu **SQL Editor** no menu esquerdo.</li>
                <li>Clique em **New query**, cole o código abaixo e clique em **Run**.</li>
              </ol>
            </div>
            <div className="relative rounded-lg overflow-hidden border border-border bg-muted/60 p-4 font-mono text-xs">
              <pre className="overflow-x-auto whitespace-pre scrollbar-thin max-h-60 leading-relaxed text-muted-foreground">
                {migrationSql}
              </pre>
              <Button
                size="icon"
                variant="secondary"
                onClick={handleCopySql}
                className="absolute top-3 right-3 h-8 w-8 bg-background border border-border"
              >
                {copiedSql ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSqlModalOpen(false)} className="bg-accent text-accent-foreground hover:bg-accent/90">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
