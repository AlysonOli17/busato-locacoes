import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

interface Empresa {
  id: string;
  cnpj: string;
  nome: string;
  contato: string;
  telefone: string;
  status: string;
  created_at: string;
}

const initialData: Empresa[] = [
  { id: "1", cnpj: "12.345.678/0001-90", nome: "Construtora Alpha Ltda", contato: "João Silva", telefone: "(11) 99999-0001", status: "Ativa", created_at: "10/01/2025" },
  { id: "2", cnpj: "98.765.432/0001-10", nome: "Terraplenagem Beta S/A", contato: "Maria Santos", telefone: "(21) 98888-0002", status: "Ativa", created_at: "15/03/2025" },
  { id: "3", cnpj: "11.222.333/0001-44", nome: "Engenharia Gamma Eireli", contato: "Carlos Oliveira", telefone: "(31) 97777-0003", status: "Inativa", created_at: "20/06/2024" },
  { id: "4", cnpj: "55.666.777/0001-88", nome: "Pavimentação Delta Ltda", contato: "Ana Costa", telefone: "(41) 96666-0004", status: "Ativa", created_at: "05/11/2025" },
];

const emptyForm = { cnpj: "", nome: "", contato: "", telefone: "", status: "Ativa" };

const Empresas = () => {
  const [items, setItems] = useState<Empresa[]>(initialData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const filtered = items.filter(
    (i) => i.nome.toLowerCase().includes(search.toLowerCase()) || i.cnpj.includes(search)
  );

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Empresa) => { setEditing(item); setForm(item); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.cnpj || !form.nome) return;
    if (editing) {
      setItems(items.map((i) => (i.id === editing.id ? { ...i, ...form } : i)));
    } else {
      setItems([...items, { ...form, id: Date.now().toString(), created_at: new Date().toLocaleDateString("pt-BR") }]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => setItems(items.filter((i) => i.id !== id));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
            <p className="text-sm text-muted-foreground">{items.length} empresas cadastradas</p>
          </div>
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Empresa
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.cnpj}</TableCell>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell className="text-sm">{item.contato}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.telefone}</TableCell>
                    <TableCell>
                      <Badge className={item.status === "Ativa" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.created_at}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" /></div>
              <div><Label>Nome da Empresa</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Contato</Label><Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
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

export default Empresas;
