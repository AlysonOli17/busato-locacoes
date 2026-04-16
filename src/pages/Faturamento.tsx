import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Search, Receipt, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, TrendingDown, FileDown, FileSpreadsheet, Settings2, Hash, Landmark, ShieldCheck, Truck, Eye } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { calcularHorasInterpoladas } from "@/lib/utils";
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
  empresa_id: string;
  valor_hora: number;
  horas_contratadas: number;
  equipamento_id: string;
  data_inicio: string;
  data_fim: string;
  observacoes: string | null;
  dia_medicao_inicio: number;
  dia_medicao_fim: number;
  prazo_faturamento: number;
  tipo_medicao: string;
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
  data_aprovacao: string | null;
  empresa_faturamento_id: string | null;
}

interface EmpresaFat {
  id: string;
  nome: string;
  cnpj: string;
  razao_social: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
}

interface GastoItem {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data: string;
  equipamento_id: string;
  classificacao: string;
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
  cobranca_parcial: "horas_trabalhadas" | "proporcional_minimo";
}

// Parse "YYYY-MM-DD" as local date (avoids UTC timezone shift)
const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

export const FaturamentoContent = () => {
  const [items, setItems] = useState<Fatura[]>([]);
  const [contratos, setContratos] = useState<ContratoRef[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fatura | null>(null);
  const [search, setSearch] = useState("");
  const [filterPeriodoInicio, setFilterPeriodoInicio] = useState("");
  const [filterPeriodoFim, setFilterPeriodoFim] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState("all");
  const [formContratoId, setFormContratoId] = useState("");
  const [formPeriodo, setFormPeriodo] = useState("");
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalItemId, setApprovalItemId] = useState<string | null>(null);
  const [approvalNumeroNota, setApprovalNumeroNota] = useState("");
  const [approvalObservacoes, setApprovalObservacoes] = useState("");
  
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
  const [empresasList, setEmpresasList] = useState<EmpresaFat[]>([]);
  const [formEmpresaFaturamentoId, setFormEmpresaFaturamentoId] = useState("");
  const { toast } = useToast();

  const [aditivosPorContratoFat, setAditivosPorContratoFat] = useState<Record<string, any[]>>({});

  // Mobilização/Desmobilização alert
  interface MobEvent { equipamento_id: string; tipo: string; modelo: string; tag_placa: string | null; evento: "Mobilização" | "Desmobilização"; data: string; }
  const [mobAlerts, setMobAlerts] = useState<MobEvent[]>([]);
  const [mobDialogOpen, setMobDialogOpen] = useState(false);
  const [mobValues, setMobValues] = useState<Record<string, number>>({});
  const [creatingMob, setCreatingMob] = useState(false);

  const fetchData = async () => {
    const [fatRes, ctRes, contasRes, empListRes] = await Promise.all([
      supabase.from("faturamento").select("*, contratos(id, empresa_id, valor_hora, horas_contratadas, equipamento_id, data_inicio, data_fim, observacoes, dia_medicao_inicio, dia_medicao_fim, prazo_faturamento, tipo_medicao, empresas(nome, cnpj, contato, telefone), equipamentos(tipo, modelo, tag_placa, numero_serie), contratos_equipamentos(equipamento_id, valor_hora, valor_hora_excedente, horas_contratadas, hora_minima, data_entrega, data_devolucao))").order("numero_sequencial", { ascending: false }),
      supabase.from("contratos").select("id, empresa_id, valor_hora, horas_contratadas, equipamento_id, data_inicio, data_fim, observacoes, dia_medicao_inicio, dia_medicao_fim, prazo_faturamento, tipo_medicao, empresas(nome, cnpj, contato, telefone), equipamentos(tipo, modelo, tag_placa, numero_serie), contratos_equipamentos(equipamento_id, valor_hora, valor_hora_excedente, horas_contratadas, hora_minima, data_entrega, data_devolucao)").eq("status", "Ativo").order("created_at", { ascending: false }),
      supabase.from("contas_bancarias").select("*").order("banco"),
      supabase.from("empresas").select("id, nome, cnpj, razao_social, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, inscricao_estadual, inscricao_municipal").order("nome"),
    ]);
    if (fatRes.data) setItems(fatRes.data as unknown as Fatura[]);
    if (empListRes.data) setEmpresasList(empListRes.data as unknown as EmpresaFat[]);
    const ctData = ctRes.data as unknown as ContratoRef[] || [];
    if (ctData.length > 0) {
      setContratos(ctData);
      // Fetch aditivos for all active contracts to compute equipment count
      const ctIds = ctData.map(c => c.id);
      const { data: adData } = await supabase.from("contratos_aditivos").select("id, contrato_id, numero, data_inicio, data_fim, aditivos_equipamentos(equipamento_id, data_devolucao)").in("contrato_id", ctIds);
      const adMap: Record<string, any[]> = {};
      for (const ad of (adData || [])) {
        if (!adMap[ad.contrato_id]) adMap[ad.contrato_id] = [];
        adMap[ad.contrato_id].push(ad);
      }
      setAditivosPorContratoFat(adMap);
    }
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
    const baseEquipIds = ceList.length > 0 ? ceList.map(ce => ce.equipamento_id) : [ct.equipamento_id];

    // Pre-filter: exclude equipment returned before period start
    const equipIds = baseEquipIds.filter(eqId => {
      const ce = ceList.find(c => c.equipamento_id === eqId);
      if (ce?.data_devolucao && ce.data_devolucao <= inicio) return false;
      return true;
    });

    // Step 1: Fetch addendums first to discover ALL equipment IDs
    const { data: aditivosData } = await supabase
      .from("contratos_aditivos")
      .select("id, numero, data_inicio, data_fim")
      .eq("contrato_id", contratoId)
      .lte("data_inicio", fim)
      .gte("data_fim", inicio);

    let aditivoEquipMap = new Map<string, any>();
    let aditivoExtraEquipIds: string[] = [];
    if (aditivosData && aditivosData.length > 0) {
      const aditivoIds = aditivosData.map(a => a.id);
      const { data: aeData } = await supabase.from("aditivos_equipamentos").select("*").in("aditivo_id", aditivoIds);
      if (aeData) {
        for (const ae of aeData) {
          if (ae.data_entrega && ae.data_entrega > fim) continue;
          const aditivo = aditivosData.find(a => a.id === ae.aditivo_id);
          const existing = aditivoEquipMap.get(ae.equipamento_id);
          const existingAditivo = existing ? aditivosData.find(a => a.id === existing.aditivo_id) : null;
          if (!existing || (aditivo && existingAditivo && aditivo.numero > existingAditivo.numero)) {
            aditivoEquipMap.set(ae.equipamento_id, ae);
          }
        }
        aditivoExtraEquipIds = [...new Set(
          aeData
            .filter(ae => !ae.data_entrega || ae.data_entrega <= fim)
            .map(ae => ae.equipamento_id)
        )].filter(id => {
          if (equipIds.includes(id)) return false;
          const ae = aditivoEquipMap.get(id);
          if (ae?.data_devolucao && ae.data_devolucao <= inicio) return false;
          return true;
        });
      }
    }

    // Step 2: Now we know ALL equipment IDs — fetch equipment, gastos, AND adjustments
    const allEquipIdsWithAditivos = [...equipIds, ...aditivoExtraEquipIds];

    const [equipRes, gastosRes, ajustesRes] = await Promise.all([
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").in("id", allEquipIdsWithAditivos),
      supabase.from("gastos").select("id, descricao, tipo, valor, data, equipamento_id, classificacao").in("equipamento_id", allEquipIdsWithAditivos).gte("data", inicio).lte("data", fim).order("data", { ascending: false }),
      // FIXED: fetch adjustments for ALL equipment (base + addendum)
      supabase.from("contratos_equipamentos_ajustes").select("*").eq("contrato_id", contratoId).in("equipamento_id", allEquipIdsWithAditivos).lte("data_inicio", fim).gte("data_fim", inicio),
    ]);

    const ajustesData = ajustesRes.data || [];

    // Fetch measurements per equipment: in-period + baseline (last reading before period)
    const medPromises = allEquipIdsWithAditivos.map(eqId => {
      return Promise.all([
        supabase.from("medicoes").select("equipamento_id, tipo, horimetro_final, data")
          .eq("equipamento_id", eqId).eq("tipo", "Trabalho")
          .lt("data", inicio).order("data", { ascending: false }).limit(1),
        supabase.from("medicoes").select("equipamento_id, horas_trabalhadas, tipo, horimetro_inicial, horimetro_final, data")
          .eq("equipamento_id", eqId).gte("data", inicio).lte("data", fim).order("data", { ascending: true }),
      ]);
    });
    const medResults = await Promise.all(medPromises);
    const baselineMap = new Map<string, { data: string; horimetro_final: number }>();
    const medicoesData: any[] = [];
    medResults.forEach(([baselineRes, periodRes]) => {
      if (baselineRes.data && baselineRes.data.length > 0) {
        const b = baselineRes.data[0];
        baselineMap.set(b.equipamento_id, { data: b.data, horimetro_final: Number(b.horimetro_final) });
      }
      if (periodRes.data) medicoesData.push(...periodRes.data);
    });
    const equipMap = new Map((equipRes.data || []).map(e => [e.id, e]));

    // Final filter: exclude equipment returned before period or not yet delivered
    const filteredEquipIds = allEquipIdsWithAditivos.filter(eqId => {
      const ce = ceList.find(c => c.equipamento_id === eqId);
      const ae = aditivoEquipMap.get(eqId);
      const dataDevolucao = ae?.data_devolucao || ce?.data_devolucao || null;
      if (dataDevolucao && dataDevolucao <= inicio) return false;
      const dataEntrega = ae?.data_entrega || ce?.data_entrega || null;
      if (dataEntrega && dataEntrega > fim) return false;
      return true;
    });

    const newEquipForms: EquipFormItem[] = filteredEquipIds.map(eqId => {
      const ce = ceList.find(c => c.equipamento_id === eqId);
      const eq = equipMap.get(eqId);
      const aditivo = aditivoEquipMap.get(eqId) || null;
      const dataEntrega = aditivo?.data_entrega || ce?.data_entrega || null;
      const dataDevolucao = aditivo?.data_devolucao || ce?.data_devolucao || null;

      // Find the most specific ajuste for this equipment (pick the one with latest data_inicio within the period)
      const ajustesEquip = ajustesData.filter(a => a.equipamento_id === eqId);
      let ajuste = ajustesEquip.length > 0
        ? ajustesEquip.sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0]
        : null;

      // If no specific ajuste exists, check for LOTE ajustes that cover this period
      if (!ajuste) {
        const loteAjustes = ajustesData.filter(a => a.motivo && a.motivo.startsWith("[LOTE]") && a.equipamento_id !== eqId);
        if (loteAjustes.length > 0) {
          const latestLote = loteAjustes.sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0];
          const equipEntrega = dataEntrega || inicio;
          if (equipEntrega >= latestLote.data_inicio && equipEntrega <= latestLote.data_fim) {
            const bValorHora = aditivo ? Number(aditivo.valor_hora) : ce ? Number(ce.valor_hora) : Number(ct.valor_hora);
            const bValorExcedente = aditivo ? Number(aditivo.valor_hora_excedente) : ce ? Number(ce.valor_hora_excedente) : bValorHora * 1.25;
            ajuste = {
              ...latestLote,
              equipamento_id: eqId,
              valor_hora: bValorHora,
              valor_hora_excedente: bValorExcedente,
              hora_minima: Number(latestLote.hora_minima),
              horas_contratadas: Number(latestLote.horas_contratadas),
            } as typeof latestLote;
          }
        }
      }

      // Calculate measured value: hours (horímetro) or days (diárias)
      const isDiarias = ct.tipo_medicao === "diarias";
      const filteredMedicoes = medicoesData.filter(m => m.equipamento_id === eqId);
      let horasMedidas = 0;

      if (isDiarias) {
        // For diárias: count distinct work days with measurements in the period
        const trabalho = filteredMedicoes.filter(m => (m.tipo || 'Trabalho') === 'Trabalho');
        const uniqueDays = new Set(trabalho.map(m => String(m.data)));
        horasMedidas = uniqueDays.size;
      } else if (filteredMedicoes.length > 0 || baselineMap.has(eqId)) {
        const trabalho = filteredMedicoes.filter(m => (m.tipo || 'Trabalho') === 'Trabalho');
        // Build readings array: baseline + in-period readings
        const allReadings: { data: string; horimetro_final: number }[] = [];
        const baseline = baselineMap.get(eqId);
        if (baseline) allReadings.push(baseline);
        for (const m of trabalho) {
          allReadings.push({ data: String(m.data), horimetro_final: Number(m.horimetro_final) });
        }

        // Respect effective period: use delivery date as start if within cycle
        const inicioEfetivo = dataEntrega && dataEntrega > inicio && dataEntrega <= fim ? dataEntrega : inicio;
        const fimEfetivo = dataDevolucao && dataDevolucao >= inicio && dataDevolucao < fim ? dataDevolucao : fim;
        const result = calcularHorasInterpoladas(allReadings, inicioEfetivo, fimEfetivo);
        horasMedidas = result.totalHoras;
      }

      // Priority: ajuste ALWAYS overrides > aditivo > contrato_equipamento > contrato
      // Ajustes now save original values for unchecked fields, so we can use them directly
      const baseValorHora = aditivo ? Number(aditivo.valor_hora) : ce ? Number(ce.valor_hora) : Number(ct.valor_hora);
      const baseValorExcedente = aditivo ? Number(aditivo.valor_hora_excedente) : ce ? Number(ce.valor_hora_excedente) : baseValorHora * 1.25;
      const baseHorasContratadas = aditivo ? Number(aditivo.horas_contratadas) : ce ? Number(ce.horas_contratadas) : Number(ct.horas_contratadas);
      const baseHoraMinima = aditivo ? Number(aditivo.hora_minima) : ce ? Number(ce.hora_minima) : 0;

      const descontoPerc = ajuste ? Number((ajuste as any).desconto_percentual || 0) : 0;
      const fatorDesconto = descontoPerc > 0 ? (1 - descontoPerc / 100) : 1;
      const valorHora = (ajuste ? Number(ajuste.valor_hora) : baseValorHora) * fatorDesconto;
      const valorExcedente = (ajuste ? Number(ajuste.valor_hora_excedente) : baseValorExcedente) * fatorDesconto;
      let horasContratadas = ajuste ? Number(ajuste.horas_contratadas) : baseHorasContratadas;
      let horaMinima = ajuste ? Number(ajuste.hora_minima) : baseHoraMinima;
      const horasContratadasOriginal = horasContratadas;
      const horasMinimaOriginal = horaMinima;

      // Proportional for delivery date within period (primeiro mês)
      const temEntregaNoPeriodo = dataEntrega && dataEntrega > inicio && dataEntrega <= fim;
      const temDevolucaoNoPeriodo = dataDevolucao && dataDevolucao >= inicio && dataDevolucao < fim;

      // When proportional (delivery or return within cycle), we do NOT reduce horasContratadas/horaMinima
      // Instead, we charge exclusively based on actual hours worked (no minimum applied)

      const aditivoHeader = aditivo ? (aditivosData || []).find(a => a.id === aditivo.aditivo_id) : null;

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
        primeiro_mes: !!temEntregaNoPeriodo,
        data_entrega: dataEntrega,
        data_devolucao: dataDevolucao,
        proporcional_devolucao: !!temDevolucaoNoPeriodo,
        horas_contratadas_original: horasContratadasOriginal,
        hora_minima_original: horasMinimaOriginal,
        ajuste,
        aditivo: !ajuste ? aditivo : null,
        aditivo_numero: !ajuste && aditivoHeader ? aditivoHeader.numero : null,
        cobranca_parcial: "horas_trabalhadas" as const,
      };
    });

    // Calculate hours for each equipment
    newEquipForms.forEach(ef => {
      const isProporcional = ef.primeiro_mes || ef.proporcional_devolucao;
      if (isProporcional) {
        if (ef.cobranca_parcial === "proporcional_minimo") {
          const inicioEf = ef.data_entrega && ef.data_entrega > inicio && ef.data_entrega <= fim ? ef.data_entrega : inicio;
          const devRaw = ef.data_devolucao && ef.data_devolucao >= inicio && ef.data_devolucao < fim ? ef.data_devolucao : null;
          const fimEf = devRaw ? (() => { const d = parseLocalDate(devRaw); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })() : fim;
          const diasProp = Math.max(1, Math.round((parseLocalDate(fimEf).getTime() - parseLocalDate(inicioEf).getTime()) / 86400000) + 1);
          const baseMinimo = ef.hora_minima_original > 0 ? ef.hora_minima_original : ef.horas_contratadas_original;
          const propMinimo = Number(((baseMinimo / 30) * diasProp).toFixed(1));
          const horasEfetivas = Math.max(propMinimo, ef.horas_medidas);
          ef.horas_normais = Number(Math.min(horasEfetivas, ef.horas_contratadas).toFixed(1));
          ef.horas_excedentes = Number(Math.max(0, horasEfetivas - ef.horas_contratadas).toFixed(1));
        } else {
          ef.horas_normais = Number(Math.min(ef.horas_medidas, ef.horas_contratadas).toFixed(1));
          ef.horas_excedentes = Number(Math.max(0, ef.horas_medidas - ef.horas_contratadas).toFixed(1));
        }
      } else {
        const applyMinima = ef.hora_minima > 0;
        const horasEfetivas = applyMinima && ef.horas_medidas < ef.hora_minima ? ef.hora_minima : ef.horas_medidas;
        ef.horas_normais = Number(Math.min(horasEfetivas, ef.horas_contratadas).toFixed(1));
        ef.horas_excedentes = Number(Math.max(0, horasEfetivas - ef.horas_contratadas).toFixed(1));
      }
    });

    setEquipForms(newEquipForms);

    // Gastos
    const existingGastos = (gastosRes.data || []) as GastoItem[];
    setGastosEquip(existingGastos);
    setSelectedGastos(new Set());
    setTotalGastos(0);

    // Detect Mobilização/Desmobilização events
    const mobEvents: MobEvent[] = [];
    for (const ef of newEquipForms) {
      const hasMobGasto = existingGastos.some(g => g.equipamento_id === ef.equipamento_id && g.tipo === "Mobilização");
      const hasDesmobGasto = existingGastos.some(g => g.equipamento_id === ef.equipamento_id && g.tipo === "Desmobilização");

      if (ef.data_entrega && ef.data_entrega >= inicio && ef.data_entrega <= fim && !hasMobGasto) {
        mobEvents.push({ equipamento_id: ef.equipamento_id, tipo: ef.tipo, modelo: ef.modelo, tag_placa: ef.tag_placa, evento: "Mobilização", data: ef.data_entrega });
      }
      if (ef.data_devolucao && ef.data_devolucao >= inicio && ef.data_devolucao <= fim && !hasDesmobGasto) {
        mobEvents.push({ equipamento_id: ef.equipamento_id, tipo: ef.tipo, modelo: ef.modelo, tag_placa: ef.tag_placa, evento: "Desmobilização", data: ef.data_devolucao });
      }
    }

    if (mobEvents.length > 0) {
      setMobAlerts(mobEvents);
      const defaultValues: Record<string, number> = {};
      mobEvents.forEach((e, i) => { defaultValues[`${e.equipamento_id}_${e.evento}`] = 0; });
      setMobValues(defaultValues);
      setMobDialogOpen(true);
    } else {
      setMobAlerts([]);
    }

    setLoadingMedicoes(false);
  }, [contratos]);

  // Create mobilização/desmobilização gastos
  const handleCreateMobGastos = async () => {
    setCreatingMob(true);
    const toCreate = mobAlerts.filter(e => {
      const key = `${e.equipamento_id}_${e.evento}`;
      return (mobValues[key] || 0) > 0;
    });
    if (toCreate.length === 0) {
      toast({ title: "Nenhum valor informado", description: "Informe o valor para pelo menos um item.", variant: "destructive" });
      setCreatingMob(false);
      return;
    }
    const rows = toCreate.map(e => ({
      equipamento_id: e.equipamento_id,
      descricao: `${e.evento} — ${e.tipo} ${e.modelo}${e.tag_placa ? ` (${e.tag_placa})` : ""}`,
      tipo: e.evento,
      valor: mobValues[`${e.equipamento_id}_${e.evento}`],
      data: e.data,
      classificacao: "A Cobrar do Cliente",
    }));
    const { data, error } = await supabase.from("gastos").insert(rows).select("id, descricao, tipo, valor, data, equipamento_id, classificacao");
    if (error) {
      toast({ title: "Erro ao criar custos", description: error.message, variant: "destructive" });
    } else if (data) {
      const newGastos = [...gastosEquip, ...(data as GastoItem[])];
      setGastosEquip(newGastos);
      const newSelected = new Set(selectedGastos);
      data.forEach(g => newSelected.add(g.id));
      setSelectedGastos(newSelected);
      toast({ title: "Custos criados", description: `${data.length} custo(s) de mobilização/desmobilização adicionado(s) e selecionado(s).` });
    }
    setMobDialogOpen(false);
    setCreatingMob(false);
  };

  // Insert zero-value gastos to mark as "não cobrado" and prevent future popups
  const handleNaoCobrarMob = async () => {
    setCreatingMob(true);
    const rows = mobAlerts.map(e => ({
      equipamento_id: e.equipamento_id,
      descricao: `${e.evento} (não cobrado) — ${e.tipo} ${e.modelo}${e.tag_placa ? ` (${e.tag_placa})` : ""}`,
      tipo: e.evento,
      valor: 0,
      data: e.data,
      classificacao: "A Cobrar do Cliente",
    }));
    const { data, error } = await supabase.from("gastos").insert(rows).select("id, descricao, tipo, valor, data, equipamento_id, classificacao");
    if (error) {
      toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });
    } else if (data) {
      const newGastos = [...gastosEquip, ...(data as GastoItem[])];
      setGastosEquip(newGastos);
      toast({ title: "Registrado", description: "Mobilização/desmobilização marcada como não cobrada." });
    }
    setMobDialogOpen(false);
    setCreatingMob(false);
  };

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

  // Recalculate totalGastos when selection changes (cobrar - reembolsar)
  useEffect(() => {
    const selectedItems = gastosEquip.filter(g => selectedGastos.has(g.id));
    const cobrar = selectedItems.filter(g => (g.classificacao || "A Cobrar do Cliente") !== "A Reembolsar ao Cliente").reduce((acc, g) => acc + Number(g.valor), 0);
    const reembolsar = selectedItems.filter(g => g.classificacao === "A Reembolsar ao Cliente").reduce((acc, g) => acc + Number(g.valor), 0);
    setTotalGastos(cobrar - reembolsar);
  }, [selectedGastos, gastosEquip]);

  // Recalculate hours helper
  const recalcHours = (ef: EquipFormItem) => {
    const isProporcional = ef.primeiro_mes || ef.proporcional_devolucao;
    if (isProporcional) {
      if (ef.cobranca_parcial === "proporcional_minimo" && formMedicaoInicio && formMedicaoFim) {
        const inicioEf = ef.data_entrega && ef.data_entrega > formMedicaoInicio && ef.data_entrega <= formMedicaoFim ? ef.data_entrega : formMedicaoInicio;
        const devRaw = ef.data_devolucao && ef.data_devolucao >= formMedicaoInicio && ef.data_devolucao < formMedicaoFim ? ef.data_devolucao : null;
        const fimEf = devRaw ? (() => { const d = parseLocalDate(devRaw); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })() : formMedicaoFim;
        const diasProp = Math.max(1, Math.round((parseLocalDate(fimEf).getTime() - parseLocalDate(inicioEf).getTime()) / 86400000) + 1);
        const baseMinimo = ef.hora_minima_original > 0 ? ef.hora_minima_original : ef.horas_contratadas_original;
        const propMinimo = Number(((baseMinimo / 30) * diasProp).toFixed(1));
        const horasEfetivas = Math.max(propMinimo, ef.horas_medidas);
        ef.horas_normais = Number(Math.min(horasEfetivas, ef.horas_contratadas).toFixed(1));
        ef.horas_excedentes = Number(Math.max(0, horasEfetivas - ef.horas_contratadas).toFixed(1));
      } else {
        ef.horas_normais = Number(Math.min(ef.horas_medidas, ef.horas_contratadas).toFixed(1));
        ef.horas_excedentes = Number(Math.max(0, ef.horas_medidas - ef.horas_contratadas).toFixed(1));
      }
    } else {
      const applyMinima = ef.hora_minima > 0;
      const horasEfetivas = applyMinima && ef.horas_medidas < ef.hora_minima ? ef.hora_minima : ef.horas_medidas;
      ef.horas_normais = Number(Math.min(horasEfetivas, ef.horas_contratadas).toFixed(1));
      ef.horas_excedentes = Number(Math.max(0, horasEfetivas - ef.horas_contratadas).toFixed(1));
    }
  };

  // Recalculate hours when primeiroMes toggles
  const togglePrimeiroMes = (idx: number) => {
    setEquipForms(prev => {
      const updated = [...prev];
      const ef = { ...updated[idx] };
      ef.primeiro_mes = !ef.primeiro_mes;
      // No longer adjust horasContratadas/horaMinima proportionally — just toggle flag
      if (!ef.primeiro_mes && !ef.proporcional_devolucao) {
        ef.horas_contratadas = ef.horas_contratadas_original;
        ef.hora_minima = ef.hora_minima_original;
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
      // No longer adjust horasContratadas/horaMinima proportionally — just toggle flag
      if (!ef.proporcional_devolucao && !ef.primeiro_mes) {
        ef.horas_contratadas = ef.horas_contratadas_original;
        ef.hora_minima = ef.hora_minima_original;
      }
      recalcHours(ef);
      updated[idx] = ef;
      return updated;
    });
  };

  // Change cobrança parcial mode
  const changeCobrancaParcial = (idx: number, mode: "horas_trabalhadas" | "proporcional_minimo") => {
    setEquipForms(prev => {
      const updated = [...prev];
      const ef = { ...updated[idx] };
      ef.cobranca_parcial = mode;
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
    if (item.status === "Pago" || item.status === "Cancelado" || item.status === "Aprovado") return item.status;
    const vencimento = getVencimento(item);
    if (new Date() > vencimento) return "Em Atraso";
    return item.status;
  };

  const handleAprovar = async (id: string, numeroNota: string, observacoes: string) => {
    const hoje = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("faturamento").update({ status: "Aprovado", numero_nota: numeroNota || null, data_aprovacao: hoje, observacoes: observacoes || "" } as any).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Medição aprovada", description: "A fatura foi emitida automaticamente na aba Faturamento." });
    setApprovalDialogOpen(false);
    setApprovalItemId(null);
    setApprovalNumeroNota("");
    setApprovalObservacoes("");
    fetchData();
  };

  const getVencimento = (item: Fatura) => {
    const ct = contratos.find(c => c.id === item.contrato_id);
    const prazo = ct?.prazo_faturamento || 30;
    // Vencimento é contado a partir da data de aprovação, se existir
    const baseDate = (item as any).data_aprovacao
      ? parseLocalDate((item as any).data_aprovacao)
      : parseLocalDate(item.emissao);
    const vencimento = new Date(baseDate);
    vencimento.setDate(vencimento.getDate() + prazo);
    return vencimento;
  };

  const filtered = items.filter((i) => {
    const matchesSearch = !search ||
      i.contratos?.empresas?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      i.periodo.includes(search) ||
      String(i.numero_sequencial).includes(search);
    if (!matchesSearch) return false;
    // Company filter
    if (filterEmpresa !== "all") {
      const ct = contratos.find(c => c.id === i.contrato_id);
      if (ct?.empresa_id !== filterEmpresa) return false;
    }
    // Period filter
    if (filterPeriodoInicio && i.periodo_medicao_fim && i.periodo_medicao_fim < filterPeriodoInicio) return false;
    if (filterPeriodoFim && i.periodo_medicao_inicio && i.periodo_medicao_inicio > filterPeriodoFim) return false;
    return true;
  });
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
    const headers = ["Nº", "Empresa", "CNPJ", "Período Medição", "Horas Normais", "Horas Excedentes", "Custos Adicionais (R$)", "Valor Total (R$)", "Status"];
    const rows = data.map(i => [
      String(i.numero_sequencial),
      i.contratos?.empresas?.nome || "",
      i.contratos?.empresas?.cnpj || "",
      i.periodo_medicao_inicio && i.periodo_medicao_fim ? `${parseLocalDate(i.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(i.periodo_medicao_fim).toLocaleDateString("pt-BR")}` : "—",
      String(i.horas_normais),
      String(i.horas_excedentes),
      Number(i.total_gastos || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      Number(i.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      i.status,
    ]);
    return { title: "Relatório de Medição", headers, rows, filename: `medicao_${new Date().toISOString().slice(0, 10)}` };

  };


  const exportDetailedPDF = async (singleItem?: Fatura) => {
    const data = singleItem ? [singleItem] : filtered.filter(i => selected.size === 0 || selected.has(i.id));
    if (data.length === 0) return;

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", format: "a4" });
    const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtBRL = (v: number) => `R$ ${fmt(v)}`;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const mL = 14; // left margin
    const mR = 14; // right margin
    const contentW = pageW - mL - mR;

    // Fetch Busato company data
    const { data: busatoEmp } = await supabase.from("empresas").select("*").ilike("nome", "%busato%").limit(1).single();

    for (let idx = 0; idx < data.length; idx++) {
      const item = data[idx];
      if (idx > 0) doc.addPage();

      const ct = item.contratos;
      const emp = ct?.empresas;
      // If empresa_faturamento_id is set, use that company for the PDF header
      const empresaFat = item.empresa_faturamento_id ? empresasList.find(e => e.id === item.empresa_faturamento_id) : null;
      const empNome = empresaFat ? empresaFat.nome : (emp?.nome || "—");
      const empCnpj = empresaFat ? empresaFat.cnpj : (emp?.cnpj || "—");
      const gastosVal = Number(item.total_gastos || 0);
      const inicio = item.periodo_medicao_inicio || "";
      const fim = item.periodo_medicao_fim || "";
      const inicioFmt = inicio ? parseLocalDate(inicio).toLocaleDateString("pt-BR") : "";
      const fimFmt = fim ? parseLocalDate(fim).toLocaleDateString("pt-BR") : "";

      // ──────────────── HEADER BLOCK ────────────────
      const logo = await (async () => {
        try {
          const resp = await fetch("/images/logo-busato-horizontal.png");
          const blob = await resp.blob();
          return new Promise<string | null>((resolve) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result as string);
            r.onerror = () => resolve(null);
            r.readAsDataURL(blob);
          });
        } catch { return null; }
      })();

      let y = 10;

      const busatoNome = busatoEmp?.razao_social || busatoEmp?.nome || "BUSATO LOCAÇÕES E SERVIÇOS LTDA";
      const busatoCnpj = busatoEmp?.cnpj || "";
      const busatoEndereco = busatoEmp ? [busatoEmp.endereco_logradouro, busatoEmp.endereco_numero, busatoEmp.endereco_complemento, busatoEmp.endereco_bairro, busatoEmp.endereco_cidade, busatoEmp.endereco_uf, busatoEmp.endereco_cep ? `CEP: ${busatoEmp.endereco_cep}` : ""].filter(Boolean).join(", ") : "";
      const busatoIE = busatoEmp?.inscricao_estadual || "";

      // === HEADER (same as Fatura) ===
      if (logo) doc.addImage(logo, "PNG", mL, y, 48, 12);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      const docLabel = inicioFmt && fimFmt ? `${inicioFmt} - ${fimFmt}` : String(item.numero_sequencial).padStart(3, "0");
      doc.text(`BOLETIM DE MEDIÇÃO ${docLabel}`, pageW - mR, y + 8, { align: "right" });
      y += 18;

      // Busato info
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(busatoNome.toUpperCase(), mL, y);
      y += 3.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      if (busatoEndereco) {
        doc.text(busatoEndereco, mL, y);
        y += 3;
      }
      const cnpjLine = [busatoCnpj ? `CNPJ: ${busatoCnpj}` : "", busatoIE ? `Inscrição Estadual: ${busatoIE}` : ""].filter(Boolean).join(" - ");
      if (cnpjLine) {
        doc.text(cnpjLine, mL, y);
      }
      y += 5;

      // Blue separator
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(0.5);
      doc.line(mL, y, pageW - mR, y);
      y += 5;

      // ──────────────── MEASUREMENT INFO BLOCK ────────────────
      const periodoStr = inicio && fim
        ? `${parseLocalDate(inicio).toLocaleDateString("pt-BR")} a ${parseLocalDate(fim).toLocaleDateString("pt-BR")}`
        : "—";
      const mesRef = item.periodo || "—";

      // Collect equipment types for "Objeto de contrato"
      const ceList = ct?.contratos_equipamentos || [];
      const baseEquipIds = ceList.length > 0 ? ceList.map(ce => ce.equipamento_id) : [ct?.equipamento_id].filter(Boolean) as string[];

      // Fetch addendums overlapping the period
      const { data: pdfAditivosData } = inicio && fim ? await supabase
        .from("contratos_aditivos")
        .select("id, numero, data_inicio, data_fim")
        .eq("contrato_id", item.contrato_id)
        .lte("data_inicio", fim)
        .gte("data_fim", inicio) : { data: null };

      let pdfAditivoEquipMap = new Map<string, any>();
      let pdfAditivoExtraIds: string[] = [];
      if (pdfAditivosData && pdfAditivosData.length > 0) {
        const adIds = pdfAditivosData.map(a => a.id);
        const { data: aeData } = await supabase.from("aditivos_equipamentos").select("*").in("aditivo_id", adIds);
        if (aeData) {
          for (const ae of aeData) {
            if (ae.data_entrega && ae.data_entrega > fim) continue;
            const aditivo = pdfAditivosData.find(a => a.id === ae.aditivo_id);
            const existing = pdfAditivoEquipMap.get(ae.equipamento_id);
            const existingAd = existing ? pdfAditivosData.find(a => a.id === existing.aditivo_id) : null;
            if (!existing || (aditivo && existingAd && aditivo.numero > existingAd.numero)) {
              pdfAditivoEquipMap.set(ae.equipamento_id, ae);
            }
          }
          pdfAditivoExtraIds = [...new Set(aeData.filter(ae => !ae.data_entrega || ae.data_entrega <= fim).map(ae => ae.equipamento_id))]
            .filter(id => !baseEquipIds.includes(id));
        }
      }

      const allPdfEquipIds = [...baseEquipIds, ...pdfAditivoExtraIds].filter(eqId => {
        const ce = ceList.find(c => c.equipamento_id === eqId);
        const ae = pdfAditivoEquipMap.get(eqId);
        const devolucao = ae?.data_devolucao || ce?.data_devolucao || null;
        if (devolucao && devolucao <= inicio) return false;
        const entrega = ae?.data_entrega || ce?.data_entrega || null;
        if (entrega && entrega > fim) return false;
        return true;
      });

      const { data: eqData } = allPdfEquipIds.length > 0 ? await supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").in("id", allPdfEquipIds) : { data: [] };
      const eqMap = new Map((eqData || []).map(e => [e.id, e]));

      const equipTypes = [...new Set((eqData || []).map(e => e.tipo))].join(", ") || "—";

      const medInfoRows = [
        { label: "Mês de Referência:", value: mesRef },
        { label: "Período de Medição:", value: periodoStr },
        { label: empresaFat ? "Faturar Para:" : "Empresa Contratante:", value: empNome },
        { label: empresaFat ? "CNPJ Faturamento:" : "CNPJ Contratante:", value: empCnpj },
        { label: "Objeto de contrato:", value: equipTypes },
      ];
      if (empresaFat) {
        medInfoRows.push({ label: "Empresa Locadora:", value: emp?.nome || "—" });
        medInfoRows.push({ label: "CNPJ Locadora:", value: emp?.cnpj || "—" });
      }

      // Draw info block with gray background for labels
      for (const info of medInfoRows) {
        doc.setFillColor(235, 235, 235);
        doc.rect(mL, y - 3, 48, 5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(info.label, mL + 1, y);
        doc.setFont("helvetica", "normal");
        doc.text(info.value, mL + 50, y);
        y += 5.5;
      }

      y += 4;

      // ──────────────── EQUIPMENT TABLE ────────────────
      // Fetch saved equipment data (to use saved horas_normais/excedentes instead of recalculating)
      const { data: savedFatEquips } = await supabase.from("faturamento_equipamentos").select("*").eq("faturamento_id", item.id);
      const savedEquipMap = new Map((savedFatEquips || []).map((se: any) => [se.equipamento_id, se]));

      // Fetch adjustments & measurements
      const { data: pdfAjustes } = allPdfEquipIds.length > 0 && inicio && fim
        ? await supabase.from("contratos_equipamentos_ajustes").select("*")
            .eq("contrato_id", item.contrato_id).in("equipamento_id", allPdfEquipIds)
            .lte("data_inicio", fim).gte("data_fim", inicio)
        : { data: [] };

      // Fetch readings within period + baseline before period for interpolation
      const medPromises = allPdfEquipIds.map(eqId => {
        const ce = ceList.find(c => c.equipamento_id === eqId);
        const ae = pdfAditivoEquipMap.get(eqId);
        const entrega = ae?.data_entrega || ce?.data_entrega || null;
        const devolucao = ae?.data_devolucao || ce?.data_devolucao || null;
        const iEf = entrega && entrega > inicio ? entrega : inicio;
        const fEf = devolucao && devolucao < fim ? devolucao : fim;
        return supabase.from("medicoes").select("equipamento_id, horimetro_final, horas_trabalhadas, data, tipo").eq("equipamento_id", eqId).gte("data", iEf).lte("data", fEf);
      });
      // Fetch baseline readings (last reading before period start for each equipment)
      const baselinePromises = allPdfEquipIds.map(eqId => {
        const ce = ceList.find(c => c.equipamento_id === eqId);
        const ae = pdfAditivoEquipMap.get(eqId);
        const entrega = ae?.data_entrega || ce?.data_entrega || null;
        const iEf = entrega && entrega > inicio ? entrega : inicio;
        return supabase.from("medicoes").select("equipamento_id, horimetro_final, data, tipo")
          .eq("equipamento_id", eqId).eq("tipo", "Trabalho").lt("data", iEf)
          .order("data", { ascending: false }).limit(1);
      });
      const [medResults, baselineResults] = await Promise.all([
        Promise.all(medPromises),
        Promise.all(baselinePromises),
      ]);
      const allMedicoes = medResults.flatMap(r => r.data || []);
      const allBaselines = baselineResults.flatMap(r => r.data || []);

      // Calculate total
      let totalMedicao = 0;

      const eqRows = allPdfEquipIds.map(eqId => {
        const eq = eqMap.get(eqId);
        const ce = ceList.find(c => c.equipamento_id === eqId);
        const ae = pdfAditivoEquipMap.get(eqId);

        // Hours worked using interpolation
        const eqMeds = allMedicoes.filter(m => m.equipamento_id === eqId && (m.tipo || 'Trabalho') === 'Trabalho');
        const eqBaseline = allBaselines.filter(m => m.equipamento_id === eqId);
        const allReadings = [...eqBaseline, ...eqMeds].map(m => ({ data: String(m.data), horimetro_final: Number(m.horimetro_final) }));
        const entregaEq = ae?.data_entrega || ce?.data_entrega || null;
        const devolucaoEq = ae?.data_devolucao || ce?.data_devolucao || null;
        const iEf = entregaEq && entregaEq > inicio ? entregaEq : inicio;
        const fEf = devolucaoEq && devolucaoEq < fim ? devolucaoEq : fim;
        const { totalHoras: horasMedidas } = calcularHorasInterpoladas(allReadings, iEf, fEf);

        // Hours unavailable
        const eqIndisp = allMedicoes.filter(m => m.equipamento_id === eqId && m.tipo === 'Indisponível');
        let horasIndisponiveis = 0;
        for (const m of eqIndisp) {
          horasIndisponiveis += Number((m as any).horas_trabalhadas || 0);
        }

        const ajuste = (pdfAjustes || []).filter(a => a.equipamento_id === eqId).sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0] || null;
        const baseVh = ae ? Number(ae.valor_hora) : ce ? Number(ce.valor_hora) : Number(ct.valor_hora);
        const baseVhe = ae ? Number(ae.valor_hora_excedente) : ce ? Number(ce.valor_hora_excedente) : baseVh * 1.25;
        const baseHc = ae ? Number(ae.horas_contratadas) : ce ? Number(ce.horas_contratadas) : Number(ct.horas_contratadas);
        const baseHm = ae ? Number(ae.hora_minima) : ce ? Number(ce.hora_minima) : 0;

        const descontoPerc = ajuste ? Number((ajuste as any).desconto_percentual || 0) : 0;
        const fatorDesconto = descontoPerc > 0 ? (1 - descontoPerc / 100) : 1;
        const vh = (ajuste ? Number(ajuste.valor_hora) : baseVh) * fatorDesconto;
        const vhe = (ajuste ? Number(ajuste.valor_hora_excedente) : baseVhe) * fatorDesconto;
        let hc = ajuste ? Number(ajuste.horas_contratadas) : baseHc;
        let hm = ajuste ? Number(ajuste.hora_minima) : baseHm;

        // Use saved values if available (preserves cobrança parcial choice)
        const savedEq = savedEquipMap.get(eqId);
        let hn: number, he: number;
        if (savedEq) {
          hn = Number(savedEq.horas_normais);
          he = Number(savedEq.horas_excedentes);
        } else {
          // Proportional for delivery/return
          const entrega = ae?.data_entrega || ce?.data_entrega || null;
          const devolucao = ae?.data_devolucao || ce?.data_devolucao || null;
          const isProporcional = (entrega && entrega > inicio && entrega <= fim) || (devolucao && devolucao >= inicio && devolucao < fim);

          let horasEfetivas: number;
          if (isProporcional) {
            horasEfetivas = horasMedidas;
          } else {
            horasEfetivas = hm > 0 && horasMedidas < hm ? hm : horasMedidas;
          }
          hn = Number(Math.min(horasEfetivas, hc).toFixed(1));
          he = Number(Math.max(0, horasEfetivas - hc).toFixed(1));
        }
        const valorTotal = hn * vh + he * vhe;
        totalMedicao += valorTotal;

        const itemDesc = `${(eq?.tipo || "").toUpperCase()} ${(eq?.modelo || "").toUpperCase()}`;
        const tagPlaca = eq?.tag_placa || "—";
        const numSerie = eq?.numero_serie || "—";

        // Determine type label (Mobilização, Desmobilização, Proporcional, etc.)
        const tipoLabels: string[] = [];
        const entregaDate = ae?.data_entrega || ce?.data_entrega || null;
        const devolucaoDate = ae?.data_devolucao || ce?.data_devolucao || null;
        if (entregaDate && entregaDate > inicio && entregaDate <= fim) {
          tipoLabels.push("Mobilização (Proporcional)");
        }
        if (devolucaoDate && devolucaoDate >= inicio && devolucaoDate < fim) {
          tipoLabels.push("Desmobilização (Proporcional)");
        }
        if (ajuste) {
          const ajusteDesc = ajuste.motivo || "S/ descrição";
          if (descontoPerc > 0) {
            tipoLabels.push(`Ajuste: ${ajusteDesc} (Desconto ${descontoPerc}%)`);
          } else {
            tipoLabels.push(`Ajuste: ${ajusteDesc}`);
          }
        }
        const tipoStr = tipoLabels.length > 0 ? tipoLabels.join(" / ") : "";

        // Period measured for this specific equipment
        const periodoEqInicio = parseLocalDate(iEf).toLocaleDateString("pt-BR");
        const periodoEqFim = parseLocalDate(fEf).toLocaleDateString("pt-BR");
        const periodoEqStr = `${periodoEqInicio} a ${periodoEqFim}`;

        // Build sub-line text (Tipo + Período) to show below equipment
        const subParts: string[] = [];
        if (tipoStr) subParts.push(tipoStr);
        subParts.push(`Período: ${periodoEqStr}`);
        const subLineText = subParts.join("  •  ");

        return {
          mainRow: [
            itemDesc,
            tagPlaca,
            numSerie,
            fmtBRL(vh),
            fmtBRL(vhe),
            `${fmt(hm)}h`,
            `${fmt(horasMedidas)}h`,
            `${fmt(horasIndisponiveis)}h`,
            fmtBRL(valorTotal),
          ],
          subLineText,
        };
      });

      // Build body rows: each equipment gets a main row + a sub-row spanning all columns
      const tableBody: any[][] = [];
      for (const { mainRow, subLineText } of eqRows) {
        tableBody.push(mainRow);
        tableBody.push([{ content: subLineText, colSpan: 9, styles: { fontSize: 6, fontStyle: "italic", textColor: [100, 100, 100], fillColor: [250, 250, 250], cellPadding: { top: 1, bottom: 1, left: 4, right: 2 } } }]);
      }

      // Table with all contract info columns — auto-expand to fill page
      const tableMargin = { left: mL, right: mR };
      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        head: [["Equipamento", "Tag", "Nº Série", "V/h", "V/h Exc", "Mínima", "Horas Trabalhadas", "Indisponível", "Valor Total R$"]],
        body: tableBody,
        styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", halign: "center" },
        alternateRowStyles: {},
        columnStyles: {
          1: { halign: "center" },
          2: { halign: "center" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "center" },
          6: { halign: "center" },
          7: { halign: "center" },
          8: { halign: "right" },
        },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY;

      // Medição Total - right aligned with proper spacing
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(41, 128, 185);
      doc.text("Medição Total:", pageW - mR - 40, y, { align: "right" });
      doc.text(fmtBRL(totalMedicao), pageW - mR, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 12;

      // ──────────────── CUSTOS ADICIONAIS ────────────────
      let totalCobrar = 0;
      let totalReembolsar = 0;

      {
        const { data: fgData } = await supabase.from("faturamento_gastos").select("gasto_id").eq("faturamento_id", item.id);
        if (fgData && fgData.length > 0) {
          const gastoIds = fgData.map((fg: any) => fg.gasto_id);
          const { data: gastosData } = await supabase.from("gastos").select("descricao, tipo, valor, data, equipamento_id, classificacao").in("id", gastoIds);
          if (gastosData && gastosData.length > 0) {
            // Fetch equipment names for cost rows
            const gastoEquipIds = [...new Set(gastosData.map((g: any) => g.equipamento_id).filter(Boolean))];
            let gastoEqMap = new Map<string, string>();
            if (gastoEquipIds.length > 0) {
              const { data: geData } = await supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").in("id", gastoEquipIds);
              if (geData) {
                for (const e of geData) {
                  gastoEqMap.set(e.id, `${e.tipo} ${e.modelo}${e.tag_placa ? ` - ${e.tag_placa}` : ""}`);
                }
              }
            }

            const gastosCobrar = gastosData.filter((g: any) => (g.classificacao || "A Cobrar do Cliente") !== "A Reembolsar ao Cliente");
            const gastosReembolsar = gastosData.filter((g: any) => g.classificacao === "A Reembolsar ao Cliente");

            totalCobrar = gastosCobrar.reduce((a: number, g: any) => a + Number(g.valor), 0);
            totalReembolsar = gastosReembolsar.reduce((a: number, g: any) => a + Number(g.valor), 0);

            const formatGastoRow = (g: any) => [
              parseLocalDate(g.data).toLocaleDateString("pt-BR"),
              gastoEqMap.get(g.equipamento_id) || "—",
              g.descricao,
              g.tipo,
              fmtBRL(Number(g.valor)),
            ];

            // Table: Custos a Cobrar do Cliente
            if (gastosCobrar.length > 0) {
              if (y > 230) { doc.addPage(); y = 15; }
              doc.setFillColor(235, 235, 235);
              doc.rect(mL, y - 3, contentW, 5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8);
              doc.setTextColor(0, 0, 0);
              doc.text("Custos Adicionais — A Cobrar do Cliente", mL + 1, y);
              y += 4;

              autoTable(doc, {
                startY: y,
                margin: tableMargin,
                head: [["Data", "Equipamento", "Descrição", "Tipo", "Valor"]],
                body: gastosCobrar.map(formatGastoRow),
                styles: { fontSize: 8, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                alternateRowStyles: { fillColor: [240, 246, 252] },
                columnStyles: { 0: { halign: "center" }, 4: { halign: "right" } },
                theme: "grid",
              });
              y = (doc as any).lastAutoTable.finalY + 4;
              doc.setFont("helvetica", "bold");
              doc.setFontSize(10);
              doc.setTextColor(41, 128, 185);
              doc.text("Total a Cobrar:", pageW - mR - 40, y, { align: "right" });
              doc.text(fmtBRL(totalCobrar), pageW - mR, y, { align: "right" });
              doc.setTextColor(0, 0, 0);
              y += 10;
            }

            // Table: Custos a Reembolsar ao Cliente
            if (gastosReembolsar.length > 0) {
              if (y > 230) { doc.addPage(); y = 15; }
              doc.setFillColor(235, 235, 235);
              doc.rect(mL, y - 3, contentW, 5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8);
              doc.setTextColor(0, 0, 0);
              doc.text("Créditos ao Cliente — A Reembolsar", mL + 1, y);
              y += 4;

              autoTable(doc, {
                startY: y,
                margin: tableMargin,
                head: [["Data", "Equipamento", "Descrição", "Tipo", "Valor"]],
                body: gastosReembolsar.map(formatGastoRow),
                styles: { fontSize: 8, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
                headStyles: { fillColor: [192, 57, 43], textColor: 255 },
                alternateRowStyles: { fillColor: [252, 240, 240] },
                columnStyles: { 0: { halign: "center" }, 4: { halign: "right" } },
                theme: "grid",
              });
              y = (doc as any).lastAutoTable.finalY + 4;
              doc.setFont("helvetica", "bold");
              doc.setFontSize(10);
              doc.setTextColor(192, 57, 43);
              doc.text("Total a Reembolsar:", pageW - mR - 40, y, { align: "right" });
              doc.text(`- ${fmtBRL(totalReembolsar)}`, pageW - mR, y, { align: "right" });
              doc.setTextColor(0, 0, 0);
              y += 10;
            }
          }
        }
      }

      // ──────────────── RESUMO TOTAL ────────────────
      const grandTotal = totalMedicao + totalCobrar - totalReembolsar;
      if (y > 240) { doc.addPage(); y = 15; }

      const resumoBody: string[][] = [
        ["Medição (Equipamentos)", fmtBRL(totalMedicao)],
      ];
      if (totalCobrar > 0) resumoBody.push(["(+) Custos a Cobrar do Cliente", fmtBRL(totalCobrar)]);
      if (totalReembolsar > 0) resumoBody.push(["(−) Créditos ao Cliente", `- ${fmtBRL(totalReembolsar)}`]);
      resumoBody.push(["VALOR TOTAL DA MEDIÇÃO", fmtBRL(grandTotal)]);

      const lastIdx = resumoBody.length - 1;
      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        head: [["Descrição", "Valor"]],
        body: resumoBody,
        styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 246, 252] },
        columnStyles: {
          0: { fontStyle: "bold" },
          1: { halign: "right" },
        },
        bodyStyles: {},
        didParseCell: (data: any) => {
          if (data.section === "body" && data.row.index === lastIdx) {
            data.cell.styles.fillColor = [41, 128, 185];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 10;
          }
        },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // ──────────────── APPROVAL / SIGNATURE BLOCK ────────────────
      // Ensure enough space for signature block (~40mm needed)
      if (y + 40 > pageH - 25) {
        doc.addPage();
        y = 20;
      }

      const sigY = Math.max(y + 14, pageH - 55);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text("Aprovação:", mL, sigY);

      const sigLineY = sigY + 20;
      const halfW = (contentW - 30) / 2;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);

      // Left signature
      doc.line(mL, sigLineY, mL + halfW, sigLineY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(busatoNome, mL + halfW / 2, sigLineY + 5, { align: "center" });

      // Right signature
      const rightX = mL + halfW + 30;
      doc.line(rightX, sigLineY, rightX + halfW, sigLineY);
      doc.text(empNome || "CONTRATANTE", rightX + halfW / 2, sigLineY + 5, { align: "center" });

      // ──────────────── FOOTER ────────────────
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(6);
        doc.setTextColor(130, 130, 130);
        doc.text(`Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}  —  Página ${p} de ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
      }
    }

    doc.save(`boletim_medicao_${new Date().toISOString().slice(0, 10)}.pdf`);
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
    setFormStatus("Pendente");
    setFormMedicaoInicio("");
    setFormMedicaoFim("");
    setEquipForms([]);
    setGastosEquip([]);
    setTotalGastos(0);
    setSelectedGastos(new Set());
    setFormContaBancariaId("");
    setFormEmpresaFaturamentoId("");
    setDialogOpen(true);
  };

  const openEdit = async (item: Fatura) => {
    setEditing(item);
    setFormContratoId(item.contrato_id);
    setFormPeriodo(item.periodo);
    
    setFormStatus(item.status);
    setFormContaBancariaId(item.conta_bancaria_id || "");
    setFormEmpresaFaturamentoId(item.empresa_faturamento_id || "");
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

  const derivePeriodo = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${meses[d.getMonth()]}/${d.getFullYear()}`;
  };

  const handleContratoSelect = (contratoId: string) => {
    const ct = contratos.find(c => c.id === contratoId);
    if (ct) {
      const dates = calcMedicaoDates(ct);
      setFormContratoId(contratoId);
      setFormMedicaoInicio(dates.inicio);
      setFormMedicaoFim(dates.fim);
      setFormPeriodo(derivePeriodo(dates.inicio));
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
      numero_nota: editing?.numero_nota || null,
      periodo_medicao_inicio: formMedicaoInicio || null,
      periodo_medicao_fim: formMedicaoFim || null,
      total_gastos: totalGastos,
      conta_bancaria_id: formContaBancariaId || null,
      empresa_faturamento_id: formEmpresaFaturamentoId || null,
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
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Medição</h1>
            {selected.size > 0 && <p className="text-sm text-muted-foreground">{selected.size} selecionada(s)</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => exportDetailedPDF()}><FileDown className="h-4 w-4 mr-1" /> Exportar Medição</Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4 mr-2" /> Nova Medição</Button>
          </div>
        </div>

        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Todas as Empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Empresas</SelectItem>
                    {(() => {
                      const empresaMap = new Map<string, string>();
                      contratos.forEach(c => { if (c.empresas?.nome) empresaMap.set(c.empresa_id, c.empresas.nome); });
                      items.forEach(i => { if (i.contratos?.empresas?.nome && i.contratos?.empresa_id) empresaMap.set(i.contratos.empresa_id, i.contratos.empresas.nome); });
                      return Array.from(empresaMap.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([id, nome]) => (
                        <SelectItem key={id} value={id}>{nome}</SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Período Início</Label>
                <Input type="date" className="w-44" value={filterPeriodoInicio} onChange={(e) => setFilterPeriodoInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Período Fim</Label>
                <Input type="date" className="w-44" value={filterPeriodoFim} onChange={(e) => setFilterPeriodoFim(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nº, empresa, nota..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
                </div>
              </div>
              {(filterEmpresa !== "all" || filterPeriodoInicio || filterPeriodoFim || search) && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setFilterEmpresa("all"); setFilterPeriodoInicio(""); setFilterPeriodoFim(""); setSearch(""); }}>Limpar filtros</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  
                  <TableHead>Empresa</TableHead>
                  <TableHead>Período Medição</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Horas/Diárias</TableHead>
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
                          {item.empresa_faturamento_id && (() => {
                            const ef = empresasList.find(e => e.id === item.empresa_faturamento_id);
                            return ef ? <p className="text-xs text-warning mt-0.5">Faturar: {ef.nome}</p> : null;
                          })()}
                        </div>
                      </TableCell>
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
                        {(() => {
                          const ct = item.contratos;
                          const isDiarias = ct?.tipo_medicao === "diarias";
                          const unit = isDiarias ? "d" : "h";
                          return (
                            <div className="flex items-center gap-1">
                              {Number(item.horas_normais).toFixed(1)}{unit}{Number(item.horas_excedentes) > 0 && <span className="text-warning"> +{Number(item.horas_excedentes).toFixed(1)}{unit}</span>}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {itemGastos > 0
                          ? <span className="text-accent font-semibold">+ R$ {itemGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          : "—"}
                      </TableCell>
                      <TableCell className="font-bold text-sm">R$ {Number(item.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        {(() => {
                          const displayStatus = getDisplayStatus(item);
                          return (
                            <Badge className={
                              displayStatus === "Aprovado" ? "bg-success text-success-foreground" :
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
                          
                          {getDisplayStatus(item) === "Pendente" && (
                            <Button variant="ghost" size="icon" title="Aprovar e emitir fatura" onClick={() => {
                              setApprovalItemId(item.id);
                              setApprovalNumeroNota("");
                              setApprovalObservacoes("");
                              setApprovalDialogOpen(true);
                            }}><ShieldCheck className="h-4 w-4 text-success" /></Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Medição #{item.numero_sequencial}</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza que deseja excluir esta medição? Esta ação não pode ser desfeita.</AlertDialogDescription>
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
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhuma medição encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              {editing ? `Editar Medição #${editing.numero_sequencial}` : "Nova Medição"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 pr-2">
            <div>
              <Label>Contrato</Label>
              <SearchableSelect
                value={formContratoId}
                onValueChange={handleContratoSelect}
                disabled={!!editing}
                placeholder="Selecione o contrato"
                searchPlaceholder="Pesquisar contrato..."
                options={contratos.map((c) => {
                  const hoje = new Date().toISOString().slice(0, 10);
                  const ces = c.contratos_equipamentos || [];
                  const allAditivos = aditivosPorContratoFat[c.id] || [];
                  
                  // Build global devolucao map (same logic as Contratos page)
                  const globalDev: Record<string, string> = {};
                  for (const ce of ces) {
                    if (ce.data_devolucao && (!globalDev[ce.equipamento_id] || ce.data_devolucao > globalDev[ce.equipamento_id])) globalDev[ce.equipamento_id] = ce.data_devolucao;
                  }
                  for (const ad of allAditivos) {
                    for (const ae of (ad.aditivos_equipamentos || [])) {
                      if (ae.data_devolucao && (!globalDev[ae.equipamento_id] || ae.data_devolucao > globalDev[ae.equipamento_id])) globalDev[ae.equipamento_id] = ae.data_devolucao;
                    }
                  }
                  const isDevolvido = (eqId: string) => { const d = globalDev[eqId]; return d && d <= hoje; };

                  const vigentes = allAditivos.filter((ad: any) => ad.data_inicio <= hoje && ad.data_fim >= hoje);
                  const ultimoAditivo = vigentes.length > 0
                    ? vigentes.reduce((latest: any, ad: any) => ad.numero > latest.numero ? ad : latest, vigentes[0])
                    : null;

                  let equipCount: number;
                  if (ultimoAditivo) {
                    equipCount = (ultimoAditivo.aditivos_equipamentos || []).filter((ae: any) => !isDevolvido(ae.equipamento_id)).length;
                  } else {
                    equipCount = ces.filter((ce: any) => !isDevolvido(ce.equipamento_id)).length;
                  }

                  return {
                    value: c.id,
                    label: `${c.empresas?.nome} — ${equipCount > 0 ? `${equipCount} equipamento(s)` : `${c.equipamentos?.tipo} ${c.equipamentos?.modelo}`}`,
                  };
                })}
              />
            </div>

            {selectedContrato && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  <p><strong>Empresa:</strong> {selectedContrato.empresas?.nome}</p>
                  <p><strong>CNPJ:</strong> {selectedContrato.empresas?.cnpj}</p>
                  <p><strong>Ciclo Medição:</strong> Dia {selectedContrato.dia_medicao_inicio || 1} ao Dia {selectedContrato.dia_medicao_fim || 30}</p>
                  <p><strong>Prazo Faturamento:</strong> {selectedContrato.prazo_faturamento || 30} dias</p>
                  <p><strong>Vigência:</strong> {parseLocalDate(selectedContrato.data_inicio).toLocaleDateString("pt-BR")} a {parseLocalDate(selectedContrato.data_fim).toLocaleDateString("pt-BR")}</p>
                  <p><strong>Tipo Medição:</strong> {selectedContrato.tipo_medicao === "diarias" ? "Por Diárias" : "Por Horas (Horímetro)"}</p>
                  <p><strong>Contato:</strong> {selectedContrato.empresas?.contato || "—"} {selectedContrato.empresas?.telefone ? `/ ${selectedContrato.empresas.telefone}` : ""}</p>
                </div>

                {/* Equipment details from contract + addendums + adjustments */}
                {equipForms.length > 0 && (
                  <div className="border-t border-border/50 pt-2 space-y-1.5">
                    <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Equipamentos ({equipForms.length})</p>
                    <div className="space-y-1">
                      {equipForms.map(ef => (
                        <div key={ef.equipamento_id} className="flex items-center justify-between text-xs p-1.5 rounded bg-background/60">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{ef.tipo} {ef.modelo} {ef.tag_placa ? `(${ef.tag_placa})` : ""}</span>
                            {ef.ajuste && <Badge variant="outline" className="text-[10px] h-4 border-accent text-accent px-1">Ajuste</Badge>}
                            {ef.aditivo && <Badge variant="outline" className="text-[10px] h-4 border-primary text-primary px-1">Aditivo {ef.aditivo_numero ? `#${ef.aditivo_numero}` : ""}</Badge>}
                            {ef.primeiro_mes && <Badge variant="outline" className="text-[10px] h-4 border-success text-success px-1">1º Mês</Badge>}
                            {ef.data_devolucao && <Badge variant="outline" className="text-[10px] h-4 border-warning text-warning px-1">Devolução</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span>R$ {ef.valor_hora.toFixed(2)}/h</span>
                            <span>{ef.horas_contratadas}h contrat.</span>
                            {ef.hora_minima > 0 && <span>Mín: {ef.hora_minima}h</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {equipForms.length === 0 && !loadingMedicoes && formMedicaoInicio && formMedicaoFim && (
                  <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">Nenhum equipamento ativo no período selecionado.</p>
                )}
              </div>
            )}




            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Período</Label><Input value={formPeriodo} onChange={(e) => setFormPeriodo(e.target.value)} placeholder="Mês/Ano" /></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Medição Início</Label><Input type="date" value={formMedicaoInicio} onChange={(e) => { setFormMedicaoInicio(e.target.value); if (e.target.value) setFormPeriodo(derivePeriodo(e.target.value)); }} /></div>
              <div><Label>Medição Fim</Label><Input type="date" value={formMedicaoFim} onChange={(e) => setFormMedicaoFim(e.target.value)} /></div>
            </div>

            {/* Per-equipment details */}
            {equipForms.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-accent" />
                  Horas por Equipamento
                </div>
                {equipForms.map((ef, idx) => {
                  const equipGastos = gastosEquip.filter(g => g.equipamento_id === ef.equipamento_id && g.tipo !== "Mobilização" && g.tipo !== "Desmobilização");
                  const equipGastosCobrar = equipGastos.filter(g => selectedGastos.has(g.id) && (g.classificacao || "A Cobrar do Cliente") !== "A Reembolsar ao Cliente").reduce((acc, g) => acc + Number(g.valor), 0);
                  const equipGastosReembolsar = equipGastos.filter(g => selectedGastos.has(g.id) && g.classificacao === "A Reembolsar ao Cliente").reduce((acc, g) => acc + Number(g.valor), 0);
                  const equipGastosLiquido = equipGastosCobrar - equipGastosReembolsar;
                  const valorEquip = ef.horas_normais * ef.valor_hora + ef.horas_excedentes * ef.valor_hora_excedente;

                  return (
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
                      <span className="font-semibold text-foreground">R$ {valorEquip.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                              ? (ef.cobranca_parcial === "proporcional_minimo"
                                  ? `Base proporcional: ${ef.hora_minima > 0 ? ef.hora_minima : ef.horas_contratadas}h${ef.ajuste ? " (ajuste)" : ef.aditivo ? " (aditivo)" : ""}`
                                  : `Proporcional: ${ef.horas_contratadas}h / Mín: ${ef.hora_minima}h`)
                              : `Integral: ${ef.horas_contratadas_original}h / Mín: ${ef.hora_minima_original}h`}
                          </span>
                        </div>
                      </div>
                    )}
                    {(ef.primeiro_mes || ef.proporcional_devolucao) && (
                      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                        <Label className="text-xs whitespace-nowrap">Cobrança parcial:</Label>
                        <Select value={ef.cobranca_parcial} onValueChange={(v) => changeCobrancaParcial(idx, v as "horas_trabalhadas" | "proporcional_minimo")}>
                          <SelectTrigger className="h-7 text-xs w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="horas_trabalhadas">Horas Trabalhadas</SelectItem>
                            <SelectItem value="proporcional_minimo">Proporcional Mínimo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {ef.cobranca_parcial === "proporcional_minimo" && (ef.primeiro_mes || ef.proporcional_devolucao) && (
                      <div className="text-xs text-muted-foreground bg-muted/40 rounded p-1.5">
                        Base usada no cálculo: <span className="font-medium text-foreground">{ef.hora_minima > 0 ? ef.hora_minima : ef.horas_contratadas}h</span>{ef.ajuste ? " do ajuste vigente" : ef.aditivo ? " do aditivo vigente" : " do contrato"}.
                      </div>
                    )}
                    {ef.hora_minima > 0 && !ef.primeiro_mes && !ef.proporcional_devolucao && ef.horas_medidas < ef.hora_minima && (
                      <div className="text-xs text-accent font-medium bg-accent/10 rounded p-1.5">
                        ⚡ Hora mínima: {ef.horas_medidas.toFixed(1)}h → cobrando {ef.hora_minima}h
                      </div>
                    )}
                    {/* Observações sobre ajustes aplicados */}
                    {(() => {
                      const obs: string[] = [];
                      if (ef.ajuste) {
                        const aj = ef.ajuste;
                        const descontoPerc = Number(aj.desconto_percentual || 0);
                        if (descontoPerc > 0) {
                          obs.push(`📉 Desconto de ${descontoPerc}% aplicado sobre V/h e V/h excedente`);
                        }
                        if (aj.motivo) {
                          obs.push(`📝 Motivo: ${aj.motivo.replace("[LOTE] ", "")}`);
                        }
                        obs.push(`📅 Vigência do ajuste: ${parseLocalDate(aj.data_inicio).toLocaleDateString("pt-BR")} a ${parseLocalDate(aj.data_fim).toLocaleDateString("pt-BR")}`);
                      }
                      if (ef.aditivo) {
                        obs.push(`📄 Valores do Aditivo #${ef.aditivo_numero || "?"} aplicados`);
                      }
                      if (ef.primeiro_mes) {
                        obs.push(`🆕 Primeiro mês — horas contratadas e mínima proporcionais à entrega`);
                      }
                      if (ef.proporcional_devolucao) {
                        obs.push(`🔄 Proporcional à devolução — horas contratadas e mínima reduzidas`);
                      }
                      if (obs.length === 0) return null;
                      return (
                        <div className="mt-1 p-2 rounded border border-muted bg-muted/30 space-y-0.5">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Observações</p>
                          {obs.map((o, i) => (
                            <p key={i} className="text-xs text-muted-foreground">{o}</p>
                          ))}
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-xs text-muted-foreground">
                      <span>📦 Entrega: {ef.data_entrega ? parseLocalDate(ef.data_entrega).toLocaleDateString("pt-BR") : "Não informada"}</span>
                      {ef.data_devolucao && <span>🔙 Devolução: {parseLocalDate(ef.data_devolucao).toLocaleDateString("pt-BR")}</span>}
                    </div>

                    {/* Custos deste equipamento (exceto Mobilização/Desmobilização) */}
                    {equipGastos.length > 0 && (
                      <div className="pt-2 border-t border-accent/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-accent flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" /> Custos deste Equipamento
                          </p>
                          <Button variant="ghost" size="sm" className="text-[10px] h-5 px-1.5" onClick={() => {
                            const allIds = equipGastos.map(g => g.id);
                            const allSelected = allIds.every(id => selectedGastos.has(id));
                            setSelectedGastos(prev => {
                              const n = new Set(prev);
                              allIds.forEach(id => allSelected ? n.delete(id) : n.add(id));
                              return n;
                            });
                          }}>
                            {equipGastos.every(g => selectedGastos.has(g.id)) ? "Desmarcar" : "Selecionar todos"}
                          </Button>
                        </div>
                        {equipGastos.map(g => (
                          <div key={g.id} className="flex items-center gap-2 text-xs">
                            <Checkbox checked={selectedGastos.has(g.id)} onCheckedChange={() => toggleGasto(g.id)} className="shrink-0" />
                            <span className={`flex-1 ${selectedGastos.has(g.id) ? "text-foreground" : "text-muted-foreground"}`}>
                              {parseLocalDate(g.data).toLocaleDateString("pt-BR")} — {g.descricao}
                              <Badge variant="outline" className="text-[10px] ml-1">{g.tipo}</Badge>
                              <Badge className={`text-[10px] ml-1 ${g.classificacao === "A Reembolsar ao Cliente" ? "bg-destructive/10 text-destructive border-0" : "bg-success/10 text-success border-0"}`}>
                                {g.classificacao === "A Reembolsar ao Cliente" ? "Reembolsar" : "Cobrar"}
                              </Badge>
                            </span>
                            <span className={`font-semibold shrink-0 ${g.classificacao === "A Reembolsar ao Cliente" ? "text-destructive" : selectedGastos.has(g.id) ? "text-accent" : "text-muted-foreground"}`}>
                              {g.classificacao === "A Reembolsar ao Cliente" ? "−" : "+"} R$ {Number(g.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                        {equipGastos.some(g => selectedGastos.has(g.id)) && (
                          <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t border-accent/20">
                            <span>Subtotal Custos</span>
                            <span className={equipGastosLiquido >= 0 ? "text-accent" : "text-destructive"}>
                              {equipGastosLiquido >= 0 ? "+" : "−"} R$ {Math.abs(equipGastosLiquido).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-border/40">
                          <span>Total Equipamento (Medição {equipGastosLiquido !== 0 ? (equipGastosLiquido > 0 ? "+ Custos" : "- Reembolso") : ""})</span>
                          <span className="text-foreground">R$ {(valorEquip + equipGastosLiquido).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
                {loadingMedicoes && <p className="text-xs text-muted-foreground">Calculando...</p>}
              </div>
            )}

            {equipForms.length === 0 && formContratoId && formMedicaoInicio && formMedicaoFim && !loadingMedicoes && (
              <div className="p-3 rounded-lg bg-muted/30 text-center text-sm text-muted-foreground">
                Nenhuma medição encontrada para os equipamentos no período selecionado.
              </div>
            )}

            {/* Mobilização/Desmobilização Custos (global section) */}
            {(() => {
              const mobGastos = gastosEquip.filter(g => g.tipo === "Mobilização" || g.tipo === "Desmobilização");
              if (mobGastos.length === 0) return null;
              return (
                <div className="p-4 rounded-lg border border-warning/30 bg-warning/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-warning">
                      <Truck className="h-4 w-4" />
                      Mobilização / Desmobilização
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                      const mobIds = mobGastos.map(g => g.id);
                      const allSelected = mobIds.every(id => selectedGastos.has(id));
                      setSelectedGastos(prev => {
                        const n = new Set(prev);
                        mobIds.forEach(id => allSelected ? n.delete(id) : n.add(id));
                        return n;
                      });
                    }}>
                      {mobGastos.every(g => selectedGastos.has(g.id)) ? "Desmarcar todos" : "Selecionar todos"}
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {mobGastos.map(g => {
                      const eq = equipForms.find(ef => ef.equipamento_id === g.equipamento_id);
                      return (
                        <div key={g.id} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={selectedGastos.has(g.id)} onCheckedChange={() => toggleGasto(g.id)} className="shrink-0" />
                          <span className={`flex-1 ${selectedGastos.has(g.id) ? "text-foreground" : "text-muted-foreground"}`}>
                            {parseLocalDate(g.data).toLocaleDateString("pt-BR")} — {eq ? `${eq.tipo} ${eq.modelo}` : ""} — {g.descricao}
                            <Badge variant="outline" className="text-xs ml-1">{g.tipo}</Badge>
                          </span>
                          <span className={`font-semibold shrink-0 ${selectedGastos.has(g.id) ? "text-accent" : "text-muted-foreground"}`}>
                            + R$ {Number(g.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div>
              <Label>Faturar Para (empresa diferente do contrato)</Label>
              <SearchableSelect
                value={formEmpresaFaturamentoId}
                onValueChange={setFormEmpresaFaturamentoId}
                placeholder="Mesma empresa do contrato"
                searchPlaceholder="Pesquisar empresa..."
                options={[
                  { value: "", label: "Mesma empresa do contrato" },
                  ...empresasList.map(e => ({ value: e.id, label: `${e.nome} — ${e.cnpj}` })),
                ]}
              />
              {formEmpresaFaturamentoId && (
                <p className="text-xs text-warning mt-1">⚠ A fatura será emitida para uma empresa diferente da empresa do contrato.</p>
              )}
            </div>

            {/* Totals */}
            {equipForms.length > 0 && (
              <div className="p-4 rounded-lg bg-accent/10 space-y-2">
                {equipForms.map(ef => (
                  <div key={ef.equipamento_id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{ef.tipo} {ef.modelo}</span>
                    <span>R$ {(ef.horas_normais * ef.valor_hora + ef.horas_excedentes * ef.valor_hora_excedente).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm pt-1 border-t border-accent/20">
                  <span className="text-muted-foreground">Valor Bruto ({totalHorasNormais.toFixed(1)}h + {totalHorasExcedentes.toFixed(1)}h exc.)</span>
                  <span className="font-semibold">R$ {valorBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {totalGastos > 0 && (
                  <div className="flex items-center justify-between text-sm text-accent">
                    <span>Custos Adicionais</span>
                    <span className="font-semibold">+ R$ {totalGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-accent/20">
                  <span className="text-sm font-medium">Valor Total a Cobrar</span>
                  <span className="text-2xl font-bold text-accent">R$ {valorLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">{editing ? "Salvar" : "Emitir Medição"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContasBancariasDialog
        open={contasDialogOpen}
        onOpenChange={setContasDialogOpen}
        contas={contasBancarias}
        onRefresh={fetchData}
      />

      {/* Mobilização/Desmobilização Alert Dialog */}
      <Dialog open={mobDialogOpen} onOpenChange={setMobDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-warning" />
              Mobilização / Desmobilização Detectada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Os seguintes equipamentos foram mobilizados ou desmobilizados dentro do período de medição. Informe o valor para incluir como custo adicional.
            </p>
            {mobAlerts.map((e) => {
              const key = `${e.equipamento_id}_${e.evento}`;
              return (
                <div key={key} className="p-3 rounded-lg border space-y-2 bg-warning/5 border-warning/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{e.tipo} {e.modelo} {e.tag_placa ? `(${e.tag_placa})` : ""}</span>
                    <Badge className={e.evento === "Mobilização" ? "bg-success/15 text-success border-0" : "bg-destructive/15 text-destructive border-0"}>
                      {e.evento}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Data: {parseLocalDate(e.data).toLocaleDateString("pt-BR")}
                  </p>
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={mobValues[key] || ""}
                      onChange={(ev) => setMobValues(prev => ({ ...prev, [key]: Number(ev.target.value) }))}
                      className="h-8"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setMobDialogOpen(false)}>Ignorar</Button>
            <Button variant="secondary" onClick={handleNaoCobrarMob} disabled={creatingMob}>
              Não Cobrar
            </Button>
            <Button onClick={handleCreateMobGastos} disabled={creatingMob} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {creatingMob ? "Criando..." : "Incluir Custos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog - ask for invoice number */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              Aprovar Medição
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Ao aprovar, a fatura será emitida automaticamente na aba Faturamento. Informe o número da fatura e, se desejar, uma observação:</p>
          <div className="space-y-4">
            <div>
              <Label>Nº Fatura</Label>
              <Input value={approvalNumeroNota} onChange={(e) => setApprovalNumeroNota(e.target.value)} placeholder="Ex: FAT001" />
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={approvalObservacoes} onChange={(e) => setApprovalObservacoes(e.target.value)} placeholder="Observações sobre a fatura (opcional)" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => approvalItemId && handleAprovar(approvalItemId, approvalNumeroNota, approvalObservacoes)} className="bg-success text-success-foreground hover:bg-success/90">
              Aprovar e Emitir Fatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
};

const Faturamento = () => (
  <Layout title="Medição">
    <FaturamentoContent />
  </Layout>
);

export default Faturamento;
