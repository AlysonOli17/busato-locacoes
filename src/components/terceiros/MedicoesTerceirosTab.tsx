import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTableHead } from "@/components/SortableTableHead";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { calcularHorasInterpoladas } from "@/lib/utils";

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
interface Medicao {
  id: string; equipamento_id: string; data: string; horimetro_inicial: number; horimetro_final: number;
  horas_trabalhadas: number | null; tipo: string; observacoes: string | null; equipment: Equipamento;
}

const getLabel = (eq: Equipamento | null) => {
  if (!eq) return "—";
  let l = `${eq.tipo} ${eq.modelo}`.trim();
  if (eq.tag_placa) l += ` (${eq.tag_placa})`;
  if (eq.numero_serie) l += ` - NS: ${eq.numero_serie}`;
  return l;
};

export const MedicoesTerceirosTab = () => {
  const [items, setItems] = useState<Medicao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [filtroEquip, setFiltroEquip] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { toast } = useToast();

  const [form, setForm] = useState({
    id: "", equipamento_id: "", data: new Date().toISOString().slice(0, 10),
    horimetro_inicial: 0, horimetro_final: 0, horas_trabalhadas: 0, tipo: "Trabalho", observacoes: "",
  });

  const fetchData = async () => {
    const [medRes, eqRes] = await Promise.all([
      supabase.from("medicoes_terceiros").select("*, equipamentos_terceiros(id, tipo, modelo, tag_placa, numero_serie)").order("data", { ascending: false }),
      supabase.from("equipamentos_terceiros").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
    ]);
    if (medRes.data) setItems(medRes.data.map((m: any) => ({ ...m, equipment: m.equipamentos_terceiros })));
    if (eqRes.data) setEquipamentos(eqRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (filtroEquip && i.equipamento_id !== filtroEquip) return false;
      if (dataInicio && i.data < dataInicio) return false;
      if (dataFim && i.data > dataFim) return false;
      return true;
    });
  }, [items, filtroEquip, dataInicio, dataFim]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: any, bv: any;
      if (sortCol === "equipamento") { av = getLabel(a.equipment); bv = getLabel(b.equipment); }
      else if (sortCol === "horimetro_final" || sortCol === "horas_trabalhadas") { av = Number((a as any)[sortCol]) || 0; bv = Number((b as any)[sortCol]) || 0; return sortDir === "asc" ? av - bv : bv - av; }
      else { av = (a as any)[sortCol] ?? ""; bv = (b as any)[sortCol] ?? ""; }
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  // Summary per equipment when filters active
  const hasFilters = !!(filtroEquip || dataInicio || dataFim);
  const summaryMap = useMemo(() => {
    if (!hasFilters) return new Map();
    const map = new Map<string, { label: string; totalHoras: number; mediaHorasDia: number; registros: number }>();
    const byEquip = new Map<string, Medicao[]>();
    filtered.forEach(m => {
      if (!byEquip.has(m.equipamento_id)) byEquip.set(m.equipamento_id, []);
      byEquip.get(m.equipamento_id)!.push(m);
    });
    byEquip.forEach((meds, eqId) => {
      const eq = equipamentos.find(e => e.id === eqId);
      const readings = items.filter(m => m.equipamento_id === eqId && m.tipo === "Trabalho").map(m => ({ data: m.data, horimetro_final: m.horimetro_final }));
      const pInicio = dataInicio || meds.reduce((min, m) => m.data < min ? m.data : min, meds[0].data);
      const pFim = dataFim || meds.reduce((max, m) => m.data > max ? m.data : max, meds[0].data);
      const result = calcularHorasInterpoladas(readings, pInicio, pFim);
      map.set(eqId, { label: getLabel(eq ?? null), ...result, registros: meds.length });
    });
    return map;
  }, [filtered, hasFilters, items, equipamentos, dataInicio, dataFim]);

  const openNew = () => {
    setForm({ id: "", equipamento_id: "", data: new Date().toISOString().slice(0, 10), horimetro_inicial: 0, horimetro_final: 0, horas_trabalhadas: 0, tipo: "Trabalho", observacoes: "" });
    setEditing(false); setDialogOpen(true);
  };
  const openEdit = (item: Medicao) => {
    setForm({ id: item.id, equipamento_id: item.equipamento_id, data: item.data, horimetro_inicial: item.horimetro_inicial, horimetro_final: item.horimetro_final, horas_trabalhadas: item.horas_trabalhadas ?? 0, tipo: item.tipo, observacoes: item.observacoes ?? "" });
    setEditing(true); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipamento_id) { toast({ title: "Selecione um equipamento", variant: "destructive" }); return; }
    const payload: any = {
      equipamento_id: form.equipamento_id, data: form.data, horimetro_inicial: form.horimetro_inicial,
      horimetro_final: form.horimetro_final, horas_trabalhadas: form.tipo === "Trabalho" ? form.horimetro_final - form.horimetro_inicial : form.horas_trabalhadas,
      tipo: form.tipo, observacoes: form.observacoes || null,
    };
    if (editing) {
      await supabase.from("medicoes_terceiros").update(payload).eq("id", form.id);
      toast({ title: "Medição atualizada" });
    } else {
      await supabase.from("medicoes_terceiros").insert(payload);
      toast({ title: "Medição registrada" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("medicoes_terceiros").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Medição excluída" });
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Medição</Button>
        <div className="flex-1" />
        <SearchableSelect value={filtroEquip} onValueChange={setFiltroEquip} placeholder="Todos equipamentos" options={[{ value: "", label: "Todos" }, ...equipamentos.map(e => ({ value: e.id, label: getLabel(e) }))]} />
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-36 h-9" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-36 h-9" />
      </div>

      {hasFilters && summaryMap.size > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from(summaryMap.entries()).map(([eqId, s]) => (
            <Card key={eqId}>
              <CardContent className="p-3">
                <p className="text-xs font-medium truncate">{s.label}</p>
                <p className="text-lg font-bold">{s.totalHoras.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Média: {s.mediaHorasDia.toFixed(2)}h/dia · {s.registros} registros</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="data" label="Data" sortColumn={sortCol} sortDirection={sortDir} onSort={toggleSort} />
              <SortableTableHead column="equipamento" label="Equipamento" sortColumn={sortCol} sortDirection={sortDir} onSort={toggleSort} />
              <TableHead>Hor. Inicial</TableHead>
              <SortableTableHead column="horimetro_final" label="Hor. Final" sortColumn={sortCol} sortDirection={sortDir} onSort={toggleSort} />
              <SortableTableHead column="horas_trabalhadas" label="Horas" sortColumn={sortCol} sortDirection={sortDir} onSort={toggleSort} />
              <TableHead>Tipo</TableHead>
              <TableHead>Obs.</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(item => (
              <TableRow key={item.id}>
                <TableCell>{new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">{getLabel(item.equipment)}</TableCell>
                <TableCell>{item.horimetro_inicial.toFixed(1)}</TableCell>
                <TableCell>{item.horimetro_final.toFixed(1)}</TableCell>
                <TableCell>{(item.horas_trabalhadas ?? 0).toFixed(1)}</TableCell>
                <TableCell><Badge variant={item.tipo === "Trabalho" ? "default" : "secondary"}>{item.tipo}</Badge></TableCell>
                <TableCell className="max-w-[120px] truncate">{item.observacoes || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma medição registrada</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Editar Medição" : "Nova Medição"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Equipamento *</Label>
              <SearchableSelect value={form.equipamento_id} onValueChange={v => setForm(f => ({ ...f, equipamento_id: v }))} placeholder="Selecione..." options={equipamentos.map(e => ({ value: e.id, label: getLabel(e) }))} />
            </div>
            <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Trabalho">Trabalho</SelectItem><SelectItem value="Indisponível">Indisponível</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Horímetro Inicial</Label><Input type="number" step="0.1" value={form.horimetro_inicial} onChange={e => setForm(f => ({ ...f, horimetro_inicial: Number(e.target.value) }))} /></div>
            <div><Label>Horímetro Final</Label><Input type="number" step="0.1" value={form.horimetro_final} onChange={e => setForm(f => ({ ...f, horimetro_final: Number(e.target.value) }))} /></div>
            {form.tipo === "Indisponível" && (
              <div><Label>Horas Indisponíveis</Label><Input type="number" step="0.1" value={form.horas_trabalhadas} onChange={e => setForm(f => ({ ...f, horas_trabalhadas: Number(e.target.value) }))} /></div>
            )}
            <div className="sm:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave}>Salvar</Button></DialogFooter>
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
