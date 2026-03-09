import { useState, useEffect, useCallback } from "react";
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
import { Plus, Search, Pencil, Trash2, FileText, FileDown, FileSpreadsheet, X, BarChart3, AlertTriangle, TrendingUp, Settings2, CalendarRange, FilePlus2, FileSignature, Package } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropostasContent } from "@/pages/Propostas";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel, addLetterhead } from "@/lib/exportUtils";

interface Empresa { id: string; nome: string; cnpj: string; razao_social: string; nome_fantasia: string; inscricao_estadual: string; inscricao_municipal: string; endereco_logradouro: string; endereco_numero: string; endereco_complemento: string; endereco_bairro: string; endereco_cidade: string; endereco_uf: string; endereco_cep: string; contato: string | null; telefone: string | null; email: string; atividade_principal: string; }
interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
interface ContratoEquipamento { id: string; equipamento_id: string; valor_hora: number; horas_contratadas: number; valor_hora_excedente: number; hora_minima: number; data_entrega: string | null; data_devolucao: string | null; equipamentos: Equipamento; }
interface Contrato {
  id: string;
  empresa_id: string;
  equipamento_id: string;
  valor_hora: number;
  horas_contratadas: number;
  data_inicio: string;
  data_fim: string;
  observacoes: string | null;
  status: string;
  empresas: Empresa;
  equipamentos: Equipamento;
  contratos_equipamentos?: ContratoEquipamento[];
}

interface FormEquipItem {
  equipamento_id: string;
  valor_hora: number;
  horas_contratadas: number;
  valor_hora_excedente: number;
  hora_minima: number;
  data_entrega: string;
  data_devolucao: string;
}

interface EquipUsage {
  equipamento_id: string;
  equipamento: Equipamento;
  valor_hora: number;
  horas_contratadas: number;
  horas_utilizadas: number;
  custo_real: number;
  custo_contratado: number;
  percentual: number;
  origem: string; // "Contrato" or "Aditivo #N"
}

interface AjusteTemporario {
  id: string;
  contrato_id: string;
  equipamento_id: string;
  valor_hora: number;
  valor_hora_excedente: number;
  hora_minima: number;
  horas_contratadas: number;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  created_at: string;
}

interface AjusteForm {
  equipamento_id: string;
  valor_hora: number;
  valor_hora_excedente: number;
  hora_minima: number;
  horas_contratadas: number;
  data_inicio: string;
  data_fim: string;
  motivo: string;
}

interface Aditivo {
  id: string;
  contrato_id: string;
  numero: number;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  observacoes: string;
  created_at: string;
  aditivos_equipamentos?: AditivoEquipamento[];
}

interface AditivoEquipamento {
  id: string;
  aditivo_id: string;
  equipamento_id: string;
  valor_hora: number;
  horas_contratadas: number;
  valor_hora_excedente: number;
  hora_minima: number;
  data_entrega: string | null;
  data_devolucao: string | null;
}

interface AditivoForm {
  numero: number;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  observacoes: string;
  equipamentos: FormEquipItem[];
}

