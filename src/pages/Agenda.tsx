import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Eye,
  MessageSquare,
  CalendarPlus,
  Send,
  FileDown,
  Workflow,
  TrendingUp,
  CheckSquare,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEquipLabel } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// Helper: envia notificacao para um usuario pelo nome
async function sendNotification({
  responsavelNome,
  tipo,
  titulo,
  mensagem,
  referenciaId,
}: {
  responsavelNome: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  referenciaId?: string;
}) {
  if (!responsavelNome) return;
  try {
    const { data: usuariosData } = await supabase
      .from("usuarios")
      .select("user_id")
      .ilike("nome", responsavelNome.trim())
      .limit(1);
    const userId = usuariosData?.[0]?.user_id;
    if (!userId) return;
    await supabase.from("notificacoes").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      tipo,
      titulo,
      mensagem,
      lida: false,
      referencia_tipo: "agenda",
      referencia_id: referenciaId || null,
    });
  } catch {}
}

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; }
interface Empresa { id: string; nome: string; }
interface Contrato { id: string; empresa_id: string; empresas: { nome: string } | null; equipamento_id: string; equipamentos: { tipo: string; modelo: string } | null; }

interface Etapa {
  id: string;
  titulo: string;
  responsavel_nome: string;
  solicitante_nome: string;
  status: "A Fazer" | "Em Andamento" | "Aguardando Aprovação" | "Concluído";
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
  status: "A Fazer" | "Em Andamento" | "Aguardando Aprovação" | "Concluído";
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
  recorrencia?: "Nenhuma" | "Diária" | "Semanal" | "Mensal";
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
const STATUSES = ["A Fazer", "Em Andamento", "Aguardando Aprovação", "Concluído"] as const;

// Helpers para WhatsApp e Google Calendar
export const generateWhatsAppLink = (event: AgendaEvent) => {
  const data = event.data_inicio ? new Date(event.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' }) : "Não definida";
  const text = `📅 *Lembrete de Tarefa/Evento*\n\n*Título:* ${event.titulo}\n*Data:* ${data}\n*Status:* ${event.status}\n*Prioridade:* ${event.prioridade}\n\n*Detalhes:* ${event.descricao || "Sem detalhes adicionais"}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

export const generateGoogleCalendarLink = (event: AgendaEvent) => {
  const formatGoogleDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };
  const start = event.data_inicio ? formatGoogleDate(event.data_inicio) : "";
  const end = event.data_fim ? formatGoogleDate(event.data_fim) : start; // If no end, same as start
  const details = event.descricao ? encodeURIComponent(event.descricao) : "";
  const title = encodeURIComponent(event.titulo);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
};

const stickyColors = {
  yellow: "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-900/50",
  blue: "bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-900/50",
  green: "bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-900/50",
  pink: "bg-pink-100 dark:bg-pink-950/30 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-900/50",
};

export default function Agenda() {
  const { profile, role } = useAuth();
  const currentUserNome = profile?.nome || "Sistema";
  const isAdmin = role === "admin" || role === "superadmin";
  const [activeTab, setActiveTab] = useState<"pipeline" | "kanban" | "calendar" | "notes">("pipeline");
  const [calendarMode, setCalendarMode] = useState<"day" | "month" | "year">("month");
  const [viewAll, setViewAll] = useState(false);
  
  // Data lists
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [stickies, setStickies] = useState<StickyItem[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [usuarios, setUsuarios] = useState<{ user_id: string; nome: string; }[]>([]);

  const [faturamentos, setFaturamentos] = useState<any[]>([]);
  const [invoiceResponsibles, setInvoiceResponsibles] = useState<Record<string, string>>({});

  // Custom Workflow & Stepper States
  const [contasBancarias, setContasBancarias] = useState<any[]>([]);
  const [selectedApprovers, setSelectedApprovers] = useState<Record<string, string>>({});
  const [billingForm, setBillingForm] = useState<Record<string, {
    numeroNota: string;
    emissaoDate: string;
    contaBancariaId: string;
    observacoes: string;
  }>>({});
  const [previewFaturaId, setPreviewFaturaId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    fatura: any;
    contrato: any;
    empresa: any;
    equipamentosItens: any[];
    gastosItens: any[];
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const navigate = useNavigate();

  const handleDownloadMedicaoPDF = async (faturaId: string) => {
    try {
      const { data: fatura, error: fatError } = await supabase
        .from("faturamento")
        .select("*")
        .eq("id", faturaId)
        .single();
      if (fatError || !fatura) throw new Error("Faturamento não encontrado.");

      const { data: contrato, error: ctError } = await supabase
        .from("contratos")
        .select("*")
        .eq("id", fatura.contrato_id)
        .single();
      if (ctError || !contrato) throw new Error("Contrato não encontrado.");

      const { data: empresa } = contrato.empresa_id ? await supabase
        .from("empresas")
        .select("*")
        .eq("id", contrato.empresa_id)
        .single() : { data: null };

      const { data: equipamento } = contrato.equipamento_id ? await supabase
        .from("equipamentos")
        .select("*")
        .eq("id", contrato.equipamento_id)
        .single() : { data: null };

      const { data: allEmpresas } = await supabase
        .from("empresas")
        .select("id, nome, cnpj, razao_social, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, inscricao_estadual, inscricao_municipal, contato, telefone, obra, email");

      const contratoMapped = {
        ...contrato,
        empresas: empresa || null,
        equipamentos: equipamento || null
      };

      const faturaMapped = {
        ...fatura,
        contratos: contratoMapped
      };

      const { exportDetailedFaturamentoPDF } = await import("@/lib/faturamentoExportUtils");
      await exportDetailedFaturamentoPDF([faturaMapped], allEmpresas || []);
      toast({ title: "Sucesso", description: "PDF da medição baixado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    }
  };

  const handleOpenPreview = async (faturaId: string) => {
    setPreviewFaturaId(faturaId);
    setLoadingPreview(true);
    setPreviewData(null);
    try {
      const { data: fatura, error: fatError } = await supabase
        .from("faturamento")
        .select("*")
        .eq("id", faturaId)
        .single();
      if (fatError || !fatura) throw new Error("Faturamento não encontrado.");

      const { data: contrato, error: ctError } = await supabase
        .from("contratos")
        .select("*")
        .eq("id", fatura.contrato_id)
        .single();
      if (ctError || !contrato) throw new Error("Contrato não encontrado.");

      const { data: empresa } = contrato.empresa_id ? await supabase
        .from("empresas")
        .select("*")
        .eq("id", contrato.empresa_id)
        .single() : { data: null };

      const { data: equipamento } = contrato.equipamento_id ? await supabase
        .from("equipamentos")
        .select("*")
        .eq("id", contrato.equipamento_id)
        .single() : { data: null };

      const { data: fatEquips } = await supabase
        .from("faturamento_equipamentos")
        .select("*")
        .eq("faturamento_id", faturaId);

      let fatEquipsMapped: any[] = [];
      if (fatEquips && fatEquips.length > 0) {
        const equipIds = fatEquips.map(fe => fe.equipamento_id).filter(Boolean);
        if (equipIds.length > 0) {
          const { data: equipsData } = await supabase
            .from("equipamentos")
            .select("*")
            .in("id", equipIds);
          const equipsMap = new Map((equipsData || []).map(e => [e.id, e]));
          fatEquipsMapped = fatEquips.map(fe => ({
            ...fe,
            equipamentos: equipsMap.get(fe.equipamento_id) || null
          }));
        }
      }

      const { data: fatGastos } = await supabase
        .from("faturamento_gastos")
        .select("gasto_id")
        .eq("faturamento_id", faturaId);
        
      let gastosDetails: any[] = [];
      if (fatGastos && fatGastos.length > 0) {
        const gIds = fatGastos.map(g => g.gasto_id).filter(Boolean);
        if (gIds.length > 0) {
          const { data: gData } = await supabase
            .from("gastos")
            .select("*")
            .in("id", gIds);
          if (gData) gastosDetails = gData;
        }
      }

      const contratoMapped = {
        ...contrato,
        empresas: empresa || null,
        equipamentos: equipamento || null
      };

      setPreviewData({
        fatura,
        contrato: contratoMapped,
        empresa: empresa || null,
        equipamentosItens: fatEquipsMapped,
        gastosItens: gastosDetails
      });
    } catch (err: any) {
      toast({ title: "Erro ao carregar medição", description: err.message, variant: "destructive" });
      setPreviewFaturaId(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSendToApproval = async (item: AgendaEvent) => {
    const selectedApprover = selectedApprovers[item.id] || "none";
    const approverName = selectedApprover === "none" ? "" : selectedApprover;
    
    const match = item.notas?.match(/\[Medição ID:\s*([a-f0-9\-]{36})\]/i);
    const faturaId = match ? match[1] : null;

    try {
      const { error: agendaError } = await supabase
        .from("agenda")
        .update({
          responsavel_nome: approverName,
          status: "Aguardando Aprovação"
        })
        .eq("id", item.id);
      if (agendaError) throw agendaError;

      if (faturaId) {
        const { error: fatError } = await supabase
          .from("faturamento")
          .update({ status: "Aguardando Aprovação" } as any)
          .eq("id", faturaId);
        if (fatError) throw fatError;
      }

      toast({
        title: "Medição enviada para aprovação",
        description: `Tarefa atribuída a ${approverName || "Administradores"}.`
      });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao enviar para aprovação", description: err.message, variant: "destructive" });
    }
  };

  const handleQuickApproveMedicao = async (item: AgendaEvent) => {
    const match = item.notas?.match(/\[Medição ID:\s*([a-f0-9\-]{36})\]/i);
    const faturaId = match ? match[1] : null;
    
    const selectedResp = invoiceResponsibles[item.id] || "none";
    if (selectedResp === "none") {
      toast({ 
        title: "Responsável Necessário", 
        description: "Por favor, selecione quem será a pessoa responsável por emitir a Fatura.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      if (faturaId) {
        const { error: fatError } = await supabase
          .from("faturamento")
          .update({ 
            status: "Aprovado",
            data_aprovacao: new Date().toISOString()
          } as any)
          .eq("id", faturaId);
        if (fatError) throw fatError;
      }
      
      const clientNome = item.empresas?.nome || "Cliente";
      const refMatch = item.titulo.match(/\(Ref:\s*([^\)]+)\)/i);
      const ref = refMatch ? refMatch[1] : "";
      const refStr = ref ? ` (Ref: ${ref})` : "";

      const newFaturamentoEvent: any = {
        titulo: `Emitir Fatura - ${clientNome}${refStr}`,
        descricao: `Medição aprovada. Lançar o número da nota fiscal (FAT...) para concluir o faturamento.`,
        data_inicio: new Date().toISOString(),
        status: "A Fazer",
        prioridade: "Média",
        categoria: "Faturamento",
        contrato_id: item.contrato_id,
        empresa_id: item.empresa_id || item.empresas?.id || null,
        notas: `[Medição ID: ${faturaId || ""}]`,
        responsavel_nome: selectedResp,
        etapas: [],
        historico: [{
          data: new Date().toISOString(),
          usuario: "Sistema",
          acao: "Criado",
          detalhes: `Tarefa de faturamento iniciada com responsável ${selectedResp}.`
        }],
        orcamento: item.orcamento || 0
      };

      if (isLocalMode) {
        const localEvents = localStorage.getItem("busato-agenda-events");
        let currentEvents = localEvents ? JSON.parse(localEvents) : [];
        
        // Complete the current event
        currentEvents = currentEvents.map((ev: any) => 
          ev.id === item.id ? { ...ev, status: "Concluído" } : ev
        );

        // Add the new faturamento event
        currentEvents.push({
          ...newFaturamentoEvent,
          id: `agenda-${Date.now()}`
        });

        localStorage.setItem("busato-agenda-events", JSON.stringify(currentEvents));
      } else {
        // Update the current event if it's real
        if (item.id && !item.id.startsWith("virtual-")) {
          const { error: agendaError } = await supabase
            .from("agenda")
            .update({ status: "Concluído" })
            .eq("id", item.id);
          if (agendaError) throw agendaError;
        }

        // Insert new faturamento event
        const { error: insertError } = await supabase
          .from("agenda")
          .insert(newFaturamentoEvent);
        if (insertError) throw insertError;
      }

      toast({ title: "Medição Aprovada", description: `Medição aprovada. Faturamento direcionado para ${selectedResp}.` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao aprovar medição", description: err.message, variant: "destructive" });
    }
  };

  const handleFormChange = (eventId: string, field: string, val: string) => {
    setBillingForm(prev => {
      const current = prev[eventId] || {
        numeroNota: "",
        emissaoDate: new Date().toISOString().slice(0, 10),
        contaBancariaId: "none",
        observacoes: ""
      };
      return {
        ...prev,
        [eventId]: {
          ...current,
          [field]: val
        }
      };
    });
  };

  const handleEmitirFaturaKanban = async (item: AgendaEvent, faturaId: string) => {
    const formVal = billingForm[item.id] || {
      numeroNota: "",
      emissaoDate: new Date().toISOString().slice(0, 10),
      contaBancariaId: "none",
      observacoes: ""
    };

    if (!formVal.numeroNota.trim()) {
      toast({ title: "Campo obrigatório", description: "Por favor, informe o número da Nota Fiscal.", variant: "destructive" });
      return;
    }
    
    try {
      const updatePayload: any = {
        numero_nota: formVal.numeroNota,
        emissao: formVal.emissaoDate,
        data_aprovacao: formVal.emissaoDate,
        observacoes: formVal.observacoes || ""
      };
      
      if (formVal.contaBancariaId && formVal.contaBancariaId !== "none") {
        updatePayload.conta_bancaria_id = formVal.contaBancariaId;
      }
      
      const { error } = await supabase
        .from("faturamento")
        .update(updatePayload)
        .eq("id", faturaId);
        
      if (error) throw error;
      
      if (item.id && !item.id.startsWith("virtual-")) {
        const { error: agendaError } = await supabase
          .from("agenda")
          .update({ status: "Concluído" })
          .eq("id", item.id);
        if (agendaError) throw agendaError;
      }

      toast({ title: "Fatura emitida", description: "A fatura foi emitida e a tarefa foi marcada como Concluída!" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao emitir fatura", description: err.message, variant: "destructive" });
    }
  };

  const getWorkflowSteps = (item: AgendaEvent) => {
    const isMedicao = item.categoria === "Medição";
    const isFaturamento = item.categoria === "Faturamento";
    if (!isMedicao && !isFaturamento) return null;

    let currentStep = 0;
    if (isMedicao) {
      if (item.status === "Aguardando Aprovação") {
        currentStep = 1;
      } else if (item.status === "Concluído") {
        currentStep = 3;
      } else {
        currentStep = 0;
      }
    } else if (isFaturamento) {
      if (item.status === "Concluído") {
        currentStep = 3;
      } else {
        currentStep = 2;
      }
    }

    return [
      { label: "Medição", active: currentStep === 0, completed: currentStep > 0 },
      { label: "Aprovação", active: currentStep === 1, completed: currentStep > 1 },
      { label: "Faturamento", active: currentStep === 2, completed: currentStep > 2 },
      { label: "Concluído", active: currentStep === 3, completed: currentStep >= 3 },
    ];
  };

  const renderWorkflowStepper = (item: AgendaEvent) => {
    const steps = getWorkflowSteps(item);
    if (!steps) return null;

    return (
      <div className="flex items-center justify-between w-full my-4 px-2 select-none">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <div key={idx} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center relative animate-fade-in">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 border-2 ${
                    step.completed
                      ? "bg-success border-success text-white"
                      : step.active
                      ? "bg-accent/15 border-accent text-accent shadow-[0_0_8px_rgba(230,108,55,0.4)] animate-pulse"
                      : "bg-muted border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {step.completed ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span
                  className={`text-[8px] font-semibold mt-1 absolute -bottom-3.5 whitespace-nowrap transition-colors ${
                    step.active ? "text-accent font-bold" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`h-0.5 flex-1 mx-2 rounded transition-all duration-300 ${
                    step.completed ? "bg-success" : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

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
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [editingNotasCardId, setEditingNotasCardId] = useState<string | null>(null);
  const [notasInput, setNotasInput] = useState<string>("");

  const [form, setForm] = useState<{
    titulo: string;
    descricao: string;
    data_inicio: string;
    data_fim: string;
    status: "A Fazer" | "Em Andamento" | "Aguardando Aprovação" | "Concluído";
    prioridade: "Baixa" | "Média" | "Alta";
    categoria: "Geral" | "Manutenção" | "Faturamento" | "Reunião" | "Outros" | "Liberação de Equipamento";
    equipamento_id: string;
    contrato_id: string;
    empresa_id: string;
    orcamento: number;
    notas: string;
    responsavel_nome: string;
    arquivos: string[];
    recorrencia: "Nenhuma" | "Diária" | "Semanal" | "Mensal";
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
    recorrencia: "Nenhuma",
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
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS recorrencia TEXT DEFAULT 'Nenhuma';
`;

  // Fetch relations + initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch relations
      const [equipRes, empRes, ctRes, profilesRes, contasRes, faturamentoRes] = await Promise.all([
        supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").order("tipo"),
        supabase.from("empresas").select("id, nome").order("nome"),
        supabase.from("contratos").select("id, empresa_id, equipamento_id"),
        supabase.from("profiles").select("user_id, nome").order("nome"),
        supabase.from("contas_bancarias").select("*").order("banco"),
        supabase.from("faturamento").select("*")
      ]);

      if (equipRes.data) setEquipamentos(equipRes.data as any);
      if (empRes.data) setEmpresas(empRes.data as any);
      
      const resolvedEmp = empRes.data || [];
      const resolvedEquip = equipRes.data || [];
      if (ctRes.data) {
        const mappedContratos = ctRes.data.map((c: any) => ({
          ...c,
          empresas: resolvedEmp.find((e: any) => e.id === c.empresa_id) || null,
          equipamentos: resolvedEquip.find((eq: any) => eq.id === c.equipamento_id) || null
        }));
        setContratos(mappedContratos as any);
      }
      
      if (profilesRes.data) setUsuarios(profilesRes.data as any);
      if (contasRes.data) setContasBancarias(contasRes.data);

      // 2. Fetch agenda events
      const { data: dbEvents, error: dbError } = await supabase
        .from("agenda")
        .select("*, equipamentos:equipamento_id(id, tipo, modelo, tag_placa), empresas:empresa_id(id, nome), contratos:contrato_id(id)")
        .order("data_inicio", { ascending: true });

      let rawEvents: any[] = [];
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
            rawEvents = JSON.parse(localEvents);
          }
        } else {
          throw dbError;
        }
      } else if (dbEvents) {
        setIsLocalMode(false);
        rawEvents = [...dbEvents];
      }

