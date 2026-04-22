import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { SortableTableHead } from "@/components/SortableTableHead";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Clock, AlertTriangle, CalendarDays } from "lucide-react";
import { calcularHorasInterpoladas, cn, getEquipLabel } from "@/lib/utils";

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
interface Medicao {
  id: string; equipamento_id: string; data: string; horimetro_inicial: number; horimetro_final: number;
  horas_trabalhadas: number | null; tipo: string; observacoes: string | null; equipamentos_terceiros: Equipamento;
}

export const MedicoesTerceirosTab = () => {
  const [items, setItems] = useState<Medicao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [filtroEquip, setFiltroEquip] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [horimetroAnterior, setHorimetroAnterior] = useState(0);
  const { toast } = useToast();

  const [form, setForm] = useState({
    equipamento_id: "", data: new Date().toISOString().slice(0, 10),
    horimetro: 0, tipo: "Trabalho", observacoes: "",
    horimetro_inicial_indisp: 0, horas_indisp: 0,
  });

  const fetchData = async () => {
    const [medRes, eqRes] = await Promise.all([
      supabase.from("medicoes_terceiros").select("*, equipamentos_terceiros(id, tipo, modelo, tag_placa, numero_serie)").order("data", { ascending: false }),
      supabase.from("equipamentos_terceiros").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
    ]);
    if (medRes.data) setItems(medRes.data as unknown as Medicao[]);
    if (eqRes.data) setEquipamentos(eqRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchHorimetroPorData = async (equipId: string, data: string) => {
    const { data: result } = await supabase
      .from("medicoes_terceiros")
      .select("horimetro_final, data")
      .eq("equipamento_id", equipId)
      .eq("tipo", "Trabalho")
      .lt("data", data)
      .order("data", { ascending: false })
      .limit(1);
    setHorimetroAnterior(result && result.length > 0 ? Number(result[0].horimetro_final) : 0);
  };

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
      let cmp = 0;
      switch (sortCol) {
        case "equipamento": cmp = getEquipLabel(a.equipamentos_terceiros).localeCompare(getEquipLabel(b.equipamentos_terceiros)); break;
        case "tag": cmp = (a.equipamentos_terceiros?.tag_placa || "").localeCompare(b.equipamentos_terceiros?.tag_placa || ""); break;
        case "horimetro": cmp = Number(a.horimetro_final) - Number(b.horimetro_final); break;
        case "horas_indisp": cmp = Number(a.horas_trabalhadas) - Number(b.horas_trabalhadas); break;
        default: cmp = String((a as any)[sortCol] ?? "").localeCompare(String((b as any)[sortCol] ?? "")); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
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
      map.set(eqId, { label: getEquipLabel(eq ?? null), ...result, registros: meds.length });
    });
    return map;
  }, [filtered, hasFilters, items, equipamentos, dataInicio, dataFim]);

  const totalHorasGeral = Array.from(summaryMap.values()).reduce((acc, s) => acc + s.totalHoras, 0);

  const horasCalculadas = form.tipo === "Indisponível"
    ? form.horas_indisp
    : (form.horimetro > 0 ? Math.max(0, form.horimetro - horimetroAnterior) : 0);

  const openNew = () => {
    setEditingId(null);
    setForm({ equipamento_id: "", data: new Date().toISOString().slice(0, 10), horimetro: 0, tipo: "Trabalho", observacoes: "", horimetro_inicial_indisp: 0, horas_indisp: 0 });
    setHorimetroAnterior(0);
    setDialogOpen(true);
  };

  const openEdit = (m: Medicao) => {
    setEditingId(m.id);
    const isIndisp = m.tipo === "Indisponível";
    setForm({
      equipamento_id: m.equipamento_id, data: m.data, horimetro: Number(m.horimetro_final),
      tipo: m.tipo || "Trabalho", observacoes: m.observacoes || "",
      horimetro_inicial_indisp: isIndisp ? Number(m.horimetro_inicial) : 0,
      horas_indisp: isIndisp ? Number(m.horas_trabalhadas) : 0,
    });
    setHorimetroAnterior(Number(m.horimetro_inicial));
    setDialogOpen(true);
    fetchHorimetroPorData(m.equipamento_id, m.data);
  };

  const onEquipChange = (v: string) => {
    setForm(prev => ({ ...prev, equipamento_id: v }));
    if (form.data) fetchHorimetroPorData(v, form.data);
  };

  const onDataChange = (v: string) => {
    setForm(prev => ({ ...prev, data: v }));
    if (form.equipamento_id) fetchHorimetroPorData(form.equipamento_id, v);
  };

  const handleSave = async () => {
    if (!form.equipamento_id) {
      toast({ title: "Selecione um equipamento", variant: "destructive" });
      return;
    }
    const isIndisp = form.tipo === "Indisponível";
    const isDiaria = form.tipo === "Diária";

    if (!isDiaria && form.horimetro <= 0) {
      toast({ title: "Informe o horímetro", variant: "destructive" });
      return;
    }

    const hInicial = isDiaria ? 0 : (isIndisp ? form.horimetro_inicial_indisp : horimetroAnterior);
    const hFinal = isDiaria ? 0 : form.horimetro;
    const horasTrabalhadas = isDiaria ? 0 : (isIndisp ? form.horas_indisp : Math.max(0, form.horimetro - hInicial));

    const payload = {
      equipamento_id: form.equipamento_id, data: form.data,
      horimetro_inicial: hInicial, horimetro_final: hFinal,
      horas_trabalhadas: horasTrabalhadas, tipo: form.tipo,
      observacoes: form.observacoes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("medicoes_terceiros").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Lançamento atualizado" });
    } else {
      const { error } = await supabase.from("medicoes_terceiros").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Lançamento registrado" });
    }
    setDialogOpen(false);
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("medicoes_terceiros").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Registro excluído" });
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Lançamento</Button>
        <div className="flex-1" />
        <SearchableSelect value={filtroEquip} onValueChange={setFiltroEquip} placeholder="Todos equipamentos" options={[{ value: "", label: "Todos" }, ...equipamentos.map(e => ({ value: e.id, label: getEquipLabel(e) }))]} />
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-36 h-9" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-36 h-9" />
      </div>

      {hasFilters && summaryMap.size > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground">Total Geral</p>
              <p className="text-lg font-bold">{totalHorasGeral.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">{filtered.length} registros</p>
            </CardContent>
          </Card>
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
              <SortableTableHead column="data" sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Data</SortableTableHead>
              <SortableTableHead column="equipamento" sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Equipamento</SortableTableHead>
              <SortableTableHead column="tag" sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Tag/Placa</SortableTableHead>
              <SortableTableHead column="tipo" sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Tipo</SortableTableHead>
              <SortableTableHead column="horimetro" sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Horímetro Atual</SortableTableHead>
              <SortableTableHead column="horas_indisp" sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Horas Indisp.</SortableTableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(item => (
              <TableRow key={item.id}>
                <TableCell>{new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">{getEquipLabel(item.equipamentos_terceiros)}</TableCell>
                <TableCell className="font-mono text-sm">{item.equipamentos_terceiros?.tag_placa || "—"}</TableCell>
                <TableCell>
                  {item.tipo === "Indisponível" ? (
                    <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Indisponível</Badge>
                  ) : item.tipo === "Diária" ? (
                    <Badge className="bg-primary/10 text-primary border-0 text-xs gap-1"><CalendarDays className="h-3 w-3" /> Diária</Badge>
                  ) : (
                    <Badge className="bg-accent/10 text-accent border-0 text-xs">Trabalho</Badge>
                  )}
                </TableCell>
                <TableCell className="font-medium">{item.tipo === "Diária" ? "—" : Number(item.horimetro_final).toFixed(1)}</TableCell>
                <TableCell>
                  {item.tipo === "Indisponível" ? (
                    <Badge className="font-semibold border-0 bg-destructive/10 text-destructive">
                      <Clock className="h-3 w-3 mr-1" />{Number(item.horas_trabalhadas ?? 0).toFixed(1)}h
                    </Badge>
                  ) : <span className="text-sm text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum horímetro registrado</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {/* Dialog - Trabalho: apenas horímetro atual; Indisponível: inicial + final */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" />
              {editingId ? "Editar Lançamento" : "Novo Lançamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Equipamento</Label>
              <SearchableSelect
                value={form.equipamento_id}
                onValueChange={onEquipChange}
                placeholder="Selecione o equipamento"
                options={equipamentos.map(e => ({ value: e.id, label: getEquipLabel(e) }))}
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={e => onDataChange(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de Lançamento</Label>
              <RadioGroup value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))} className="flex flex-wrap gap-4 mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Trabalho" id="terc-tipo-trabalho" />
                  <Label htmlFor="terc-tipo-trabalho" className="cursor-pointer">Trabalho</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Diária" id="terc-tipo-diaria" />
                  <Label htmlFor="terc-tipo-diaria" className="cursor-pointer">Diária</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Indisponível" id="terc-tipo-indisponivel" />
                  <Label htmlFor="terc-tipo-indisponivel" className="cursor-pointer">Indisponível</Label>
                </div>
              </RadioGroup>
            </div>

            {form.tipo === "Trabalho" && (
              <div>
                <Label>Horímetro Atual</Label>
                <Input type="number" step="0.1" value={form.horimetro || ""} onChange={e => setForm(f => ({ ...f, horimetro: Number(e.target.value) }))} placeholder="Ex: 189.5" />
              </div>
            )}

            {form.tipo === "Diária" && (
              <div>
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Ex: O.S, local, atividade..." rows={3} />
              </div>
            )}

            {form.tipo === "Indisponível" && (
              <>
                <div>
                  <Label>Observação (motivo da indisponibilidade)</Label>
                  <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Ex: Manutenção preventiva..." rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Horímetro Inicial</Label>
                    <Input type="number" step="0.1" value={form.horimetro_inicial_indisp || ""} onChange={e => {
                      const val = Number(e.target.value);
                      const diff = Math.max(0, form.horimetro - val);
                      setForm(f => ({ ...f, horimetro_inicial_indisp: val, horas_indisp: diff }));
                    }} placeholder="Ex: 180.0" />
                  </div>
                  <div>
                    <Label>Horímetro Final</Label>
                    <Input type="number" step="0.1" value={form.horimetro || ""} onChange={e => {
                      const val = Number(e.target.value);
                      const diff = Math.max(0, val - form.horimetro_inicial_indisp);
                      setForm(f => ({ ...f, horimetro: val, horas_indisp: diff }));
                    }} placeholder="Ex: 189.5" />
                  </div>
                </div>
                <div>
                  <Label>Horas Indisponíveis (editável)</Label>
                  <Input type="number" step="0.1" value={form.horas_indisp || ""} onChange={e => setForm(f => ({ ...f, horas_indisp: Number(e.target.value) }))} placeholder="Ex: 9.5" />
                  <p className="text-xs text-muted-foreground mt-1">Pré-calculado pela diferença do horímetro. Edite se necessário.</p>
                </div>
              </>
            )}

            {horasCalculadas > 0 && (
              <div className={cn("p-3 rounded-lg text-center", form.tipo === "Indisponível" ? "bg-destructive/10" : "bg-accent/10")}>
                <p className="text-sm text-muted-foreground">
                  {form.tipo === "Indisponível" ? "Horas indisponíveis (serão descontadas)" : "Horas trabalhadas (diferença)"}
                </p>
                <p className={cn("text-2xl font-bold", form.tipo === "Indisponível" ? "text-destructive" : "text-accent")}>{horasCalculadas.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">
                  {form.tipo === "Indisponível" ? form.horimetro_inicial_indisp.toFixed(1) : horimetroAnterior.toFixed(1)} → {form.horimetro.toFixed(1)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? "Salvar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir registro?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
