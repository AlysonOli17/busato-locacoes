import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { getEquipLabel, isAfterDec2025 } from "@/lib/utils";

import { Switch } from "@/components/ui/switch";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Plus, Search, Pencil, Trash2, FileText, FileDown, FileSpreadsheet, X, BarChart3, AlertTriangle, TrendingUp, Settings2, CalendarRange, FilePlus2, FileSignature, Package, CheckCircle2, CalendarPlus, Ban, Briefcase, Activity, BookOpen, LayoutGrid, List } from "lucide-react";
import { ModeloClausulasTab, ContratoClausulasTab } from "@/components/ModeloClausulasTab";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropostasContent } from "@/pages/Propostas";
import { ContratosDossieTab } from "@/components/ContratosDossieTab";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SortableTableHead } from "@/components/SortableTableHead";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToExcel } from "@/lib/exportUtils";

import { 
  Empresa, Equipamento, ContratoEquipamento, Contrato, 
  FormEquipItem, EquipUsage, AjusteTemporario, Aditivo, AditivoEquipamento 
} from "@/types/contracts";

interface AjusteForm {
  equipamento_ids: string[];
  valor_hora: number;
  valor_hora_excedente: number;
  hora_minima: number;
  horas_contratadas: number;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  desconto_percentual: number;
}

interface AditivoForm {
  numero: number;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  observacoes: string;
  equipamentos: FormEquipItem[];
}

const emptyForm = { empresa_id: "", equipamento_id: "", valor_hora: 0, horas_contratadas: 0, data_inicio: "", data_fim: "", observacoes: "", status: "Ativo", dia_medicao_inicio: 1, dia_medicao_fim: 30, prazo_faturamento: 30, tipo_medicao: "horas" };

