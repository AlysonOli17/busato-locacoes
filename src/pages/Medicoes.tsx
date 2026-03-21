import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { getEquipLabel } from "@/lib/utils";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, CalendarIcon, FileBarChart, FileDown, Pencil, Trash2, Receipt, DollarSign, AlertTriangle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { exportToPDF } from "@/lib/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FaturamentoContent } from "./Faturamento";
import { FaturamentoTab } from "@/components/FaturamentoTab";

interface Equipamento {id: string;tipo: string;modelo: string;tag_placa: string | null;numero_serie: string | null;}
interface Medicao {
  id: string;
  equipamento_id: string;
  data: string;
  horimetro_inicial: number;
  horimetro_final: number;
  horas_trabalhadas: number;
  tipo: string;
  observacoes: string | null;
  equipamentos: Equipamento;
}

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const Medicoes = () => {
  const [items, setItems] = useState<Medicao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ equipamento_id: "", data: new Date().toISOString().split("T")[0], horimetro: 0, tipo: "Trabalho", observacoes: "", horimetro_inicial_indisp: 0, horas_indisp: 0 });
  const [filterEquip, setFilterEquip] = useState("Todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [horimetroAnterior, setHorimetroAnterior] = useState<number>(0);
  const [baselines, setBaselines] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();

  const fetchData = async () => {
    const [medRes, equipRes] = await Promise.all([
    supabase.from("medicoes").select("*, equipamentos(id, tipo, modelo, tag_placa)").order("data", { ascending: false }),
    supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").order("tipo")]
    );
    if (medRes.data) setItems(medRes.data as unknown as Medicao[]);
    if (equipRes.data) setEquipamentos(equipRes.data);
    setLoading(false);
  };

  useEffect(() => {fetchData();}, []);

  // Busca o horímetro registrado ANTES da data selecionada para o equipamento
  const fetchHorimetroPorData = async (equipId: string, data: string, excludeId?: string) => {
    let query = supabase.
    from("medicoes").
    select("horimetro_final, data").
    eq("equipamento_id", equipId).
    lt("data", data).
    order("data", { ascending: false }).
    limit(1);

    const { data: result } = await query;
    if (result && result.length > 0) {
      setHorimetroAnterior(Number(result[0].horimetro_final));
    } else {
      setHorimetroAnterior(0);
    }
  };

  const filtered = items.filter((i) => {
    if (filterEquip !== "Todos" && i.equipamento_id !== filterEquip) return false;
    const itemDate = parseLocalDate(i.data);
    if (dataInicio) {if (itemDate < dataInicio) return false;}
    if (dataFim) {const fim = new Date(dataFim);fim.setHours(23, 59, 59, 999);if (itemDate > fim) return false;}
    return true;
  });

  // Fetch baselines when filters change
  const fetchBaselines = useCallback(async () => {
    if (!dataInicio) {
      setBaselines(new Map());
      return;
    }
    const inicioStr = dataInicio.toISOString().split("T")[0];
    const uniqueEquipIds = [...new Set(filtered.map(m => m.equipamento_id))];
    if (uniqueEquipIds.length === 0) {
      setBaselines(new Map());
      return;
    }
    const promises = uniqueEquipIds.map(eqId =>
      supabase.from("medicoes").select("equipamento_id, horimetro_final")
        .eq("equipamento_id", eqId).lt("data", inicioStr)
        .order("data", { ascending: false }).limit(1)
    );
    const results = await Promise.all(promises);
    const map = new Map<string, number>();
    results.forEach(r => {
      if (r.data && r.data.length > 0) {
        map.set(r.data[0].equipamento_id, Number(r.data[0].horimetro_final));
      }
    });
    setBaselines(map);
  }, [filtered.length, dataInicio, filterEquip]);

  useEffect(() => { fetchBaselines(); }, [fetchBaselines]);

  // Group filtered entries by equipment, sorted by date
  const summaryMap = new Map<string, {totalHoras: number;entries: number;label: string;tag: string;}>();
  const equipEntries = new Map<string, Medicao[]>();
  filtered.forEach((m) => {
    const arr = equipEntries.get(m.equipamento_id) || [];
    arr.push(m);
    equipEntries.set(m.equipamento_id, arr);
  });
  equipEntries.forEach((entries, eqId) => {
    const sorted = [...entries].sort((a, b) => a.data.localeCompare(b.data));
    const first = sorted[0];
    const label = `${first.equipamentos?.tipo} ${first.equipamentos?.modelo}`;
    const tag = first.equipamentos?.tag_placa || "";
    // Para Trabalho, usamos horimetro_final (horímetro atual). Pegar menor e maior do período.
    const trabalhoEntries = sorted.filter(e => (e.tipo || "Trabalho") === "Trabalho");
    // Deduplicate: keep only the highest horimetro_final per day
    const byDay = new Map<string, number>();
    for (const e of trabalhoEntries) {
      const d = String(e.data);
      const v = Number(e.horimetro_final);
      if (!byDay.has(d) || v > byDay.get(d)!) byDay.set(d, v);
    }
    const dayValues = Array.from(byDay.values());
    let totalHoras = 0;
    if (dayValues.length > 0) {
      const maior = Math.max(...dayValues);
      // Use min of values within filtered period (max - min of horimetro_final)
      const menor = dayValues.length >= 2 ? Math.min(...dayValues) : maior;
      totalHoras = Math.max(0, maior - menor);
    }
    summaryMap.set(eqId, { totalHoras, entries: entries.length, label, tag });
  });

  const totalHorasGeral = Array.from(summaryMap.values()).reduce((acc, s) => acc + s.totalHoras, 0);

  const horasCalculadas = form.tipo === "Indisponível"
    ? form.horas_indisp
    : (form.horimetro > 0 ? Math.max(0, form.horimetro - horimetroAnterior) : 0);

  const openNew = () => {
    setEditingId(null);
    setForm({ equipamento_id: "", data: new Date().toISOString().split("T")[0], horimetro: 0, tipo: "Trabalho", observacoes: "", horimetro_inicial_indisp: 0, horas_indisp: 0 });
    setHorimetroAnterior(0);
    setDialogOpen(true);
  };

  const openEdit = (m: Medicao) => {
    setEditingId(m.id);
    const isIndisp = m.tipo === "Indisponível";
    setForm({ equipamento_id: m.equipamento_id, data: m.data, horimetro: Number(m.horimetro_final), tipo: m.tipo || "Trabalho", observacoes: m.observacoes || "", horimetro_inicial_indisp: isIndisp ? Number(m.horimetro_inicial) : 0, horas_indisp: isIndisp ? Number(m.horas_trabalhadas) : 0 });
    setHorimetroAnterior(Number(m.horimetro_inicial));
    setDialogOpen(true);
    // Refresh anterior for this date
    fetchHorimetroPorData(m.equipamento_id, m.data, m.id);
  };

  const handleSave = async () => {
    if (!form.equipamento_id || form.horimetro <= 0) {
      toast({ title: "Campos obrigatórios", description: "Selecione um equipamento e informe o horímetro.", variant: "destructive" });
      return;
    }

    const isIndisp = form.tipo === "Indisponível";
    const hInicial = isIndisp ? form.horimetro_inicial_indisp : horimetroAnterior;
    const horasTrabalhadas = isIndisp ? form.horas_indisp : Math.max(0, form.horimetro - hInicial);

    if (editingId) {
      const { error } = await supabase.from("medicoes").update({
        equipamento_id: form.equipamento_id,
        data: form.data,
        horimetro_inicial: hInicial,
        horimetro_final: form.horimetro,
        horas_trabalhadas: horasTrabalhadas,
        tipo: form.tipo,
        observacoes: form.observacoes || null,
      }).eq("id", editingId);
      if (error) {toast({ title: "Erro", description: error.message, variant: "destructive" });return;}
    } else {
      const { error } = await supabase.from("medicoes").insert({
        equipamento_id: form.equipamento_id,
        data: form.data,
        horimetro_inicial: hInicial,
        horimetro_final: form.horimetro,
        horas_trabalhadas: horasTrabalhadas,
        tipo: form.tipo,
        observacoes: form.observacoes || null,
      });
      if (error) {toast({ title: "Erro", description: error.message, variant: "destructive" });return;}
    }
    setDialogOpen(false);
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("medicoes").delete().eq("id", deleteId);
    if (error) {toast({ title: "Erro", description: error.message, variant: "destructive" });return;}
    setDeleteId(null);
    fetchData();
  };

  const onEquipChange = (v: string) => {
    setForm((prev) => ({ ...prev, equipamento_id: v }));
    if (form.data) fetchHorimetroPorData(v, form.data, editingId || undefined);
  };

  const onDataChange = (v: string) => {
    setForm((prev) => ({ ...prev, data: v }));
    if (form.equipamento_id) fetchHorimetroPorData(form.equipamento_id, v, editingId || undefined);
  };

  const clearFilters = () => {setFilterEquip("Todos");setDataInicio(undefined);setDataFim(undefined);};
  const hasFilters = filterEquip !== "Todos" || dataInicio || dataFim;

  return (
    <Layout title="Medições / Faturamento">
      <Tabs defaultValue="medicoes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="medicoes" className="gap-2"><Clock className="h-4 w-4" /> Horímetro</TabsTrigger>
          <TabsTrigger value="faturamento" className="gap-2"><Receipt className="h-4 w-4" /> Medição</TabsTrigger>
          <TabsTrigger value="faturamento-novo" className="gap-2"><DollarSign className="h-4 w-4" /> Faturamento</TabsTrigger>
        </TabsList>
        <TabsContent value="medicoes">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Horímetro</h1>
            <p className="text-sm text-muted-foreground">Lançamento diário de horímetro por equipamento</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const headers = ["Equipamento", "Tag/Placa", "Data", "Tipo", "Horímetro Atual", "Horas Indisp."];
              const rows = filtered.map((m) => [
              `${m.equipamentos?.tipo} ${m.equipamentos?.modelo}`,
              m.equipamentos?.tag_placa || "—",
              parseLocalDate(m.data).toLocaleDateString("pt-BR"),
              m.tipo || "Trabalho",
              Number(m.horimetro_final).toFixed(1),
              (m.tipo || "Trabalho") === "Indisponível" ? Number(m.horas_trabalhadas).toFixed(1) : "—"]
              );
              const periodo = dataInicio && dataFim ? ` - ${format(dataInicio, "dd/MM/yyyy")} a ${format(dataFim, "dd/MM/yyyy")}` : "";
              exportToPDF({ title: `Relatório de Horímetro Mensal${periodo}`, headers, rows, filename: `horimetro_mensal_${new Date().toISOString().slice(0, 10)}` });
            }}>
              <FileDown className="h-4 w-4 mr-1" /> PDF Horímetro
            </Button>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Novo Horímetro
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileBarChart className="h-4 w-4 text-accent" /> Filtros / Relatório
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
                <Input
                  type="date"
                  className="w-48"
                  value={dataInicio ? format(dataInicio, "yyyy-MM-dd") : ""}
                  onChange={(e) => setDataInicio(e.target.value ? parseLocalDate(e.target.value) : undefined)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Final</Label>
                <Input
                  type="date"
                  className="w-48"
                  value={dataFim ? format(dataFim, "yyyy-MM-dd") : ""}
                  onChange={(e) => setDataFim(e.target.value ? parseLocalDate(e.target.value) : undefined)}
                />
              </div>
              {hasFilters &&
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">Limpar filtros</Button>
              }
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs font-medium text-muted-foreground">Total Geral</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-lg font-bold text-sidebar">{totalHorasGeral.toFixed(1)}h</div>
              <p className="text-[10px] text-muted-foreground">{filtered.length} registros{hasFilters ? " (filtrado)" : ""}</p>
            </CardContent>
          </Card>
          {Array.from(summaryMap.entries()).map(([id, data]) =>
          <Card key={id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">{data.label}</CardTitle>
                {data.tag && <p className="text-[10px] font-mono text-muted-foreground">{data.tag}</p>}
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="text-lg font-bold text-accent">{data.totalHoras.toFixed(1)}h</div>
                <p className="text-[10px] text-muted-foreground">{data.entries} registros</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                 <TableRow>
                   <TableHead>Equipamento</TableHead>
                    <TableHead>Tag/Placa</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Horímetro Atual</TableHead>
                    <TableHead>Horas Indisp.</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) =>
                <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</TableCell>
                    <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                     <TableCell className="text-sm">{parseLocalDate(item.data).toLocaleDateString("pt-BR")}</TableCell>
                     <TableCell>
                       {(item.tipo || "Trabalho") === "Indisponível" ? (
                         <Badge variant="destructive" className="text-xs gap-1">
                           <AlertTriangle className="h-3 w-3" /> Indisponível
                         </Badge>
                       ) : (
                         <Badge className="bg-accent/10 text-accent border-0 text-xs">Trabalho</Badge>
                       )}
                     </TableCell>
                     <TableCell className="text-sm font-medium">{Number(item.horimetro_final).toFixed(1)}</TableCell>
                     <TableCell>
                        {(item.tipo || "Trabalho") === "Indisponível" ? (
                          <Badge className="font-semibold border-0 bg-destructive/10 text-destructive">
                            <Clock className="h-3 w-3 mr-1" />{Number(item.horas_trabalhadas).toFixed(1)}h
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
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
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum horímetro encontrado</TableCell></TableRow>
                }
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
        </TabsContent>
        <TabsContent value="faturamento">
          <FaturamentoContent />
        </TabsContent>
        <TabsContent value="faturamento-novo">
          <FaturamentoTab />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" />
              {editingId ? "Editar Horímetro" : "Novo Horímetro"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Equipamento</Label>
              <SearchableSelect
                value={form.equipamento_id}
                onValueChange={onEquipChange}
                placeholder="Selecione o equipamento"
                searchPlaceholder="Pesquisar equipamento..."
                options={equipamentos.map((e) => ({ value: e.id, label: getEquipLabel(e) }))}
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => onDataChange(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de Lançamento</Label>
              <RadioGroup value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })} className="flex gap-4 mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Trabalho" id="tipo-trabalho" />
                  <Label htmlFor="tipo-trabalho" className="cursor-pointer">Trabalho</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Indisponível" id="tipo-indisponivel" />
                  <Label htmlFor="tipo-indisponivel" className="cursor-pointer">Indisponível</Label>
                </div>
              </RadioGroup>
            </div>
            {form.tipo === "Indisponível" && (
              <>
                <div>
                  <Label>Observação (motivo da indisponibilidade)</Label>
                  <Textarea
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    placeholder="Ex: Manutenção preventiva, quebra mecânica..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Horímetro Inicial</Label>
                    <Input type="number" step="0.1" value={form.horimetro_inicial_indisp || ""} onChange={(e) => {
                      const val = Number(e.target.value);
                      const diff = Math.max(0, form.horimetro - val);
                      setForm({ ...form, horimetro_inicial_indisp: val, horas_indisp: diff });
                    }} placeholder="Ex: 180.0" />
                  </div>
                  <div>
                    <Label>Horímetro Final</Label>
                    <Input type="number" step="0.1" value={form.horimetro || ""} onChange={(e) => {
                      const val = Number(e.target.value);
                      const diff = Math.max(0, val - form.horimetro_inicial_indisp);
                      setForm({ ...form, horimetro: val, horas_indisp: diff });
                    }} placeholder="Ex: 189.5" />
                  </div>
                </div>
                <div>
                  <Label>Horas Indisponíveis (editável)</Label>
                  <Input type="number" step="0.1" value={form.horas_indisp || ""} onChange={(e) => setForm({ ...form, horas_indisp: Number(e.target.value) })} placeholder="Ex: 9.5" />
                  <p className="text-xs text-muted-foreground mt-1">Pré-calculado pela diferença do horímetro. Edite se necessário.</p>
                </div>
              </>
            )}
            {form.tipo === "Trabalho" && (
              <div>
                <Label>Horímetro Atual</Label>
                <Input type="number" step="0.1" value={form.horimetro || ""} onChange={(e) => setForm({ ...form, horimetro: Number(e.target.value) })} placeholder="Ex: 189.5" />
              </div>
            )}
            {horasCalculadas > 0 &&
            <div className={cn("p-3 rounded-lg text-center", form.tipo === "Indisponível" ? "bg-destructive/10" : "bg-accent/10")}>
                <p className="text-sm text-muted-foreground">
                  {form.tipo === "Indisponível" ? "Horas indisponíveis (serão descontadas)" : "Horas trabalhadas (diferença)"}
                </p>
                <p className={cn("text-2xl font-bold", form.tipo === "Indisponível" ? "text-destructive" : "text-accent")}>{horasCalculadas.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">
                  {form.tipo === "Indisponível" ? form.horimetro_inicial_indisp.toFixed(1) : horimetroAnterior.toFixed(1)} → {form.horimetro.toFixed(1)}
                </p>
              </div>
            }
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
            <AlertDialogTitle>Excluir Horímetro</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este registro de horímetro? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>);

};

export default Medicoes;