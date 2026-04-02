import { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { getEquipLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CalendarDays, FileBarChart, FileDown, Pencil, Trash2, Upload, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { addLetterhead } from "@/lib/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ExcelJS from "exceljs";
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

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const emptyForm = {
  equipamento_id: "",
  data: new Date().toISOString().split("T")[0],
  os: "",
  pde: "",
  matricula: "",
  observacoes: "",
};

export const AgregadoTab = () => {
  const [items, setItems] = useState<Agregado[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterEquip, setFilterEquip] = useState("Todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState<string>("data");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selected);
    const { error } = await supabase.from("agregados").delete().in("id", ids);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sucesso", description: `${ids.length} registro(s) excluído(s)` });
    setSelected(new Set());
    fetchData();
  };

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortAsc ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const fetchData = async () => {
    const [agRes, equipRes] = await Promise.all([
      supabase.from("agregados").select("*, equipamentos(id, tipo, modelo, tag_placa, numero_serie)").order("data", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
    ]);
    if (agRes.data) setItems(agRes.data as unknown as Agregado[]);
    if (equipRes.data) setEquipamentos(equipRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const f = items.filter((i) => {
      if (filterEquip !== "Todos" && i.equipamento_id !== filterEquip) return false;
      const itemDate = parseLocalDate(i.data);
      if (dataInicio && itemDate < dataInicio) return false;
      if (dataFim) { const fim = new Date(dataFim); fim.setHours(23, 59, 59, 999); if (itemDate > fim) return false; }
      return true;
    });
    return f.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "equipamento": cmp = (`${a.equipamentos?.tipo} ${a.equipamentos?.modelo}`).localeCompare(`${b.equipamentos?.tipo} ${b.equipamentos?.modelo}`); break;
        case "tag": cmp = (a.equipamentos?.tag_placa || "").localeCompare(b.equipamentos?.tag_placa || ""); break;
        case "data": cmp = a.data.localeCompare(b.data); break;
        case "os": cmp = (a.os || "").localeCompare(b.os || ""); break;
        case "pde": cmp = (a.pde || "").localeCompare(b.pde || ""); break;
        case "matricula": cmp = (a.matricula || "").localeCompare(b.matricula || ""); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [items, filterEquip, dataInicio, dataFim, sortCol, sortAsc]);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  };

  const summaryMap = useMemo(() => {
    const map = new Map<string, { totalDiarias: number; entries: number; label: string; tag: string }>();
    const equipEntries = new Map<string, Agregado[]>();
    filtered.forEach((m) => {
      const arr = equipEntries.get(m.equipamento_id) || [];
      arr.push(m);
      equipEntries.set(m.equipamento_id, arr);
    });
    equipEntries.forEach((entries, eqId) => {
      const first = entries[0];
      const label = `${first.equipamentos?.tipo} ${first.equipamentos?.modelo}`;
      const tag = first.equipamentos?.tag_placa || "";
      // Conta diárias: mesmo dia + mesma O.S. = 1 diária; O.S. diferente no mesmo dia = diárias separadas
      const uniqueDiarias = new Set(entries.map(e => `${e.data}||${e.os || ""}`));
      map.set(eqId, { totalDiarias: uniqueDiarias.size, entries: entries.length, label, tag });
    });
    return map;
  }, [filtered]);

  const totalDiariasGeral = Array.from(summaryMap.values()).reduce((acc, s) => acc + s.totalDiarias, 0);
  const hasFilters = filterEquip !== "Todos" || dataInicio || dataFim;

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, data: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  };

  const openEdit = (item: Agregado) => {
    setEditingId(item.id);
    setForm({
      equipamento_id: item.equipamento_id,
      data: item.data,
      os: item.os,
      pde: item.pde,
      matricula: item.matricula,
      observacoes: item.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipamento_id) {
      toast({ title: "Campo obrigatório", description: "Selecione um equipamento.", variant: "destructive" });
      return;
    }
    const payload = {
      equipamento_id: form.equipamento_id,
      data: form.data,
      os: form.os,
      pde: form.pde,
      matricula: form.matricula,
      observacoes: form.observacoes || null,
    };
    if (editingId) {
      const { error } = await supabase.from("agregados").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("agregados").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setDialogOpen(false);
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("agregados").delete().eq("id", deleteId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setDeleteId(null);
    fetchData();
  };

  const clearFilters = () => { setFilterEquip("Todos"); setDataInicio(undefined); setDataFim(undefined); };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Build lookup maps for equipment matching
  const normalizePlaca = (p: string) => p.replace(/[\s\-_.]/g, "").toUpperCase();

  const buildEquipMaps = () => {
    const placaMap = new Map<string, string>();
    const tipoModeloMap = new Map<string, string>();
    equipamentos.forEach(eq => {
      if (eq.tag_placa) placaMap.set(normalizePlaca(eq.tag_placa), eq.id);
      const key = `${eq.tipo} ${eq.modelo}`.trim().toUpperCase();
      if (!tipoModeloMap.has(key)) tipoModeloMap.set(key, eq.id);
      const tipoKey = eq.tipo.trim().toUpperCase();
      if (!tipoModeloMap.has(tipoKey)) tipoModeloMap.set(tipoKey, eq.id);
    });
    return { placaMap, tipoModeloMap };
  };

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Diárias Agregado");
    ws.columns = [
      { header: "O.S.", key: "os", width: 15 },
      { header: "PDE", key: "pde", width: 15 },
      { header: "Tipo (Equipamento)", key: "tipo_equip", width: 25 },
      { header: "Placa / Tag", key: "placa_tag", width: 18 },
      { header: "Matrícula", key: "matricula", width: 15 },
      { header: "Data", key: "data", width: 15 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      cell.alignment = { horizontal: "center" };
    });
    ws.addRow({ os: "OS-001", pde: "PDE-01", tipo_equip: "Escavadeira CAT 320", placa_tag: "ABC-1234", matricula: "12345", data: "01/01/2026" });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_diarias_agregado.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      if (!ws) { toast({ title: "Erro", description: "Planilha vazia.", variant: "destructive" }); return; }

      const { placaMap, tipoModeloMap } = buildEquipMaps();

      // Auto-detect columns by header names
      const headerRow = ws.getRow(1);
      const colMap: Record<string, number> = {};
      headerRow.eachCell((cell, colNum) => {
        const val = String(cell.value || "").trim().toUpperCase();
        if (val.includes("O.S") || val.includes("OS")) colMap.os = colNum;
        else if (val.includes("PDE")) colMap.pde = colNum;
        else if (val.includes("TIPO") || val.includes("EQUIPAMENTO") || val.includes("QQP")) colMap.tipo = colNum;
        else if (val.includes("PLACA") || val.includes("TAG")) colMap.placa = colNum;
        else if (val.includes("MATRIC")) colMap.matricula = colNum;
        else if (val.includes("DATA")) colMap.data = colNum;
        else if (val.includes("COMPLEMENTA")) colMap.complementar = colNum;
      });

      if (!colMap.placa && !colMap.tipo) {
        toast({ title: "Erro", description: "Não foi possível identificar as colunas de Placa/Tag ou Tipo no cabeçalho.", variant: "destructive" });
        return;
      }

      const rows: any[] = [];
      let skipped = 0;
      const skippedDetails: string[] = [];

      const cellStr = (row: ExcelJS.Row, col: number | undefined): string => {
        if (!col) return "";
        const val = row.getCell(col).value;
        if (val instanceof Date) return "";
        return String(val || "").trim();
      };

      const cellDate = (row: ExcelJS.Row, col: number | undefined): string => {
        if (!col) return "";
        const val = row.getCell(col).value;
        if (val instanceof Date) {
          // Use UTC components to avoid timezone offset shifting the date
          const y = val.getUTCFullYear();
          const m = String(val.getUTCMonth() + 1).padStart(2, "0");
          const d = String(val.getUTCDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
        if (typeof val === "string") {
          const parts = val.trim().split("/");
          if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          return val.trim();
        }
        if (typeof val === "number") {
          // Excel serial date number
          const epoch = new Date(Date.UTC(1899, 11, 30));
          const date = new Date(epoch.getTime() + val * 86400000);
          const y = date.getUTCFullYear();
          const m = String(date.getUTCMonth() + 1).padStart(2, "0");
          const d = String(date.getUTCDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
        return "";
      };

      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;

        const placaRaw = normalizePlaca(cellStr(row, colMap.placa));
        const tipoEquip = cellStr(row, colMap.tipo).toUpperCase();
        const os = cellStr(row, colMap.os);
        const pde = cellStr(row, colMap.pde);
        const matricula = cellStr(row, colMap.matricula);
        const dataStr = cellDate(row, colMap.data);

        // Resolve equipment: first by placa, then by tipo/modelo
        let eqId = placaRaw ? placaMap.get(placaRaw) : undefined;
        if (!eqId && tipoEquip) {
          eqId = tipoModeloMap.get(tipoEquip);
        }
        if (!eqId) {
          skipped++;
          skippedDetails.push(`Linha ${rowNum}: Placa "${placaRaw}" / Tipo "${tipoEquip}" não encontrado`);
          return;
        }

        if (!dataStr) { skipped++; return; }

        rows.push({ equipamento_id: eqId, data: dataStr, os, pde, matricula, observacoes: null });
      });

      if (rows.length === 0) {
        toast({ title: "Nenhum registro válido", description: `${skipped} linhas ignoradas.\n${skippedDetails.slice(0, 5).join("\n")}`, variant: "destructive" });
        return;
      }

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from("agregados").insert(batch);
        if (error) { toast({ title: "Erro ao importar", description: error.message, variant: "destructive" }); return; }
      }

      toast({ title: "Importação concluída", description: `${rows.length} registros importados.${skipped > 0 ? ` ${skipped} linhas ignoradas.` : ""}` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao ler arquivo", description: err.message || "Formato inválido.", variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Agregado - Diárias</h1>
        <div className="flex flex-wrap gap-2">
          
          <Button variant="outline" size="sm" onClick={async () => {
            const periodo = dataInicio && dataFim ? `${format(dataInicio, "dd/MM/yyyy")} a ${format(dataFim, "dd/MM/yyyy")}` : "";
            const doc = new jsPDF({ orientation: "landscape" });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const marginLeft = 14;
            const marginRight = 14;

            const startY = await addLetterhead(doc, "RELATÓRIO DE DIÁRIAS - AGREGADO");

            // Período e resumo geral
            let y = startY;
            doc.setFontSize(9);
            doc.setTextColor(60, 60, 60);
            if (periodo) {
              doc.text(`Período: ${periodo}`, marginLeft, y);
              y += 5;
            }

            // Group by equipment
            const grouped = new Map<string, { label: string; tag: string; serie: string; entries: Agregado[]; uniqueDiarias: Set<string> }>();
            filtered.forEach((m) => {
              const eqId = m.equipamento_id;
              if (!grouped.has(eqId)) {
                grouped.set(eqId, {
                  label: `${m.equipamentos?.tipo || ""} ${m.equipamentos?.modelo || ""}`.trim(),
                  tag: m.equipamentos?.tag_placa || "—",
                  serie: m.equipamentos?.numero_serie || "—",
                  entries: [],
                  uniqueDiarias: new Set(),
                });
              }
              const g = grouped.get(eqId)!;
              g.entries.push(m);
              // Mesmo dia + mesma O.S. = 1 diária; O.S. diferente = diária separada
              g.uniqueDiarias.add(`${m.data}||${m.os || ""}`);
            });

            let totalGeralDiarias = 0;
            let totalGeralRegistros = 0;

            // === RESUMO POR EQUIPAMENTO ===
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(41, 128, 185);
            doc.text("RESUMO POR EQUIPAMENTO", marginLeft, y);
            y += 2;

            const summaryHeaders = ["Equipamento", "Tag/Placa", "Nº Série", "Total Diárias", "Total Registros"];
            const summaryRows: string[][] = [];
            grouped.forEach((g) => {
              totalGeralDiarias += g.uniqueDiarias.size;
              totalGeralRegistros += g.entries.length;
              summaryRows.push([g.label, g.tag, g.serie, String(g.uniqueDiarias.size), String(g.entries.length)]);
            });

            autoTable(doc, {
              head: [summaryHeaders],
              body: summaryRows,
              startY: y,
              styles: { fontSize: 8, cellPadding: 2.5 },
              headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", halign: "center" },
              columnStyles: { 3: { halign: "center", fontStyle: "bold" }, 4: { halign: "center" } },
              alternateRowStyles: { fillColor: [245, 247, 250] },
              foot: [["TOTAL GERAL", "", "", String(totalGeralDiarias), String(totalGeralRegistros)]],
              footStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 9 },
              theme: "grid",
            });

            y = (doc as any).lastAutoTable.finalY + 10;

            // === DETALHAMENTO POR EQUIPAMENTO ===
            grouped.forEach((g) => {
              // Check page space
              if (y > pageH - 50) {
                doc.addPage();
                y = 20;
              }

              // Equipment header
              doc.setFontSize(9);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(41, 128, 185);
              doc.text(`${g.label}`, marginLeft, y);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(100, 100, 100);
              doc.text(`Tag: ${g.tag}  |  Série: ${g.serie}  |  Diárias: ${g.uniqueDiarias.size}`, marginLeft + doc.getTextWidth(g.label) + 5, y);
              y += 2;

              // Sort entries by date
              const sorted = [...g.entries].sort((a, b) => a.data.localeCompare(b.data));
              const detailHeaders = ["Data", "O.S.", "PDE", "Matrícula", "Observações"];
              const detailRows = sorted.map((m) => [
                parseLocalDate(m.data).toLocaleDateString("pt-BR"),
                m.os || "—",
                m.pde || "—",
                m.matricula || "—",
                m.observacoes || "—",
              ]);

              autoTable(doc, {
                head: [detailHeaders],
                body: detailRows,
                startY: y,
                styles: { fontSize: 7.5, cellPadding: 2 },
                headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7.5 },
                columnStyles: { 0: { halign: "center" }, 4: { cellWidth: 80 } },
                alternateRowStyles: { fillColor: [248, 249, 250] },
                theme: "grid",
                margin: { left: marginLeft, right: marginRight },
              });

              y = (doc as any).lastAutoTable.finalY + 8;
            });

            // === BLOCO DE ASSINATURA ===
            const sigBlockH = 50;
            if (y > pageH - sigBlockH - 15) {
              doc.addPage();
              y = 20;
            }
            y += 10;

            doc.setDrawColor(100, 100, 100);
            doc.setLineWidth(0.4);

            const colW = (pageW - marginLeft - marginRight) / 2;
            const lineY = y + 25;
            const nameY = lineY + 5;

            // Left signature
            doc.line(marginLeft + 10, lineY, marginLeft + colW - 10, lineY);
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(60, 60, 60);
            doc.text("CONTRATANTE", marginLeft + colW / 2, nameY, { align: "center" });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 120);
            doc.text("Assinatura / Carimbo", marginLeft + colW / 2, nameY + 4, { align: "center" });

            // Right signature
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

            // Footer with page numbers
            const totalPages = doc.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
              doc.setPage(i);
              doc.setFontSize(7);
              doc.setTextColor(150, 150, 150);
              doc.text(`Página ${i} de ${totalPages}`, pageW - marginRight, pageH - 8, { align: "right" });
            }

            doc.save(`relatorio_diarias_agregado_${new Date().toISOString().slice(0, 10)}.pdf`);
          }}>
            <FileDown className="h-4 w-4 mr-1" /> PDF Diárias
          </Button>
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Diária
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Equipamento</Label>
          <SearchableSelect
            value={filterEquip}
            onValueChange={setFilterEquip}
            placeholder="Todos"
            searchPlaceholder="Pesquisar..."
            className="w-52"
            options={[
              { value: "Todos", label: "Todos os Equipamentos" },
              ...equipamentos.map((e) => ({ value: e.id, label: getEquipLabel(e) })),
            ]}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Início</Label>
          <Input type="date" className="w-36 h-9" value={dataInicio ? format(dataInicio, "yyyy-MM-dd") : ""} onChange={(e) => setDataInicio(e.target.value ? parseLocalDate(e.target.value) : undefined)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fim</Label>
          <Input type="date" className="w-36 h-9" value={dataFim ? format(dataFim, "yyyy-MM-dd") : ""} onChange={(e) => setDataFim(e.target.value ? parseLocalDate(e.target.value) : undefined)} />
        </div>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground text-xs">Limpar</Button>}
      </div>

      {hasFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs font-medium text-muted-foreground">Total Geral</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-lg font-bold text-sidebar">{totalDiariasGeral} diária{totalDiariasGeral !== 1 ? "s" : ""}</div>
              <p className="text-[10px] text-muted-foreground">{filtered.length} registros (filtrado)</p>
            </CardContent>
          </Card>
          {Array.from(summaryMap.entries()).map(([id, data]) =>
            <Card key={id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">{data.label}</CardTitle>
                {data.tag && <p className="text-[10px] font-mono text-muted-foreground">{data.tag}</p>}
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="text-lg font-bold text-accent">{data.totalDiarias} diária{data.totalDiarias !== 1 ? "s" : ""}</div>
                <p className="text-[10px] text-muted-foreground">{data.entries} registros</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-accent/30 bg-accent/5 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} className="text-xs">Limpar seleção</Button>
          <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="text-xs"><Trash2 className="h-3.5 w-3.5 mr-1" />Excluir selecionados</Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[650px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allSelected ? true : (selected.size > 0 ? "indeterminate" : false)} onCheckedChange={toggleAll} /></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("equipamento")}><span className="flex items-center">Equipamento<SortIcon col="equipamento" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("tag")}><span className="flex items-center">Tag/Placa<SortIcon col="tag" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("data")}><span className="flex items-center">Data<SortIcon col="data" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("os")}><span className="flex items-center">O.S.<SortIcon col="os" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("pde")}><span className="flex items-center">PDE<SortIcon col="pde" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("matricula")}><span className="flex items-center">Matrícula<SortIcon col="matricula" /></span></TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) =>
                <TableRow key={item.id} className={selected.has(item.id) ? "bg-accent/10" : ""}>
                  <TableCell><Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleOne(item.id)} /></TableCell>
                  <TableCell className="font-medium text-sm">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</TableCell>
                  <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                  <TableCell className="text-sm">{parseLocalDate(item.data).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-sm">{item.os || "—"}</TableCell>
                  <TableCell className="text-sm">{item.pde || "—"}</TableCell>
                  <TableCell className="text-sm">{item.matricula || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 &&
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma diária encontrada</TableCell></TableRow>
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-accent" />
              {editingId ? "Editar Diária" : "Nova Diária"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Equipamento</Label>
              <SearchableSelect
                value={form.equipamento_id}
                onValueChange={(v) => setForm({ ...form, equipamento_id: v })}
                placeholder="Selecione o equipamento"
                searchPlaceholder="Pesquisar equipamento..."
                options={equipamentos.map((e) => ({ value: e.id, label: getEquipLabel(e) }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
              <div>
                <Label>Matrícula</Label>
                <Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} placeholder="Ex: 12345" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>O.S. (Ordem de Serviço)</Label>
                <Input value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} placeholder="Ex: OS-001" />
              </div>
              <div>
                <Label>PDE</Label>
                <Input value={form.pde} onChange={(e) => setForm({ ...form, pde: e.target.value })} placeholder="PDE" />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações adicionais..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {editingId ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Diária</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