      // Resolve all relationships in-memory to prevent null/undefined references
      const resolvedEmpresas = empRes.data || [];
      const resolvedContratos = ctRes.data || [];
      const resolvedEquipamentos = equipRes.data || [];

      rawEvents = rawEvents.map((item: any) => {
        let emp = item.empresas;
        if (!emp || !emp.nome || emp.nome === "Cliente" || emp.nome === "CLIENTE") {
          emp = resolvedEmpresas.find((e: any) => e.id === item.empresa_id) || null;
        }
        if ((!emp || !emp.nome || emp.nome === "Cliente" || emp.nome === "CLIENTE") && item.contrato_id) {
          const ct = resolvedContratos.find((c: any) => c.id === item.contrato_id);
          if (ct) {
            emp = resolvedEmpresas.find((e: any) => e.id === ct.empresa_id) || null;
          }
        }

        // Fallback: check if we can resolve via faturamento in notes
        if (!emp || !emp.nome || emp.nome === "Cliente" || emp.nome === "CLIENTE") {
          const match = item.notas?.match(/\[Medição ID:\s*([a-f0-9\-]{36})\]/i);
          const fatId = match ? match[1] : null;
          if (fatId && faturamentoRes.data) {
            const fat = faturamentoRes.data.find((f: any) => f.id === fatId);
            if (fat) {
              const targetEmpId = fat.empresa_id;
              if (targetEmpId) {
                emp = resolvedEmpresas.find((e: any) => e.id === targetEmpId) || null;
              }
              if ((!emp || !emp.nome || emp.nome === "Cliente" || emp.nome === "CLIENTE") && fat.contrato_id) {
                const ct = resolvedContratos.find((c: any) => c.id === fat.contrato_id);
                if (ct) {
                  emp = resolvedEmpresas.find((e: any) => e.id === ct.empresa_id) || null;
                }
              }
            }
          }
        }
        
        let equip = item.equipamentos;
        if (!equip || !equip.tipo) {
          equip = resolvedEquipamentos.find((eq: any) => eq.id === item.equipamento_id) || null;
        }
        if (!equip && item.contrato_id) {
          const ct = resolvedContratos.find((c: any) => c.id === item.contrato_id);
          if (ct) {
            equip = resolvedEquipamentos.find((eq: any) => eq.id === ct.equipamento_id) || null;
          }
        }

        // Dynamically replace fallback name in the title if we resolved a real company name
        let titulo = item.titulo;
        if (emp && emp.nome && emp.nome !== "Cliente" && emp.nome !== "CLIENTE" && titulo.includes(" - Cliente")) {
          titulo = titulo.replace(" - Cliente", ` - ${emp.nome}`);
        }

        return {
          ...item,
          titulo,
          empresas: emp,
          equipamentos: equip
        };
      });

