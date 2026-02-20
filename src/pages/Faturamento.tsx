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
import { Plus, Search, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContratoRef {
  id: string;
  valor_hora: number;
  horas_contratadas: number;
  empresas: { nome: string; cnpj: string };
  equipamentos: { tipo: string; modelo: string; tag_placa: string | null };
}

interface Fatura {
  id: string;
  contrato_id: string;
  periodo: string;
  horas_normais: number;
  horas_excedentes: number;
  valor_hora: number;
  valor_excedente_hora: number;
  valor_total: number;
  status: string;
  emissao: string;
  contratos: ContratoRef;
}

const emptyForm = { contrato_id: "", periodo: "", horas_normais: 0, horas_excedentes: 0, valor_hora: 0, valor_excedente_hora: 0, status: "Pendente" };

const Faturamento = () => {
  const [items, setItems] = useState<Fatura[]>([]);
  const [contratos, setContratos] = useState<ContratoRef[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    const [fatRes, ctRes] = await Promise.all([
      supabase.from("faturamento").select("*, contratos(id, valor_hora, horas_contratadas, empresas(nome, cnpj), equipamentos(tipo, modelo, tag_placa))").order("emissao", { ascending: false }),
      supabase.from("contratos").select("id, valor_hora, horas_contratadas, empresas(nome, cnpj), equipamentos(tipo, modelo, tag_placa)").eq("status", "Ativo").order("created_at", { ascending: false }),
    ]);
    if (fatRes.data) setItems(fatRes.data as unknown as Fatura[]);
    if (ctRes.data) setContratos(ctRes.data as unknown as ContratoRef[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) =>
    i.contratos?.empresas?.nome?.toLowerCase().includes(search.toLowerCase()) || i.periodo.includes(search)
  );
  const totalPendente = items.filter((i) => i.status === "Pendente").reduce((acc, i) => acc + Number(i.valor_total), 0);

  const handleContratoSelect = (contratoId: string) => {
    const ct = contratos.find(c => c.id === contratoId);
    if (ct) {
      setForm({ ...form, contrato_id: contratoId, valor_hora: Number(ct.valor_hora), valor_excedente_hora: Number(ct.valor_hora) * 1.25 });
    }
  };

  const handleSave = async () => {
    if (!form.contrato_id) return;
    const total = form.horas_normais * form.valor_hora + form.horas_excedentes * form.valor_excedente_hora;
    const { error } = await supabase.from("faturamento").insert({ ...form, valor_total: total });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setDialogOpen(false);
    fetchData();
  };

  const selectedContrato = contratos.find(c => c.id === form.contrato_id);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
            <p className="text-sm text-muted-foreground">Total pendente: <span className="text-accent font-semibold">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
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
                  <TableHead>Equipamento</TableHead>
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
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.contratos?.empresas?.nome}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.contratos?.empresas?.cnpj}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.contratos?.equipamentos?.tipo} {item.contratos?.equipamentos?.modelo}</TableCell>
                    <TableCell className="text-sm">{item.periodo}</TableCell>
                    <TableCell className="text-sm">{item.horas_normais}h</TableCell>
                    <TableCell className="text-sm">{Number(item.horas_excedentes) > 0 ? <span className="text-warning font-semibold">{item.horas_excedentes}h</span> : "—"}</TableCell>
                    <TableCell className="font-bold text-sm">R$ {Number(item.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
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
            <div>
              <Label>Contrato</Label>
              <Select value={form.contrato_id} onValueChange={handleContratoSelect}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contratos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.empresas?.nome} — {c.equipamentos?.tipo} {c.equipamentos?.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedContrato && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p><strong>Empresa:</strong> {selectedContrato.empresas?.nome} ({selectedContrato.empresas?.cnpj})</p>
                <p><strong>Equipamento:</strong> {selectedContrato.equipamentos?.tipo} {selectedContrato.equipamentos?.modelo} {selectedContrato.equipamentos?.tag_placa ? `(${selectedContrato.equipamentos.tag_placa})` : ""}</p>
                <p><strong>Valor/Hora:</strong> R$ {Number(selectedContrato.valor_hora).toFixed(2)} | <strong>Horas Contratadas:</strong> {selectedContrato.horas_contratadas}h</p>
              </div>
            )}
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