const emptyForm = { empresa_id: "", equipamento_id: "", valor_hora: 0, horas_contratadas: 0, data_inicio: "", data_fim: "", observacoes: "", status: "Ativo", dia_medicao_inicio: 1, dia_medicao_fim: 30, prazo_faturamento: 30 };

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const Contratos = () => {
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
  const [ajusteForm, setAjusteForm] = useState<AjusteForm>({ equipamento_id: "", valor_hora: 0, valor_hora_excedente: 0, hora_minima: 0, horas_contratadas: 0, data_inicio: "", data_fim: "", motivo: "" });
  const [ajusteTodos, setAjusteTodos] = useState(false);
  const [ajusteCampos, setAjusteCampos] = useState({ valor_hora: true, valor_hora_excedente: true, hora_minima: true, horas_contratadas: true });
  // Aditivos
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [aditivoFormOpen, setAditivoFormOpen] = useState(false);
  const [editingAditivo, setEditingAditivo] = useState<Aditivo | null>(null);
  const [aditivoForm, setAditivoForm] = useState<AditivoForm>({ numero: 1, data_inicio: "", data_fim: "", motivo: "", observacoes: "", equipamentos: [] });
  // Aditivos por contrato (para exibição na tabela)
  const [aditivosPorContrato, setAditivosPorContrato] = useState<Record<string, Aditivo[]>>({});
  const { toast } = useToast();

  const fetchData = async () => {
    const [contratosRes, empresasRes, equipRes] = await Promise.all([
      supabase.from("contratos").select("*, empresas(id, nome, cnpj, razao_social, nome_fantasia, inscricao_estadual, inscricao_municipal, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, contato, telefone, email, atividade_principal), equipamentos(id, tipo, modelo, tag_placa, numero_serie), contratos_equipamentos(id, equipamento_id, valor_hora, horas_contratadas, valor_hora_excedente, hora_minima, data_entrega, data_devolucao, equipamentos(id, tipo, modelo, tag_placa, numero_serie))").order("created_at", { ascending: false }),
      supabase.from("empresas").select("id, nome, cnpj").eq("status", "Ativa").order("nome") as any,
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
    ]);
    if (contratosRes.data) setItems(contratosRes.data as unknown as Contrato[]);
    if (empresasRes.data) setEmpresas(empresasRes.data);
    if (equipRes.data) setEquipamentos(equipRes.data as Equipamento[]);

    // Carregar aditivos com equipamentos para todos os contratos
    if (contratosRes.data && contratosRes.data.length > 0) {
      const contratoIds = contratosRes.data.map((c: any) => c.id);
      const { data: allAditivos } = await supabase
        .from("contratos_aditivos")
        .select("*")
        .in("contrato_id", contratoIds)
        .order("numero", { ascending: true });

      if (allAditivos && allAditivos.length > 0) {
        const aditivoIds = allAditivos.map(a => a.id);
        const { data: allAditivosEquips } = await supabase
          .from("aditivos_equipamentos")
          .select("*")
          .in("aditivo_id", aditivoIds);

        const grouped: Record<string, Aditivo[]> = {};
        for (const ad of allAditivos) {
          const eqs = (allAditivosEquips || []).filter(ae => ae.aditivo_id === ad.id);
          const aditivo: Aditivo = { ...ad, observacoes: ad.observacoes || "", aditivos_equipamentos: eqs };
          if (!grouped[ad.contrato_id]) grouped[ad.contrato_id] = [];
          grouped[ad.contrato_id].push(aditivo);
        }
        setAditivosPorContrato(grouped);
      } else {
        setAditivosPorContrato({});
      }
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getContratoEquipamentos = (item: Contrato): ContratoEquipamento[] => {
    const fromJunction = (item.contratos_equipamentos || []).filter(ce => ce.equipamentos);
    if (fromJunction.length > 0) return fromJunction;
    if (item.equipamentos) return [{ id: "", equipamento_id: item.equipamento_id, valor_hora: item.valor_hora, horas_contratadas: item.horas_contratadas, valor_hora_excedente: 0, hora_minima: 0, data_entrega: null, data_devolucao: null, equipamentos: item.equipamentos }];
    return [];
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

  const filtered = items.filter(
    (i) => i.empresas?.nome?.toLowerCase().includes(search.toLowerCase()) || i.empresas?.cnpj?.includes(search) || getEquipamentosList(i).some(eq => eq.modelo?.toLowerCase().includes(search.toLowerCase()) || eq.tag_placa?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };

  const getExportData = () => {
    const data = filtered.filter(i => selected.size === 0 || selected.has(i.id));
    const headers = ["Empresa", "CNPJ", "Equipamento", "Tag", "Valor/Hora (R$)", "Horas Contratadas", "Início", "Fim", "Status"];
    const rows: string[][] = [];
    data.forEach(i => {
      const ces = getContratoEquipamentos(i);
      ces.forEach(ce => {
        rows.push([
          i.empresas?.nome || "",
          i.empresas?.cnpj || "",
          `${ce.equipamentos.tipo} ${ce.equipamentos.modelo}`,
          ce.equipamentos.tag_placa || "—",
          Number(ce.valor_hora).toFixed(2),
          String(ce.horas_contratadas),
          parseLocalDate(i.data_inicio).toLocaleDateString("pt-BR"),
          parseLocalDate(i.data_fim).toLocaleDateString("pt-BR"),
          i.status,
        ]);
      });
    });
    return { title: "Relatório de Contratos", headers, rows, filename: `contratos_${new Date().toISOString().slice(0,10)}` };
  };

  const exportSimplePDF = async () => {
    const data = filtered.filter(i => selected.size === 0 || selected.has(i.id));
    if (data.length === 0) return;

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape" });
    const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    const hoje = new Date().toISOString().slice(0, 10);

    let y = await addLetterhead(doc, "Relatório de Contratos");

    // --- Tabela principal de contratos ---
    const mainRows: string[][] = [];
    data.forEach(i => {
      const ces = getContratoEquipamentos(i);
      ces.forEach(ce => {
        mainRows.push([
          i.empresas?.nome || "",
          i.empresas?.cnpj || "",
          `${ce.equipamentos.tipo} ${ce.equipamentos.modelo}`,
          ce.equipamentos.tag_placa || "—",
          fmt(Number(ce.valor_hora)),
          String(ce.horas_contratadas),
          ce.data_entrega ? parseLocalDate(ce.data_entrega).toLocaleDateString("pt-BR") : "—",
          ce.data_devolucao ? parseLocalDate(ce.data_devolucao).toLocaleDateString("pt-BR") : "—",
          parseLocalDate(i.data_inicio).toLocaleDateString("pt-BR"),
          parseLocalDate(i.data_fim).toLocaleDateString("pt-BR"),
          i.status,
        ]);
      });
    });

    autoTable(doc, {
      startY: y,
      head: [["Empresa", "CNPJ", "Equipamento", "Tag", "Valor/Hora", "Horas", "Entrega", "Devolução", "Início", "Fim", "Status"]],
      body: mainRows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // --- Resumo de modificações por contrato ---
    for (const item of data) {
      const { data: aditivosData } = await supabase
        .from("contratos_aditivos")
        .select("*")
        .eq("contrato_id", item.id)
        .order("numero", { ascending: true });

      const { data: ajustesData } = await supabase
        .from("contratos_equipamentos_ajustes")
        .select("*")
        .eq("contrato_id", item.id)
        .order("data_inicio", { ascending: true });

      const hasModifs = (aditivosData && aditivosData.length > 0) || (ajustesData && ajustesData.length > 0);
      if (!hasModifs) continue;

      if (y > 160) { doc.addPage(); y = 20; }

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Modificações — ${item.empresas?.nome || ""} (${item.empresas?.cnpj || ""})`, 14, y);
      y += 4;

      const modRows: string[][] = [];

      // Aditivos
      if (aditivosData && aditivosData.length > 0) {
        let allAeqs: any[] = [];
        const aditivoIds = aditivosData.map(a => a.id);
        const { data: aeqs } = await supabase.from("aditivos_equipamentos").select("*").in("aditivo_id", aditivoIds);
        allAeqs = aeqs || [];

        for (const ad of aditivosData) {
          const eqCount = allAeqs.filter(ae => ae.aditivo_id === ad.id).length;
          const devolvidos = allAeqs.filter(ae => ae.aditivo_id === ad.id && ae.data_devolucao && ae.data_devolucao <= hoje).length;
          const statusAd = ad.data_fim < hoje ? "Encerrado" : ad.data_inicio > hoje ? "Futuro" : "Vigente";
          modRows.push([
            `Aditivo #${ad.numero}`,
            `${parseLocalDate(ad.data_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(ad.data_fim).toLocaleDateString("pt-BR")}`,
            statusAd,
            `${eqCount} equip.${devolvidos > 0 ? ` (${devolvidos} devolvido${devolvidos > 1 ? "s" : ""})` : ""}`,
            ad.motivo || "—",
          ]);
        }
      }

      // Ajustes
      if (ajustesData && ajustesData.length > 0) {
        for (const aj of ajustesData) {
          const eq = equipamentos.find(e => e.id === aj.equipamento_id);
          const statusAj = aj.data_fim < hoje ? "Encerrado" : aj.data_inicio > hoje ? "Futuro" : "Vigente";
          modRows.push([
            "Ajuste Temporário",
            `${parseLocalDate(aj.data_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(aj.data_fim).toLocaleDateString("pt-BR")}`,
            statusAj,
            eq ? `${eq.tipo} ${eq.modelo}` : "—",
            aj.motivo || "—",
          ]);
        }
      }

      autoTable(doc, {
        startY: y,
        head: [["Tipo", "Vigência", "Status", "Detalhes", "Motivo"]],
        body: modRows,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [142, 68, 173], textColor: 255 },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    doc.save(`contratos_${new Date().toISOString().slice(0, 10)}.pdf`);
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
      const emp = item.empresas;
      const ces = getContratoEquipamentos(item);

      const startY = await addLetterhead(doc, "Contrato Detalhado");

      let y = startY;

      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Dados da Empresa", 14, y);
      y += 2;
      const enderecoCompleto = [emp?.endereco_logradouro, emp?.endereco_numero, emp?.endereco_complemento].filter(Boolean).join(", ");
      const cidadeUf = [emp?.endereco_bairro, emp?.endereco_cidade, emp?.endereco_uf].filter(Boolean).join(" - ");
      autoTable(doc, {
        startY: y,
        head: [["Campo", "Valor"]],
        body: [
          ["Razão Social", emp?.razao_social || emp?.nome || "—"],
          ["Nome Fantasia", emp?.nome_fantasia || "—"],
          ["CNPJ", emp?.cnpj || "—"],
          ["Inscrição Estadual", emp?.inscricao_estadual || "—"],
          ["Inscrição Municipal", emp?.inscricao_municipal || "—"],
          ["Atividade Principal", emp?.atividade_principal || "—"],
          ["Endereço", enderecoCompleto || "—"],
          ["Bairro / Cidade / UF", cidadeUf || "—"],
          ["CEP", emp?.endereco_cep || "—"],
          ["Contato", emp?.contato || "—"],
          ["Telefone", emp?.telefone || "—"],
          ["E-mail", emp?.email || "—"],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text(`Equipamentos (${ces.length})`, 14, y);
      y += 2;
      const equipHeaders = ["Tipo", "Modelo", "Tag/Placa", "Nº Série", "Valor/Hora", "Horas Contrat.", "Entrega", "Devolução"];
      autoTable(doc, {
        startY: y,
        head: [equipHeaders],
        body: ces.map(ce => {
          const devDentro = ce.data_devolucao && ce.data_devolucao >= item.data_inicio && ce.data_devolucao <= item.data_fim;
          return [
            ce.equipamentos.tipo || "—",
            ce.equipamentos.modelo || "—",
            ce.equipamentos.tag_placa || "—",
            ce.equipamentos.numero_serie || "—",
            fmt(Number(ce.valor_hora)),
            `${ce.horas_contratadas}h`,
            ce.data_entrega ? parseLocalDate(ce.data_entrega).toLocaleDateString("pt-BR") : "—",
            devDentro ? parseLocalDate(ce.data_devolucao!).toLocaleDateString("pt-BR") : "—",
          ];
        }),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Dados do Contrato", 14, y);
      y += 2;
      const totalHoras = ces.reduce((s, ce) => s + Number(ce.horas_contratadas), 0);
      const valorEstimado = ces.reduce((s, ce) => s + Number(ce.valor_hora) * Number(ce.horas_contratadas), 0);
        autoTable(doc, {
        startY: y,
        head: [["Campo", "Valor"]],
        body: [
          ["Total Horas Contratadas", `${totalHoras}h`],
          ["Valor Total Estimado", fmt(valorEstimado)],
          ["Período", `${parseLocalDate(item.data_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(item.data_fim).toLocaleDateString("pt-BR")}`],
          ["Status", item.status],
          ["Observações", item.observacoes || "—"],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [39, 174, 96], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // --- Ajustes Temporários ---
      const { data: ajustesData } = await supabase
        .from("contratos_equipamentos_ajustes")
        .select("*")
        .eq("contrato_id", item.id)
        .order("data_inicio", { ascending: true });

      if (ajustesData && ajustesData.length > 0) {
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setTextColor(41, 128, 185);
        doc.text("Ajustes Temporários", 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Equipamento", "Período", "Valor/Hora", "Hora Exc.", "Horas Contr.", "Hora Mín.", "Motivo"]],
          body: ajustesData.map(aj => {
            const eq = equipamentos.find(e => e.id === aj.equipamento_id);
            return [
              eq ? `${eq.tipo} - ${eq.modelo}` : aj.equipamento_id,
              `${parseLocalDate(aj.data_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(aj.data_fim).toLocaleDateString("pt-BR")}`,
              fmt(Number(aj.valor_hora)),
              fmt(Number(aj.valor_hora_excedente)),
              `${aj.horas_contratadas}h`,
              `${aj.hora_minima}h`,
              aj.motivo || "—",
            ];
          }),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [230, 126, 34], textColor: 255 },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // --- Aditivos ---
      const { data: aditivosData } = await supabase
        .from("contratos_aditivos")
        .select("*")
        .eq("contrato_id", item.id)
        .order("numero", { ascending: true });

      let allAditivosEquips: any[] = [];
      if (aditivosData && aditivosData.length > 0) {
        const aditivoIds = aditivosData.map(a => a.id);
        const { data: aditivosEquips } = await supabase
          .from("aditivos_equipamentos")
          .select("*")
          .in("aditivo_id", aditivoIds);
        allAditivosEquips = aditivosEquips || [];
        for (const aditivo of aditivosData) {
          if (y > 220) { doc.addPage(); y = 20; }
          const now = new Date();
          const inicio = parseLocalDate(aditivo.data_inicio);
          const fim = parseLocalDate(aditivo.data_fim);
          const statusAd = now < inicio ? "Futuro" : now > fim ? "Encerrado" : "Vigente";

          doc.setFontSize(12);
          doc.setTextColor(142, 68, 173);
          doc.text(`Aditivo #${aditivo.numero} — ${statusAd}`, 14, y);
          y += 2;
          autoTable(doc, {
            startY: y,
            head: [["Campo", "Valor"]],
            body: [
              ["Vigência", `${inicio.toLocaleDateString("pt-BR")} - ${fim.toLocaleDateString("pt-BR")}`],
              ["Motivo", aditivo.motivo || "—"],
              ["Observações", aditivo.observacoes || "—"],
            ],
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [142, 68, 173], textColor: 255 },
            columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
            theme: "grid",
          });
          y = (doc as any).lastAutoTable.finalY + 4;

          const eqs = allAditivosEquips.filter(ae => ae.aditivo_id === aditivo.id);
          if (eqs.length > 0) {
            autoTable(doc, {
              startY: y,
              head: [["Equipamento", "Tag", "Valor/Hora", "Hora Exc.", "Horas Contr.", "Hora Mín.", "Entrega", "Devolução"]],
              body: eqs.map(ae => {
                const eq = equipamentos.find(e => e.id === ae.equipamento_id);
                const devDentro = ae.data_devolucao && ae.data_devolucao >= aditivo.data_inicio && ae.data_devolucao <= aditivo.data_fim;
                return [
                  eq ? `${eq.tipo} - ${eq.modelo}` : ae.equipamento_id,
                  eq?.tag_placa || "—",
                  fmt(Number(ae.valor_hora)),
                  fmt(Number(ae.valor_hora_excedente)),
                  `${ae.horas_contratadas}h`,
                  `${ae.hora_minima}h`,
                  ae.data_entrega ? parseLocalDate(ae.data_entrega).toLocaleDateString("pt-BR") : "—",
                  devDentro ? parseLocalDate(ae.data_devolucao!).toLocaleDateString("pt-BR") : "—",
                ];
              }),
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [142, 68, 173], textColor: 255 },
              theme: "grid",
            });
            y = (doc as any).lastAutoTable.finalY + 8;
          }
        }
      }

      // --- Valor Previsto Final (consolidado com todas as modificações) ---
      if (y > 220) { doc.addPage(); y = 20; }
      
      // Build final consolidated equipment map: latest values per equipment
      // Only show currently ACTIVE equipment (not returned)
      const hoje = new Date().toISOString().slice(0, 10);
      const consolidado: Record<string, { tipo: string; modelo: string; tag: string; valor_hora: number; horas_contratadas: number; hora_minima: number; valor_hora_excedente: number; origem: string }> = {};
      
      // Track the latest data_devolucao per equipment across all sources
      const latestDevolucao: Record<string, string | null> = {};
      
      // Start with base contract equipment
      for (const ce of ces) {
        latestDevolucao[ce.equipamento_id] = ce.data_devolucao || null;
        consolidado[ce.equipamento_id] = {
          tipo: ce.equipamentos.tipo,
          modelo: ce.equipamentos.modelo,
          tag: ce.equipamentos.tag_placa || "—",
          valor_hora: Number(ce.valor_hora),
          horas_contratadas: Number(ce.horas_contratadas),
          hora_minima: Number(ce.hora_minima || 0),
          valor_hora_excedente: Number(ce.valor_hora_excedente || 0),
          origem: "Contrato",
        };
      }
      
      // Override with aditivos (sorted by numero, so last one wins)
      if (aditivosData && aditivosData.length > 0) {
        const sortedAditivos = [...aditivosData].sort((a, b) => a.numero - b.numero);
        for (const aditivo of sortedAditivos) {
          if (aditivo.data_fim < hoje) continue;
          const aeqs = allAditivosEquips.filter(ae => ae.aditivo_id === aditivo.id);
          for (const ae of aeqs) {
            // Update devolucao tracking — latest aditivo's value takes precedence
            latestDevolucao[ae.equipamento_id] = ae.data_devolucao || null;
            const eq = equipamentos.find(e => e.id === ae.equipamento_id);
            consolidado[ae.equipamento_id] = {
              tipo: eq?.tipo || "—",
              modelo: eq?.modelo || "—",
              tag: eq?.tag_placa || "—",
              valor_hora: Number(ae.valor_hora),
              horas_contratadas: Number(ae.horas_contratadas),
              hora_minima: Number(ae.hora_minima || 0),
              valor_hora_excedente: Number(ae.valor_hora_excedente || 0),
              origem: `Aditivo #${aditivo.numero}`,
            };
          }
        }
      }
      
      // Remove all equipment that has been returned (data_devolucao <= hoje)
      for (const eqId of Object.keys(consolidado)) {
        const dev = latestDevolucao[eqId];
        if (dev && dev <= hoje) {
          delete consolidado[eqId];
        }
      }
      
      // Override with ajustes vigentes
      if (ajustesData && ajustesData.length > 0) {
        for (const aj of ajustesData) {
          if (aj.data_fim < hoje || aj.data_inicio > hoje) continue;
          const existing = consolidado[aj.equipamento_id];
          if (existing) {
            existing.valor_hora = Number(aj.valor_hora);
            existing.horas_contratadas = Number(aj.horas_contratadas);
            existing.hora_minima = Number(aj.hora_minima);
            existing.valor_hora_excedente = Number(aj.valor_hora_excedente);
            existing.origem += " + Ajuste";
          }
        }
      }
      
      const consolidadoList = Object.values(consolidado);
      const totalHorasFinal = consolidadoList.reduce((s, c) => s + c.horas_contratadas, 0);
      const valorPrevistoFinal = consolidadoList.reduce((s, c) => s + c.valor_hora * c.horas_contratadas, 0);
      
      doc.setFontSize(12);
      doc.setTextColor(39, 174, 96);
      doc.text("Valor Previsto Atual (com todas as modificações)", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Equipamento", "Tag", "Valor/Hora", "Horas Contr.", "Subtotal", "Origem"]],
        body: consolidadoList.map(c => [
          `${c.tipo} - ${c.modelo}`,
          c.tag,
          fmt(c.valor_hora),
          `${c.horas_contratadas}h`,
          fmt(c.valor_hora * c.horas_contratadas),
          c.origem,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [39, 174, 96], textColor: 255 },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      
      autoTable(doc, {
        startY: y,
        head: [["", ""]],
        body: [
          ["Total Horas", `${totalHorasFinal}h`],
          ["Valor Mensal Previsto", fmt(valorPrevistoFinal)],
        ],
        styles: { fontSize: 10, cellPadding: 4, fontStyle: "bold" },
        headStyles: { fillColor: [39, 174, 96], textColor: 255 },
        columnStyles: { 0: { cellWidth: 60 } },
        theme: "grid",
        showHead: false,
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    doc.save(`contratos_detalhado_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setFormEquipamentos([]); setDialogOpen(true); };
  const openEdit = (item: Contrato) => {
    setEditing(item);
    const ces = getContratoEquipamentos(item);
    setFormEquipamentos(ces.map(ce => ({ equipamento_id: ce.equipamento_id, valor_hora: Number(ce.valor_hora), horas_contratadas: Number(ce.horas_contratadas), valor_hora_excedente: Number(ce.valor_hora_excedente || 0), hora_minima: Number(ce.hora_minima || 0), data_entrega: ce.data_entrega || "", data_devolucao: ce.data_devolucao || "" })));
    setForm({ empresa_id: item.empresa_id, equipamento_id: item.equipamento_id, valor_hora: item.valor_hora, horas_contratadas: item.horas_contratadas, data_inicio: item.data_inicio, data_fim: item.data_fim, observacoes: item.observacoes || "", status: item.status, dia_medicao_inicio: (item as any).dia_medicao_inicio || 1, dia_medicao_fim: (item as any).dia_medicao_fim || 30, prazo_faturamento: (item as any).prazo_faturamento || 30 });
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
    const payload = { ...form, equipamento_id: mainEquipId, valor_hora: Number(formEquipamentos[0].valor_hora), horas_contratadas: Number(formEquipamentos[0].horas_contratadas), dia_medicao_inicio: Number(form.dia_medicao_inicio), dia_medicao_fim: Number(form.dia_medicao_fim), prazo_faturamento: Number(form.prazo_faturamento) };

    let contratoId: string;

    if (editing) {
      const { error } = await supabase.from("contratos").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      contratoId = editing.id;
      await supabase.from("contratos_equipamentos").delete().eq("contrato_id", contratoId);
    } else {
      const { data, error } = await supabase.from("contratos").insert(payload).select("id").single();
      if (error || !data) { toast({ title: "Erro", description: error?.message || "Erro ao criar contrato", variant: "destructive" }); return; }
      contratoId = data.id;
    }

    const junctionRows = formEquipamentos.map(fe => ({
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

    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchData();
  };

  const statusColor = (s: string) => {
    if (s === "Ativo") return "bg-success text-success-foreground";
    if (s === "Encerrado") return "bg-muted text-muted-foreground";
    return "bg-warning text-warning-foreground";
  };

  const availableEquipamentos = equipamentos.filter(e => !formEquipamentos.some(fe => fe.equipamento_id === e.id));

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

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

  const openNewAjuste = (equipId?: string) => {
    setEditingAjuste(null);
    setAjusteTodos(false);
    setAjusteCampos({ valor_hora: true, valor_hora_excedente: true, hora_minima: true, horas_contratadas: true });
    const ces = ajustesContrato ? getContratoEquipamentos(ajustesContrato) : [];
    const firstEquip = equipId || (ces.length > 0 ? ces[0].equipamento_id : "");
    const ce = ces.find(c => c.equipamento_id === firstEquip);
    setAjusteForm({
      equipamento_id: firstEquip,
      valor_hora: ce ? Number(ce.valor_hora) : 0,
      valor_hora_excedente: ce ? Number(ce.valor_hora_excedente) : 0,
      hora_minima: ce ? Number(ce.hora_minima) : 0,
      horas_contratadas: ce ? Number(ce.horas_contratadas) : 0,
      data_inicio: "",
      data_fim: "",
      motivo: "",
    });
    setAjusteFormOpen(true);
  };

  const openEditAjuste = (aj: AjusteTemporario) => {
    setEditingAjuste(aj);
    setAjusteForm({
      equipamento_id: aj.equipamento_id,
      valor_hora: aj.valor_hora,
      valor_hora_excedente: aj.valor_hora_excedente,
      hora_minima: aj.hora_minima,
      horas_contratadas: aj.horas_contratadas,
      data_inicio: aj.data_inicio,
      data_fim: aj.data_fim,
      motivo: (aj.motivo || "").replace("[LOTE] ", "").replace("[LOTE]", ""),
    });
    setAjusteFormOpen(true);
  };

  const handleSaveAjuste = async () => {
    if (!ajustesContrato || !ajusteForm.data_inicio || !ajusteForm.data_fim) {
      toast({ title: "Campos obrigatórios", description: "Preencha as datas de início e fim.", variant: "destructive" });
      return;
    }
    if (!ajusteTodos && !ajusteForm.equipamento_id) {
      toast({ title: "Campos obrigatórios", description: "Selecione um equipamento.", variant: "destructive" });
      return;
    }

    if (editingAjuste) {
      // Edição: sempre individual
      const payload = {
        contrato_id: ajustesContrato.id,
        equipamento_id: ajusteForm.equipamento_id,
        valor_hora: Number(ajusteForm.valor_hora),
        valor_hora_excedente: Number(ajusteForm.valor_hora_excedente),
        hora_minima: Number(ajusteForm.hora_minima),
        horas_contratadas: Number(ajusteForm.horas_contratadas),
        data_inicio: ajusteForm.data_inicio,
        data_fim: ajusteForm.data_fim,
        motivo: ajusteForm.motivo,
      };
      const { error } = await supabase.from("contratos_equipamentos_ajustes").update(payload).eq("id", editingAjuste.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else if (ajusteTodos) {
      // Aplicar a todos os equipamentos do contrato (base + aditivos) ativos no período do ajuste
      const ajInicio = parseLocalDate(ajusteForm.data_inicio);
      const ajFim = parseLocalDate(ajusteForm.data_fim);

      // Collect all unique equipment with their latest values
      const equipMap = new Map<string, { valor_hora: number; valor_hora_excedente: number; hora_minima: number; horas_contratadas: number }>();

      // Base contract equipment
      const ces = getContratoEquipamentos(ajustesContrato);
      ces.forEach(ce => {
        // Check if equipment is active within the adjustment period
        const entrega = ce.data_entrega ? parseLocalDate(ce.data_entrega) : null;
        const devolucao = ce.data_devolucao ? parseLocalDate(ce.data_devolucao) : null;
        // Equipment is active if: entrega <= ajFim AND (no devolucao OR devolucao >= ajInicio)
        if (entrega && entrega > ajFim) return;
        if (devolucao && devolucao < ajInicio) return;
        equipMap.set(ce.equipamento_id, {
          valor_hora: Number(ce.valor_hora),
          valor_hora_excedente: Number(ce.valor_hora_excedente),
          hora_minima: Number(ce.hora_minima),
          horas_contratadas: Number(ce.horas_contratadas),
        });
      });

      // Aditivos equipment - override or add new equipment
      const contratoAditivos = aditivos.filter(a => a.contrato_id === ajustesContrato.id);
      contratoAditivos.sort((a, b) => a.numero - b.numero);
      contratoAditivos.forEach(aditivo => {
        const adInicio = parseLocalDate(aditivo.data_inicio);
        const adFim = parseLocalDate(aditivo.data_fim);
        // Only consider aditivos whose period overlaps with the adjustment period
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

      const rows = Array.from(equipMap.entries()).map(([eqId, vals]) => ({
        contrato_id: ajustesContrato.id,
        equipamento_id: eqId,
        valor_hora: ajusteCampos.valor_hora ? Number(ajusteForm.valor_hora) : vals.valor_hora,
        valor_hora_excedente: ajusteCampos.valor_hora_excedente ? Number(ajusteForm.valor_hora_excedente) : vals.valor_hora_excedente,
        hora_minima: ajusteCampos.hora_minima ? Number(ajusteForm.hora_minima) : vals.hora_minima,
        horas_contratadas: ajusteCampos.horas_contratadas ? Number(ajusteForm.horas_contratadas) : vals.horas_contratadas,
        data_inicio: ajusteForm.data_inicio,
        data_fim: ajusteForm.data_fim,
        motivo: ajusteForm.motivo ? `[LOTE] ${ajusteForm.motivo}` : "[LOTE]",
      }));
      const { error } = await supabase.from("contratos_equipamentos_ajustes").insert(rows);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      // Individual
      const payload = {
        contrato_id: ajustesContrato.id,
        equipamento_id: ajusteForm.equipamento_id,
        valor_hora: Number(ajusteForm.valor_hora),
        valor_hora_excedente: Number(ajusteForm.valor_hora_excedente),
        hora_minima: Number(ajusteForm.hora_minima),
        horas_contratadas: Number(ajusteForm.horas_contratadas),
        data_inicio: ajusteForm.data_inicio,
        data_fim: ajusteForm.data_fim,
        motivo: ajusteForm.motivo,
      };
      const { error } = await supabase.from("contratos_equipamentos_ajustes").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setAjusteFormOpen(false);
    openAjustes(ajustesContrato);
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

  const openNewAditivo = () => {
    setEditingAditivo(null);
    const nextNumero = aditivos.length > 0 ? Math.max(...aditivos.map(a => a.numero)) + 1 : 1;

    // Se existem aditivos anteriores, herdar equipamentos do último aditivo
    const sortedAditivos = [...aditivos].sort((a, b) => b.numero - a.numero);
    const ultimoAditivo = sortedAditivos.length > 0 ? sortedAditivos[0] : null;

    let equipamentosBase: FormEquipItem[];
    if (ultimoAditivo && ultimoAditivo.aditivos_equipamentos && ultimoAditivo.aditivos_equipamentos.length > 0) {
      // Herdar do último aditivo
      equipamentosBase = ultimoAditivo.aditivos_equipamentos.map(ae => ({
        equipamento_id: ae.equipamento_id,
        valor_hora: Number(ae.valor_hora),
        horas_contratadas: Number(ae.horas_contratadas),
        valor_hora_excedente: Number(ae.valor_hora_excedente),
        hora_minima: Number(ae.hora_minima),
        data_entrega: ae.data_entrega || "",
        data_devolucao: ae.data_devolucao || "",
      }));
    } else {
      // Herdar do contrato original
      const ces = ajustesContrato ? getContratoEquipamentos(ajustesContrato) : [];
      equipamentosBase = ces.map(ce => ({
        equipamento_id: ce.equipamento_id,
        valor_hora: Number(ce.valor_hora),
        horas_contratadas: Number(ce.horas_contratadas),
        valor_hora_excedente: Number(ce.valor_hora_excedente),
        hora_minima: Number(ce.hora_minima),
        data_entrega: ce.data_entrega || "",
        data_devolucao: ce.data_devolucao || "",
      }));
    }

    setAditivoForm({
      numero: nextNumero,
      data_inicio: "",
      data_fim: ajustesContrato?.data_fim || "",
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
      const { data, error } = await supabase.from("contratos_aditivos").insert(payload).select("id").single();
      if (error || !data) { toast({ title: "Erro", description: error?.message || "Erro ao criar aditivo", variant: "destructive" }); return; }
      aditivoId = data.id;
    }

    const eqRows = aditivoForm.equipamentos.map(fe => ({
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

    setAditivoFormOpen(false);
    toast({ title: "Sucesso", description: editingAditivo ? "Aditivo atualizado." : "Aditivo criado." });
    fetchAditivos(ajustesContrato.id);
  };

  const handleDeleteAditivo = async (id: string) => {
    const { error } = await supabase.from("contratos_aditivos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (ajustesContrato) fetchAditivos(ajustesContrato.id);
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

  // Summary totals for dashboard
  const dashboardTotals = {
    totalContratado: equipUsages.reduce((s, u) => s + u.custo_contratado, 0),
    totalReal: equipUsages.reduce((s, u) => s + u.custo_real, 0),
    totalHorasContratadas: equipUsages.reduce((s, u) => s + u.horas_contratadas, 0),
    totalHorasUtilizadas: equipUsages.reduce((s, u) => s + u.horas_utilizadas, 0),
    alertCount: equipUsages.filter(u => u.percentual >= 80).length,
  };

  return (
    <Layout>
      <Tabs defaultValue="contratos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="contratos" className="gap-2"><FileText className="h-4 w-4" /> Contratos</TabsTrigger>
          <TabsTrigger value="propostas" className="gap-2"><FileSignature className="h-4 w-4" /> Propostas Comerciais</TabsTrigger>
        </TabsList>
        <TabsContent value="contratos">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
            <p className="text-sm text-muted-foreground">{items.length} contratos cadastrados{selected.size > 0 && ` · ${selected.size} selecionado(s)`}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportDetailedPDF}>
              <FileDown className="h-4 w-4 mr-1" /> PDF Detalhado
            </Button>
            <Button variant="outline" size="sm" onClick={exportSimplePDF}>
              <FileDown className="h-4 w-4 mr-1" /> PDF Simples
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Novo Contrato
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar contratos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Equipamentos</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const ces = getContratoEquipamentos(item);
                  return (
                    <TableRow key={item.id} className={selected.has(item.id) ? "bg-accent/5" : ""}>
                      <TableCell><Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} /></TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{item.empresas?.nome}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.empresas?.cnpj}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <button className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors cursor-pointer">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {(() => {
                                const hoje = new Date().toISOString().slice(0, 10);
                                const allAditivos = (aditivosPorContrato[item.id] || []);
                                // Find the latest addendum (highest numero) that is currently active or most recent
                                const vigentes = allAditivos.filter(ad => ad.data_inicio <= hoje && ad.data_fim >= hoje);
                                const ultimoAditivo = vigentes.length > 0
                                  ? vigentes.reduce((latest, ad) => ad.numero > latest.numero ? ad : latest, vigentes[0])
                                  : null;
                                
                                if (ultimoAditivo) {
                                  // Count only from the last active addendum
                                  return (ultimoAditivo.aditivos_equipamentos || [])
                                    .filter((ae: any) => !ae.data_devolucao || ae.data_devolucao > hoje).length;
                                }
                                // No active addendum — use base contract
                                return ces.filter(ce => !ce.data_devolucao || ce.data_devolucao > hoje).length;
                              })()} equipamento(s)
                              {(aditivosPorContrato[item.id] || []).length > 0 && (
                                <Badge variant="outline" className="text-[10px]">{(aditivosPorContrato[item.id] || []).length} aditivo(s)</Badge>
                              )}
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-96 max-h-80 overflow-y-auto" align="start">
                            <div className="space-y-2">
                              {(() => {
                                const hoje = new Date().toISOString().slice(0, 10);
                                const allAditivos = (aditivosPorContrato[item.id] || []);
                                const vigentes = allAditivos.filter(ad => ad.data_inicio <= hoje && ad.data_fim >= hoje);
                                const ultimoAditivo = vigentes.length > 0
                                  ? vigentes.reduce((latest, ad) => ad.numero > latest.numero ? ad : latest, vigentes[0])
                                  : null;

                                if (ultimoAditivo) {
                                  // Show only the last active addendum's equipment
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
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {parseLocalDate(item.data_inicio).toLocaleDateString("pt-BR")} - {parseLocalDate(item.data_fim).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell><Badge className={statusColor(item.status)}>{item.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openAjustesWithAditivos(item)} title="Ajustes e Aditivos">
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDashboard(item)} title="Dashboard de uso">
                            <BarChart3 className="h-4 w-4 text-accent" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum contrato encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Dialog */}
      <Dialog open={dashboardOpen} onOpenChange={setDashboardOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Dashboard de Uso — {dashboardContrato?.empresas?.nome}
            </DialogTitle>
            <DialogDescription>
              Período: {dashboardContrato ? `${parseLocalDate(dashboardContrato.data_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(dashboardContrato.data_fim).toLocaleDateString("pt-BR")}` : ""}
            </DialogDescription>
          </DialogHeader>

          {dashboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
            </div>
          ) : (
            <div className="space-y-6">
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

                      <div className="grid grid-cols-3 gap-2 text-center">
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                options={empresas.map((e) => ({ value: e.id, label: `${e.nome} — ${e.cnpj}` }))}
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
                  options={availableEquipamentos.map((e) => ({ value: e.id, label: `${e.tipo} ${e.modelo} ${e.tag_placa ? `(${e.tag_placa})` : ""}` }))}
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
                            <Label className="text-xs text-muted-foreground">Valor/Hora (R$)</Label>
                            <Input type="number" value={fe.valor_hora || ""} onChange={(e) => updateEquipItem(fe.equipamento_id, "valor_hora", Number(e.target.value))} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Valor Hora Excedente (R$)</Label>
                            <Input type="number" value={fe.valor_hora_excedente || ""} onChange={(e) => updateEquipItem(fe.equipamento_id, "valor_hora_excedente", Number(e.target.value))} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Horas Contratadas</Label>
                            <Input type="number" value={fe.horas_contratadas || ""} onChange={(e) => updateEquipItem(fe.equipamento_id, "horas_contratadas", Number(e.target.value))} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Hora Mínima</Label>
                            <Input type="number" value={fe.hora_minima || ""} onChange={(e) => updateEquipItem(fe.equipamento_id, "hora_minima", Number(e.target.value))} className="h-8 text-sm" placeholder="0 = sem mínimo" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Data de Entrega</Label>
                            <Input type="date" value={fe.data_entrega || ""} onChange={(e) => updateEquipItemStr(fe.equipamento_id, "data_entrega", e.target.value)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Data de Devolução</Label>
                            <Input type="date" value={fe.data_devolucao || ""} onChange={(e) => updateEquipItemStr(fe.equipamento_id, "data_devolucao", e.target.value)} className="h-8 text-sm" />
                          </div>
                        </div>
                        {fe.hora_minima > 0 && (
                          <div className="mt-1">
                            <p className="text-xs text-muted-foreground">Se trabalhar menos de <strong>{fe.hora_minima}h</strong>, será cobrado o valor de {fe.hora_minima}h</p>
                          </div>
                        )}
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

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label>Data Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-accent" />
              Gestão do Contrato — {ajustesContrato?.empresas?.nome}
            </DialogTitle>
            <DialogDescription>
              Gerencie ajustes temporários e aditivos contratuais.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="ajustes" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="ajustes" className="flex-1">Ajustes Temporários</TabsTrigger>
              <TabsTrigger value="aditivos" className="flex-1">Aditivos</TabsTrigger>
            </TabsList>

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
                  const ces = ajustesContrato ? getContratoEquipamentos(ajustesContrato) : [];
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
                            {changedFields.map(f => (
                              <Badge key={f} variant="outline" className="text-xs bg-accent/10 border-accent/30">{f}</Badge>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Período:</span> <span className="font-medium">{parseLocalDate(aj.data_inicio).toLocaleDateString("pt-BR")} - {parseLocalDate(aj.data_fim).toLocaleDateString("pt-BR")}</span></div>
                            {changedFields.includes("Valor/Hora") && <div><span className="text-muted-foreground">Valor/h:</span> <span className="font-medium">{fmt(aj.valor_hora)}</span></div>}
                            {changedFields.includes("Hora Mínima") && <div><span className="text-muted-foreground">Hora Mín:</span> <span className="font-medium">{aj.hora_minima}h</span></div>}
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
                            {indivChanges.map(f => (
                              <Badge key={f} variant="outline" className="text-xs bg-accent/10 border-accent/30">{f}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Período:</span> <span className="font-medium">{parseLocalDate(aj.data_inicio).toLocaleDateString("pt-BR")} - {parseLocalDate(aj.data_fim).toLocaleDateString("pt-BR")}</span></div>
                          {(indivChanges.length === 0 || indivChanges.includes("Valor/Hora")) && <div><span className="text-muted-foreground">Valor/h:</span> <span className="font-medium">{fmt(aj.valor_hora)}</span></div>}
                          {(indivChanges.length === 0 || indivChanges.includes("Hora Mínima")) && <div><span className="text-muted-foreground">Hora Mín:</span> <span className="font-medium">{aj.hora_minima}h</span></div>}
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
                  const inicio = new Date(ad.data_inicio);
                  const fim = new Date(ad.data_fim);
                  const ativo = hoje >= inicio && hoje <= fim;
                  const futuro = hoje < inicio;
                  const passado = hoje > fim;
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
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Vigência:</span> <span className="font-medium">{parseLocalDate(ad.data_inicio).toLocaleDateString("pt-BR")} - {parseLocalDate(ad.data_fim).toLocaleDateString("pt-BR")}</span></div>
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
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Ajuste Form Dialog */}
      <Dialog open={ajusteFormOpen} onOpenChange={setAjusteFormOpen}>
        <DialogContent className="sm:max-w-md">
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
            {ajusteTodos && !editingAjuste && (
              <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                <Label className="text-sm font-medium">Quais campos deseja alterar?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={ajusteCampos.valor_hora} onCheckedChange={(v) => setAjusteCampos(prev => ({ ...prev, valor_hora: !!v }))} />
                    Valor/Hora
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={ajusteCampos.valor_hora_excedente} onCheckedChange={(v) => setAjusteCampos(prev => ({ ...prev, valor_hora_excedente: !!v }))} />
                    Valor Hora Excedente
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={ajusteCampos.hora_minima} onCheckedChange={(v) => setAjusteCampos(prev => ({ ...prev, hora_minima: !!v }))} />
                    Hora Mínima
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={ajusteCampos.horas_contratadas} onCheckedChange={(v) => setAjusteCampos(prev => ({ ...prev, horas_contratadas: !!v }))} />
                    Horas Contratadas
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Campos não selecionados manterão os valores originais de cada equipamento</p>
              </div>
            )}
            {!ajusteTodos && (
            <div>
              <Label>Equipamento</Label>
              <SearchableSelect
                value={ajusteForm.equipamento_id}
                onValueChange={(v) => {
                  const ces = ajustesContrato ? getContratoEquipamentos(ajustesContrato) : [];
                  const ce = ces.find(c => c.equipamento_id === v);
                  setAjusteForm(prev => ({
                    ...prev,
                    equipamento_id: v,
                    valor_hora: ce ? Number(ce.valor_hora) : prev.valor_hora,
                    valor_hora_excedente: ce ? Number(ce.valor_hora_excedente) : prev.valor_hora_excedente,
                    hora_minima: ce ? Number(ce.hora_minima) : prev.hora_minima,
                    horas_contratadas: ce ? Number(ce.horas_contratadas) : prev.horas_contratadas,
                  }));
                }}
                placeholder="Selecione o equipamento"
                searchPlaceholder="Pesquisar equipamento..."
                options={(ajustesContrato ? getContratoEquipamentos(ajustesContrato) : []).map(ce => ({
                  value: ce.equipamento_id,
                  label: `${ce.equipamentos.tipo} ${ce.equipamentos.modelo} ${ce.equipamentos.tag_placa ? `(${ce.equipamentos.tag_placa})` : ""}`,
                }))}
              />
            </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Início</Label><Input type="date" value={ajusteForm.data_inicio} onChange={(e) => setAjusteForm(prev => ({ ...prev, data_inicio: e.target.value }))} /></div>
              <div><Label>Data Fim</Label><Input type="date" value={ajusteForm.data_fim} onChange={(e) => setAjusteForm(prev => ({ ...prev, data_fim: e.target.value }))} /></div>
            </div>
            {ajusteTodos && ajusteForm.data_inicio && ajusteForm.data_fim && (() => {
              const ajInicio = parseLocalDate(ajusteForm.data_inicio);
              const ajFim = parseLocalDate(ajusteForm.data_fim);
              const equipIds = new Set<string>();
              const ces = ajustesContrato ? getContratoEquipamentos(ajustesContrato) : [];
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
            <div className="grid grid-cols-2 gap-3">
              <div className={ajusteTodos && !ajusteCampos.valor_hora ? "opacity-40 pointer-events-none" : ""}><Label>Valor/Hora (R$)</Label><Input type="number" value={ajusteForm.valor_hora || ""} onChange={(e) => setAjusteForm(prev => ({ ...prev, valor_hora: Number(e.target.value) }))} /></div>
              <div className={ajusteTodos && !ajusteCampos.valor_hora_excedente ? "opacity-40 pointer-events-none" : ""}><Label>Valor Hora Excedente (R$)</Label><Input type="number" value={ajusteForm.valor_hora_excedente || ""} onChange={(e) => setAjusteForm(prev => ({ ...prev, valor_hora_excedente: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={ajusteTodos && !ajusteCampos.hora_minima ? "opacity-40 pointer-events-none" : ""}><Label>Hora Mínima</Label><Input type="number" value={ajusteForm.hora_minima || ""} onChange={(e) => setAjusteForm(prev => ({ ...prev, hora_minima: Number(e.target.value) }))} placeholder="0 = sem mínimo" /></div>
              <div className={ajusteTodos && !ajusteCampos.horas_contratadas ? "opacity-40 pointer-events-none" : ""}><Label>Horas Contratadas</Label><Input type="number" value={ajusteForm.horas_contratadas || ""} onChange={(e) => setAjusteForm(prev => ({ ...prev, horas_contratadas: Number(e.target.value) }))} /></div>
            </div>
            <div><Label>Motivo</Label><Input value={ajusteForm.motivo} onChange={(e) => setAjusteForm(prev => ({ ...prev, motivo: e.target.value }))} placeholder="Ex: Reajuste temporário por demanda extra" /></div>
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
              {ajustesContrato && `Contrato: ${ajustesContrato.empresas?.nome || ''}`}
            </DialogDescription>
          </DialogHeader>


          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-3">
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
                options={equipamentos.filter(e => !aditivoForm.equipamentos.some(fe => fe.equipamento_id === e.id)).map(e => ({ value: e.id, label: `${e.tipo} ${e.modelo} ${e.tag_placa ? `(${e.tag_placa})` : ""}` }))}
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
                            <Input type="number" value={fe.valor_hora || ""} onChange={(e) => updateAditivoEquipItem(fe.equipamento_id, "valor_hora", Number(e.target.value))} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Valor Hora Excedente (R$)</Label>
                            <Input type="number" value={fe.valor_hora_excedente || ""} onChange={(e) => updateAditivoEquipItem(fe.equipamento_id, "valor_hora_excedente", Number(e.target.value))} className="h-8 text-sm" />
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
                        <div className="grid grid-cols-2 gap-3">
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
        </TabsContent>
        <TabsContent value="propostas">
          <PropostasContent />
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default Contratos;
