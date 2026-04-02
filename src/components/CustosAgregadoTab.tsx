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
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Equipamento {
  id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null;
}

interface CustoItem {
  id: string;
  custo_id: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  valor: number;
}

interface CustoAgregado {
  id: string;
  equipamento_id: string;
  data: string;
  valor: number;
  os_numero_compra: string;
  observacoes: string | null;
  equipamentos: Equipamento;
  itens: CustoItem[];
}

interface FormItem {
  id?: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
}

const emptyForm = {
  equipamento_id: "",
  data: new Date().toISOString().split("T")[0],
  os_numero_compra: "",
  observacoes: "",
};

const emptyItem: FormItem = { descricao: "", quantidade: 1, preco_unitario: 0 };

export const CustosAgregadoTab = () => {
  const [items, setItems] = useState<CustoAgregado[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formItems, setFormItems] = useState<FormItem[]>([{ ...emptyItem }]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterEquip, setFilterEquip] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [sortCol, setSortCol] = useState<string>("data");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchData = async () => {
    const [{ data: custos }, { data: equips }] = await Promise.all([
      supabase.from("custos_agregados").select("*, equipamentos(id, tipo, modelo, tag_placa, numero_serie)").order("data", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie"),
    ]);
    if (custos && custos.length > 0) {
      const custoIds = custos.map((c: any) => c.id);
      const { data: allItens } = await supabase.from("custos_agregados_itens").select("*").in("custo_id", custoIds);
      const itensMap = new Map<string, CustoItem[]>();
      (allItens || []).forEach((it: any) => {
        const list = itensMap.get(it.custo_id) || [];
        list.push(it);
        itensMap.set(it.custo_id, list);
      });
      setItems(custos.map((c: any) => ({ ...c, itens: itensMap.get(c.id) || [] })) as unknown as CustoAgregado[]);
    } else {
      setItems([]);
    }
    if (equips) setEquipamentos(equips);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (filterEquip) list = list.filter(i => i.equipamento_id === filterEquip);
    if (periodFrom) list = list.filter(i => i.data >= periodFrom);
    if (periodTo) list = list.filter(i => i.data <= periodTo);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(i =>
        i.os_numero_compra.toLowerCase().includes(s) ||
        getEquipLabel(i.equipamentos).toLowerCase().includes(s) ||
        i.itens.some(it => it.descricao.toLowerCase().includes(s))
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
        case "valor": cmp = a.valor - b.valor; break;
        case "os": cmp = a.os_numero_compra.localeCompare(b.os_numero_compra); break;
        case "itens": cmp = a.itens.length - b.itens.length; break;
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

  const formTotal = useMemo(() =>
    formItems.reduce((s, it) => s + it.quantidade * it.preco_unitario, 0),
    [formItems]
  );

  const addItem = () => setFormItems(prev => [...prev, { ...emptyItem }]);

  const removeItem = (idx: number) => {
    if (formItems.length <= 1) return;
    setFormItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof FormItem, value: any) => {
    setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const handleSave = async () => {
    if (!form.equipamento_id) {
      toast({ title: "Selecione o equipamento", variant: "destructive" });
      return;
    }
    const validItems = formItems.filter(it => it.descricao.trim());
    if (validItems.length === 0) {
      toast({ title: "Adicione ao menos um item com descrição", variant: "destructive" });
      return;
    }
    const totalValue = validItems.reduce((s, it) => s + it.quantidade * it.preco_unitario, 0);
    const payload = {
      equipamento_id: form.equipamento_id,
      data: form.data,
      valor: totalValue,
      os_numero_compra: form.os_numero_compra,
      observacoes: form.observacoes || null,
    };

    if (editing) {
      const { error } = await supabase.from("custos_agregados").update(payload).eq("id", editing);
      if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return; }
      // Delete old items and re-insert
      await supabase.from("custos_agregados_itens").delete().eq("custo_id", editing);
      const itensPayload = validItems.map(it => ({
        custo_id: editing,
        descricao: it.descricao,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
        valor: it.quantidade * it.preco_unitario,
      }));
      const { error: errItens } = await supabase.from("custos_agregados_itens").insert(itensPayload);
      if (errItens) { toast({ title: "Erro ao salvar itens", description: errItens.message, variant: "destructive" }); return; }
      toast({ title: "Custo atualizado" });
    } else {
      const { data: newCusto, error } = await supabase.from("custos_agregados").insert(payload).select("id").single();
      if (error || !newCusto) { toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" }); return; }
      const itensPayload = validItems.map(it => ({
        custo_id: newCusto.id,
        descricao: it.descricao,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
        valor: it.quantidade * it.preco_unitario,
      }));
      const { error: errItens } = await supabase.from("custos_agregados_itens").insert(itensPayload);
      if (errItens) { toast({ title: "Erro ao salvar itens", description: errItens.message, variant: "destructive" }); return; }
      toast({ title: "Custo registrado" });
    }
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setFormItems([{ ...emptyItem }]);
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
      os_numero_compra: item.os_numero_compra,
      observacoes: item.observacoes || "",
    });
    setFormItems(item.itens.length > 0
      ? item.itens.map(it => ({ id: it.id, descricao: it.descricao, quantidade: it.quantidade, preco_unitario: it.preco_unitario }))
      : [{ ...emptyItem }]
    );
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormItems([{ ...emptyItem }]);
    setDialogOpen(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
              <TableHead className="w-10" />
              <SortableTableHead column="equipamento" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Equipamento</SortableTableHead>
              <SortableTableHead column="data" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Data</SortableTableHead>
              <SortableTableHead column="os" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>OS / Nº Compra</SortableTableHead>
              <SortableTableHead column="itens" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Itens</SortableTableHead>
              <SortableTableHead column="valor" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Valor Total</SortableTableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum custo encontrado</TableCell></TableRow>
            ) : sorted.map(item => (
              <>
                <TableRow key={item.id} className="cursor-pointer" onClick={() => toggleExpand(item.id)}>
                  <TableCell className="px-2">
                    {expandedRows.has(item.id)
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                  </TableCell>
                  <TableCell className="font-medium">{getEquipLabel(item.equipamentos)}</TableCell>
                  <TableCell>{format(new Date(item.data + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{item.os_numero_compra}</TableCell>
                  <TableCell className="text-center">{item.itens.length}</TableCell>
                  <TableCell className="font-semibold">R$ {fmt(item.valor)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedRows.has(item.id) && item.itens.length > 0 && (
                  <TableRow key={`${item.id}-detail`}>
                    <TableCell colSpan={7} className="p-0">
                      <div className="bg-muted/30 px-8 py-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="text-center w-20">Qtd</TableHead>
                              <TableHead className="w-32">Preço Unit.</TableHead>
                              <TableHead className="w-32">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {item.itens.map(it => (
                              <TableRow key={it.id}>
                                <TableCell>{it.descricao}</TableCell>
                                <TableCell className="text-center">{it.quantidade}</TableCell>
                                <TableCell>R$ {fmt(it.preco_unitario)}</TableCell>
                                <TableCell className="font-semibold">R$ {fmt(it.valor)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle>{editing ? "Editar Custo" : "Novo Custo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
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

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Itens</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1">
                  <Plus className="h-3 w-3" /> Adicionar Item
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição *</TableHead>
                      <TableHead className="w-20">Qtd</TableHead>
                      <TableHead className="w-36">Preço Unit.</TableHead>
                      <TableHead className="w-28">Valor</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formItems.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="p-1">
                          <Input
                            value={it.descricao}
                            onChange={e => updateItem(idx, "descricao", e.target.value)}
                            placeholder="Descrição do item"
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            min={1}
                            value={it.quantidade}
                            onChange={e => updateItem(idx, "quantidade", Number(e.target.value) || 1)}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <CurrencyInput
                            value={it.preco_unitario}
                            onValueChange={v => updateItem(idx, "preco_unitario", v)}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input disabled value={`R$ ${fmt(it.quantidade * it.preco_unitario)}`} className="h-9 bg-muted font-semibold" />
                        </TableCell>
                        <TableCell className="p-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(idx)}
                            disabled={formItems.length <= 1}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold p-2">Total:</TableCell>
                      <TableCell className="font-bold text-primary p-2">R$ {fmt(formTotal)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Salvar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente excluir este custo e todos seus itens?</AlertDialogDescription>
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
