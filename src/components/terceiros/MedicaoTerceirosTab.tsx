import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useToast } from "@/hooks/use-toast";
import { Plus, Receipt, Pencil, Trash2, AlertTriangle, Clock, TrendingDown, FileDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { calcularHorasInterpoladas, getEquipLabel } from "@/lib/utils";

interface Fornecedor { id: string; nome: string; cnpj: string; }
interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
interface ContratoEquip {
  equipamento_id: string; valor_hora: number; valor_hora_excedente: number;
  horas_contratadas: number; hora_minima: number;
  data_entrega: string | null; data_devolucao: string | null;
}
interface Contrato {
  id: string; fornecedor_id: string; data_inicio: string; data_fim: string;
  dia_medicao_inicio: number; dia_medicao_fim: number; tipo_medicao: string;
  prazo_pagamento: number; status: string; observacoes: string | null;
  fornecedores: Fornecedor;
  contratos_terceiros_equipamentos: ContratoEquip[];
}
interface CustoTerceiro {
  id: string; equipamento_id: string; descricao: string; tipo: string;
  valor: number; data: string; classificacao: string;
}
interface EquipFormItem {
  equipamento_id: string; tipo: string; modelo: string; tag_placa: string | null;
  horas_medidas: number; horas_normais: number; horas_excedentes: number;
  valor_hora: number; valor_hora_excedente: number; hora_minima: number;
  horas_contratadas: number; primeiro_mes: boolean;
  data_entrega: string | null; data_devolucao: string | null;
  cobranca_parcial: "horas_trabalhadas" | "proporcional_minimo";
}

// Saved measurement record
interface MedicaoSalva {
  id: string; contrato_id: string; periodo: string; periodo_inicio: string; periodo_fim: string;
  valor_total: number; status: string; created_at: string; detalhes: any;
  contratos_terceiros: { tipo_medicao?: string; fornecedores: Fornecedor };
}

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MedicaoTerceirosTab = () => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formContratoId, setFormContratoId] = useState("");
  const [formMedicaoInicio, setFormMedicaoInicio] = useState("");
  const [formMedicaoFim, setFormMedicaoFim] = useState("");
  const [equipForms, setEquipForms] = useState<EquipFormItem[]>([]);
  const [custos, setCustos] = useState<CustoTerceiro[]>([]);
  const [loadingMedicoes, setLoadingMedicoes] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Saved records
  const [savedItems, setSavedItems] = useState<MedicaoSalva[]>([]);
  const [filterFornecedor, setFilterFornecedor] = useState("all");

  const { toast } = useToast();

  const fetchData = async () => {
    const [ctRes, savedRes] = await Promise.all([
      supabase.from("contratos_terceiros")
        .select("*, fornecedores(id, nome, cnpj), contratos_terceiros_equipamentos(equipamento_id, valor_hora, valor_hora_excedente, horas_contratadas, hora_minima, data_entrega, data_devolucao)")
        .eq("status", "Ativo").order("created_at", { ascending: false }),
      (supabase.from as any)("medicoes_terceiros_faturamento")
        .select("*, contratos_terceiros(tipo_medicao, fornecedores(id, nome, cnpj))")
        .order("created_at", { ascending: false }),
    ]);
    if (ctRes.data) setContratos(ctRes.data as unknown as Contrato[]);
    if (savedRes.data) setSavedItems(savedRes.data as unknown as MedicaoSalva[]);
    // If error on savedRes (table may not exist yet), just set empty
    if (savedRes.error) setSavedItems([]);
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-fill period dates from contract (handles cycles wrapping months, e.g., 21 -> 20)
  // Picks the cycle containing today
  const onContratoChange = (contratoId: string) => {
    setFormContratoId(contratoId);
    const ct = contratos.find(c => c.id === contratoId);
    if (ct) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed
      const day = now.getDate();
      const wraps = ct.dia_medicao_fim < ct.dia_medicao_inicio;
      let inicioMonth = month;
      let fimMonth = month;
      if (wraps) {
        // Cycle: dia_inicio of M -> dia_fim of M+1
        // If today's day < dia_inicio, current cycle started in previous month
        if (day < ct.dia_medicao_inicio) {
          inicioMonth = month - 1;
        } else {
          fimMonth = month + 1;
        }
      }
      const lastDayFimMonth = new Date(year, fimMonth + 1, 0).getDate();
      const inicio = new Date(year, inicioMonth, ct.dia_medicao_inicio);
      const fim = new Date(year, fimMonth, Math.min(ct.dia_medicao_fim, lastDayFimMonth));
      setFormMedicaoInicio(inicio.toISOString().slice(0, 10));
      setFormMedicaoFim(fim.toISOString().slice(0, 10));
    }
    setEquipForms([]);
  };

  const fetchMedicoes = useCallback(async () => {
    const ct = contratos.find(c => c.id === formContratoId);
    if (!ct || !formMedicaoInicio || !formMedicaoFim) { setEquipForms([]); return; }
    setLoadingMedicoes(true);

    const inicio = formMedicaoInicio;
    const fim = formMedicaoFim;
    const ceList = ct.contratos_terceiros_equipamentos || [];

    // Step 1: Fetch aditivos and their equipment for this contract
    const { data: aditivosData } = await supabase.from("contratos_terceiros_aditivos")
      .select("*").eq("contrato_id", ct.id).lte("data_inicio", fim).order("numero", { ascending: true });

    const aditivoEquipMap = new Map<string, any>();
    let aditivoExtraEquipIds: string[] = [];
    if (aditivosData && aditivosData.length > 0) {
      const aditivoIds = aditivosData.map(a => a.id);
      const { data: aeData } = await supabase.from("contratos_terceiros_aditivos_equipamentos")
        .select("*").in("aditivo_id", aditivoIds);
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
          aeData.filter(ae => !ae.data_entrega || ae.data_entrega <= fim).map(ae => ae.equipamento_id)
        )].filter(id => {
          const baseIds = ceList.map(c => c.equipamento_id);
          if (baseIds.includes(id)) return false;
          const ae = aditivoEquipMap.get(id);
          if (ae?.data_devolucao && ae.data_devolucao <= inicio) return false;
          return true;
        });
      }
    }

    // Combine base + addendum equipment
    const baseEquipIds = ceList
      .filter(ce => !(ce.data_devolucao && ce.data_devolucao <= inicio))
      .filter(ce => !(ce.data_entrega && ce.data_entrega > fim))
      .map(ce => ce.equipamento_id);
    const allEquipIds = [...new Set([...baseEquipIds, ...aditivoExtraEquipIds])];

    if (allEquipIds.length === 0) { setEquipForms([]); setLoadingMedicoes(false); return; }

    // Step 2: Fetch equipment details, costs, and adjustments
    const [equipRes, custosRes, ajustesRes] = await Promise.all([
      supabase.from("equipamentos_terceiros").select("id, tipo, modelo, tag_placa, numero_serie").in("id", allEquipIds),
      supabase.from("custos_terceiros").select("id, descricao, tipo, valor, data, equipamento_id, classificacao")
        .in("equipamento_id", allEquipIds).gte("data", inicio).lte("data", fim),
      supabase.from("contratos_terceiros_equipamentos_ajustes").select("*")
        .eq("contrato_id", ct.id).in("equipamento_id", allEquipIds).lte("data_inicio", fim).gte("data_fim", inicio),
    ]);

    const equipMap = new Map((equipRes.data || []).map(e => [e.id, e]));
    setCustos((custosRes.data || []) as CustoTerceiro[]);
    const ajustesData = ajustesRes.data || [];

    // Fetch measurements per equipment
    const medPromises = allEquipIds.map(eqId => Promise.all([
      supabase.from("medicoes_terceiros").select("equipamento_id, horimetro_final, data")
        .eq("equipamento_id", eqId).eq("tipo", "Trabalho")
        .lt("data", inicio).order("data", { ascending: false }).limit(1),
      supabase.from("medicoes_terceiros").select("equipamento_id, horas_trabalhadas, tipo, horimetro_final, data")
        .eq("equipamento_id", eqId).gte("data", inicio).lte("data", fim),
    ]));
    const medResults = await Promise.all(medPromises);

    // Filter: exclude equipment returned before period
    const filteredEquipIds = allEquipIds.filter(eqId => {
      const ce = ceList.find(c => c.equipamento_id === eqId);
      const ae = aditivoEquipMap.get(eqId);
      const dataDevolucao = ae?.data_devolucao || ce?.data_devolucao || null;
      if (dataDevolucao && dataDevolucao <= inicio) return false;
      const dataEntrega = ae?.data_entrega || ce?.data_entrega || null;
      if (dataEntrega && dataEntrega > fim) return false;
      return true;
    });

    const newEquipForms: EquipFormItem[] = filteredEquipIds.map(eqId => {
      const ceIdx = allEquipIds.indexOf(eqId);
      const ce = ceList.find(c => c.equipamento_id === eqId);
      const eq = equipMap.get(eqId);
      const aditivo = aditivoEquipMap.get(eqId) || null;
      const [baselineRes, periodRes] = medResults[ceIdx];
      const dataEntrega = aditivo?.data_entrega || ce?.data_entrega || null;
      const dataDevolucao = aditivo?.data_devolucao || ce?.data_devolucao || null;

      // Find most specific ajuste for this equipment
      const ajustesEquip = ajustesData.filter(a => a.equipamento_id === eqId);
      const ajuste = ajustesEquip.length > 0
        ? ajustesEquip.sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0]
        : null;

      let horasMedidas = 0;
      if (ct.tipo_medicao === "diarias") {
        const diarias = (periodRes.data || []).filter((m: any) => m.tipo === "Trabalho" || m.tipo === "Diária");
        horasMedidas = new Set(diarias.map((m: any) => String(m.data))).size;
      } else {
        const allReadings: { data: string; horimetro_final: number }[] = [];
        if (baselineRes.data && baselineRes.data.length > 0) {
          allReadings.push({ data: baselineRes.data[0].data, horimetro_final: Number(baselineRes.data[0].horimetro_final) });
        }
        const trabalho = (periodRes.data || []).filter((m: any) => m.tipo === "Trabalho");
        for (const m of trabalho) {
          allReadings.push({ data: String(m.data), horimetro_final: Number(m.horimetro_final) });
        }
        const inicioEfetivo = dataEntrega && dataEntrega > inicio && dataEntrega <= fim ? dataEntrega : inicio;
        const fimEfetivo = dataDevolucao && dataDevolucao >= inicio && dataDevolucao < fim ? dataDevolucao : fim;
        const result = calcularHorasInterpoladas(allReadings, inicioEfetivo, fimEfetivo);
        horasMedidas = result.totalHoras;
      }

      // Priority: ajuste > aditivo > contrato_equipamento
      const baseValorHora = aditivo ? Number(aditivo.valor_hora) : ce ? Number(ce.valor_hora) : 0;
      const baseValorExcedente = aditivo ? Number(aditivo.valor_hora_excedente) : ce ? Number(ce.valor_hora_excedente) : 0;
      const baseHorasContratadas = aditivo ? Number(aditivo.horas_contratadas) : ce ? Number(ce.horas_contratadas) : 0;
      const baseHoraMinima = aditivo ? Number(aditivo.hora_minima) : ce ? Number(ce.hora_minima) : 0;

      const descontoPerc = ajuste ? Number((ajuste as any).desconto_percentual || 0) : 0;
      const fatorDesconto = descontoPerc > 0 ? (1 - descontoPerc / 100) : 1;
      const valorHora = (ajuste ? Number(ajuste.valor_hora) : baseValorHora) * fatorDesconto;
      const valorExcedente = (ajuste ? Number(ajuste.valor_hora_excedente) : baseValorExcedente) * fatorDesconto;
      const horasContratadas = ajuste ? Number(ajuste.horas_contratadas) : baseHorasContratadas;
      const horaMinima = ajuste ? Number(ajuste.hora_minima) : baseHoraMinima;

      // Check if proportional (delivery or return within the cycle)
      const temEntregaNoPeriodo = dataEntrega && dataEntrega > inicio && dataEntrega <= fim;
      const temDevolucaoNoPeriodo = dataDevolucao && dataDevolucao >= inicio && dataDevolucao < fim;
      const isProporcional = !!(temEntregaNoPeriodo || temDevolucaoNoPeriodo);

      let horasEfetivas: number;
      if (isProporcional) {
        horasEfetivas = horasMedidas;
      } else {
        horasEfetivas = horaMinima > 0 && horasMedidas < horaMinima ? horaMinima : horasMedidas;
      }

      // For "diarias" contracts: all measured days are billed at valor/diária (no excedente logic)
      const isDiarias = ct.tipo_medicao === "diarias";
      const horasNormais = isDiarias
        ? Number(horasMedidas.toFixed(1))
        : Number(Math.min(horasEfetivas, horasContratadas).toFixed(1));
      const horasExcedentes = isDiarias
        ? 0
        : Number(Math.max(0, horasEfetivas - horasContratadas).toFixed(1));

      return {
        equipamento_id: eqId,
        tipo: eq?.tipo || "", modelo: eq?.modelo || "", tag_placa: eq?.tag_placa || null,
        horas_medidas: horasMedidas, horas_normais: horasNormais, horas_excedentes: horasExcedentes,
        valor_hora: valorHora, valor_hora_excedente: valorExcedente,
        hora_minima: horaMinima, horas_contratadas: horasContratadas,
        primeiro_mes: isProporcional, data_entrega: dataEntrega, data_devolucao: dataDevolucao,
        cobranca_parcial: "horas_trabalhadas" as const,
      };
    });

    setEquipForms(newEquipForms);
    setLoadingMedicoes(false);
  }, [contratos, formContratoId, formMedicaoInicio, formMedicaoFim]);

  // Change cobrança parcial mode
  const changeCobrancaParcial = (idx: number, mode: "horas_trabalhadas" | "proporcional_minimo") => {
    setEquipForms(prev => {
      const updated = [...prev];
      const ef = { ...updated[idx] };
      ef.cobranca_parcial = mode;
      if (mode === "proporcional_minimo" && formMedicaoInicio && formMedicaoFim) {
        const inicioEf = ef.data_entrega && ef.data_entrega > formMedicaoInicio && ef.data_entrega <= formMedicaoFim ? ef.data_entrega : formMedicaoInicio;
        const devRaw = ef.data_devolucao && ef.data_devolucao >= formMedicaoInicio && ef.data_devolucao < formMedicaoFim ? ef.data_devolucao : null;
        const fimEf = devRaw ? (() => { const d = parseLocalDate(devRaw); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })() : formMedicaoFim;
        const diasProp = Math.max(1, Math.round((parseLocalDate(fimEf).getTime() - parseLocalDate(inicioEf).getTime()) / 86400000) + 1);
        const baseMinimo = ef.hora_minima > 0 ? ef.hora_minima : ef.horas_contratadas;
        const propMinimo = Number(((baseMinimo / 30) * diasProp).toFixed(1));
        const horasEfetivas = Math.max(propMinimo, ef.horas_medidas);
        ef.horas_normais = Number(Math.min(horasEfetivas, ef.horas_contratadas).toFixed(1));
        ef.horas_excedentes = Number(Math.max(0, horasEfetivas - ef.horas_contratadas).toFixed(1));
      } else {
        ef.horas_normais = Number(Math.min(ef.horas_medidas, ef.horas_contratadas).toFixed(1));
        ef.horas_excedentes = Number(Math.max(0, ef.horas_medidas - ef.horas_contratadas).toFixed(1));
      }
      updated[idx] = ef;
      return updated;
    });
  };

  // Total calculations
  const totalNormais = equipForms.reduce((s, ef) => s + ef.horas_normais * ef.valor_hora, 0);
  const totalExcedentes = equipForms.reduce((s, ef) => s + ef.horas_excedentes * ef.valor_hora_excedente, 0);
  const totalCustos = custos.reduce((s, c) => s + Number(c.valor), 0);
  const valorTotal = totalNormais + totalExcedentes - totalCustos;

  const openNew = () => {
    setEditing(null);
    setFormContratoId("");
    setFormMedicaoInicio("");
    setFormMedicaoFim("");
    setEquipForms([]);
    setCustos([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formContratoId || !formMedicaoInicio || !formMedicaoFim) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const ct = contratos.find(c => c.id === formContratoId);
    const periodo = `${new Date(formMedicaoInicio + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(formMedicaoFim + "T00:00:00").toLocaleDateString("pt-BR")}`;

    const payload = {
      contrato_id: formContratoId,
      periodo,
      periodo_inicio: formMedicaoInicio,
      periodo_fim: formMedicaoFim,
      valor_total: valorTotal,
      status: "Pendente",
      detalhes: equipForms.map(ef => ({
        equipamento_id: ef.equipamento_id,
        tipo: ef.tipo, modelo: ef.modelo, tag_placa: ef.tag_placa,
        horas_medidas: ef.horas_medidas, horas_normais: ef.horas_normais,
        horas_excedentes: ef.horas_excedentes, valor_hora: ef.valor_hora,
        valor_hora_excedente: ef.valor_hora_excedente,
      })),
    };

    if (editing) {
      const { error } = await (supabase.from as any)("medicoes_terceiros_faturamento").update(payload).eq("id", editing);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Medição atualizada" });
    } else {
      const { error } = await (supabase.from as any)("medicoes_terceiros_faturamento").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Medição registrada" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await (supabase.from as any)("medicoes_terceiros_faturamento").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Medição excluída" });
    fetchData();
  };

  const exportPDF = async (item: MedicaoSalva) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", format: "a4" });
    const fmtBRL = (v: number) => `R$ ${fmt(v)}`;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const mL = 14;
    const mR = 14;
    const contentW = pageW - mL - mR;

    const { data: busatoEmp } = await supabase.from("empresas").select("*").ilike("nome", "%busato%").limit(1).single();

    const fornecedor = item.contratos_terceiros?.fornecedores;
    const tipoMedicao = item.contratos_terceiros?.tipo_medicao || "horas";
    const isDiarias = tipoMedicao === "diarias";
    const inicio = item.periodo_inicio;
    const fim = item.periodo_fim;
    const inicioFmt = inicio ? parseLocalDate(inicio).toLocaleDateString("pt-BR") : "";
    const fimFmt = fim ? parseLocalDate(fim).toLocaleDateString("pt-BR") : "";

    // Fetch costs in period for this contract's equipment
    const detalhes: any[] = Array.isArray(item.detalhes) ? item.detalhes : [];
    const equipIds = detalhes.map(d => d.equipamento_id).filter(Boolean);
    let custosPeriodo: any[] = [];
    if (equipIds.length > 0 && inicio && fim) {
      const { data } = await supabase.from("custos_terceiros")
        .select("id, descricao, tipo, valor, data, equipamento_id, classificacao")
        .in("equipamento_id", equipIds).gte("data", inicio).lte("data", fim);
      custosPeriodo = data || [];
    }

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

    if (logo) doc.addImage(logo, "PNG", mL, y, 48, 12);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    const docLabel = inicioFmt && fimFmt ? `${inicioFmt} - ${fimFmt}` : "";
    doc.text(`MEDIÇÃO LOCAÇÃO TERCEIROS ${docLabel}`, pageW - mR, y + 8, { align: "right" });
    y += 18;

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(busatoNome.toUpperCase(), mL, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    if (busatoEndereco) { doc.text(busatoEndereco, mL, y); y += 3; }
    const cnpjLine = [busatoCnpj ? `CNPJ: ${busatoCnpj}` : "", busatoIE ? `Inscrição Estadual: ${busatoIE}` : ""].filter(Boolean).join(" - ");
    if (cnpjLine) doc.text(cnpjLine, mL, y);
    y += 5;

    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.line(mL, y, pageW - mR, y);
    y += 5;

    // Info block
    const equipTypes = [...new Set(detalhes.map((d: any) => d.tipo).filter(Boolean))].join(", ") || "—";
    const medInfoRows = [
      { label: "Período de Medição:", value: `${inicioFmt} a ${fimFmt}` },
      { label: "Fornecedor:", value: fornecedor?.nome || "—" },
      { label: "CNPJ Fornecedor:", value: fornecedor?.cnpj || "—" },
      { label: "Tipo de Medição:", value: isDiarias ? "Por Diárias" : "Por Horas" },
      { label: "Equipamentos:", value: equipTypes },
    ];

    for (const info of medInfoRows) {
      doc.setFillColor(235, 235, 235);
      doc.rect(mL, y - 3, 48, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(info.label, mL + 1, y);
      doc.setFont("helvetica", "normal");
      doc.text(info.value, mL + 50, y);
      y += 5.5;
    }
    y += 4;

    const tableMargin = { left: mL, right: mR };
    let totalMedicao = 0;

    for (const det of detalhes) {
      if (y > pageH - 80) { doc.addPage(); y = 15; }

      const itemDesc = `${(det.tipo || "").toUpperCase()} ${(det.modelo || "").toUpperCase()}`;
      const tagPlaca = det.tag_placa || "—";
      const hn = Number(det.horas_normais || 0);
      const he = Number(det.horas_excedentes || 0);
      const vh = Number(det.valor_hora || 0);
      const vhe = Number(det.valor_hora_excedente || 0);
      const valorEq = hn * vh + he * vhe;
      totalMedicao += valorEq;

      doc.setFillColor(41, 128, 185);
      doc.rect(mL, y - 3, contentW, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(`${itemDesc}  |  Tag: ${tagPlaca}`, mL + 2, y + 1);
      doc.setTextColor(0, 0, 0);
      y += 7;

      const unidade = isDiarias ? "diárias" : "horas";
      const labelMedidas = isDiarias ? "Diárias Medidas" : "Horas Medidas";
      const labelNormais = isDiarias ? "Diárias Normais" : "Horas Normais";
      const labelExcedentes = isDiarias ? "Diárias Excedentes" : "Horas Excedentes";
      const labelValor = isDiarias ? "Valor/Diária" : "Valor/Hora";

      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        head: [[labelValor, "Val. Excedente", labelMedidas, labelNormais, labelExcedentes, "Valor Medição"]],
        body: [[
          fmtBRL(vh),
          fmtBRL(vhe),
          `${fmt(Number(det.horas_medidas || 0))} ${unidade}`,
          `${fmt(hn)} ${unidade}`,
          `${fmt(he)} ${unidade}`,
          fmtBRL(valorEq),
        ]],
        styles: { fontSize: 8, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
        headStyles: { fillColor: [235, 235, 235], textColor: [60, 60, 60], fontStyle: "bold", halign: "center", fontSize: 7.5 },
        columnStyles: {
          0: { halign: "right" }, 1: { halign: "right" },
          2: { halign: "center" }, 3: { halign: "center" },
          4: { halign: "center" }, 5: { halign: "right", fontStyle: "bold" },
        },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 2;

      autoTable(doc, {
        startY: y,
        margin: { left: pageW - mR - 90, right: mR },
        body: [["Subtotal:", fmtBRL(valorEq)]],
        styles: { fontSize: 9, cellPadding: 1.5, lineWidth: 0 },
        columnStyles: {
          0: { halign: "right", fontStyle: "bold", cellWidth: 45, textColor: [41, 128, 185] },
          1: { halign: "right", fontStyle: "bold", cellWidth: 45, textColor: [41, 128, 185] },
        },
        theme: "plain",
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Custos block
    const totalCustos = custosPeriodo.reduce((s, c) => s + Number(c.valor || 0), 0);
    if (custosPeriodo.length > 0) {
      if (y > pageH - 60) { doc.addPage(); y = 15; }
      doc.setFillColor(41, 128, 185);
      doc.rect(mL, y - 3, contentW, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("CUSTOS NO PERÍODO", mL + 2, y);
      doc.setTextColor(0, 0, 0);
      y += 6;

      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        head: [["Data", "Descrição", "Tipo", "Valor"]],
        body: custosPeriodo.map((c: any) => [
          parseLocalDate(c.data).toLocaleDateString("pt-BR"),
          c.descricao || "—",
          c.tipo || "—",
          fmtBRL(Number(c.valor)),
        ]),
        styles: { fontSize: 7, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
        headStyles: { fillColor: [235, 235, 235], textColor: [60, 60, 60], fontStyle: "bold" },
        columnStyles: { 0: { halign: "center" }, 3: { halign: "right" } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Resumo
    if (y > pageH - 50) { doc.addPage(); y = 15; }
    const resumoBody: string[][] = [
      [isDiarias ? "Medição (Diárias)" : "Medição (Horas)", fmtBRL(totalMedicao)],
    ];
    if (totalCustos > 0) resumoBody.push(["(+) Custos no Período", fmtBRL(totalCustos)]);
    const grandTotal = totalMedicao + totalCustos;
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
      columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
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

    // Signatures
    if (y + 40 > pageH - 25) { doc.addPage(); y = 20; }
    const sigY = Math.max(y + 14, pageH - 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("Aprovação:", mL, sigY);
    const sigLineY = sigY + 20;
    const halfW = (contentW - 30) / 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(mL, sigLineY, mL + halfW, sigLineY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(busatoNome, mL + halfW / 2, sigLineY + 5, { align: "center" });
    const rightX = mL + halfW + 30;
    doc.line(rightX, sigLineY, rightX + halfW, sigLineY);
    doc.text(fornecedor?.nome || "FORNECEDOR", rightX + halfW / 2, sigLineY + 5, { align: "center" });

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(6);
      doc.setTextColor(130, 130, 130);
      doc.text(`Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}  —  Página ${p} de ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
    }

    doc.save(`medicao_terceiros_${(fornecedor?.nome || "fornecedor").replace(/\s+/g, "_")}_${inicio || ""}.pdf`);
  };

  const filteredSaved = savedItems.filter(item => {
    if (filterFornecedor !== "all" && item.contratos_terceiros?.fornecedores?.id !== filterFornecedor) return false;
    return true;
  });

  const uniqueFornecedores = Array.from(new Map(
    contratos.map(c => [c.fornecedores.id, c.fornecedores])
  ).values());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Medição</Button>
        <div className="flex-1" />
        <SearchableSelect
          value={filterFornecedor}
          onValueChange={setFilterFornecedor}
          placeholder="Todos fornecedores"
          options={[{ value: "all", label: "Todos" }, ...uniqueFornecedores.map(f => ({ value: f.id, label: f.nome }))]}
        />
      </div>

      {/* Saved measurements list */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSaved.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.contratos_terceiros?.fornecedores?.nome || "—"}</TableCell>
                <TableCell>{item.periodo}</TableCell>
                <TableCell className="font-bold">R$ {fmt(Number(item.valor_total))}</TableCell>
                <TableCell>
                  <Badge variant={item.status === "Aprovado" ? "default" : "secondary"}>{item.status}</Badge>
                </TableCell>
                <TableCell>{new Date(item.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exportPDF(item)} title="Baixar PDF"><FileDown className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredSaved.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma medição registrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* New/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              {editing ? "Editar Medição" : "Nova Medição"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Contract + period selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Contrato / Fornecedor *</Label>
                <SearchableSelect
                  value={formContratoId}
                  onValueChange={onContratoChange}
                  placeholder="Selecione..."
                  options={contratos.map(c => ({
                    value: c.id,
                    label: `${c.fornecedores.nome} (${c.contratos_terceiros_equipamentos?.length || 0} equip.)`,
                  }))}
                />
              </div>
              <div>
                <Label>Período Início</Label>
                <Input type="date" value={formMedicaoInicio} onChange={e => setFormMedicaoInicio(e.target.value)} />
              </div>
              <div>
                <Label>Período Fim</Label>
                <Input type="date" value={formMedicaoFim} onChange={e => setFormMedicaoFim(e.target.value)} />
              </div>
            </div>

            {formContratoId && formMedicaoInicio && formMedicaoFim && (
              <Button variant="outline" size="sm" onClick={fetchMedicoes} disabled={loadingMedicoes}>
                {loadingMedicoes ? "Calculando..." : "Calcular Medição"}
              </Button>
            )}

            {/* Equipment measurement results */}
            {equipForms.length > 0 && (() => {
              const contratoSel = contratos.find(c => c.id === formContratoId);
              const isDiariasSel = (contratoSel as any)?.tipo_medicao === "diarias";
              return (
              <>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipamento</TableHead>
                        <TableHead className="text-right">{isDiariasSel ? "Diárias Medidas" : "Horas Medidas"}</TableHead>
                        {!isDiariasSel && <TableHead className="text-right">H. Normais</TableHead>}
                        {!isDiariasSel && <TableHead className="text-right">H. Excedentes</TableHead>}
                        <TableHead className="text-right">{isDiariasSel ? "Valor/Diária" : "Valor/Hora"}</TableHead>
                        {!isDiariasSel && <TableHead className="text-right">Val. Excedente</TableHead>}
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipForms.map((ef, idx) => {
                        const sub = ef.horas_normais * ef.valor_hora + ef.horas_excedentes * ef.valor_hora_excedente;
                        return (
                          <TableRow key={ef.equipamento_id}>
                            <TableCell className="font-medium">
                              <div>{ef.tipo} {ef.modelo}</div>
                              {ef.tag_placa && <span className="text-xs font-mono text-muted-foreground">{ef.tag_placa}</span>}
                              {ef.primeiro_mes && <Badge variant="outline" className="ml-1 text-[10px]">Proporcional</Badge>}
                              {ef.primeiro_mes && !isDiariasSel && (
                                <div className="mt-1">
                                  <Select value={ef.cobranca_parcial} onValueChange={(v) => changeCobrancaParcial(idx, v as "horas_trabalhadas" | "proporcional_minimo")}>
                                    <SelectTrigger className="h-6 text-[10px] w-48">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="horas_trabalhadas">Horas Trabalhadas</SelectItem>
                                      <SelectItem value="proporcional_minimo">Proporcional Mínimo</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{ef.horas_medidas.toFixed(1)}</TableCell>
                            {!isDiariasSel && <TableCell className="text-right">{ef.horas_normais.toFixed(1)}</TableCell>}
                            {!isDiariasSel && (
                              <TableCell className="text-right">
                                {ef.horas_excedentes > 0 ? (
                                  <Badge variant="destructive" className="text-xs">{ef.horas_excedentes.toFixed(1)}</Badge>
                                ) : "0.0"}
                              </TableCell>
                            )}
                            <TableCell className="text-right">R$ {fmt(ef.valor_hora)}</TableCell>
                            {!isDiariasSel && <TableCell className="text-right">R$ {fmt(ef.valor_hora_excedente)}</TableCell>}
                            <TableCell className="text-right font-bold">R$ {fmt(sub)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Custos */}
                {custos.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm">Custos no Período</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {custos.map(c => (
                            <TableRow key={c.id}>
                              <TableCell>{c.descricao}</TableCell>
                              <TableCell><Badge variant="outline">{c.tipo}</Badge></TableCell>
                              <TableCell className="text-right font-medium">R$ {fmt(Number(c.valor))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Totals */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">{isDiariasSel ? "Diárias" : "Horas Normais"}</p>
                      <p className="text-lg font-bold">R$ {fmt(totalNormais)}</p>
                    </CardContent>
                  </Card>
                  {!isDiariasSel && (
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Horas Excedentes</p>
                        <p className="text-lg font-bold text-destructive">R$ {fmt(totalExcedentes)}</p>
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Custos</p>
                      <p className="text-lg font-bold">R$ {fmt(totalCustos)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-accent/30 bg-accent/5">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground font-medium">Valor Total</p>
                      <p className="text-xl font-bold text-accent">R$ {fmt(valorTotal)}</p>
                    </CardContent>
                  </Card>
                </div>
              </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={equipForms.length === 0}>Salvar Medição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir medição?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
