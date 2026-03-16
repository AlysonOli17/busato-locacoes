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
import { Plus, Search, Receipt, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, TrendingDown, FileDown, FileSpreadsheet, Settings2, Hash, Landmark, ShieldCheck, Truck, Eye } from "lucide-react";
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

  const [aditivosPorContratoFat, setAditivosPorContratoFat] = useState<Record<string, any[]>>({});

  // Mobilização/Desmobilização alert
  interface MobEvent { equipamento_id: string; tipo: string; modelo: string; tag_placa: string | null; evento: "Mobilização" | "Desmobilização"; data: string; }
  const [mobAlerts, setMobAlerts] = useState<MobEvent[]>([]);
  const [mobDialogOpen, setMobDialogOpen] = useState(false);
  const [mobValues, setMobValues] = useState<Record<string, number>>({});
  const [creatingMob, setCreatingMob] = useState(false);

  const fetchData = async () => {
    const [fatRes, ctRes, contasRes] = await Promise.all([
      supabase.from("faturamento").select("*, contratos(id, empresa_id, valor_hora, horas_contratadas, equipamento_id, data_inicio, data_fim, observacoes, dia_medicao_inicio, dia_medicao_fim, prazo_faturamento, empresas(nome, cnpj, contato, telefone), equipamentos(tipo, modelo, tag_placa, numero_serie), contratos_equipamentos(equipamento_id, valor_hora, valor_hora_excedente, horas_contratadas, hora_minima, data_entrega, data_devolucao))").order("numero_sequencial", { ascending: false }),
      supabase.from("contratos").select("id, empresa_id, valor_hora, horas_contratadas, equipamento_id, data_inicio, data_fim, observacoes, dia_medicao_inicio, dia_medicao_fim, prazo_faturamento, empresas(nome, cnpj, contato, telefone), equipamentos(tipo, modelo, tag_placa, numero_serie), contratos_equipamentos(equipamento_id, valor_hora, valor_hora_excedente, horas_contratadas, hora_minima, data_entrega, data_devolucao)").eq("status", "Ativo").order("created_at", { ascending: false }),
      supabase.from("contas_bancarias").select("*").order("banco"),
    ]);
    if (fatRes.data) setItems(fatRes.data as unknown as Fatura[]);
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
      supabase.from("gastos").select("id, descricao, tipo, valor, data, equipamento_id").in("equipamento_id", allEquipIdsWithAditivos).gte("data", inicio).lte("data", fim).order("data", { ascending: false }),
      // FIXED: fetch adjustments for ALL equipment (base + addendum)
      supabase.from("contratos_equipamentos_ajustes").select("*").eq("contrato_id", contratoId).in("equipamento_id", allEquipIdsWithAditivos).lte("data_inicio", fim).gte("data_fim", inicio),
    ]);

    const ajustesData = ajustesRes.data || [];

    // Fetch measurements per equipment, respecting data_entrega and data_devolucao
    // Also fetch the BASELINE reading (last horímetro before the cycle) for each equipment
    const medPromises = allEquipIdsWithAditivos.map(eqId => {
      const ce = ceList.find(c => c.equipamento_id === eqId);
      const ae = aditivoEquipMap.get(eqId);
      const dataEntrega = ae?.data_entrega || ce?.data_entrega || null;
      const dataDevolucao = ae?.data_devolucao || ce?.data_devolucao;
      const inicioEfetivo = dataEntrega && dataEntrega > inicio ? dataEntrega : inicio;
      const fimEfetivo = dataDevolucao && dataDevolucao < fim ? dataDevolucao : fim;
      return supabase.from("medicoes").select("equipamento_id, horas_trabalhadas, tipo, horimetro_inicial, horimetro_final, data").eq("equipamento_id", eqId).gte("data", inicioEfetivo).lte("data", fimEfetivo).order("data", { ascending: true });
    });
    // Fetch baseline (last reading before cycle start) for each equipment
    const baselinePromises = allEquipIdsWithAditivos.map(eqId => {
      const ce = ceList.find(c => c.equipamento_id === eqId);
      const ae = aditivoEquipMap.get(eqId);
      const dataEntrega = ae?.data_entrega || ce?.data_entrega || null;
      const inicioEfetivo = dataEntrega && dataEntrega > inicio ? dataEntrega : inicio;
      return supabase.from("medicoes").select("equipamento_id, horimetro_final").eq("equipamento_id", eqId).lt("data", inicioEfetivo).order("data", { ascending: false }).limit(1);
    });
    const [medResults, baselineResults] = await Promise.all([
      Promise.all(medPromises),
      Promise.all(baselinePromises),
    ]);
    const medicoesData = medResults.flatMap(r => r.data || []);
    const baselineMap = new Map<string, number>();
    baselineResults.forEach(r => {
      if (r.data && r.data.length > 0) {
        baselineMap.set(r.data[0].equipamento_id, Number(r.data[0].horimetro_final));
      }
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

      // Calculate hours: deduplicate by day (keep highest horimetro), then max - min, minus Indisponível
      const filteredMedicoes = medicoesData.filter(m => m.equipamento_id === eqId);
      let horasMedidas = 0;
      if (filteredMedicoes.length > 0) {
        const trabalho = filteredMedicoes.filter(m => (m.tipo || 'Trabalho') === 'Trabalho');
        // Keep only highest horimetro_final per day
        const byDay = new Map<string, number>();
        for (const m of trabalho) {
          const d = String(m.data);
          const v = Number(m.horimetro_final);
          if (!byDay.has(d) || v > byDay.get(d)!) byDay.set(d, v);
        }
        const dayValues = Array.from(byDay.values());
        horasMedidas = dayValues.length >= 2
          ? Math.max(0, Math.max(...dayValues) - Math.min(...dayValues))
          : 0;
      }

      // Priority: ajuste ALWAYS overrides > aditivo > contrato_equipamento > contrato
      // Ajustes now save original values for unchecked fields, so we can use them directly
      const baseValorHora = aditivo ? Number(aditivo.valor_hora) : ce ? Number(ce.valor_hora) : Number(ct.valor_hora);
      const baseValorExcedente = aditivo ? Number(aditivo.valor_hora_excedente) : ce ? Number(ce.valor_hora_excedente) : baseValorHora * 1.25;
      const baseHorasContratadas = aditivo ? Number(aditivo.horas_contratadas) : ce ? Number(ce.horas_contratadas) : Number(ct.horas_contratadas);
      const baseHoraMinima = aditivo ? Number(aditivo.hora_minima) : ce ? Number(ce.hora_minima) : 0;

      const valorHora = ajuste ? Number(ajuste.valor_hora) : baseValorHora;
      const valorExcedente = ajuste ? Number(ajuste.valor_hora_excedente) : baseValorExcedente;
      let horasContratadas = ajuste ? Number(ajuste.horas_contratadas) : baseHorasContratadas;
      let horaMinima = ajuste ? Number(ajuste.hora_minima) : baseHoraMinima;
      const horasContratadasOriginal = horasContratadas;
      const horasMinimaOriginal = horaMinima;

      // Proportional for delivery date within period (primeiro mês)
      const temEntregaNoPeriodo = dataEntrega && dataEntrega > inicio && dataEntrega <= fim;
      if (temEntregaNoPeriodo) {
        const inicioDate = parseLocalDate(inicio);
        const fimDate = parseLocalDate(fim);
        const entregaDate = parseLocalDate(dataEntrega);
        const diasTotais = Math.max(1, Math.round((fimDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24)));
        const diasUsados = Math.max(1, Math.round((fimDate.getTime() - entregaDate.getTime()) / (1000 * 60 * 60 * 24)));
        const fatorEntrega = diasUsados / diasTotais;
        horasContratadas = Number((horasContratadas * fatorEntrega).toFixed(1));
        horaMinima = Number((horaMinima * fatorEntrega).toFixed(1));
      }

      const temDevolucaoNoPeriodo = dataDevolucao && dataDevolucao >= inicio && dataDevolucao < fim;
      if (temDevolucaoNoPeriodo) {
        const baseHoras = temEntregaNoPeriodo ? horasContratadasOriginal : horasContratadas;
        const baseMinima = temEntregaNoPeriodo ? horasMinimaOriginal : horaMinima;
        const refInicio = temEntregaNoPeriodo && dataEntrega ? dataEntrega : inicio;
        const inicioDate = parseLocalDate(refInicio);
        const fimDate = parseLocalDate(fim);
        const devolucaoDate = parseLocalDate(dataDevolucao);
        const diasTotais = Math.max(1, Math.round((fimDate.getTime() - parseLocalDate(inicio).getTime()) / (1000 * 60 * 60 * 24)));
        const diasUsados = Math.max(1, Math.round((devolucaoDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const fatorProporcional = diasUsados / diasTotais;
        horasContratadas = Number((baseHoras * fatorProporcional).toFixed(1));
        horaMinima = Number((baseMinima * fatorProporcional).toFixed(1));
      }

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
    }));
    const { data, error } = await supabase.from("gastos").insert(rows).select("id, descricao, tipo, valor, data, equipamento_id");
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
    }));
    const { data, error } = await supabase.from("gastos").insert(rows).select("id, descricao, tipo, valor, data, equipamento_id");
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
    if (item.status === "Pago" || item.status === "Cancelado" || item.status === "Aprovado") return item.status;
    const ct = contratos.find(c => c.id === item.contrato_id);
    const prazo = ct?.prazo_faturamento || 30;
    const emissaoDate = new Date(item.emissao);
    const vencimento = new Date(emissaoDate);
    vencimento.setDate(vencimento.getDate() + prazo);
    if (new Date() > vencimento) return "Em Atraso";
    return item.status;
  };

  const handleAprovar = async (id: string) => {
    const { error } = await supabase.from("faturamento").update({ status: "Aprovado" }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Medição aprovada", description: "A fatura foi emitida automaticamente na aba Faturamento." });
    fetchData();
  };

  const getVencimento = (item: Fatura) => {
    const ct = contratos.find(c => c.id === item.contrato_id);
    const prazo = ct?.prazo_faturamento || 30;
    const emissaoDate = new Date(item.emissao);
    const vencimento = new Date(emissaoDate);
    vencimento.setDate(vencimento.getDate() + prazo);
    return vencimento;
  };

  const filtered = items.filter((i) => {
    // Text search
    const matchesSearch = !search ||
      i.contratos?.empresas?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      i.periodo.includes(search) ||
      (i.numero_nota || "").includes(search) ||
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
      const gastosVal = Number(item.total_gastos || 0);
      const inicio = item.periodo_medicao_inicio || "";
      const fim = item.periodo_medicao_fim || "";
      const numDoc = item.numero_nota || `MED-${String(item.numero_sequencial).padStart(4, "0")}`;

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
      const docLabel = item.numero_nota || String(item.numero_sequencial).padStart(3, "0");
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
        { label: "Empresa Contratante:", value: emp?.nome || "—" },
        { label: "CNPJ Contratante:", value: emp?.cnpj || "—" },
        { label: "Objeto de contrato:", value: equipTypes },
      ];

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
      // Fetch adjustments & measurements
      const { data: pdfAjustes } = allPdfEquipIds.length > 0 && inicio && fim
        ? await supabase.from("contratos_equipamentos_ajustes").select("*")
            .eq("contrato_id", item.contrato_id).in("equipamento_id", allPdfEquipIds)
            .lte("data_inicio", fim).gte("data_fim", inicio)
        : { data: [] };

      const medPromises = allPdfEquipIds.map(eqId => {
        const ce = ceList.find(c => c.equipamento_id === eqId);
        const ae = pdfAditivoEquipMap.get(eqId);
        const entrega = ae?.data_entrega || ce?.data_entrega || null;
        const devolucao = ae?.data_devolucao || ce?.data_devolucao || null;
        const iEf = entrega && entrega > inicio ? entrega : inicio;
        const fEf = devolucao && devolucao < fim ? devolucao : fim;
        return supabase.from("medicoes").select("equipamento_id, horimetro_final, data, tipo").eq("equipamento_id", eqId).gte("data", iEf).lte("data", fEf);
      });
      const medResults = await Promise.all(medPromises);
      const allMedicoes = medResults.flatMap(r => r.data || []);

      // Calculate total
      let totalMedicao = 0;

      const eqRows = allPdfEquipIds.map(eqId => {
        const eq = eqMap.get(eqId);
        const ce = ceList.find(c => c.equipamento_id === eqId);
        const ae = pdfAditivoEquipMap.get(eqId);

        const eqMeds = allMedicoes.filter(m => m.equipamento_id === eqId && (m.tipo || 'Trabalho') === 'Trabalho');
        const byDay = new Map<string, number>();
        for (const m of eqMeds) {
          const d = String(m.data);
          const v = Number(m.horimetro_final);
          if (!byDay.has(d) || v > byDay.get(d)!) byDay.set(d, v);
        }
        const dayValues = Array.from(byDay.values());
        const horasMedidas = dayValues.length >= 2 ? Math.max(0, Math.max(...dayValues) - Math.min(...dayValues)) : 0;

        const ajuste = (pdfAjustes || []).filter(a => a.equipamento_id === eqId).sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0] || null;
        const baseVh = ae ? Number(ae.valor_hora) : ce ? Number(ce.valor_hora) : Number(ct.valor_hora);
        const baseVhe = ae ? Number(ae.valor_hora_excedente) : ce ? Number(ce.valor_hora_excedente) : baseVh * 1.25;
        const baseHc = ae ? Number(ae.horas_contratadas) : ce ? Number(ce.horas_contratadas) : Number(ct.horas_contratadas);
        const baseHm = ae ? Number(ae.hora_minima) : ce ? Number(ce.hora_minima) : 0;

        const vh = ajuste ? Number(ajuste.valor_hora) : baseVh;
        const vhe = ajuste ? Number(ajuste.valor_hora_excedente) : baseVhe;
        let hc = ajuste ? Number(ajuste.horas_contratadas) : baseHc;
        let hm = ajuste ? Number(ajuste.hora_minima) : baseHm;

        // Proportional for delivery/return
        const entrega = ae?.data_entrega || ce?.data_entrega || null;
        const devolucao = ae?.data_devolucao || ce?.data_devolucao || null;
        if (entrega && entrega > inicio && entrega <= fim) {
          const diasTotais = Math.max(1, Math.round((parseLocalDate(fim).getTime() - parseLocalDate(inicio).getTime()) / 86400000));
          const diasUsados = Math.max(1, Math.round((parseLocalDate(fim).getTime() - parseLocalDate(entrega).getTime()) / 86400000));
          hc = Number((hc * diasUsados / diasTotais).toFixed(1));
          hm = Number((hm * diasUsados / diasTotais).toFixed(1));
        }
        if (devolucao && devolucao >= inicio && devolucao < fim) {
          const diasTotais = Math.max(1, Math.round((parseLocalDate(fim).getTime() - parseLocalDate(inicio).getTime()) / 86400000));
          const refI = entrega && entrega > inicio ? entrega : inicio;
          const diasUsados = Math.max(1, Math.round((parseLocalDate(devolucao).getTime() - parseLocalDate(refI).getTime()) / 86400000) + 1);
          hc = Number((baseHc * diasUsados / diasTotais).toFixed(1));
          hm = Number((baseHm * diasUsados / diasTotais).toFixed(1));
        }

        const horasEfetivas = hm > 0 && horasMedidas < hm ? hm : horasMedidas;
        const hn = Number(Math.min(horasEfetivas, hc).toFixed(1));
        const he = Number(Math.max(0, horasEfetivas - hc).toFixed(1));
        const valorTotal = hn * vh + he * vhe;
        totalMedicao += valorTotal;

        const itemDesc = `${(eq?.tipo || "").toUpperCase()} ${(eq?.modelo || "").toUpperCase()}`;
        const tagPlaca = eq?.tag_placa || "—";

        return [
          itemDesc,
          tagPlaca,
          fmtBRL(vh),
          fmtBRL(vhe),
          `${fmt(hc)}h`,
          `${fmt(hm)}h`,
          `${fmt(horasMedidas)}h`,
          fmtBRL(valorTotal),
        ];
      });

      // Table with all contract info columns — auto-expand to fill page
      const tableMargin = { left: mL, right: mR };
      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        head: [["Equipamento", "Tag", "V/h", "V/h Exc", "Horas", "Mínima", "Qtd (Horas)", "Valor Total R$"]],
        body: eqRows,
        styles: { fontSize: 8, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", halign: "center" },
        alternateRowStyles: { fillColor: [240, 246, 252] },
        columnStyles: {
          1: { halign: "center" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "center" },
          5: { halign: "center" },
          6: { halign: "center" },
          7: { halign: "right" },
        },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY;

      // Total row
      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        body: [["", "", "", "", "", "", "Medição Total:", fmtBRL(totalMedicao)]],
        styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2, fontStyle: "bold" },
        columnStyles: {
          6: { halign: "right" },
          7: { halign: "right" },
        },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // ──────────────── CUSTOS ADICIONAIS ────────────────
      if (gastosVal > 0) {
        const { data: fgData } = await supabase.from("faturamento_gastos").select("gasto_id").eq("faturamento_id", item.id);
        if (fgData && fgData.length > 0) {
          const gastoIds = fgData.map((fg: any) => fg.gasto_id);
          const { data: gastosData } = await supabase.from("gastos").select("descricao, tipo, valor, data, equipamento_id").in("id", gastoIds);
          if (gastosData && gastosData.length > 0) {
            if (y > 230) { doc.addPage(); y = 15; }
            doc.setFillColor(235, 235, 235);
            doc.rect(mL, y - 3, contentW, 5, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            doc.text("Custos Adicionais", mL + 1, y);
            y += 4;

            const gastoRows = gastosData.map((g: any) => [
              g.tipo,
              g.descricao,
              parseLocalDate(g.data).toLocaleDateString("pt-BR"),
              fmtBRL(Number(g.valor)),
            ]);
            autoTable(doc, {
              startY: y,
              margin: tableMargin,
              head: [["Tipo", "Descrição", "Data", "Valor"]],
              body: gastoRows,
              styles: { fontSize: 8, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
              headStyles: { fillColor: [41, 128, 185], textColor: 255 },
              alternateRowStyles: { fillColor: [240, 246, 252] },
              columnStyles: {
                2: { halign: "center" },
                3: { halign: "right" },
              },
              theme: "grid",
            });
            y = (doc as any).lastAutoTable.finalY + 4;

            // Gastos total
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.text(`Total Custos Adicionais: ${fmtBRL(gastosVal)}`, pageW - mR, y, { align: "right" });
            y += 8;
          }
        }
      }

      // ──────────────── OBSERVAÇÕES ────────────────
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFillColor(235, 235, 235);
      doc.rect(mL, y - 3, contentW, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text("Observações:", mL + 1, y);
      y += 6;
      if (ct?.observacoes) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const obsLines = doc.splitTextToSize(ct.observacoes, contentW - 4);
        doc.text(obsLines, mL + 2, y);
        y += obsLines.length * 4 + 2;
      }
      y += 4;

      // ──────────────── GRAND TOTAL ────────────────
      const grandTotal = totalMedicao + gastosVal;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(mL, y, pageW - mR, y);
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text("Valor Total da Medição:", mL, y);
      doc.text(fmtBRL(grandTotal), pageW - mR, y, { align: "right" });
      y += 10;

      // ──────────────── APPROVAL / SIGNATURE BLOCK ────────────────
      const sigY = Math.max(y + 10, pageH - 50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text("Aprovação:", mL, sigY);

      const sigLineY = sigY + 16;
      const halfW = (contentW - 20) / 2;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);

      // Left signature
      doc.line(mL, sigLineY, mL + halfW, sigLineY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(busatoNome, mL + halfW / 2, sigLineY + 4, { align: "center" });

      // Right signature
      const rightX = mL + halfW + 20;
      doc.line(rightX, sigLineY, rightX + halfW, sigLineY);
      doc.text(emp?.nome || "CONTRATANTE", rightX + halfW / 2, sigLineY + 4, { align: "center" });

      // ──────────────── FOOTER ────────────────
      doc.setFontSize(6);
      doc.setTextColor(130, 130, 130);
      doc.text(`Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, pageW / 2, pageH - 8, { align: "center" });
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
    // Auto-generate next numero_nota
    const maxSeq = items.length > 0 ? Math.max(...items.map(f => f.numero_sequencial)) : 0;
    setFormNumeroNota(`FAT${String(maxSeq + 1).padStart(3, "0")}`);
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
    setFormNumeroNota(item.numero_nota || `FAT${String(item.numero_sequencial).padStart(3, "0")}`);
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
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Medição</h1>
            <p className="text-sm text-muted-foreground">Total pendente: <span className="text-accent font-semibold">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>{selected.size > 0 && ` · ${selected.size} selecionada(s)`}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setContasDialogOpen(true)}><Landmark className="h-4 w-4 mr-1" /> Contas</Button>
            <Button variant="outline" size="sm" onClick={() => exportDetailedPDF()}><FileDown className="h-4 w-4 mr-1" /> PDF Detalhado</Button>
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
                          <Button variant="ghost" size="icon" title="Visualizar PDF" onClick={() => exportDetailedPDF(item)}><Eye className="h-4 w-4 text-primary" /></Button>
                          {getDisplayStatus(item) === "Pendente" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Aprovar e emitir fatura"><ShieldCheck className="h-4 w-4 text-success" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Aprovar Medição Nº {item.numero_sequencial}</AlertDialogTitle>
                                  <AlertDialogDescription>Ao aprovar, a fatura será emitida automaticamente na aba Faturamento. Deseja continuar?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleAprovar(item.id)} className="bg-success text-success-foreground hover:bg-success/90">Aprovar e Emitir Fatura</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Medição Nº {item.numero_sequencial}</AlertDialogTitle>
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              {editing ? `Editar Medição Nº ${editing.numero_sequencial}` : "Nova Medição"}
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
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p><strong>Empresa:</strong> {selectedContrato.empresas?.nome} ({selectedContrato.empresas?.cnpj})</p>
                <p><strong>Ciclo Medição:</strong> Dia {selectedContrato.dia_medicao_inicio || 1} ao Dia {selectedContrato.dia_medicao_fim || 30}</p>
                <p><strong>Prazo Faturamento:</strong> {selectedContrato.prazo_faturamento || 30} dias</p>
                <p><strong>Equipamentos no contrato:</strong> {selectedContrato.contratos_equipamentos?.length || 1}</p>
              </div>
            )}


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Nº Nota / Fatura</Label><Input value={formNumeroNota} onChange={(e) => setFormNumeroNota(e.target.value)} placeholder="Ex: FAT001" /></div>
            </div>
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
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-xs text-muted-foreground">
                      <span>📦 Entrega: {ef.data_entrega ? parseLocalDate(ef.data_entrega).toLocaleDateString("pt-BR") : "Não informada"}</span>
                      {ef.data_devolucao && <span>🔙 Devolução: {parseLocalDate(ef.data_devolucao).toLocaleDateString("pt-BR")}</span>}
                    </div>
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
        <DialogContent className="sm:max-w-lg">
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

    </>
  );
};

const Faturamento = () => (
  <Layout>
    <FaturamentoContent />
  </Layout>
);

export default Faturamento;
