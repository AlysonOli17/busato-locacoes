import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Search, Receipt, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, TrendingDown, FileDown, FileSpreadsheet, Settings2, Hash, Landmark, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel, addLetterhead } from "@/lib/exportUtils";
import { ContasBancariasDialog, type ContaBancaria } from "@/components/ContasBancariasDialog";

interface ContratoEquip {
  equipamento_id: string;
  valor_hora: number;
  valor_hora_excedente: number;
  horas_contratadas: number;
  hora_minima: number;
  data_entrega: string | null;
  data_devolucao: string | null;
  equipamentos?: { tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null };
}

interface ContratoRef {
  id: string;
  valor_hora: number;
  horas_contratadas: number;
  equipamento_id: string;
  data_inicio: string;
  data_fim: string;
  observacoes: string | null;
  dia_medicao_inicio: number;
  dia_medicao_fim: number;
  prazo_faturamento: number;
  empresas: { nome: string; cnpj: string; contato: string | null; telefone: string | null };
  equipamentos: { tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null };
  contratos_equipamentos: ContratoEquip[];
}

interface FaturaEquip {
  equipamento_id: string;
  horas_normais: number;
  horas_excedentes: number;
  valor_hora: number;
  valor_hora_excedente: number;
  hora_minima: number;
  primeiro_mes: boolean;
  horas_medidas: number;
}

interface Fatura {
  id: string;
  contrato_id: string;
  numero_sequencial: number;
  periodo: string;
  horas_normais: number;
  horas_excedentes: number;
  valor_hora: number;
  valor_excedente_hora: number;
  valor_total: number;
  status: string;
  emissao: string;
  numero_nota: string | null;
  periodo_medicao_inicio: string | null;
  periodo_medicao_fim: string | null;
  total_gastos: number;
  contratos: ContratoRef;
  conta_bancaria_id: string | null;
}

interface GastoItem {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data: string;
  equipamento_id: string;
}

// Per-equipment form state
interface EquipFormItem {
  equipamento_id: string;
  tipo: string;
  modelo: string;
  tag_placa: string | null;
  horas_medidas: number;
  horas_normais: number;
  horas_excedentes: number;
  valor_hora: number;
  valor_hora_excedente: number;
  hora_minima: number;
  horas_contratadas: number;
  primeiro_mes: boolean;
  data_entrega: string | null;
  data_devolucao: string | null;
  proporcional_devolucao: boolean;
  horas_contratadas_original: number;
  hora_minima_original: number;
  ajuste: any | null;
  aditivo: any | null;
  aditivo_numero: number | null;
}

