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
import { Plus, Search, Pencil, Trash2, DollarSign } from "lucide-react";

interface Gasto {
  id: string;
  equipamento: string;
  descricao: string;
  tipo: string;
  valor: number;
  data: string;
}

const initialData: Gasto[] = [
  { id: "1", equipamento: "Escavadeira CAT 320", descricao: "Troca de filtro de óleo", tipo: "Manutenção", valor: 1200, data: "2026-02-18" },
  { id: "2", equipamento: "Retroescavadeira JCB 3CX", descricao: "Abastecimento diesel - 500L", tipo: "Combustível", valor: 3250, data: "2026-02-17" },
  { id: "3", equipamento: "Pá Carregadeira 950H", descricao: "Troca de pneus dianteiros", tipo: "Peças", valor: 8500, data: "2026-02-15" },
  { id: "4", equipamento: "Escavadeira CAT 320", descricao: "Revisão geral 5000h", tipo: "Manutenção", valor: 4500, data: "2026-02-10" },
];

const tiposGasto = ["Manutenção", "Combustível", "Peças", "Transporte", "Outros"];
const emptyForm = { equipamento: "", descricao: "", tipo: "Manutenção", valor: 0, data: new Date().toISOString().split("T")[0] };

const Gastos = () => {
  const [items, setItems] = useState<Gasto[]>(initialData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Gasto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const filtered = items.filter((i) => i.equipamento.toLowerCase().includes(search.toLowerCase()) || i.descricao.toLowerCase().includes(search.toLowerCase()));
  const totalGastos = items.reduce((acc, i) => acc + i.valor, 0);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Gasto) => { setEditing(item); setForm(item); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.equipamento || !form.descricao) return;
    if (editing) {
      setItems(items.map((i) => (i.id === editing.id ? { ...i, ...form } : i)));
    } else {
      setItems([...items, { ...form, id: Date.now().toString() }]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => setItems(items.filter((i) => i.id !== id));

  const tipoColor = (t: string) => {
    if (t === "Manutenção") return "bg-primary/10 text-primary border-0";
    if (t === "Combustível") return "bg-warning/10 text-warning border-0";
    if (t === "Peças") return "bg-accent/10 text-accent border-0";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gastos</h1>
            <p className="text-sm text-muted-foreground">Total: <span className="text-destructive font-semibold">R$ {totalGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></p>
          </div>
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Gasto
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar gastos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.equipamento}</TableCell>
                    <TableCell className="text-sm">{item.descricao}</TableCell>
                    <TableCell><Badge className={tipoColor(item.tipo)}>{item.tipo}</Badge></TableCell>
                    <TableCell className="font-semibold text-sm">R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(item.data).toLocaleDateString("pt-BR")}</TableCell>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-accent" />{editing ? "Editar Gasto" : "Novo Gasto"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Equipamento</Label><Input value={form.equipamento} onChange={(e) => setForm({ ...form, equipamento: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{tiposGasto.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Valor (R$)</Label><Input type="number" value={form.valor || ""} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} /></div>
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
