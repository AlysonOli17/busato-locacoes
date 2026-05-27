import { useState, useEffect, useMemo } from "react";
import { getEquipLabel } from "@/lib/utils";
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
import { SortableTableHead } from "@/components/SortableTableHead";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
interface FaturaRef {
  faturamento_id: string;
  numero_sequencial: number;
  numero_nota: string | null;
  status: string;
  periodo: string;
}
interface Gasto {
  id: string;
  equipamento_id: string;
  descricao: string;
  tipo: string;
  classificacao: string;
  valor: number;
  data: string;
  equipamentos: Equipamento;
  fatura?: FaturaRef | null;
}

const tiposGasto = ["Manutenção", "Combustível", "Peças", "Transporte", "Mobilização", "Desmobilização", "Outros"];
const classificacoes = ["A Cobrar do Cliente", "A Reembolsar ao Cliente"];
const emptyForm = { equipamento_id: "", descricao: "", tipo: "Manutenção", classificacao: "A Cobrar do Cliente", valor: 0, data: new Date().toISOString().split("T")[0] };

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
  const [sortCol, setSortCol] = useState("data");
  const [sortAsc, setSortAsc] = useState(false);
  const toggleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };

  const fetchData = async () => {
    const [gastosRes, equipRes, fatGastosRes, fatRes] = await Promise.all([
      supabase.from("gastos").select("*").order("data", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
      supabase.from("faturamento_gastos").select("gasto_id, faturamento_id"),
      supabase.from("faturamento").select("id, numero_sequencial, numero_nota, status, periodo")
    ]);

    const fatMap = new Map<string, FaturaRef>();
    if (fatGastosRes.data && fatRes.data) {
      const faturamentoMap = new Map(fatRes.data.map(f => [f.id, f]));
      for (const fg of fatGastosRes.data as any[]) {
        const fat = faturamentoMap.get(fg.faturamento_id) as any;
        if (fat) {
          fatMap.set(fg.gasto_id, {
            faturamento_id: fg.faturamento_id,
            numero_sequencial: fat.numero_sequencial,
            numero_nota: fat.numero_nota || null,
            status: fat.status,
            periodo: fat.periodo,
          });
        }
      }
    }

    if (equipRes.data) setEquipamentos(equipRes.data);

    if (gastosRes.data && equipRes.data) {
      const equipMap = new Map(equipRes.data.map((e: any) => [e.id, e]));
      const mapped = gastosRes.data.map((g: any) => ({
        ...g,
        equipamentos: equipMap.get(g.equipamento_id) || null,
        fatura: fatMap.get(g.id) || null,
      }));
      setItems(mapped as unknown as Gasto[]);
    }
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

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "equipamento": cmp = `${a.equipamentos?.tipo} ${a.equipamentos?.modelo}`.localeCompare(`${b.equipamentos?.tipo} ${b.equipamentos?.modelo}`); break;
        case "tag": cmp = (a.equipamentos?.tag_placa || "").localeCompare(b.equipamentos?.tag_placa || ""); break;
        case "descricao": cmp = a.descricao.localeCompare(b.descricao); break;
        case "tipo": cmp = a.tipo.localeCompare(b.tipo); break;
        case "classificacao": cmp = a.classificacao.localeCompare(b.classificacao); break;
        case "valor": cmp = Number(a.valor) - Number(b.valor); break;
        case "data": cmp = a.data.localeCompare(b.data); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortAsc]);

  const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  // Summary calcs - separate mobilização as revenue
  const mobTypes = ["Mobilização", "Desmobilização"];
  const gastosSemMob = filtered.filter(i => !mobTypes.includes(i.tipo));
  const gastosMob = filtered.filter(i => mobTypes.includes(i.tipo));
  const totalGastos = gastosSemMob.reduce((acc, i) => acc + Number(i.valor), 0);
  const totalMobilizacao = gastosMob.reduce((acc, i) => acc + Number(i.valor), 0);
  const deduzidos = gastosSemMob.filter(i => i.fatura);
  const totalDeduzido = deduzidos.reduce((acc, i) => acc + Number(i.valor), 0);
  const naoDeduzidos = gastosSemMob.filter(i => !i.fatura);
  const totalNaoDeduzido = naoDeduzidos.reduce((acc, i) => acc + Number(i.valor), 0);
  const mobDeduzidos = gastosMob.filter(i => i.fatura);
  const mobNaoDeduzidos = gastosMob.filter(i => !i.fatura);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Gasto) => {
    setEditing(item);
    setForm({ equipamento_id: item.equipamento_id, descricao: item.descricao, tipo: item.tipo, classificacao: item.classificacao || "A Cobrar do Cliente", valor: item.valor, data: item.data });
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
      if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Custo atualizado com sucesso" });
    } else {
      const payloadWithId = { ...payload, id: crypto.randomUUID() };
      const { error } = await supabase.from("gastos").insert([payloadWithId]);
      if (error) { toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Custo cadastrado com sucesso" });
    }
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
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
    if (t === "Mobilização") return "bg-success/10 text-success border-0";
    if (t === "Desmobilização") return "bg-destructive/10 text-destructive border-0";
    return "bg-muted text-muted-foreground";
  };

  const faturaStatusColor = (status: string) => {
    if (status === "Pago") return "bg-success text-success-foreground";
    if (status === "Em Atraso") return "bg-destructive text-destructive-foreground";
    return "bg-warning/15 text-warning border-0";
  };

  return (
    <Layout title="Custos" subtitle={`${filtered.length} custo(s) no período`}>
      <div className="space-y-6">



        {/* Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar custos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background" />
            </div>
            <SearchableSelect
              value={filterTag}
              onValueChange={setFilterTag}
              placeholder="Filtrar por Tag"
              searchPlaceholder="Pesquisar tag..."
              className="w-full sm:w-48 bg-background"
              options={[
                { value: "Todos", label: "Todas as Tags" },
                ...uniqueTags.map((tag) => ({ value: tag, label: tag })),
              ]}
            />
            <div className="flex items-center gap-2">
              <Input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="w-32 bg-background" />
              <span className="text-muted-foreground text-sm">até</span>
              <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="w-32 bg-background" />
              {(periodoInicio || periodoFim) && (
                <Button variant="ghost" size="sm" onClick={() => { setPeriodoInicio(""); setPeriodoFim(""); }}>Limpar</Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex gap-2"></div>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Novo
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="equipamento" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Equipamento</SortableTableHead>
                  <SortableTableHead column="tag" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Tag/Placa</SortableTableHead>
                  <SortableTableHead column="descricao" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Descrição</SortableTableHead>
                  <SortableTableHead column="tipo" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Tipo</SortableTableHead>
                  <SortableTableHead column="classificacao" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Classificação</SortableTableHead>
                  <SortableTableHead column="valor" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Valor</SortableTableHead>
                  <SortableTableHead column="data" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Data</SortableTableHead>
                  <TableHead>Fatura</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</TableCell>
                    <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                    <TableCell className="text-sm">{item.descricao}</TableCell>
                    <TableCell><Badge className={tipoColor(item.tipo)}>{item.tipo}</Badge></TableCell>
                    <TableCell>
                      <Badge className={item.classificacao === "A Reembolsar ao Cliente" ? "bg-destructive/10 text-destructive border-0" : "bg-success/10 text-success border-0"}>
                        {item.classificacao === "A Reembolsar ao Cliente" ? "Reembolsar" : "Cobrar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-sm">R$ {fmt(item.valor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      {item.fatura ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-foreground">Fatura {item.fatura.numero_nota || `#${item.fatura.numero_sequencial}`}</span>
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
                {!loading && sorted.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum custo encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-accent" />{editing ? "Editar Custo" : "Novo Custo"}</DialogTitle></DialogHeader>
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
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div>
              <Label>Classificação</Label>
              <Select value={form.classificacao} onValueChange={(v) => setForm({ ...form, classificacao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{classificacoes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
