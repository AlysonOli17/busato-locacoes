import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  ShoppingCart,
  Users,
  DollarSign,
  Truck,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  Sliders,
  Check,
  Calendar,
  Layers,
  ArrowUpRight
} from "lucide-react";

export interface SlaConfig {
  id: string;
  setor: string;
  processo: string;
  meta_tempo: number;
  unidade_tempo: string;
  tolerancia_aviso?: number;
  descricao?: string;
  ativo: boolean;
}

export interface SlaRegistro {
  id: string;
  config_id?: string | null;
  setor: string;
  processo: string;
  titulo: string;
  descricao?: string | null;
  equipamento_id?: string | null;
  empresa_id?: string | null;
  responsavel?: string | null;
  prioridade: "Baixa" | "Média" | "Alta" | "Crítica";
  status: "Em Andamento" | "Concluído no Prazo" | "Concluído com Atraso" | "Cancelado";
  data_inicio: string;
  data_previsao?: string | null;
  data_conclusao?: string | null;
  tempo_meta?: number | null;
  unidade_tempo?: string | null;
  observacao_fechamento?: string | null;
  created_at?: string;
}

interface SlaTabProps {
  empresas: any[];
  equipamentos: any[];
  globalEmpresaId?: string;
  globalEquipamentoId?: string;
  globalDataInicio?: string;
  globalDataFim?: string;
}

