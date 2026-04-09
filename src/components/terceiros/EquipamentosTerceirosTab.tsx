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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

interface Fornecedor { id: string; nome: string; }
interface Equipamento {
  id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null;
  ano: number | null; observacoes: string | null; status: string; fornecedor_id: string | null;
  fornecedor?: Fornecedor | null;
}

const emptyForm = {
  id: "", tipo: "", modelo: "", tag_placa: "", numero_serie: "",
  ano: null as number | null, observacoes: "", status: "Ativo", fornecedor_id: "",
};

export const EquipamentosTerceirosTab = () => {
  const [items, setItems] = useState<Equipamento[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState("tipo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

  const fetchData = async () => {
    const [eqRes, fornRes] = await Promise.all([
      supabase.from("equipamentos_terceiros").select("*, fornecedores(id, nome)").order("created_at", { ascending: false }),
      supabase.from("fornecedores").select("id, nome").order("nome"),
    ]);
    if (eqRes.data) setItems(eqRes.data.map((e: any) => ({ ...e, fornecedor: e.fornecedores })));
    if (fornRes.data) setFornecedores(fornRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return items.filter(i => [i.tipo, i.modelo, i.tag_placa, i.numero_serie, i.fornecedor?.nome].some(v => v?.toLowerCase().includes(s)));
  }, [items, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string, bv: string;
      if (sortCol === "fornecedor") { av = a.fornecedor?.nome ?? ""; bv = b.fornecedor?.nome ?? ""; }
      else { av = String((a as any)[sortCol] ?? ""); bv = String((b as any)[sortCol] ?? ""); }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const openNew = () => { setForm(emptyForm); setEditing(false); setDialogOpen(true); };
  const openEdit = (item: Equipamento) => { setForm({ ...item, tag_placa: item.tag_placa ?? "", numero_serie: item.numero_serie ?? "", observacoes: item.observacoes ?? "", fornecedor_id: item.fornecedor_id ?? "" }); setEditing(true); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.tipo.trim() || !form.modelo.trim()) { toast({ title: "Tipo e Modelo obrigatórios", variant: "destructive" }); return; }
    const payload: any = {
      tipo: form.tipo, modelo: form.modelo, tag_placa: form.tag_placa || null,
      numero_serie: form.numero_serie || null, ano: form.ano, observacoes: form.observacoes,
      status: form.status, fornecedor_id: form.fornecedor_id || null,
    };
    if (editing) {
      await supabase.from("equipamentos_terceiros").update(payload).eq("id", form.id);
      toast({ title: "Equipamento atualizado" });
    } else {
      await supabase.from("equipamentos_terceiros").insert(payload);
      toast({ title: "Equipamento cadastrado" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("equipamentos_terceiros").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Equipamento excluído" });
    fetchData();
  };

  const getLabel = (e: Equipamento) => {
    let l = `${e.tipo} ${e.modelo}`.trim();
    if (e.tag_placa) l += ` (${e.tag_placa})`;
    if (e.numero_serie) l += ` - NS: ${e.numero_serie}`;
    return l || "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Equipamento</Button>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="tipo"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Tipo</SortableTableHead>
              <SortableTableHead column="modelo"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Modelo</SortableTableHead>
              <TableHead>Placa/Tag</TableHead>
              <TableHead>Nº Série</TableHead>
              <SortableTableHead column="fornecedor"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Fornecedor</SortableTableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.tipo}</TableCell>
                <TableCell>{item.modelo}</TableCell>
                <TableCell>{item.tag_placa || "—"}</TableCell>
                <TableCell>{item.numero_serie || "—"}</TableCell>
                <TableCell>{item.fornecedor?.nome || "—"}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum equipamento cadastrado</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Tipo *</Label><Input value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} /></div>
            <div><Label>Modelo *</Label><Input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} /></div>
            <div><Label>Placa/Tag</Label><Input value={form.tag_placa} onChange={e => setForm(f => ({ ...f, tag_placa: e.target.value }))} /></div>
            <div><Label>Nº Série</Label><Input value={form.numero_serie} onChange={e => setForm(f => ({ ...f, numero_serie: e.target.value }))} /></div>
            <div><Label>Ano</Label><Input type="number" value={form.ano ?? ""} onChange={e => setForm(f => ({ ...f, ano: e.target.value ? Number(e.target.value) : null }))} /></div>
            <div>
              <Label>Fornecedor</Label>
              <SearchableSelect value={form.fornecedor_id} onValueChange={v => setForm(f => ({ ...f, fornecedor_id: v }))} placeholder="Selecione..." options={fornecedores.map(f => ({ value: f.id, label: f.nome }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir equipamento?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