const Contratos = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "contratos";
  });
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab") || "contratos";
    setActiveTab(tab);
  }, [location.search]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", val);
    window.history.pushState({}, "", url.pathname + url.search);
  };

  const [items, setItems] = useState<Contrato[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formEquipamentos, setFormEquipamentos] = useState<FormEquipItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [dashboardContrato, setDashboardContrato] = useState<Contrato | null>(null);
  const [equipUsages, setEquipUsages] = useState<EquipUsage[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  // Ajustes temporários
  const [ajustesOpen, setAjustesOpen] = useState(false);
  const [ajustesContrato, setAjustesContrato] = useState<Contrato | null>(null);
  const [ajustes, setAjustes] = useState<AjusteTemporario[]>([]);
  const [ajusteFormOpen, setAjusteFormOpen] = useState(false);
  const [editingAjuste, setEditingAjuste] = useState<AjusteTemporario | null>(null);
  const [ajusteForm, setAjusteForm] = useState<AjusteForm>({ equipamento_ids: [], valor_hora: 0, valor_hora_excedente: 0, hora_minima: 0, horas_contratadas: 0, data_inicio: "", data_fim: "", motivo: "", desconto_percentual: 0 });
  const [ajusteTodos, setAjusteTodos] = useState(false);
  const [ajusteCampos, setAjusteCampos] = useState({ valor_hora: true, valor_hora_excedente: true, hora_minima: true, horas_contratadas: true });
  // Aditivos
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [aditivoFormOpen, setAditivoFormOpen] = useState(false);
  const [editingAditivo, setEditingAditivo] = useState<Aditivo | null>(null);
  const [aditivoForm, setAditivoForm] = useState<AditivoForm>({ numero: 1, data_inicio: "", data_fim: "", motivo: "", observacoes: "", equipamentos: [] });
  // Aditivos por contrato (para exibição na tabela)
  const [aditivosPorContrato, setAditivosPorContrato] = useState<Record<string, Aditivo[]>>({});
  // Prorrogação
  const [prorrogacaoForm, setProrrogacaoForm] = useState({ nova_data_fim: "", motivo: "" });
  // Finalizar contrato
  const [finalizarDialogOpen, setFinalizarDialogOpen] = useState(false);
  const [finalizarContrato, setFinalizarContrato] = useState<Contrato | null>(null);
  const [finalizarForm, setFinalizarForm] = useState({ data_encerramento: "", motivo: "" });
  const { toast } = useToast();
  const [sortCol, setSortCol] = useState("empresa");
  const [sortAsc, setSortAsc] = useState(true);
  const toggleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };
  // --- Melhorias: Filtros avançados ---
  const [filterStatus, setFilterStatus] = useState<"todos" | "Ativo" | "Encerrado" | "Suspenso">("todos");
  const [filterObra, setFilterObra] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  // --- Melhorias: Delete confirmation ---
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // --- Melhorias: Duplicar contrato ---
  const [duplicating, setDuplicating] = useState(false);
  // --- Melhorias: Painel expandível ---
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  // --- Melhorias: Rentabilidade no dashboard ---
  const [dashboardFaturamento, setDashboardFaturamento] = useState<{ valorFaturado: number; valorPendente: number; faturas: any[] }>({ valorFaturado: 0, valorPendente: 0, faturas: [] });
  // --- Melhorias: Observação com tag ---
  const [novaObsTag, setNovaObsTag] = useState<"Comercial" | "Operacional" | "Financeiro" | "Jurídico">("Operacional");
  const [novaObsTexto, setNovaObsTexto] = useState("");

  const fetchData = async () => {
    const [contratosRes, empresasRes, equipRes, ceRes] = await Promise.all([
      supabase.from("contratos").select("*").order("created_at", { ascending: false }),
      supabase.from("empresas").select("id, nome, cnpj, razao_social, nome_fantasia, inscricao_estadual, inscricao_municipal, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, contato, telefone, email, atividade_principal, status, obra"),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie, status"),
      supabase.from("contratos_equipamentos").select("*")
    ]);

    const empresasMap = new Map((empresasRes.data || []).map(e => [e.id, e]));
    const equipMap = new Map((equipRes.data || []).map(e => [e.id, e]));

    const ceList = (ceRes.data || []).map(ce => ({
      ...ce,
      equipamentos: equipMap.get(ce.equipamento_id) || null
    }));

    const contratosData = (contratosRes.data || []).map(c => ({
      ...c,
      empresas: empresasMap.get(c.empresa_id) || null,
      equipamentos: equipMap.get(c.equipamento_id) || null,
      contratos_equipamentos: ceList.filter(ce => ce.contrato_id === c.id)
    }));

    setItems(contratosData as unknown as Contrato[]);
    setEmpresas((empresasRes.data || []).filter(e => e.status === "Ativa") as any);
    setEquipamentos(equipRes.data as Equipamento[]);

    if (contratosData.length > 0) {
      const contratoIds = contratosData.map((c: any) => c.id);
      const [aditivosRes, aeRes] = await Promise.all([
        supabase.from("contratos_aditivos").select("*").in("contrato_id", contratoIds).order("numero", { ascending: true }),
        supabase.from("aditivos_equipamentos").select("*")
      ]);

      const allAditivos = aditivosRes.data || [];
      const allAditivosEquips = aeRes.data || [];

      const grouped: Record<string, Aditivo[]> = {};
      for (const ad of allAditivos) {
        const eqs = allAditivosEquips.filter(ae => ae.aditivo_id === ad.id);
        const aditivo: Aditivo = { ...ad, observacoes: ad.observacoes || "", aditivos_equipamentos: eqs };
        if (!grouped[ad.contrato_id]) grouped[ad.contrato_id] = [];
        grouped[ad.contrato_id].push(aditivo);
      }
      setAditivosPorContrato(grouped);
    } else {
      setAditivosPorContrato({});
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchSingleContractWithJoins = async (contratoId: string) => {
    const [cRes, ceRes, empRes, equipRes] = await Promise.all([
      supabase.from("contratos").select("*").eq("id", contratoId).single(),
      supabase.from("contratos_equipamentos").select("*").eq("contrato_id", contratoId),
      supabase.from("empresas").select("*"),
      supabase.from("equipamentos").select("*")
    ]);

    if (!cRes.data) return null;

    const empMap = new Map((empRes.data || []).map(e => [e.id, e]));
    const equipMap = new Map((equipRes.data || []).map(e => [e.id, e]));

    const ceList = (ceRes.data || []).map(ce => ({
      ...ce,
      equipamentos: equipMap.get(ce.equipamento_id) || null
    }));

    return {
      ...cRes.data,
      empresas: empMap.get(cRes.data.empresa_id) || null,
      equipamentos: equipMap.get(cRes.data.equipamento_id) || null,
      contratos_equipamentos: ceList
    };
  };

  const uploadMovementPDFToGDrive = async (contratoId: string) => {
    const cachedToken = localStorage.getItem("gdrive_access_token");
    const expiresAtStr = localStorage.getItem("gdrive_token_expires_at");
    const isTokenValid = cachedToken && expiresAtStr && parseInt(expiresAtStr) > Date.now();
    if (!isTokenValid) {
      console.warn("Google Drive not connected or token expired. Skipping auto PDF sync.");
      return;
    }

    try {
      const fullContract = await fetchSingleContractWithJoins(contratoId);
      if (!fullContract) return;

      if (!isAfterDec2025(fullContract.created_at)) {
        console.log("Contract created before Dec 2025. Skipping auto PDF sync.");
        return;
      }


      const { gdriveListFiles, gdriveCreateFolder, gdriveUploadFile } = await import("@/lib/gdrive");
      
      let folderId = fullContract.gdrive_folder_id;
      let comFolderId = "";

      if (!folderId) {
        // Create root & Client & Contract folder hierarchy
        const { data: configData } = await supabase.from("gdrive_config").select("*").order("created_at", { ascending: false });
        let rootId = configData && configData.length > 0 ? configData[0].root_folder_id : null;
        if (!rootId) {
          const rootFolder = await gdriveCreateFolder("Dossiê Busato Locações", null, cachedToken);
          rootId = rootFolder.id;
          if (configData && configData.length > 0) {
            await supabase.from("gdrive_config").update({ root_folder_id: rootId }).eq("id", configData[0].id);
          } else {
            await supabase.from("gdrive_config").insert({ client_id: "", root_folder_id: rootId });
          }
        }

        const clientName = fullContract.empresas?.nome || "Cliente Avulso";
        const contractLabel = `Contrato - ID ${fullContract.id.slice(0, 8)}`;

        const rootFiles = await gdriveListFiles(rootId, cachedToken);
        const clientFolderName = `Cliente - ${clientName}`;
        let clientFolder = rootFiles.find(f => f.name === clientFolderName && f.mimeType === "application/vnd.google-apps.folder");
        
        let clientFolderId = "";
        if (clientFolder) {
          clientFolderId = clientFolder.id;
        } else {
          const newClientFolder = await gdriveCreateFolder(clientFolderName, rootId, cachedToken);
          clientFolderId = newClientFolder.id;
        }

        const contractFolderName = `${contractLabel}`;
        const contractFolder = await gdriveCreateFolder(contractFolderName, clientFolderId, cachedToken);
        folderId = contractFolder.id;

        const subfolders = ["1. Comercial", "2. Operacional", "3. Financeiro", "4. Seguros"];
        await Promise.all(subfolders.map(async (name) => {
          const sf = await gdriveCreateFolder(name, contractFolder.id, cachedToken);
          if (name.startsWith("1.")) comFolderId = sf.id;
        }));

        await supabase.from("contratos").update({ gdrive_folder_id: folderId }).eq("id", contratoId);
      } else {
        // Find existing 1. Comercial subfolder
        const subfolders = await gdriveListFiles(folderId, cachedToken);
        const matched = subfolders.find(f => f.name.startsWith("1.") && f.mimeType === "application/vnd.google-apps.folder");
        if (matched) {
          comFolderId = matched.id;
        } else {
          const newFolder = await gdriveCreateFolder("1. Comercial", folderId, cachedToken);
          comFolderId = newFolder.id;
        }
      }

      if (comFolderId) {
        // Fetch all equipment for generating the PDF
        const { data: allEquips } = await supabase.from("equipamentos").select("*");
        const { generateDetailedPDFDoc } = await import("@/lib/contractExportUtils");
        const doc = await generateDetailedPDFDoc([fullContract], allEquips || []);
        const blob = doc.output("blob");
        
        const clientName = fullContract.empresas?.nome || "Cliente";
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `Movimentacao_Contrato_${clientName.replace(/\s+/g, "_")}_${timestamp}.pdf`;

        await gdriveUploadFile(blob, filename, comFolderId, cachedToken);
        toast({ title: "Sincronizado", description: "Movimentação registrada e salva no Google Drive com sucesso!" });
      }
    } catch (error: any) {
      console.error("Erro ao sincronizar movimentação de contrato:", error);
      toast({ title: "Erro de Sincronização", description: "A alteração foi salva no banco, mas houve falha ao enviar o PDF da movimentação para o Google Drive: " + error.message, variant: "destructive" });
    }
  };

  const getContratoEquipamentos = (item: Contrato): ContratoEquipamento[] => {
    const fromJunction = (item.contratos_equipamentos || []).filter(ce => ce.equipamentos);
    if (fromJunction.length > 0) return fromJunction;
    if (item.equipamentos) return [{ id: "", equipamento_id: item.equipamento_id, valor_hora: item.valor_hora, horas_contratadas: item.horas_contratadas, valor_hora_excedente: 0, hora_minima: 0, data_entrega: null, data_devolucao: null, equipamentos: item.equipamentos }];
    return [];
  };

  const getEquipamentosConsolidados = (
    contrato: Contrato | null,
    contratoAditivos: Aditivo[] = [],
    options?: { excludeReturned?: boolean; referenceDate?: string }
  ): ContratoEquipamento[] => {
    if (!contrato) return [];

    const equipMap = new Map<string, ContratoEquipamento>();
    const baseEquipamentos = getContratoEquipamentos(contrato);

    baseEquipamentos.forEach(ce => {
      const valor_hora = Number(ce.valor_hora) > 0 ? Number(ce.valor_hora) : Number(contrato.valor_hora || 0);
      const horas_contratadas = Number(ce.horas_contratadas) > 0 ? Number(ce.horas_contratadas) : Number(contrato.horas_contratadas || 0);
      const valor_hora_excedente = Number(ce.valor_hora_excedente) > 0 ? Number(ce.valor_hora_excedente) : valor_hora * 1.25;
      const hora_minima = Number(ce.hora_minima) > 0 ? Number(ce.hora_minima) : 0;

      equipMap.set(ce.equipamento_id, {
        ...ce,
        valor_hora,
        horas_contratadas,
        valor_hora_excedente,
        hora_minima,
      });
    });

    [...contratoAditivos]
      .sort((a, b) => a.numero - b.numero)
      .forEach(aditivo => {
        (aditivo.aditivos_equipamentos || []).forEach(ae => {
          const eq = equipamentos.find(e => e.id === ae.equipamento_id);
          const fallback = equipMap.get(ae.equipamento_id);
          const equipamento = eq || fallback?.equipamentos;
          if (!equipamento) return;

          const valor_hora = Number(ae.valor_hora) > 0
            ? Number(ae.valor_hora)
            : fallback && Number(fallback.valor_hora) > 0
              ? Number(fallback.valor_hora)
              : Number(contrato.valor_hora || 0);

          const horas_contratadas = Number(ae.horas_contratadas) > 0
            ? Number(ae.horas_contratadas)
            : fallback && Number(fallback.horas_contratadas) > 0
              ? Number(fallback.horas_contratadas)
              : Number(contrato.horas_contratadas || 0);

          const valor_hora_excedente = Number(ae.valor_hora_excedente) > 0
            ? Number(ae.valor_hora_excedente)
            : fallback && Number(fallback.valor_hora_excedente) > 0
              ? Number(fallback.valor_hora_excedente)
              : valor_hora * 1.25;

          const hora_minima = Number(ae.hora_minima) > 0
            ? Number(ae.hora_minima)
            : fallback && Number(fallback.hora_minima) > 0
              ? Number(fallback.hora_minima)
              : 0;

          equipMap.set(ae.equipamento_id, {
            id: ae.id,
            equipamento_id: ae.equipamento_id,
            valor_hora,
            horas_contratadas,
            valor_hora_excedente,
            hora_minima,
            data_entrega: ae.data_entrega,
            data_devolucao: ae.data_devolucao,
            equipamentos: equipamento,
          });
        });
      });

    let result = Array.from(equipMap.values());

    if (options?.excludeReturned) {
      const referenceDate = options.referenceDate || new Date().toISOString().slice(0, 10);
      result = result.filter(ce => !ce.data_devolucao || ce.data_devolucao > referenceDate);
    }

    return result;
  };

  const getEquipamentosList = (item: Contrato): Equipamento[] => {
    return getContratoEquipamentos(item).map(ce => ce.equipamentos);
  };

  // Check alerts across all active contracts
  const getAlerts = useCallback(() => {
    const alerts: { contrato: Contrato; ce: ContratoEquipamento; percentual: number }[] = [];
    items.filter(i => i.status === "Ativo").forEach(item => {
      const ces = getContratoEquipamentos(item);
      ces.forEach(ce => {
        // We'll check alerts based on cached usage data if dashboard was opened
        // For the table view, we show a warning icon if horas_contratadas > 0
      });
    });
    return alerts;
  }, [items]);

  const openDashboard = async (item: Contrato) => {
    setDashboardContrato(item);
    setDashboardOpen(true);
    setDashboardLoading(true);

    // Collect all equipment: from contract + from aditivos
    const ces = getContratoEquipamentos(item);
    const contratoAditivos = aditivosPorContrato[item.id] || [];
    
    // Build a combined list with source info
    interface DashEquip {
      equipamento_id: string;
      equipamento: Equipamento;
      valor_hora: number;
      horas_contratadas: number;
      origem: string;
    }
    
    const allEquips: DashEquip[] = [];
    const seenIds = new Set<string>();
    
    // Add contract equipment
    for (const ce of ces) {
      seenIds.add(ce.equipamento_id);
      allEquips.push({
        equipamento_id: ce.equipamento_id,
        equipamento: ce.equipamentos,
        valor_hora: Number(ce.valor_hora),
        horas_contratadas: Number(ce.horas_contratadas),
        origem: "Contrato",
      });
    }
    
    // Add aditivo equipment (update existing or add new)
    for (const aditivo of contratoAditivos) {
      for (const ae of (aditivo.aditivos_equipamentos || [])) {
        const eq = equipamentos.find(e => e.id === ae.equipamento_id);
        if (!eq) continue;
        const existing = allEquips.find(e => e.equipamento_id === ae.equipamento_id);
        if (existing) {
          // Update with latest aditivo values
          existing.valor_hora = Number(ae.valor_hora);
          existing.horas_contratadas = Number(ae.horas_contratadas);
          existing.origem = `Aditivo #${aditivo.numero}`;
        } else {
          allEquips.push({
            equipamento_id: ae.equipamento_id,
            equipamento: eq,
            valor_hora: Number(ae.valor_hora),
            horas_contratadas: Number(ae.horas_contratadas),
            origem: `Aditivo #${aditivo.numero}`,
          });
        }
      }
    }

    const usages: EquipUsage[] = [];

    for (const de of allEquips) {
      const { data: medicoes } = await supabase
        .from("medicoes")
        .select("horas_trabalhadas, horimetro_inicial, horimetro_final")
        .eq("equipamento_id", de.equipamento_id)
        .gte("data", item.data_inicio)
        .lte("data", item.data_fim);

      const horasUtilizadas = (medicoes || []).reduce((sum, m) => {
        const h = m.horas_trabalhadas != null ? Number(m.horas_trabalhadas) : (Number(m.horimetro_final) - Number(m.horimetro_inicial));
        return sum + h;
      }, 0);

      const horasContratadas = de.horas_contratadas;
      const valorHora = de.valor_hora;
      const percentual = horasContratadas > 0 ? (horasUtilizadas / horasContratadas) * 100 : 0;

      usages.push({
        equipamento_id: de.equipamento_id,
        equipamento: de.equipamento,
        valor_hora: valorHora,
        horas_contratadas: horasContratadas,
        horas_utilizadas: horasUtilizadas,
        custo_real: horasUtilizadas * valorHora,
        custo_contratado: horasContratadas * valorHora,
        percentual,
        origem: de.origem,
      });
    }

    setEquipUsages(usages);

    // --- Rentabilidade: buscar faturamento do contrato ---
    const { data: faturas } = await supabase
      .from("faturamento")
      .select("id, periodo, status, valor_total, emissao")
      .eq("contrato_id", item.id)
      .order("emissao", { ascending: false });

    const todasFaturas = faturas || [];
    const valorFaturado = todasFaturas
      .filter(f => ["Aprovado", "Pago"].includes(f.status))
      .reduce((sum, f) => sum + Number(f.valor_total), 0);
    const valorPendente = todasFaturas
      .filter(f => ["Pendente", "Medido"].includes(f.status))
      .reduce((sum, f) => sum + Number(f.valor_total), 0);
    setDashboardFaturamento({ valorFaturado, valorPendente, faturas: todasFaturas });

    setDashboardLoading(false);
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return "bg-destructive";
    if (pct >= 80) return "bg-warning";
    return "bg-success";
  };

  const getStatusLabel = (pct: number) => {
    if (pct >= 100) return { label: "Limite Excedido", className: "bg-destructive text-destructive-foreground" };
    if (pct >= 80) return { label: "Próximo do Limite", className: "bg-warning text-warning-foreground" };
    return { label: "Normal", className: "bg-success text-success-foreground" };
  };

  // --- Helper: número do contrato (gerado a partir do índice na lista por ano de criação) ---
  const getNumeroContrato = (item: Contrato): string => {
    const ano = item.created_at ? new Date(item.created_at).getFullYear() : new Date().getFullYear();
    // Sort all items by created_at to get a stable sequential number
    const sorted = [...items].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const doAno = sorted.filter(i => new Date(i.created_at).getFullYear() === ano);
    const seq = doAno.findIndex(i => i.id === item.id) + 1;
    return `CT-${ano}-${String(seq).padStart(3, "0")}`;
  };

  // --- Helper: salvar observação estruturada ---
  const handleSalvarObservacao = async () => {
    if (!ajustesContrato || !novaObsTexto.trim()) return;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const linha = `[${hoje}][${novaObsTag}] ${novaObsTexto.trim()}`;
    const obsAtual = ajustesContrato.observacoes || "";
    const novaObs = obsAtual ? `${obsAtual}\n${linha}` : linha;
    const { error } = await supabase.from("contratos").update({ observacoes: novaObs }).eq("id", ajustesContrato.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setNovaObsTexto("");
    toast({ title: "Observação salva!", description: "" });
    fetchData();
    // Atualizar o contrato local
    setAjustesContrato(prev => prev ? { ...prev, observacoes: novaObs } : prev);
  };

  // --- Helper: parsear observações estruturadas ---
  const parseObservacoes = (obs: string | null): { data: string; tag: string; texto: string }[] => {
    if (!obs) return [];
    return obs.split("\n").map(linha => {
      const match = linha.match(/^\[(.*?)\]\[(.*?)\]\s*(.*)$/);
      if (match) return { data: match[1], tag: match[2], texto: match[3] };
      return { data: "", tag: "Geral", texto: linha };
    }).filter(o => o.texto.trim());
  };

  // --- Helpers de vencimento / valor / progresso ---
  const getDiasRestantes = (dataFim: string): number => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fim = new Date(dataFim + "T00:00:00");
    return Math.round((fim.getTime() - hoje.getTime()) / 86400000);
  };

  const getVencimentoInfo = (item: Contrato) => {
    if (item.status !== "Ativo") return { label: "", color: "", badge: "" };
    const dias = getDiasRestantes(item.data_fim);
    if (dias < 0) return { label: "Vencido", color: "text-destructive", badge: "bg-destructive/10 text-destructive border-destructive/30" };
    if (dias <= 15) return { label: `${dias}d restantes`, color: "text-destructive", badge: "bg-destructive/10 text-destructive border-destructive/30 animate-pulse" };
    if (dias <= 60) return { label: `${dias}d restantes`, color: "text-yellow-600 dark:text-yellow-400", badge: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-400/30" };
    return { label: `${dias}d restantes`, color: "text-muted-foreground", badge: "" };
  };

  const getPeriodoProgresso = (dataInicio: string, dataFim: string): number => {
    const inicio = new Date(dataInicio + "T00:00:00").getTime();
    const fim = new Date(dataFim + "T00:00:00").getTime();
    const hoje = new Date().getTime();
    if (hoje <= inicio) return 0;
    if (hoje >= fim) return 100;
    return Math.round(((hoje - inicio) / (fim - inicio)) * 100);
  };

  const getValorContratado = (item: Contrato): number => {
    const ces = getContratoEquipamentos(item);
    return ces.reduce((sum, ce) => sum + (Number(ce.valor_hora) * Number(ce.horas_contratadas)), 0);
  };

  const handleDuplicar = async (item: Contrato) => {
    setDuplicating(true);
    try {
      const ces = getContratoEquipamentos(item);
      const newId = crypto.randomUUID();
      const { error } = await supabase.from("contratos").insert({
        ...item,
        id: newId,
        status: "Ativo",
        data_inicio: "",
        data_fim: "",
        observacoes: `[Duplicado de contrato de ${item.empresas?.nome || ""} — ${formatLocalDate(item.data_inicio)} a ${formatLocalDate(item.data_fim)}]`,
        created_at: undefined,
      });
      if (error) throw error;
      const junctionRows = ces.map(ce => ({
        id: crypto.randomUUID(),
        contrato_id: newId,
        equipamento_id: ce.equipamento_id,
        valor_hora: Number(ce.valor_hora),
        horas_contratadas: Number(ce.horas_contratadas),
        valor_hora_excedente: Number(ce.valor_hora_excedente || 0),
        hora_minima: Number(ce.hora_minima || 0),
        data_entrega: null,
        data_devolucao: null,
      }));
      if (junctionRows.length > 0) {
        await supabase.from("contratos_equipamentos").insert(junctionRows);
      }
      toast({ title: "Contrato duplicado!", description: "Agora edite as datas do novo contrato." });
      await fetchData();
      // Open edit dialog for the new contract
      const novoContrato = items.find(i => i.id === newId) || { ...item, id: newId, status: "Ativo", data_inicio: "", data_fim: "" } as Contrato;
      openEdit(novoContrato);
    } catch (err: any) {
      toast({ title: "Erro ao duplicar", description: err.message, variant: "destructive" });
    }
    setDuplicating(false);
  };

  // --- Filtragem avançada ---
  const filtered = useMemo(() => {
    return items.filter(i => {
      // Text search (empresa, CNPJ, modelo/tag do equipamento base e aditivos)
      const q = search.toLowerCase();
      const allAditivoEquips = (aditivosPorContrato[i.id] || []).flatMap(ad => ad.aditivos_equipamentos || []);
      const matchText = !q
        || i.empresas?.nome?.toLowerCase().includes(q)
        || i.empresas?.cnpj?.includes(q)
        || i.empresas?.obra?.toLowerCase().includes(q)
        || getEquipamentosList(i).some(eq => eq.modelo?.toLowerCase().includes(q) || eq.tag_placa?.toLowerCase().includes(q))
        || allAditivoEquips.some(ae => {
            const eq = equipamentos.find(e => e.id === ae.equipamento_id);
            return eq?.modelo?.toLowerCase().includes(q) || eq?.tag_placa?.toLowerCase().includes(q);
          });

      // Status filter
      const matchStatus = filterStatus === "todos" || i.status === filterStatus;

      // Obra filter
      const matchObra = !filterObra || i.empresas?.obra?.toLowerCase().includes(filterObra.toLowerCase());

      // Date range filter
      const matchDataInicio = !filterDataInicio || i.data_inicio >= filterDataInicio;
      const matchDataFim = !filterDataFim || i.data_fim <= filterDataFim;

      return matchText && matchStatus && matchObra && matchDataInicio && matchDataFim;
    });
  }, [items, search, filterStatus, filterObra, filterDataInicio, filterDataFim, aditivosPorContrato, equipamentos]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "empresa": cmp = (a.empresas?.nome || "").localeCompare(b.empresas?.nome || ""); break;
        case "periodo": cmp = a.data_inicio.localeCompare(b.data_inicio); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortAsc]);

  // --- KPIs ---
  const kpis = useMemo(() => {
    const ativos = items.filter(i => i.status === "Ativo");
    const vencendo = ativos.filter(i => { const d = getDiasRestantes(i.data_fim); return d >= 0 && d <= 30; });
    const valorTotal = ativos.reduce((sum, i) => sum + getValorContratado(i), 0);
    return { total: items.length, ativos: ativos.length, vencendo: vencendo.length, valorTotal };
  }, [items]);

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };

  const getExportData = () => {
    const data = filtered.filter(i => selected.size === 0 || selected.has(i.id));
    const headers = ["Empresa", "CNPJ", "Obra", "Equipamento", "Tag", "Valor/Hora (R$)", "Horas Contratadas", "Valor Total (R$)", "Início", "Fim", "Dias Restantes", "Qtd. Aditivos", "Status"];
    const rows: string[][] = [];
    data.forEach(i => {
      const ces = getContratoEquipamentos(i);
      const valorTotal = getValorContratado(i);
      const diasRestantes = getDiasRestantes(i.data_fim);
      const qtdAditivos = (aditivosPorContrato[i.id] || []).length;
      ces.forEach(ce => {
        rows.push([
          i.empresas?.nome || "",
          i.empresas?.cnpj || "",
          i.empresas?.obra || "—",
          `${ce.equipamentos.tipo} ${ce.equipamentos.modelo}`,
          ce.equipamentos.tag_placa || "—",
          Number(ce.valor_hora).toFixed(2),
          String(ce.horas_contratadas),
          valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          i.data_inicio,
          i.data_fim,
          i.status === "Encerrado" ? "Encerrado" : String(diasRestantes),
          String(qtdAditivos),
          i.status,
        ]);
      });
    });
    return { title: "Relatório de Contratos", headers, rows, filename: `contratos_${new Date().toISOString().slice(0,10)}` };
  };

  const exportSimplePDFWrapper = async () => {
    const data = filtered.filter(i => selected.size === 0 || selected.has(i.id));
    if (data.length === 0) return;
    const { exportSimplePDF } = await import("@/lib/contractExportUtils");
    await exportSimplePDF(data, equipamentos);
  };

  const exportDetailedPDFWrapper = async () => {
    const data = filtered.filter(i => selected.size === 0 || selected.has(i.id));
    if (data.length === 0) return;
    const { exportDetailedPDF } = await import("@/lib/contractExportUtils");
    await exportDetailedPDF(data, equipamentos);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setFormEquipamentos([]); setDialogOpen(true); };
  const openEdit = (item: Contrato) => {
    setEditing(item);
    const ces = getContratoEquipamentos(item);
    setFormEquipamentos(ces.map(ce => ({ equipamento_id: ce.equipamento_id, valor_hora: Number(ce.valor_hora), horas_contratadas: Number(ce.horas_contratadas), valor_hora_excedente: Number(ce.valor_hora_excedente || 0), hora_minima: Number(ce.hora_minima || 0), data_entrega: ce.data_entrega || "", data_devolucao: ce.data_devolucao || "" })));
    setForm({ empresa_id: item.empresa_id, equipamento_id: item.equipamento_id, valor_hora: item.valor_hora, horas_contratadas: item.horas_contratadas, data_inicio: item.data_inicio, data_fim: item.data_fim, observacoes: item.observacoes || "", status: item.status, dia_medicao_inicio: (item as any).dia_medicao_inicio || 1, dia_medicao_fim: (item as any).dia_medicao_fim || 30, prazo_faturamento: (item as any).prazo_faturamento || 30, tipo_medicao: (item as any).tipo_medicao || "horas" });
    setDialogOpen(true);
  };

  const addEquipamento = (equipId: string) => {
    if (equipId && !formEquipamentos.some(fe => fe.equipamento_id === equipId)) {
      setFormEquipamentos(prev => [...prev, { equipamento_id: equipId, valor_hora: 0, horas_contratadas: 0, valor_hora_excedente: 0, hora_minima: 0, data_entrega: "", data_devolucao: "" }]);
    }
  };

  const removeEquipamento = (equipId: string) => {
    setFormEquipamentos(prev => prev.filter(fe => fe.equipamento_id !== equipId));
  };

  const updateEquipItem = (equipId: string, field: "valor_hora" | "horas_contratadas" | "valor_hora_excedente" | "hora_minima", value: number) => {
    setFormEquipamentos(prev => prev.map(fe => fe.equipamento_id === equipId ? { ...fe, [field]: value } : fe));
  };
  const updateEquipItemStr = (equipId: string, field: "data_entrega" | "data_devolucao", value: string) => {
    setFormEquipamentos(prev => prev.map(fe => fe.equipamento_id === equipId ? { ...fe, [field]: value } : fe));
  };

  const handleSave = async () => {
    if (!form.empresa_id || formEquipamentos.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Selecione a empresa e pelo menos um equipamento.", variant: "destructive" });
      return;
    }
    const mainEquipId = formEquipamentos[0].equipamento_id;
    const payload = { ...form, equipamento_id: mainEquipId, valor_hora: Number(formEquipamentos[0].valor_hora), horas_contratadas: Number(formEquipamentos[0].horas_contratadas), dia_medicao_inicio: Number(form.dia_medicao_inicio), dia_medicao_fim: Number(form.dia_medicao_fim), prazo_faturamento: Number(form.prazo_faturamento), tipo_medicao: form.tipo_medicao };

    let contratoId: string;

    if (editing) {
      const { error } = await supabase.from("contratos").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      contratoId = editing.id;
      await supabase.from("contratos_equipamentos").delete().eq("contrato_id", contratoId);
    } else {
      const newId = crypto.randomUUID();
      const { data, error } = await supabase.from("contratos").insert({ ...payload, id: newId }).select("id").single();
      if (error || (!data && !newId)) { toast({ title: "Erro", description: error?.message || "Erro ao criar contrato", variant: "destructive" }); return; }
      contratoId = data?.id || newId;
    }

    const junctionRows = formEquipamentos.map(fe => ({
      id: crypto.randomUUID(),
      contrato_id: contratoId,
      equipamento_id: fe.equipamento_id,
      valor_hora: Number(fe.valor_hora),
      horas_contratadas: Number(fe.horas_contratadas),
      valor_hora_excedente: Number(fe.valor_hora_excedente),
      hora_minima: Number(fe.hora_minima),
      data_entrega: fe.data_entrega || null,
      data_devolucao: fe.data_devolucao || null,
    }));
    const { error: jError } = await supabase.from("contratos_equipamentos").insert(junctionRows);
    if (jError) { toast({ title: "Aviso", description: "Contrato salvo, mas houve erro ao associar equipamentos: " + jError.message, variant: "destructive" }); }

    if (editing) {
      await syncAditivosEquipamentos(contratoId, "", 0, junctionRows);
    }

    setDialogOpen(false);
    fetchData();
    uploadMovementPDFToGDrive(contratoId);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setDeleteConfirmId(null);
    fetchData();
  };

  const statusColor = (s: string) => {
    if (s === "Ativo") return "bg-success text-success-foreground";
    if (s === "Encerrado") return "bg-muted text-muted-foreground";
    return "bg-warning text-warning-foreground";
  };

  const availableEquipamentos = equipamentos.filter(e => e.status === "Ativo" && !formEquipamentos.some(fe => fe.equipamento_id === e.id));

  const safeParseLocalDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const parseLocalDate = (dateStr: string | null | undefined): Date => {
    return safeParseLocalDate(dateStr) || new Date(NaN);
  };

  const formatLocalDate = (dateStr: string | null | undefined): string => {
    const d = safeParseLocalDate(dateStr);
    if (!d) return "—";
    return d.toLocaleDateString("pt-BR");
  };

  const fmt = (v: number | null | undefined) => {
    if (v === null || v === undefined || isNaN(Number(v))) return "—";
    return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  // --- Ajustes Temporários ---
  const openAjustes = async (item: Contrato) => {
    setAjustesContrato(item);
    setAjustesOpen(true);
    const { data } = await supabase
      .from("contratos_equipamentos_ajustes")
      .select("*")
      .eq("contrato_id", item.id)
      .order("data_inicio", { ascending: false });
    setAjustes((data || []) as AjusteTemporario[]);
  };

  // Helper: get ALL equipment (base + aditivos) for adjustment context
  // If excludeReturned=true, filters out equipment with data_devolucao <= hoje
  const getAllEquipForAjuste = (contrato: Contrato | null, excludeReturned = false): ContratoEquipamento[] => {
    if (!contrato) return [];
    const contratoAditivos = aditivos.filter(a => a.contrato_id === contrato.id);
    return getEquipamentosConsolidados(contrato, contratoAditivos, {
      excludeReturned,
      referenceDate: new Date().toISOString().slice(0, 10),
    });
  };

  // Helper: get the max end date from contract or latest aditivo
  const getMaxDataFim = (contrato: Contrato | null): string => {
    if (!contrato) return "";
    let maxDate = contrato.data_fim;
    const contratoAditivos = aditivos.filter(a => a.contrato_id === contrato.id);
    contratoAditivos.forEach(ad => {
      if (ad.data_fim > maxDate) maxDate = ad.data_fim;
    });
    return maxDate;
  };

  const openNewAjuste = (equipId?: string) => {
    setEditingAjuste(null);
    setAjusteTodos(false);
    setAjusteCampos({ valor_hora: true, valor_hora_excedente: true, hora_minima: true, horas_contratadas: true });
    const maxDataFim = getMaxDataFim(ajustesContrato);
    setAjusteForm({
      equipamento_ids: equipId ? [equipId] : [],
      valor_hora: 0,
      valor_hora_excedente: 0,
      hora_minima: 0,
      horas_contratadas: 0,
      data_inicio: "",
      data_fim: maxDataFim,
      motivo: "",
      desconto_percentual: 0,
    });
    setAjusteFormOpen(true);
  };

  const openEditAjuste = (aj: AjusteTemporario) => {
    setEditingAjuste(aj);
    setAjusteTodos(false);
    
    const valorHoraChecked = aj.valor_hora !== null && aj.valor_hora !== undefined;
    const valorHoraExcedenteChecked = aj.valor_hora_excedente !== null && aj.valor_hora_excedente !== undefined;
    const horaMinimaChecked = aj.hora_minima !== null && aj.hora_minima !== undefined;
    const horasContratadasChecked = aj.horas_contratadas !== null && aj.horas_contratadas !== undefined;

    setAjusteCampos({
      valor_hora: valorHoraChecked,
      valor_hora_excedente: valorHoraExcedenteChecked,
      hora_minima: horaMinimaChecked,
      horas_contratadas: horasContratadasChecked,
    });

    const allEquip = getAllEquipForAjuste(ajustesContrato);
    const ce = allEquip.find(c => c.equipamento_id === aj.equipamento_id);
    const origValorHora = ce ? Number(ce.valor_hora) : 0;
    const origValorExcedente = ce ? Number(ce.valor_hora_excedente) : 0;
    const origHoraMinima = ce ? Number(ce.hora_minima) : 0;
    const origHorasContratadas = ce ? Number(ce.horas_contratadas) : 0;

    setAjusteForm({
      equipamento_ids: [aj.equipamento_id],
      valor_hora: valorHoraChecked ? aj.valor_hora : origValorHora,
      valor_hora_excedente: valorHoraExcedenteChecked ? aj.valor_hora_excedente : origValorExcedente,
      hora_minima: horaMinimaChecked ? aj.hora_minima : origHoraMinima,
      horas_contratadas: horasContratadasChecked ? aj.horas_contratadas : origHorasContratadas,
      data_inicio: aj.data_inicio,
      data_fim: aj.data_fim,
      motivo: (aj.motivo || "").replace("[LOTE] ", "").replace("[LOTE]", ""),
      desconto_percentual: Number(aj.desconto_percentual) || 0,
    });
    setAjusteFormOpen(true);
  };

  const handleSaveAjuste = async () => {
    if (!ajustesContrato || !ajusteForm.data_inicio) {
      toast({ title: "Campos obrigatórios", description: "Preencha a data de início.", variant: "destructive" });
      return;
    }
    // Auto-fill data_fim with max contract/addendum date if empty
    const dataFimFinal = ajusteForm.data_fim || getMaxDataFim(ajustesContrato);
    if (!dataFimFinal) {
      toast({ title: "Campos obrigatórios", description: "Não foi possível determinar a data de fim.", variant: "destructive" });
      return;
    }
    if (!ajusteTodos && ajusteForm.equipamento_ids.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Selecione pelo menos um equipamento.", variant: "destructive" });
      return;
    }

    if (editingAjuste) {
      // Edição: sempre individual
      const payload = {
        contrato_id: ajustesContrato.id,
        equipamento_id: ajusteForm.equipamento_ids[0],
        valor_hora: ajusteCampos.valor_hora ? Number(ajusteForm.valor_hora) : null,
        valor_hora_excedente: ajusteCampos.valor_hora_excedente ? Number(ajusteForm.valor_hora_excedente) : null,
        hora_minima: ajusteCampos.hora_minima ? Number(ajusteForm.hora_minima) : null,
        horas_contratadas: ajusteCampos.horas_contratadas ? Number(ajusteForm.horas_contratadas) : null,
        data_inicio: ajusteForm.data_inicio,
        data_fim: dataFimFinal,
        motivo: ajusteForm.motivo,
        desconto_percentual: Number(ajusteForm.desconto_percentual) || 0,
      };
      const { error } = await supabase.from("contratos_equipamentos_ajustes").update(payload).eq("id", editingAjuste.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else if (ajusteTodos) {
      // Aplicar a todos os equipamentos do contrato (base + aditivos) ativos no período do ajuste
      const ajInicio = parseLocalDate(ajusteForm.data_inicio);
      const ajFim = parseLocalDate(dataFimFinal);

      const equipMap = new Map<string, { valor_hora: number; valor_hora_excedente: number; hora_minima: number; horas_contratadas: number }>();

      const ces = getContratoEquipamentos(ajustesContrato);
      ces.forEach(ce => {
        const entrega = ce.data_entrega ? parseLocalDate(ce.data_entrega) : null;
        const devolucao = ce.data_devolucao ? parseLocalDate(ce.data_devolucao) : null;
        if (entrega && entrega > ajFim) return;
        if (devolucao && devolucao < ajInicio) return;
        equipMap.set(ce.equipamento_id, {
          valor_hora: Number(ce.valor_hora),
          valor_hora_excedente: Number(ce.valor_hora_excedente),
          hora_minima: Number(ce.hora_minima),
          horas_contratadas: Number(ce.horas_contratadas),
        });
      });

      const contratoAditivos = aditivos.filter(a => a.contrato_id === ajustesContrato.id);
      contratoAditivos.sort((a, b) => a.numero - b.numero);
      contratoAditivos.forEach(aditivo => {
        const adInicio = parseLocalDate(aditivo.data_inicio);
        const adFim = parseLocalDate(aditivo.data_fim);
        if (adInicio > ajFim || adFim < ajInicio) return;
        (aditivo.aditivos_equipamentos || []).forEach(ae => {
          const entrega = ae.data_entrega ? parseLocalDate(ae.data_entrega) : null;
          const devolucao = ae.data_devolucao ? parseLocalDate(ae.data_devolucao) : null;
          if (entrega && entrega > ajFim) return;
          if (devolucao && devolucao < ajInicio) return;
          equipMap.set(ae.equipamento_id, {
            valor_hora: Number(ae.valor_hora),
            valor_hora_excedente: Number(ae.valor_hora_excedente),
            hora_minima: Number(ae.hora_minima),
            horas_contratadas: Number(ae.horas_contratadas),
          });
        });
      });

      if (equipMap.size === 0) {
        toast({ title: "Nenhum equipamento", description: "Não há equipamentos ativos no período informado.", variant: "destructive" });
        return;
      }

      const rows = Array.from(equipMap.entries()).map(([eqId]) => ({
        id: crypto.randomUUID(),
        contrato_id: ajustesContrato.id,
        equipamento_id: eqId,
        valor_hora: ajusteCampos.valor_hora ? Number(ajusteForm.valor_hora) : null,
        valor_hora_excedente: ajusteCampos.valor_hora_excedente ? Number(ajusteForm.valor_hora_excedente) : null,
        hora_minima: ajusteCampos.hora_minima ? Number(ajusteForm.hora_minima) : null,
        horas_contratadas: ajusteCampos.horas_contratadas ? Number(ajusteForm.horas_contratadas) : null,
        data_inicio: ajusteForm.data_inicio,
        data_fim: dataFimFinal,
        motivo: ajusteForm.motivo ? `[LOTE] ${ajusteForm.motivo}` : "[LOTE]",
        desconto_percentual: Number(ajusteForm.desconto_percentual) || 0,
      }));
      const { error } = await supabase.from("contratos_equipamentos_ajustes").insert(rows);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      // Multi-select individual: one row per selected equipment
      const rows = ajusteForm.equipamento_ids.map(eqId => {
        return {
          id: crypto.randomUUID(),
          contrato_id: ajustesContrato.id,
          equipamento_id: eqId,
          valor_hora: ajusteCampos.valor_hora ? Number(ajusteForm.valor_hora) : null,
          valor_hora_excedente: ajusteCampos.valor_hora_excedente ? Number(ajusteForm.valor_hora_excedente) : null,
          hora_minima: ajusteCampos.hora_minima ? Number(ajusteForm.hora_minima) : null,
          horas_contratadas: ajusteCampos.horas_contratadas ? Number(ajusteForm.horas_contratadas) : null,
          data_inicio: ajusteForm.data_inicio,
          data_fim: dataFimFinal,
          motivo: ajusteForm.motivo,
          desconto_percentual: Number(ajusteForm.desconto_percentual) || 0,
        };
      });
      const { error } = await supabase.from("contratos_equipamentos_ajustes").insert(rows);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setAjusteFormOpen(false);
    openAjustes(ajustesContrato);
    if (ajustesContrato?.id) {
      uploadMovementPDFToGDrive(ajustesContrato.id);
    }
  };

  const handleDeleteAjuste = async (id: string) => {
    const { error } = await supabase.from("contratos_equipamentos_ajustes").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (ajustesContrato) openAjustes(ajustesContrato);
  };

  const isAjusteAtivo = (aj: AjusteTemporario) => {
    const hoje = new Date();
    return hoje >= new Date(aj.data_inicio) && hoje <= new Date(aj.data_fim);
  };

  // --- Aditivos ---
  const fetchAditivos = async (contratoId: string) => {
    const { data } = await supabase
      .from("contratos_aditivos")
      .select("*, aditivos_equipamentos(*)")
      .eq("contrato_id", contratoId)
      .order("numero", { ascending: true });
    setAditivos((data || []) as unknown as Aditivo[]);
  };

  const openAjustesWithAditivos = async (item: Contrato) => {
    openAjustes(item);
    fetchAditivos(item.id);
  };

  const openNewAditivo = async () => {
    if (!ajustesContrato) return;
    setEditingAditivo(null);

    const { data: freshAditivos } = await supabase
      .from("contratos_aditivos")
      .select("*, aditivos_equipamentos(*)")
      .eq("contrato_id", ajustesContrato.id)
      .order("numero", { ascending: true });

    const aditivosAtuais = (freshAditivos || []) as unknown as Aditivo[];
    setAditivos(aditivosAtuais);

    const nextNumero = aditivosAtuais.length > 0 ? Math.max(...aditivosAtuais.map(a => a.numero)) + 1 : 1;
    const hoje = new Date().toISOString().slice(0, 10);
    const equipamentosBase = getEquipamentosConsolidados(ajustesContrato, aditivosAtuais, {
      excludeReturned: true,
      referenceDate: hoje,
    }).map(ce => ({
      equipamento_id: ce.equipamento_id,
      valor_hora: Number(ce.valor_hora),
      horas_contratadas: Number(ce.horas_contratadas),
      valor_hora_excedente: Number(ce.valor_hora_excedente),
      hora_minima: Number(ce.hora_minima),
      data_entrega: ce.data_entrega || "",
      data_devolucao: ce.data_devolucao || "",
    }));

    setAditivoForm({
      numero: nextNumero,
      data_inicio: "",
      data_fim: ajustesContrato.data_fim || "",
      motivo: "",
      observacoes: "",
      equipamentos: equipamentosBase,
    });
    setAditivoFormOpen(true);
  };

  const openEditAditivo = (ad: Aditivo) => {
    setEditingAditivo(ad);
    const eqs = ad.aditivos_equipamentos || [];
    setAditivoForm({
      numero: ad.numero,
      data_inicio: ad.data_inicio,
      data_fim: ad.data_fim,
      motivo: ad.motivo,
      observacoes: ad.observacoes || "",
      equipamentos: eqs.map(ae => ({
        equipamento_id: ae.equipamento_id,
        valor_hora: Number(ae.valor_hora),
        horas_contratadas: Number(ae.horas_contratadas),
        valor_hora_excedente: Number(ae.valor_hora_excedente),
        hora_minima: Number(ae.hora_minima),
        data_entrega: ae.data_entrega || "",
        data_devolucao: ae.data_devolucao || "",
      })),
    });
    setAditivoFormOpen(true);
  };

  async function syncAditivosEquipamentos(
    contratoId: string,
    currentAditivoId: string,
    currentNumero: number,
    currentEquipamentos: any[]
  ) {
    const { data: aditivosData, error: aditivosErr } = await supabase
      .from("contratos_aditivos")
      .select("*, aditivos_equipamentos(*)")
      .eq("contrato_id", contratoId);

    if (aditivosErr || !aditivosData) {
      console.error("Error fetching aditivos for sync:", aditivosErr);
      return;
    }

    for (const eq of currentEquipamentos) {
      for (const ad of aditivosData) {
        if (ad.id === currentAditivoId) continue;

        const existing = ad.aditivos_equipamentos?.find(
          (ae: any) => ae.equipamento_id === eq.equipamento_id
        );

        if (existing) {
          const needsUpdate =
            Number(existing.valor_hora) !== Number(eq.valor_hora) ||
            Number(existing.horas_contratadas) !== Number(eq.horas_contratadas) ||
            Number(existing.valor_hora_excedente) !== Number(eq.valor_hora_excedente) ||
            Number(existing.hora_minima) !== Number(eq.hora_minima) ||
            existing.data_entrega !== (eq.data_entrega || null) ||
            existing.data_devolucao !== (eq.data_devolucao || null);

          if (needsUpdate) {
            await supabase
              .from("aditivos_equipamentos")
              .update({
                valor_hora: Number(eq.valor_hora),
                horas_contratadas: Number(eq.horas_contratadas),
                valor_hora_excedente: Number(eq.valor_hora_excedente),
                hora_minima: Number(eq.hora_minima),
                data_entrega: eq.data_entrega || null,
                data_devolucao: eq.data_devolucao || null,
              })
              .eq("id", existing.id);
          }
        } else if (ad.numero > currentNumero) {
          await supabase
            .from("aditivos_equipamentos")
            .insert({
              id: crypto.randomUUID(),
              aditivo_id: ad.id,
              equipamento_id: eq.equipamento_id,
              valor_hora: Number(eq.valor_hora),
              horas_contratadas: Number(eq.horas_contratadas),
              valor_hora_excedente: Number(eq.valor_hora_excedente),
              hora_minima: Number(eq.hora_minima),
              data_entrega: eq.data_entrega || null,
              data_devolucao: eq.data_devolucao || null,
            });
        }
      }
    }

    // Sync to base contratos_equipamentos
    const { data: baseEquips } = await supabase
      .from("contratos_equipamentos")
      .select("id, equipamento_id, valor_hora, horas_contratadas, valor_hora_excedente, hora_minima, data_entrega, data_devolucao")
      .eq("contrato_id", contratoId);

    if (baseEquips) {
      for (const eq of currentEquipamentos) {
        const base = baseEquips.find((b: any) => b.equipamento_id === eq.equipamento_id);
        if (base) {
          const needsBaseUpdate =
            Number(base.valor_hora) !== Number(eq.valor_hora) ||
            Number(base.horas_contratadas) !== Number(eq.horas_contratadas) ||
            Number(base.valor_hora_excedente) !== Number(eq.valor_hora_excedente) ||
            Number(base.hora_minima) !== Number(eq.hora_minima) ||
            base.data_entrega !== (eq.data_entrega || null) ||
            base.data_devolucao !== (eq.data_devolucao || null);

          if (needsBaseUpdate) {
            await supabase
              .from("contratos_equipamentos")
              .update({
                valor_hora: Number(eq.valor_hora),
                horas_contratadas: Number(eq.horas_contratadas),
                valor_hora_excedente: Number(eq.valor_hora_excedente),
                hora_minima: Number(eq.hora_minima),
                data_entrega: eq.data_entrega || null,
                data_devolucao: eq.data_devolucao || null,
              })
              .eq("id", base.id);
          }
        }
      }
    }
  };

  const handleSaveAditivo = async () => {
    if (!ajustesContrato || !aditivoForm.data_inicio || !aditivoForm.data_fim) {
      toast({ title: "Campos obrigatórios", description: "Preencha as datas de início e fim do aditivo.", variant: "destructive" });
      return;
    }
    if (aditivoForm.equipamentos.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Adicione pelo menos um equipamento ao aditivo.", variant: "destructive" });
      return;
    }
    const payload = {
      contrato_id: ajustesContrato.id,
      numero: aditivoForm.numero,
      data_inicio: aditivoForm.data_inicio,
      data_fim: aditivoForm.data_fim,
      motivo: aditivoForm.motivo,
      observacoes: aditivoForm.observacoes,
    };

    let aditivoId: string;
    if (editingAditivo) {
      const { error } = await supabase.from("contratos_aditivos").update(payload).eq("id", editingAditivo.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      aditivoId = editingAditivo.id;
      await supabase.from("aditivos_equipamentos").delete().eq("aditivo_id", aditivoId);
    } else {
      const newId = crypto.randomUUID();
      const { data, error } = await supabase.from("contratos_aditivos").insert({ ...payload, id: newId }).select("id").single();
      if (error || (!data && !newId)) { toast({ title: "Erro", description: error?.message || "Erro ao criar aditivo", variant: "destructive" }); return; }
      aditivoId = data?.id || newId;
    }

    const eqRows = aditivoForm.equipamentos.map(fe => ({
      id: crypto.randomUUID(),
      aditivo_id: aditivoId,
      equipamento_id: fe.equipamento_id,
      valor_hora: Number(fe.valor_hora),
      horas_contratadas: Number(fe.horas_contratadas),
      valor_hora_excedente: Number(fe.valor_hora_excedente),
      hora_minima: Number(fe.hora_minima),
      data_entrega: fe.data_entrega || null,
      data_devolucao: fe.data_devolucao || null,
    }));
    await supabase.from("aditivos_equipamentos").insert(eqRows);
    await syncAditivosEquipamentos(ajustesContrato.id, aditivoId, aditivoForm.numero, eqRows);

    setAditivoFormOpen(false);
    toast({ title: "Sucesso", description: editingAditivo ? "Aditivo atualizado." : "Aditivo criado." });
    fetchAditivos(ajustesContrato.id);
    uploadMovementPDFToGDrive(ajustesContrato.id);
  };

  const handleExportAditivo = async (ad: Aditivo) => {
    try {
      const { exportAditivoToPDF } = await import("@/lib/aditivoExportUtils");
      const eqs = ad.aditivos_equipamentos || [];
      await exportAditivoToPDF(ad, ajustesContrato, equipamentos);
      toast({ title: "Sucesso", description: "O Aditivo foi emitido com sucesso." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro", description: "Falha ao gerar o Aditivo em PDF.", variant: "destructive" });
    }
  };

  const handleDeleteAditivo = async (id: string) => {
    const { error } = await supabase.from("contratos_aditivos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (ajustesContrato) {
      fetchAditivos(ajustesContrato.id);
      uploadMovementPDFToGDrive(ajustesContrato.id);
    }
  };

  const addAditivoEquipamento = (equipId: string) => {
    if (equipId && !aditivoForm.equipamentos.some(fe => fe.equipamento_id === equipId)) {
      setAditivoForm(prev => ({
        ...prev,
        equipamentos: [...prev.equipamentos, { equipamento_id: equipId, valor_hora: 0, horas_contratadas: 0, valor_hora_excedente: 0, hora_minima: 0, data_entrega: "", data_devolucao: "" }],
      }));
    }
  };

  const removeAditivoEquipamento = (equipId: string) => {
    setAditivoForm(prev => ({ ...prev, equipamentos: prev.equipamentos.filter(fe => fe.equipamento_id !== equipId) }));
  };

  const updateAditivoEquipItem = (equipId: string, field: string, value: number | string) => {
    setAditivoForm(prev => ({
      ...prev,
      equipamentos: prev.equipamentos.map(fe => fe.equipamento_id === equipId ? { ...fe, [field]: value } : fe),
    }));
  };

  // --- Prorrogação ---
  const handleProrrogacao = async () => {
    if (!ajustesContrato || !prorrogacaoForm.nova_data_fim) {
      toast({ title: "Erro", description: "Informe a nova data de término.", variant: "destructive" });
      return;
    }
    if (prorrogacaoForm.nova_data_fim <= ajustesContrato.data_fim) {
      toast({ title: "Erro", description: "A nova data deve ser posterior à data atual de término.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("contratos").update({
      data_fim: prorrogacaoForm.nova_data_fim,
      observacoes: ajustesContrato.observacoes
        ? `${ajustesContrato.observacoes}\n[Prorrogação] De ${formatLocalDate(ajustesContrato.data_fim)} para ${formatLocalDate(prorrogacaoForm.nova_data_fim)}${prorrogacaoForm.motivo ? ` — ${prorrogacaoForm.motivo}` : ""}`
        : `[Prorrogação] De ${formatLocalDate(ajustesContrato.data_fim)} para ${formatLocalDate(prorrogacaoForm.nova_data_fim)}${prorrogacaoForm.motivo ? ` — ${prorrogacaoForm.motivo}` : ""}`,
    }).eq("id", ajustesContrato.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sucesso", description: "Contrato prorrogado com sucesso!" });
    setProrrogacaoForm({ nova_data_fim: "", motivo: "" });
    setAjustesOpen(false);
    fetchData();
  };

  // --- Finalizar Contrato ---
  const [finalizarPendencias, setFinalizarPendencias] = useState<{
    faturasPendentes: Array<{ id: string; periodo: string; status: string; valor_total: number }>;
    medicoesAbertas: Array<{ id: string; data: string; equipamento_id: string }>;
    gastosNaoFaturados: Array<{ id: string; descricao: string; valor: number; data: string }>;
    equipsSemDevolucao: Array<{ equipamento_id: string; label: string; data_entrega: string | null }>;
  }>({ faturasPendentes: [], medicoesAbertas: [], gastosNaoFaturados: [], equipsSemDevolucao: [] });
  const [finalizarLoading, setFinalizarLoading] = useState(false);

  const openFinalizar = async (item: Contrato) => {
    setFinalizarContrato(item);
    setFinalizarForm({ data_encerramento: new Date().toISOString().slice(0, 10), motivo: "" });
    setFinalizarLoading(true);
    setFinalizarDialogOpen(true);

    // Buscar pendências do contrato
    const equipItems = item.contratos_equipamentos || [];
    const equipIds = equipItems.map(ce => ce.equipamento_id);

    // Equipamentos sem data de devolução
    const equipsSemDevolucao = equipItems
      .filter(ce => !ce.data_devolucao)
      .map(ce => ({
        equipamento_id: ce.equipamento_id,
        label: getEquipLabel(ce.equipamentos),
        data_entrega: ce.data_entrega,
      }));

    const [fatRes, gastosRes] = await Promise.all([
      supabase.from("faturamento").select("id, periodo, status, valor_total").eq("contrato_id", item.id).in("status", ["Pendente", "Medido"]),
      equipIds.length > 0
        ? supabase.from("gastos").select("id, descricao, valor, data, equipamento_id").in("equipamento_id", equipIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    // Gastos não faturados
    let gastosNaoFaturados: Array<{ id: string; descricao: string; valor: number; data: string }> = [];
    if (gastosRes.data && gastosRes.data.length > 0) {
      const gastoIds = gastosRes.data.map((g: any) => g.id);
      const { data: faturados } = await supabase.from("faturamento_gastos").select("gasto_id").in("gasto_id", gastoIds);
      const faturadoSet = new Set((faturados || []).map((f: any) => f.gasto_id));
      gastosNaoFaturados = gastosRes.data.filter((g: any) => !faturadoSet.has(g.id)).map((g: any) => ({ id: g.id, descricao: g.descricao, valor: g.valor, data: g.data }));
    }

    // Medições recentes sem fatura
    let medicoesAbertas: Array<{ id: string; data: string; equipamento_id: string }> = [];
    if (equipIds.length > 0) {
      const dLimite = new Date();
      dLimite.setDate(dLimite.getDate() - 60);
      const { data: meds } = await supabase.from("medicoes").select("id, data, equipamento_id").in("equipamento_id", equipIds).gte("data", dLimite.toISOString().slice(0, 10));
      const { data: faturasAprovadas } = await supabase.from("faturamento").select("periodo_medicao_inicio, periodo_medicao_fim").eq("contrato_id", item.id).in("status", ["Aprovado", "Pago"]);

      if (meds && meds.length > 0) {
        medicoesAbertas = meds.filter((m: any) => {
          return !(faturasAprovadas || []).some((f: any) => f.periodo_medicao_inicio && f.periodo_medicao_fim && m.data >= f.periodo_medicao_inicio && m.data <= f.periodo_medicao_fim);
        });
      }
    }

    setFinalizarPendencias({
      faturasPendentes: (fatRes.data || []) as any[],
      medicoesAbertas,
      gastosNaoFaturados,
      equipsSemDevolucao,
    });
    setFinalizarLoading(false);
  };

  const temPendencias = finalizarPendencias.faturasPendentes.length > 0 || finalizarPendencias.medicoesAbertas.length > 0 || finalizarPendencias.gastosNaoFaturados.length > 0 || finalizarPendencias.equipsSemDevolucao.length > 0;

  const handleFinalizar = async () => {
    if (!finalizarContrato) return;
    const obs = finalizarContrato.observacoes || "";
    const encerramento = finalizarForm.data_encerramento || new Date().toISOString().slice(0, 10);
    const newObs = `${obs}\n[Encerrado em ${formatLocalDate(encerramento)}]${finalizarForm.motivo ? ` — ${finalizarForm.motivo}` : ""}`.trim();
    const { error } = await supabase.from("contratos").update({
      status: "Encerrado",
      data_fim: encerramento,
      observacoes: newObs,
    }).eq("id", finalizarContrato.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sucesso", description: "Contrato finalizado com sucesso!" });
    setFinalizarDialogOpen(false);
    fetchData();
  };

  // Summary totals for dashboard
  const dashboardTotals = {
    totalContratado: equipUsages.reduce((s, u) => s + u.custo_contratado, 0),
    totalReal: equipUsages.reduce((s, u) => s + u.custo_real, 0),
    totalHorasContratadas: equipUsages.reduce((s, u) => s + u.horas_contratadas, 0),
    totalHorasUtilizadas: equipUsages.reduce((s, u) => s + u.horas_utilizadas, 0),
    alertCount: equipUsages.filter(u => u.percentual >= 80).length,
  };

  const getTitle = () => {
    if (activeTab === "propostas") return "Propostas Comerciais";
    if (activeTab === "modelo") return "Modelo de Contrato";
    if (activeTab === "dossie") return "Dossiê Digital";
    return "Contratos Comerciais";
  };

  const getSubtitle = () => {
    if (activeTab === "propostas") return "Gerenciamento de propostas e orçamentos";
    if (activeTab === "modelo") return "Configuração de cláusulas padrão e termos";
    if (activeTab === "dossie") return "Central de documentos integrados ao Google Drive";
    return "Gestão de contratos de locação ativos e encerrados";
  };

  return (
    <Layout title={getTitle()} subtitle={getSubtitle()}>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">

        {/* Main tab navigation removed - now managed via Sidebar */}

        <TabsContent value="contratos">
          <div className="space-y-6">

            {/* Banner de alertas de renovação */}
            {kpis.vencendo > 0 && (
              <div className="rounded-2xl border border-yellow-400/40 bg-yellow-500/5 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-yellow-800 dark:text-yellow-300">
                        {kpis.vencendo} contrato{kpis.vencendo > 1 ? "s" : ""} vencendo nos próximos 30 dias
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        {items.filter(i => i.status === "Ativo" && getDiasRestantes(i.data_fim) >= 0 && getDiasRestantes(i.data_fim) <= 30)
                          .map(i => `${i.empresas?.nome}${i.empresas?.obra ? ` (${i.empresas.obra})` : ""} — ${getDiasRestantes(i.data_fim)}d`)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {items
                      .filter(i => i.status === "Ativo" && getDiasRestantes(i.data_fim) >= 0 && getDiasRestantes(i.data_fim) <= 30)
                      .slice(0, 3)
                      .map(i => (
                        <Button
                          key={i.id}
                          size="sm"
                          variant="outline"
                          className="text-xs border-yellow-400/50 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-500/10"
                          onClick={() => openAjustesWithAditivos(i)}
                        >
                          <CalendarPlus className="h-3 w-3 mr-1" />
                          Renovar: {i.empresas?.nome?.split(" ")[0]}
                        </Button>
                      ))
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col gap-3 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent p-4 rounded-2xl border border-accent/20 shadow-sm backdrop-blur-md">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar empresa, obra, equipamento, tag..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background/50 border-accent/20 focus:border-accent" />
                  </div>
                  {/* Status quick filters */}
                  <div className="flex gap-1.5 flex-wrap">
                    {(["todos", "Ativo", "Encerrado"] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          filterStatus === s
                            ? s === "Ativo" ? "bg-success text-success-foreground border-success" : s === "Encerrado" ? "bg-muted text-muted-foreground border-border" : "bg-accent text-accent-foreground border-accent"
                            : "bg-background/50 border-border/50 text-muted-foreground hover:border-accent/40"
                        }`}
                      >
                        {s === "todos" ? "Todos" : s}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      showFilters || filterObra || filterDataInicio || filterDataFim
                        ? "bg-accent/20 border-accent/40 text-accent"
                        : "bg-background/50 border-border/50 text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    <Search className="h-3 w-3" />
                    Filtros {(filterObra || filterDataInicio || filterDataFim) ? "●" : ""}
                  </button>
                </div>

                {/* KPI Pill Badges inline */}
                <div className="flex items-center gap-2 flex-wrap lg:justify-end shrink-0">
                  {/* Ativos */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm text-[11px] font-medium text-foreground shadow-sm">
                    <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span>Ativos: <strong>{kpis.ativos}</strong><span className="text-muted-foreground">/{kpis.total}</span></span>
                  </div>
                  
                  {/* Vencendo */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium shadow-sm transition-all ${
                    kpis.vencendo > 0 
                      ? "border-yellow-400/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-semibold animate-pulse" 
                      : "border-border/60 bg-card/60 backdrop-blur-sm text-muted-foreground"
                  }`}>
                    <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${kpis.vencendo > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`} />
                    <span>Vencendo 30d: <strong>{kpis.vencendo}</strong></span>
                  </div>
                  
                  {/* Valor Total Ativo */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-success/30 bg-success/5 text-[11px] font-medium text-success shadow-sm">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                    <span>Ativo: <strong>{kpis.valorTotal > 0 ? `R$ ${kpis.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}</strong></span>
                  </div>

                  {/* Total */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm text-[11px] font-medium text-muted-foreground shadow-sm">
                    <Activity className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Total: <strong>{kpis.total}</strong></span>
                  </div>
                </div>
              </div>

              {/* Filtros expandidos */}
              {showFilters && (
                <div className="flex flex-wrap gap-3 pt-1 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Obra:</Label>
                    <Input
                      placeholder="Filtrar por obra..."
                      value={filterObra}
                      onChange={e => setFilterObra(e.target.value)}
                      className="h-8 text-xs w-40 bg-background/50"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Início após:</Label>
                    <Input type="date" value={filterDataInicio} onChange={e => setFilterDataInicio(e.target.value)} className="h-8 text-xs w-36 bg-background/50" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Fim antes de:</Label>
                    <Input type="date" value={filterDataFim} onChange={e => setFilterDataFim(e.target.value)} className="h-8 text-xs w-36 bg-background/50" />
                  </div>
                  {(filterObra || filterDataInicio || filterDataFim) && (
                    <button
                      onClick={() => { setFilterObra(""); setFilterDataInicio(""); setFilterDataFim(""); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <X className="h-3 w-3" /> Limpar
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 justify-between">
                <p className="text-xs text-muted-foreground">{sorted.length} contrato{sorted.length !== 1 ? "s" : ""} encontrado{sorted.length !== 1 ? "s" : ""}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-background/50 backdrop-blur-sm border border-border/50 rounded-md p-0.5">
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="sm"
                      className={`h-7 px-2.5 ${viewMode === "grid" ? "shadow-sm" : ""}`}
                      onClick={() => setViewMode("grid")}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="sm"
                      className={`h-7 px-2.5 ${viewMode === "list" ? "shadow-sm" : ""}`}
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportDetailedPDFWrapper} className="bg-background/50 backdrop-blur-sm border-accent/20 hover:bg-accent/10">
                      <FileDown className="h-4 w-4 mr-1 text-primary" /> Movimentação
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportSimplePDFWrapper} className="bg-background/50 backdrop-blur-sm border-accent/20 hover:bg-accent/10">
                      <FileDown className="h-4 w-4 mr-1 text-destructive" /> PDF Simples
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())} className="bg-background/50 backdrop-blur-sm border-accent/20 hover:bg-accent/10">
                      <FileSpreadsheet className="h-4 w-4 mr-1 text-success" /> Excel
                    </Button>
                  </div>
                  <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm rounded-full px-5">
                    <Plus className="h-4 w-4 mr-2" /> Novo Contrato
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {/* Cabeçalho sutil (desktop) */}
              {sorted.length > 0 && viewMode === "list" && (
                <div className="hidden md:flex items-center px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="w-[40px]"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></div>
                  <div className="flex-1 min-w-0 cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("empresa")}>
                    Empresa / Obra {sortCol === "empresa" && (sortAsc ? "↑" : "↓")}
                  </div>
                  <div className="w-[220px]">Equipamentos</div>
                  <div className="w-[180px] cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("periodo")}>
                    Período {sortCol === "periodo" && (sortAsc ? "↑" : "↓")}
                  </div>
                  <div className="w-[100px] text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("status")}>
                    Status {sortCol === "status" && (sortAsc ? "↑" : "↓")}
                  </div>
                  <div className="w-[180px] text-right">Ações</div>
                </div>
              )}

              <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col gap-2"}>
              {sorted.map((item) => {
                const ces = getContratoEquipamentos(item);
                const numContrato = getNumeroContrato(item);
                const isExpanded = expandedContractId === item.id;
                return (
                  <div key={item.id} className={`group bg-card/60 backdrop-blur-sm border border-border/60 hover:border-accent/40 rounded-2xl transition-all duration-300 relative shadow-sm hover:shadow-md ${selected.has(item.id) ? "ring-2 ring-accent border-transparent" : ""}`}>
                  <div className={`flex ${viewMode === "grid" ? "flex-col" : "flex-col md:flex-row md:items-center"} gap-4 p-4 hover:bg-accent/5 ${isExpanded ? "rounded-t-2xl" : "rounded-2xl"}`}>
                    
                    {/* Checkbox */}
                    <div className="absolute top-4 right-4 md:static md:w-[40px]">
                      <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                    </div>

                    {/* Info Empresa */}
                    <div
                      className="flex-1 min-w-0 pr-8 md:pr-0 cursor-pointer"
                      onClick={() => setExpandedContractId(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Briefcase className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-sm text-foreground truncate">{item.empresas?.nome}</h3>
                            {item.empresas?.obra && (
                              <Badge variant="secondary" className="font-normal text-[9px] py-0 px-1.5 bg-accent/10 text-accent hover:bg-accent/20 border-accent/20 truncate max-w-[120px]">
                                {item.empresas.obra}
                              </Badge>
                            )}
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded shrink-0">{numContrato}</span>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{item.empresas?.cnpj}</p>
                        </div>
                      </div>
                    </div>

                    {/* Equipamentos */}
                    <div className={`${viewMode === "grid" ? "w-full" : "md:w-[220px]"} pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0`}>
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <button className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors cursor-pointer bg-muted/30 px-2.5 py-1.5 rounded-md w-fit">
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[100px]">
                              {(() => {
                                const hoje = new Date().toISOString().slice(0, 10);
                                const allAditivos = (aditivosPorContrato[item.id] || []);

                                const vigentes = allAditivos.filter(ad => ad.data_inicio <= hoje && ad.data_fim >= hoje);
                                const ultimoAditivo = vigentes.length > 0
                                  ? vigentes.reduce((latest, ad) => ad.numero > latest.numero ? ad : latest, vigentes[0])
                                  : null;
                                
                                if (ultimoAditivo) {
                                  return (ultimoAditivo.aditivos_equipamentos || [])
                                    .filter((ae: any) => !ae.data_devolucao || ae.data_devolucao > hoje).length;
                                }
                                return ces.filter((ce: any) => !ce.data_devolucao || ce.data_devolucao > hoje).length;
                              })()} equip(s)
                            </span>
                            {(aditivosPorContrato[item.id] || []).length > 0 && (
                              <Badge variant="outline" className="text-[10px] ml-1 shrink-0 py-0 h-4 bg-background">{(aditivosPorContrato[item.id] || []).length} aditivo(s)</Badge>
                            )}
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-96 max-h-80 overflow-y-auto z-50" align="start">
                          <div className="space-y-2">
                            {(() => {
                              const hoje = new Date().toISOString().slice(0, 10);
                              const allAditivos = (aditivosPorContrato[item.id] || []);

                              const vigentes = allAditivos.filter(ad => ad.data_inicio <= hoje && ad.data_fim >= hoje);
                              const ultimoAditivo = vigentes.length > 0
                                ? vigentes.reduce((latest, ad) => ad.numero > latest.numero ? ad : latest, vigentes[0])
                                : null;

                              if (ultimoAditivo) {
                                const activeEquips = (ultimoAditivo.aditivos_equipamentos || [])
                                  .filter((ae: any) => !ae.data_devolucao || ae.data_devolucao > hoje);
                                return (
                                  <>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      Aditivo #{ultimoAditivo.numero} — Vigente
                                    </p>
                                    {activeEquips.map((ae: any) => {
                                      const eq = equipamentos.find(e => e.id === ae.equipamento_id);
                                      return (
                                        <div key={ae.id} className="flex items-center gap-2 flex-wrap">
                                          <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                                            {eq ? `${eq.tipo} ${eq.modelo}${eq.tag_placa ? ` (${eq.tag_placa})` : ""}` : ae.equipamento_id}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground">
                                            R$ {Number(ae.valor_hora).toFixed(2)}/h · {ae.horas_contratadas}h
                                            {Number(ae.hora_minima) > 0 && <span className="text-accent"> · Mín: {ae.hora_minima}h</span>}
                                          </span>
                                        </div>
                                      );
                                    })}
                                    {activeEquips.length === 0 && <span className="text-xs text-muted-foreground">Nenhum equipamento ativo</span>}
                                  </>
                                );
                              }

                              // No active addendum — show base contract
                              const activeBase = ces.filter(ce => !ce.data_devolucao || ce.data_devolucao > hoje);
                              return (
                                <>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contrato Original</p>
                                  {activeBase.map(ce => (
                                    <div key={ce.equipamento_id} className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="text-xs">
                                        {ce.equipamentos.tipo} {ce.equipamentos.modelo} {ce.equipamentos.tag_placa ? `(${ce.equipamentos.tag_placa})` : ""}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        R$ {Number(ce.valor_hora).toFixed(2)}/h · {ce.horas_contratadas}h
                                        {Number(ce.hora_minima) > 0 && <span className="text-accent"> · Mín: {ce.hora_minima}h</span>}
                                      </span>
                                    </div>
                                  ))}
                                  {activeBase.length === 0 && <span className="text-xs text-muted-foreground">Nenhum equipamento ativo</span>}
                                </>
                              );
                            })()}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </div>

                    {/* Período + Progresso + Valor */}
                    <div className={`${viewMode === "grid" ? "w-full" : "md:w-[200px]"} flex flex-col gap-1 pt-2 md:pt-0`}>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarRange className="h-3.5 w-3.5" />
                        <span>Início: <strong className="text-foreground font-medium">{formatLocalDate(item.data_inicio)}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarRange className="h-3.5 w-3.5 opacity-0" />
                        <span>Fim: <strong className="text-foreground font-medium">{formatLocalDate(item.data_fim)}</strong></span>
                      </div>
                      {/* Progress bar do período */}
                      {item.status === "Ativo" && (() => {
                        const pct = getPeriodoProgresso(item.data_inicio, item.data_fim);
                        const info = getVencimentoInfo(item);
                        return (
                          <div className="mt-1">
                            <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-yellow-500" : "bg-success"
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            {info.label && (
                              <span className={`text-[10px] mt-0.5 block ${info.color}`}>{info.label}</span>
                            )}
                          </div>
                        );
                      })()}
                      {/* Valor contratado */}
                      {(() => {
                        const val = getValorContratado(item);
                        return val > 0 ? (
                          <span className="text-[11px] text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground">R$ {val.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span> contratados
                          </span>
                        ) : null;
                      })()}
                    </div>

                    {/* Status */}
                    <div className={`${viewMode === "grid" ? "w-full flex-row" : "md:w-[100px] md:flex-col md:items-center"} flex gap-2 pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0`}>
                      <Badge className={statusColor(item.status)}>{item.status}</Badge>
                      {/* Vencimento badge */}
                      {(() => {
                        const info = getVencimentoInfo(item);
                        const dias = getDiasRestantes(item.data_fim);
                        if (item.status === "Ativo" && dias <= 15 && dias >= 0) {
                          return <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${info.badge}`}>⚠ {dias}d</Badge>;
                        }
                        if (item.status === "Ativo" && dias < 0) {
                          return <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${info.badge}`}>Vencido</Badge>;
                        }
                        return null;
                      })()}
                    </div>

                    {/* Ações */}
                    <div className={`${viewMode === "grid" ? "w-full" : "md:w-[200px]"} flex flex-wrap justify-end gap-1 pt-2 md:pt-0 mt-2 md:mt-0`}>
                      <Button variant="ghost" size="icon" onClick={() => openAjustesWithAditivos(item)} title="Gestão do Contrato" className="h-8 w-8 hover:bg-muted/50">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDashboard(item)} title="Dashboard de uso" className="h-8 w-8 hover:bg-muted/50">
                        <BarChart3 className="h-4 w-4 text-accent" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)} className="h-8 w-8 hover:bg-muted/50">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDuplicar(item)} title="Duplicar contrato" disabled={duplicating} className="h-8 w-8 hover:bg-accent/10">
                        <FilePlus2 className="h-4 w-4 text-accent" />
                      </Button>
                      {item.status === "Ativo" && (
                        <Button variant="ghost" size="icon" onClick={() => openFinalizar(item)} title="Finalizar Contrato" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(item.id)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Painel expandível inline */}
                  {isExpanded && (
                    <div className="border-t border-border/50 px-4 pb-4 pt-3 rounded-b-2xl bg-muted/20">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Equipamentos detalhados */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Equipamentos</p>
                          <div className="space-y-1.5">
                            {(() => {
                              const hoje = new Date().toISOString().slice(0, 10);
                              const ads = aditivosPorContrato[item.id] || [];
                              const vigentes = ads.filter(ad => ad.data_inicio <= hoje && ad.data_fim >= hoje);
                              const ultimo = vigentes.length > 0 ? vigentes.reduce((l, a) => a.numero > l.numero ? a : l, vigentes[0]) : null;
                              const equips = ultimo
                                ? (ultimo.aditivos_equipamentos || []).filter((ae: any) => !ae.data_devolucao || ae.data_devolucao > hoje).map((ae: any) => { const eq = equipamentos.find(e => e.id === ae.equipamento_id); return { eq, valor_hora: ae.valor_hora, horas_contratadas: ae.horas_contratadas, hora_minima: ae.hora_minima }; })
                                : ces.filter(ce => !ce.data_devolucao || ce.data_devolucao > hoje).map(ce => ({ eq: ce.equipamentos, valor_hora: ce.valor_hora, horas_contratadas: ce.horas_contratadas, hora_minima: ce.hora_minima }));
                              return equips.map((e, idx) => (
                                <div key={idx} className="flex flex-col bg-background/60 rounded-lg p-2 border border-border/40">
                                  <span className="text-xs font-medium">{e.eq?.tipo} {e.eq?.modelo} {e.eq?.tag_placa ? `(${e.eq.tag_placa})` : ""}</span>
                                  <span className="text-[11px] text-muted-foreground">R$ {Number(e.valor_hora).toFixed(2)}/h · {e.horas_contratadas}h{Number(e.hora_minima) > 0 ? ` · Mín: ${e.hora_minima}h` : ""}</span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>

                        {/* Aditivos */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Aditivos ({(aditivosPorContrato[item.id] || []).length})</p>
                          {(aditivosPorContrato[item.id] || []).length === 0
                            ? <p className="text-xs text-muted-foreground">Nenhum aditivo</p>
                            : (
                              <div className="space-y-1.5">
                                {(aditivosPorContrato[item.id] || []).map(ad => (
                                  <div key={ad.id} className="bg-background/60 rounded-lg p-2 border border-border/40">
                                    <p className="text-xs font-medium">Aditivo #{ad.numero}</p>
                                    <p className="text-[11px] text-muted-foreground">{formatLocalDate(ad.data_inicio)} → {formatLocalDate(ad.data_fim)}</p>
                                    {ad.motivo && <p className="text-[11px] text-muted-foreground truncate">{ad.motivo}</p>}
                                  </div>
                                ))}
                              </div>
                            )
                          }
                        </div>

                        {/* Observações e ações rápidas */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Informações</p>
                          <div className="space-y-2">
                            <div className="bg-background/60 rounded-lg p-2 border border-border/40 space-y-1">
                              <p className="text-[11px] text-muted-foreground">Tipo de Medição: <span className="font-medium text-foreground">{(item as any).tipo_medicao === "diarias" ? "Diárias" : "Horímetro"}</span></p>
                              <p className="text-[11px] text-muted-foreground">Dia Medição: <span className="font-medium text-foreground">{(item as any).dia_medicao_inicio} ao {(item as any).dia_medicao_fim}</span></p>
                              <p className="text-[11px] text-muted-foreground">Prazo Fat.: <span className="font-medium text-foreground">{(item as any).prazo_faturamento}d</span></p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => openAjustesWithAditivos(item)}>
                                <Settings2 className="h-3 w-3 mr-1" /> Gestão do Contrato
                              </Button>
                              <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => openDashboard(item)}>
                                <BarChart3 className="h-3 w-3 mr-1" /> Ver Dashboard
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}
              </div>

              {!loading && sorted.length === 0 && (
                <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border border-dashed">
                  Nenhum contrato encontrado
                  {(filterStatus !== "todos" || filterObra || filterDataInicio || filterDataFim) && (
                    <div className="mt-3">
                      <button onClick={() => { setFilterStatus("todos"); setFilterObra(""); setFilterDataInicio(""); setFilterDataFim(""); setSearch(""); }} className="text-accent text-sm hover:underline">Limpar todos os filtros</button>
                    </div>
                  )}
                </div>
              )}
            </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> Excluir contrato?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. O contrato, seus equipamentos vinculados, aditivos e ajustes temporários serão permanentemente removidos do sistema.
              <br /><br />
              Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      </div>

      {/* Dashboard Dialog */}
      <Dialog open={dashboardOpen} onOpenChange={setDashboardOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Dashboard de Uso — {dashboardContrato?.empresas?.nome}{dashboardContrato?.empresas?.obra ? ` (Obra: ${dashboardContrato.empresas.obra})` : ""}
            </DialogTitle>
            <DialogDescription>
              Período: {dashboardContrato ? `${formatLocalDate(dashboardContrato.data_inicio)} - ${formatLocalDate(dashboardContrato.data_fim)}` : ""}
            </DialogDescription>
          </DialogHeader>

          {dashboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
            </div>
          ) : (
            <div className="space-y-6">

              {/* Rentabilidade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border bg-success/5 border-success/20 p-3">
                  <p className="text-xs text-muted-foreground">Valor Contratado (Total)</p>
                  <p className="text-xl font-bold text-foreground">{fmt(dashboardTotals.totalContratado)}</p>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Já Faturado (Aprovado/Pago)</p>
                  <p className="text-xl font-bold text-success">{fmt(dashboardFaturamento.valorFaturado)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {dashboardFaturamento.faturas.filter(f => ["Aprovado", "Pago"].includes(f.status)).length} fatura(s) aprovada(s)
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Pendente de Aprovação</p>
                  <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{fmt(dashboardFaturamento.valorPendente)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {dashboardFaturamento.faturas.filter(f => ["Pendente", "Medido"].includes(f.status)).length} fatura(s) em aberto
                  </p>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Horas Contratadas</p>
                  <p className="text-lg font-bold text-foreground">{dashboardTotals.totalHorasContratadas.toFixed(1)}h</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Horas Utilizadas</p>
                  <p className="text-lg font-bold text-foreground">{dashboardTotals.totalHorasUtilizadas.toFixed(1)}h</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Custo Contratado</p>
                  <p className="text-lg font-bold text-foreground">{fmt(dashboardTotals.totalContratado)}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Custo Real</p>
                  <p className={`text-lg font-bold ${dashboardTotals.totalReal > dashboardTotals.totalContratado ? "text-destructive" : "text-success"}`}>
                    {fmt(dashboardTotals.totalReal)}
                  </p>
                </div>
              </div>

              {/* Alerts */}
              {dashboardTotals.alertCount > 0 && (
                <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <span className="font-semibold text-sm text-foreground">
                      {dashboardTotals.alertCount} equipamento(s) próximo(s) ou acima do limite contratado
                    </span>
                  </div>
                  <div className="space-y-1">
                    {equipUsages.filter(u => u.percentual >= 80).map(u => (
                      <p key={u.equipamento_id} className="text-xs text-muted-foreground">
                        • <strong>{u.equipamento.tipo} {u.equipamento.modelo}</strong>: {u.horas_utilizadas.toFixed(1)}h / {u.horas_contratadas}h ({u.percentual.toFixed(0)}%)
                        {u.percentual >= 100 && <span className="text-destructive font-semibold ml-1">— EXCEDIDO em {(u.horas_utilizadas - u.horas_contratadas).toFixed(1)}h</span>}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-equipment breakdown */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" /> Consumo por Equipamento
                </h3>
                {equipUsages.map(u => {
                  const status = getStatusLabel(u.percentual);
                  const clampedPct = Math.min(u.percentual, 100);
                  return (
                    <div key={u.equipamento_id} className="rounded-lg border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-foreground">{u.equipamento.tipo} {u.equipamento.modelo}</p>
                          <div className="flex items-center gap-2">
                            {u.equipamento.tag_placa && <p className="text-xs text-muted-foreground font-mono">{u.equipamento.tag_placa}</p>}
                            <Badge variant="outline" className="text-xs">{u.origem}</Badge>
                          </div>
                        </div>
                        <Badge className={status.className}>{status.label}</Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{u.horas_utilizadas.toFixed(1)}h utilizadas</span>
                          <span>{u.horas_contratadas}h contratadas</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getProgressColor(u.percentual)}`}
                            style={{ width: `${clampedPct}%` }}
                          />
                        </div>
                        <p className="text-xs text-right font-medium text-foreground">{u.percentual.toFixed(1)}%</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                        <div className="rounded bg-muted/50 p-2">
                          <p className="text-xs text-muted-foreground">Valor/Hora</p>
                          <p className="text-sm font-semibold text-foreground">{fmt(u.valor_hora)}</p>
                        </div>
                        <div className="rounded bg-muted/50 p-2">
                          <p className="text-xs text-muted-foreground">Custo Contratado</p>
                          <p className="text-sm font-semibold text-foreground">{fmt(u.custo_contratado)}</p>
                        </div>
                        <div className="rounded bg-muted/50 p-2">
                          <p className="text-xs text-muted-foreground">Custo Real</p>
                          <p className={`text-sm font-semibold ${u.custo_real > u.custo_contratado ? "text-destructive" : "text-success"}`}>{fmt(u.custo_real)}</p>
                        </div>
                      </div>

                      {u.percentual >= 100 && (
                        <div className="text-xs text-destructive font-medium bg-destructive/10 rounded p-2">
                          ⚠️ Excedente: {(u.horas_utilizadas - u.horas_contratadas).toFixed(1)}h ({fmt((u.horas_utilizadas - u.horas_contratadas) * u.valor_hora)} em custo excedente)
                        </div>
                      )}
                    </div>
                  );
                })}

                {equipUsages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum equipamento associado a este contrato.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-accent" />{editing ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Empresa</Label>
              <SearchableSelect
                value={form.empresa_id}
                onValueChange={(v) => setForm({ ...form, empresa_id: v })}
                placeholder="Selecione a empresa"
                searchPlaceholder="Pesquisar empresa..."
                options={empresas.map((e) => ({ value: e.id, label: `${e.nome}${e.obra ? ` (Obra: ${e.obra})` : ""} — ${e.cnpj}` }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Equipamentos</Label>
              <div className="flex gap-2">
                <SearchableSelect
                  value=""
                  onValueChange={addEquipamento}
                  placeholder="Adicionar equipamento..."
                  searchPlaceholder="Pesquisar equipamento..."
                  className="flex-1"
                  options={availableEquipamentos.map((e) => ({ value: e.id, label: `${e.tipo} ${e.modelo}${e.tag_placa ? ` (${e.tag_placa})` : ""}${e.numero_serie ? ` - NS: ${e.numero_serie}` : ""}` }))}
                />
              </div>
              {formEquipamentos.length > 0 && (
                <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                  {formEquipamentos.map(fe => {
                    const eq = equipamentos.find(e => e.id === fe.equipamento_id);
                    if (!eq) return null;
                    return (
                      <div key={fe.equipamento_id} className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {eq.tipo} {eq.modelo}
                            {eq.tag_placa && <span className="text-muted-foreground ml-2 font-mono">({eq.tag_placa})</span>}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeEquipamento(fe.equipamento_id)}>
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">{form.tipo_medicao === "diarias" ? "Valor/Diária (R$)" : "Valor/Hora (R$)"}</Label>
                            <CurrencyInput value={fe.valor_hora} onValueChange={(v) => updateEquipItem(fe.equipamento_id, "valor_hora", v)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">{form.tipo_medicao === "diarias" ? "Valor Diária Excedente (R$)" : "Valor Hora Excedente (R$)"}</Label>
                            <CurrencyInput value={fe.valor_hora_excedente} onValueChange={(v) => updateEquipItem(fe.equipamento_id, "valor_hora_excedente", v)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">{form.tipo_medicao === "diarias" ? "Diárias Contratadas" : "Horas Contratadas"}</Label>
                            <Input type="number" value={fe.horas_contratadas || ""} onChange={(e) => updateEquipItem(fe.equipamento_id, "horas_contratadas", Number(e.target.value))} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">{form.tipo_medicao === "diarias" ? "Diária Mínima" : "Hora Mínima"}</Label>
                            <Input type="number" value={fe.hora_minima || ""} onChange={(e) => updateEquipItem(fe.equipamento_id, "hora_minima", Number(e.target.value))} className="h-8 text-sm" placeholder="0 = sem mínimo" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Data de Entrega</Label>
                            <Input type="date" value={fe.data_entrega || ""} onChange={(e) => updateEquipItemStr(fe.equipamento_id, "data_entrega", e.target.value)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Data de Devolução</Label>
                            <Input type="date" value={fe.data_devolucao || ""} onChange={(e) => updateEquipItemStr(fe.equipamento_id, "data_devolucao", e.target.value)} className="h-8 text-sm" />
                          </div>
                        </div>
                        <div className="mt-2 p-3 bg-background/50 rounded-md border border-border/50">
                          <div className="flex flex-col gap-1">
                            {fe.hora_minima > 0 ? (
                              <>
                                <p className="text-xs text-muted-foreground">Se {form.tipo_medicao === "diarias" ? "trabalhar menos de" : "trabalhar menos de"} <strong>{fe.hora_minima}{form.tipo_medicao === "diarias" ? " diárias" : "h"}</strong>, será cobrado o valor de {fe.hora_minima}{form.tipo_medicao === "diarias" ? " diárias" : "h"}</p>
                                <p className="text-sm font-semibold text-primary">Valor Mensal Mínimo Garantido: {fmt(fe.valor_hora * fe.hora_minima)}</p>
                              </>
                            ) : (
                              <p className="text-sm font-semibold text-primary">Valor Mensal Estimado ({fe.horas_contratadas || 0}{form.tipo_medicao === "diarias" ? "d" : "h"}): {fmt(fe.valor_hora * (fe.horas_contratadas || 0))}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground pt-1">{formEquipamentos.length} equipamento(s) selecionado(s)</p>
                </div>
              )}
              {formEquipamentos.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum equipamento adicionado. Selecione pelo menos um.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Data Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label>Data Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Dia Início Medição</Label>
                <Select value={String(form.dia_medicao_inicio)} onValueChange={(v) => setForm({ ...form, dia_medicao_inicio: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dia Fim Medição</Label>
                <Select value={String(form.dia_medicao_fim)} onValueChange={(v) => setForm({ ...form, dia_medicao_fim: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Prazo para Faturamento (dias)</Label>
              <Select value={String(form.prazo_faturamento)} onValueChange={(v) => setForm({ ...form, prazo_faturamento: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Medição</Label>
              <Select value={form.tipo_medicao} onValueChange={(v) => setForm({ ...form, tipo_medicao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="horas">Por Horas (Horímetro)</SelectItem>
                  <SelectItem value="diarias">Por Diárias</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{form.tipo_medicao === "diarias" ? "Medição será feita contando dias trabalhados" : "Medição será feita por leitura de horímetro"}</p>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Suspenso">Suspenso</SelectItem>
                  <SelectItem value="Encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajustes e Aditivos Dialog */}
      <Dialog open={ajustesOpen} onOpenChange={setAjustesOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-accent" />
              Gestão do Contrato — {ajustesContrato?.empresas?.nome}{ajustesContrato?.empresas?.obra ? ` (Obra: ${ajustesContrato.empresas.obra})` : ""}
            </DialogTitle>
            <DialogDescription>
              Gerencie ajustes temporários, aditivos e prorrogações.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="ajustes" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="ajustes" className="flex-1">Ajustes</TabsTrigger>
              <TabsTrigger value="aditivos" className="flex-1">Aditivos</TabsTrigger>
              <TabsTrigger value="prorrogacao" className="flex-1">Prorrogação</TabsTrigger>
              <TabsTrigger value="observacoes" className="flex-1">Observações</TabsTrigger>
              <TabsTrigger value="clausulas" className="flex-1">Cláusulas</TabsTrigger>
            </TabsList>

            {/* Nova aba: Observações estruturadas */}
            <TabsContent value="observacoes" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Nova Observação</p>
                <div className="flex gap-2 flex-wrap">
                  {(["Comercial", "Operacional", "Financeiro", "Jurídico"] as const).map(tag => (
                    <button
                      key={tag}
                      onClick={() => setNovaObsTag(tag)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        novaObsTag === tag ? "bg-accent text-accent-foreground border-accent" : "bg-background border-border/50 text-muted-foreground hover:border-accent/40"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="Digite a observação..."
                  value={novaObsTexto}
                  onChange={e => setNovaObsTexto(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <Button size="sm" onClick={handleSalvarObservacao} disabled={!novaObsTexto.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  Salvar Observação
                </Button>
              </div>

              {/* Histórico de observações */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico</p>
                {parseObservacoes(ajustesContrato?.observacoes || null).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma observação registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {parseObservacoes(ajustesContrato?.observacoes || null).reverse().map((obs, idx) => (
                      <div key={idx} className="rounded-lg border border-border/50 bg-card p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                            obs.tag === "Comercial" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-400/30"
                            : obs.tag === "Financeiro" ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-400/30"
                            : obs.tag === "Jurídico" ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-400/30"
                            : "bg-accent/10 text-accent border-accent/30"
                          }`}>{obs.tag}</span>
                          {obs.data && <span className="text-[10px] text-muted-foreground">{obs.data}</span>}
                        </div>
                        <p className="text-sm text-foreground">{obs.texto}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="ajustes" className="space-y-4 mt-4">
              <Button onClick={() => openNewAjuste()} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-2" /> Novo Ajuste
              </Button>
              {ajustes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum ajuste temporário cadastrado.</p>
              )}
              <div className="space-y-3">
                {(() => {
                  // Group adjustments: bulk (same motivo+dates+close created_at) vs individual
                  const ces = getAllEquipForAjuste(ajustesContrato);
                  const groups: { key: string; items: AjusteTemporario[]; isBulk: boolean }[] = [];
                  const used = new Set<string>();
                  
                  ajustes.forEach(aj => {
                    if (used.has(aj.id)) return;
                    // Find siblings with same motivo + dates + created_at within 5 seconds
                    const siblings = ajustes.filter(other => 
                      !used.has(other.id) &&
                      other.motivo === aj.motivo &&
                      other.data_inicio === aj.data_inicio &&
                      other.data_fim === aj.data_fim &&
                      Math.abs(new Date(other.created_at).getTime() - new Date(aj.created_at).getTime()) < 5000
                    );
                    const isBulk = aj.motivo?.startsWith("[LOTE]") || (siblings.length > 1 && siblings.length >= ces.length);
                    siblings.forEach(s => used.add(s.id));
                    groups.push({ key: siblings.map(s => s.id).join(","), items: siblings, isBulk });
                  });

                  const detectChangedFields = (groupItems: AjusteTemporario[]): string[] => {
                    const fields: string[] = [];
                    const first = groupItems[0];
                    // Compare against original contract equipment values
                    for (const aj of groupItems) {
                      const ce = ces.find(c => c.equipamento_id === aj.equipamento_id);
                      if (!ce) continue;
                      if (Number(aj.valor_hora) !== Number(ce.valor_hora) && !fields.includes("Valor/Hora")) fields.push("Valor/Hora");
                      if (Number(aj.valor_hora_excedente) !== Number(ce.valor_hora_excedente) && !fields.includes("Valor Hora Excedente")) fields.push("Valor Hora Excedente");
                      if (Number(aj.hora_minima) !== Number(ce.hora_minima) && !fields.includes("Hora Mínima")) fields.push("Hora Mínima");
                      if (Number(aj.horas_contratadas) !== Number(ce.horas_contratadas) && !fields.includes("Horas Contratadas")) fields.push("Horas Contratadas");
                    }
                    return fields.length > 0 ? fields : ["Valor/Hora", "Hora Mínima", "Horas Contratadas"];
                  };

                  return groups.map(group => {
                    const aj = group.items[0];
                    const ativo = isAjusteAtivo(aj);
                    const passado = new Date() > new Date(aj.data_fim);

                    if (group.isBulk) {
                      const changedFields = detectChangedFields(group.items);
                      return (
                        <div key={group.key} className={`rounded-lg border p-4 space-y-2 ${ativo ? "border-accent bg-accent/5" : passado ? "border-muted bg-muted/30 opacity-60" : "border-border"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CalendarRange className="h-4 w-4 text-accent" />
                              <span className="font-medium text-sm">Ajuste de Contrato</span>
                              <Badge variant="secondary" className="text-xs">Lote · {group.items.length} equip.</Badge>
                              {ativo && <Badge className="bg-accent text-accent-foreground text-xs">Ativo</Badge>}
                              {passado && <Badge variant="outline" className="text-xs">Encerrado</Badge>}
                              {!ativo && !passado && <Badge variant="outline" className="text-xs text-muted-foreground">Agendado</Badge>}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAjuste(aj)}><Pencil className="h-3 w-3" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir Ajuste em Lote</AlertDialogTitle>
                                    <AlertDialogDescription>Tem certeza? Todos os {group.items.length} ajustes deste lote serão removidos.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={async () => { for (const item of group.items) { await handleDeleteAjuste(item.id); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir Todos</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-xs text-muted-foreground">Alterações:</span>
                            {changedFields.map(f => {
                              if (f === "Hora Mínima" && aj.hora_minima === 0) {
                                return <Badge key={f} variant="outline" className="text-xs bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400">Apenas Horas Trabalhadas</Badge>;
                              }
                              return <Badge key={f} variant="outline" className="text-xs bg-accent/10 border-accent/30">{f}</Badge>;
                            })}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Período:</span> <span className="font-medium">{formatLocalDate(aj.data_inicio)} - {formatLocalDate(aj.data_fim)}</span></div>
                            {changedFields.includes("Valor/Hora") && <div><span className="text-muted-foreground">Valor/h:</span> <span className="font-medium">{fmt(aj.valor_hora)}</span></div>}
                            {changedFields.includes("Hora Mínima") && <div><span className="text-muted-foreground">Hora Mín:</span> <span className="font-medium">{aj.hora_minima === 0 ? "0h (Apenas H. Trabalhadas)" : `${aj.hora_minima}h`}</span></div>}
                            {changedFields.includes("Horas Contratadas") && <div><span className="text-muted-foreground">Horas Contrat.:</span> <span className="font-medium">{aj.horas_contratadas}h</span></div>}
                          </div>
                          {aj.motivo && aj.motivo.replace("[LOTE] ", "").replace("[LOTE]", "").trim() && <p className="text-xs text-muted-foreground italic">{aj.motivo.replace("[LOTE] ", "").replace("[LOTE]", "")}</p>}
                        </div>
                      );
                    }

                    // Individual adjustment - single equipment
                    const eq = equipamentos.find(e => e.id === aj.equipamento_id);
                    const ce = ces.find(c => c.equipamento_id === aj.equipamento_id);
                    const indivChanges: string[] = [];
                    if (ce) {
                      if (Number(aj.valor_hora) !== Number(ce.valor_hora)) indivChanges.push("Valor/Hora");
                      if (Number(aj.valor_hora_excedente) !== Number(ce.valor_hora_excedente)) indivChanges.push("Valor Hora Excedente");
                      if (Number(aj.hora_minima) !== Number(ce.hora_minima)) indivChanges.push("Hora Mínima");
                      if (Number(aj.horas_contratadas) !== Number(ce.horas_contratadas)) indivChanges.push("Horas Contratadas");
                    }

                    return (
                      <div key={aj.id} className={`rounded-lg border p-4 space-y-2 ${ativo ? "border-accent bg-accent/5" : passado ? "border-muted bg-muted/30 opacity-60" : "border-border"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarRange className="h-4 w-4 text-accent" />
                            <span className="font-medium text-sm">{eq?.tipo} {eq?.modelo} {eq?.tag_placa ? `(${eq.tag_placa})` : ""}</span>
                            <Badge variant="secondary" className="text-xs">Individual</Badge>
                            {ativo && <Badge className="bg-accent text-accent-foreground text-xs">Ativo</Badge>}
                            {passado && <Badge variant="outline" className="text-xs">Encerrado</Badge>}
                            {!ativo && !passado && <Badge variant="outline" className="text-xs text-muted-foreground">Agendado</Badge>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAjuste(aj)}><Pencil className="h-3 w-3" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Ajuste</AlertDialogTitle>
                                  <AlertDialogDescription>Tem certeza? O faturamento voltará a usar os valores originais.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteAjuste(aj.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        {indivChanges.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-xs text-muted-foreground">Alterações:</span>
                            {indivChanges.map(f => {
                              if (f === "Hora Mínima" && aj.hora_minima === 0) {
                                return <Badge key={f} variant="outline" className="text-xs bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400">Apenas Horas Trabalhadas</Badge>;
                              }
                              return <Badge key={f} variant="outline" className="text-xs bg-accent/10 border-accent/30">{f}</Badge>;
                            })}
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Período:</span> <span className="font-medium">{formatLocalDate(aj.data_inicio)} - {formatLocalDate(aj.data_fim)}</span></div>
                          {(indivChanges.length === 0 || indivChanges.includes("Valor/Hora")) && <div><span className="text-muted-foreground">Valor/h:</span> <span className="font-medium">{fmt(aj.valor_hora)}</span></div>}
                          {(indivChanges.length === 0 || indivChanges.includes("Hora Mínima")) && <div><span className="text-muted-foreground">Hora Mín:</span> <span className="font-medium">{aj.hora_minima === 0 ? "0h (Apenas H. Trabalhadas)" : `${aj.hora_minima}h`}</span></div>}
                          {(indivChanges.length === 0 || indivChanges.includes("Horas Contratadas")) && <div><span className="text-muted-foreground">Horas Contrat.:</span> <span className="font-medium">{aj.horas_contratadas}h</span></div>}
                        </div>
                        {aj.motivo && aj.motivo.replace("[LOTE] ", "").replace("[LOTE]", "").trim() && <p className="text-xs text-muted-foreground italic">{aj.motivo.replace("[LOTE] ", "").replace("[LOTE]", "")}</p>}
                      </div>
                    );
                  });
                })()}
              </div>
            </TabsContent>

            <TabsContent value="aditivos" className="space-y-4 mt-4">
              <Button onClick={openNewAditivo} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-2" /> Novo Aditivo
              </Button>
              {aditivos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum aditivo cadastrado para este contrato.</p>
              )}
              <div className="space-y-3">
                {aditivos.map(ad => {
                  const eqs = ad.aditivos_equipamentos || [];
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  const inicio = safeParseLocalDate(ad.data_inicio);
                  const fim = safeParseLocalDate(ad.data_fim);
                  const ativo = inicio && fim ? (hoje >= inicio && hoje <= fim) : false;
                  const futuro = inicio ? (hoje < inicio) : false;
                  const passado = fim ? (hoje > fim) : false;
                  return (
                    <div key={ad.id} className={`rounded-lg border p-4 space-y-3 ${ativo ? "border-accent bg-accent/5" : passado ? "border-muted bg-muted/30 opacity-60" : "border-border"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FilePlus2 className="h-4 w-4 text-accent" />
                          <span className="font-semibold text-sm">Aditivo #{ad.numero}</span>
                          {ativo && <Badge className="bg-accent text-accent-foreground text-xs">Vigente</Badge>}
                          {passado && <Badge variant="outline" className="text-xs">Encerrado</Badge>}
                          {futuro && <Badge variant="outline" className="text-xs text-muted-foreground">Futuro</Badge>}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExportAditivo(ad)} title="Emitir PDF">
                            <FileDown className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAditivo(ad)}><Pencil className="h-3 w-3" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Aditivo</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza que deseja excluir o Aditivo #{ad.numero}? Todos os equipamentos associados serão removidos.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAditivo(ad.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Vigência:</span> <span className="font-medium">{formatLocalDate(ad.data_inicio)} - {formatLocalDate(ad.data_fim)}</span></div>
                        <div><span className="text-muted-foreground">Equipamentos:</span> <span className="font-medium">{eqs.length}</span></div>
                      </div>
                      {ad.motivo && <p className="text-xs text-muted-foreground italic">{ad.motivo}</p>}
                      {eqs.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {eqs.map(ae => {
                            const eq = equipamentos.find(e => e.id === ae.equipamento_id);
                            return (
                              <div key={ae.id} className="flex items-center gap-2 flex-wrap text-xs">
                                <Badge variant="outline" className="text-xs">{eq?.tipo} {eq?.modelo} {eq?.tag_placa ? `(${eq.tag_placa})` : ""}</Badge>
                                <span className="text-muted-foreground">{fmt(ae.valor_hora)}/h · {ae.horas_contratadas}h{ae.hora_minima > 0 ? ` · Mín: ${ae.hora_minima}h` : ""}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="prorrogacao" className="space-y-4 mt-4">
              {ajustesContrato && ajustesContrato.status === "Encerrado" ? (
                <div className="text-center py-8">
                  <Ban className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Este contrato está encerrado e não pode ser prorrogado.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                    <p className="text-sm font-medium">Dados Atuais do Contrato</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Início:</span>{" "}
                        <span className="font-medium">{ajustesContrato ? formatLocalDate(ajustesContrato.data_inicio) : "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Término atual:</span>{" "}
                        <span className="font-medium">{ajustesContrato ? formatLocalDate(ajustesContrato.data_fim) : "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <Label>Nova Data de Término</Label>
                      <Input
                        type="date"
                        value={prorrogacaoForm.nova_data_fim}
                        min={ajustesContrato ? ajustesContrato.data_fim : ""}
                        onChange={(e) => setProrrogacaoForm(prev => ({ ...prev, nova_data_fim: e.target.value }))}
                      />
                      {prorrogacaoForm.nova_data_fim && ajustesContrato && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Prorrogação de {(() => {
                            const d1 = safeParseLocalDate(prorrogacaoForm.nova_data_fim);
                            const d2 = safeParseLocalDate(ajustesContrato.data_fim);
                            if (!d1 || !d2) return "—";
                            return Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
                          })()} dias
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Motivo da Prorrogação</Label>
                      <Input
                        value={prorrogacaoForm.motivo}
                        onChange={(e) => setProrrogacaoForm(prev => ({ ...prev, motivo: e.target.value }))}
                        placeholder="Ex: Extensão de prazo por necessidade do cliente"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleProrrogacao} className="bg-accent text-accent-foreground hover:bg-accent/90">
                      <CalendarPlus className="h-4 w-4 mr-2" /> Prorrogar Contrato
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Cláusulas do Contrato */}
            <TabsContent value="clausulas" className="mt-4">
              {ajustesContrato && (
                <ContratoClausulasTab contratoId={ajustesContrato.id} contrato={ajustesContrato} />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Ajuste Form Dialog */}
      <Dialog open={ajusteFormOpen} onOpenChange={setAjusteFormOpen}>
        <DialogContent className="sm:max-w-xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-accent" />
              {editingAjuste ? "Editar Ajuste" : ajusteTodos ? "Novo Ajuste de Contrato" : "Novo Ajuste Temporário"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editingAjuste && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <Label className="text-sm font-medium">Aplicar a todos os equipamentos</Label>
                  <p className="text-xs text-muted-foreground">O ajuste será aplicado a todos os equipamentos do contrato</p>
                </div>
                <Switch checked={ajusteTodos} onCheckedChange={setAjusteTodos} />
              </div>
            )}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <Label className="text-sm font-medium">Quais campos deseja alterar?</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={ajusteCampos.valor_hora} onCheckedChange={(v) => setAjusteCampos(prev => ({ ...prev, valor_hora: !!v }))} />
                  Valor/Hora
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={ajusteCampos.valor_hora_excedente} onCheckedChange={(v) => setAjusteCampos(prev => ({ ...prev, valor_hora_excedente: !!v }))} />
                  Valor Hora Excedente
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox 
                    checked={ajusteCampos.hora_minima} 
                    onCheckedChange={(v) => {
                      setAjusteCampos(prev => ({ ...prev, hora_minima: !!v }));
                      if (v && ajusteForm.hora_minima === 0) {
                        const ce = getAllEquipForAjuste(ajustesContrato).find(c => c.equipamento_id === ajusteForm.equipamento_ids[0]);
                        const origHoraMinima = ce ? Number(ce.hora_minima) : 0;
                        setAjusteForm(prev => ({ ...prev, hora_minima: origHoraMinima > 0 ? origHoraMinima : 1 }));
                      }
                    }} 
                  />
                  Hora Mínima
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={ajusteCampos.horas_contratadas} onCheckedChange={(v) => setAjusteCampos(prev => ({ ...prev, horas_contratadas: !!v }))} />
                  Horas Contratadas
                </label>
              </div>
              <p className="text-xs text-muted-foreground">Campos não selecionados manterão os valores originais do equipamento</p>
            </div>
            
            <div className="p-3 rounded-lg border bg-yellow-500/5 border-yellow-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold text-foreground">Cobrar apenas hora trabalhada</Label>
                  <p className="text-xs text-muted-foreground">O equipamento será cobrado estritamente pelas horas medidas na medição, desconsiderando a hora mínima.</p>
                </div>
                <Switch
                  checked={ajusteCampos.hora_minima && ajusteForm.hora_minima === 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setAjusteCampos(prev => ({ ...prev, hora_minima: true }));
                      setAjusteForm(prev => ({ ...prev, hora_minima: 0 }));
                    } else {
                      const ce = getAllEquipForAjuste(ajustesContrato).find(c => c.equipamento_id === ajusteForm.equipamento_ids[0]);
                      const origHoraMinima = ce ? Number(ce.hora_minima) : 0;
                      setAjusteForm(prev => ({ ...prev, hora_minima: origHoraMinima > 0 ? origHoraMinima : 1 }));
                    }
                  }}
                />
              </div>
            </div>
            {!ajusteTodos && !editingAjuste && (
            <div>
              <Label className="mb-2 block">Equipamentos <Badge variant="secondary" className="ml-2 text-xs">{ajusteForm.equipamento_ids.length} selecionado{ajusteForm.equipamento_ids.length !== 1 ? "s" : ""}</Badge></Label>
              <div className="border rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                {getAllEquipForAjuste(ajustesContrato, true).map(ce => {
                  const isCaminhao = ce.equipamentos.tipo?.toUpperCase().includes("CAMINH");
                  const eqLabel = isCaminhao
                    ? `${ce.equipamentos.tipo}${ce.equipamentos.tag_placa ? ` (${ce.equipamentos.tag_placa})` : ""}`
                    : `${ce.equipamentos.tipo}${ce.equipamentos.numero_serie ? ` - NS: ${ce.equipamentos.numero_serie}` : ""}`;
                  const isChecked = ajusteForm.equipamento_ids.includes(ce.equipamento_id);
                  return (
                    <label key={ce.equipamento_id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) => {
                          setAjusteForm(prev => ({
                            ...prev,
                            equipamento_ids: v
                              ? [...prev.equipamento_ids, ce.equipamento_id]
                              : prev.equipamento_ids.filter(id => id !== ce.equipamento_id),
                          }));
                        }}
                      />
                      <span className="truncate">{eqLabel}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            )}
            {!ajusteTodos && editingAjuste && (
            <div>
              <Label>Equipamento</Label>
              <Input disabled value={(() => {
                const allEquip = getAllEquipForAjuste(ajustesContrato);
                const ce = allEquip.find(c => c.equipamento_id === ajusteForm.equipamento_ids[0]);
                return ce ? getEquipLabel(ce.equipamentos) : "";
              })()} />
            </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Data Início</Label><Input type="date" value={ajusteForm.data_inicio} onChange={(e) => setAjusteForm(prev => ({ ...prev, data_inicio: e.target.value }))} /></div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={ajusteForm.data_fim} onChange={(e) => setAjusteForm(prev => ({ ...prev, data_fim: e.target.value }))} />
                {!ajusteForm.data_fim && <p className="text-xs text-muted-foreground mt-1">Se vazio, usará a data final do contrato/aditivo ({getMaxDataFim(ajustesContrato) ? formatLocalDate(getMaxDataFim(ajustesContrato)) : "—"})</p>}
              </div>
            </div>
            {ajusteTodos && ajusteForm.data_inicio && (() => {
              const ajInicio = parseLocalDate(ajusteForm.data_inicio);
              const ajFim = parseLocalDate(ajusteForm.data_fim || getMaxDataFim(ajustesContrato));
              const equipIds = new Set<string>();
              const ces = getAllEquipForAjuste(ajustesContrato);
              ces.forEach(ce => {
                const ent = ce.data_entrega ? parseLocalDate(ce.data_entrega) : null;
                const dev = ce.data_devolucao ? parseLocalDate(ce.data_devolucao) : null;
                if (ent && ent > ajFim) return;
                if (dev && dev < ajInicio) return;
                equipIds.add(ce.equipamento_id);
              });
              const contratoAditivos = aditivos.filter(a => a.contrato_id === ajustesContrato?.id);
              contratoAditivos.forEach(ad => {
                const adI = parseLocalDate(ad.data_inicio);
                const adF = parseLocalDate(ad.data_fim);
                if (adI > ajFim || adF < ajInicio) return;
                (ad.aditivos_equipamentos || []).forEach(ae => {
                  const ent = ae.data_entrega ? parseLocalDate(ae.data_entrega) : null;
                  const dev = ae.data_devolucao ? parseLocalDate(ae.data_devolucao) : null;
                  if (ent && ent > ajFim) return;
                  if (dev && dev < ajInicio) return;
                  equipIds.add(ae.equipamento_id);
                });
              });
              const names = Array.from(equipIds).map(id => {
                const eq = equipamentos.find(e => e.id === id);
                return eq ? `${eq.tipo} ${eq.modelo}${eq.tag_placa ? ` (${eq.tag_placa})` : ""}` : id;
              });
              return (
                <div className="p-3 rounded-lg border bg-accent/10 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{equipIds.size} equipamento{equipIds.size !== 1 ? "s" : ""}</Badge>
                    <span className="text-xs text-muted-foreground">serão afetados neste período</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {names.map((n, i) => (
                      <Badge key={i} variant="outline" className="text-xs font-normal">{n}</Badge>
                    ))}
                  </div>
                  {equipIds.size === 0 && <p className="text-xs text-destructive">Nenhum equipamento ativo neste período.</p>}
                </div>
              );
            })()}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={!ajusteCampos.valor_hora ? "opacity-40 pointer-events-none" : ""}><Label>Valor/Hora (R$)</Label><CurrencyInput value={ajusteForm.valor_hora} onValueChange={(v) => setAjusteForm(prev => ({ ...prev, valor_hora: v }))} /></div>
              <div className={!ajusteCampos.valor_hora_excedente ? "opacity-40 pointer-events-none" : ""}><Label>Valor Hora Excedente (R$)</Label><CurrencyInput value={ajusteForm.valor_hora_excedente} onValueChange={(v) => setAjusteForm(prev => ({ ...prev, valor_hora_excedente: v }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={!ajusteCampos.hora_minima ? "opacity-40 pointer-events-none" : ""}><Label>Hora Mínima</Label><Input type="number" value={ajusteForm.hora_minima ?? ""} onChange={(e) => setAjusteForm(prev => ({ ...prev, hora_minima: Number(e.target.value) }))} placeholder="0 = sem mínimo" /></div>
              <div className={!ajusteCampos.horas_contratadas ? "opacity-40 pointer-events-none" : ""}><Label>Horas Contratadas</Label><Input type="number" value={ajusteForm.horas_contratadas || ""} onChange={(e) => setAjusteForm(prev => ({ ...prev, horas_contratadas: Number(e.target.value) }))} /></div>
            </div>
            <div><Label>Motivo</Label><Input value={ajusteForm.motivo} onChange={(e) => setAjusteForm(prev => ({ ...prev, motivo: e.target.value }))} placeholder="Ex: Reajuste temporário por demanda extra" /></div>
            <div>
              <Label>Desconto (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={ajusteForm.desconto_percentual || ""} onChange={(e) => setAjusteForm(prev => ({ ...prev, desconto_percentual: Number(e.target.value) }))} placeholder="0 = sem desconto" />
              {ajusteForm.desconto_percentual > 0 && <p className="text-xs text-muted-foreground mt-1">Será aplicado {ajusteForm.desconto_percentual}% de desconto sobre o valor calculado</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjusteFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAjuste} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aditivo Form Dialog */}
      <Dialog open={aditivoFormOpen} onOpenChange={setAditivoFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus2 className="h-5 w-5 text-accent" />
              {editingAditivo ? `Editar Aditivo #${aditivoForm.numero}` : "Novo Aditivo"}
            </DialogTitle>
            <DialogDescription>
              {ajustesContrato && `Contrato: ${ajustesContrato.empresas?.nome || ''}${ajustesContrato.empresas?.obra ? ` (Obra: ${ajustesContrato.empresas.obra})` : ''}`}
            </DialogDescription>
          </DialogHeader>


          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Nº do Aditivo</Label>
                <Input type="number" value={aditivoForm.numero} onChange={(e) => setAditivoForm(prev => ({ ...prev, numero: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={aditivoForm.data_inicio} onChange={(e) => setAditivoForm(prev => ({ ...prev, data_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={aditivoForm.data_fim} onChange={(e) => setAditivoForm(prev => ({ ...prev, data_fim: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Motivo do Aditivo</Label>
              <Input value={aditivoForm.motivo} onChange={(e) => setAditivoForm(prev => ({ ...prev, motivo: e.target.value }))} placeholder="Ex: Renovação com reajuste de valores" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={aditivoForm.observacoes} onChange={(e) => setAditivoForm(prev => ({ ...prev, observacoes: e.target.value }))} rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Equipamentos do Aditivo</Label>
              <SearchableSelect
                value=""
                onValueChange={addAditivoEquipamento}
                placeholder="Adicionar equipamento..."
                searchPlaceholder="Pesquisar equipamento..."
                options={equipamentos.filter(e => !aditivoForm.equipamentos.some(fe => fe.equipamento_id === e.id)).map(e => ({ value: e.id, label: `${e.tipo} ${e.modelo}${e.tag_placa ? ` (${e.tag_placa})` : ""}${e.numero_serie ? ` - NS: ${e.numero_serie}` : ""}` }))}
              />
              {aditivoForm.equipamentos.length > 0 && (
                <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                  {aditivoForm.equipamentos.map(fe => {
                    const eq = equipamentos.find(e => e.id === fe.equipamento_id);
                    if (!eq) return null;
                    return (
                      <div key={fe.equipamento_id} className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {eq.tipo} {eq.modelo}
                            {eq.tag_placa && <span className="text-muted-foreground ml-2 font-mono">({eq.tag_placa})</span>}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAditivoEquipamento(fe.equipamento_id)}>
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Valor/Hora (R$)</Label>
                            <CurrencyInput value={fe.valor_hora} onValueChange={(v) => updateAditivoEquipItem(fe.equipamento_id, "valor_hora", v)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Valor Hora Excedente (R$)</Label>
                            <CurrencyInput value={fe.valor_hora_excedente} onValueChange={(v) => updateAditivoEquipItem(fe.equipamento_id, "valor_hora_excedente", v)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Horas Contratadas</Label>
                            <Input type="number" value={fe.horas_contratadas || ""} onChange={(e) => updateAditivoEquipItem(fe.equipamento_id, "horas_contratadas", Number(e.target.value))} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Hora Mínima</Label>
                            <Input type="number" value={fe.hora_minima || ""} onChange={(e) => updateAditivoEquipItem(fe.equipamento_id, "hora_minima", Number(e.target.value))} className="h-8 text-sm" placeholder="0 = sem mínimo" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Data de Entrega</Label>
                            <Input type="date" value={fe.data_entrega || ""} onChange={(e) => updateAditivoEquipItem(fe.equipamento_id, "data_entrega", e.target.value)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Data de Devolução</Label>
                            <Input type="date" value={fe.data_devolucao || ""} onChange={(e) => updateAditivoEquipItem(fe.equipamento_id, "data_devolucao", e.target.value)} className="h-8 text-sm" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground pt-1">{aditivoForm.equipamentos.length} equipamento(s)</p>
                </div>
              )}
              {aditivoForm.equipamentos.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum equipamento. Adicione pelo menos um.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAditivoFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAditivo} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar Aditivo</Button>
          </DialogFooter>
        </DialogContent>
       </Dialog>

      {/* Finalizar Contrato Dialog */}
      <Dialog open={finalizarDialogOpen} onOpenChange={setFinalizarDialogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Finalizar Contrato
            </DialogTitle>
            <DialogDescription>
              Ao finalizar, o contrato será marcado como "Encerrado" e não aparecerá mais como ativo no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 py-2 pr-1">
            {finalizarContrato && (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
                <p className="text-sm font-medium">
                  {finalizarContrato.empresas?.nome}
                  {finalizarContrato.empresas?.obra && ` (Obra: ${finalizarContrato.empresas.obra})`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Período original: {formatLocalDate(finalizarContrato.data_inicio)} - {formatLocalDate(finalizarContrato.data_fim)}
                </p>
              </div>
            )}

            {finalizarLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Verificando pendências...</div>
            ) : temPendencias ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-yellow-600 font-medium text-sm">
                    <AlertTriangle className="h-4 w-4" /> Pendências encontradas
                  </div>
                  <p className="text-xs text-muted-foreground">Resolva as pendências abaixo antes de encerrar, ou prossiga ciente dos itens em aberto.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {finalizarPendencias.equipsSemDevolucao.length > 0 && (
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" /> Equipamentos sem Devolução ({finalizarPendencias.equipsSemDevolucao.length})
                      </p>
                      <p className="text-xs text-muted-foreground">Estes equipamentos não possuem data de devolução registrada no contrato.</p>
                      {finalizarPendencias.equipsSemDevolucao.map((eq, i) => (
                        <div key={i} className="flex justify-between text-xs text-muted-foreground border-b pb-1 last:border-0">
                          <span className="font-medium">{eq.label}</span>
                          <span>Entrega: {eq.data_entrega ? formatLocalDate(eq.data_entrega) : "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {finalizarPendencias.faturasPendentes.length > 0 && (
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium text-destructive">Faturas Pendentes ({finalizarPendencias.faturasPendentes.length})</p>
                      {finalizarPendencias.faturasPendentes.map(f => (
                        <div key={f.id} className="flex justify-between text-xs text-muted-foreground border-b pb-1 last:border-0">
                          <span>{f.periodo} — <Badge variant="outline" className="text-[10px]">{f.status}</Badge></span>
                          <span>R$ {f.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {finalizarPendencias.medicoesAbertas.length > 0 && (
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium text-destructive">Medições sem Fatura ({finalizarPendencias.medicoesAbertas.length})</p>
                      <p className="text-xs text-muted-foreground">Existem {finalizarPendencias.medicoesAbertas.length} registros de horímetro nos últimos 60 dias que não foram cobertos por faturas aprovadas.</p>
                    </div>
                  )}

                  {finalizarPendencias.gastosNaoFaturados.length > 0 && (
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium text-destructive">Gastos não Faturados ({finalizarPendencias.gastosNaoFaturados.length})</p>
                      {finalizarPendencias.gastosNaoFaturados.slice(0, 5).map(g => (
                        <div key={g.id} className="flex justify-between text-xs text-muted-foreground border-b pb-1 last:border-0">
                          <span>{g.descricao} — {formatLocalDate(g.data)}</span>
                          <span>R$ {g.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      {finalizarPendencias.gastosNaoFaturados.length > 5 && (
                        <p className="text-xs text-muted-foreground">... e mais {finalizarPendencias.gastosNaoFaturados.length - 5} itens</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : !finalizarLoading && (
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                  <CheckCircle2 className="h-4 w-4" /> Nenhuma pendência encontrada
                </div>
                <p className="text-xs text-muted-foreground">O contrato pode ser encerrado sem restrições.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Data de Encerramento</Label>
                <Input
                  type="date"
                  value={finalizarForm.data_encerramento}
                  onChange={(e) => setFinalizarForm(prev => ({ ...prev, data_encerramento: e.target.value }))}
                />
              </div>
              <div>
                <Label>Motivo do Encerramento</Label>
                <Input
                  value={finalizarForm.motivo}
                  onChange={(e) => setFinalizarForm(prev => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ex: Término natural do contrato"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizarDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleFinalizar} variant={temPendencias ? "destructive" : "default"} disabled={finalizarLoading}>
              <Ban className="h-4 w-4 mr-2" /> {temPendencias ? "Finalizar mesmo assim" : "Finalizar Contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
        <TabsContent value="propostas">
          <PropostasContent />
        </TabsContent>
        <TabsContent value="modelo">
          <ModeloClausulasTab />
        </TabsContent>
        <TabsContent value="dossie">
          <ContratosDossieTab />
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default Contratos;