const SETOR_CONFIGS = [
  { setor: "Oficina", icon: Wrench, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Oficina & Manutenção" },
  { setor: "Compras", icon: ShoppingCart, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Compras de Peças" },
  { setor: "RH", icon: Users, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "RH & Operadores" },
  { setor: "Financeiro", icon: DollarSign, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/30", label: "Financeiro & Faturamento" },
  { setor: "Logística", icon: Truck, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/30", label: "Logística & Transporte" },
];

export const SlaTab = ({
  empresas,
  equipamentos,
  globalEmpresaId = "all",
  globalEquipamentoId = "all",
  globalDataInicio,
  globalDataFim
}: SlaTabProps) => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SlaConfig[]>([]);
  const [registros, setRegistros] = useState<SlaRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSetor, setSelectedSetor] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modais
  const [registroModalOpen, setRegistroModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<SlaRegistro | null>(null);
  const [editingConfig, setEditingConfig] = useState<SlaConfig | null>(null);

  // Form Registro
  const [regForm, setRegForm] = useState({
    setor: "Oficina",
    processo: "Liberação de Equipamento Parado",
    titulo: "",
    descricao: "",
    equipamento_id: "",
    empresa_id: "",
    responsavel: "",
    prioridade: "Alta" as const,
    data_inicio: new Date().toISOString().slice(0, 16),
    tempo_meta: 48,
    unidade_tempo: "horas"
  });

  // Form Config
  const [cfgForm, setCfgForm] = useState({
    setor: "Oficina",
    processo: "",
    meta_tempo: 24,
    unidade_tempo: "horas",
    tolerancia_aviso: 6,
    descricao: "",
    ativo: true
  });

  // Modal de Conclusão rápida
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [finishingRegistro, setFinishingRegistro] = useState<SlaRegistro | null>(null);
  const [observacaoFechamento, setObservacaoFechamento] = useState("");

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [cfgRes, regRes] = await Promise.all([
        supabase.from("sla_configuracoes").select("*").order("setor"),
        supabase.from("sla_registros").select("*").order("created_at", { ascending: false })
      ]);

      if (cfgRes.data && cfgRes.data.length > 0) {
        setConfigs(cfgRes.data as SlaConfig[]);
      } else {
        const localCfg = localStorage.getItem("busato_sla_configs");
        if (localCfg) {
          setConfigs(JSON.parse(localCfg));
        } else {
          const defaultConfigs = [
            { id: "1", setor: "Oficina", processo: "Liberação de Equipamento Parado (Manutenção)", meta_tempo: 48, unidade_tempo: "horas", tolerancia_aviso: 12, descricao: "Tempo máximo para diagnóstico e reparo de máquina indisponível", ativo: true },
            { id: "2", setor: "Compras", processo: "Prazo de Compras para Peças Críticas", meta_tempo: 3, unidade_tempo: "dias", tolerancia_aviso: 1, descricao: "Prazo para cotação, compra e chegada da peça na obra/base", ativo: true },
            { id: "3", setor: "RH", processo: "Mobilização e Integração de Operador", meta_tempo: 5, unidade_tempo: "dias", tolerancia_aviso: 1, descricao: "Prazo para contratação, exames e mobilização de operador", ativo: true },
            { id: "4", setor: "Financeiro", processo: "Medição e Faturamento Pós-Fechamento", meta_tempo: 2, unidade_tempo: "dias", tolerancia_aviso: 1, descricao: "Prazo para fechamento de boletim, faturamento e envio de nota fiscal", ativo: true },
            { id: "5", setor: "Logística", processo: "Transporte / Prancha até a Obra", meta_tempo: 24, unidade_tempo: "horas", tolerancia_aviso: 6, descricao: "Prazo para carregamento e entrega no canteiro de obras", ativo: true },
          ];
          setConfigs(defaultConfigs);
          localStorage.setItem("busato_sla_configs", JSON.stringify(defaultConfigs));
        }
      }

      if (regRes.data && !regRes.error) {
        setRegistros(regRes.data as SlaRegistro[]);
      } else {
        const localReg = localStorage.getItem("busato_sla_registros");
        if (localReg) {
          setRegistros(JSON.parse(localReg));
        }
      }
    } catch (err: any) {
      console.warn("Aviso ao carregar dados remotos de SLA, utilizando cache local:", err);
      const localReg = localStorage.getItem("busato_sla_registros");
      if (localReg) setRegistros(JSON.parse(localReg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Preencher tempo_meta ao alterar setor/processo
  const handleSetorChange = (setor: string) => {
    const cf = configs.find(c => c.setor === setor);
    setRegForm(prev => ({
      ...prev,
      setor,
      processo: cf ? cf.processo : prev.processo,
      tempo_meta: cf ? cf.meta_tempo : 24,
      unidade_tempo: cf ? cf.unidade_tempo : "horas"
    }));
  };

  // Cálculo de Previsão
  const calcularDataPrevisao = (dataInicioIso: string, tempo: number, unidade: string) => {
    const d = new Date(dataInicioIso);
    if (isNaN(d.getTime())) return new Date();
    if (unidade === "horas") {
      d.setHours(d.getHours() + Number(tempo));
    } else {
      d.setDate(d.getDate() + Number(tempo));
    }
    return d;
  };

  // Cálculos de Status em Tempo Real
  const getStatusSla = (r: SlaRegistro) => {
    if (r.status === "Cancelado") return { label: "Cancelado", variant: "secondary", color: "text-muted-foreground", bg: "bg-muted" };
    if (r.status.startsWith("Concluído")) {
      if (r.status === "Concluído no Prazo") {
        return { label: "Concluído no Prazo", variant: "default", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30" };
      }
      return { label: "Concluído com Atraso", variant: "destructive", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/30" };
    }

    const agora = new Date();
    const dataPrev = r.data_previsao ? new Date(r.data_previsao) : calcularDataPrevisao(r.data_inicio, r.tempo_meta || 24, r.unidade_tempo || "horas");
    const diffMs = dataPrev.getTime() - agora.getTime();

    if (diffMs < 0) {
      return { label: "Atrasado (Estourou SLA)", variant: "destructive", color: "text-red-500 font-bold", bg: "bg-red-500/15 border-red-500/40 animate-pulse" };
    }

    // Menos de 20% do tempo restante -> Alerta Amarelo
    const totalMs = dataPrev.getTime() - new Date(r.data_inicio).getTime();
    if (diffMs / (totalMs || 1) < 0.25) {
      return { label: "Em Risco Crítico", variant: "outline", color: "text-amber-500 font-semibold", bg: "bg-amber-500/10 border-amber-500/40" };
    }

    return { label: "Dentro do Prazo", variant: "outline", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/30" };
  };

  // Formatar tempo decorrido / restante
  const formatDiffTime = (r: SlaRegistro) => {
    const dataPrev = r.data_previsao ? new Date(r.data_previsao) : calcularDataPrevisao(r.data_inicio, r.tempo_meta || 24, r.unidade_tempo || "horas");
    const refDate = r.data_conclusao ? new Date(r.data_conclusao) : new Date();
    const diffMs = dataPrev.getTime() - refDate.getTime();
    const isPast = diffMs < 0;
    const absHours = Math.abs(diffMs) / (1000 * 60 * 60);

    if (r.data_conclusao) {
      if (isPast) return `${Math.ceil(absHours)}h após o limite`;
      return `${Math.floor(absHours)}h antes do prazo`;
    }

    if (isPast) {
      const dias = Math.floor(absHours / 24);
      return dias > 0 ? `+${dias}d ${Math.floor(absHours % 24)}h atrasado` : `+${Math.floor(absHours)}h atrasado`;
    } else {
      const dias = Math.floor(absHours / 24);
      return dias > 0 ? `${dias}d ${Math.floor(absHours % 24)}h restantes` : `${Math.floor(absHours)}h restantes`;
    }
  };

  // Filtros aplicados
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      if (selectedSetor !== "all" && r.setor !== selectedSetor) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "em_aberto" && r.status !== "Em Andamento") return false;
        if (statusFilter === "concluidos" && !r.status.startsWith("Concluído")) return false;
        if (statusFilter === "atrasados") {
          const st = getStatusSla(r);
          if (r.status !== "Concluído com Atraso" && !st.label.includes("Atrasado")) return false;
        }
      }
      if (globalEmpresaId !== "all" && r.empresa_id && r.empresa_id !== globalEmpresaId) return false;
      if (globalEquipamentoId !== "all" && r.equipamento_id && r.equipamento_id !== globalEquipamentoId) return false;
      if (globalDataInicio && r.data_inicio < globalDataInicio) return false;
      if (globalDataFim && r.data_inicio.slice(0, 10) > globalDataFim) return false;
      return true;
    });
  }, [registros, selectedSetor, statusFilter, globalEmpresaId, globalEquipamentoId, globalDataInicio, globalDataFim]);

  // Indicadores Gerais
  const kpis = useMemo(() => {
    const total = registrosFiltrados.length;
    let emAndamento = 0;
    let dentroPrazo = 0;
    let atrasados = 0;
    let concluidos = 0;

    registrosFiltrados.forEach(r => {
      if (r.status === "Em Andamento") {
        emAndamento++;
        const st = getStatusSla(r);
        if (st.label.includes("Atrasado")) atrasados++;
        else dentroPrazo++;
      } else if (r.status.startsWith("Concluído")) {
        concluidos++;
        if (r.status === "Concluído no Prazo") dentroPrazo++;
        else atrasados++;
      }
    });

    const taxaSucesso = (concluidos + emAndamento) > 0 ? ((dentroPrazo / (concluidos + emAndamento)) * 100).toFixed(1) : "100.0";

    return { total, emAndamento, dentroPrazo, atrasados, concluidos, taxaSucesso };
  }, [registrosFiltrados]);

  // Submeter Registro
  const handleSalvarRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataPrev = calcularDataPrevisao(regForm.data_inicio, regForm.tempo_meta, regForm.unidade_tempo);
    const payload: SlaRegistro = {
      id: editingRegistro ? editingRegistro.id : crypto.randomUUID(),
      setor: regForm.setor,
      processo: regForm.processo,
      titulo: regForm.titulo,
      descricao: regForm.descricao,
      equipamento_id: regForm.equipamento_id || null,
      empresa_id: regForm.empresa_id || null,
      responsavel: regForm.responsavel,
      prioridade: regForm.prioridade,
      data_inicio: new Date(regForm.data_inicio).toISOString(),
      data_previsao: dataPrev.toISOString(),
      tempo_meta: Number(regForm.tempo_meta),
      unidade_tempo: regForm.unidade_tempo,
      status: editingRegistro ? editingRegistro.status : "Em Andamento",
      created_at: editingRegistro?.created_at || new Date().toISOString()
    };

    try {
      if (editingRegistro) {
        const { error } = await supabase.from("sla_registros").update(payload).eq("id", editingRegistro.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sla_registros").insert([payload]);
        if (error) throw error;
      }
      toast({ title: editingRegistro ? "SLA atualizado com sucesso!" : "Ocorrência de SLA registrada com sucesso!" });
    } catch (err: any) {
      console.warn("Salvando no cache local (tabela remota ainda não disponível):", err);
      // Salva localmente com fallback garantido
      const currentList: SlaRegistro[] = JSON.parse(localStorage.getItem("busato_sla_registros") || "[]");
      let updatedList: SlaRegistro[];
      if (editingRegistro) {
        updatedList = currentList.map(item => item.id === editingRegistro.id ? payload : item);
      } else {
        updatedList = [payload, ...currentList];
      }
      localStorage.setItem("busato_sla_registros", JSON.stringify(updatedList));
      setRegistros(updatedList);
      toast({ 
        title: editingRegistro ? "SLA atualizado com sucesso!" : "Ocorrência salva com sucesso!", 
        description: "Demanda registrada e ativa no cockpit operacional." 
      });
    }

    setRegistroModalOpen(false);
    setEditingRegistro(null);
    carregarDados();
  };

  // Finalizar Ocorrência
  const handleConfirmarConclusao = async () => {
    if (!finishingRegistro) return;
    const agora = new Date();
    const dataPrev = finishingRegistro.data_previsao ? new Date(finishingRegistro.data_previsao) : calcularDataPrevisao(finishingRegistro.data_inicio, finishingRegistro.tempo_meta || 24, finishingRegistro.unidade_tempo || "horas");
    const noPrazo = agora.getTime() <= dataPrev.getTime();
    const statusFinal = noPrazo ? "Concluído no Prazo" : "Concluído com Atraso";

    try {
      const { error } = await supabase.from("sla_registros").update({
        status: statusFinal,
        data_conclusao: agora.toISOString(),
        observacao_fechamento: observacaoFechamento
      }).eq("id", finishingRegistro.id);

      if (error) throw error;
    } catch (err: any) {
      console.warn("Atualizando no cache local:", err);
      const currentList: SlaRegistro[] = JSON.parse(localStorage.getItem("busato_sla_registros") || "[]");
      const updatedList = currentList.map(item => item.id === finishingRegistro.id ? {
        ...item,
        status: statusFinal,
        data_conclusao: agora.toISOString(),
        observacao_fechamento: observacaoFechamento
      } : item);
      localStorage.setItem("busato_sla_registros", JSON.stringify(updatedList));
      setRegistros(updatedList);
    }

    toast({
      title: noPrazo ? "Concluído no Prazo!" : "Concluído com Atraso",
      description: `Ocorrência do setor ${finishingRegistro.setor} finalizada.`,
      variant: noPrazo ? "default" : "destructive"
    });

    setFinishModalOpen(false);
    setFinishingRegistro(null);
    setObservacaoFechamento("");
    carregarDados();
  };

  // Salvar Configuração
  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: SlaConfig = {
      id: editingConfig ? editingConfig.id : crypto.randomUUID(),
      setor: cfgForm.setor,
      processo: cfgForm.processo,
      meta_tempo: Number(cfgForm.meta_tempo),
      unidade_tempo: cfgForm.unidade_tempo,
      tolerancia_aviso: Number(cfgForm.tolerancia_aviso || 0),
      descricao: cfgForm.descricao,
      ativo: cfgForm.ativo
    };

    try {
      if (editingConfig) {
        const { error } = await supabase.from("sla_configuracoes").update(payload).eq("id", editingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sla_configuracoes").insert([payload]);
        if (error) throw error;
      }
      toast({ title: editingConfig ? "Configuração atualizada com sucesso!" : "Nova meta de SLA configurada!" });
    } catch (err: any) {
      console.warn("Salvando configuração no cache local:", err);
      const currentList: SlaConfig[] = JSON.parse(localStorage.getItem("busato_sla_configs") || "[]");
      let updatedList: SlaConfig[];
      if (editingConfig) {
        updatedList = currentList.map(item => item.id === editingConfig.id ? payload : item);
      } else {
        updatedList = [...currentList, payload];
      }
      localStorage.setItem("busato_sla_configs", JSON.stringify(updatedList));
      setConfigs(updatedList);
      toast({ title: "Meta salva com sucesso!" });
    }

    setConfigModalOpen(false);
    setEditingConfig(null);
    carregarDados();
  };

  const handleDeletarRegistro = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta ocorrência de SLA?")) return;
    try {
      const { error } = await supabase.from("sla_registros").delete().eq("id", id);
      if (error) throw error;
    } catch (err: any) {
      console.warn("Removendo do cache local:", err);
      const currentList: SlaRegistro[] = JSON.parse(localStorage.getItem("busato_sla_registros") || "[]");
      const updatedList = currentList.filter(item => item.id !== id);
      localStorage.setItem("busato_sla_registros", JSON.stringify(updatedList));
      setRegistros(updatedList);
    }
    toast({ title: "Registro removido com sucesso!" });
    carregarDados();
  };

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho e Ações ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/60 backdrop-blur-sm p-4 rounded-2xl border border-border/60">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Gestão de SLAs Internos por Setor
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoramento de cumprimento de prazos operacionais críticos (Oficina, Compras, RH, Financeiro e Logística).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingConfig(null);
              setCfgForm({ setor: "Oficina", processo: "", meta_tempo: 24, unidade_tempo: "horas", tolerancia_aviso: 6, descricao: "", ativo: true });
              setConfigModalOpen(true);
            }}
            className="gap-1.5 text-xs shadow-sm"
          >
            <Sliders className="h-4 w-4" /> Configurar Metas
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingRegistro(null);
              setRegForm({
                setor: "Oficina",
                processo: "Liberação de Equipamento Parado",
                titulo: "",
                descricao: "",
                equipamento_id: "",
                empresa_id: "",
                responsavel: "",
                prioridade: "Alta",
                data_inicio: new Date().toISOString().slice(0, 16),
                tempo_meta: 48,
                unidade_tempo: "horas"
              });
              setRegistroModalOpen(true);
            }}
            className="gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Plus className="h-4 w-4" /> Nova Ocorrência / Demanda
          </Button>
        </div>
      </div>

      {/* ── KPIs Rápidos de SLA ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">Cumprimento Global</CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-500 flex items-center justify-between">
              {kpis.taxaSucesso}%
              <TrendingUp className="h-5 w-5 text-emerald-500/60" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {kpis.dentroPrazo} atendimentos no prazo estipulado
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">Demandas Ativas</CardDescription>
            <CardTitle className="text-2xl font-black text-blue-500 flex items-center justify-between">
              {kpis.emAndamento}
              <Clock className="h-5 w-5 text-blue-500/60" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Processos correndo tempo de SLA
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">Estouradas / Críticas</CardDescription>
            <CardTitle className="text-2xl font-black text-rose-500 flex items-center justify-between">
              {kpis.atrasados}
              <AlertOctagon className="h-5 w-5 text-rose-500/60" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-rose-400 font-medium">
              {kpis.atrasados > 0 ? "Requer intervenção imediata da gestão" : "Nenhum atraso registrado"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">Histórico Finalizado</CardDescription>
            <CardTitle className="text-2xl font-black text-foreground flex items-center justify-between">
              {kpis.concluidos}
              <CheckCircle2 className="h-5 w-5 text-muted-foreground/60" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Total de demandas fechadas
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Seletor por Setor (Tabs / Cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <button
          onClick={() => setSelectedSetor("all")}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedSetor === "all"
              ? "bg-primary text-primary-foreground border-primary shadow-md"
              : "bg-card/50 hover:bg-card border-border/60 text-muted-foreground"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <Layers className="h-4 w-4" />
            <Badge variant="secondary" className="text-[10px] px-1 py-0">{registros.length}</Badge>
          </div>
          <p className="font-semibold text-xs leading-none">Todos os Setores</p>
          <p className="text-[10px] opacity-75 mt-1">Visão Integrada</p>
        </button>

        {SETOR_CONFIGS.map(sc => {
          const Icon = sc.icon;
          const qtd = registros.filter(r => r.setor === sc.setor).length;
          const atrasadoCount = registros.filter(r => r.setor === sc.setor && (r.status === "Concluído com Atraso" || getStatusSla(r).label.includes("Atrasado"))).length;
          const isSelected = selectedSetor === sc.setor;

          return (
            <button
              key={sc.setor}
              onClick={() => setSelectedSetor(sc.setor)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? `${sc.bg} ${sc.border} ring-2 ring-primary/40 shadow-sm`
                  : "bg-card/40 hover:bg-card border-border/60"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className={`h-4 w-4 ${sc.color}`} />
                <div className="flex items-center gap-1">
                  {atrasadoCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                      {atrasadoCount}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {qtd}
                  </Badge>
                </div>
              </div>
              <p className="font-bold text-xs truncate text-foreground">{sc.setor}</p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sc.label}</p>
            </button>
          );
        })}
      </div>

      {/* ── Tabela de Demandas / Ocorrências de SLA ── */}
      <Card className="border-border/60 shadow-sm bg-card/50">
        <CardHeader className="p-4 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <span>Acompanhamento em Tempo Real</span>
              <Badge variant="outline" className="text-xs font-normal">
                {registrosFiltrados.length} ocorrência{registrosFiltrados.length !== 1 ? "s" : ""}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Prazos calculados dinamicamente com base nas metas estipuladas.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="em_aberto">⏳ Em Aberto</SelectItem>
                <SelectItem value="atrasados">🚨 Atrasados / Críticos</SelectItem>
                <SelectItem value="concluidos">✅ Concluídos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/60">
                  <TableHead className="w-[100px] text-xs font-bold uppercase">Setor</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Processo & Demanda</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Equipamento / Cliente</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Responsável</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Meta SLA</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Tempo Restante / Conclusão</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Status</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase pr-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-xs">
                      Carregando dados de SLA...
                    </TableCell>
                  </TableRow>
                ) : registrosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-xs">
                      Nenhuma ocorrência de SLA encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  registrosFiltrados.map((r) => {
                    const st = getStatusSla(r);
                    const equip = equipamentos.find(e => e.id === r.equipamento_id);
                    const emp = empresas.find(e => e.id === r.empresa_id);

                    return (
                      <TableRow key={r.id} className="border-border/40 hover:bg-muted/40 transition-colors">
                        <TableCell className="font-semibold text-xs">
                          <Badge variant="outline" className="font-bold border-border/80">
                            {r.setor}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                            {r.titulo}
                            {r.prioridade === "Crítica" && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5">URGENTE</Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                            {r.processo} {r.descricao ? `• ${r.descricao}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {equip ? (
                            <div className="font-medium text-foreground">
                              {equip.tipo} {equip.modelo} <span className="text-muted-foreground">({equip.tag_placa || "S/ Placa"})</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                          {emp && <div className="text-[11px] text-muted-foreground truncate">{emp.nome}</div>}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground">
                          {r.responsavel || <span className="text-muted-foreground italic">Não atribuído</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-bold text-foreground">{r.tempo_meta} {r.unidade_tempo}</span>
                          <div className="text-[10px] text-muted-foreground">
                            Início: {new Date(r.data_inicio).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-semibold text-foreground">
                            {formatDiffTime(r)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Limite: {r.data_previsao ? new Date(r.data_previsao).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${st.bg} ${st.color}`}>
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {r.status === "Em Andamento" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setFinishingRegistro(r);
                                  setObservacaoFechamento("");
                                  setFinishModalOpen(true);
                                }}
                                className="h-7 px-2 text-[11px] gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              >
                                <Check className="h-3.5 w-3.5" /> Concluir
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingRegistro(r);
                                setRegForm({
                                  setor: r.setor,
                                  processo: r.processo,
                                  titulo: r.titulo,
                                  descricao: r.descricao || "",
                                  equipamento_id: r.equipamento_id || "",
                                  empresa_id: r.empresa_id || "",
                                  responsavel: r.responsavel || "",
                                  prioridade: r.prioridade,
                                  data_inicio: new Date(r.data_inicio).toISOString().slice(0, 16),
                                  tempo_meta: r.tempo_meta || 24,
                                  unidade_tempo: r.unidade_tempo || "horas"
                                });
                                setRegistroModalOpen(true);
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeletarRegistro(r.id)}
                              className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Modal de Nova / Edição de Demanda SLA ── */}
      <Dialog open={registroModalOpen} onOpenChange={setRegistroModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {editingRegistro ? "Editar Ocorrência de SLA" : "Nova Demanda de SLA Interno"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSalvarRegistro} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Setor Responsável *</Label>
                <Select value={regForm.setor} onValueChange={handleSetorChange}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SETOR_CONFIGS.map(s => (
                      <SelectItem key={s.setor} value={s.setor}>{s.setor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold">Prioridade *</Label>
                <Select value={regForm.prioridade} onValueChange={(v: any) => setRegForm(prev => ({ ...prev, prioridade: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Crítica">🚨 Crítica / Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Tipo de Processo / Meta *</Label>
              <Input
                value={regForm.processo}
                onChange={e => setRegForm(prev => ({ ...prev, processo: e.target.value }))}
                placeholder="Ex: Liberação de Equipamento Parado"
                className="mt-1 h-9 text-xs"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Título do Chamado / Demanda *</Label>
              <Input
                value={regForm.titulo}
                onChange={e => setRegForm(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ex: Reparo Bomba D'água Caminhão Pipa QRH-8G91"
                className="mt-1 h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Equipamento Vinculado</Label>
                <SearchableSelect
                  value={regForm.equipamento_id}
                  onValueChange={v => setRegForm(prev => ({ ...prev, equipamento_id: v }))}
                  placeholder="Selecione (opcional)"
                  options={[
                    { value: "", label: "Nenhum equipamento" },
                    ...equipamentos.map(eq => ({
                      value: eq.id,
                      label: `${eq.tipo} ${eq.modelo} ${eq.tag_placa ? `(${eq.tag_placa})` : ''}`
                    }))
                  ]}
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Cliente / Obra Vinculada</Label>
                <SearchableSelect
                  value={regForm.empresa_id}
                  onValueChange={v => setRegForm(prev => ({ ...prev, empresa_id: v }))}
                  placeholder="Selecione (opcional)"
                  options={[
                    { value: "", label: "Nenhum cliente" },
                    ...empresas.map(emp => ({ value: emp.id, label: emp.nome }))
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-bold">Data Início *</Label>
                <Input
                  type="datetime-local"
                  value={regForm.data_inicio}
                  onChange={e => setRegForm(prev => ({ ...prev, data_inicio: e.target.value }))}
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Prazo / Meta *</Label>
                <Input
                  type="number"
                  value={regForm.tempo_meta}
                  onChange={e => setRegForm(prev => ({ ...prev, tempo_meta: Number(e.target.value) }))}
                  className="mt-1 h-9 text-xs"
                  required
                  min={1}
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Unidade *</Label>
                <Select value={regForm.unidade_tempo} onValueChange={v => setRegForm(prev => ({ ...prev, unidade_tempo: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horas">Horas</SelectItem>
                    <SelectItem value="dias">Dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Responsável</Label>
              <Input
                value={regForm.responsavel}
                onChange={e => setRegForm(prev => ({ ...prev, responsavel: e.target.value }))}
                placeholder="Ex: João Mecânico / Maria Compras"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Observações / Detalhes</Label>
              <Textarea
                value={regForm.descricao}
                onChange={e => setRegForm(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva detalhes específicos da urgência, peças necessárias ou local..."
                className="mt-1 text-xs"
                rows={2}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRegistroModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground">
                Salvar Demanda
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal Concluir Registro ── */}
      <Dialog open={finishModalOpen} onOpenChange={setFinishModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Concluir Demanda de SLA
            </DialogTitle>
          </DialogHeader>

          {finishingRegistro && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/50 rounded-xl border border-border/60 text-xs space-y-1">
                <p><strong>Setor:</strong> {finishingRegistro.setor}</p>
                <p><strong>Demanda:</strong> {finishingRegistro.titulo}</p>
                <p><strong>Meta Acordada:</strong> {finishingRegistro.tempo_meta} {finishingRegistro.unidade_tempo}</p>
                <p><strong>Status de Entrega:</strong> {
                  new Date().getTime() <= (finishingRegistro.data_previsao ? new Date(finishingRegistro.data_previsao).getTime() : 0)
                    ? <span className="text-emerald-500 font-bold">✅ Dentro do Prazo</span>
                    : <span className="text-rose-500 font-bold">⚠️ Com Atraso</span>
                }</p>
              </div>

              <div>
                <Label className="text-xs font-bold">Nota de Fechamento / Solução</Label>
                <Textarea
                  value={observacaoFechamento}
                  onChange={e => setObservacaoFechamento(e.target.value)}
                  placeholder="Ex: Peça instalada e testada em campo. Equipamento liberado para operação."
                  className="mt-1 text-xs"
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setFinishModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmarConclusao} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Confirmar Finalização
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal Gerenciar Metas dos Setores ── */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              Configuração de Metas de SLA por Setor
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Lista Atual */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Metas Ativas Cadastradas</Label>
              <div className="border border-border/60 rounded-xl overflow-hidden divide-y divide-border/60">
                {configs.map(cfg => (
                  <div key={cfg.id} className="p-3 flex items-center justify-between text-xs hover:bg-muted/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-bold">{cfg.setor}</Badge>
                        <span className="font-bold text-foreground">{cfg.processo}</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">{cfg.descricao || "Sem descrição"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-md text-xs">
                        {cfg.meta_tempo} {cfg.unidade_tempo}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingConfig(cfg);
                          setCfgForm({
                            setor: cfg.setor,
                            processo: cfg.processo,
                            meta_tempo: cfg.meta_tempo,
                            unidade_tempo: cfg.unidade_tempo,
                            tolerancia_aviso: cfg.tolerancia_aviso || 0,
                            descricao: cfg.descricao || "",
                            ativo: cfg.ativo
                          });
                        }}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulário Adicionar/Editar Meta */}
            <form onSubmit={handleSalvarConfig} className="p-4 bg-muted/30 rounded-xl border border-border/60 space-y-4">
              <p className="font-bold text-xs text-foreground">
                {editingConfig ? "Editar Meta Selecionada" : "Cadastrar Nova Meta de Processo"}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">Setor</Label>
                  <Select value={cfgForm.setor} onValueChange={v => setCfgForm(prev => ({ ...prev, setor: v }))}>
                    <SelectTrigger className="mt-1 h-9 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SETOR_CONFIGS.map(s => (
                        <SelectItem key={s.setor} value={s.setor}>{s.setor}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-bold">Nome do Processo</Label>
                  <Input
                    value={cfgForm.processo}
                    onChange={e => setCfgForm(prev => ({ ...prev, processo: e.target.value }))}
                    placeholder="Ex: Aquisição de Peças Críticas"
                    className="mt-1 h-9 text-xs bg-background"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold">Tempo Meta</Label>
                  <Input
                    type="number"
                    value={cfgForm.meta_tempo}
                    onChange={e => setCfgForm(prev => ({ ...prev, meta_tempo: Number(e.target.value) }))}
                    className="mt-1 h-9 text-xs bg-background"
                    required
                    min={1}
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">Unidade de Medida</Label>
                  <Select value={cfgForm.unidade_tempo} onValueChange={v => setCfgForm(prev => ({ ...prev, unidade_tempo: v }))}>
                    <SelectTrigger className="mt-1 h-9 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horas">Horas</SelectItem>
                      <SelectItem value="dias">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-bold">Tolerância Alerta</Label>
                  <Input
                    type="number"
                    value={cfgForm.tolerancia_aviso}
                    onChange={e => setCfgForm(prev => ({ ...prev, tolerancia_aviso: Number(e.target.value) }))}
                    className="mt-1 h-9 text-xs bg-background"
                    placeholder="Ex: 6"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold">Descrição da Meta Operacional</Label>
                <Textarea
                  value={cfgForm.descricao}
                  onChange={e => setCfgForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Explicar critério para início e término da contagem do tempo..."
                  className="mt-1 text-xs bg-background"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingConfig && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingConfig(null);
                      setCfgForm({ setor: "Oficina", processo: "", meta_tempo: 24, unidade_tempo: "horas", tolerancia_aviso: 6, descricao: "", ativo: true });
                    }}
                  >
                    Cancelar Edição
                  </Button>
                )}
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground">
                  {editingConfig ? "Atualizar Meta" : "Adicionar Meta"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
