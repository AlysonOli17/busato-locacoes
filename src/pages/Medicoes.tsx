import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Clock, Filter } from "lucide-react";

interface Medicao {
  id: string;
  equipamento: string;
  data: string;
  horimetro_inicial: number;
  horimetro_final: number;
  horas_trabalhadas: number;
}

const initialData: Medicao[] = [
  { id: "1", equipamento: "Escavadeira CAT 320", data: "2026-02-20", horimetro_inicial: 4520, horimetro_final: 4528.5, horas_trabalhadas: 8.5 },
  { id: "2", equipamento: "Escavadeira CAT 320", data: "2026-02-19", horimetro_inicial: 4511, horimetro_final: 4520, horas_trabalhadas: 9 },
  { id: "3", equipamento: "Retroescavadeira JCB 3CX", data: "2026-02-20", horimetro_inicial: 3200, horimetro_final: 3206.2, horas_trabalhadas: 6.2 },
  { id: "4", equipamento: "Retroescavadeira JCB 3CX", data: "2026-02-19", horimetro_inicial: 3192, horimetro_final: 3200, horas_trabalhadas: 8 },
  { id: "5", equipamento: "Pá Carregadeira 950H", data: "2026-02-20", horimetro_inicial: 6780, horimetro_final: 6789.1, horas_trabalhadas: 9.1 },
  { id: "6", equipamento: "Pá Carregadeira 950H", data: "2026-02-19", horimetro_inicial: 6771, horimetro_final: 6780, horas_trabalhadas: 9 },
];

const equipamentos = ["Escavadeira CAT 320", "Retroescavadeira JCB 3CX", "Pá Carregadeira 950H", "Rolo Compactador BOMAG"];

const Medicoes = () => {
  const [items, setItems] = useState<Medicao[]>(initialData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ equipamento: "", data: new Date().toISOString().split("T")[0], horimetro_inicial: 0, horimetro_final: 0 });
  const [filterEquip, setFilterEquip] = useState("Todos");

  const filtered = filterEquip === "Todos" ? items : items.filter((i) => i.equipamento === filterEquip);

  // Summary per equipment for current month
  const summaryMap = new Map<string, { totalHoras: number; entries: number }>();
  items.forEach((m) => {
    const current = summaryMap.get(m.equipamento) || { totalHoras: 0, entries: 0 };
    current.totalHoras += m.horas_trabalhadas;
    current.entries += 1;
    summaryMap.set(m.equipamento, current);
  });

  const handleSave = () => {
    if (!form.equipamento || form.horimetro_final <= form.horimetro_inicial) return;
    const horas = Number((form.horimetro_final - form.horimetro_inicial).toFixed(1));
    setItems([{ id: Date.now().toString(), ...form, horas_trabalhadas: horas }, ...items]);
    setDialogOpen(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Medições - Horímetro</h1>
            <p className="text-sm text-muted-foreground">Registro diário de horas trabalhadas por equipamento</p>
          </div>
          <Button onClick={() => { setForm({ equipamento: "", data: new Date().toISOString().split("T")[0], horimetro_inicial: 0, horimetro_final: 0 }); setDialogOpen(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Medição
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from(summaryMap.entries()).map(([equip, data]) => (
            <Card key={equip} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{equip}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">{data.totalHoras.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground">{data.entries} registros no período</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterEquip} onValueChange={setFilterEquip}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os Equipamentos</SelectItem>
                {equipamentos.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horímetro Inicial</TableHead>
                  <TableHead>Horímetro Final</TableHead>
                  <TableHead>Horas Trabalhadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.equipamento}</TableCell>
                    <TableCell className="text-sm">{new Date(item.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-mono text-sm">{item.horimetro_inicial.toFixed(1)}</TableCell>
                    <TableCell className="font-mono text-sm">{item.horimetro_final.toFixed(1)}</TableCell>
                    <TableCell>
                      <Badge className="bg-accent/10 text-accent font-semibold border-0">
                        <Clock className="h-3 w-3 mr-1" />{item.horas_trabalhadas.toFixed(1)}h
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma medição encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-accent" />Nova Medição de Horímetro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Equipamento</Label>
              <Select value={form.equipamento} onValueChange={(v) => setForm({ ...form, equipamento: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                <SelectContent>
                  {equipamentos.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Horímetro Inicial</Label><Input type="number" step="0.1" value={form.horimetro_inicial || ""} onChange={(e) => setForm({ ...form, horimetro_inicial: Number(e.target.value) })} /></div>
              <div><Label>Horímetro Final</Label><Input type="number" step="0.1" value={form.horimetro_final || ""} onChange={(e) => setForm({ ...form, horimetro_final: Number(e.target.value) })} /></div>
            </div>
            {form.horimetro_final > form.horimetro_inicial && (
              <div className="p-3 rounded-lg bg-accent/10 text-center">
                <p className="text-sm text-muted-foreground">Horas trabalhadas</p>
                <p className="text-2xl font-bold text-accent">{(form.horimetro_final - form.horimetro_inicial).toFixed(1)}h</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Medicoes;
