import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Receipt, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, TrendingDown, FileDown, FileSpreadsheet } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

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
}

interface Fatura {
  id: string;
  contrato_id: string;
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
}

interface GastoItem {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data: string;
}

const emptyForm = { contrato_id: "", periodo: "", horas_normais: 0, horas_excedentes: 0, valor_hora: 0, valor_excedente_hora: 0, status: "Pendente", numero_nota: "", periodo_medicao_inicio: "", periodo_medicao_fim: "" };

const Faturamento = () => {
  const [items, setItems] = useState<Fatura[]>([]);
  const [contratos, setContratos] = useState<ContratoRef[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fatura | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [horasMedidas, setHorasMedidas] = useState<number | null>(null);
  const [loadingMedicoes, setLoadingMedicoes] = useState(false);
  const [gastosEquip, setGastosEquip] = useState<GastoItem[]>([]);
  const [totalGastos, setTotalGastos] = useState(0);
  const [selectedGastos, setSelectedGastos] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [horaMinima, setHoraMinima] = useState(0);
  const [dataEntrega, setDataEntrega] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    const [fatRes, ctRes] = await Promise.all([
      supabase.from("faturamento").select("*, contratos(id, valor_hora, horas_contratadas, equipamento_id, data_inicio, data_fim, observacoes, empresas(nome, cnpj, contato, telefone), equipamentos(tipo, modelo, tag_placa, numero_serie))").order("emissao", { ascending: false }),
      supabase.from("contratos").select("id, valor_hora, horas_contratadas, equipamento_id, data_inicio, data_fim, observacoes, dia_medicao_inicio, dia_medicao_fim, prazo_faturamento, empresas(nome, cnpj, contato, telefone), equipamentos(tipo, modelo, tag_placa, numero_serie), contratos_equipamentos(equipamento_id, valor_hora, valor_hora_excedente, horas_contratadas, hora_minima, data_entrega)").eq("status", "Ativo").order("created_at", { ascending: false }),
    ]);
    if (fatRes.data) setItems(fatRes.data as unknown as Fatura[]);
    if (ctRes.data) setContratos(ctRes.data as unknown as ContratoRef[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Fetch measurements + gastos when contract + date range changes
  const fetchMedicoesEGastos = useCallback(async (contratoId: string, inicio: string, fim: string) => {
    const ct = contratos.find(c => c.id === contratoId);
    if (!ct || !inicio || !fim) { setHorasMedidas(null); setGastosEquip([]); setTotalGastos(0); setSelectedGastos(new Set()); return; }
    setLoadingMedicoes(true);

    const [medRes, gastosRes] = await Promise.all([
      supabase
        .from("medicoes")
        .select("horas_trabalhadas")
        .eq("equipamento_id", ct.equipamento_id)
        .gte("data", inicio)
        .lte("data", fim),
      supabase
        .from("gastos")
        .select("id, descricao, tipo, valor, data")
        .eq("equipamento_id", ct.equipamento_id)
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: false }),
    ]);

    // Medições - apply hora_minima logic
    if (medRes.error) { setHorasMedidas(null); } else {
      const total = (medRes.data || []).reduce((acc, m) => acc + Number(m.horas_trabalhadas), 0);
      setHorasMedidas(total);
      const horasContratadas = Number(ct.horas_contratadas);
      
      // Get hora_minima from contratos_equipamentos
      const ceList = (ct as any).contratos_equipamentos || [];
      const mainCe = ceList.length > 0 ? ceList[0] : null;
      const hMinima = Number(mainCe?.hora_minima || 0);
      setHoraMinima(hMinima);
      setDataEntrega(mainCe?.data_entrega || null);

      // If total hours < hora_minima, charge for hora_minima
      const horasEfetivas = hMinima > 0 && total < hMinima ? hMinima : total;
      const horasNormais = Math.min(horasEfetivas, horasContratadas);
      const horasExcedentes = Math.max(0, horasEfetivas - horasContratadas);
      setForm(prev => ({ ...prev, horas_normais: Number(horasNormais.toFixed(1)), horas_excedentes: Number(horasExcedentes.toFixed(1)) }));
    }

    // Gastos - all shown but none selected by default
    if (gastosRes.data) {
      setGastosEquip(gastosRes.data as GastoItem[]);
      setSelectedGastos(new Set()); // empty = none selected
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
    if (selectedGastos.size === gastosEquip.length) {
      setSelectedGastos(new Set());
    } else {
      setSelectedGastos(new Set(gastosEquip.map(g => g.id)));
    }
  };

  // Recalculate totalGastos when selection changes
  useEffect(() => {
    const total = gastosEquip.filter(g => selectedGastos.has(g.id)).reduce((acc, g) => acc + Number(g.valor), 0);
    setTotalGastos(total);
  }, [selectedGastos, gastosEquip]);

  useEffect(() => {
    if (form.contrato_id && form.periodo_medicao_inicio && form.periodo_medicao_fim) {
      fetchMedicoesEGastos(form.contrato_id, form.periodo_medicao_inicio, form.periodo_medicao_fim);
    } else {
      setHorasMedidas(null);
      setGastosEquip([]);
      setTotalGastos(0);
      setSelectedGastos(new Set());
    }
  }, [form.contrato_id, form.periodo_medicao_inicio, form.periodo_medicao_fim, fetchMedicoesEGastos]);

  const getDisplayStatus = (item: Fatura) => {
    if (item.status === "Pago" || item.status === "Cancelado") return item.status;
    // Check if overdue based on emission date + prazo_faturamento from contract
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
    i.contratos?.empresas?.nome?.toLowerCase().includes(search.toLowerCase()) || i.periodo.includes(search) || (i.numero_nota || "").includes(search)
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
    const headers = ["Empresa", "CNPJ", "Equipamento", "Tag", "Nº Nota", "Período Medição", "Horas Normais", "Horas Excedentes", "Valor/Hora", "Valor Excedente/Hora", "Gastos Deduzidos (R$)", "Valor Líquido (R$)", "Status"];
    const rows = data.map(i => [
      i.contratos?.empresas?.nome || "",
      i.contratos?.empresas?.cnpj || "",
      `${i.contratos?.equipamentos?.tipo} ${i.contratos?.equipamentos?.modelo}`,
      i.contratos?.equipamentos?.tag_placa || "—",
      i.numero_nota || "—",
      i.periodo_medicao_inicio && i.periodo_medicao_fim ? `${new Date(i.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${new Date(i.periodo_medicao_fim).toLocaleDateString("pt-BR")}` : "—",
      String(i.horas_normais),
      String(i.horas_excedentes),
      `R$ ${Number(i.valor_hora).toFixed(2)}`,
      `R$ ${Number(i.valor_excedente_hora).toFixed(2)}`,
      Number(i.total_gastos || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      Number(i.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      i.status,
    ]);
    return { title: "Relatório de Faturamento", headers, rows, filename: `faturamento_${new Date().toISOString().slice(0,10)}` };
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
      const eq = ct?.equipamentos;
      const gastosVal = Number(item.total_gastos || 0);
      const valorBrutoItem = Number(item.horas_normais) * Number(item.valor_hora) + Number(item.horas_excedentes) * Number(item.valor_excedente_hora);

      // Title
      doc.setFontSize(18);
      doc.setTextColor(41, 128, 185);
      doc.text("Relatório de Faturamento", 14, 18);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, 14, 24);

      let y = 32;

      // Empresa section
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Dados da Empresa", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Campo", "Valor"]],
        body: [
          ["Empresa", emp?.nome || "—"],
          ["CNPJ", emp?.cnpj || "—"],
          ["Contato", emp?.contato || "—"],
          ["Telefone", emp?.telefone || "—"],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Equipamento section
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Dados do Equipamento", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Campo", "Valor"]],
        body: [
          ["Tipo", eq?.tipo || "—"],
          ["Modelo", eq?.modelo || "—"],
          ["Tag/Placa", eq?.tag_placa || "—"],
          ["Nº Série", eq?.numero_serie || "—"],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Contrato section
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Dados do Contrato", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Campo", "Valor"]],
        body: [
          ["Valor/Hora", fmt(Number(ct?.valor_hora || 0))],
          ["Horas Contratadas", `${ct?.horas_contratadas || 0}h`],
          ["Período Contrato", ct?.data_inicio && ct?.data_fim ? `${new Date(ct.data_inicio).toLocaleDateString("pt-BR")} - ${new Date(ct.data_fim).toLocaleDateString("pt-BR")}` : "—"],
          ["Observações", ct?.observacoes || "—"],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Faturamento details
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Detalhamento do Faturamento", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Campo", "Valor"]],
        body: [
          ["Nº Nota", item.numero_nota || "—"],
          ["Período", item.periodo],
          ["Período de Medição", item.periodo_medicao_inicio && item.periodo_medicao_fim ? `${new Date(item.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${new Date(item.periodo_medicao_fim).toLocaleDateString("pt-BR")}` : "—"],
          ["Horas Normais", `${item.horas_normais}h`],
          ["Horas Excedentes", `${item.horas_excedentes}h`],
          ["Valor/Hora", fmt(Number(item.valor_hora))],
          ["Valor Excedente/Hora", fmt(Number(item.valor_excedente_hora))],
          ["Status", item.status],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Fetch gastos for this fatura's equipment + period
      if (item.periodo_medicao_inicio && item.periodo_medicao_fim && ct?.equipamento_id) {
        const { data: gastos } = await supabase
          .from("gastos")
          .select("descricao, tipo, valor, data")
          .eq("equipamento_id", ct.equipamento_id)
          .gte("data", item.periodo_medicao_inicio)
          .lte("data", item.periodo_medicao_fim)
          .order("data");

        if (gastos && gastos.length > 0) {
          doc.setFontSize(12);
          doc.setTextColor(41, 128, 185);
          doc.text("Gastos do Equipamento no Período", 14, y);
          y += 2;
          autoTable(doc, {
            startY: y,
            head: [["Data", "Descrição", "Tipo", "Valor (R$)"]],
            body: gastos.map(g => [
              new Date(g.data).toLocaleDateString("pt-BR"),
              g.descricao,
              g.tipo,
              fmt(Number(g.valor)),
            ]),
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [192, 57, 43], textColor: 255 },
            theme: "grid",
          });
          y = (doc as any).lastAutoTable.finalY + 4;
        }
      }

      // Summary
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Resumo Financeiro", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Descrição", "Valor"]],
        body: [
          ["Valor Bruto (horas)", fmt(valorBrutoItem)],
          ["(-) Gastos Deduzidos", gastosVal > 0 ? `- ${fmt(gastosVal)}` : "R$ 0,00"],
          ["(=) Valor Líquido a Receber", fmt(Number(item.valor_total))],
        ],
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [39, 174, 96], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 } },
        theme: "grid",
        bodyStyles: { fontSize: 10 },
      });
    }

    doc.save(`faturamento_detalhado_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setHorasMedidas(null); setGastosEquip([]); setTotalGastos(0); setSelectedGastos(new Set()); setHoraMinima(0); setDataEntrega(null); setDialogOpen(true); };
  const openEdit = async (item: Fatura) => {
    setEditing(item);
    setForm({
      contrato_id: item.contrato_id,
      periodo: item.periodo,
      horas_normais: item.horas_normais,
      horas_excedentes: item.horas_excedentes,
      valor_hora: item.valor_hora,
      valor_excedente_hora: item.valor_excedente_hora,
      status: item.status,
      numero_nota: item.numero_nota || "",
      periodo_medicao_inicio: item.periodo_medicao_inicio || "",
      periodo_medicao_fim: item.periodo_medicao_fim || "",
    });
    // Load previously selected gastos
    const { data: savedGastos } = await supabase
      .from("faturamento_gastos")
      .select("gasto_id")
      .eq("faturamento_id", item.id);
    if (savedGastos) {
      setSelectedGastos(new Set(savedGastos.map(sg => sg.gasto_id)));
    }
    setDialogOpen(true);
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
      // crosses month boundary, e.g. 21 to 20: inicio is previous month
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

  const handleContratoSelect = (contratoId: string) => {
    const ct = contratos.find(c => c.id === contratoId) as any;
    if (ct) {
      const dates = calcMedicaoDates(ct);
      const ceList = ct.contratos_equipamentos || [];
      const mainCe = ceList.length > 0 ? ceList[0] : null;
      const valorExcedente = mainCe?.valor_hora_excedente ? Number(mainCe.valor_hora_excedente) : Number(ct.valor_hora) * 1.25;
      const hMinima = Number(mainCe?.hora_minima || 0);
      const dEntrega = mainCe?.data_entrega || null;
      setHoraMinima(hMinima);
      setDataEntrega(dEntrega);

      // Check if first month (data_entrega within measurement period) for proration
      let periodoInicio = dates.inicio;
      if (dEntrega) {
        const entregaDate = new Date(dEntrega);
        const inicioDate = new Date(dates.inicio);
        const fimDate = new Date(dates.fim);
        // If delivery date is within the current measurement period, start from delivery date
        if (entregaDate >= inicioDate && entregaDate <= fimDate) {
          periodoInicio = dEntrega;
        }
      }

      setForm(prev => ({
        ...prev,
        contrato_id: contratoId,
        valor_hora: Number(ct.valor_hora),
        valor_excedente_hora: valorExcedente,
        periodo_medicao_inicio: periodoInicio,
        periodo_medicao_fim: dates.fim,
      }));
    }
  };

  const valorBruto = form.horas_normais * form.valor_hora + form.horas_excedentes * form.valor_excedente_hora;
  const valorLiquido = Math.max(0, valorBruto - totalGastos);

  const handleSave = async () => {
    if (!form.contrato_id) return;
    const payload = {
      contrato_id: form.contrato_id,
      periodo: form.periodo,
      horas_normais: form.horas_normais,
      horas_excedentes: form.horas_excedentes,
      valor_hora: form.valor_hora,
      valor_excedente_hora: form.valor_excedente_hora,
      valor_total: valorLiquido,
      status: form.status,
      numero_nota: form.numero_nota || null,
      periodo_medicao_inicio: form.periodo_medicao_inicio || null,
      periodo_medicao_fim: form.periodo_medicao_fim || null,
      total_gastos: totalGastos,
    };
    
    let faturaId: string;
    
    if (editing) {
      const { error } = await supabase.from("faturamento").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      faturaId = editing.id;
      // Clear old gastos associations
      await supabase.from("faturamento_gastos").delete().eq("faturamento_id", faturaId);
    } else {
      const { data, error } = await supabase.from("faturamento").insert(payload).select("id").single();
      if (error || !data) { toast({ title: "Erro", description: error?.message || "Erro ao criar fatura", variant: "destructive" }); return; }
      faturaId = data.id;
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

  const selectedContrato = contratos.find(c => c.id === form.contrato_id);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
            <p className="text-sm text-muted-foreground">Total pendente: <span className="text-accent font-semibold">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>{selected.size > 0 && ` · ${selected.size} selecionada(s)`}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportDetailedPDF}>
              <FileDown className="h-4 w-4 mr-1" /> PDF Detalhado
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Nova Fatura
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por empresa, período ou nº nota..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Equipamento</TableHead>
                   <TableHead>Nº Nota</TableHead>
                   <TableHead>Período Medição</TableHead>
                   <TableHead>Prazo</TableHead>
                   <TableHead>Vencimento</TableHead>
                   <TableHead>Horas</TableHead>
                  <TableHead>Gastos Deduzidos</TableHead>
                  <TableHead>Valor Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const horasContratadas = Number(item.contratos?.horas_contratadas || 0);
                  const totalHoras = Number(item.horas_normais) + Number(item.horas_excedentes);
                  const dentroContrato = totalHoras <= horasContratadas;
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
                      <TableCell className="text-sm">{item.contratos?.equipamentos?.tipo} {item.contratos?.equipamentos?.modelo}</TableCell>
                      <TableCell className="font-mono text-sm">{item.numero_nota || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.periodo_medicao_inicio && item.periodo_medicao_fim
                          ? `${new Date(item.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${new Date(item.periodo_medicao_fim).toLocaleDateString("pt-BR")}`
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
                          {dentroContrato
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            : <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {itemGastos > 0
                          ? <span className="text-destructive font-semibold">- R$ {itemGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
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
                                <AlertDialogTitle>Excluir Faturamento</AlertDialogTitle>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-accent" />{editing ? "Editar Fatura" : "Nova Fatura"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label>Contrato</Label>
              <Select value={form.contrato_id} onValueChange={handleContratoSelect}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contratos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.empresas?.nome} — {c.equipamentos?.tipo} {c.equipamentos?.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedContrato && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p><strong>Empresa:</strong> {selectedContrato.empresas?.nome} ({selectedContrato.empresas?.cnpj})</p>
                <p><strong>Equipamento:</strong> {selectedContrato.equipamentos?.tipo} {selectedContrato.equipamentos?.modelo} {selectedContrato.equipamentos?.tag_placa ? `(${selectedContrato.equipamentos.tag_placa})` : ""}</p>
                <p><strong>Valor/Hora:</strong> R$ {Number(selectedContrato.valor_hora).toFixed(2)} | <strong>Horas Contratadas:</strong> {selectedContrato.horas_contratadas}h</p>
                {horaMinima > 0 && <p><strong>Hora Mínima:</strong> {horaMinima}h <span className="text-muted-foreground">(se trabalhar menos, será cobrado {horaMinima}h)</span></p>}
                {dataEntrega && <p><strong>Data Entrega:</strong> {new Date(dataEntrega).toLocaleDateString("pt-BR")}</p>}
                <p><strong>Ciclo Medição:</strong> Dia {selectedContrato.dia_medicao_inicio || 1} ao Dia {selectedContrato.dia_medicao_fim || 30} (todo mês)</p>
                <p><strong>Prazo Faturamento:</strong> {selectedContrato.prazo_faturamento || 30} dias</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nº Nota / Fatura</Label><Input value={form.numero_nota} onChange={(e) => setForm({ ...form, numero_nota: e.target.value })} placeholder="Ex: NF-001" /></div>
              <div><Label>Período</Label><Input value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} placeholder="Mês/Ano" /></div>
            </div>

            {/* Measurement summary */}
            {horasMedidas !== null && selectedContrato && (
              <div className={`p-4 rounded-lg border space-y-2 ${horasMedidas > Number(selectedContrato.horas_contratadas) ? "border-warning bg-warning/5" : "border-success bg-success/5"}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-accent" />
                  Resumo da Medição (automático)
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Horas Medidas</p>
                    <p className="text-lg font-bold text-accent">{horasMedidas.toFixed(1)}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horas Contratadas</p>
                    <p className="text-lg font-bold">{selectedContrato.horas_contratadas}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Excedente</p>
                    <p className={`text-lg font-bold ${form.horas_excedentes > 0 ? "text-warning" : "text-success"}`}>
                      {form.horas_excedentes > 0 ? `+${form.horas_excedentes.toFixed(1)}h` : "0h"}
                    </p>
                  </div>
                </div>
                {horaMinima > 0 && horasMedidas < horaMinima && (
                  <div className="flex items-center gap-1 text-xs text-accent font-medium bg-accent/10 rounded p-2">
                    ⚡ Hora mínima aplicada: {horasMedidas.toFixed(1)}h medidas → cobrando {horaMinima}h (mínimo contratual)
                  </div>
                )}
                {horasMedidas > Number(selectedContrato.horas_contratadas) ? (
                  <div className="flex items-center gap-1 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Equipamento excedeu as horas contratadas em {(horasMedidas - Number(selectedContrato.horas_contratadas)).toFixed(1)}h
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Dentro do limite contratado ({(Number(selectedContrato.horas_contratadas) - horasMedidas).toFixed(1)}h restantes)
                  </div>
                )}
                {dataEntrega && form.periodo_medicao_inicio === dataEntrega && (
                  <div className="flex items-center gap-1 text-xs text-accent font-medium bg-accent/10 rounded p-2">
                    📅 Primeiro mês — faturamento fracionado a partir da entrega ({new Date(dataEntrega).toLocaleDateString("pt-BR")})
                  </div>
                )}
                {loadingMedicoes && <p className="text-xs text-muted-foreground">Calculando...</p>}
              </div>
            )}

            {horasMedidas === null && form.contrato_id && form.periodo_medicao_inicio && form.periodo_medicao_fim && (
              <div className="p-3 rounded-lg bg-muted/30 text-center text-sm text-muted-foreground">
                Nenhuma medição encontrada para este equipamento no período selecionado.
              </div>
            )}

            {/* Gastos / Deduções */}
            {gastosEquip.length > 0 && (
              <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <TrendingDown className="h-4 w-4" />
                    Gastos do Equipamento no Período
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAllGastos}>
                    {selectedGastos.size === gastosEquip.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {gastosEquip.map(g => (
                    <div key={g.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedGastos.has(g.id)}
                        onCheckedChange={() => toggleGasto(g.id)}
                        className="shrink-0"
                      />
                      <span className={`flex-1 ${selectedGastos.has(g.id) ? "text-foreground" : "text-muted-foreground"}`}>
                        {new Date(g.data).toLocaleDateString("pt-BR")} — {g.descricao} <Badge variant="outline" className="text-xs ml-1">{g.tipo}</Badge>
                      </span>
                      <span className={`font-semibold shrink-0 ${selectedGastos.has(g.id) ? "text-destructive" : "text-muted-foreground"}`}>
                        - R$ {Number(g.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
                {selectedGastos.size > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-destructive/20 font-bold text-sm">
                    <span>Total Gastos Selecionados ({selectedGastos.size}/{gastosEquip.length})</span>
                    <span className="text-destructive">- R$ {totalGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Horas Normais</Label><Input type="number" value={form.horas_normais || ""} onChange={(e) => setForm({ ...form, horas_normais: Number(e.target.value) })} /></div>
              <div><Label>Valor/Hora (R$)</Label><Input type="number" value={form.valor_hora || ""} onChange={(e) => setForm({ ...form, valor_hora: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Horas Excedentes</Label><Input type="number" value={form.horas_excedentes || ""} onChange={(e) => setForm({ ...form, horas_excedentes: Number(e.target.value) })} /></div>
              <div><Label>Valor Excedente/Hora (R$)</Label><Input type="number" value={form.valor_excedente_hora || ""} onChange={(e) => setForm({ ...form, valor_excedente_hora: Number(e.target.value) })} /></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.horas_normais > 0 || form.horas_excedentes > 0) && (
              <div className="p-4 rounded-lg bg-accent/10 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor Bruto (horas)</span>
                  <span className="font-semibold">R$ {valorBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                {totalGastos > 0 && (
                  <div className="flex items-center justify-between text-sm text-destructive">
                    <span>Gastos Deduzidos</span>
                    <span className="font-semibold">- R$ {totalGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-accent/20">
                  <span className="text-sm font-medium">Valor Líquido a Receber</span>
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
    </Layout>
  );
};

export default Faturamento;
