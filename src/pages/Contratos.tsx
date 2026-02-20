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
import { Plus, Search, Pencil, Trash2, FileText } from "lucide-react";

interface Contrato {
  id: string;
  empresa: string;
  cnpj: string;
  equipamento: string;
  valor_hora: number;
  horas_contratadas: number;
  data_inicio: string;
  data_fim: string;
  observacoes: string;
  status: string;
}

const initialData: Contrato[] = [
  { id: "1", empresa: "Construtora Alpha Ltda", cnpj: "12.345.678/0001-90", equipamento: "Escavadeira CAT 320", valor_hora: 250, horas_contratadas: 200, data_inicio: "2026-02-01", data_fim: "2026-07-31", observacoes: "Contrato com renovação automática", status: "Ativo" },
  { id: "2", empresa: "Terraplenagem Beta S/A", cnpj: "98.765.432/0001-10", equipamento: "Retroescavadeira JCB 3CX", valor_hora: 180, horas_contratadas: 160, data_inicio: "2026-01-15", data_fim: "2026-06-15", observacoes: "", status: "Ativo" },
  { id: "3", empresa: "Engenharia Gamma Eireli", cnpj: "11.222.333/0001-44", equipamento: "Rolo Compactador BOMAG", valor_hora: 200, horas_contratadas: 120, data_inicio: "2025-06-01", data_fim: "2025-12-31", observacoes: "Contrato encerrado", status: "Encerrado" },
];

const emptyForm = { empresa: "", cnpj: "", equipamento: "", valor_hora: 0, horas_contratadas: 0, data_inicio: "", data_fim: "", observacoes: "", status: "Ativo" };

const Contratos = () => {
  const [items, setItems] = useState<Contrato[]>(initialData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const filtered = items.filter(
    (i) => i.empresa.toLowerCase().includes(search.toLowerCase()) || i.cnpj.includes(search) || i.equipamento.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Contrato) => { setEditing(item); setForm(item); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.empresa || !form.equipamento) return;
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
    if (s === "Encerrado") return "bg-muted text-muted-foreground";
    return "bg-warning text-warning-foreground";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
            <p className="text-sm text-muted-foreground">{items.length} contratos cadastrados</p>
          </div>
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Contrato
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar contratos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Valor/Hora</TableHead>
                  <TableHead>Horas Contratadas</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.empresa}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.cnpj}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.equipamento}</TableCell>
                    <TableCell className="font-semibold text-sm text-accent">R$ {item.valor_hora.toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{item.horas_contratadas}h</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.data_inicio).toLocaleDateString("pt-BR")} - {new Date(item.data_fim).toLocaleDateString("pt-BR")}
                    </TableCell>
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
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum contrato encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-accent" />{editing ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Empresa</Label><Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} /></div>
              <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" /></div>
            </div>
            <div><Label>Equipamento</Label><Input value={form.equipamento} onChange={(e) => setForm({ ...form, equipamento: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor por Hora (R$)</Label><Input type="number" value={form.valor_hora} onChange={(e) => setForm({ ...form, valor_hora: Number(e.target.value) })} /></div>
              <div><Label>Horas Contratadas</Label><Input type="number" value={form.horas_contratadas} onChange={(e) => setForm({ ...form, horas_contratadas: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label>Data Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Suspenso">Suspenso</SelectItem>
                  <SelectItem value="Encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
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

export default Contratos;
