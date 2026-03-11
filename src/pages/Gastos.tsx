import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Plus, Search, Pencil, Trash2, DollarSign, TrendingDown, CalendarClock, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; }
interface FaturaRef {
  faturamento_id: string;
  numero_sequencial: number;
  status: string;
  periodo: string;
}
interface Gasto {
  id: string;
  equipamento_id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data: string;
  equipamentos: Equipamento;
  fatura?: FaturaRef | null;
}

const tiposGasto = ["Manutenção", "Combustível", "Peças", "Transporte", "Outros"];
const emptyForm = { equipamento_id: "", descricao: "", tipo: "Manutenção", valor: 0, data: new Date().toISOString().split("T")[0] };

const Gastos = () => {
  const [items, setItems] = useState<Gasto[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Gasto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterTag, setFilterTag] = useState("Todos");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const { toast } = useToast();

  const fetchData = async () => {
    const [gastosRes, equipRes, fatGastosRes] = await Promise.all([
      supabase.from("gastos").select("*, equipamentos(id, tipo, modelo, tag_placa)").order("data", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").order("tipo"),
      supabase.from("faturamento_gastos").select("gasto_id, faturamento_id, faturamento(numero_sequencial, status, periodo)"),
    ]);

    const fatMap = new Map<string, FaturaRef>();
    if (fatGastosRes.data) {
      for (const fg of fatGastosRes.data as any[]) {
        if (fg.faturamento) {
          fatMap.set(fg.gasto_id, {
            faturamento_id: fg.faturamento_id,
            numero_sequencial: fg.faturamento.numero_sequencial,
            status: fg.faturamento.status,
            periodo: fg.faturamento.periodo,
          });
        }
      }
    }

    if (gastosRes.data) {
      const withFatura = (gastosRes.data as unknown as Gasto[]).map(g => ({
        ...g,
        fatura: fatMap.get(g.id) || null,
      }));
      setItems(withFatura);
    }
    if (equipRes.data) setEquipamentos(equipRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const uniqueTags = Array.from(new Set(items.map(i => i.equipamentos?.tag_placa).filter(Boolean))) as string[];

  const filtered = items.filter((i) => {
    if (filterTag !== "Todos" && i.equipamentos?.tag_placa !== filterTag) return false;
    if (periodoInicio && i.data < periodoInicio) return false;
    if (periodoFim && i.data > periodoFim) return false;
    return i.equipamentos?.modelo?.toLowerCase().includes(search.toLowerCase()) || i.descricao.toLowerCase().includes(search.toLowerCase());
  });

  const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  // Summary calcs
  const totalGastos = filtered.reduce((acc, i) => acc + Number(i.valor), 0);
  const deduzidos = filtered.filter(i => i.fatura);
  const totalDeduzido = deduzidos.reduce((acc, i) => acc + Number(i.valor), 0);
  const naoDeduzidos = filtered.filter(i => !i.fatura);
  const totalNaoDeduzido = naoDeduzidos.reduce((acc, i) => acc + Number(i.valor), 0);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Gasto) => {
    setEditing(item);
    setForm({ equipamento_id: item.equipamento_id, descricao: item.descricao, tipo: item.tipo, valor: item.valor, data: item.data });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipamento_id || !form.descricao) {
      toast({ title: "Campos obrigatórios", description: "Equipamento e Descrição são obrigatórios.", variant: "destructive" });
      return;
    }
    const payload = { ...form, valor: Number(form.valor) };
    if (editing) {
      const { error } = await supabase.from("gastos").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("gastos").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("gastos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchData();
  };

  const tipoColor = (t: string) => {
    if (t === "Manutenção") return "bg-primary/10 text-primary border-0";
    if (t === "Combustível") return "bg-warning/10 text-warning border-0";
    if (t === "Peças") return "bg-accent/10 text-accent border-0";
    return "bg-muted text-muted-foreground";
  };

  const faturaStatusColor = (status: string) => {
    if (status === "Pago") return "bg-success text-success-foreground";
    if (status === "Em Atraso") return "bg-destructive text-destructive-foreground";
    return "bg-warning/15 text-warning border-0";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Custos</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} custo(s) no período</p>
          </div>
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Custo
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Total de Custos
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
              <p className="text-2xl font-bold text-foreground">R$ {fmt(totalGastos)}</p>
              <p className="text-xs text-muted-foreground">{filtered.length} registros no período</p>
            </CardContent>
          </Card>
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileCheck className="h-4 w-4" /> Incluídos em Fatura
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
              <p className="text-2xl font-bold text-success">R$ {fmt(totalDeduzido)}</p>
              <p className="text-xs text-muted-foreground">{deduzidos.length} custo(s) incluído(s)</p>
            </CardContent>
          </Card>
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" /> Não Incluídos
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
              <p className="text-2xl font-bold text-destructive">R$ {fmt(totalNaoDeduzido)}</p>
              <p className="text-xs text-muted-foreground">{naoDeduzidos.length} custo(s) sem fatura</p>
            </CardContent>
          </Card>
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="space-y-1">
                {tiposGasto.map(t => {
                  const total = filtered.filter(i => i.tipo === t).reduce((a, i) => a + Number(i.valor), 0);
                  if (total === 0) return null;
                  return (
                    <div key={t} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t}</span>
                      <span className="font-medium text-foreground">R$ {fmt(total)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar custos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <SearchableSelect
            value={filterTag}
            onValueChange={setFilterTag}
            placeholder="Filtrar por Tag"
            searchPlaceholder="Pesquisar tag..."
            className="w-48"
            options={[
              { value: "Todos", label: "Todas as Tags" },
              ...uniqueTags.map((tag) => ({ value: tag, label: tag })),
            ]}
          />
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="w-36 h-9" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="w-36 h-9" />
            </div>
            {(periodoInicio || periodoFim) && (
              <Button variant="ghost" size="sm" onClick={() => { setPeriodoInicio(""); setPeriodoFim(""); }}>Limpar</Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Tag/Placa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Fatura</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</TableCell>
                    <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                    <TableCell className="text-sm">{item.descricao}</TableCell>
                    <TableCell><Badge className={tipoColor(item.tipo)}>{item.tipo}</Badge></TableCell>
                    <TableCell className="font-semibold text-sm">R$ {fmt(item.valor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(item.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      {item.fatura ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-foreground">Fatura #{item.fatura.numero_sequencial}</span>
                          <Badge className={`text-[10px] ${faturaStatusColor(item.fatura.status)}`}>{item.fatura.status}</Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum custo encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-accent" />{editing ? "Editar Custo" : "Novo Custo"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Equipamento</Label>
              <SearchableSelect
                value={form.equipamento_id}
                onValueChange={(v) => setForm({ ...form, equipamento_id: v })}
                placeholder="Selecione o equipamento"
                searchPlaceholder="Pesquisar equipamento..."
                options={equipamentos.map((e) => ({ value: e.id, label: `${e.tipo} ${e.modelo} ${e.tag_placa ? `(${e.tag_placa})` : ""}` }))}
              />
            </div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{tiposGasto.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Valor (R$)</Label><CurrencyInput value={form.valor} onValueChange={(v) => setForm({ ...form, valor: v })} /></div>
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Gastos;
