import { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { getEquipLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CalendarDays, FileBarChart, FileDown, Pencil, Trash2, Upload, Download } from "lucide-react";
import { exportToPDF } from "@/lib/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ExcelJS from "exceljs";

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
  complementar: "",
  pde: "",
  tipo: "",
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
  const { toast } = useToast();

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

  const filtered = useMemo(() => items.filter((i) => {
    if (filterEquip !== "Todos" && i.equipamento_id !== filterEquip) return false;
    const itemDate = parseLocalDate(i.data);
    if (dataInicio && itemDate < dataInicio) return false;
    if (dataFim) { const fim = new Date(dataFim); fim.setHours(23, 59, 59, 999); if (itemDate > fim) return false; }
    return true;
  }), [items, filterEquip, dataInicio, dataFim]);

  // Summary: count unique days per equipment
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
      const uniqueDays = new Set(entries.map(e => e.data));
      map.set(eqId, { totalDiarias: uniqueDays.size, entries: entries.length, label, tag });
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
      complementar: item.complementar,
      pde: item.pde,
      tipo: item.tipo,
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
      complementar: form.complementar,
      pde: form.pde,
      tipo: form.tipo,
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

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Diárias Agregado");
    ws.columns = [
      { header: "O.S.", key: "os", width: 15 },
      { header: "Complementar", key: "complementar", width: 20 },
      { header: "PDE", key: "pde", width: 15 },
      { header: "Tipo", key: "tipo", width: 15 },
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
    // Add example row
    ws.addRow({ os: "OS-001", complementar: "", pde: "PDE-01", tipo: "QQP", placa_tag: "ABC-1234", matricula: "12345", data: "01/01/2026" });
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

      // Build placa→equipamento map
      const placaMap = new Map<string, string>();
      equipamentos.forEach(eq => {
        if (eq.tag_placa) placaMap.set(eq.tag_placa.trim().toUpperCase(), eq.id);
      });

      const rows: any[] = [];
      let skipped = 0;
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return; // skip header
        const os = String(row.getCell(1).value || "").trim();
        const complementar = String(row.getCell(2).value || "").trim();
        const pde = String(row.getCell(3).value || "").trim();
        const tipo = String(row.getCell(4).value || "").trim();
        const placaRaw = String(row.getCell(5).value || "").trim().toUpperCase();
        const matricula = String(row.getCell(6).value || "").trim();
        const dataRaw = row.getCell(7).value;

        // Resolve equipment by placa
        const eqId = placaMap.get(placaRaw);
        if (!eqId) { skipped++; return; }

        // Parse date
        let dataStr = "";
        if (dataRaw instanceof Date) {
          dataStr = format(dataRaw, "yyyy-MM-dd");
        } else if (typeof dataRaw === "string") {
          // Try dd/MM/yyyy
          const parts = dataRaw.split("/");
          if (parts.length === 3) {
            dataStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          } else {
            dataStr = dataRaw;
          }
        }
        if (!dataStr) { skipped++; return; }

        rows.push({ equipamento_id: eqId, data: dataStr, os, complementar, pde, tipo, matricula, observacoes: null });
      });

      if (rows.length === 0) {
        toast({ title: "Nenhum registro válido", description: `${skipped} linhas ignoradas (placa não encontrada ou dados inválidos).`, variant: "destructive" });
        return;
      }

      // Insert in batches of 50
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agregado - Diárias</h1>
          <p className="text-sm text-muted-foreground">Lançamento de diárias por equipamento agregado</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const headers = ["Equipamento", "Tag/Placa", "Data", "O.S.", "Complementar", "PDE", "Tipo", "Matrícula"];
            const rows = filtered.map((m) => [
              `${m.equipamentos?.tipo} ${m.equipamentos?.modelo}`,
              m.equipamentos?.tag_placa || "—",
              parseLocalDate(m.data).toLocaleDateString("pt-BR"),
              m.os || "—",
              m.complementar || "—",
              m.pde || "—",
              m.tipo || "—",
              m.matricula || "—",
            ]);
            const periodo = dataInicio && dataFim ? ` - ${format(dataInicio, "dd/MM/yyyy")} a ${format(dataFim, "dd/MM/yyyy")}` : "";
            exportToPDF({ title: `Relatório de Diárias Agregado${periodo}`, headers, rows, filename: `agregado_diarias_${new Date().toISOString().slice(0, 10)}` });
          }}>
            <FileDown className="h-4 w-4 mr-1" /> PDF Diárias
          </Button>
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Diária
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-accent" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Equipamento</Label>
              <SearchableSelect
                value={filterEquip}
                onValueChange={setFilterEquip}
                placeholder="Todos os Equipamentos"
                searchPlaceholder="Pesquisar equipamento..."
                className="w-64"
                options={[
                  { value: "Todos", label: "Todos os Equipamentos" },
                  ...equipamentos.map((e) => ({ value: e.id, label: getEquipLabel(e) })),
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Inicial</Label>
              <Input type="date" className="w-48" value={dataInicio ? format(dataInicio, "yyyy-MM-dd") : ""} onChange={(e) => setDataInicio(e.target.value ? parseLocalDate(e.target.value) : undefined)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Final</Label>
              <Input type="date" className="w-48" value={dataFim ? format(dataFim, "yyyy-MM-dd") : ""} onChange={(e) => setDataFim(e.target.value ? parseLocalDate(e.target.value) : undefined)} />
            </div>
            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">Limpar filtros</Button>}
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>Tag/Placa</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>O.S.</TableHead>
                <TableHead>Complementar</TableHead>
                <TableHead>PDE</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) =>
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</TableCell>
                  <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                  <TableCell className="text-sm">{parseLocalDate(item.data).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-sm">{item.os || "—"}</TableCell>
                  <TableCell className="text-sm">{item.complementar || "—"}</TableCell>
                  <TableCell className="text-sm">{item.pde || "—"}</TableCell>
                  <TableCell><Badge className="bg-accent/10 text-accent border-0 text-xs">{item.tipo || "—"}</Badge></TableCell>
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
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma diária encontrada</TableCell></TableRow>
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
                <Label>Complementar</Label>
                <Input value={form.complementar} onChange={(e) => setForm({ ...form, complementar: e.target.value })} placeholder="Complemento da O.S." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>PDE</Label>
                <Input value={form.pde} onChange={(e) => setForm({ ...form, pde: e.target.value })} placeholder="PDE" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="Ex: QQP" />
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