      // Reconciliation logic: Auto-sync any faturamento records that lack corresponding agenda tasks
      if (faturamentoRes.data) {
        setFaturamentos(faturamentoRes.data);
        const faturamentos = faturamentoRes.data;
        faturamentos.forEach((fat: any) => {
          // Determine target category first based on faturamento status
          let targetCategoria: "Medição" | "Faturamento" = "Medição";
          if (fat.status === "Pago" || fat.status === "Aprovado") {
            targetCategoria = "Faturamento";
          }

          // Look for an existing agenda event of this category linked to this faturamento ID in 'notas'
          const hasEvent = rawEvents.some(ev => ev.notas?.includes(fat.id) && ev.categoria === targetCategoria);
          if (!hasEvent) {
            const ct = ctRes.data?.find((c: any) => c.id === fat.contrato_id);
            const clientNome = empRes.data?.find((e: any) => e.id === (fat.empresa_id || ct?.empresa_id))?.nome || "Cliente";
            const periodo = fat.periodo || "";
            
            // Determine status, category, title based on faturamento status
            let status: "A Fazer" | "Em Andamento" | "Aguardando Aprovação" | "Concluído" = "Em Andamento";
            let categoria: "Medição" | "Faturamento" = "Medição";
            let titulo = "";
            let descricao = "";

            if (fat.status === "Pago") {
              status = "Concluído";
              categoria = "Faturamento";
              titulo = `Fatura Liquidada - ${clientNome} (Ref: ${periodo})`;
              descricao = `Faturamento concluído e pago.`;
            } else if (fat.status === "Aprovado") {
              if (fat.numero_nota) {
                status = "Concluído";
                categoria = "Faturamento";
                titulo = `Faturado - ${clientNome} (Ref: ${periodo})`;
                descricao = `Nota fiscal emitida (${fat.numero_nota}). Faturamento concluído.`;
              } else {
                status = "A Fazer";
                categoria = "Faturamento";
                titulo = `Emitir Fatura - ${clientNome} (Ref: ${periodo})`;
                descricao = `Medição aprovada. Lançar o número da nota fiscal (FAT...) para concluir o faturamento.`;
              }
            } else if (fat.status === "Aguardando Aprovação") {
              status = "Aguardando Aprovação";
              categoria = "Medição";
              titulo = `Aprovação de Medição - ${clientNome} (Ref: ${periodo})`;
              descricao = `Medição gerada aguardando conferência e aprovação.`;
            } else if (fat.status === "Pendente") {
              status = "Em Andamento";
              categoria = "Medição";
              titulo = `Medição em Aberto - ${clientNome} (Ref: ${periodo})`;
              descricao = `Lançamentos de horímetro em andamento para o período.`;
            } else {
              return;
            }

            rawEvents.push({
              id: `virtual-${fat.id}`,
              titulo,
              descricao,
              data_inicio: fat.data_aprovacao || fat.emissao || fat.created_at || new Date().toISOString(),
              status,
              prioridade: "Média",
              categoria,
              contrato_id: fat.contrato_id,
              empresa_id: fat.empresa_id || ct?.empresa_id || null,
              empresas: { id: fat.empresa_id || ct?.empresa_id || "", nome: clientNome },
              notas: `[Medição ID: ${fat.id}]`,
              responsavel_nome: "",
              etapas: [],
              historico: [],
              orcamento: fat.valor_total || 0
            });
          }
        });
      }

      setEvents(rawEvents);
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
      recorrencia: "Nenhuma",
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
      recorrencia: e.recorrencia || "Nenhuma",
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
      recorrencia: form.recorrencia,
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

