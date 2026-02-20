import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; }
interface Medicao {
  id: string;
  equipamento_id: string;
  data: string;
  horimetro_inicial: number;
  horimetro_final: number;
  horas_trabalhadas: number;
  equipamentos: Equipamento;
}

const Medicoes = () => {
  const [items, setItems] = useState<Medicao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ equipamento_id: "", data: new Date().toISOString().split("T")[0], horimetro_inicial: 0, horimetro_final: 0 });
  const [filterEquip, setFilterEquip] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    const [medRes, equipRes] = await Promise.all([
      supabase.from("medicoes").select("*, equipamentos(id, tipo, modelo, tag_placa)").order("data", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").order("tipo"),
    ]);
    if (medRes.data) setItems(medRes.data as unknown as Medicao[]);
    if (equipRes.data) setEquipamentos(equipRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = filterEquip === "Todos" ? items : items.filter((i) => i.equipamento_id === filterEquip);

  const summaryMap = new Map<string, { totalHoras: number; entries: number; label: string }>();
  items.forEach((m) => {
    const label = `${m.equipamentos?.tipo} ${m.equipamentos?.modelo}`;
    const current = summaryMap.get(m.equipamento_id) || { totalHoras: 0, entries: 0, label };
    current.totalHoras += Number(m.horas_trabalhadas);
    current.entries += 1;
    summaryMap.set(m.equipamento_id, current);
  });

  const handleSave = async () => {
    if (!form.equipamento_id || form.horimetro_final <= form.horimetro_inicial) return;
    const { error } = await supabase.from("medicoes").insert({
      equipamento_id: form.equipamento_id,
      data: form.data,
      horimetro_inicial: form.horimetro_inicial,
      horimetro_final: form.horimetro_final,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setDialogOpen(false);
    fetchData();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Medições - Horímetro</h1>
            <p className="text-sm text-muted-foreground">Registro diário de horas trabalhadas por equipamento</p>
          </div>
          <Button onClick={() => { setForm({ equipamento_id: "", data: new Date().toISOString().split("T")[0], horimetro_inicial: 0, horimetro_final: 0 }); setDialogOpen(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Medição
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from(summaryMap.entries()).map(([id, data]) => (
            <Card key={id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{data.label}</CardTitle>
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
                {equipamentos.map((e) => <SelectItem key={e.id} value={e.id}>{e.tipo} {e.modelo}</SelectItem>)}
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
                  <TableHead>Tag</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horímetro Inicial</TableHead>
                  <TableHead>Horímetro Final</TableHead>
                  <TableHead>Horas Trabalhadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</TableCell>
                    <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(item.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-mono text-sm">{Number(item.horimetro_inicial).toFixed(1)}</TableCell>
                    <TableCell className="font-mono text-sm">{Number(item.horimetro_final).toFixed(1)}</TableCell>
                    <TableCell>
                      <Badge className="bg-accent/10 text-accent font-semibold border-0">
                        <Clock className="h-3 w-3 mr-1" />{Number(item.horas_trabalhadas).toFixed(1)}h
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma medição encontrada</TableCell></TableRow>
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
              <Select value={form.equipamento_id} onValueChange={(v) => setForm({ ...form, equipamento_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                <SelectContent>
                  {equipamentos.map((e) => <SelectItem key={e.id} value={e.id}>{e.tipo} {e.modelo} {e.tag_placa ? `(${e.tag_placa})` : ""}</SelectItem>)}
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
