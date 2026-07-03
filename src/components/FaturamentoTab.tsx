import { useState, useEffect, useMemo } from "react";
import { getEquipLabel, getVencimento as getVencimentoGlobal, getDisplayStatus as getDisplayStatusGlobal } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DollarSign, FileDown, FileText, Plus, Pencil, Trash2, Eye, TrendingUp, TrendingDown, Clock, AlertTriangle, ShieldCheck, XCircle, CheckCircle2, Mail, FileSpreadsheet, Send, UploadCloud, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { withCache, clearCache } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SortableTableHead } from "@/components/SortableTableHead";
import { CurrencyInput } from "@/components/CurrencyInput";
import { ImportFaturasDialog } from "./ImportFaturasDialog";
// jsPDF is now imported dynamically to reduce bundle size
import type jsPDF from "jspdf";


export const isAfterDec2025 = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false;
  const datePart = dateStr.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart >= "2025-12-01";
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    if (year > 2025) return true;
    if (year === 2025 && month >= 11) return true;
    return false;
  } catch {
    return false;
  }
};

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  razao_social: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  obra?: string | null;
  email?: string | null;
}

interface ContaBancaria {
  id: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  titular: string;
  cnpj_cpf: string | null;
  pix: string | null;
}

interface Fatura {
  id: string;
  contrato_id: string;
  numero_sequencial: number;
  emissao: string;
  status: string;
  valor_total: number;
  horas_normais: number;
  horas_excedentes: number;
  periodo_medicao_inicio: string | null;
  periodo_medicao_fim: string | null;
  total_gastos: number;
  numero_nota: string | null;
  conta_bancaria_id: string | null;
  periodo: string;
  valor_hora: number;
  valor_excedente_hora: number;
  empresa_faturamento_id: string | null;
}

interface ContratoRef {
  id: string;
  empresa_id: string;
  prazo_faturamento: number;
  empresas: { nome: string; cnpj: string; obra?: string | null };
  equipamentos: { tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null };
}

interface FaturaEquip {
  id: string;
  faturamento_id: string;
  equipamento_id: string;
  horas_normais: number;
  horas_excedentes: number;
  horas_medidas?: number;
  horas_totais?: number;
  valor_hora: number;
  valor_hora_excedente: number;
  hora_minima?: number;
  valor_total_item?: number;
  primeiro_mes?: boolean;
  considerar_medicao?: boolean;
}

interface EquipamentoInfo {
  id: string;
  tipo: string;
  modelo: string;
  tag_placa: string | null;
}

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

