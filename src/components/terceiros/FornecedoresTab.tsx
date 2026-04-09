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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  contato: string;
  telefone: string;
  email: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_cep: string;
  observacoes: string;
  status: string;
}

const emptyForm: Fornecedor = {
  id: "", nome: "", cnpj: "", razao_social: "", nome_fantasia: "",
  contato: "", telefone: "", email: "",
  endereco_logradouro: "", endereco_numero: "", endereco_complemento: "",
  endereco_bairro: "", endereco_cidade: "", endereco_uf: "", endereco_cep: "",
  observacoes: "", status: "Ativa",
};

const formatCNPJ = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

export const FornecedoresTab = () => {
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Fornecedor>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from("fornecedores").select("*").order("created_at", { ascending: false });
    if (data) setItems(data as any);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return items.filter(i => [i.nome, i.cnpj, i.nome_fantasia, i.razao_social, i.contato].some(v => v?.toLowerCase().includes(s)));
  }, [items, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortCol] ?? "";
      const bv = (b as any)[sortCol] ?? "";
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const openNew = () => { setForm(emptyForm); setEditing(false); setDialogOpen(true); };
  const openEdit = (item: Fornecedor) => { setForm(item); setEditing(true); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    const payload = { ...form } as any;
    delete payload.id;
    if (editing) {
      await supabase.from("fornecedores").update(payload).eq("id", form.id);
      toast({ title: "Fornecedor atualizado" });
    } else {
      await supabase.from("fornecedores").insert(payload);
      toast({ title: "Fornecedor cadastrado" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("fornecedores").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Fornecedor excluído" });
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Fornecedor</Button>
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
              <SortableTableHead column="nome"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Nome</SortableTableHead>
              <SortableTableHead column="cnpj"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>CNPJ</SortableTableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.nome}</TableCell>
                <TableCell>{item.cnpj}</TableCell>
                <TableCell>{item.contato}</TableCell>
                <TableCell>{item.telefone}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum fornecedor cadastrado</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: formatCNPJ(e.target.value) }))} /></div>
            <div><Label>Razão Social</Label><Input value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} /></div>
            <div><Label>Nome Fantasia</Label><Input value={form.nome_fantasia} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} /></div>
            <div><Label>Contato</Label><Input value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
            <div><Label>E-mail</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Ativa">Ativa</SelectItem><SelectItem value="Inativa">Inativa</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Logradouro</Label><Input value={form.endereco_logradouro} onChange={e => setForm(f => ({ ...f, endereco_logradouro: e.target.value }))} /></div>
            <div><Label>Número</Label><Input value={form.endereco_numero} onChange={e => setForm(f => ({ ...f, endereco_numero: e.target.value }))} /></div>
            <div><Label>Complemento</Label><Input value={form.endereco_complemento} onChange={e => setForm(f => ({ ...f, endereco_complemento: e.target.value }))} /></div>
            <div><Label>Bairro</Label><Input value={form.endereco_bairro} onChange={e => setForm(f => ({ ...f, endereco_bairro: e.target.value }))} /></div>
            <div><Label>Cidade</Label><Input value={form.endereco_cidade} onChange={e => setForm(f => ({ ...f, endereco_cidade: e.target.value }))} /></div>
            <div><Label>UF</Label><Input value={form.endereco_uf} onChange={e => setForm(f => ({ ...f, endereco_uf: e.target.value }))} maxLength={2} /></div>
            <div><Label>CEP</Label><Input value={form.endereco_cep} onChange={e => setForm(f => ({ ...f, endereco_cep: e.target.value }))} /></div>
            <div className="sm:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
