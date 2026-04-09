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
import { CurrencyInput } from "@/components/CurrencyInput";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
interface Custo {
  id: string; equipamento_id: string; data: string; valor: number; descricao: string;
  tipo: string; classificacao: string; observacoes: string | null; equipment: Equipamento;
}

const tiposGasto = ["Manutenção", "Frete", "Combustível", "Mobilização", "Desmobilização", "Outros"];
const classificacoes = ["A Cobrar do Cliente", "A Reembolsar ao Cliente"];
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getLabel = (eq: Equipamento | null) => {
  if (!eq) return "—";
  let l = `${eq.tipo} ${eq.modelo}`.trim();
  if (eq.tag_placa) l += ` (${eq.tag_placa})`;
  if (eq.numero_serie) l += ` - NS: ${eq.numero_serie}`;
  return l;
};

export const CustosTerceirosTab = () => {
  const [items, setItems] = useState<Custo[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [filtroEquip, setFiltroEquip] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { toast } = useToast();

  const [form, setForm] = useState({
    id: "", equipamento_id: "", data: new Date().toISOString().slice(0, 10),
    valor: 0, descricao: "", tipo: "Manutenção", classificacao: "A Cobrar do Cliente", observacoes: "",
  });

  const fetchData = async () => {
    const [cRes, eqRes] = await Promise.all([
      supabase.from("custos_terceiros").select("*, equipamentos_terceiros(id, tipo, modelo, tag_placa, numero_serie)").order("data", { ascending: false }),
      supabase.from("equipamentos_terceiros").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
    ]);
    if (cRes.data) setItems(cRes.data.map((c: any) => ({ ...c, equipment: c.equipamentos_terceiros })));
    if (eqRes.data) setEquipamentos(eqRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return items.filter(i => {
      if (filtroEquip && i.equipamento_id !== filtroEquip) return false;
      if (dataInicio && i.data < dataInicio) return false;
      if (dataFim && i.data > dataFim) return false;
      if (s && ![i.descricao, i.tipo, i.observacoes].some(v => v?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [items, filtroEquip, dataInicio, dataFim, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortCol === "valor") return sortDir === "asc" ? a.valor - b.valor : b.valor - a.valor;
      if (sortCol === "equipamento") { const av = getLabel(a.equipment); const bv = getLabel(b.equipment); return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av); }
      const av = String((a as any)[sortCol] ?? ""); const bv = String((b as any)[sortCol] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const totalValor = useMemo(() => filtered.reduce((s, c) => s + c.valor, 0), [filtered]);

  const openNew = () => {
    setForm({ id: "", equipamento_id: "", data: new Date().toISOString().slice(0, 10), valor: 0, descricao: "", tipo: "Manutenção", classificacao: "A Cobrar do Cliente", observacoes: "" });
    setEditing(false); setDialogOpen(true);
  };
  const openEdit = (item: Custo) => {
    setForm({ id: item.id, equipamento_id: item.equipamento_id, data: item.data, valor: item.valor, descricao: item.descricao, tipo: item.tipo, classificacao: item.classificacao, observacoes: item.observacoes ?? "" });
    setEditing(true); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipamento_id || !form.descricao.trim()) { toast({ title: "Equipamento e descrição obrigatórios", variant: "destructive" }); return; }
    const payload: any = {
      equipamento_id: form.equipamento_id, data: form.data, valor: form.valor,
      descricao: form.descricao, tipo: form.tipo, classificacao: form.classificacao,
      observacoes: form.observacoes || null,
    };
    if (editing) {
      await supabase.from("custos_terceiros").update(payload).eq("id", form.id);
      toast({ title: "Custo atualizado" });
    } else {
      await supabase.from("custos_terceiros").insert(payload);
      toast({ title: "Custo registrado" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("custos_terceiros").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Custo excluído" });
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Custo</Button>
        <div className="flex-1" />
        <SearchableSelect value={filtroEquip} onValueChange={setFiltroEquip} placeholder="Todos equipamentos" options={[{ value: "", label: "Todos" }, ...equipamentos.map(e => ({ value: e.id, label: getLabel(e) }))]} />
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-36 h-9" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-36 h-9" />
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Registros</p><p className="text-lg font-bold">{filtered.length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">R$ {fmt(totalValor)}</p></CardContent></Card>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="data"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Data</SortableTableHead>
              <SortableTableHead column="equipamento"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Equipamento</SortableTableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <SortableTableHead column="valor"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Valor</SortableTableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(item => (
              <TableRow key={item.id}>
                <TableCell>{new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">{getLabel(item.equipment)}</TableCell>
                <TableCell className="max-w-[200px] truncate">{item.descricao}</TableCell>
                <TableCell>{item.tipo}</TableCell>
                <TableCell>R$ {fmt(item.valor)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum custo registrado</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Editar Custo" : "Novo Custo"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Equipamento *</Label>
              <SearchableSelect value={form.equipamento_id} onValueChange={v => setForm(f => ({ ...f, equipamento_id: v }))} placeholder="Selecione..." options={equipamentos.map(e => ({ value: e.id, label: getLabel(e) }))} />
            </div>
            <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></div>
            <div><Label>Valor *</Label><CurrencyInput value={form.valor} onValueChange={v => setForm(f => ({ ...f, valor: v }))} /></div>
            <div className="sm:col-span-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{tiposGasto.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Classificação</Label>
              <Select value={form.classificacao} onValueChange={v => setForm(f => ({ ...f, classificacao: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{classificacoes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir custo?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