      // Auto-populate checklist if category is "Liberação de Equipamento"
      if (payload.categoria === "Liberação de Equipamento") {
        payload.etapas = [
          { id: crypto.randomUUID(), titulo: "Checklist Geral / Vistoria", responsavel_nome: payload.responsavel_nome || currentUserNome, solicitante_nome: currentUserNome, status: "A Fazer", created_at: new Date().toISOString() },
          { id: crypto.randomUUID(), titulo: "Verificar Documentação", responsavel_nome: payload.responsavel_nome || currentUserNome, solicitante_nome: currentUserNome, status: "A Fazer", created_at: new Date().toISOString() },
          { id: crypto.randomUUID(), titulo: "Manutenção Preventiva", responsavel_nome: payload.responsavel_nome || currentUserNome, solicitante_nome: currentUserNome, status: "A Fazer", created_at: new Date().toISOString() },
          { id: crypto.randomUUID(), titulo: "Verificar Horímetro atual", responsavel_nome: payload.responsavel_nome || currentUserNome, solicitante_nome: currentUserNome, status: "A Fazer", created_at: new Date().toISOString() },
          { id: crypto.randomUUID(), titulo: "Testar Rastreador", responsavel_nome: payload.responsavel_nome || currentUserNome, solicitante_nome: currentUserNome, status: "A Fazer", created_at: new Date().toISOString() },
          { id: crypto.randomUUID(), titulo: "Conferir Apólice de Seguro", responsavel_nome: payload.responsavel_nome || currentUserNome, solicitante_nome: currentUserNome, status: "A Fazer", created_at: new Date().toISOString() }
        ];
      }
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
          if (editingEvent.id && editingEvent.id.startsWith("virtual-")) {
            const newId = crypto.randomUUID();
            const newPayload = {
              ...payload,
              id: newId,
              criador_nome: currentUserNome,
              etapas: [],
              historico: [
                {
                  data: new Date().toISOString(),
                  usuario: currentUserNome,
                  acao: "Criou a tarefa virtual no banco",
                  detalhes: "Tarefa virtual salva como registro real no banco de dados."
                }
              ]
            };
            const { error } = await supabase.from("agenda").insert(newPayload);
            if (error) throw error;
            
            // Notify responsible if assigned
            if (payload.responsavel_nome) {
              await sendNotification({
                responsavelNome: payload.responsavel_nome,
                tipo: "tarefa",
                titulo: "Nova tarefa atribuída a você",
                mensagem: `Você foi definido como responsável pela tarefa: "${payload.titulo}".`,
                referenciaId: newId,
              });
            }
            toast({ title: "Sucesso", description: "Tarefa virtual salva no banco de dados." });
          } else {
            const { error } = await supabase.from("agenda").update(payload).eq("id", editingEvent.id);
            if (error) throw error;
            toast({ title: "Sucesso", description: "Compromisso atualizado." });
          }
        } else {
          const newId = crypto.randomUUID();
          const { error } = await supabase.from("agenda").insert({ ...payload, id: newId });
          if (error) throw error;
          // Notificar responsavel
          if (payload.responsavel_nome) {
            await sendNotification({
              responsavelNome: payload.responsavel_nome,
              tipo: "tarefa",
              titulo: "Nova tarefa atribuída a você",
              mensagem: `Você foi definido como responsável pela tarefa: "${payload.titulo}".`,
              referenciaId: newId,
            });
          }
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
        if (id && id.startsWith("virtual-")) {
          toast({ title: "Aviso", description: "Esta é uma tarefa gerada automaticamente baseada no faturamento e não pode ser excluída diretamente. Conclua o faturamento para encerrá-la." });
          return;
        }
        const { error } = await supabase.from("agenda").delete().eq("id", id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Compromisso removido." });
        fetchData();
      } catch (err: any) {
        toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
      }
    }
  };

  // Clone routine event logic
  const handleRoutineClone = async (event: AgendaEvent) => {
    if (!event.recorrencia || event.recorrencia === "Nenhuma") return;

    const currentStartDate = new Date(event.data_inicio);
    let nextStartDate = new Date(currentStartDate);

    if (event.recorrencia === "Diária") nextStartDate.setDate(nextStartDate.getDate() + 1);
    else if (event.recorrencia === "Semanal") nextStartDate.setDate(nextStartDate.getDate() + 7);
    else if (event.recorrencia === "Mensal") nextStartDate.setMonth(nextStartDate.getMonth() + 1);

    const newEventPayload = {
      titulo: event.titulo,
      descricao: event.descricao,
      data_inicio: nextStartDate.toISOString(),
      data_fim: null,
      status: "A Fazer" as const,
      prioridade: event.prioridade,
      categoria: event.categoria,
      equipamento_id: event.equipamento_id,
      contrato_id: event.contrato_id,
      empresa_id: event.empresa_id,
      orcamento: event.orcamento,
      notas: event.notas,
      responsavel_nome: event.responsavel_nome,
      recorrencia: event.recorrencia,
      arquivos: event.arquivos,
      criador_nome: currentUserNome,
      etapas: (event.etapas || []).map(et => ({ ...et, id: crypto.randomUUID(), status: "A Fazer" as const, observacoes: "" })),
      historico: [{
        data: new Date().toISOString(),
        usuario: currentUserNome,
        acao: "Criou tarefa automaticamente (Rotina)",
        detalhes: `Gerada a partir da rotina: ${event.titulo}`
      }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isLocalMode) {
      const newEvent: AgendaEvent = {
        ...newEventPayload,
        id: crypto.randomUUID(),
        equipamentos: event.equipamentos,
        empresas: event.empresas,
        contratos: event.contratos
      } as AgendaEvent;
      saveLocalEvents([...events, newEvent]);
    } else {
      const newId = crypto.randomUUID();
      await supabase.from("agenda").insert({ ...newEventPayload, id: newId });
      fetchData();
    }
    toast({ title: "Rotina Gerada", description: "O próximo cartão da rotina foi criado com sucesso." });
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
        // Approval Workflow Lock
        if (value === "Concluído" && (targetEvent.categoria === "Faturamento" || targetEvent.categoria === "Reunião")) { // Medição pode usar Reunião ou Outros, usar a mesma regra para aprovações
          if (!isAdmin) {
             toast({ title: "Ação não permitida", description: "Esta categoria de tarefa precisa de aprovação gerencial.", variant: "destructive" });
             value = "Aguardando Aprovação";
          }
        }

        historyMessage = `Alterou o status`;
        historyDetails = `De '${targetEvent.status}' para '${value}'`;
        updatedEvent.status = value;
      }
    } else {
      updatedEvent[field as keyof AgendaEvent] = value;
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

    // Routine logic
    if (updatedEvent.status === "Concluído" && targetEvent.status !== "Concluído") {
      handleRoutineClone(updatedEvent);
    }

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

        // Integration: Auto-approve linked Faturamento
        if (updatedEvent.status === "Concluído" && (updatedEvent.categoria === "Faturamento" || updatedEvent.categoria === "Medição")) {
          try {
             const faturaMatch = updatedEvent.notas?.match(/\[Medição ID:\s*([a-f0-9\-]{36})\]/i);
             if (faturaMatch && faturaMatch[1]) {
               const { error: fatError } = await supabase.from("faturamento").update({ status: "Aprovado" } as any).eq("id", faturaMatch[1]);
               if (!fatError) {
                 toast({ title: "Faturamento Aprovado", description: "O faturamento vinculado foi aprovado automaticamente." });
               }
             } else {
               const { error: fatError } = await supabase.from("faturamento").update({ status: "Aprovado" } as any).eq("agenda_event_id", eventId);
               if (!fatError) {
                 toast({ title: "Faturamento Aprovado", description: "O faturamento vinculado foi aprovado automaticamente." });
               }
             }
          } catch(e) {}
        }
      } catch (err: any) {
        toast({ title: "Erro ao atualizar campo", description: err.message, variant: "destructive" });
        fetchData();
      }
    }
  };

  // Helper for quick adding events from the Monday spreadsheet view with history logging
  const handleQuickAddEvent = async (titulo: string, status: "A Fazer" | "Em Andamento" | "Aguardando Aprovação" | "Concluído") => {
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
      recorrencia: "Nenhuma",
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

    // Notificar o responsavel da etapa
    if (!isLocalMode) {
      await sendNotification({
        responsavelNome: newStageAssignee,
        tipo: "etapa",
        titulo: "Nova etapa atribuída a você",
        mensagem: `Uma nova etapa "${newStageTitle.trim()}" foi criada para você na tarefa "${viewEvent?.titulo}".`,
        referenciaId: viewEvent?.id,
      });
    }
  };

  const handleUpdateNotas = async (id: string, newNotas: string) => {
    if (isLocalMode) {
      const updated = events.map(ev => (ev.id === id ? { ...ev, notas: newNotas } : ev));
      saveLocalEvents(updated);
      toast({ title: "Notas atualizadas", description: "As notas foram salvas localmente." });
    } else {
      try {
        const { error } = await supabase
          .from("agenda")
          .update({ notas: newNotas, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        setEvents(prev => prev.map(ev => (ev.id === id ? { ...ev, notas: newNotas } : ev)));
        if (viewEvent && viewEvent.id === id) {
          setViewEvent(prev => prev ? { ...prev, notas: newNotas } : null);
        }
        toast({ title: "Notas atualizadas", description: "As notas foram salvas com sucesso." });
      } catch (err: any) {
        toast({ title: "Erro ao atualizar notas", description: err.message, variant: "destructive" });
      }
    }
  };

  // Helper to update stage status inside View Dialog
  const handleUpdateStageStatus = async (stageId: string, newStatus: "A Fazer" | "Em Andamento" | "Aguardando Aprovação" | "Concluído", overrideObs?: string) => {
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
      status: newStatus as any,
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
    const diffTime = today.getTime() - deadline.getTime();
    if (diffTime <= 0) return 0;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
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

  const handleDrop = async (
    e: React.DragEvent,
    status: "A Fazer" | "Em Andamento" | "Aguardando Aprovação" | "Concluído",
    category?: "Geral" | "Manutenção" | "Faturamento" | "Reunião" | "Outros"
  ) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    const updates: Partial<AgendaEvent> = { status };
    if (category) {
      updates.categoria = category;
    }

    if (isLocalMode) {
      const updated = events.map(ev => (ev.id === id ? { ...ev, ...updates } as AgendaEvent : ev));
      saveLocalEvents(updated);
      toast({ title: "Mover Card", description: `Card movido para '${status}'` });
    } else {
      try {
        if (id && id.startsWith("virtual-")) {
          const virtualEvent = events.find(ev => ev.id === id);
          if (virtualEvent) {
            const newId = crypto.randomUUID();
            const insertPayload = {
              titulo: virtualEvent.titulo,
              descricao: virtualEvent.descricao,
              data_inicio: virtualEvent.data_inicio,
              data_fim: virtualEvent.data_fim || null,
              status: status,
              prioridade: virtualEvent.prioridade || "Média",
              categoria: category || virtualEvent.categoria,
              equipamento_id: virtualEvent.equipamento_id || null,
              contrato_id: virtualEvent.contrato_id || null,
              empresa_id: virtualEvent.empresa_id || null,
              orcamento: Number(virtualEvent.orcamento || 0),
              notas: virtualEvent.notas,
              responsavel_nome: virtualEvent.responsavel_nome || "",
              criador_nome: currentUserNome,
              etapas: [],
              historico: [
                {
                  data: new Date().toISOString(),
                  usuario: currentUserNome,
                  acao: "Criou a tarefa virtual no banco via arrastar",
                  detalhes: `Moveu o card virtual para '${status}' e salvou como registro real.`
                }
              ]
            };
            const { error } = await supabase.from("agenda").insert({ ...insertPayload, id: newId });
            if (error) throw error;
            toast({ title: "Mover Card", description: `Card virtual salvo e movido para '${status}'` });
            fetchData();
            return;
          }
        }
        const { error } = await supabase.from("agenda").update(updates as any).eq("id", id);
        if (error) throw error;
        setEvents(prev => prev.map(ev => (ev.id === id ? { ...ev, ...updates } : ev)));
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

  // Filters events by search query AND visibility rules
  const filteredEvents = events.filter(e => {
    const q = searchQuery.toLowerCase();
    if (q && !(
      e.titulo?.toLowerCase().includes(q) ||
      e.descricao?.toLowerCase().includes(q) ||
      e.categoria?.toLowerCase().includes(q)
    )) return false;

    const isSameName = (a?: string, b?: string) => {
      if (!a || !b) return false;
      return a.trim().toLowerCase() === b.trim().toLowerCase();
    };

    // Visibility filter
    if (isAdmin) {
      if (!viewAll) {
        const isAssignedToMe = isSameName(e.responsavel_nome, currentUserNome) || isSameName(e.criador_nome, currentUserNome);
        const isUnassigned = !e.responsavel_nome || e.responsavel_nome.trim() === "";
        const isStageResponsible = e.etapas?.some(st => isSameName(st.responsavel_nome, currentUserNome));
        if (!isAssignedToMe && !isUnassigned && !isStageResponsible) return false;
      }
    } else {
      // Non-admin: only see if explicitly assigned to them, or if they are responsible for a stage,
      // or if they created it and it remains unassigned.
      const isAssignedToMe = isSameName(e.responsavel_nome, currentUserNome);
      const isStageResponsible = e.etapas?.some(st => isSameName(st.responsavel_nome, currentUserNome));
      const isCreatorAndUnassigned = (!e.responsavel_nome || e.responsavel_nome.trim() === "") && isSameName(e.criador_nome, currentUserNome);
      if (!isAssignedToMe && !isStageResponsible && !isCreatorAndUnassigned) return false;
    }

    return true;
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

  // Calculate metrics for HUD control panel
  const activeTasks = processedEvents.filter(e => e.status !== "Concluído");
  const activeCount = activeTasks.length;
  const awaitingApprovalCount = processedEvents.filter(e => e.status === "Aguardando Aprovação").length;
  const totalActiveBudget = activeTasks.reduce((acc, e) => acc + Number(e.orcamento || 0), 0);
  const totalTasksCount = processedEvents.length;
  const completedTasksCount = processedEvents.filter(e => e.status === "Concluído").length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Filters for Pipeline Workflow
  const medicaoTasks = processedEvents.filter(e => 
    e.status !== "Concluído" && 
    e.status !== "Aguardando Aprovação" && 
    e.categoria !== "Faturamento"
  );
  const aprovacaoTasks = processedEvents.filter(e => 
    e.status === "Aguardando Aprovação"
  );
  const faturamentoTasks = processedEvents.filter(e => 
    e.status !== "Concluído" && 
    e.categoria === "Faturamento"
  );
  const concluidoTasks = processedEvents.filter(e => 
    e.status === "Concluído"
  );

  const pipelineColumns = [
    {
      id: "medicao",
      title: "1. Levantamento & Medição",
      icon: <Clock className="h-4 w-4" />,
      tasks: medicaoTasks,
      accentColor: "#3b82f6", // Blue
      glowColor: "rgba(59, 130, 246, 0.15)",
      statusTarget: "Em Andamento" as const,
      description: "Tarefas operacionais e medições iniciais"
    },
    {
      id: "aprovacao",
      title: "2. Validação & Aprovação",
      icon: <AlertCircle className="h-4 w-4 animate-pulse" />,
      tasks: aprovacaoTasks,
      accentColor: "#f59e0b", // Amber
      glowColor: "rgba(245, 158, 11, 0.15)",
      statusTarget: "Aguardando Aprovação" as const,
      description: "Aguardando aprovação de medições"
    },
    {
      id: "faturamento",
      title: "3. Faturamento & Notas",
      icon: <DollarSign className="h-4 w-4" />,
      tasks: faturamentoTasks,
      accentColor: "#6366f1", // Indigo
      glowColor: "rgba(99, 102, 241, 0.15)",
      statusTarget: "A Fazer" as const,
      description: "Medições aprovadas prontas para faturar"
    },
    {
      id: "concluido",
      title: "4. Concluído & Liquidado",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      tasks: concluidoTasks,
      accentColor: "#10b981", // Emerald
      glowColor: "rgba(16, 185, 129, 0.15)",
      statusTarget: "Concluído" as const,
      description: "Faturamento emitido e tarefas liquidadas"
    }
  ];

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

        {/* HUD de Métricas Analíticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          {/* Card 1: Tarefas Ativas */}
          <div className="glass-panel p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(230,108,55,0.15)] border border-border/40">
            <div className="space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Tarefas Ativas</span>
              <h3 className="text-3xl font-extrabold text-foreground tracking-tight">{activeCount}</h3>
              <p className="text-[10px] text-muted-foreground">Em execução ou aguardando ação</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
              <CheckSquare className="h-6 w-6" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors" />
          </div>

          {/* Card 2: Aguardando Aprovação */}
          <div className="glass-panel p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(161,52,60,0.15)] border border-border/40">
            <div className="space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Aguardando Aprovação</span>
              <h3 className="text-3xl font-extrabold text-[#A1343C] tracking-tight">{awaitingApprovalCount}</h3>
              <p className="text-[10px] text-muted-foreground">Aguardando liberação gerencial</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-[#A1343C]/10 flex items-center justify-center text-[#A1343C] group-hover:scale-110 transition-transform">
              <AlertCircle className="h-6 w-6 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-24 h-24 bg-[#A1343C]/5 rounded-full blur-2xl group-hover:bg-[#A1343C]/10 transition-colors" />
          </div>

          {/* Card 3: Orçamento Acumulado */}
          <div className="glass-panel p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(63,115,67,0.15)] border border-border/40">
            <div className="space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Orçamento Ativo</span>
              <h3 className="text-2xl font-extrabold text-foreground tracking-tight truncate max-w-[170px]">
                {totalActiveBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
              </h3>
              <p className="text-[10px] text-muted-foreground">Valor total em execução nas medições</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center text-success group-hover:scale-110 transition-transform">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-24 h-24 bg-success/5 rounded-full blur-2xl group-hover:bg-success/10 transition-colors" />
          </div>

          {/* Card 4: Taxa de Conclusão */}
          <div className="glass-panel p-5 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(37,99,235,0.15)] border border-border/40">
            <div className="space-y-2 w-full pr-12">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Taxa de Conclusão</span>
              <h3 className="text-3xl font-extrabold text-foreground tracking-tight">{completionRate}%</h3>
              <div className="w-full bg-muted/30 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className="bg-primary h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform absolute right-5 top-5">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "pipeline" ? "default" : "outline"}
              onClick={() => setActiveTab("pipeline")}
              size="sm"
              className={activeTab === "pipeline" ? "bg-accent text-accent-foreground" : "bg-background"}
            >
              <Workflow className="h-4 w-4 mr-2" /> Workflow Pipeline
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
            {isAdmin && activeTab !== "notes" && (
              <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/30">
                <Button 
                  size="sm" 
                  variant={!viewAll ? "default" : "ghost"} 
                  className={`h-7 text-xs px-4 rounded-md transition-colors ${!viewAll ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setViewAll(false)}
                >
                  Minhas
                </Button>
                <Button 
                  size="sm" 
                  variant={viewAll ? "default" : "ghost"} 
                  className={`h-7 text-xs px-4 rounded-md transition-colors ${viewAll ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setViewAll(true)}
                >
                  Todas
                </Button>
              </div>
            )}
            
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

        {activeTab === "pipeline" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
            {pipelineColumns.map(col => {
              return (
                <div
                  key={col.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.statusTarget, col.id === "faturamento" ? "Faturamento" : undefined)}
                  className="rounded-2xl border border-border/40 bg-background/30 backdrop-blur-md shadow-inner flex flex-col min-h-[550px] overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="p-4 border-b border-border/30 bg-card/40 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground flex items-center gap-2" style={{ color: col.accentColor }}>
                        {col.icon}
                        {col.title}
                      </span>
                      <Badge className="text-[10px] font-bold text-white border-0" style={{ backgroundColor: col.accentColor }}>
                        {col.tasks.length}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-normal">{col.description}</span>
                  </div>

                  {/* Tasks List */}
                  <div className="p-3 flex-1 overflow-y-auto max-h-[720px] scrollbar-thin space-y-3">
                    {col.tasks.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed border-border/45 rounded-2xl bg-muted/5">
                        <Workflow className="h-8 w-8 text-muted-foreground/25 mb-2" />
                        <span className="text-xs font-semibold">Sem demandas nesta fase</span>
                      </div>
                    ) : (
                      col.tasks.map(item => {
                        const clientNome = item.empresas?.nome || "";
                        const isExpanded = expandedCardId === item.id;
                        const overdueDays = getDaysOverdue(item.data_inicio, item.status);
                        const isOverdue = overdueDays > 0;
                        const hasStages = item.etapas && item.etapas.length > 0;

                        // Priority glow styling
                        const priorityColor =
                          item.prioridade === "Alta" ? "rgba(239, 68, 68, 0.4)" :
                          item.prioridade === "Média" ? "rgba(245, 158, 11, 0.4)" :
                          "rgba(16, 185, 129, 0.4)";
                        
                        const priorityBorderClass =
                          item.prioridade === "Alta" ? "border-l-[4px] border-l-destructive" :
                          item.prioridade === "Média" ? "border-l-[4px] border-l-warning" :
                          "border-l-[4px] border-l-success";

                        return (
                          <div
                            key={item.id}
                            draggable={!isExpanded && item.status !== "Concluído"}
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            className={`glass rounded-xl overflow-hidden transition-all duration-300 group ${priorityBorderClass} ${
                              isExpanded 
                                ? "shadow-[0_0_15px_" + priorityColor + "] border border-border/80 scale-[1.01]" 
                                : "shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] cursor-grab active:cursor-grabbing hover:-translate-y-0.5 border border-border/20"
                            }`}
                          >
                            {/* Card Header (clickable to expand) */}
                            <div 
                              className="p-3.5 cursor-pointer select-none space-y-2"
                              onClick={() => setExpandedCardId(isExpanded ? null : item.id)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider py-0 px-2 bg-background/50 border-border/40">
                                  {item.categoria}
                                </Badge>
                                
                                {isOverdue && (
                                  <Badge variant="destructive" className="h-4 text-[9px] font-bold px-1.5 animate-pulse">
                                    Atrasado {overdueDays}d
                                  </Badge>
                                )}
                              </div>

                              <div className="space-y-1">
                                {clientNome ? (
                                  <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide truncate">
                                    {clientNome}
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide italic">
                                    Sem Cliente
                                  </div>
                                )}
                                <h4 className="font-bold text-xs text-foreground tracking-tight leading-snug group-hover:text-primary transition-colors">
                                  {item.titulo}
                                </h4>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/10">
                                <span className="truncate max-w-[110px] font-semibold">{item.responsavel_nome || "Sem responsável"}</span>
                                <div className="flex items-center gap-1.5">
                                  {item.orcamento ? (
                                    <span className="font-mono font-bold text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[9px]">
                                      {Number(item.orcamento).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </span>
                                  ) : null}
                                  <span>{item.data_inicio ? new Date(item.data_inicio).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : "—"}</span>
                                </div>
                              </div>

                              {/* Small Checklist progress bar */}
                              {hasStages && (
                                <div className="space-y-1 pt-1.5">
                                  <div className="flex items-center justify-between text-[9px] font-semibold text-muted-foreground">
                                    <span>Progresso</span>
                                    <span>{item.etapas!.filter(et => et.status === "Concluído").length}/{item.etapas!.length}</span>
                                  </div>
                                  <div className="w-full bg-muted/40 h-1 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-primary h-1 rounded-full transition-all duration-300"
                                      style={{ width: `${(item.etapas!.filter(et => et.status === "Concluído").length / item.etapas!.length) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Expanded Area */}
                            {isExpanded && (
                              <div className="px-3.5 pb-4 space-y-4 border-t border-border/10 pt-3 bg-muted/5 animate-in slide-in-from-top-1 duration-200">
                                {/* Description */}
                                {item.descricao && (
                                  <p className="text-[11px] text-muted-foreground leading-normal whitespace-pre-wrap">{item.descricao}</p>
                                )}

                                {/* Workflow Stepper */}
                                {renderWorkflowStepper(item)}

                                {/* Inline Actions based on Column */}
                                {col.id === "medicao" && item.status === "Em Andamento" && (
                                  <div className="border border-border/30 rounded-xl p-3 bg-background/40 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Ação: Solicitar Aprovação</p>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="space-y-1">
                                        <Label className="text-[9px] font-semibold text-muted-foreground">Escolher Aprovador</Label>
                                        <Select
                                          value={selectedApprovers[item.id] || "none"}
                                          onValueChange={(v) => setSelectedApprovers(prev => ({ ...prev, [item.id]: v }))}
                                        >
                                          <SelectTrigger className="h-7 text-[11px] bg-background/50 border-border/30 rounded-lg">
                                            <SelectValue placeholder="Selecione..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">Administradores (Padrão)</SelectItem>
                                            {usuarios.map(u => (
                                              <SelectItem key={u.user_id} value={u.nome}>{u.nome}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 w-full rounded-lg"
                                        onClick={() => handleSendToApproval(item)}
                                      >
                                        <Send className="h-3 w-3" /> Solicitar Aprovação
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {col.id === "aprovacao" && (
                                  <div className="border border-border/30 rounded-xl p-3 bg-background/40 space-y-2">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Ação: Avaliação Gerencial</p>
                                    
                                    {isAdmin && (
                                      <div className="space-y-1">
                                        <Label className="text-[9px] font-semibold text-muted-foreground">Responsável p/ Faturar</Label>
                                        <Select
                                          value={invoiceResponsibles[item.id] || "none"}
                                          onValueChange={(v) => setInvoiceResponsibles(prev => ({ ...prev, [item.id]: v }))}
                                        >
                                          <SelectTrigger className="h-7 text-[11px] bg-background/50 border-border/30 rounded-lg">
                                            <SelectValue placeholder="Escolha quem emitirá a fatura..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">Selecione o usuário...</SelectItem>
                                            {usuarios.map(u => (
                                              <SelectItem key={u.user_id} value={u.nome}>{u.nome}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}

                                    <div className="flex flex-col gap-1.5 pt-1">
                                      {(() => {
                                        const match = item.notes?.match(/\[Medição ID:\s*([a-f0-9\-]{36})\]/i) || item.notas?.match(/\[Medição ID:\s*([a-f0-9\-]{36})\]/i);
                                        const faturaId = match ? match[1] : null;
                                        return faturaId ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-[11px] font-semibold gap-1 border-accent/20 text-accent hover:bg-accent/5 rounded-lg w-full"
                                            onClick={() => handleOpenPreview(faturaId)}
                                          >
                                            <Eye className="h-3 w-3" /> Verificar Medição
                                          </Button>
                                        ) : null;
                                      })()}
                                      {isAdmin && (
                                        <Button
                                          size="sm"
                                          className="h-7 text-[11px] bg-success hover:bg-success/90 text-white font-semibold gap-1 rounded-lg w-full"
                                          onClick={() => handleQuickApproveMedicao(item)}
                                        >
                                          <Check className="h-3 w-3" /> Aprovar Medição
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {col.id === "faturamento" && (
                                  <div className="border border-border/30 rounded-xl p-3 bg-background/40 space-y-2.5">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Ação: Detalhes de Faturamento</p>
                                    {(() => {
                                      const match = item.notes?.match(/\[Medição ID:\s*([a-f0-9\-]{36})\]/i) || item.notas?.match(/\[Medição ID:\s*([a-f0-9\-]{36})\]/i);
                                      const faturaId = match ? match[1] : null;
                                      
                                      const formVal = billingForm[item.id] || {
                                        numeroNota: "",
                                        emissaoDate: new Date().toISOString().slice(0, 10),
                                        contaBancariaId: "none",
                                        observacoes: ""
                                      };
                                      
                                      return (
                                        <div className="space-y-2.5">
                                          <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-0.5">
                                              <Label className="text-[9px] text-muted-foreground font-semibold">Nº da Nota Fiscal</Label>
                                              <Input
                                                size="sm"
                                                className="h-7 text-xs bg-background/50 border-border/30 rounded-lg"
                                                placeholder="Ex: FAT343"
                                                value={formVal.numeroNota}
                                                onChange={(e) => handleFormChange(item.id, "numeroNota", e.target.value)}
                                              />
                                            </div>
                                            <div className="space-y-0.5">
                                              <Label className="text-[9px] text-muted-foreground font-semibold">Data de Emissão</Label>
                                              <Input
                                                type="date"
                                                className="h-7 text-xs bg-background/50 border-border/30 rounded-lg"
                                                value={formVal.emissaoDate}
                                                onChange={(e) => handleFormChange(item.id, "emissaoDate", e.target.value)}
                                              />
                                            </div>
                                          </div>
                                          
                                          <div className="space-y-0.5">
                                            <Label className="text-[9px] text-muted-foreground font-semibold">Conta Bancária</Label>
                                            <Select
                                              value={formVal.contaBancariaId}
                                              onValueChange={(v) => handleFormChange(item.id, "contaBancariaId", v)}
                                            >
                                              <SelectTrigger className="h-7 text-xs bg-background/50 border-border/30 rounded-lg">
                                                <SelectValue placeholder="Selecione..." />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">Nenhuma</SelectItem>
                                                {contasBancarias.map(c => (
                                                  <SelectItem key={c.id} value={c.id} className="text-xs">
                                                    {c.banco} - Ag {c.agencia} / CC {c.conta}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          
                                          <div className="space-y-0.5">
                                            <Label className="text-[9px] text-muted-foreground font-semibold">Observações</Label>
                                            <Textarea
                                              rows={1}
                                              className="text-xs bg-background/50 border-border/30 rounded-lg min-h-8"
                                              placeholder="Observações complementares..."
                                              value={formVal.observacoes}
                                              onChange={(e) => handleFormChange(item.id, "observacoes", e.target.value)}
                                            />
                                          </div>
                                          
                                          <div className="flex gap-2">
                                            {faturaId && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs gap-1 border-accent/20 text-accent hover:bg-accent/5 rounded-lg flex-1"
                                                onClick={() => handleDownloadMedicaoPDF(faturaId)}
                                              >
                                                <FileDown className="h-3 w-3" /> PDF
                                              </Button>
                                            )}
                                            <Button
                                              size="sm"
                                              className="h-7 bg-success hover:bg-success/90 text-white font-semibold gap-1 rounded-lg flex-[2]"
                                              onClick={() => faturaId && handleEmitirFaturaKanban(item, faturaId)}
                                            >
                                              <Check className="h-3 w-3" /> Faturar
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* Attributes Grid */}
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] border border-border/20 rounded-xl p-2 bg-background/25">
                                  <div>
                                    <span className="text-muted-foreground block text-[8px] uppercase font-bold">Início</span>
                                    <span className="font-medium">
                                      {item.data_inicio ? new Date(item.data_inicio).toLocaleDateString("pt-BR") : "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-[8px] uppercase font-bold">Prioridade</span>
                                    <span className="font-semibold" style={{
                                      color: item.prioridade === "Alta" ? "#ef4444" : item.prioridade === "Média" ? "#f59e0b" : "#10b981"
                                    }}>{item.prioridade}</span>
                                  </div>
                                  {item.orcamento ? (
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground block text-[8px] uppercase font-bold">Orçamento</span>
                                      <span className="font-mono font-bold text-foreground/80">
                                        {Number(item.orcamento).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>

                                {/* Checklist Stages (Expanded) */}
                                {hasStages && (
                                  <div className="space-y-1.5">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Sub-Etapas</p>
                                    <div className="space-y-1">
                                      {item.etapas!.map(et => (
                                        <div key={et.id} className="flex items-center justify-between p-1.5 rounded-lg bg-background/40 border border-border/20 text-[10px]">
                                          <span className="truncate max-w-[130px]">{et.titulo}</span>
                                          <Badge className={`h-4 text-[8px] px-1 py-0 border-0 ${
                                            et.status === "Concluído" ? "bg-success text-white" :
                                            et.status === "Em Andamento" ? "bg-warning text-white" :
                                            "bg-muted text-muted-foreground"
                                          }`}>{et.status}</Badge>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-2 border-t border-border/10 gap-1.5 flex-wrap">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewEvent(item);
                                        setViewDialogOpen(true);
                                      }}
                                      className="h-6 text-[10px] gap-1 px-2.5 rounded-lg bg-muted/60 hover:bg-muted"
                                    >
                                      <Eye className="h-3 w-3" /> Detalhes
                                    </Button>
                                    
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(generateWhatsAppLink(item), "_blank");
                                      }}
                                      className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg"
                                      title="WhatsApp"
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                    </Button>
                                  </div>

                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEdit(item);
                                      }}
                                      className="h-6 w-6 hover:bg-muted/80 text-muted-foreground rounded-lg"
                                      title="Editar"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteEvent(item.id);
                                        setExpandedCardId(null);
                                      }}
                                      className="h-6 w-6 hover:bg-destructive/10 text-destructive rounded-lg"
                                      title="Excluir"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STATUSES.map(colStatus => {
              const statusEvents = processedEvents.filter(e => e.status === colStatus);

              const colAccentColor =
                colStatus === "Concluído" ? "#3F7343" :
                colStatus === "Em Andamento" ? "#E66C37" : "#A1343C";

              return (
                <div
                  key={colStatus}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, colStatus)}
                  className="rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-sm flex flex-col min-h-[500px] overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="p-4 border-b border-border/40 bg-accent/5 flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground flex items-center gap-2">
                      {colStatus === "A Fazer" && <Clock className="h-4 w-4" style={{ color: colAccentColor }} />}
                      {colStatus === "Em Andamento" && <AlertTriangle className="h-4 w-4" style={{ color: colAccentColor }} />}
                      {colStatus === "Concluído" && <CheckCircle2 className="h-4 w-4" style={{ color: colAccentColor }} />}
                      {colStatus}
                    </span>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const totalBudgetCol = statusEvents.reduce((acc, e) => acc + Number(e.orcamento || 0), 0);
                        return totalBudgetCol > 0 ? (
                          <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                            {totalBudgetCol.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        ) : null;
                      })()}
                      <Badge
                        className="text-[10px] font-bold text-white border-0"
                        style={{ backgroundColor: colAccentColor }}
                      >
                        {statusEvents.length}
                      </Badge>
                    </div>
                  </div>

                  {/* Stacked File Cards */}
                  <div className="p-3 flex-1 overflow-y-auto max-h-[680px] scrollbar-thin space-y-0">
                    {statusEvents.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-muted/5 mt-3">
                        <Trello className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <span className="text-xs">Nenhuma tarefa nesta coluna</span>
                      </div>
                    )}

                    {statusEvents.map((item, idx) => {
                      const isExpanded = expandedCardId === item.id;
                      const overdueDays = getDaysOverdue(item.data_inicio, item.status);
                      const isOverdue = overdueDays > 0;
                      const hasStages = item.etapas && item.etapas.length > 0;

                      return (
                        <div
                          key={item.id}
                          className="relative"
                          style={{ marginBottom: isExpanded ? "12px" : "-1px", zIndex: isExpanded ? 20 : statusEvents.length - idx }}
                        >
                          {/* Stack shadow layers (decorative) */}
                          {!isExpanded && idx < statusEvents.length - 1 && (
                            <>
                              <div
                                className="absolute bottom-[-5px] left-2 right-2 h-full rounded-xl border border-border bg-card opacity-60"
                                style={{ zIndex: -1 }}
                              />
                              {idx < statusEvents.length - 2 && (
                                <div
                                  className="absolute bottom-[-9px] left-4 right-4 h-full rounded-xl border border-border bg-card opacity-30"
                                  style={{ zIndex: -2 }}
                                />
                              )}
                            </>
                          )}

                          {/* Main Card */}
                          <div
                            draggable={!isExpanded && item.status !== "Concluído"}
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            className={`bg-card border rounded-xl overflow-hidden transition-all duration-300 group hover:-translate-y-0.5 ${
                              isExpanded
                                ? "shadow-xl border-2 z-30"
                                : "shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing border-border/60"
                            }`}
                            style={isExpanded ? { borderColor: colAccentColor } : {}}
                          >
                            {/* Card Header — always visible, click to expand */}
                            <div
                              className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                              onClick={() => setExpandedCardId(isExpanded ? null : item.id)}
                            >
                              {/* Left: colored strip + title */}
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-1 h-8 rounded-full shrink-0"
                                  style={{ backgroundColor: colAccentColor }}
                                />
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-foreground truncate leading-tight">
                                    {item.titulo}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                    {item.responsavel_nome || "Sem responsável"}
                                    {item.data_inicio && (
                                      <span className={`ml-2 ${isOverdue ? "text-destructive font-semibold" : ""}`}>
                                        · {new Date(item.data_inicio).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Right: badges + chevron */}
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {hasStages && (
                                  <span
                                    className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: colAccentColor }}
                                    title="Possui etapas"
                                  >
                                    {item.etapas!.filter(et => et.status === "Concluído").length}/{item.etapas!.length}
                                  </span>
                                )}
                                <div
                                  className="text-[9px] font-bold text-white px-2 py-0.5 rounded-sm"
                                  style={{ backgroundColor:
                                    item.prioridade === "Alta" ? "#A1343C" :
                                    item.prioridade === "Média" ? "#E66C37" : "#3F7343"
                                  }}
                                >
                                  {item.prioridade}
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Expanded Body */}
                            {isExpanded && (
                              <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                {/* Description */}
                                {item.descricao && (
                                  <p className="text-xs text-muted-foreground leading-relaxed">{item.descricao}</p>
                                )}

                                {/* Stepper */}
                                {renderWorkflowStepper(item)}

                                {/* Dynamic Workflow Actions */}
                                {item.categoria === "Medição" && item.status === "Em Andamento" && (
                                  <div className="border border-border/40 rounded-lg p-3 bg-muted/10 space-y-2 mt-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Enviar para Aprovação</p>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                      <div className="flex-1 space-y-1">
                                        <Label className="text-[10px]">Responsável pela Aprovação</Label>
                                        <Select
                                          value={selectedApprovers[item.id] || "none"}
                                          onValueChange={(v) => setSelectedApprovers(prev => ({ ...prev, [item.id]: v }))}
                                        >
                                          <SelectTrigger className="h-8 text-xs bg-background/50">
                                            <SelectValue placeholder="Selecione um administrador" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">Administradores (Padrão)</SelectItem>
                                            {usuarios.map(u => (
                                              <SelectItem key={u.user_id} value={u.nome}>{u.nome}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <Button
                                        size="sm"
                                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5"
                                        onClick={() => handleSendToApproval(item)}
                                      >
                                        <Send className="h-3.5 w-3.5" /> Enviar p/ Aprovação
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {item.categoria === "Medição" && item.status === "Aguardando Aprovação" && (
                                  <div className="border border-border/40 rounded-lg p-3 bg-muted/10 space-y-2 mt-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Aprovação de Medição</p>
                                    
                                    {isAdmin && (
                                      <div className="space-y-1 mb-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground">Responsável pela Fatura</Label>
                                        <Select
                                          value={invoiceResponsibles[item.id] || "none"}
                                          onValueChange={(v) => setInvoiceResponsibles(prev => ({ ...prev, [item.id]: v }))}
                                        >
                                          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/30 rounded-lg">
                                            <SelectValue placeholder="Selecione quem emitirá a fatura..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">Selecione o usuário...</SelectItem>
                                            {usuarios.map(u => (
                                              <SelectItem key={u.user_id} value={u.nome}>{u.nome}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                      {(() => {
                                        const match = item.notas?.match(/\[Medição ID:\s*([a-f0-9\-]{36})\]/i);
                                        const faturaId = match ? match[1] : null;
                                        return faturaId ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs font-semibold gap-1.5 border-accent/30 text-accent hover:bg-accent/5"
                                            onClick={() => handleOpenPreview(faturaId)}
                                          >
                                            <Eye className="h-3.5 w-3.5" /> Verificar Medição
                                          </Button>
                                        ) : null;
                                      })()}
                                      {isAdmin && (
                                        <Button
                                          size="sm"
                                          className="h-8 bg-green-600 hover:bg-green-700 text-white font-semibold gap-1.5"
                                          onClick={() => handleQuickApproveMedicao(item)}
                                        >
                                          <Check className="h-3.5 w-3.5" /> Aprovar Medição
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {item.categoria === "Faturamento" && item.status !== "Concluído" && (
                                  <div className="border border-border/40 rounded-lg p-3 bg-muted/10 space-y-3 mt-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lançar Informações do Faturamento</p>
                                    {(() => {
                                      const match = item.notas?.match(/\[Medição ID:\s*([a-f0-9\-]{36})\]/i);
                                      const faturaId = match ? match[1] : null;
                                      
                                      const formVal = billingForm[item.id] || {
                                        numeroNota: "",
                                        emissaoDate: new Date().toISOString().slice(0, 10),
                                        contaBancariaId: "none",
                                        observacoes: ""
                                      };
                                      
                                      return (
                                        <div className="space-y-3">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                              <Label className="text-[10px]">Nº da Nota Fiscal / Fatura</Label>
                                              <Input
                                                size="sm"
                                                className="h-8 text-xs bg-background/50"
                                                placeholder="Ex: FAT343"
                                                value={formVal.numeroNota}
                                                onChange={(e) => handleFormChange(item.id, "numeroNota", e.target.value)}
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[10px]">Data de Emissão</Label>
                                              <Input
                                                type="date"
                                                className="h-8 text-xs bg-background/50"
                                                value={formVal.emissaoDate}
                                                onChange={(e) => handleFormChange(item.id, "emissaoDate", e.target.value)}
                                              />
                                            </div>
                                          </div>
                                          
                                          <div className="space-y-1">
                                            <Label className="text-[10px]">Conta Bancária</Label>
                                            <Select
                                              value={formVal.contaBancariaId}
                                              onValueChange={(v) => handleFormChange(item.id, "contaBancariaId", v)}
                                            >
                                              <SelectTrigger className="h-8 text-xs bg-background/50">
                                                <SelectValue placeholder="Selecione a conta para depósito" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">Nenhuma</SelectItem>
                                                {contasBancarias.map(c => (
                                                  <SelectItem key={c.id} value={c.id}>
                                                    {c.banco} - Ag {c.agencia} / CC {c.conta}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          
                                          <div className="space-y-1">
                                            <Label className="text-[10px]">Observações</Label>
                                            <Textarea
                                              rows={2}
                                              className="text-xs bg-background/50"
                                              placeholder="Observações complementares..."
                                              value={formVal.observacoes}
                                              onChange={(e) => handleFormChange(item.id, "observacoes", e.target.value)}
                                            />
                                          </div>
                                          
                                          <div className="flex gap-2">
                                            {faturaId && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-xs gap-1 border-accent/30 text-accent hover:bg-accent/5"
                                                onClick={() => handleDownloadMedicaoPDF(faturaId)}
                                              >
                                                <FileDown className="h-3.5 w-3.5" /> Baixar Medição
                                              </Button>
                                            )}
                                            <Button
                                              size="sm"
                                              className="h-8 bg-success hover:bg-success/90 text-white font-semibold gap-1.5 flex-1"
                                              onClick={() => faturaId && handleEmitirFaturaKanban(item, faturaId)}
                                            >
                                              <Check className="h-3.5 w-3.5" /> Faturar e Concluir
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* Attributes Grid */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border border-border/40 rounded-lg p-3 bg-muted/10">
                                  <div>
                                    <span className="text-muted-foreground block text-[10px] mb-0.5">Responsável</span>
                                    <div className="flex items-center gap-1.5">
                                      <div className="h-5 w-5 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[9px] font-bold shrink-0">
                                        {item.responsavel_nome ? item.responsavel_nome.slice(0, 2).toUpperCase() : "—"}
                                      </div>
                                      <span className="font-semibold truncate max-w-[90px]">{item.responsavel_nome || "—"}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-[10px] mb-0.5">Status</span>
                                    <div
                                      className="text-[10px] text-white font-bold px-2 py-0.5 rounded-sm inline-block"
                                      style={{ backgroundColor: colAccentColor }}
                                    >
                                      {item.status}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-[10px] mb-0.5">Prioridade</span>
                                    <div
                                      className="text-[10px] text-white font-bold px-2 py-0.5 rounded-sm inline-block"
                                      style={{ backgroundColor:
                                        item.prioridade === "Alta" ? "#A1343C" :
                                        item.prioridade === "Média" ? "#E66C37" : "#3F7343"
                                      }}
                                    >
                                      {item.prioridade}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-[10px] mb-0.5">Prazo</span>
                                    <div className={`flex items-center gap-1 font-semibold ${ isOverdue ? "text-destructive" : "text-foreground" }`}>
                                      {item.status === "Concluído" ? (
                                        <CheckCircle2 className="h-3 w-3 text-[#3F7343]" />
                                      ) : isOverdue ? (
                                        <AlertTriangle className="h-3 w-3 text-destructive" />
                                      ) : (
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                      )}
                                      {item.data_inicio
                                        ? new Date(item.data_inicio).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })
                                        : "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-[10px] mb-0.5">Categoria</span>
                                    <span className="font-semibold">{item.categoria}</span>
                                  </div>
                                  {item.orcamento ? (
                                    <div>
                                      <span className="text-muted-foreground block text-[10px] mb-0.5">Orçamento</span>
                                      <span className="font-semibold font-mono">
                                        {Number(item.orcamento).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>

                                {/* Notas */}
                                {item.notas ? (
                                  <div className="text-xs bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200/50 dark:border-yellow-800/30 rounded-lg p-2.5 relative group/notes transition-all">
                                    <div className="flex items-center justify-between text-yellow-700/80 dark:text-yellow-400/80 font-semibold mb-1">
                                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                                        <StickyNote className="h-3 w-3" /> Observações
                                      </div>
                                    </div>
                                    <p className="text-foreground/70 leading-relaxed whitespace-pre-wrap line-clamp-3 text-[11px]">{item.notas}</p>
                                  </div>
                                ) : null}

                                {/* Etapas summary */}
                                {hasStages && (
                                  <div className="text-xs">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Etapas ({item.etapas!.filter(et => et.status === "Concluído").length}/{item.etapas!.length} concluídas)</p>
                                    <div className="space-y-1">
                                      {item.etapas!.map(et => (
                                        <div key={et.id} className="flex items-center justify-between p-1.5 rounded bg-muted/30 border border-border/30">
                                          <span className="truncate text-[11px] font-medium">{et.titulo}</span>
                                          <span
                                            className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-sm shrink-0 ml-2"
                                            style={{
                                              backgroundColor:
                                                et.status === "Concluído" ? "#3F7343" :
                                                et.status === "Em Andamento" ? "#E66C37" : "#A1343C"
                                            }}
                                          >
                                            {et.status}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-1 border-t border-border/40 flex-wrap gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewEvent(item);
                                        setViewDialogOpen(true);
                                      }}
                                      className="h-7 text-[11px] gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-3"
                                    >
                                      <Eye className="h-3.5 w-3.5" /> Abrir Tarefa
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(generateWhatsAppLink(item), "_blank");
                                      }}
                                      className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                      title="Compartilhar via WhatsApp"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(generateGoogleCalendarLink(item), "_blank");
                                      }}
                                      className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                      title="Salvar no Google Agenda"
                                    >
                                      <CalendarPlus className="h-3.5 w-3.5" />
                                    </Button>
                                    
                                    {isAdmin && item.status === "Aguardando Aprovação" && (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateEventField(item.id, "status", "Concluído");
                                        }}
                                        className="h-7 text-[11px] gap-1.5 bg-green-600 hover:bg-green-700 text-white ml-2"
                                        title="Aprovar Tarefa"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                                      </Button>
                                    )}
                                  </div>
                                  {item.status !== "Concluído" && (
                                    <div className="flex gap-1.5">

                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteEvent(item.id);
                                          setExpandedCardId(null);
                                        }}
                                        className="h-7 w-7 hover:bg-destructive/10 text-destructive"
                                        title="Excluir"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Quick Add Card */}
                  {colStatus !== "Concluído" && (
                    <div className="px-3 pb-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border/60 bg-muted/5 hover:bg-muted/20 hover:border-border transition-colors group">
                        <Plus className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                        <input
                          type="text"
                          placeholder="Adicionar nova tarefa..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.currentTarget.value.trim()) {
                              handleQuickAddEvent(e.currentTarget.value.trim(), colStatus);
                              e.currentTarget.value = "";
                            }
                          }}
                          className="bg-transparent border-0 outline-none w-full text-xs text-foreground placeholder:text-muted-foreground/40 font-medium"
                        />
                      </div>
                    </div>
                  )}
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

              <div className="space-y-1.5 mt-2">
                <Label htmlFor="recorrencia">Recorrência (Gerar cópia ao concluir)</Label>
                <Select
                  value={form.recorrencia}
                  onValueChange={(v: any) => setForm(prev => ({ ...prev, recorrencia: v }))}
                >
                  <SelectTrigger id="recorrencia"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nenhuma">Nenhuma</SelectItem>
                    <SelectItem value="Diária">Diária</SelectItem>
                    <SelectItem value="Semanal">Semanal</SelectItem>
                    <SelectItem value="Mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Etapas da Demanda</span>
                {viewEvent?.etapas && viewEvent.etapas.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {Math.round((viewEvent.etapas.filter(e => e.status === "Concluído").length / viewEvent.etapas.length) * 100)}%
                    </span>
                    <Progress 
                      value={(viewEvent.etapas.filter(e => e.status === "Concluído").length / viewEvent.etapas.length) * 100} 
                      className="w-24 h-2" 
                    />
                  </div>
                )}
              </div>
              
              {/* Stages List */}
              <div className="space-y-2">
                {viewEvent?.etapas && viewEvent.etapas.length > 0 ? (
                  viewEvent.etapas.map(etapa => {
                    const isAssignee = etapa.responsavel_nome === currentUserNome;
                    const isConcludingThis = editingStageObsId === etapa.id;

                    return (
                      <div key={etapa.id} className="space-y-1.5 p-2 rounded-lg bg-muted/20 border border-border/50 text-xs transition-colors hover:bg-muted/40">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => {
                              if ((isAssignee || isAdmin) && etapa.status !== "Concluído") {
                                handleUpdateStageStatus(etapa.id, "Concluído");
                              } else if (isAdmin && etapa.status === "Concluído") {
                                handleUpdateStageStatus(etapa.id, "A Fazer");
                              }
                            }}
                            disabled={!isAssignee && !isAdmin}
                            className={`mt-0.5 shrink-0 h-4 w-4 rounded-full border flex items-center justify-center transition-all ${
                              etapa.status === "Concluído" 
                                ? "bg-green-500 border-green-500 text-white" 
                                : isAssignee || isAdmin ? "border-muted-foreground/60 hover:border-primary cursor-pointer hover:bg-primary/5" : "border-muted-foreground/30 bg-muted/10 cursor-not-allowed"
                            }`}
                          >
                            {etapa.status === "Concluído" && <Check className="h-3 w-3" />}
                          </button>
                          
                          <div className="flex-1 space-y-1.5">
                            <span className={`font-semibold transition-all ${etapa.status === "Concluído" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {etapa.titulo}
                            </span>
                            
                            <div className="flex flex-wrap items-center gap-3">
                              {etapa.responsavel_nome && (
                                <div className="flex items-center gap-1.5" title={`Responsável: ${etapa.responsavel_nome}`}>
                                  <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary border border-primary/20 uppercase">
                                    {etapa.responsavel_nome.substring(0, 2)}
                                  </div>
                                  <span className={`text-[10px] font-medium ${etapa.status === "Concluído" ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                                    {etapa.responsavel_nome}
                                  </span>
                                </div>
                              )}
                              
                              {etapa.status !== "Concluído" && (
                                <Badge className={`h-4 text-[9px] px-1.5 ${
                                  etapa.status === "Em Andamento" ? "bg-[#E66C37]/15 text-[#E66C37] border-0" :
                                  "bg-[#A1343C]/15 text-[#A1343C] border-0"
                                }`}>
                                  {etapa.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Exibir observações cadastradas na etapa */}
                        {etapa.observacoes && (
                          <div className="ml-7 mt-1.5 p-2 rounded bg-background/50 border border-border/40 text-[10px] text-foreground/80">
                            <strong className="text-muted-foreground font-semibold">Obs:</strong> {etapa.observacoes}
                          </div>
                        )}

                        {/* Formulário inline para preenchimento de observações de conclusão */}
                        {isConcludingThis && (
                          <div className="ml-7 mt-2 pt-2 border-t border-border/40 space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground">Observações de Conclusão (Opcional)</Label>
                            <Textarea
                              placeholder="Detalhes adicionais..."
                              value={stageObsInput}
                              onChange={(e) => setStageObsInput(e.target.value)}
                              className="h-12 text-xs bg-background/60"
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
                                className="h-6 text-[10px] bg-green-600 text-white hover:bg-green-700"
                              >
                                Concluir
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhuma etapa definida.</p>
                )}
              </div>

              {/* Add New Stage Form - Minimalist Inline */}
              {viewEvent?.status !== "Concluído" && (
                <div className="mt-3 flex items-center gap-2 bg-muted/10 p-1.5 rounded-full border border-border/50 transition-colors focus-within:border-primary/50 focus-within:bg-background">
                  <Input
                    placeholder="Adicionar nova etapa..."
                    value={newStageTitle}
                    onChange={(e) => setNewStageTitle(e.target.value)}
                    className="h-7 text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 px-2 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newStageTitle) handleAddStage();
                    }}
                  />
                  {newStageTitle && (
                    <Select
                      value={newStageAssignee || "none"}
                      onValueChange={(val) => setNewStageAssignee(val === "none" ? "" : val)}
                    >
                      <SelectTrigger className="h-7 w-[120px] text-[10px] border-0 bg-transparent shadow-none focus:ring-0 text-muted-foreground shrink-0 border-l border-border/50 rounded-none">
                        <SelectValue placeholder="Responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione...</SelectItem>
                        {usuarios.map(u => (
                          <SelectItem key={u.user_id} value={u.nome} className="text-[10px]">{u.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {newStageTitle && (
                    <Button size="icon" onClick={handleAddStage} className="h-6 w-6 rounded-full bg-primary text-primary-foreground shrink-0 mr-0.5">
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
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

          <DialogFooter className="flex-row sm:justify-end gap-2 border-t border-border/40 pt-3 mt-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewDialogOpen(false)}
              className="mr-auto sm:mr-0"
            >
              Fechar
            </Button>
            
            {viewEvent && (
              <div className="flex gap-2 w-full sm:w-auto sm:mr-auto mt-2 sm:mt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(generateWhatsAppLink(viewEvent), "_blank")}
                  className="gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 w-full sm:w-auto"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(generateGoogleCalendarLink(viewEvent), "_blank")}
                  className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 w-full sm:w-auto"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Google Agenda
                </Button>
              </div>
            )}

            {viewEvent?.status !== "Concluído" && (
              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
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
              </div>
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

      {/* Medição Preview Dialog */}
      <Dialog open={!!previewFaturaId} onOpenChange={(open) => !open && setPreviewFaturaId(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-md border border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-accent">
              <Eye className="h-5 w-5" />
              <span>Verificar Medição - {previewData?.empresa?.nome || "Cliente"}</span>
            </DialogTitle>
          </DialogHeader>

          {loadingPreview ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Clock className="h-8 w-8 text-accent animate-spin" />
              <p className="text-xs text-muted-foreground font-semibold animate-pulse">Carregando dados da medição...</p>
            </div>
          ) : previewData ? (
            <div className="space-y-6 text-sm">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-border/40 rounded-xl p-4 bg-muted/10 shadow-inner">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Informações Gerais</p>
                  <p className="text-xs"><strong>Mês de Referência:</strong> {previewData.fatura.periodo || "—"}</p>
                  <p className="text-xs"><strong>Período de Medição:</strong> {previewData.fatura.periodo_medicao_inicio ? new Date(previewData.fatura.periodo_medicao_inicio).toLocaleDateString("pt-BR") : ""} a {previewData.fatura.periodo_medicao_fim ? new Date(previewData.fatura.periodo_medicao_fim).toLocaleDateString("pt-BR") : ""}</p>
                  <p className="text-xs"><strong>Objeto:</strong> {previewData.contrato.objeto || "Locação de Equipamentos"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Cliente / Contratante</p>
                  <p className="text-xs"><strong>Nome:</strong> {previewData.empresa?.nome || "—"}</p>
                  <p className="text-xs"><strong>CNPJ:</strong> {previewData.empresa?.cnpj || "—"}</p>
                  {previewData.empresa?.obra && <p className="text-xs"><strong>Obra:</strong> {previewData.empresa.obra}</p>}
                </div>
              </div>

              {/* Equipments Table */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Equipamentos Medidos</p>
                <div className="border border-border/40 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/40 font-semibold border-b border-border/40 text-muted-foreground">
                      <tr>
                        <th className="p-3">Equipamento</th>
                        <th className="p-3 text-center">Horas Normais</th>
                        <th className="p-3 text-center">Horas Excedentes</th>
                        <th className="p-3 text-right">Valor Unitário (h)</th>
                        <th className="p-3 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.equipamentosItens.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum equipamento vinculado</td>
                        </tr>
                      ) : (
                        previewData.equipamentosItens.map((eq: any) => {
                          const normalHrs = Number(eq.horas_normais || eq.horas_medidas || 0);
                          const excHrs = Number(eq.horas_excedentes || 0);
                          const valUnit = Number(eq.valor_hora || 0);
                          const valExc = Number(eq.valor_excedente_hora || eq.valor_hora_excedente || 0);
                          const total = (normalHrs * valUnit) + (excHrs * valExc);
                          
                          return (
                            <tr key={eq.id} className="border-b border-border/20 last:border-0 hover:bg-muted/5 transition-colors">
                              <td className="p-3 font-medium text-foreground">
                                {eq.equipamentos?.tipo} {eq.equipamentos?.modelo}
                                {eq.equipamentos?.tag_placa && (
                                  <Badge variant="outline" className="ml-2 py-0 px-1.5 text-[9px] font-mono font-medium">
                                    {eq.equipamentos.tag_placa}
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-center font-mono text-foreground/80">{normalHrs.toFixed(2)}h</td>
                              <td className="p-3 text-center font-mono text-foreground/80">{excHrs.toFixed(2)}h</td>
                              <td className="p-3 text-right font-mono text-foreground/80">R$ {valUnit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                              <td className="p-3 text-right font-semibold font-mono text-foreground">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Gastos Table */}
              {previewData.gastosItens.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Custos Adicionais / Despesas</p>
                  <div className="border border-border/40 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-muted/40 font-semibold border-b border-border/40 text-muted-foreground">
                        <tr>
                          <th className="p-3">Descrição</th>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Classificação</th>
                          <th className="p-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.gastosItens.map((g: any) => {
                          const isReembolso = g.classificacao === "A Reembolsar ao Cliente";
                          return (
                            <tr key={g.id} className="border-b border-border/20 last:border-0 hover:bg-muted/5 transition-colors">
                              <td className="p-3 font-medium text-foreground">{g.descricao || "—"}</td>
                              <td className="p-3 text-foreground/80">{g.tipo || "—"}</td>
                              <td className="p-3">
                                <Badge variant="outline" className={isReembolso ? "text-destructive border-destructive/20 bg-destructive/5 font-semibold text-[10px]" : "text-success border-success/20 bg-success/5 font-semibold text-[10px]"}>
                                  {g.classificacao || "A Cobrar do Cliente"}
                                </Badge>
                              </td>
                              <td className={`p-3 text-right font-mono font-semibold ${isReembolso ? "text-destructive" : "text-foreground"}`}>
                                {isReembolso ? "- " : ""}R$ {Number(g.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Financial Summary */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Resumo Financeiro</p>
                <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/5 divide-y divide-border/20 shadow-sm">
                  {(() => {
                    let medicaoTotal = 0;
                    previewData.equipamentosItens.forEach((eq: any) => {
                      const normalHrs = Number(eq.horas_normais || eq.horas_medidas || 0);
                      const excHrs = Number(eq.horas_excedentes || 0);
                      const valUnit = Number(eq.valor_hora || 0);
                      const valExc = Number(eq.valor_excedente_hora || eq.valor_hora_excedente || 0);
                      medicaoTotal += (normalHrs * valUnit) + (excHrs * valExc);
                    });

                    let totalCobrar = 0;
                    let totalReembolsar = 0;
                    previewData.gastosItens.forEach((g: any) => {
                      const val = Number(g.valor || 0);
                      if (g.classificacao === "A Reembolsar ao Cliente") {
                        totalReembolsar += val;
                      } else {
                        totalCobrar += val;
                      }
                    });

                    const valorTotal = medicaoTotal + totalCobrar - totalReembolsar;

                    return (
                      <>
                        <div className="flex justify-between p-3 text-xs">
                          <span className="text-muted-foreground font-medium">Subtotal Medição (Equipamentos)</span>
                          <span className="font-mono font-semibold text-foreground">R$ {medicaoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        {totalCobrar > 0 && (
                          <div className="flex justify-between p-3 text-xs">
                            <span className="text-muted-foreground font-medium">(+) Custos Operacionais a Cobrar</span>
                            <span className="font-mono font-semibold text-success">+ R$ {totalCobrar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {totalReembolsar > 0 && (
                          <div className="flex justify-between p-3 text-xs">
                            <span className="text-muted-foreground font-medium">(-) Custos Operacionais a Reembolsar</span>
                            <span className="font-mono font-semibold text-destructive">- R$ {totalReembolsar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between p-3 bg-accent/5 font-bold text-sm">
                          <span className="text-foreground uppercase tracking-wide">VALOR TOTAL DA MEDIÇÃO</span>
                          <span className="font-mono text-accent text-base">R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Observações */}
              {previewData.fatura.observacoes && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Observações</p>
                  <p className="text-xs text-muted-foreground bg-yellow-500/5 dark:bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
                    {previewData.fatura.observacoes}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t border-border/30 pt-3">
            <div className="flex flex-wrap gap-2 w-full justify-between items-center">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewFaturaId(null)}
                  className="h-9 text-xs"
                >
                  Fechar
                </Button>
                {previewFaturaId && (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/faturamento?search=${previewData?.fatura?.numero_sequencial || ""}`)}
                    className="h-9 text-xs gap-1.5"
                  >
                    <LinkIcon className="h-3.5 w-3.5" /> Ver no Faturamento
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {previewFaturaId && (
                  <Button
                    variant="secondary"
                    onClick={() => handleDownloadMedicaoPDF(previewFaturaId)}
                    className="h-9 text-xs gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 shadow-sm"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Baixar PDF (Boletim)
                  </Button>
                )}
                {(() => {
                  const previewEvent = events.find(e => e.notas?.includes(previewFaturaId!));
                  if (!previewEvent || !isAdmin || previewData?.fatura?.status !== "Aguardando Aprovação") return null;
                  return (
                    <div className="flex items-center gap-2">
                      <Select
                        value={invoiceResponsibles[previewEvent.id] || "none"}
                        onValueChange={(v) => setInvoiceResponsibles(prev => ({ ...prev, [previewEvent.id]: v }))}
                      >
                        <SelectTrigger className="h-9 text-xs bg-background border-border rounded-lg min-w-[200px]">
                          <SelectValue placeholder="Responsável p/ Faturar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecione o usuário...</SelectItem>
                          {usuarios.map(u => (
                            <SelectItem key={u.user_id} value={u.nome}>{u.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => handleQuickApproveMedicao(previewEvent)}
                        className="h-9 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold gap-1.5 shadow-sm"
                      >
                        <Check className="h-3.5 w-3.5" /> Aprovar Medição
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
