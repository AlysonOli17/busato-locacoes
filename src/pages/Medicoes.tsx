import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Clock, CalendarIcon, FileBarChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; }
interface Medicao {
  id: string;
  equipamento_id: string;
  data: string;
  horimetro_inicial: number;
  horimetro_final: number;
  horas_trabalhadas: number;
  equipamentos: Equipamento;
}

const Medicoes = () => {
  const [items, setItems] = useState<Medicao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ equipamento_id: "", data: new Date().toISOString().split("T")[0], horimetro: 0 });
  const [filterEquip, setFilterEquip] = useState("Todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    const [medRes, equipRes] = await Promise.all([
      supabase.from("medicoes").select("*, equipamentos(id, tipo, modelo, tag_placa)").order("data", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").order("tipo"),
    ]);
    if (medRes.data) setItems(medRes.data as unknown as Medicao[]);
    if (equipRes.data) setEquipamentos(equipRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) => {
    if (filterEquip !== "Todos" && i.equipamento_id !== filterEquip) return false;
    if (dataInicio) { if (new Date(i.data) < dataInicio) return false; }
    if (dataFim) { const fim = new Date(dataFim); fim.setHours(23, 59, 59, 999); if (new Date(i.data) > fim) return false; }
    return true;
  });

  const summaryMap = new Map<string, { totalHoras: number; entries: number; label: string; tag: string }>();
  filtered.forEach((m) => {
    const label = `${m.equipamentos?.tipo} ${m.equipamentos?.modelo}`;
    const tag = m.equipamentos?.tag_placa || "";
    const current = summaryMap.get(m.equipamento_id) || { totalHoras: 0, entries: 0, label, tag };
    current.totalHoras += Number(m.horas_trabalhadas);
    current.entries += 1;
    summaryMap.set(m.equipamento_id, current);
  });

  const totalHorasGeral = filtered.reduce((acc, m) => acc + Number(m.horas_trabalhadas), 0);

  const handleSave = async () => {
    if (!form.equipamento_id || form.horimetro <= 0) return;
    const { error } = await supabase.from("medicoes").insert({
      equipamento_id: form.equipamento_id,
      data: form.data,
      horimetro_inicial: 0,
      horimetro_final: form.horimetro,
      horas_trabalhadas: form.horimetro,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setDialogOpen(false);
    fetchData();
  };

  const clearFilters = () => { setFilterEquip("Todos"); setDataInicio(undefined); setDataFim(undefined); };
  const hasFilters = filterEquip !== "Todos" || dataInicio || dataFim;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Medições - Horímetro</h1>
            <p className="text-sm text-muted-foreground">Lançamento diário de horímetro por equipamento</p>
          </div>
          <Button onClick={() => { setForm({ equipamento_id: "", data: new Date().toISOString().split("T")[0], horimetro: 0 }); setDialogOpen(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Medição
          </Button>
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
                <Select value={filterEquip} onValueChange={setFilterEquip}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos os Equipamentos</SelectItem>
                    {equipamentos.map((e) => <SelectItem key={e.id} value={e.id}>{e.tipo} {e.modelo} {e.tag_placa ? `(${e.tag_placa})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-48 justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-48 justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataFim} onSelect={setDataFim} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">Limpar filtros</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Geral</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{totalHorasGeral.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">{filtered.length} registros{hasFilters ? " (filtrado)" : ""}</p>
            </CardContent>
          </Card>
          {Array.from(summaryMap.entries()).map(([id, data]) => (
            <Card key={id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{data.label}</CardTitle>
                {data.tag && <p className="text-xs font-mono text-muted-foreground">{data.tag}</p>}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">{data.totalHoras.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground">{data.entries} registros</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Tag/Placa</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horímetro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</TableCell>
                    <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(item.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge className="bg-accent/10 text-accent font-semibold border-0">
                        <Clock className="h-3 w-3 mr-1" />{Number(item.horas_trabalhadas).toFixed(1)}h
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma medição encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-accent" />Nova Medição</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Equipamento</Label>
              <Select value={form.equipamento_id} onValueChange={(v) => setForm({ ...form, equipamento_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                <SelectContent>
                  {equipamentos.map((e) => <SelectItem key={e.id} value={e.id}>{e.tipo} {e.modelo} {e.tag_placa ? `(${e.tag_placa})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
            <div>
              <Label>Horímetro</Label>
              <Input type="number" step="0.1" value={form.horimetro || ""} onChange={(e) => setForm({ ...form, horimetro: Number(e.target.value) })} placeholder="Ex: 8.5" />
            </div>
            {form.horimetro > 0 && (
              <div className="p-3 rounded-lg bg-accent/10 text-center">
                <p className="text-sm text-muted-foreground">Horas a registrar</p>
                <p className="text-2xl font-bold text-accent">{form.horimetro.toFixed(1)}h</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Medicoes;
