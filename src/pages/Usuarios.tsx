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
import { Plus, Search, Pencil, Trash2, UserCog } from "lucide-react";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  created_at: string;
}

const initialData: Usuario[] = [
  { id: "1", nome: "Carlos Administrador", email: "carlos@locagest.com", perfil: "Administrador", status: "Ativo", created_at: "01/01/2025" },
  { id: "2", nome: "Ana Operadora", email: "ana@locagest.com", perfil: "Operador", status: "Ativo", created_at: "15/03/2025" },
  { id: "3", nome: "Pedro Visualizador", email: "pedro@locagest.com", perfil: "Visualizador", status: "Ativo", created_at: "20/05/2025" },
  { id: "4", nome: "Maria Técnica", email: "maria@locagest.com", perfil: "Operador", status: "Inativo", created_at: "10/02/2025" },
];

const emptyForm = { nome: "", email: "", perfil: "Operador", status: "Ativo" };

const Usuarios = () => {
  const [items, setItems] = useState<Usuario[]>(initialData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const filtered = items.filter((i) => i.nome.toLowerCase().includes(search.toLowerCase()) || i.email.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Usuario) => { setEditing(item); setForm(item); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.nome || !form.email) return;
    if (editing) {
      setItems(items.map((i) => (i.id === editing.id ? { ...i, ...form } : i)));
    } else {
      setItems([...items, { ...form, id: Date.now().toString(), created_at: new Date().toLocaleDateString("pt-BR") }]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => setItems(items.filter((i) => i.id !== id));

  const perfilColor = (p: string) => {
    if (p === "Administrador") return "bg-primary text-primary-foreground";
    if (p === "Operador") return "bg-accent/10 text-accent border-0";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
            <p className="text-sm text-muted-foreground">{items.length} usuários cadastrados</p>
          </div>
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Usuário
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar usuários..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.email}</TableCell>
                    <TableCell><Badge className={perfilColor(item.perfil)}>{item.perfil}</Badge></TableCell>
                    <TableCell>
                      <Badge className={item.status === "Ativo" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
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
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-accent" />{editing ? "Editar Usuário" : "Novo Usuário"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Perfil</Label>
                <Select value={form.perfil} onValueChange={(v) => setForm({ ...form, perfil: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                    <SelectItem value="Operador">Operador</SelectItem>
                    <SelectItem value="Visualizador">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

export default Usuarios;
