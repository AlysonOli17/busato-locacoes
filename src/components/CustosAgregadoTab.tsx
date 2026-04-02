import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { getEquipLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/CurrencyInput";
import { SortableTableHead } from "@/components/SortableTableHead";
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Equipamento {
  id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null;
}

interface CustoAgregado {
  id: string;
  equipamento_id: string;
  data: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  valor: number;
  os_numero_compra: string;
  observacoes: string | null;
  equipamentos: Equipamento;
}

const emptyForm = {
  equipamento_id: "",
  data: new Date().toISOString().split("T")[0],
  descricao: "",
  quantidade: 1,
  preco_unitario: 0,
  valor: 0,
  os_numero_compra: "",
  observacoes: "",
};

export const CustosAgregadoTab = () => {
  const [items, setItems] = useState<CustoAgregado[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterEquip, setFilterEquip] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [sortCol, setSortCol] = useState<string>("data");
  const [sortAsc, setSortAsc] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    const [{ data: custos }, { data: equips }] = await Promise.all([
      supabase.from("custos_agregados").select("*, equipamentos(id, tipo, modelo, tag_placa, numero_serie)").order("data", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie"),
    ]);
    if (custos) setItems(custos as unknown as CustoAgregado[]);
    if (equips) setEquipamentos(equips);
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-calculate valor when quantidade or preco_unitario changes
  useEffect(() => {
    setForm(f => ({ ...f, valor: f.quantidade * f.preco_unitario }));
  }, [form.quantidade, form.preco_unitario]);

  const filtered = useMemo(() => {
    let list = items;
    if (filterEquip) list = list.filter(i => i.equipamento_id === filterEquip);
    if (periodFrom) list = list.filter(i => i.data >= periodFrom);
    if (periodTo) list = list.filter(i => i.data <= periodTo);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(i =>
        i.descricao.toLowerCase().includes(s) ||
        i.os_numero_compra.toLowerCase().includes(s) ||
        getEquipLabel(i.equipamentos).toLowerCase().includes(s)
      );
    }
    return list;
  }, [items, filterEquip, periodFrom, periodTo, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "equipamento": cmp = getEquipLabel(a.equipamentos).localeCompare(getEquipLabel(b.equipamentos)); break;
        case "data": cmp = a.data.localeCompare(b.data); break;
        case "descricao": cmp = a.descricao.localeCompare(b.descricao); break;
        case "quantidade": cmp = a.quantidade - b.quantidade; break;
        case "preco_unitario": cmp = a.preco_unitario - b.preco_unitario; break;
        case "valor": cmp = a.valor - b.valor; break;
        case "os": cmp = a.os_numero_compra.localeCompare(b.os_numero_compra); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortAsc]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const totalValor = useMemo(() => filtered.reduce((s, i) => s + i.valor, 0), [filtered]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSave = async (keepOpen = false) => {
    if (!form.equipamento_id || !form.descricao) {
      toast({ title: "Preencha equipamento e descrição", variant: "destructive" });
      return;
    }
    const payload = {
      equipamento_id: form.equipamento_id,
      data: form.data,
      descricao: form.descricao,
      quantidade: form.quantidade,
      preco_unitario: form.preco_unitario,
      valor: form.quantidade * form.preco_unitario,
      os_numero_compra: form.os_numero_compra,
      observacoes: form.observacoes || null,
    };
    if (editing) {
      const { error } = await supabase.from("custos_agregados").update(payload).eq("id", editing);
      if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Custo atualizado" });
    } else {
      const { error } = await supabase.from("custos_agregados").insert(payload);
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Custo registrado" });
    }
    if (keepOpen && !editing) {
      setForm(f => ({ ...emptyForm, equipamento_id: f.equipamento_id, data: f.data, os_numero_compra: f.os_numero_compra }));
    } else {
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    }
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("custos_agregados").delete().eq("id", deleteId);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Custo excluído" });
    setDeleteId(null);
    fetchData();
  };

  const openEdit = (item: CustoAgregado) => {
    setEditing(item.id);
    setForm({
      equipamento_id: item.equipamento_id,
      data: item.data,
      descricao: item.descricao,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      valor: item.valor,
      os_numero_compra: item.os_numero_compra,
      observacoes: item.observacoes || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const equipOptions = equipamentos.map(e => ({ value: e.id, label: getEquipLabel(e) }));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total de Registros</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">R$ {fmt(totalValor)}</div></CardContent>
        </Card>
        <Card className="flex items-center justify-center">
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Custo</Button>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-60">
          <Label className="text-xs">Equipamento</Label>
          <SearchableSelect options={[{ value: "", label: "Todos" }, ...equipOptions]} value={filterEquip} onValueChange={setFilterEquip} placeholder="Todos" />
        </div>
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="w-36" />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="w-36" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs">Busca</Label>
          <Input placeholder="Descrição, OS, equipamento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="equipamento" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Equipamento</SortableTableHead>
              <SortableTableHead column="data" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Data</SortableTableHead>
              <SortableTableHead column="descricao" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Descrição</SortableTableHead>
              <SortableTableHead column="quantidade" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Qtd</SortableTableHead>
              <SortableTableHead column="preco_unitario" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Preço Unit.</SortableTableHead>
              <SortableTableHead column="valor" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Valor</SortableTableHead>
              <SortableTableHead column="os" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>OS / Nº Compra</SortableTableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum custo encontrado</TableCell></TableRow>
            ) : sorted.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{getEquipLabel(item.equipamentos)}</TableCell>
                <TableCell>{format(new Date(item.data + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                <TableCell>{item.descricao}</TableCell>
                <TableCell className="text-center">{item.quantidade}</TableCell>
                <TableCell>R$ {fmt(item.preco_unitario)}</TableCell>
                <TableCell className="font-semibold">R$ {fmt(item.valor)}</TableCell>
                <TableCell>{item.os_numero_compra}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Custo" : "Novo Custo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Equipamento *</Label>
              <SearchableSelect options={equipOptions} value={form.equipamento_id} onValueChange={v => setForm(f => ({ ...f, equipamento_id: v }))} placeholder="Selecione o equipamento" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data *</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div>
                <Label>OS / Nº Compra</Label>
                <Input value={form.os_numero_compra} onChange={e => setForm(f => ({ ...f, os_numero_compra: e.target.value }))} placeholder="Ex: OS-123" />
              </div>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição do custo" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min={1} value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: Number(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label>Preço Unitário</Label>
                <CurrencyInput value={form.preco_unitario} onValueChange={v => setForm(f => ({ ...f, preco_unitario: v }))} />
              </div>
              <div>
                <Label>Valor Total</Label>
                <Input disabled value={`R$ ${fmt(form.quantidade * form.preco_unitario)}`} className="bg-muted font-semibold" />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            {!editing && (
              <Button variant="secondary" onClick={() => handleSave(true)}>Registrar e Novo</Button>
            )}
            <Button onClick={() => handleSave(false)}>{editing ? "Salvar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente excluir este custo?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
