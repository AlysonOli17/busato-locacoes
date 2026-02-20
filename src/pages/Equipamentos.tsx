import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

interface Equipment {
  id: string;
  tipo: string;
  modelo: string;
  numero_serie: string;
  tag_placa: string;
  observacoes: string;
  status: string;
}

const initialData: Equipment[] = [
  { id: "1", tipo: "Escavadeira", modelo: "CAT 320", numero_serie: "CAT320-2024-001", tag_placa: "EQ-001", observacoes: "Equipamento em ótimo estado", status: "Ativo" },
  { id: "2", tipo: "Retroescavadeira", modelo: "JCB 3CX", numero_serie: "JCB3CX-2023-045", tag_placa: "EQ-002", observacoes: "", status: "Ativo" },
  { id: "3", tipo: "Rolo Compactador", modelo: "BOMAG BW211", numero_serie: "BOM211-2022-012", tag_placa: "EQ-003", observacoes: "Manutenção preventiva em dia", status: "Manutenção" },
  { id: "4", tipo: "Pá Carregadeira", modelo: "CAT 950H", numero_serie: "CAT950-2024-008", tag_placa: "EQ-004", observacoes: "", status: "Ativo" },
  { id: "5", tipo: "Guindaste", modelo: "Liebherr LTM 1100", numero_serie: "LIE1100-2021-003", tag_placa: "EQ-005", observacoes: "Fora de operação", status: "Inativo" },
];

const emptyForm = { tipo: "", modelo: "", numero_serie: "", tag_placa: "", observacoes: "", status: "Ativo" };

const Equipamentos = () => {
  const [items, setItems] = useState<Equipment[]>(initialData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const filtered = items.filter(
    (i) => i.tipo.toLowerCase().includes(search.toLowerCase()) || i.modelo.toLowerCase().includes(search.toLowerCase()) || i.tag_placa.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Equipment) => { setEditing(item); setForm(item); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.tipo || !form.modelo) return;
    if (editing) {
      setItems(items.map((i) => (i.id === editing.id ? { ...i, ...form } : i)));
    } else {
      setItems([...items, { ...form, id: Date.now().toString() }]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => setItems(items.filter((i) => i.id !== id));

  const statusColor = (s: string) => {
    if (s === "Ativo") return "bg-success text-success-foreground";
    if (s === "Manutenção") return "bg-warning text-warning-foreground";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Equipamentos</h1>
            <p className="text-sm text-muted-foreground">{items.length} equipamentos cadastrados</p>
          </div>
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Equipamento
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar equipamentos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Nº Série</TableHead>
                  <TableHead>Tag / Placa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.tipo}</TableCell>
                    <TableCell>{item.modelo}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.numero_serie}</TableCell>
                    <TableCell className="font-mono text-sm">{item.tag_placa}</TableCell>
                    <TableCell><Badge className={statusColor(item.status)}>{item.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum equipamento encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipo</Label><Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="Ex: Escavadeira" /></div>
              <div><Label>Modelo</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Ex: CAT 320" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nº Série</Label><Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} /></div>
              <div><Label>Tag / Placa</Label><Input value={form.tag_placa} onChange={(e) => setForm({ ...form, tag_placa: e.target.value })} /></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} /></div>
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

export default Equipamentos;
