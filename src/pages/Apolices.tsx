import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; }
interface Apolice {
  id: string;
  equipamento_id: string;
  numero_apolice: string;
  seguradora: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  valor: number;
  status: string;
  equipamentos: Equipamento;
}

const emptyForm = { equipamento_id: "", numero_apolice: "", seguradora: "", vigencia_inicio: "", vigencia_fim: "", valor: 0 };

const Apolices = () => {
  const [items, setItems] = useState<Apolice[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Apolice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    const [apolicesRes, equipRes] = await Promise.all([
      supabase.from("apolices").select("*, equipamentos(id, tipo, modelo, tag_placa)").order("created_at", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").order("tipo"),
    ]);
    if (apolicesRes.data) setItems(apolicesRes.data as unknown as Apolice[]);
    if (equipRes.data) setEquipamentos(equipRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) =>
    i.equipamentos?.modelo?.toLowerCase().includes(search.toLowerCase()) || i.numero_apolice.includes(search)
  );

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Apolice) => {
    setEditing(item);
    setForm({ equipamento_id: item.equipamento_id, numero_apolice: item.numero_apolice, seguradora: item.seguradora, vigencia_inicio: item.vigencia_inicio, vigencia_fim: item.vigencia_fim, valor: item.valor });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipamento_id || !form.numero_apolice) return;
    const status = new Date(form.vigencia_fim) >= new Date() ? "Vigente" : "Vencida";
    const payload = { ...form, valor: Number(form.valor), status };
    if (editing) {
      const { error } = await supabase.from("apolices").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("apolices").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("apolices").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchData();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Apólices de Seguro</h1>
            <p className="text-sm text-muted-foreground">{items.length} apólices cadastradas</p>
          </div>
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Apólice
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar apólices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Nº Apólice</TableHead>
                  <TableHead>Seguradora</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</TableCell>
                    <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{item.numero_apolice}</TableCell>
                    <TableCell className="text-sm">{item.seguradora}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.vigencia_inicio).toLocaleDateString("pt-BR")} - {new Date(item.vigencia_fim).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-semibold text-sm">R$ {Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Badge className={item.status === "Vigente" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma apólice encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-accent" />{editing ? "Editar Apólice" : "Nova Apólice"}</DialogTitle></DialogHeader>
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
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nº Apólice</Label><Input value={form.numero_apolice} onChange={(e) => setForm({ ...form, numero_apolice: e.target.value })} /></div>
              <div><Label>Seguradora</Label><Input value={form.seguradora} onChange={(e) => setForm({ ...form, seguradora: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Início Vigência</Label><Input type="date" value={form.vigencia_inicio} onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value })} /></div>
              <div><Label>Fim Vigência</Label><Input type="date" value={form.vigencia_fim} onChange={(e) => setForm({ ...form, vigencia_fim: e.target.value })} /></div>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" value={form.valor || ""} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} /></div>
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

export default Apolices;