// Parse "YYYY-MM-DD" as local date (avoids UTC timezone shift)
const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const Faturamento = () => {
  const [items, setItems] = useState<Fatura[]>([]);
  const [contratos, setContratos] = useState<ContratoRef[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fatura | null>(null);
  const [search, setSearch] = useState("");
  const [formContratoId, setFormContratoId] = useState("");
  const [formPeriodo, setFormPeriodo] = useState("");
  const [formNumeroNota, setFormNumeroNota] = useState("");
  const [formStatus, setFormStatus] = useState("Pendente");
  const [formMedicaoInicio, setFormMedicaoInicio] = useState("");
  const [formMedicaoFim, setFormMedicaoFim] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMedicoes, setLoadingMedicoes] = useState(false);
  const [equipForms, setEquipForms] = useState<EquipFormItem[]>([]);
  const [gastosEquip, setGastosEquip] = useState<GastoItem[]>([]);
  const [totalGastos, setTotalGastos] = useState(0);
  const [selectedGastos, setSelectedGastos] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [contasDialogOpen, setContasDialogOpen] = useState(false);
  const [formContaBancariaId, setFormContaBancariaId] = useState("");
  const { toast } = useToast();

  // Sinistro alerts state
  interface SinistroAlert {
    id: string;
    equipamento_id: string;
    tipo_sinistro: string;
    franquia: number;
    data_sinistro: string;
    equipamentos?: { tipo: string; modelo: string; tag_placa: string | null };
    apolices?: { seguradora: string };
  }
  const [sinistroAlerts, setSinistroAlerts] = useState<SinistroAlert[]>([]);
  const [sinistroAlertShown, setSinistroAlertShown] = useState(false);

  const fetchData = async () => {
    const [fatRes, ctRes, contasRes] = await Promise.all([
      supabase.from("faturamento").select("*, contratos(id, valor_hora, horas_contratadas, equipamento_id, data_inicio, data_fim, observacoes, dia_medicao_inicio, dia_medicao_fim, prazo_faturamento, empresas(nome, cnpj, contato, telefone), equipamentos(tipo, modelo, tag_placa, numero_serie), contratos_equipamentos(equipamento_id, valor_hora, valor_hora_excedente, horas_contratadas, hora_minima, data_entrega, data_devolucao))").order("numero_sequencial", { ascending: false }),
      supabase.from("contratos").select("id, valor_hora, horas_contratadas, equipamento_id, data_inicio, data_fim, observacoes, dia_medicao_inicio, dia_medicao_fim, prazo_faturamento, empresas(nome, cnpj, contato, telefone), equipamentos(tipo, modelo, tag_placa, numero_serie), contratos_equipamentos(equipamento_id, valor_hora, valor_hora_excedente, horas_contratadas, hora_minima, data_entrega, data_devolucao)").eq("status", "Ativo").order("created_at", { ascending: false }),
      supabase.from("contas_bancarias").select("*").order("banco"),
    ]);
    if (fatRes.data) setItems(fatRes.data as unknown as Fatura[]);
    if (ctRes.data) setContratos(ctRes.data as unknown as ContratoRef[]);
    if (contasRes.data) setContasBancarias(contasRes.data as ContaBancaria[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Fetch measurements + gastos for ALL equipment in a contract
  const fetchMedicoesEGastos = useCallback(async (contratoId: string, inicio: string, fim: string) => {
    const ct = contratos.find(c => c.id === contratoId);
    if (!ct || !inicio || !fim) {
      setEquipForms([]);
      setGastosEquip([]);
      setTotalGastos(0);
      setSelectedGastos(new Set());
      return;
    }
    setLoadingMedicoes(true);

    const ceList = ct.contratos_equipamentos || [];
    // If no contratos_equipamentos, fallback to the main contract equipment
    const allEquipIds = ceList.length > 0 ? ceList.map(ce => ce.equipamento_id) : [ct.equipamento_id];

    // We'll do the final filtering after we know about addendums, but pre-filter obvious cases
    const equipIds = allEquipIds.filter(eqId => {
      const ce = ceList.find(c => c.equipamento_id === eqId);
      // Exclude if data_devolucao exists and is on or before the period start
      if (ce?.data_devolucao && ce.data_devolucao <= inicio) return false;
      return true;
    });

    // Fetch equipment details, gastos, ajustes, and aditivos for all equipment
    const [equipRes, gastosRes, ajustesRes, aditivosRes] = await Promise.all([
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").in("id", equipIds),
      supabase.from("gastos").select("id, descricao, tipo, valor, data, equipamento_id").in("equipamento_id", equipIds).gte("data", inicio).lte("data", fim).order("data", { ascending: false }),
      supabase.from("contratos_equipamentos_ajustes").select("*").eq("contrato_id", contratoId).in("equipamento_id", equipIds).lte("data_inicio", fim).gte("data_fim", inicio),
      supabase.from("contratos_aditivos").select("id, numero, data_inicio, data_fim").eq("contrato_id", contratoId).lte("data_inicio", fim).gte("data_fim", inicio),
    ]);

    // Fetch aditivos_equipamentos for active addendums
    const aditivosData = aditivosRes.data || [];
    let aditivoEquipMap = new Map<string, any>();
    let aditivoExtraEquipIds: string[] = [];
    if (aditivosData.length > 0) {
      const aditivoIds = aditivosData.map(a => a.id);
      const { data: aeData } = await supabase.from("aditivos_equipamentos").select("*").in("aditivo_id", aditivoIds);
      if (aeData) {
        // For each equipment, pick the addendum with highest numero (most recent)
        for (const ae of aeData) {
          const aditivo = aditivosData.find(a => a.id === ae.aditivo_id);
          const existing = aditivoEquipMap.get(ae.equipamento_id);
          const existingAditivo = existing ? aditivosData.find(a => a.id === existing.aditivo_id) : null;
          if (!existing || (aditivo && existingAditivo && aditivo.numero > existingAditivo.numero)) {
            aditivoEquipMap.set(ae.equipamento_id, ae);
          }
        }
        // Find equipment IDs from addendums not already in the contract
        // Also exclude addendum equipment returned before the billing period
        aditivoExtraEquipIds = [...new Set(aeData.map(ae => ae.equipamento_id))].filter(id => {
          if (equipIds.includes(id)) return false;
          const ae = aditivoEquipMap.get(id);
          if (ae?.data_devolucao && ae.data_devolucao <= inicio) return false;
          return true;
        });
      }
    }

    // If addendums add new equipment, fetch their details and measurements too
    let allEquipIdsWithAditivos = [...equipIds];
    if (aditivoExtraEquipIds.length > 0) {
      allEquipIdsWithAditivos = [...equipIds, ...aditivoExtraEquipIds];
      const [extraEquipRes, extraGastosRes] = await Promise.all([
        supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").in("id", aditivoExtraEquipIds),
        supabase.from("gastos").select("id, descricao, tipo, valor, data, equipamento_id").in("equipamento_id", aditivoExtraEquipIds).gte("data", inicio).lte("data", fim).order("data", { ascending: false }),
      ]);
      if (extraEquipRes.data) equipRes.data?.push(...extraEquipRes.data);
      if (extraGastosRes.data) gastosRes.data?.push(...extraGastosRes.data);
    }

    // Fetch measurements per equipment, respecting data_devolucao
    const medPromises = allEquipIdsWithAditivos.map(eqId => {
      const ce = ceList.find(c => c.equipamento_id === eqId);
      const ae = aditivoEquipMap.get(eqId);
      const dataDevolucao = ae?.data_devolucao || ce?.data_devolucao;
      const fimEfetivo = dataDevolucao && dataDevolucao < fim ? dataDevolucao : fim;
      return supabase.from("medicoes").select("equipamento_id, horas_trabalhadas").eq("equipamento_id", eqId).gte("data", inicio).lte("data", fimEfetivo);
    });
    const medResults = await Promise.all(medPromises);
    const medicoesData = medResults.flatMap(r => r.data || []);
    const equipMap = new Map((equipRes.data || []).map(e => [e.id, e]));
    const ajustesData = ajustesRes.data || [];

    // Build per-equipment form items (including extra equipment from addendums)
    // Final filter: exclude equipment whose effective data_devolucao is before the period start
    const filteredEquipIds = allEquipIdsWithAditivos.filter(eqId => {
      const ce = ceList.find(c => c.equipamento_id === eqId);
      const ae = aditivoEquipMap.get(eqId);
      // Effective devolucao: addendum overrides base contract
      const dataDevolucao = ae?.data_devolucao || ce?.data_devolucao || null;
      if (dataDevolucao && dataDevolucao <= inicio) return false;
      return true;
    });
    const newEquipForms: EquipFormItem[] = filteredEquipIds.map(eqId => {
      const ce = ceList.find(c => c.equipamento_id === eqId);
      const eq = equipMap.get(eqId);
      const ajuste = ajustesData.find(a => a.equipamento_id === eqId) || null;
      const aditivo = aditivoEquipMap.get(eqId) || null;

      // Priority: ajuste > aditivo > contrato_equipamento > contrato
      const dataDevolucao = aditivo?.data_devolucao || ce?.data_devolucao || null;

      const filteredMedicoes = medicoesData.filter(m => m.equipamento_id === eqId);
      const horasMedidas = filteredMedicoes.reduce((acc, m) => acc + Number(m.horas_trabalhadas), 0);

      const valorHora = ajuste ? Number(ajuste.valor_hora) : aditivo ? Number(aditivo.valor_hora) : ce ? Number(ce.valor_hora) : Number(ct.valor_hora);
      const valorExcedente = ajuste ? Number(ajuste.valor_hora_excedente) : aditivo ? Number(aditivo.valor_hora_excedente) : ce ? Number(ce.valor_hora_excedente) : valorHora * 1.25;
      let horasContratadas = ajuste ? Number(ajuste.horas_contratadas) : aditivo ? Number(aditivo.horas_contratadas) : ce ? Number(ce.horas_contratadas) : Number(ct.horas_contratadas);
      let horaMinima = ajuste ? Number(ajuste.hora_minima) : aditivo ? Number(aditivo.hora_minima) : ce ? Number(ce.hora_minima) : 0;
      const dataEntrega = aditivo?.data_entrega || ce?.data_entrega || null;
      const horasContratadasOriginal = horasContratadas;
      const horasMinimaOriginal = horaMinima;

      const temDevolucaoNoPeriodo = dataDevolucao && dataDevolucao >= inicio && dataDevolucao < fim;
      if (temDevolucaoNoPeriodo) {
        const inicioDate = parseLocalDate(inicio);
        const fimDate = parseLocalDate(fim);
        const devolucaoDate = parseLocalDate(dataDevolucao);
        const diasTotais = Math.max(1, Math.round((fimDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24)));
        const diasUsados = Math.max(1, Math.round((devolucaoDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const fatorProporcional = diasUsados / diasTotais;
        horasContratadas = Number((horasContratadas * fatorProporcional).toFixed(1));
        horaMinima = Number((horaMinima * fatorProporcional).toFixed(1));
      }

      const aditivoHeader = aditivo ? aditivosData.find(a => a.id === aditivo.aditivo_id) : null;

      return {
        equipamento_id: eqId,
        tipo: eq?.tipo || "",
        modelo: eq?.modelo || "",
        tag_placa: eq?.tag_placa || null,
        horas_medidas: horasMedidas,
        horas_normais: 0,
        horas_excedentes: 0,
        valor_hora: valorHora,
        valor_hora_excedente: valorExcedente,
        hora_minima: horaMinima,
        horas_contratadas: horasContratadas,
        primeiro_mes: false,
        data_entrega: dataEntrega,
        data_devolucao: dataDevolucao,
        proporcional_devolucao: !!temDevolucaoNoPeriodo,
        horas_contratadas_original: horasContratadasOriginal,
        hora_minima_original: horasMinimaOriginal,
        ajuste,
        aditivo: !ajuste ? aditivo : null,
        aditivo_numero: !ajuste && aditivoHeader ? aditivoHeader.numero : null,
      };
    });

    // Calculate hours for each equipment
    newEquipForms.forEach(ef => {
      const applyMinima = ef.hora_minima > 0;
      const horasEfetivas = applyMinima && ef.horas_medidas < ef.hora_minima ? ef.hora_minima : ef.horas_medidas;
      ef.horas_normais = Number(Math.min(horasEfetivas, ef.horas_contratadas).toFixed(1));
      ef.horas_excedentes = Number(Math.max(0, horasEfetivas - ef.horas_contratadas).toFixed(1));
    });

    setEquipForms(newEquipForms);

    // Gastos
    if (gastosRes.data) {
      setGastosEquip(gastosRes.data as GastoItem[]);
      setSelectedGastos(new Set());
      setTotalGastos(0);
    } else {
      setGastosEquip([]);
      setSelectedGastos(new Set());
      setTotalGastos(0);
    }

    setLoadingMedicoes(false);
  }, [contratos]);

  // Toggle gasto selection
  const toggleGasto = (gastoId: string) => {
    setSelectedGastos(prev => {
      const n = new Set(prev);
      n.has(gastoId) ? n.delete(gastoId) : n.add(gastoId);
      return n;
    });
  };
  const toggleAllGastos = () => {
    if (selectedGastos.size === gastosEquip.length) setSelectedGastos(new Set());
    else setSelectedGastos(new Set(gastosEquip.map(g => g.id)));
  };

  // Recalculate totalGastos when selection changes
  useEffect(() => {
    const total = gastosEquip.filter(g => selectedGastos.has(g.id)).reduce((acc, g) => acc + Number(g.valor), 0);
    setTotalGastos(total);
  }, [selectedGastos, gastosEquip]);

  // Recalculate hours helper
  const recalcHours = (ef: EquipFormItem) => {
    // When primeiro_mes is true, hora_minima is already proportionally reduced — still apply it
    const applyMinima = ef.hora_minima > 0;
    const horasEfetivas = applyMinima && ef.horas_medidas < ef.hora_minima ? ef.hora_minima : ef.horas_medidas;
    ef.horas_normais = Number(Math.min(horasEfetivas, ef.horas_contratadas).toFixed(1));
    ef.horas_excedentes = Number(Math.max(0, horasEfetivas - ef.horas_contratadas).toFixed(1));
  };

  // Recalculate hours when primeiroMes toggles
  const togglePrimeiroMes = (idx: number) => {
    setEquipForms(prev => {
      const updated = [...prev];
      const ef = { ...updated[idx] };
      ef.primeiro_mes = !ef.primeiro_mes;
      if (ef.primeiro_mes && ef.data_entrega) {
        // Apply proportional based on data_entrega
        const inicio = formMedicaoInicio;
        const fim = formMedicaoFim;
        if (inicio && fim && ef.data_entrega > inicio && ef.data_entrega <= fim) {
          const inicioDate = parseLocalDate(inicio);
          const fimDate = parseLocalDate(fim);
          const entregaDate = parseLocalDate(ef.data_entrega);
          const diasTotais = Math.max(1, Math.round((fimDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24)));
          const diasUsados = Math.max(1, Math.round((fimDate.getTime() - entregaDate.getTime()) / (1000 * 60 * 60 * 24)));
          const fator = diasUsados / diasTotais;
          ef.horas_contratadas = Number((ef.horas_contratadas_original * fator).toFixed(1));
          ef.hora_minima = Number((ef.hora_minima_original * fator).toFixed(1));
        }
      } else if (!ef.primeiro_mes) {
        // Restore original values (unless proporcional_devolucao is active)
        if (!ef.proporcional_devolucao) {
          ef.horas_contratadas = ef.horas_contratadas_original;
          ef.hora_minima = ef.hora_minima_original;
        }
      }
      recalcHours(ef);
      updated[idx] = ef;
      return updated;
    });
  };

  // Toggle proporcional devolução
  const toggleProporcionalDevolucao = (idx: number) => {
    setEquipForms(prev => {
      const updated = [...prev];
      const ef = { ...updated[idx] };
      ef.proporcional_devolucao = !ef.proporcional_devolucao;
      if (ef.proporcional_devolucao && ef.data_devolucao) {
        // Apply proportional
        const inicio = formMedicaoInicio;
        const fim = formMedicaoFim;
        if (inicio && fim) {
          const inicioDate = parseLocalDate(inicio);
          const fimDate = parseLocalDate(fim);
          const devolucaoDate = parseLocalDate(ef.data_devolucao);
          const diasTotais = Math.max(1, Math.round((fimDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24)));
          const diasUsados = Math.max(1, Math.round((devolucaoDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const fator = diasUsados / diasTotais;
          ef.horas_contratadas = Number((ef.horas_contratadas_original * fator).toFixed(1));
          ef.hora_minima = Number((ef.hora_minima_original * fator).toFixed(1));
        }
      } else {
        // Restore original values
        ef.horas_contratadas = ef.horas_contratadas_original;
        ef.hora_minima = ef.hora_minima_original;
      }
      recalcHours(ef);
      updated[idx] = ef;
      return updated;
    });
  };

  useEffect(() => {
    if (formContratoId && formMedicaoInicio && formMedicaoFim) {
      fetchMedicoesEGastos(formContratoId, formMedicaoInicio, formMedicaoFim);
    } else {
      setEquipForms([]);
      setGastosEquip([]);
      setTotalGastos(0);
      setSelectedGastos(new Set());
    }
  }, [formContratoId, formMedicaoInicio, formMedicaoFim, fetchMedicoesEGastos]);

  const getDisplayStatus = (item: Fatura) => {
    if (item.status === "Pago" || item.status === "Cancelado") return item.status;
    const ct = contratos.find(c => c.id === item.contrato_id);
    const prazo = ct?.prazo_faturamento || 30;
    const emissaoDate = new Date(item.emissao);
    const vencimento = new Date(emissaoDate);
    vencimento.setDate(vencimento.getDate() + prazo);
    if (new Date() > vencimento) return "Em Atraso";
    return item.status;
  };

  const getVencimento = (item: Fatura) => {
    const ct = contratos.find(c => c.id === item.contrato_id);
    const prazo = ct?.prazo_faturamento || 30;
    const emissaoDate = new Date(item.emissao);
    const vencimento = new Date(emissaoDate);
    vencimento.setDate(vencimento.getDate() + prazo);
    return vencimento;
  };

  const filtered = items.filter((i) =>
    i.contratos?.empresas?.nome?.toLowerCase().includes(search.toLowerCase()) ||
    i.periodo.includes(search) ||
    (i.numero_nota || "").includes(search) ||
    String(i.numero_sequencial).includes(search)
  );
  const totalPendente = items.filter((i) => getDisplayStatus(i) === "Pendente" || getDisplayStatus(i) === "Em Atraso").reduce((acc, i) => acc + Number(i.valor_total), 0);

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };

  const getExportData = () => {
    const data = filtered.filter(i => selected.size === 0 || selected.has(i.id));
    const headers = ["Nº", "Empresa", "CNPJ", "Nº Nota", "Período Medição", "Horas Normais", "Horas Excedentes", "Custos Adicionais (R$)", "Valor Total (R$)", "Status"];
    const rows = data.map(i => [
      String(i.numero_sequencial),
      i.contratos?.empresas?.nome || "",
      i.contratos?.empresas?.cnpj || "",
      i.numero_nota || "—",
      i.periodo_medicao_inicio && i.periodo_medicao_fim ? `${parseLocalDate(i.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(i.periodo_medicao_fim).toLocaleDateString("pt-BR")}` : "—",
      String(i.horas_normais),
      String(i.horas_excedentes),
      Number(i.total_gastos || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      Number(i.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      i.status,
    ]);
    return { title: "Relatório de Faturamento", headers, rows, filename: `faturamento_${new Date().toISOString().slice(0, 10)}` };

  };

  const exportDetailedPDF = async () => {
    const data = filtered.filter(i => selected.size === 0 || selected.has(i.id));
    if (data.length === 0) return;

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "portrait" });
    const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

    for (let idx = 0; idx < data.length; idx++) {
      const item = data[idx];
      if (idx > 0) doc.addPage();

      const ct = item.contratos;
      const emp = ct?.empresas;
      const gastosVal = Number(item.total_gastos || 0);

      const tituloFatura = item.numero_nota ? `Nº Nota: ${item.numero_nota}` : `Faturamento Nº ${item.numero_sequencial}`;
      const startY = await addLetterhead(doc, tituloFatura);

      let y = startY;

      // Empresa
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Dados da Empresa", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Campo", "Dados"]],
        body: [
          ["Empresa", emp?.nome || "—"],
          ["CNPJ", emp?.cnpj || "—"],
          ["Contato", emp?.contato || "—"],
          ["Telefone", emp?.telefone || "—"],
          ["Nº Nota", item.numero_nota || "—"],
          ["Período de Medição", item.periodo_medicao_inicio && item.periodo_medicao_fim
            ? `${parseLocalDate(item.periodo_medicao_inicio).toLocaleDateString("pt-BR")} a ${parseLocalDate(item.periodo_medicao_fim).toLocaleDateString("pt-BR")}`
            : "—"],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Equipamentos do contrato
      const ceList = ct?.contratos_equipamentos || [];
      if (ceList.length > 0) {
        // Load equipment details for PDF
        const { data: eqData } = await supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").in("id", ceList.map(ce => ce.equipamento_id));
        const eqMap = new Map((eqData || []).map(e => [e.id, e]));

        // Fetch saved per-equipment details
        const { data: fatEquips } = await supabase.from("faturamento_equipamentos").select("*").eq("faturamento_id", item.id);
        const fatEquipMap = new Map((fatEquips || []).map((fe: any) => [fe.equipamento_id, fe]));

        doc.setFontSize(12);
        doc.setTextColor(41, 128, 185);
        doc.text("Equipamentos e Horas", 14, y);
        y += 2;

        const eqRows = ceList.map(ce => {
          const eq = eqMap.get(ce.equipamento_id);
          const fe = fatEquipMap.get(ce.equipamento_id);
          const hn = fe ? Number(fe.horas_normais) : 0;
          const he = fe ? Number(fe.horas_excedentes) : 0;
          const vh = fe ? Number(fe.valor_hora) : Number(ce.valor_hora);
          const vhe = fe ? Number(fe.valor_hora_excedente) : Number(ce.valor_hora_excedente);

          // Build observations for non-standard situations
          const obs: string[] = [];
          if (fe?.primeiro_mes) obs.push("1º mês (proporcional entrega)");
          if (ce.data_devolucao && item.periodo_medicao_inicio && ce.data_devolucao <= (item.periodo_medicao_fim || "")) {
            obs.push(`Devolvido em ${parseLocalDate(ce.data_devolucao).toLocaleDateString("pt-BR")}`);
          }
          if (fe && Number(fe.hora_minima) !== Number(ce.hora_minima)) {
            obs.push(`Hora mín. ajustada: ${Number(fe.hora_minima)}h`);
          }

          return [
            `${eq?.tipo || ""} ${eq?.modelo || ""}`,
            eq?.tag_placa || "—",
            `${hn}h`,
            `${he}h`,
            fmt(vh),
            fmt(vhe),
            fmt(hn * vh + he * vhe),
            obs.length > 0 ? obs.join("; ") : "—",
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [["Equipamento", "Tag", "H. Normais", "H. Exced.", "Valor/h", "Valor Exc/h", "Subtotal", "Observações"]],
          body: eqRows,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
          columnStyles: { 7: { cellWidth: 40, fontStyle: "italic" } },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // Despesas deduzidas detalhadas
      if (gastosVal > 0) {
        const { data: fgData } = await supabase.from("faturamento_gastos").select("gasto_id").eq("faturamento_id", item.id);
        if (fgData && fgData.length > 0) {
          const gastoIds = fgData.map((fg: any) => fg.gasto_id);
          const { data: gastosData } = await supabase.from("gastos").select("descricao, tipo, valor, data, equipamento_id").in("id", gastoIds);
          if (gastosData && gastosData.length > 0) {
            const gEqIds = [...new Set(gastosData.map((g: any) => g.equipamento_id))];
            const { data: gEqData } = await supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").in("id", gEqIds);
            const gEqMap = new Map((gEqData || []).map((e: any) => [e.id, e]));

            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFontSize(12);
            doc.setTextColor(41, 128, 185);
            doc.text("Custos Adicionais", 14, y);
            y += 2;
            const gastoRows = gastosData.map((g: any) => {
              const geq = gEqMap.get(g.equipamento_id);
              return [
                geq ? `${geq.tipo} ${geq.modelo}` : "—",
                geq?.tag_placa || "—",
                g.tipo,
                g.descricao,
                parseLocalDate(g.data).toLocaleDateString("pt-BR"),
                fmt(Number(g.valor)),
              ];
            });
            autoTable(doc, {
              startY: y,
              head: [["Equipamento", "Tag", "Tipo", "Descrição", "Data", "Valor"]],
              body: gastoRows,
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [192, 57, 43], textColor: 255 },
              theme: "grid",
            });
            y = (doc as any).lastAutoTable.finalY + 8;
          }
        }
      }

      // Sinistros section
      const ceEquipIds = ceList.length > 0 ? ceList.map(ce => ce.equipamento_id) : [ct?.equipamento_id].filter(Boolean);
      const { data: sinistrosData } = await supabase
        .from("sinistros")
        .select("*, equipamentos(tipo, modelo, tag_placa), apolices(seguradora)")
        .in("equipamento_id", ceEquipIds as string[]);

      if (sinistrosData && sinistrosData.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setTextColor(192, 57, 43);
        doc.text("Acionamentos de Sinistro", 14, y);
        y += 2;
        const sinistroRows = sinistrosData.map((s: any) => {
          const eq = s.equipamentos;
          return [
            eq ? `${eq.tipo} ${eq.modelo}` : "—",
            eq?.tag_placa || "—",
            s.tipo_sinistro,
            new Date(s.data_sinistro).toLocaleDateString("pt-BR"),
            s.data_previsao_retorno ? new Date(s.data_previsao_retorno).toLocaleDateString("pt-BR") : "—",
            s.data_retorno ? new Date(s.data_retorno).toLocaleDateString("pt-BR") : "—",
            fmt(Number(s.franquia)),
            s.apolices?.seguradora || "—",
            s.status,
          ];
        });
        autoTable(doc, {
          startY: y,
          head: [["Equipamento", "Tag", "Tipo Sinistro", "Data", "Prev. Retorno", "Retorno", "Franquia", "Seguradora", "Status"]],
          body: sinistroRows,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [192, 57, 43], textColor: 255 },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // Summary
      if (y > 240) { doc.addPage(); y = 20; }
      const valorBrutoItem = Number(item.horas_normais) * Number(item.valor_hora) + Number(item.horas_excedentes) * Number(item.valor_excedente_hora);
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Resumo Financeiro", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Descrição", "Valor"]],
        body: [
          ["Valor Bruto (horas)", fmt(valorBrutoItem)],
          ["(+) Custos Adicionais", gastosVal > 0 ? `+ ${fmt(gastosVal)}` : "R$ 0,00"],
          ["(=) Valor Total a Cobrar", fmt(Number(item.valor_total))],
        ],
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [39, 174, 96], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Bank account info
      if (item.conta_bancaria_id) {
        const conta = contasBancarias.find(c => c.id === item.conta_bancaria_id);
        if (conta) {
          if (y > 240) { doc.addPage(); y = 20; }
          doc.setFontSize(12);
          doc.setTextColor(41, 128, 185);
          doc.text("Dados Bancários para Pagamento", 14, y);
          y += 2;
          const bankRows: string[][] = [
            ["Banco", conta.banco],
            ["Agência", conta.agencia],
            ["Conta", `${conta.conta} (${conta.tipo_conta})`],
            ["Titular", conta.titular],
          ];
          if (conta.cnpj_cpf) bankRows.push(["CNPJ/CPF", conta.cnpj_cpf]);
          if (conta.pix) bankRows.push(["Chave PIX", conta.pix]);
          autoTable(doc, {
            startY: y,
            head: [["Campo", "Dados"]],
            body: bankRows,
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [52, 73, 94], textColor: 255 },
            columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
            theme: "grid",
          });
        }
      }

      // Aditivos history
      const { data: aditivosHist } = await supabase
        .from("contratos_aditivos")
        .select("id, numero, data_inicio, data_fim, motivo, observacoes")
        .eq("contrato_id", item.contrato_id)
        .order("numero", { ascending: true });

      if (aditivosHist && aditivosHist.length > 0) {
        const aditivoIds = aditivosHist.map(a => a.id);
        const { data: aditivoEquips } = await supabase
          .from("aditivos_equipamentos")
          .select("*, equipamentos:equipamento_id(tipo, modelo, tag_placa)")
          .in("aditivo_id", aditivoIds);
        const aeByAditivo = new Map<string, any[]>();
        (aditivoEquips || []).forEach((ae: any) => {
          const list = aeByAditivo.get(ae.aditivo_id) || [];
          list.push(ae);
          aeByAditivo.set(ae.aditivo_id, list);
        });

        y = (doc as any).lastAutoTable?.finalY + 8 || y + 8;
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setTextColor(41, 128, 185);
        doc.text("Histórico de Aditivos", 14, y);
        y += 2;

        for (const ad of aditivosHist) {
          if (y > 250) { doc.addPage(); y = 20; }
          const adStatus = new Date() < parseLocalDate(ad.data_inicio) ? "Futuro" : new Date() > parseLocalDate(ad.data_fim) ? "Encerrado" : "Vigente";
          autoTable(doc, {
            startY: y,
            head: [[`Aditivo #${ad.numero} — ${adStatus}`, ""]],
            body: [
              ["Vigência", `${parseLocalDate(ad.data_inicio).toLocaleDateString("pt-BR")} a ${parseLocalDate(ad.data_fim).toLocaleDateString("pt-BR")}`],
              ["Motivo", ad.motivo || "—"],
              ...(ad.observacoes ? [["Observações", ad.observacoes]] : []),
            ],
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [155, 89, 182], textColor: 255 },
            columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
            theme: "grid",
          });
          y = (doc as any).lastAutoTable.finalY + 2;

          const aeList = aeByAditivo.get(ad.id) || [];
          if (aeList.length > 0) {
            const aeRows = aeList.map((ae: any) => {
              const eq = ae.equipamentos;
              return [
                eq ? `${eq.tipo} ${eq.modelo}` : "—",
                eq?.tag_placa || "—",
                fmt(Number(ae.valor_hora)),
                fmt(Number(ae.valor_hora_excedente)),
                `${ae.horas_contratadas}h`,
                `${ae.hora_minima}h`,
                ae.data_entrega ? parseLocalDate(ae.data_entrega).toLocaleDateString("pt-BR") : "—",
                ae.data_devolucao ? parseLocalDate(ae.data_devolucao).toLocaleDateString("pt-BR") : "—",
              ];
            });
            autoTable(doc, {
              startY: y,
              head: [["Equipamento", "Tag", "V/h", "V/h Exc", "Horas", "Mínima", "Entrega", "Devolução"]],
              body: aeRows,
              styles: { fontSize: 7, cellPadding: 2 },
              headStyles: { fillColor: [142, 68, 173], textColor: 255 },
              theme: "grid",
            });
            y = (doc as any).lastAutoTable.finalY + 4;
          }
        }
      }
    }

    doc.save(`faturamento_detalhado_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const calcMedicaoDates = (ct: ContratoRef) => {
    const now = new Date();
    const diaInicio = ct.dia_medicao_inicio || 1;
    const diaFim = ct.dia_medicao_fim || 30;
    let mesInicio = now.getMonth();
    let anoInicio = now.getFullYear();
    let mesFim = mesInicio;
    let anoFim = anoInicio;
    if (diaFim < diaInicio) {
      mesFim = mesInicio;
      anoFim = anoInicio;
      mesInicio = mesInicio - 1;
      if (mesInicio < 0) { mesInicio = 11; anoInicio--; }
    }
    const lastDayInicio = new Date(anoInicio, mesInicio + 1, 0).getDate();
    const lastDayFim = new Date(anoFim, mesFim + 1, 0).getDate();
    const dInicio = new Date(anoInicio, mesInicio, Math.min(diaInicio, lastDayInicio));
    const dFim = new Date(anoFim, mesFim, Math.min(diaFim, lastDayFim));
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      inicio: `${dInicio.getFullYear()}-${pad(dInicio.getMonth() + 1)}-${pad(dInicio.getDate())}`,
      fim: `${dFim.getFullYear()}-${pad(dFim.getMonth() + 1)}-${pad(dFim.getDate())}`,
    };
  };

  const openNew = () => {
    setEditing(null);
    setFormContratoId("");
    setFormPeriodo("");
    setFormNumeroNota("");
    setFormStatus("Pendente");
    setFormMedicaoInicio("");
    setFormMedicaoFim("");
    setEquipForms([]);
    setGastosEquip([]);
    setTotalGastos(0);
    setSelectedGastos(new Set());
    setFormContaBancariaId("");
    setDialogOpen(true);
  };

  const openEdit = async (item: Fatura) => {
    setEditing(item);
    setFormContratoId(item.contrato_id);
    setFormPeriodo(item.periodo);
    setFormNumeroNota(item.numero_nota || "");
    setFormStatus(item.status);
    setFormContaBancariaId(item.conta_bancaria_id || "");
    setFormMedicaoInicio(item.periodo_medicao_inicio || "");
    setFormMedicaoFim(item.periodo_medicao_fim || "");

    // Load previously selected gastos
    const { data: savedGastos } = await supabase.from("faturamento_gastos").select("gasto_id").eq("faturamento_id", item.id);
    if (savedGastos) setSelectedGastos(new Set(savedGastos.map(sg => sg.gasto_id)));

    // Load saved equipment details
    const { data: savedEquips } = await supabase.from("faturamento_equipamentos").select("*").eq("faturamento_id", item.id);
    if (savedEquips && savedEquips.length > 0) {
      // We'll let fetchMedicoesEGastos rebuild and then overlay saved values
      // This is handled after the fetch completes via the editing state
    }

    setDialogOpen(true);
  };

  const handleContratoSelect = async (contratoId: string) => {
    const ct = contratos.find(c => c.id === contratoId);
    if (ct) {
      const dates = calcMedicaoDates(ct);
      setFormContratoId(contratoId);
      setFormMedicaoInicio(dates.inicio);
      setFormMedicaoFim(dates.fim);

      // Check for sinistros on contract equipment
      const equipIds = ct.contratos_equipamentos?.map(ce => ce.equipamento_id) || [ct.equipamento_id];
      const { data: sinistros } = await supabase
        .from("sinistros")
        .select("id, equipamento_id, tipo_sinistro, franquia, data_sinistro, equipamentos(tipo, modelo, tag_placa), apolices(seguradora)")
        .in("equipamento_id", equipIds)
        .eq("status", "Aberto");
      if (sinistros && sinistros.length > 0) {
        setSinistroAlerts(sinistros as unknown as SinistroAlert[]);
        setSinistroAlertShown(true);
      } else {
        setSinistroAlerts([]);
      }
    }
  };

  // Totals across all equipment
  const totalHorasNormais = equipForms.reduce((acc, ef) => acc + ef.horas_normais, 0);
  const totalHorasExcedentes = equipForms.reduce((acc, ef) => acc + ef.horas_excedentes, 0);
  const valorBruto = equipForms.reduce((acc, ef) => acc + ef.horas_normais * ef.valor_hora + ef.horas_excedentes * ef.valor_hora_excedente, 0);
  const valorLiquido = valorBruto + totalGastos;

  // Average valor_hora for storage (weighted)
  const avgValorHora = totalHorasNormais > 0 ? equipForms.reduce((acc, ef) => acc + ef.horas_normais * ef.valor_hora, 0) / totalHorasNormais : 0;
  const avgValorExcedente = totalHorasExcedentes > 0 ? equipForms.reduce((acc, ef) => acc + ef.horas_excedentes * ef.valor_hora_excedente, 0) / totalHorasExcedentes : 0;

  const handleSave = async () => {
    if (!formContratoId) return;
    const payload = {
      contrato_id: formContratoId,
      periodo: formPeriodo,
      horas_normais: totalHorasNormais,
      horas_excedentes: totalHorasExcedentes,
      valor_hora: avgValorHora,
      valor_excedente_hora: avgValorExcedente,
      valor_total: valorLiquido,
      status: formStatus,
      numero_nota: formNumeroNota || null,
      periodo_medicao_inicio: formMedicaoInicio || null,
      periodo_medicao_fim: formMedicaoFim || null,
      total_gastos: totalGastos,
      conta_bancaria_id: formContaBancariaId || null,
    } as any;

    let faturaId: string;

    if (editing) {
      const { error } = await supabase.from("faturamento").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      faturaId = editing.id;
      await Promise.all([
        supabase.from("faturamento_gastos").delete().eq("faturamento_id", faturaId),
        supabase.from("faturamento_equipamentos").delete().eq("faturamento_id", faturaId),
      ]);
    } else {
      const { data, error } = await supabase.from("faturamento").insert(payload).select("id").single();
      if (error || !data) { toast({ title: "Erro", description: error?.message || "Erro ao criar fatura", variant: "destructive" }); return; }
      faturaId = data.id;
    }

    // Save per-equipment details
    if (equipForms.length > 0) {
      const equipRows = equipForms.map(ef => ({
        faturamento_id: faturaId,
        equipamento_id: ef.equipamento_id,
        horas_normais: ef.horas_normais,
        horas_excedentes: ef.horas_excedentes,
        valor_hora: ef.valor_hora,
        valor_hora_excedente: ef.valor_hora_excedente,
        hora_minima: ef.hora_minima,
        primeiro_mes: ef.primeiro_mes,
        horas_medidas: ef.horas_medidas,
      }));
      await supabase.from("faturamento_equipamentos").insert(equipRows);
    }

    // Save selected gastos
    if (selectedGastos.size > 0) {
      const gastoRows = Array.from(selectedGastos).map(gastoId => ({
        faturamento_id: faturaId,
        gasto_id: gastoId,
      }));
      await supabase.from("faturamento_gastos").insert(gastoRows);
    }

    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("faturamento").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    fetchData();
  };

  const selectedContrato = contratos.find(c => c.id === formContratoId);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
            <p className="text-sm text-muted-foreground">Total pendente: <span className="text-accent font-semibold">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>{selected.size > 0 && ` · ${selected.size} selecionada(s)`}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setContasDialogOpen(true)}><Landmark className="h-4 w-4 mr-1" /> Contas</Button>
            <Button variant="outline" size="sm" onClick={exportDetailedPDF}><FileDown className="h-4 w-4 mr-1" /> PDF Detalhado</Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4 mr-2" /> Nova Fatura</Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por empresa, nº, período ou nota..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  
                  <TableHead>Empresa</TableHead>
                  <TableHead>Nº Nota</TableHead>
                  <TableHead>Período Medição</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Custos Adicionais</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const itemGastos = Number(item.total_gastos || 0);
                  return (
                    <TableRow key={item.id} className={selected.has(item.id) ? "bg-accent/5" : ""}>
                      <TableCell><Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} /></TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{item.contratos?.empresas?.nome}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.contratos?.empresas?.cnpj}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.numero_nota || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.periodo_medicao_inicio && item.periodo_medicao_fim
                          ? `${parseLocalDate(item.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(item.periodo_medicao_fim).toLocaleDateString("pt-BR")}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(() => { const ct = contratos.find(c => c.id === item.contrato_id); return `${ct?.prazo_faturamento || 30} dias`; })()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getVencimento(item).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          {item.horas_normais}h{Number(item.horas_excedentes) > 0 && <span className="text-warning"> +{item.horas_excedentes}h</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {itemGastos > 0
                          ? <span className="text-accent font-semibold">+ R$ {itemGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          : "—"}
                      </TableCell>
                      <TableCell className="font-bold text-sm">R$ {Number(item.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        {(() => {
                          const displayStatus = getDisplayStatus(item);
                          return (
                            <Badge className={
                              displayStatus === "Pago" ? "bg-success text-success-foreground" :
                              displayStatus === "Cancelado" ? "bg-destructive text-destructive-foreground" :
                              displayStatus === "Em Atraso" ? "bg-destructive text-destructive-foreground" :
                              "bg-warning text-warning-foreground"
                            }>
                              {displayStatus}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Faturamento Nº {item.numero_sequencial}</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza que deseja excluir esta fatura? Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhuma fatura encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              {editing ? `Editar Fatura Nº ${editing.numero_sequencial}` : "Nova Fatura"}
              {editing && <Badge variant="outline" className="ml-2 font-mono">#{editing.numero_sequencial}</Badge>}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label>Contrato</Label>
              <SearchableSelect
                value={formContratoId}
                onValueChange={handleContratoSelect}
                disabled={!!editing}
                placeholder="Selecione o contrato"
                searchPlaceholder="Pesquisar contrato..."
                options={contratos.map((c) => {
                  const ceCount = c.contratos_equipamentos?.length || 0;
                  return {
                    value: c.id,
                    label: `${c.empresas?.nome} — ${ceCount > 0 ? `${ceCount} equipamento(s)` : `${c.equipamentos?.tipo} ${c.equipamentos?.modelo}`}`,
                  };
                })}
              />
            </div>

            {selectedContrato && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p><strong>Empresa:</strong> {selectedContrato.empresas?.nome} ({selectedContrato.empresas?.cnpj})</p>
                <p><strong>Ciclo Medição:</strong> Dia {selectedContrato.dia_medicao_inicio || 1} ao Dia {selectedContrato.dia_medicao_fim || 30}</p>
                <p><strong>Prazo Faturamento:</strong> {selectedContrato.prazo_faturamento || 30} dias</p>
                <p><strong>Equipamentos no contrato:</strong> {selectedContrato.contratos_equipamentos?.length || 1}</p>
              </div>
            )}

            {/* Sinistro Alert */}
            {sinistroAlerts.length > 0 && (
              <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 space-y-2">
                <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Atenção: {sinistroAlerts.length} equipamento(s) com sinistro aberto
                </div>
                {sinistroAlerts.map(sa => (
                  <div key={sa.id} className="text-xs text-muted-foreground pl-6">
                    <strong>{sa.equipamentos?.tipo} {sa.equipamentos?.modelo} {sa.equipamentos?.tag_placa ? `(${sa.equipamentos.tag_placa})` : ""}</strong>
                    {" — "}{sa.tipo_sinistro} · Franquia: R$ {Number(sa.franquia).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    {" · Seguradora: "}{sa.apolices?.seguradora || "—"}
                    {" · Data: "}{new Date(sa.data_sinistro).toLocaleDateString("pt-BR")}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Nº Nota / Fatura</Label><Input value={formNumeroNota} onChange={(e) => setFormNumeroNota(e.target.value)} placeholder="Ex: NF-001" /></div>
              <div><Label>Período</Label><Input value={formPeriodo} onChange={(e) => setFormPeriodo(e.target.value)} placeholder="Mês/Ano" /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Medição Início</Label><Input type="date" value={formMedicaoInicio} onChange={(e) => setFormMedicaoInicio(e.target.value)} /></div>
              <div><Label>Medição Fim</Label><Input type="date" value={formMedicaoFim} onChange={(e) => setFormMedicaoFim(e.target.value)} /></div>
            </div>

            {/* Per-equipment details */}
            {equipForms.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-accent" />
                  Horas por Equipamento
                </div>
                {equipForms.map((ef, idx) => (
                  <div key={ef.equipamento_id} className={`p-3 rounded-lg border space-y-2 ${ef.horas_excedentes > 0 ? "border-warning bg-warning/5" : "border-success bg-success/5"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{ef.tipo} {ef.modelo} {ef.tag_placa ? `(${ef.tag_placa})` : ""}</span>
                      {ef.ajuste && (
                        <Badge variant="outline" className="text-xs border-accent text-accent">
                          <Settings2 className="h-3 w-3 mr-1" /> Ajuste Ativo
                        </Badge>
                      )}
                      {ef.aditivo && (
                        <Badge variant="outline" className="text-xs border-primary text-primary">
                          <Hash className="h-3 w-3 mr-1" /> Aditivo {ef.aditivo_numero ? `#${ef.aditivo_numero}` : ""}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground">Medidas</p>
                        <p className="text-base font-bold text-accent">{ef.horas_medidas.toFixed(1)}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Contratadas</p>
                        <p className="text-base font-bold">{ef.horas_contratadas}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Normais</p>
                        <p className="text-base font-bold text-success">{ef.horas_normais}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Excedentes</p>
                        <p className={`text-base font-bold ${ef.horas_excedentes > 0 ? "text-warning" : "text-success"}`}>{ef.horas_excedentes > 0 ? `+${ef.horas_excedentes}` : "0"}h</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>V/h: R$ {ef.valor_hora.toFixed(2)} | V/h exc: R$ {ef.valor_hora_excedente.toFixed(2)}{ef.hora_minima > 0 ? ` | Mín: ${ef.hora_minima}h` : ""}</span>
                      <span className="font-semibold text-foreground">R$ {(ef.horas_normais * ef.valor_hora + ef.horas_excedentes * ef.valor_hora_excedente).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                      {ef.hora_minima > 0 && (
                      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                        <Switch checked={ef.primeiro_mes} onCheckedChange={() => togglePrimeiroMes(idx)} />
                        <Label className="text-xs cursor-pointer" onClick={() => togglePrimeiroMes(idx)}>Primeiro mês (proporcional)</Label>
                        {ef.primeiro_mes && ef.data_entrega && <span className="text-xs text-muted-foreground ml-auto">Entrega: {parseLocalDate(ef.data_entrega).toLocaleDateString("pt-BR")}</span>}
                      </div>
                    )}
                    {ef.data_devolucao && (
                      <div className="space-y-1.5 pt-1 border-t border-warning/30">
                        <div className="text-xs text-warning font-medium bg-warning/10 rounded p-1.5">
                          📅 Devolução em {parseLocalDate(ef.data_devolucao).toLocaleDateString("pt-BR")} — medições contabilizadas somente até esta data
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={ef.proporcional_devolucao} onCheckedChange={() => toggleProporcionalDevolucao(idx)} />
                          <Label className="text-xs cursor-pointer" onClick={() => toggleProporcionalDevolucao(idx)}>
                            Cobrar proporcional à devolução
                          </Label>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {ef.proporcional_devolucao
                              ? `Proporcional: ${ef.horas_contratadas}h / Mín: ${ef.hora_minima}h`
                              : `Integral: ${ef.horas_contratadas_original}h / Mín: ${ef.hora_minima_original}h`}
                          </span>
                        </div>
                      </div>
                    )}
                    {ef.hora_minima > 0 && !ef.primeiro_mes && ef.horas_medidas < ef.hora_minima && (
                      <div className="text-xs text-accent font-medium bg-accent/10 rounded p-1.5">
                        ⚡ Hora mínima: {ef.horas_medidas.toFixed(1)}h → cobrando {ef.hora_minima}h
                      </div>
                    )}
                  </div>
                ))}
                {loadingMedicoes && <p className="text-xs text-muted-foreground">Calculando...</p>}
              </div>
            )}

            {equipForms.length === 0 && formContratoId && formMedicaoInicio && formMedicaoFim && !loadingMedicoes && (
              <div className="p-3 rounded-lg bg-muted/30 text-center text-sm text-muted-foreground">
                Nenhuma medição encontrada para os equipamentos no período selecionado.
              </div>
            )}

            {/* Custos Adicionais */}
            {gastosEquip.length > 0 && (
              <div className="p-4 rounded-lg border border-accent/30 bg-accent/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-accent">
                    <TrendingDown className="h-4 w-4" />
                    Custos dos Equipamentos no Período
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAllGastos}>
                    {selectedGastos.size === gastosEquip.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {gastosEquip.map(g => {
                    const eq = equipForms.find(ef => ef.equipamento_id === g.equipamento_id);
                    return (
                      <div key={g.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={selectedGastos.has(g.id)} onCheckedChange={() => toggleGasto(g.id)} className="shrink-0" />
                        <span className={`flex-1 ${selectedGastos.has(g.id) ? "text-foreground" : "text-muted-foreground"}`}>
                          {parseLocalDate(g.data).toLocaleDateString("pt-BR")} — {eq ? `${eq.tipo} ${eq.modelo}` : ""} — {g.descricao} <Badge variant="outline" className="text-xs ml-1">{g.tipo}</Badge>
                        </span>
                        <span className={`font-semibold shrink-0 ${selectedGastos.has(g.id) ? "text-accent" : "text-muted-foreground"}`}>
                          + R$ {Number(g.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {selectedGastos.size > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-accent/20 font-bold text-sm">
                    <span>Total Custos Selecionados ({selectedGastos.size}/{gastosEquip.length})</span>
                    <span className="text-accent">+ R$ {totalGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conta para Pagamento</Label>
                <SearchableSelect
                  value={formContaBancariaId}
                  onValueChange={setFormContaBancariaId}
                  placeholder="Selecione a conta"
                  searchPlaceholder="Pesquisar conta..."
                  options={[
                    { value: "", label: "Nenhuma" },
                    ...contasBancarias.map(c => ({ value: c.id, label: `${c.banco} - Ag ${c.agencia} / CC ${c.conta}` })),
                  ]}
                />
              </div>
            </div>

            {/* Totals */}
            {equipForms.length > 0 && (
              <div className="p-4 rounded-lg bg-accent/10 space-y-2">
                {equipForms.map(ef => (
                  <div key={ef.equipamento_id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{ef.tipo} {ef.modelo}</span>
                    <span>R$ {(ef.horas_normais * ef.valor_hora + ef.horas_excedentes * ef.valor_hora_excedente).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm pt-1 border-t border-accent/20">
                  <span className="text-muted-foreground">Valor Bruto ({totalHorasNormais.toFixed(1)}h + {totalHorasExcedentes.toFixed(1)}h exc.)</span>
                  <span className="font-semibold">R$ {valorBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                {totalGastos > 0 && (
                  <div className="flex items-center justify-between text-sm text-accent">
                    <span>Custos Adicionais</span>
                    <span className="font-semibold">+ R$ {totalGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-accent/20">
                  <span className="text-sm font-medium">Valor Total a Cobrar</span>
                  <span className="text-2xl font-bold text-accent">R$ {valorLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">{editing ? "Salvar" : "Emitir Fatura"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContasBancariasDialog
        open={contasDialogOpen}
        onOpenChange={setContasDialogOpen}
        contas={contasBancarias}
        onRefresh={fetchData}
      />

      {/* Sinistro Alert Pop-up */}
      <AlertDialog open={sinistroAlertShown} onOpenChange={setSinistroAlertShown}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" /> Sinistro Ativo Detectado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Os seguintes equipamentos deste contrato possuem sinistro aberto com franquia a cobrar:</p>
                {sinistroAlerts.map(sa => (
                  <div key={sa.id} className="p-2 rounded border border-destructive/20 bg-destructive/5 text-sm">
                    <p className="font-medium">{sa.equipamentos?.tipo} {sa.equipamentos?.modelo} {sa.equipamentos?.tag_placa ? `(${sa.equipamentos.tag_placa})` : ""}</p>
                    <p className="text-muted-foreground">{sa.tipo_sinistro} · Franquia: <strong>R$ {Number(sa.franquia).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
                    <p className="text-muted-foreground">Seguradora: {sa.apolices?.seguradora || "—"} · Data: {new Date(sa.data_sinistro).toLocaleDateString("pt-BR")}</p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">O valor da franquia pode ser incluído como custo adicional nesta fatura.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
};

export default Faturamento;