let logoCache: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (logoCache) return logoCache;
  try {
    const resp = await fetch("/images/logo-busato-horizontal.png");
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => { logoCache = reader.result as string; resolve(logoCache); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export const FaturamentoTab = () => {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [contratos, setContratos] = useState<ContratoRef[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoInfo[]>([]);
  const [faturaEquips, setFaturaEquips] = useState<Map<string, FaturaEquip[]>>(new Map());
  const [faturaGastos, setFaturaGastos] = useState<Map<string, { descricao: string; valor: number; tipo: string }[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateItemId, setGenerateItemId] = useState<string | null>(null);
  const [generateNumeroNota, setGenerateNumeroNota] = useState("");
  const [generateObservacoes, setGenerateObservacoes] = useState("");
  const [generateEmissao, setGenerateEmissao] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState(() => sessionStorage.getItem("fat_filterEmpresa") || "all");
  const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem("fat_filterStatus") || "all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingFatura, setEditingFatura] = useState<Fatura | null>(null);
  const [editForm, setEditForm] = useState({ status: "", numero_nota: "", conta_bancaria_id: "", emissao: "", valor_total: 0, observacoes: "" });
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelDate, setCancelDate] = useState(new Date().toISOString().slice(0, 10));
  const [showCanceladas, setShowCanceladas] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [payId, setPayId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveFaturaId, setApproveFaturaId] = useState<string | null>(null);
  const [approveUserId, setApproveUserId] = useState("");
  const [usuarios, setUsuarios] = useState<{ user_id: string; nome: string }[]>([]);

  const { toast } = useToast();
  const { role, profile } = useAuth();
  const [sortCol, setSortCol] = useState(() => sessionStorage.getItem("fat_sortCol") || "emissao");
  const [sortAsc, setSortAsc] = useState(() => {
    const val = sessionStorage.getItem("fat_sortAsc");
    return val !== null ? val === "true" : false;
  });
  const toggleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };

  useEffect(() => { sessionStorage.setItem("fat_filterEmpresa", filterEmpresa); }, [filterEmpresa]);
  useEffect(() => { sessionStorage.setItem("fat_filterStatus", filterStatus); }, [filterStatus]);
  useEffect(() => { sessionStorage.setItem("fat_sortCol", sortCol); sessionStorage.setItem("fat_sortAsc", String(sortAsc)); }, [sortCol, sortAsc]);

  const fetchData = async (force = false) => {
    if (force) clearCache();
    const [fatRes, ctRes, empRes, contasRes, equipRes] = await withCache("faturamento_tab", 5 * 60 * 1000, async () => Promise.all([
      supabase.from("faturamento").select("*").in("status", ["Pendente", "Aprovado", "Pago", "Cancelado"]).order("emissao", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("contratos").select("*"),
      supabase.from("empresas").select("id, nome, cnpj, razao_social, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, inscricao_estadual, inscricao_municipal, obra, email"),
      supabase.from("contas_bancarias").select("*"),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie"),
      supabase.from("profiles").select("user_id, nome").order("nome")
    ]));

    const empresasMap = new Map((empRes.data || []).map(e => [e.id, e]));
    const equipMap = new Map((equipRes.data || []).map(e => [e.id, e]));
    const contratosList = (ctRes.data || []).map(c => ({
      ...c,
      empresas: empresasMap.get(c.empresa_id) || null,
      equipamentos: equipMap.get(c.equipamento_id) || null,
    }));

    if (fatRes.data) setFaturas(fatRes.data as unknown as Fatura[]);
    setContratos(contratosList as unknown as ContratoRef[]);
    if (empRes.data) setEmpresas(empRes.data as unknown as Empresa[]);
    if (contasRes.data) setContas(contasRes.data as unknown as ContaBancaria[]);
    if (equipRes.data) setEquipamentos(equipRes.data as unknown as EquipamentoInfo[]);
    if (equipRes[4] && equipRes[4].data) setUsuarios(equipRes[4].data as any); // Using the 5th element from Promise.all

    // Load faturamento_equipamentos for all faturas
    if (fatRes.data && fatRes.data.length > 0) {
      const ids = fatRes.data.map((f: any) => f.id);
      const [feRes, fgLinkRes] = await Promise.all([
        supabase.from("faturamento_equipamentos").select("*").in("faturamento_id", ids),
        supabase.from("faturamento_gastos").select("faturamento_id, gasto_id").in("faturamento_id", ids),
      ]);
      if (feRes.data) {
        const map = new Map<string, FaturaEquip[]>();
        feRes.data.forEach((fe: any) => {
          const list = map.get(fe.faturamento_id) || [];
          list.push(fe as FaturaEquip);
          map.set(fe.faturamento_id, list);
        });
        setFaturaEquips(map);
      }
      
      const fgLinks = fgLinkRes.data || [];
      const linkIds = fgLinks.map((l: any) => l.gasto_id).filter(Boolean);
      let gastosDetailsMap = new Map<string, any>();
      if (linkIds.length > 0) {
        const { data: gastosDetails } = await supabase.from("gastos").select("id, descricao, valor, tipo").in("id", linkIds);
        if (gastosDetails) {
          gastosDetailsMap = new Map(gastosDetails.map(g => [g.id, g]));
        }
      }

      const map = new Map<string, { descricao: string; valor: number; tipo: string }[]>();
      fgLinks.forEach((fg: any) => {
        const g = gastosDetailsMap.get(fg.gasto_id);
        if (!g) return;
        const list = map.get(fg.faturamento_id) || [];
        list.push({ descricao: g.descricao, valor: Number(g.valor), tipo: g.tipo });
        map.set(fg.faturamento_id, list);
      });
      setFaturaGastos(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getContrato = (contratoId: string) => contratos.find(c => c.id === contratoId);
  const getEmpresa = (empresaId: string) => empresas.find(e => e.id === empresaId);
  const getEquipamento = (equipId: string) => equipamentos.find(e => e.id === equipId);
  const getConta = (contaId: string | null) => contaId ? contas.find(c => c.id === contaId) : null;

  const getVencimento = (fatura: Fatura) => {
    const ct = getContrato(fatura.contrato_id);
    return getVencimentoGlobal(fatura, ct);
  };

  const getDisplayStatus = (fatura: Fatura) => {
    const ct = getContrato(fatura.contrato_id);
    return getDisplayStatusGlobal(fatura, ct, "faturamento");
  };


  const filteredFaturas = useMemo(() => {
    return faturas.filter(f => {
      if (f.status === "Pendente" || f.status === "Aguardando Aprovação") return false;

      if (f.status === "Cancelado" && !showCanceladas && filterStatus !== "Cancelado") return false;

      if (filterStatus !== "all") {
        const status = getDisplayStatus(f);
        if (filterStatus !== status) return false;
      }
      if (filterEmpresa !== "all") {
        const ct = getContrato(f.contrato_id);
        if (ct?.empresa_id !== filterEmpresa) return false;
      }
      return true;
    });
  }, [faturas, filterEmpresa, filterStatus, contratos, showCanceladas]);

  const sortedFaturas = useMemo(() => {
    return [...filteredFaturas].sort((a, b) => {
      let cmp = 0;
      const ctA = getContrato(a.contrato_id);
      const ctB = getContrato(b.contrato_id);
      switch (sortCol) {
        case "numero": cmp = (a.numero_nota || String(a.numero_sequencial)).localeCompare(b.numero_nota || String(b.numero_sequencial)); break;
        case "empresa": cmp = (ctA?.empresas?.nome || "").localeCompare(ctB?.empresas?.nome || ""); break;
        case "emissao": cmp = (a.emissao || "").localeCompare(b.emissao || ""); break;
        case "vencimento": {
          const vencA = getVencimento(a);
          const vencB = getVencimento(b);
          cmp = (vencA ? vencA.getTime() : 0) - (vencB ? vencB.getTime() : 0);
          break;
        }
        case "valor": cmp = Number(a.valor_total) - Number(b.valor_total); break;
        case "status": cmp = getDisplayStatus(a).localeCompare(getDisplayStatus(b)); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredFaturas, sortCol, sortAsc]);

  // KPIs
  const kpis = useMemo(() => {
    let faturadoVal = 0;
    let faturadoQty = 0;
    let pendenteVal = 0;
    let pendenteQty = 0;
    let atrasoVal = 0;
    let atrasoQty = 0;

    faturas.forEach(f => {
      if (f.status === "Pendente" || f.status === "Aguardando Aprovação") return;

      if (filterEmpresa !== "all") {
        const ct = getContrato(f.contrato_id);
        if (ct?.empresa_id !== filterEmpresa) return;
      }

      const status = getDisplayStatus(f);
      const val = Number(f.valor_total || 0);

      if (status === "Pago") {
        faturadoVal += val;
        faturadoQty++;
      } else if (status === "A Faturar" || status === "Pendente") {
        pendenteVal += val;
        pendenteQty++;
      } else if (status === "Em Atraso") {
        atrasoVal += val;
        atrasoQty++;
      }
    });

    return {
      faturadoVal, faturadoQty,
      pendenteVal, pendenteQty,
      atrasoVal, atrasoQty
    };
  }, [faturas, filterEmpresa, contratos]);

  const openEdit = (fatura: Fatura) => {
    setEditingFatura(fatura);
    setEditForm({
      status: fatura.status,
      numero_nota: fatura.numero_nota || "",
      conta_bancaria_id: fatura.conta_bancaria_id || "",
      emissao: fatura.emissao || "",
      valor_total: Number(fatura.valor_total) || 0,
      observacoes: (fatura as any).observacoes || "",
    });
    setEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingFatura) return;
    if (editingFatura.numero_nota || editingFatura.status === "Aprovado" || editingFatura.status === "Pago") {
      toast({ title: "Erro", description: "Esta fatura já foi emitida, aprovada ou paga e não pode mais ser editada.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("faturamento").update({
      status: editForm.status,
      numero_nota: editForm.numero_nota || null,
      conta_bancaria_id: editForm.conta_bancaria_id || null,
      emissao: editForm.emissao || null,
      valor_total: Number(editForm.valor_total),
      observacoes: editForm.observacoes || null,
    }).eq("id", editingFatura.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Fatura atualizada" });
    setEditDialog(false);
    fetchData(true);

    // Auto GDrive sync if token is active
    const cachedToken = localStorage.getItem("gdrive_access_token");
    const expiresAtStr = localStorage.getItem("gdrive_token_expires_at");
    const isTokenValid = cachedToken && expiresAtStr && parseInt(expiresAtStr) > Date.now();
    if (isTokenValid) {
      const updatedFatura = { ...editingFatura, ...editForm } as Fatura;
      if (isAfterDec2025(updatedFatura.emissao || updatedFatura.periodo_inicio)) {
        handleUploadToGDrive(updatedFatura);
      } else {
        console.log("Fatura anterior a dez/2025. Sincronização automática pulada.");
      }
    }
  };

  const handleEmitirFatura = async (id: string, numeroNota: string, emissaoDate: string, observacoes: string) => {
    const { error } = await supabase
      .from("faturamento")
      .update({
        numero_nota: numeroNota || null,
        data_aprovacao: emissaoDate,
        emissao: emissaoDate,
        observacoes: observacoes || "",
      } as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Fatura emitida", description: "O número da fatura e observações foram salvos." });
    setGenerateDialogOpen(false);
    setGenerateItemId(null);
    setGenerateNumeroNota("");
    setGenerateObservacoes("");
    fetchData();

    // Auto GDrive sync if token is active
    const cachedToken2 = localStorage.getItem("gdrive_access_token");
    const expiresAtStr2 = localStorage.getItem("gdrive_token_expires_at");
    const isTokenValid2 = cachedToken2 && expiresAtStr2 && parseInt(expiresAtStr2) > Date.now();
    if (isTokenValid2) {
      const savedFatura = faturas.find(f => f.id === id);
      if (savedFatura) {
        const updatedFatura = { ...savedFatura, numero_nota: numeroNota, emissao: emissaoDate, observacoes } as Fatura;
        if (isAfterDec2025(updatedFatura.emissao || updatedFatura.periodo_inicio)) {
          handleUploadToGDrive(updatedFatura);
        } else {
          console.log("Fatura anterior a dez/2025. Sincronização automática pulada.");
        }
      }
    }
  };

  const handleCancelFatura = async (id: string, reason: string, cDate?: string) => {
    try {
      const faturaToCancel = faturas.find(f => f.id === id);
      if (!faturaToCancel) return;

      const dateToUse = cDate || new Date().toISOString().slice(0, 10);

      // 1. Fetch current items
      const [feRes, fgRes] = await Promise.all([
        supabase.from("faturamento_equipamentos").select("*").eq("faturamento_id", id),
        supabase.from("faturamento_gastos").select("*").eq("faturamento_id", id),
      ]);

      if (feRes.error) throw feRes.error;
      if (fgRes.error) throw fgRes.error;

      // 2. Clone the faturamento row for a new measurement
      const { id: oldId, created_at, ...faturaData } = faturaToCancel as any;
      const { data: newFatura, error: insertError } = await supabase.from("faturamento").insert([{
        ...faturaData,
        status: "Aprovado",
        numero_nota: null,
        emissao: null,
        data_aprovacao: null,
        cancelamento_justificativa: null,
        cancelamento_data: null,
        // Also clear observacoes related to cancellation if needed, but keeping it is fine or clear it
        observacoes: (faturaData.observacoes || "").replace(/\\[Cancelada.*?\\]/g, "").trim()
      }]).select("id").single();

      if (insertError) throw insertError;
      const newId = newFatura.id;

      // 3. Clone equipments and gastos to the new measurement
      if (feRes.data && feRes.data.length > 0) {
        const newFe = feRes.data.map((fe: any) => {
          const { id: feId, created_at: feCreatedAt, ...rest } = fe;
          return { ...rest, faturamento_id: newId };
        });
        const { error: feErr } = await supabase.from("faturamento_equipamentos").insert(newFe);
        if (feErr) throw feErr;
      }

      if (fgRes.data && fgRes.data.length > 0) {
        const newFg = fgRes.data.map((fg: any) => {
          const { id: fgId, created_at: fgCreatedAt, ...rest } = fg;
          return { ...rest, faturamento_id: newId };
        });
        const { error: fgErr } = await supabase.from("faturamento_gastos").insert(newFg);
        if (fgErr) throw fgErr;
      }

      // 4. Mark old as cancelled
      const { error: updateError } = await supabase
        .from("faturamento")
        .update({ status: "Cancelado", cancelamento_justificativa: reason, cancelamento_data: dateToUse })
        .eq("id", id);
      
      if (updateError) throw updateError;

      toast({
        title: "Fatura Cancelada",
        description: "A fatura foi cancelada e a medição foi disponibilizada novamente em Emitir Medição.",
        variant: "default",
      });
      setCancelDialogOpen(false);
      setCancelId(null);
      setCancelReason("");
      try { setCancelDate(new Date().toISOString().slice(0, 10)); } catch {}
      fetchData(true);
    } catch (err: any) {
      toast({
        title: "Erro ao cancelar fatura",
        description: err.message || "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const generateInvoicePDF = async (fatura: Fatura, isUploadOnly = false) => {
    const ct = getContrato(fatura.contrato_id);
    if (!ct) return;
    // Use alternative billing company if set
    const empresa = fatura.empresa_faturamento_id
      ? getEmpresa(fatura.empresa_faturamento_id) || getEmpresa(ct.empresa_id)
      : getEmpresa(ct.empresa_id);
    if (!empresa) return;
    const conta = getConta(fatura.conta_bancaria_id);
    const vencimento = getVencimento(fatura);
    const equips = faturaEquips.get(fatura.id) || [];
    const logo = await loadLogo();

    const { data: busatoData } = await supabase
      .from("empresas")
      .select("*")
      .ilike("nome", "%busato%")
      .limit(1)
      .single();

    const busatoNome = busatoData?.razao_social || busatoData?.nome || "BUSATO LOCAÇÕES E SERVIÇOS LTDA";
    const busatoEndereco = [
      busatoData?.endereco_logradouro,
      busatoData?.endereco_numero,
      busatoData?.endereco_complemento,
    ].filter(Boolean).join(", ") || "AV NOSSA SENHORA DA PENHA, 595, SALA 510";
    const busatoBairroLine = [
      busatoData?.endereco_bairro,
      busatoData?.endereco_cidade,
      busatoData?.endereco_uf,
      busatoData?.endereco_cep ? `CEP:${busatoData.endereco_cep}` : "",
    ].filter(Boolean).join(", ") || "SANTA LUCIA, VITORIA, ES, CEP: 29056-250";
    const busatoCnpj = busatoData?.cnpj || "54.167.719/0001-40";
    const busatoIE = busatoData?.inscricao_estadual || "";
    const busatoCidade = busatoData?.endereco_cidade || "VITORIA";
    const busatoUf = busatoData?.endereco_uf || "ES";

    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const mLeft = 15;
    const mRight = 15;
    const mTop = 15;
    const contentW = pageW - mLeft - mRight;
    const lineC = [0, 0, 0] as [number, number, number];
    const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const docLabel = fatura.numero_nota || String(fatura.numero_sequencial).padStart(3, "0");

    doc.setDrawColor(...lineC);
    doc.setLineWidth(0.3);

    let y = mTop;

    // ── OUTER BORDER ──
    doc.rect(mLeft, y, contentW, pageH - mTop - 15);

    // ── HEADER ROW: logo left, info right ──
    const headerH = 28;
    const logoColW = contentW * 0.4;
    const infoColW = contentW - logoColW;

    // Vertical divider in header
    doc.line(mLeft + logoColW, y, mLeft + logoColW, y + headerH);
    // Bottom of header
    doc.line(mLeft, y + headerH, mLeft + contentW, y + headerH);

    // Logo
    if (logo) {
      doc.addImage(logo, "PNG", mLeft + 6, y + 5, 55, 18);
    }

    // Right column: company info
    const infoX = mLeft + logoColW + 2;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`FATURA DE LOCAÇÃO ${docLabel}`, infoX, y + 6);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(busatoNome.toUpperCase(), infoX, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    if (busatoEndereco) doc.text(busatoEndereco, infoX, y + 14.5);
    if (busatoBairroLine) doc.text(busatoBairroLine, infoX, y + 17.5);
    const cnpjLine = [busatoCnpj ? `CNPJ: ${busatoCnpj}` : "", busatoIE ? ` Inscrição Estadual  ${busatoIE}` : ""].filter(Boolean).join("  -");
    if (cnpjLine) doc.text(cnpjLine, infoX, y + 21);

    y += headerH;

    // ── DATA DA EMISSÃO ──
    const emissaoH = 7;
    doc.line(mLeft, y + emissaoH, mLeft + contentW, y + emissaoH);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const dateEmissao = fatura.emissao ? parseLocalDate(fatura.emissao).toLocaleDateString("pt-BR") : "—";
    doc.text(`DATA DA EMISSÃO: ${dateEmissao}`, mLeft + contentW - 2, y + 5, { align: "right" });
    y += emissaoH;

    // ── VALOR DA FATURA ──
    const valorH = 8;
    doc.line(mLeft, y + valorH, mLeft + contentW, y + valorH);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("VALOR DA FATURA   R$", mLeft + contentW * 0.25, y + 6, { align: "center" });
    doc.text(fmt(Number(fatura.valor_total)), mLeft + contentW * 0.7, y + 6, { align: "center" });
    y += valorH;

    // ── Helper for form fields ──
    const drawFormField = (label: string, value: string, x: number, yPos: number, w: number, h: number = 10) => {
      doc.rect(x, yPos, w, h);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(label, x + 1.5, yPos + 3.5);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(value || "", x + 1.5, yPos + 7.5);
    };

    // ── NOME/RAZÃO SOCIAL ──
    const clienteNome = `${empresa.razao_social || empresa.nome}${empresa.obra ? ` - OBRA: ${empresa.obra}` : ""}`;
    drawFormField("NOME/RAZÃO SOCIAL", clienteNome.toUpperCase(), mLeft, y, contentW);
    y += 10;

    // ── ENDEREÇO ──
    const endereco = [empresa.endereco_logradouro, empresa.endereco_numero, `Bairro ${empresa.endereco_bairro || ""}`].filter(Boolean).join(", ");
    drawFormField("ENDEREÇO", endereco, mLeft, y, contentW);
    y += 10;

    // ── MUNICÍPIO | ESTADO ──
    const halfW = contentW / 2;
    drawFormField("MUNICÍPIO", empresa.endereco_cidade || "", mLeft, y, halfW);
    drawFormField("ESTADO", (empresa.endereco_uf || "").toUpperCase(), mLeft + halfW, y, halfW);
    y += 10;

    // ── CNPJ | INSCRIÇÃO MUNICIPAL | INSCRIÇÃO ESTADUAL ──
    const thirdW = contentW / 3;
    drawFormField("CNPJ", empresa.cnpj, mLeft, y, thirdW);
    drawFormField("INSCRIÇÃO MUNICIPAL", empresa.inscricao_municipal || "", mLeft + thirdW, y, thirdW);
    drawFormField("INSCRIÇÃO ESTADUAL", empresa.inscricao_estadual || "", mLeft + thirdW * 2, y, thirdW);
    y += 10;

    // ── CONDIÇÕES PAGAMENTO | DATA DE VENCIMENTO | LOCAL DE PAGAMENTO ──
    drawFormField("CONDIÇÕES PAGAMENTO", "Crédito Bancário", mLeft, y, thirdW);
    drawFormField("DATA DE VENCIMENTO", vencimento ? vencimento.toLocaleDateString("pt-BR") : "—", mLeft + thirdW, y, thirdW);
    const localPagto = conta ? `${busatoCidade} ${busatoUf}` : "—";
    drawFormField("LOCAL DE PAGAMENTO", localPagto, mLeft + thirdW * 2, y, thirdW);
    y += 10;

    // ── ENDEREÇO DE COBRANÇA ──
    const cobrancaLabelH = 5;
    doc.rect(mLeft, y, contentW, cobrancaLabelH);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text("ENDEREÇO DE COBRANÇA:", mLeft + 1.5, y + 3.5);
    y += cobrancaLabelH;

    if (conta) {
      const bankLine1 = `O PAGAMENTO DEVERÁ SER EFETUADO ATRAVÉS DE DEPÓSITO BANCÁRIO PARA ${busatoNome.toUpperCase()}`;
      const bankLine2 = `BANCO ${conta.banco}, AGÊNCIA ${conta.agencia} ${busatoCidade} - ${busatoUf}. CONTA ${conta.tipo_conta.toUpperCase()} Nº${conta.conta}`;
      const bankBoxH = 12;
      doc.rect(mLeft, y, contentW, bankBoxH);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(bankLine1, mLeft + contentW / 2, y + 4.5, { align: "center" });
      doc.text(bankLine2, mLeft + contentW / 2, y + 8.5, { align: "center" });
      y += bankBoxH;
    } else {
      doc.rect(mLeft, y, contentW, 6);
      y += 6;
    }

    // ── DESCRIPTION TABLE ──
    const descColWidths = [contentW * 0.42, contentW * 0.1, contentW * 0.18, contentW * 0.18, contentW * 0.12];
    const descHeaders = ["DESCRIÇÃO", "QUANT.", "VALOR UNIT", "TOTAL", "CFOP"];

    // Header row
    const thH = 6;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    let cx = mLeft;
    descHeaders.forEach((h, i) => {
      doc.rect(cx, y, descColWidths[i], thH);
      doc.text(h, cx + descColWidths[i] / 2, y + 4, { align: "center" });
      cx += descColWidths[i];
    });
    y += thH;

    // Data row
    const rowH = 8;
    const descBody = [
      "Locação de Equipamento, sem Cessão de Mão de Obra.",
      "1,00",
      `R$     ${fmt(Number(fatura.valor_total))}`,
      `R$     ${fmt(Number(fatura.valor_total))}`,
      "",
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    cx = mLeft;
    descBody.forEach((val, i) => {
      doc.rect(cx, y, descColWidths[i], rowH);
      if (i === 0) {
        doc.text(val, cx + 2, y + 5.5);
      } else {
        doc.text(val, cx + descColWidths[i] / 2, y + 5.5, { align: "center" });
      }
      cx += descColWidths[i];
    });
    y += rowH;

    // Empty rows area (visual space like the template)
    const emptyH = 45;
    cx = mLeft;
    descColWidths.forEach(w => {
      doc.rect(cx, y, w, emptyH);
      cx += w;
    });
    y += emptyH;

    // ── VALOR TOTAL DA FATURA ──
    const totalRowH = 8;
    // Left cells merged
    const totalLabelW = descColWidths[0] + descColWidths[1] + descColWidths[2];
    const totalValW = descColWidths[3] + descColWidths[4];
    doc.rect(mLeft, y, totalLabelW, totalRowH);
    doc.rect(mLeft + totalLabelW, y, totalValW, totalRowH);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("VALOR TOTAL DA FATURA", mLeft + totalLabelW - 2, y + 5.5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`R$          ${fmt(Number(fatura.valor_total))}`, mLeft + totalLabelW + totalValW / 2, y + 5.5, { align: "center" });
    y += totalRowH;

    // ── AUTORIZADO ──
    const autoH = 6;
    doc.rect(mLeft, y, contentW, autoH);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("AUTORIZADO CONFORME LEI COMPLEMENTAR 116/03", mLeft + contentW / 2, y + 4, { align: "center" });
    y += autoH;

    // ── INFORMAÇÕES COMPLEMENTARES ──
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Informações complementares:", mLeft + 1.5, y + 5);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const lineH = 5;

    if (equips.length > 0) {
      equips.forEach(fe => {
        const eq = getEquipamento(fe.equipamento_id);
        if (eq) {
          const qtStr = `01 ${eq.tipo} ${eq.modelo}${eq.tag_placa ? ` - ${eq.tag_placa}` : ""}`;
          doc.text(qtStr, mLeft + 1.5, y);
          y += lineH;
        }
      });
    } else {
      const eq = ct?.equipamentos;
      if (eq) {
        doc.text(`01 ${eq.tipo} ${eq.modelo}${eq.tag_placa ? ` - ${eq.tag_placa}` : ""}`, mLeft + 1.5, y);
        y += lineH;
      }
    }

    if (fatura.periodo_medicao_inicio && fatura.periodo_medicao_fim) {
      doc.text(
        `Período - ${parseLocalDate(fatura.periodo_medicao_inicio).toLocaleDateString("pt-BR")} a ${parseLocalDate(fatura.periodo_medicao_fim).toLocaleDateString("pt-BR")}`,
        mLeft + 1.5, y
      );
      y += lineH;
    }

    // (Custos adicionais removidos da fatura a pedido do usuário — manter apenas observações)

    // Observações
    const obs = (fatura as any).observacoes;
    if (obs && obs.trim()) {
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.text("Observações:", mLeft + 1.5, y);
      y += lineH;
      doc.setFont("helvetica", "normal");
      const obsLines = doc.splitTextToSize(obs, contentW - 4);
      obsLines.forEach((line: string) => {
        doc.text(line, mLeft + 1.5, y);
        y += lineH;
      });
    }

    // ── SIGNATURE BLOCK (positioned dynamically below content) ──
    y = Math.max(y + 10, pageH - 15 - 45);

    // Signature area

    // Signature line
    const sigLineY = y + 25;
    doc.setLineWidth(0.3);
    doc.line(mLeft + contentW / 2 - 30, sigLineY, mLeft + contentW / 2 + 30, sigLineY);

    // Company name under signature
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Busato Locações e Serviços LTDA", mLeft + contentW / 2, sigLineY + 6, { align: "center" });

    const saveLabel = fatura.numero_nota || String(fatura.numero_sequencial).padStart(3, "0");
    if (isUploadOnly) {
      return doc;
    }
    doc.save(`fatura_locacao_${saveLabel}.pdf`);
    toast({ title: "PDF gerado", description: `Fatura ${saveLabel} exportada com sucesso.` });
  };

  const handleUploadToGDrive = async (item: Fatura) => {
    const cachedToken = localStorage.getItem("gdrive_access_token");
    const expiresAtStr = localStorage.getItem("gdrive_token_expires_at");
    const isTokenValid = cachedToken && expiresAtStr && parseInt(expiresAtStr) > Date.now();
    if (!isTokenValid) {
      toast({
        title: "Google Drive Desconectado",
        description: "Por favor, conecte sua conta Google Drive na aba Dossiê primeiro.",
        variant: "destructive"
      });
      return;
    }

    if (!isAfterDec2025(item.emissao || item.periodo_inicio)) {
      toast({
        title: "Sincronização Ignorada",
        description: "Esta fatura é anterior a dezembro de 2025 e não será enviada ao Google Drive."
      });
      return;
    }

    const ct = getContrato(item.contrato_id);
    if (!ct) {
      toast({ title: "Erro", description: "Contrato não encontrado para esta fatura.", variant: "destructive" });
      return;
    }

    setSyncingId(item.id);
    toast({ title: "Google Drive", description: "Preparando upload do documento..." });

    try {
      // 1. Get or create contract folder
      const { gdriveCreateFolder, gdriveListFiles, gdriveUploadFile } = await import("@/lib/gdrive");
      
      let folderId = ct.gdrive_folder_id;
      if (!folderId) {
        // Find if folder already exists in root folder
        const configRes = await supabase.from("gdrive_config").select("*").order("created_at", { ascending: false });
        const configData = configRes.data && configRes.data.length > 0 ? configRes.data[0] : null;
        let rootFolderId = configData?.root_folder_id;
        if (!rootFolderId) {
          const rootFolder = await gdriveCreateFolder("Dossiê Busato Locações", null, cachedToken);
          rootFolderId = rootFolder.id;
          await supabase.from("gdrive_config").insert({ client_id: configData?.client_id || "", root_folder_id: rootFolderId });
        }

        const clientName = ct.empresas?.nome || "Cliente Avulso";
        const contractLabel = `Contrato - ID ${ct.id.slice(0, 8)}`;
        const contractFolder = await gdriveCreateFolder(`${clientName} - ${contractLabel}`, rootFolderId, cachedToken);
        folderId = contractFolder.id;

        await supabase.from("contratos").update({ gdrive_folder_id: folderId }).eq("id", ct.id);
        ct.gdrive_folder_id = folderId;
      }

      // 2. Get or create '3. Financeiro' subfolder
      const subfolders = await gdriveListFiles(folderId, cachedToken);
      let finFolder = subfolders.find(f => f.name === "3. Financeiro" && f.mimeType === "application/vnd.google-apps.folder");
      let finFolderId = finFolder?.id;
      if (!finFolderId) {
        const newFolder = await gdriveCreateFolder("3. Financeiro", folderId, cachedToken);
        finFolderId = newFolder.id;
      }

      const label = item.numero_nota || String(item.numero_sequencial).padStart(3, "0");
      const filename = `Fatura_Locacao_${label}_${item.emissao || item.periodo_inicio}.pdf`;

      // Check for duplicate file
      const existingFiles = await gdriveListFiles(finFolderId, cachedToken);
      if (existingFiles.some(f => f.name === filename)) {
        toast({
          title: "Documento já existe",
          description: `A fatura "${filename}" já está no Google Drive. Sincronização evitada para não gerar duplicidade.`
        });
        setSyncingId(null);
        return;
      }

      // 3. Generate PDF and upload
      const doc = await generateInvoicePDF(item, true) as any;
      if (!doc) throw new Error("Falha ao gerar o documento PDF.");
      const blob = doc.output("blob");

      await gdriveUploadFile(blob, filename, finFolderId, cachedToken);

      toast({
        title: "Sucesso",
        description: `Fatura "${filename}" salva no Google Drive (Financeiro) com sucesso!`
      });
    } catch (err: any) {
      console.error("Erro no upload para o Drive:", err);
      toast({
        title: "Erro no upload",
        description: err.message || String(err),
        variant: "destructive"
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSendEmail = async (fatura: Fatura) => {
    try {
      const ct = getContrato(fatura.contrato_id);
      if (!ct) {
        toast({ title: "Erro", description: "Contrato não encontrado para esta fatura.", variant: "destructive" });
        return;
      }

      // Use alternative billing company if set
      const empresa = fatura.empresa_faturamento_id
        ? getEmpresa(fatura.empresa_faturamento_id) || getEmpresa(ct.empresa_id)
        : getEmpresa(ct.empresa_id);

      if (!empresa) {
        toast({ title: "Erro", description: "Empresa não encontrada para esta fatura.", variant: "destructive" });
        return;
      }

      const empName = empresa.nome || "";
      const empEmail = empresa.email || "";
      const obra = empresa.obra || "";

      // Fetch additional contacts from empresas_contatos
      const { data: contacts } = await supabase
        .from("empresas_contatos")
        .select("email")
        .eq("empresa_id", ct.empresa_id);

      const additionalEmails = (contacts || [])
        .map(c => c.email)
        .filter(Boolean) as string[];

      const allEmails = [empEmail, ...additionalEmails].filter(Boolean);
      const emailsString = allEmails.join(",");

      const inicioFmt = fatura.periodo_medicao_inicio
        ? parseLocalDate(fatura.periodo_medicao_inicio).toLocaleDateString("pt-BR")
        : "";
      const fimFmt = fatura.periodo_medicao_fim
        ? parseLocalDate(fatura.periodo_medicao_fim).toLocaleDateString("pt-BR")
        : "";

      const periodString = inicioFmt && fimFmt ? `referente ao período de ${inicioFmt} a ${fimFmt}` : "";
      const docLabel = fatura.numero_nota || String(fatura.numero_sequencial).padStart(3, "0");

      const subject = encodeURIComponent(`Fatura de Locação ${docLabel} - ${empName}${obra ? ` (Obra: ${obra})` : ""} - BUSATO LOCAÇÕES`);
      const body = encodeURIComponent(
        `Prezado(a),\n\nSegue em anexo a Fatura de Locação ${docLabel} ${periodString} para ${empName}.\n\nFicamos à disposição para esclarecimentos.\n\nAtenciosamente,\nBUSATO LOCAÇÕES E SERVIÇOS LTDA`
      );

      // Generate and download PDF
      await generateInvoicePDF(fatura);

      // Open email client
      window.open(`mailto:${emailsString}?subject=${subject}&body=${body}`, "_self");
      toast({ title: "PDF da Fatura gerado", description: "Anexe o PDF baixado ao e-mail que será aberto." });
    } catch (err: any) {
      toast({ title: "Erro ao enviar e-mail", description: err.message, variant: "destructive" });
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Pago": return "bg-success text-success-foreground";
      case "Em Atraso": return "bg-destructive text-destructive-foreground";
      case "Cancelado": return "bg-muted text-muted-foreground";
      default: return "bg-warning text-warning-foreground";
    }
  };

  const empresasComFatura = useMemo(() => {
    const ids = new Set<string>();
    faturas.forEach(f => {
      const ct = getContrato(f.contrato_id);
      if (ct) ids.add(ct.empresa_id);
    });
    return empresas.filter(e => ids.has(e.id));
  }, [faturas, contratos, empresas]);

  const exportRelatorioFinanceiro = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const logo = await loadLogo();
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();

    // Letterhead
    let y = 12;
    if (logo) doc.addImage(logo, "PNG", 14, y, 48, 12);
    doc.setFontSize(16);
    doc.setTextColor(60, 60, 60);
    doc.text("Relatório Financeiro", pageW - 14, y + 8, { align: "right" });
    y += 18;
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.7);
    doc.line(14, y, pageW - 14, y);
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, pageW - 14, y, { align: "right" });
    y += 6;

    const data = filteredFaturas;
    const headers = ["Nº Fatura", "Empresa", "CNPJ", "Período Medição", "Emissão", "Vencimento", "Valor Total (R$)", "Status"];
    const rows = data.map(f => {
      const ct = getContrato(f.contrato_id);
      const venc = getVencimento(f);
      const status = getDisplayStatus(f);
      return [
        f.numero_nota || "—",
        ct?.empresas?.nome || "",
        ct?.empresas?.cnpj || "",
        f.periodo_medicao_inicio && f.periodo_medicao_fim
          ? `${parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR")}`
          : "—",
        f.emissao ? parseLocalDate(f.emissao).toLocaleDateString("pt-BR") : "—",
        venc ? venc.toLocaleDateString("pt-BR") : "—",
        Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        status,
      ];
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: y,
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 6: { halign: "right" } },
      didParseCell: (cellData: any) => {
        if (cellData.section === "body" && cellData.column.index === 7) {
          const s = cellData.cell.raw;
          if (s === "Em Atraso") { cellData.cell.styles.textColor = [192, 57, 43]; cellData.cell.styles.fontStyle = "bold"; }
          else if (s === "A Faturar" || s === "Pendente") { cellData.cell.styles.textColor = [243, 156, 18]; }
          else if (s === "Pago") { cellData.cell.styles.textColor = [39, 174, 96]; }
        }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    const total = data.reduce((s, f) => f.status === "Cancelado" ? s : s + Number(f.valor_total), 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(41, 128, 185);
    doc.text(`Total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageW - 14, finalY, { align: "right" });

    doc.save(`relatorio_financeiro_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: "Relatório exportado", description: "O relatório financeiro foi gerado com sucesso." });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card shadow-sm border border-border/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Aprovadas (A Faturar)</p>
              <h3 className="text-xl font-extrabold mt-1 text-indigo-600">
                R$ {kpis.pendenteVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">{kpis.pendenteQty} fatura(s)</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border border-border/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recebidas (Pagas)</p>
              <h3 className="text-xl font-extrabold mt-1 text-success">
                R$ {kpis.faturadoVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">{kpis.faturadoQty} fatura(s)</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center text-success shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border border-border/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Em Atraso</p>
              <h3 className="text-xl font-extrabold mt-1 text-destructive">
                R$ {kpis.atrasoVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">{kpis.atrasoQty} fatura(s)</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-wrap gap-3 flex-1">
          <div className="w-64">
            <SearchableSelect
              value={filterEmpresa}
              onValueChange={setFilterEmpresa}
              placeholder="Todas as Empresas"
              searchPlaceholder="Pesquisar empresa..."
              options={[
                { value: "all", label: "Todas as Empresas" },
                ...empresasComFatura.map(e => ({ value: e.id, label: `${e.nome}${e.obra ? ` (Obra: ${e.obra})` : ""}` })),
              ]}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="A Faturar">A Faturar</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Pago">Pago</SelectItem>
              <SelectItem value="Em Atraso">Em Atraso</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2 mr-4">
            <Checkbox id="show-canceladas-tab" checked={showCanceladas} onCheckedChange={(checked) => setShowCanceladas(!!checked)} />
            <label htmlFor="show-canceladas-tab" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Mostrar canceladas</label>
          </div>
          <Button onClick={() => setImportDialogOpen(true)} variant="outline" size="sm" className="bg-background/50 backdrop-blur-sm border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 shrink-0">
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Importar Histórico
        </Button>
        <Button variant="outline" size="sm" onClick={exportRelatorioFinanceiro} className="shrink-0">
          <FileText className="h-4 w-4 mr-1" /> Relatório Financeiro
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {/* Cabeçalho sutil (desktop) */}
        {sortedFaturas.length > 0 && (
          <div className="hidden md:flex items-center px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("numero")}>
              Nº Fatura {sortCol === "numero" && (sortAsc ? "↑" : "↓")}
            </div>
            <div className="flex-1 min-w-0 cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("empresa")}>
              Empresa / Equipamento {sortCol === "empresa" && (sortAsc ? "↑" : "↓")}
            </div>
            <div className="w-[160px] cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("emissao")}>
              Datas {sortCol === "emissao" && (sortAsc ? "↑" : "↓")}
            </div>
            <div className="w-[140px] text-right cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("valor")}>
              Valor {sortCol === "valor" && (sortAsc ? "↑" : "↓")}
            </div>
            <div className="w-[120px] text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("status")}>
              Status {sortCol === "status" && (sortAsc ? "↑" : "↓")}
            </div>
            <div className="w-[180px] text-right">Ações</div>
          </div>
        )}

        {sortedFaturas.map(f => {
          const ct = getContrato(f.contrato_id);
          const status = getDisplayStatus(f);
          return (
            <div key={f.id} className="group bg-card hover:bg-accent/5 border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 transition-all relative">
              
              {/* Nº Fatura */}
              <div className="md:w-[120px] flex flex-col justify-center">
                <span className="font-mono font-bold text-sm text-foreground">
                  {f.numero_nota || String(f.numero_sequencial).padStart(3, "0")}
                </span>
                {f.status === "Aprovado" && !f.numero_nota && !f.emissao && (
                  <Badge variant="outline" className="mt-1 text-[9px] py-0 px-1 border-warning text-warning bg-warning/5 font-sans font-normal w-fit whitespace-nowrap">
                    Pendente de Emissão
                  </Badge>
                )}
              </div>

              {/* Empresa / Equipamento */}
              <div className="flex-1 min-w-0 pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-foreground truncate">{ct?.empresas?.nome || "—"}</h3>
                  {ct?.empresas?.obra && (
                    <Badge variant="secondary" className="font-normal text-[10px] py-0 px-1.5 bg-accent/10 text-accent hover:bg-accent/20 border-accent/20 truncate max-w-[120px]">
                      {ct.empresas.obra}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono mb-1">{ct?.empresas?.cnpj}</p>
                
                {f.empresa_faturamento_id && (() => {
                  const ef = empresas.find(e => e.id === f.empresa_faturamento_id);
                  return ef ? <p className="text-[10px] text-warning mb-1 font-sans">Faturar: {ef.nome}{ef.obra ? ` (Obra: ${ef.obra})` : ""}</p> : null;
                })()}

                <div className="flex items-center gap-1.5 mt-1.5">
                  <Badge variant="outline" className="text-[10px] bg-muted/30 border-muted-foreground/20 font-medium text-sidebar">
                    {getEquipLabel(ct?.equipamentos)}
                  </Badge>
                </div>
              </div>

              {/* Datas */}
              <div className="md:w-[160px] flex flex-col pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <span>Emissão: <strong className="text-foreground font-medium">{f.emissao ? parseLocalDate(f.emissao).toLocaleDateString("pt-BR") : "—"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <span>Venc.: <strong className="text-foreground font-medium">{(() => { const venc = getVencimento(f); return venc ? venc.toLocaleDateString("pt-BR") : "—"; })()}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 opacity-80">
                  <span>Período: {f.periodo_medicao_inicio && f.periodo_medicao_fim
                    ? `${parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR")}`
                    : "—"}</span>
                </div>
              </div>

              {/* Valor */}
              <div className="md:w-[140px] md:text-right flex flex-col justify-center pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0">
                <span className="font-bold text-sm text-foreground">R$ {Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              {/* Status */}
              <div className="md:w-[120px] flex md:justify-center items-center pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0">
                <Badge className={statusColor(status)}>{status}</Badge>
              </div>

              {/* Ações */}
              <div className="md:w-[180px] flex justify-end gap-1 pt-2 md:pt-0 mt-2 md:mt-0 flex-wrap">
                {f.status === "Aprovado" && (!f.numero_nota || !f.emissao) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                    title="Emitir Fatura"
                    onClick={() => {
                      setGenerateItemId(f.id);
                      setGenerateNumeroNota("");
                      setGenerateEmissao(new Date().toISOString().slice(0, 10));
                      
                      const ct = getContrato(f.contrato_id);
                      const obra = ct?.empresas?.obra;
                      const inicio = f.periodo_medicao_inicio ? parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR") : "";
                      const fim = f.periodo_medicao_fim ? parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR") : "";
                      
                      let obs = "";
                      if (obra) {
                        obs += `Obra: ${obra}`;
                      }
                      if (inicio && fim) {
                        if (obs) obs += " - ";
                        obs += `Período: ${inicio} a ${fim}`;
                      }
                      setGenerateObservacoes(obs);
                      setGenerateDialogOpen(true);
                    }}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </Button>
                )}

                {(role === "admin" || role === "superadmin" || f.status === "Aprovado" || f.status === "Pago") && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/50" title="Gerar PDF" onClick={() => generateInvoicePDF(f)}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-accent"
                      onClick={() => handleUploadToGDrive(f)}
                      disabled={syncingId === f.id}
                      title="Salvar no Google Drive"
                    >
                      {syncingId === f.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                  title="Enviar por E-mail"
                  onClick={() => handleSendEmail(f)}
                >
                  <Mail className="h-4 w-4" />
                </Button>
                {(!f.numero_nota && f.status !== "Aprovado" && f.status !== "Pago") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-accent hover:text-accent hover:bg-accent/10"
                    title="Editar Fatura"
                    onClick={() => openEdit(f)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {f.status !== "Pago" && f.status !== "Cancelado" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                    title="Confirmar Pagamento"
                    onClick={() => setPayId(f.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
                {((f.status !== "Aprovado" && f.status !== "Pago") || role === "admin" || role === "master") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Cancelar Fatura"
                    onClick={() => {
                      setCancelId(f.id);
                      setCancelReason("");
                      setCancelDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>

            </div>
          );
        })}
        {!loading && sortedFaturas.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border border-dashed">
            Nenhuma fatura encontrada
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-accent" />
              Editar Fatura {editingFatura ? (editingFatura.numero_nota || String(editingFatura.numero_sequencial).padStart(3, "0")) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Aprovado">Aprovado</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nº da Nota Fiscal</Label>
              <Input value={editForm.numero_nota} onChange={e => setEditForm(p => ({ ...p, numero_nota: e.target.value }))} placeholder="Ex: NF-001234" />
            </div>
            <div>
              <Label>Conta Bancária</Label>
              <Select value={editForm.conta_bancaria_id || "none"} onValueChange={v => setEditForm(p => ({ ...p, conta_bancaria_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.banco} - Ag {c.agencia} / CC {c.conta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Emissão</Label>
              <Input type="date" value={editForm.emissao} onChange={e => setEditForm(p => ({ ...p, emissao: e.target.value }))} />
            </div>
            <div>
              <Label>Valor Total (R$)</Label>
              <CurrencyInput value={editForm.valor_total} onValueChange={v => setEditForm(p => ({ ...p, valor_total: v }))} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={editForm.observacoes} onChange={e => setEditForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} placeholder="Observações complementares..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Fatura Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Cancelar Fatura
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong className="text-destructive">Aviso importante:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A fatura ficará registrada como "Cancelada".</li>
              <li>Não entrará em cálculos de totais nem KPIs.</li>
              <li>As medições e gastos atrelados a esta fatura serão <strong>liberados</strong> para faturamento futuro.</li>
            </ul>
          </div>
          <div className="space-y-4 py-2">
            <div>
              <Label>Data do Cancelamento <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={cancelDate}
                onChange={e => setCancelDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Justificativa do Cancelamento <span className="text-destructive">*</span></Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Descreva obrigatoriamente o motivo do cancelamento..."
                rows={3}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setCancelId(null); }}>Cancelar</Button>
            <Button
              onClick={() => cancelId && handleCancelFatura(cancelId, cancelReason, cancelDate)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!cancelReason.trim() || !cancelDate}
            >
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Invoice Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              Emitir Fatura
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Informe o número da fatura e, se desejar, uma observação:</p>
          <div className="space-y-4">
            <div>
              <Label>Nº Fatura</Label>
              <Input value={generateNumeroNota} onChange={(e) => setGenerateNumeroNota(e.target.value)} placeholder="Ex: FAT001" />
            </div>
            <div>
              <Label>Data de Emissão</Label>
              <Input type="date" value={generateEmissao} onChange={(e) => setGenerateEmissao(e.target.value)} />
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={generateObservacoes} onChange={(e) => setGenerateObservacoes(e.target.value)} placeholder="Observações sobre a fatura (opcional)" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => generateItemId && handleEmitirFatura(generateItemId, generateNumeroNota, generateEmissao, generateObservacoes)} className="bg-success text-success-foreground hover:bg-success/90">
              Emitir Fatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <AlertDialog open={!!payId} onOpenChange={open => !open && setPayId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja alterar o status desta fatura para Pago?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (payId) {
                  const { error } = await supabase
                    .from("faturamento")
                    .update({ status: "Pago" })
                    .eq("id", payId);
                  if (error) {
                    toast({ title: "Erro", description: error.message, variant: "destructive" });
                  } else {
                    toast({ title: "Fatura paga", description: "O status da fatura foi alterado para Pago." });
                    fetchData(true);
                  }
                  setPayId(null);
                }
              }}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <ImportFaturasDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={() => fetchData(true)}
        empresasMap={new Map(empresas.map(e => [e.id, e]))}
        contratos={contratos}
      />
    </div>
  );
};
