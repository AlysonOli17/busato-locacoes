import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { getEquipLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CurrencyInput } from "@/components/CurrencyInput";
import { SortableTableHead } from "@/components/SortableTableHead";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDown, Settings, Pencil, Trash2 } from "lucide-react";
import { addLetterhead } from "@/lib/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Equipamento {
  id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null;
}

interface Agregado {
  id: string;
  equipamento_id: string;
  data: string;
  os: string;
  complementar: string;
  pde: string;
  tipo: string;
  matricula: string;
  observacoes: string | null;
  equipamentos: Equipamento;
}

interface CustoAgregado {
  id: string;
  equipamento_id: string;
  data: string;
  valor: number;
  os_numero_compra: string;
  observacoes: string | null;
}

interface ValorDiaria {
  id: string;
  tipo_equipamento: string;
  valor_diaria: number;
}

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MedicaoAgregadoTab = () => {
  const [diarias, setDiarias] = useState<Agregado[]>([]);
  const [custos, setCustos] = useState<CustoAgregado[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [valoresDiaria, setValoresDiaria] = useState<ValorDiaria[]>([]);
  const [filterEquip, setFilterEquip] = useState("Todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [sortCol, setSortCol] = useState<string>("equipamento");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedEquips, setSelectedEquips] = useState<Set<string>>(new Set());

  // Dialog for managing valores
  const [valoresDialogOpen, setValoresDialogOpen] = useState(false);
  const [editingValor, setEditingValor] = useState<ValorDiaria | null>(null);
  const [valorForm, setValorForm] = useState({ tipo_equipamento: "", valor_diaria: 0 });

  const { toast } = useToast();

  const fetchData = async () => {
    const [agRes, custosRes, equipRes, valoresRes] = await Promise.all([
      supabase.from("agregados").select("*, equipamentos(id, tipo, modelo, tag_placa, numero_serie)").order("data", { ascending: false }),
      supabase.from("custos_agregados").select("id, equipamento_id, data, valor, os_numero_compra, observacoes").order("data", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
      supabase.from("valores_diaria_agregado").select("*"),
    ]);
    if (agRes.data) setDiarias(agRes.data as unknown as Agregado[]);
    if (custosRes.data) setCustos(custosRes.data);
    if (equipRes.data) setEquipamentos(equipRes.data);
    if (valoresRes.data) setValoresDiaria(valoresRes.data as ValorDiaria[]);
  };

  useEffect(() => { fetchData(); }, []);

  const hasFilters = filterEquip !== "Todos" || dataInicio || dataFim;
  const clearFilters = () => { setFilterEquip("Todos"); setDataInicio(undefined); setDataFim(undefined); };

  // Filtered diarias
  const filteredDiarias = useMemo(() => {
    return diarias.filter(i => {
      if (filterEquip !== "Todos" && i.equipamento_id !== filterEquip) return false;
      const d = parseLocalDate(i.data);
      if (dataInicio && d < dataInicio) return false;
      if (dataFim) { const fim = new Date(dataFim); fim.setHours(23, 59, 59, 999); if (d > fim) return false; }
      return true;
    });
  }, [diarias, filterEquip, dataInicio, dataFim]);

  // Filtered custos
  const filteredCustos = useMemo(() => {
    return custos.filter(i => {
      if (filterEquip !== "Todos" && i.equipamento_id !== filterEquip) return false;
      const d = parseLocalDate(i.data);
      if (dataInicio && d < dataInicio) return false;
      if (dataFim) { const fim = new Date(dataFim); fim.setHours(23, 59, 59, 999); if (d > fim) return false; }
      return true;
    });
  }, [custos, filterEquip, dataInicio, dataFim]);

  // Valor diaria map by tipo_equipamento
  const valorMap = useMemo(() => {
    const map = new Map<string, number>();
    valoresDiaria.forEach(v => map.set(v.tipo_equipamento, v.valor_diaria));
    return map;
  }, [valoresDiaria]);

  // Build summary by equipment
  const summaryData = useMemo(() => {
    const map = new Map<string, {
      equipId: string;
      tipo: string;
      modelo: string;
      tag: string;
      serie: string;
      totalDiarias: number;
      valorDiaria: number;
      valorDiariasTotal: number;
      totalCustos: number;
      valorTotal: number;
    }>();

    // Count diarias per equipment
    const diariasByEquip = new Map<string, Set<string>>();
    const equipInfo = new Map<string, Equipamento>();
    filteredDiarias.forEach(d => {
      const eqId = d.equipamento_id;
      if (!diariasByEquip.has(eqId)) diariasByEquip.set(eqId, new Set());
      diariasByEquip.get(eqId)!.add(`${d.data}||${d.os || ""}`);
      if (d.equipamentos) equipInfo.set(eqId, d.equipamentos);
    });

    // Sum custos per equipment
    const custosByEquip = new Map<string, number>();
    filteredCustos.forEach(c => {
      custosByEquip.set(c.equipamento_id, (custosByEquip.get(c.equipamento_id) || 0) + c.valor);
    });

    // Merge all equipment IDs
    const allEquipIds = new Set([...diariasByEquip.keys(), ...custosByEquip.keys()]);

    allEquipIds.forEach(eqId => {
      const eq = equipInfo.get(eqId) || equipamentos.find(e => e.id === eqId);
      if (!eq) return;
      const totalDiarias = diariasByEquip.get(eqId)?.size || 0;
      const vd = valorMap.get(eq.tipo) || 0;
      const valorDiariasTotal = totalDiarias * vd;
      const totalCustos = custosByEquip.get(eqId) || 0;
      map.set(eqId, {
        equipId: eqId,
        tipo: eq.tipo,
        modelo: eq.modelo,
        tag: eq.tag_placa || "—",
        serie: eq.numero_serie || "—",
        totalDiarias,
        valorDiaria: vd,
        valorDiariasTotal,
        totalCustos,
        valorTotal: valorDiariasTotal + totalCustos,
      });
    });

    return map;
  }, [filteredDiarias, filteredCustos, valorMap, equipamentos]);

  const sortedSummary = useMemo(() => {
    const arr = Array.from(summaryData.values());
    return arr.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "equipamento": cmp = `${a.tipo} ${a.modelo}`.localeCompare(`${b.tipo} ${b.modelo}`); break;
        case "tag": cmp = a.tag.localeCompare(b.tag); break;
        case "diarias": cmp = a.totalDiarias - b.totalDiarias; break;
        case "valor_diaria": cmp = a.valorDiaria - b.valorDiaria; break;
        case "valor_diarias": cmp = a.valorDiariasTotal - b.valorDiariasTotal; break;
        case "custos": cmp = a.totalCustos - b.totalCustos; break;
        case "total": cmp = a.valorTotal - b.valorTotal; break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [summaryData, sortCol, sortAsc]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const toggleSelectEquip = (id: string) => {
    setSelectedEquips(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEquips.size === sortedSummary.length) setSelectedEquips(new Set());
    else setSelectedEquips(new Set(sortedSummary.map(r => r.equipId)));
  };

  const pdfItems = selectedEquips.size > 0
    ? sortedSummary.filter(r => selectedEquips.has(r.equipId))
    : sortedSummary;

  const totalGeralDiarias = pdfItems.reduce((s, r) => s + r.totalDiarias, 0);
  const totalGeralValorDiarias = pdfItems.reduce((s, r) => s + r.valorDiariasTotal, 0);
  const totalGeralCustos = pdfItems.reduce((s, r) => s + r.totalCustos, 0);
  const totalGeral = pdfItems.reduce((s, r) => s + r.valorTotal, 0);

  // Unique equipment types from equipamentos
  const tiposEquipamento = useMemo(() => {
    const set = new Set<string>();
    equipamentos.forEach(e => set.add(e.tipo));
    return Array.from(set).sort();
  }, [equipamentos]);

  // Valores dialog handlers
  const handleSaveValor = async () => {
    if (!valorForm.tipo_equipamento) {
      toast({ title: "Selecione o tipo de equipamento", variant: "destructive" });
      return;
    }
    if (editingValor) {
      const { error } = await supabase.from("valores_diaria_agregado").update({
        tipo_equipamento: valorForm.tipo_equipamento,
        valor_diaria: valorForm.valor_diaria,
        updated_at: new Date().toISOString(),
      }).eq("id", editingValor.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Valor atualizado" });
    } else {
      const { error } = await supabase.from("valores_diaria_agregado").upsert({
        tipo_equipamento: valorForm.tipo_equipamento,
        valor_diaria: valorForm.valor_diaria,
      }, { onConflict: "tipo_equipamento" });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Valor registrado" });
    }
    setEditingValor(null);
    setValorForm({ tipo_equipamento: "", valor_diaria: 0 });
    fetchData();
  };

  const handleDeleteValor = async (id: string) => {
    await supabase.from("valores_diaria_agregado").delete().eq("id", id);
    fetchData();
  };

  const openEditValor = (v: ValorDiaria) => {
    setEditingValor(v);
    setValorForm({ tipo_equipamento: v.tipo_equipamento, valor_diaria: v.valor_diaria });
  };

  // PDF export
  const exportPDF = async () => {
    const periodo = dataInicio && dataFim ? `${format(dataInicio, "dd/MM/yyyy")} a ${format(dataFim, "dd/MM/yyyy")}` : "";
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginLeft = 14;
    const marginRight = 14;

    const titleText = periodo
      ? `BOLETIM DE MEDIÇÃO AGREGADO ${format(dataInicio!, "dd/MM/yyyy")} - ${format(dataFim!, "dd/MM/yyyy")}`
      : "BOLETIM DE MEDIÇÃO AGREGADO";

    const startY = await addLetterhead(doc, titleText);
    let y = startY;

    if (periodo) {
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Período: ${periodo}`, marginLeft, y);
      y += 6;
    }

    // Summary table
    const selectedIds = selectedEquips.size > 0 ? selectedEquips : new Set(sortedSummary.map(r => r.equipId));
    const exportItems = sortedSummary.filter(r => selectedIds.has(r.equipId));
    const exportCustos = filteredCustos.filter(c => selectedIds.has(c.equipamento_id));

    const headers = ["Equipamento", "Tag/Placa", "Nº Série", "Diárias", "V/Diária", "Total Diárias", "Custos", "Valor Total"];
    const rows = exportItems.map(r => [
      `${r.tipo} ${r.modelo}`,
      r.tag,
      r.serie,
      String(r.totalDiarias),
      `R$ ${fmt(r.valorDiaria)}`,
      `R$ ${fmt(r.valorDiariasTotal)}`,
      `R$ ${fmt(r.totalCustos)}`,
      `R$ ${fmt(r.valorTotal)}`,
    ]);

    const expDiarias = exportItems.reduce((s, r) => s + r.totalDiarias, 0);
    const expValDiarias = exportItems.reduce((s, r) => s + r.valorDiariasTotal, 0);
    const expCustos = exportItems.reduce((s, r) => s + r.totalCustos, 0);
    const expTotal = exportItems.reduce((s, r) => s + r.valorTotal, 0);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", halign: "center" },
      columnStyles: {
        3: { halign: "center" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
        6: { halign: "right" },
        7: { halign: "right", fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      foot: [["TOTAL GERAL", "", "", String(expDiarias), "", `R$ ${fmt(expValDiarias)}`, `R$ ${fmt(expCustos)}`, `R$ ${fmt(expTotal)}`]],
      footStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 9 },
      theme: "grid",
      margin: { left: marginLeft, right: marginRight },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Detail: custos per equipment (if any)
    if (exportCustos.length > 0) {
      if (y > pageH - 60) { doc.addPage(); y = 20; }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("DETALHAMENTO DE CUSTOS", marginLeft, y);
      y += 3;

      const custosHeaders = ["Equipamento", "Data", "OS / Nº Compra", "Valor", "Observações"];
      const custosRows = exportCustos.map(c => {
        const eq = equipamentos.find(e => e.id === c.equipamento_id);
        return [
          eq ? `${eq.tipo} ${eq.modelo}` : "—",
          format(parseLocalDate(c.data), "dd/MM/yyyy"),
          c.os_numero_compra || "—",
          `R$ ${fmt(c.valor)}`,
          c.observacoes || "—",
        ];
      });

      autoTable(doc, {
        head: [custosHeaders],
        body: custosRows,
        startY: y,
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: "bold", halign: "center" },
        columnStyles: { 3: { halign: "right", fontStyle: "bold" }, 4: { cellWidth: 80 } },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        theme: "grid",
        margin: { left: marginLeft, right: marginRight },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Signature block
    const sigBlockH = 50;
    if (y > pageH - sigBlockH - 15) { doc.addPage(); y = 20; }
    y += 10;

    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.4);
    const colW = (pageW - marginLeft - marginRight) / 2;
    const lineY = y + 25;
    const nameY = lineY + 5;

    doc.line(marginLeft + 10, lineY, marginLeft + colW - 10, lineY);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("CONTRATANTE", marginLeft + colW / 2, nameY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("Assinatura / Carimbo", marginLeft + colW / 2, nameY + 4, { align: "center" });

    const rightStart = marginLeft + colW;
    doc.setDrawColor(100, 100, 100);
    doc.line(rightStart + 10, lineY, rightStart + colW - 10, lineY);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("BUSATO LOCAÇÃO", rightStart + colW / 2, nameY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("Assinatura / Carimbo", rightStart + colW / 2, nameY + 4, { align: "center" });

    // Page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${totalPages}`, pageW - marginRight, pageH - 8, { align: "right" });
    }

    doc.save(`boletim_medicao_agregado_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const equipOptions = [
    { value: "Todos", label: "Todos os Equipamentos" },
    ...equipamentos.map(e => ({ value: e.id, label: getEquipLabel(e) })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Medição - Agregados</h1>
          <p className="text-sm text-muted-foreground">Consolidação de diárias e custos por período</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditingValor(null); setValorForm({ tipo_equipamento: "", valor_diaria: 0 }); setValoresDialogOpen(true); }}>
            <Settings className="h-4 w-4 mr-1" /> Valores Diária
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileDown className="h-4 w-4 mr-1" /> Exportar Medição{selectedEquips.size > 0 ? ` (${selectedEquips.size})` : ""}
          </Button>
          {selectedEquips.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedEquips(new Set())} className="text-muted-foreground text-xs">
              Limpar seleção
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">Filtros / Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Equipamento</Label>
              <SearchableSelect value={filterEquip} onValueChange={setFilterEquip} placeholder="Todos" className="w-64" options={equipOptions} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Inicial</Label>
              <Input type="date" className="w-48" value={dataInicio ? format(dataInicio, "yyyy-MM-dd") : ""} onChange={e => setDataInicio(e.target.value ? parseLocalDate(e.target.value) : undefined)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Final</Label>
              <Input type="date" className="w-48" value={dataFim ? format(dataFim, "yyyy-MM-dd") : ""} onChange={e => setDataFim(e.target.value ? parseLocalDate(e.target.value) : undefined)} />
            </div>
            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">Limpar filtros</Button>}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {hasFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs font-medium text-muted-foreground">Total Diárias</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-lg font-bold text-sidebar">{totalGeralDiarias}</div>
              <p className="text-[10px] text-muted-foreground">R$ {fmt(totalGeralValorDiarias)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs font-medium text-muted-foreground">Total Custos</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-lg font-bold text-destructive">R$ {fmt(totalGeralCustos)}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs font-medium text-muted-foreground">Valor Total</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-2xl font-bold text-primary">R$ {fmt(totalGeral)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs font-medium text-muted-foreground">Equipamentos</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-lg font-bold">{sortedSummary.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedEquips.size === sortedSummary.length && sortedSummary.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <SortableTableHead column="equipamento" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Equipamento</SortableTableHead>
                <SortableTableHead column="tag" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Tag/Placa</SortableTableHead>
                <TableHead>Nº Série</TableHead>
                <SortableTableHead column="diarias" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Diárias</SortableTableHead>
                <SortableTableHead column="valor_diaria" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>V/Diária</SortableTableHead>
                <SortableTableHead column="valor_diarias" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Total Diárias</SortableTableHead>
                <SortableTableHead column="custos" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Custos</SortableTableHead>
                <SortableTableHead column="total" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Valor Total</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSummary.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum dado encontrado. Selecione um período.</TableCell></TableRow>
              ) : (
                <>
                  {sortedSummary.map(row => (
                    <TableRow key={row.equipId} className={selectedEquips.has(row.equipId) ? "bg-accent/10" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEquips.has(row.equipId)}
                          onCheckedChange={() => toggleSelectEquip(row.equipId)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{row.tipo} {row.modelo}</TableCell>
                      <TableCell className="font-mono text-sm">{row.tag}</TableCell>
                      <TableCell className="text-sm">{row.serie}</TableCell>
                      <TableCell className="text-center font-semibold">{row.totalDiarias}</TableCell>
                      <TableCell className="text-right text-sm">
                        {row.valorDiaria > 0 ? `R$ ${fmt(row.valorDiaria)}` : <span className="text-muted-foreground text-xs">Não definido</span>}
                      </TableCell>
                      <TableCell className="text-right font-semibold">R$ {fmt(row.valorDiariasTotal)}</TableCell>
                      <TableCell className="text-right text-sm">{row.totalCustos > 0 ? `R$ ${fmt(row.totalCustos)}` : "—"}</TableCell>
                      <TableCell className="text-right font-bold text-primary">R$ {fmt(row.valorTotal)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell />
                    <TableCell colSpan={3} className="font-bold">TOTAL {selectedEquips.size > 0 ? "SELECIONADOS" : "GERAL"}</TableCell>
                    <TableCell className="text-center font-bold">{totalGeralDiarias}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold">R$ {fmt(totalGeralValorDiarias)}</TableCell>
                    <TableCell className="text-right font-bold">R$ {fmt(totalGeralCustos)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">R$ {fmt(totalGeral)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Valores Diária Dialog */}
      <Dialog open={valoresDialogOpen} onOpenChange={v => { if (!v) setValoresDialogOpen(false); }}>
        <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle>Valores de Diária por Tipo de Equipamento</DialogTitle></DialogHeader>

          {/* List existing */}
          {valoresDiaria.length > 0 && (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de Equipamento</TableHead>
                    <TableHead>Valor Diária</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {valoresDiaria.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.tipo_equipamento}</TableCell>
                      <TableCell>R$ {fmt(v.valor_diaria)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditValor(v)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteValor(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-medium">{editingValor ? "Editar Valor" : "Novo Valor"}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de Equipamento</Label>
                <SearchableSelect
                  options={tiposEquipamento.map(t => ({ value: t, label: t }))}
                  value={valorForm.tipo_equipamento}
                  onValueChange={v => setValorForm(f => ({ ...f, tipo_equipamento: v }))}
                  placeholder="Selecione o tipo"
                />
              </div>
              <div>
                <Label>Valor da Diária</Label>
                <CurrencyInput value={valorForm.valor_diaria} onValueChange={v => setValorForm(f => ({ ...f, valor_diaria: v }))} />
              </div>
            </div>
            <div className="flex gap-2">
              {editingValor && (
                <Button variant="outline" size="sm" onClick={() => { setEditingValor(null); setValorForm({ tipo_equipamento: "", valor_diaria: 0 }); }}>Cancelar edição</Button>
              )}
              <Button size="sm" onClick={handleSaveValor}>{editingValor ? "Salvar" : "Adicionar"}</Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setValoresDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
