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
import { Plus, Search, Receipt, Eye } from "lucide-react";

interface Fatura {
  id: string;
  empresa: string;
  contrato: string;
  periodo: string;
  horas_normais: number;
  horas_excedentes: number;
  valor_hora: number;
  valor_excedente_hora: number;
  valor_total: number;
  status: string;
  emissao: string;
}

const initialData: Fatura[] = [
  { id: "1", empresa: "Construtora Alpha Ltda", contrato: "CT-001", periodo: "Fev/2026", horas_normais: 160, horas_excedentes: 12, valor_hora: 250, valor_excedente_hora: 312.5, valor_total: 43750, status: "Pendente", emissao: "20/02/2026" },
  { id: "2", empresa: "Terraplenagem Beta S/A", contrato: "CT-002", periodo: "Fev/2026", horas_normais: 140, horas_excedentes: 0, valor_hora: 180, valor_excedente_hora: 225, valor_total: 25200, status: "Pendente", emissao: "20/02/2026" },
  { id: "3", empresa: "Construtora Alpha Ltda", contrato: "CT-001", periodo: "Jan/2026", horas_normais: 180, horas_excedentes: 20, valor_hora: 250, valor_excedente_hora: 312.5, valor_total: 51250, status: "Pago", emissao: "01/02/2026" },
];

const Faturamento = () => {
  const [items, setItems] = useState<Fatura[]>(initialData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ empresa: "", contrato: "", periodo: "", horas_normais: 0, horas_excedentes: 0, valor_hora: 0, valor_excedente_hora: 0, status: "Pendente" });

  const filtered = items.filter((i) => i.empresa.toLowerCase().includes(search.toLowerCase()) || i.contrato.includes(search));

  const totalPendente = items.filter((i) => i.status === "Pendente").reduce((acc, i) => acc + i.valor_total, 0);

  const handleSave = () => {
    if (!form.empresa) return;
    const total = form.horas_normais * form.valor_hora + form.horas_excedentes * form.valor_excedente_hora;
    setItems([...items, { ...form, id: Date.now().toString(), valor_total: total, emissao: new Date().toLocaleDateString("pt-BR") }]);
    setDialogOpen(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
            <p className="text-sm text-muted-foreground">Total pendente: <span className="text-accent font-semibold">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></p>
          </div>
          <Button onClick={() => { setForm({ empresa: "", contrato: "", periodo: "", horas_normais: 0, horas_excedentes: 0, valor_hora: 0, valor_excedente_hora: 0, status: "Pendente" }); setDialogOpen(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Fatura
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar faturas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Excedente</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.empresa}</TableCell>
                    <TableCell className="font-mono text-sm">{item.contrato}</TableCell>
                    <TableCell className="text-sm">{item.periodo}</TableCell>
                    <TableCell className="text-sm">{item.horas_normais}h</TableCell>
                    <TableCell className="text-sm">{item.horas_excedentes > 0 ? <span className="text-warning font-semibold">{item.horas_excedentes}h</span> : "—"}</TableCell>
                    <TableCell className="font-bold text-sm">R$ {item.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Badge className={item.status === "Pago" ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
                        {item.status}
                      </Badge>
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
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-accent" />Nova Fatura</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Empresa</Label><Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} /></div>
              <div><Label>Contrato</Label><Input value={form.contrato} onChange={(e) => setForm({ ...form, contrato: e.target.value })} placeholder="CT-000" /></div>
            </div>
            <div><Label>Período</Label><Input value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} placeholder="Mês/Ano" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Horas Normais</Label><Input type="number" value={form.horas_normais || ""} onChange={(e) => setForm({ ...form, horas_normais: Number(e.target.value) })} /></div>
              <div><Label>Valor/Hora (R$)</Label><Input type="number" value={form.valor_hora || ""} onChange={(e) => setForm({ ...form, valor_hora: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Horas Excedentes</Label><Input type="number" value={form.horas_excedentes || ""} onChange={(e) => setForm({ ...form, horas_excedentes: Number(e.target.value) })} /></div>
              <div><Label>Valor Excedente/Hora (R$)</Label><Input type="number" value={form.valor_excedente_hora || ""} onChange={(e) => setForm({ ...form, valor_excedente_hora: Number(e.target.value) })} /></div>
            </div>
            {(form.horas_normais > 0 || form.horas_excedentes > 0) && (
              <div className="p-3 rounded-lg bg-accent/10 text-center">
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold text-accent">R$ {(form.horas_normais * form.valor_hora + form.horas_excedentes * form.valor_excedente_hora).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Emitir Fatura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Faturamento;
