import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Shield, FileDown, FileSpreadsheet, AlertTriangle, DollarSign, CalendarClock } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

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
  tem_adesao: boolean;
  valor_adesao: number;
  tem_parcelamento: boolean;
  numero_parcelas: number;
  equipamentos: Equipamento;
}

const emptyForm = {
  equipamento_id: "", numero_apolice: "", seguradora: "",
  vigencia_inicio: "", vigencia_fim: "", valor: 0,
  tem_adesao: false, valor_adesao: 0,
  tem_parcelamento: false, numero_parcelas: 1,
};

const Apolices = () => {
  const [items, setItems] = useState<Apolice[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Apolice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<Apolice | null>(null);
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

  // Summary calculations
  const hoje = new Date();
  const em30dias = new Date();
  em30dias.setDate(em30dias.getDate() + 30);

  const vigentes = items.filter(i => i.status === "Vigente");
  const vencendoEm30 = vigentes.filter(i => {
    const fim = new Date(i.vigencia_fim);
    return fim >= hoje && fim <= em30dias;
  });

  const totalMensal = vigentes.reduce((acc, i) => {
    if (i.tem_parcelamento && i.numero_parcelas > 0) {
      return acc + i.valor / i.numero_parcelas;
    }
    // Se à vista, distribui pelo período de vigência em meses
    const inicio = new Date(i.vigencia_inicio);
    const fim = new Date(i.vigencia_fim);
    const meses = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    return acc + i.valor / meses;
  }, 0);

  const totalAnual = vigentes.reduce((acc, i) => acc + Number(i.valor), 0);

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };

  const getExportData = () => {
    const data = filtered.filter(i => selected.size === 0 || selected.has(i.id));
    const headers = ["Equipamento", "Tag", "Nº Apólice", "Seguradora", "Vigência", "Valor (R$)", "Adesão", "Valor Adesão", "Parcelas", "Valor Parcela", "Status"];
    const rows = data.map(i => {
      const valorParcela = i.tem_parcelamento && i.numero_parcelas > 0 ? i.valor / i.numero_parcelas : i.valor;
      return [
        `${i.equipamentos?.tipo} ${i.equipamentos?.modelo}`,
        i.equipamentos?.tag_placa || "—",
        i.numero_apolice,
        i.seguradora,
        `${new Date(i.vigencia_inicio).toLocaleDateString("pt-BR")} - ${new Date(i.vigencia_fim).toLocaleDateString("pt-BR")}`,
        Number(i.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        i.tem_adesao ? "Sim" : "Não",
        i.tem_adesao ? Number(i.valor_adesao).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—",
        i.tem_parcelamento ? `${i.numero_parcelas}x` : "À vista",
        valorParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        i.status,
      ];
    });
    return { title: "Relatório de Apólices de Seguro", headers, rows, filename: `apolices_${new Date().toISOString().slice(0, 10)}` };
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Apolice) => {
    setEditing(item);
    setForm({
      equipamento_id: item.equipamento_id, numero_apolice: item.numero_apolice,
      seguradora: item.seguradora, vigencia_inicio: item.vigencia_inicio,
      vigencia_fim: item.vigencia_fim, valor: item.valor,
      tem_adesao: item.tem_adesao, valor_adesao: item.valor_adesao,
      tem_parcelamento: item.tem_parcelamento, numero_parcelas: item.numero_parcelas,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipamento_id || !form.numero_apolice) return;
    const status = new Date(form.vigencia_fim) >= new Date() ? "Vigente" : "Vencida";
    const payload = {
      equipamento_id: form.equipamento_id,
      numero_apolice: form.numero_apolice,
      seguradora: form.seguradora,
      vigencia_inicio: form.vigencia_inicio,
      vigencia_fim: form.vigencia_fim,
      valor: Number(form.valor),
      status,
      tem_adesao: form.tem_adesao,
      valor_adesao: form.tem_adesao ? Number(form.valor_adesao) : 0,
      tem_parcelamento: form.tem_parcelamento,
      numero_parcelas: form.tem_parcelamento ? Number(form.numero_parcelas) : 1,
    };
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

  const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Apólices de Seguro</h1>
            <p className="text-sm text-muted-foreground">{items.length} apólices cadastradas{selected.size > 0 && ` · ${selected.size} selecionada(s)`}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToPDF(getExportData())}>
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Nova Apólice
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar apólices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" /> Apólices Vigentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{vigentes.length}</p>
              <p className="text-xs text-muted-foreground">de {items.length} cadastradas</p>
            </CardContent>
          </Card>
          <Card className={vencendoEm30.length > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${vencendoEm30.length > 0 ? "text-destructive" : ""}`} /> Vencimento / Renovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${vencendoEm30.length > 0 ? "text-destructive" : "text-foreground"}`}>{vencendoEm30.length}</p>
              <p className="text-xs text-muted-foreground">vencem nos próximos 30 dias</p>
              {vencendoEm30.length > 0 && (
                <div className="mt-2 space-y-1">
                  {vencendoEm30.map(a => (
                    <div key={a.id} className="text-xs flex justify-between items-center">
                      <span className="font-medium text-foreground truncate mr-2">{a.equipamentos?.tipo} {a.equipamentos?.modelo}</span>
                      <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] shrink-0">
                        {new Date(a.vigencia_fim).toLocaleDateString("pt-BR")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Custo Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">R$ {fmt(totalMensal)}</p>
              <p className="text-xs text-muted-foreground">Estimativa mensal das vigentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Total Anual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">R$ {fmt(totalAnual)}</p>
              <p className="text-xs text-muted-foreground">Soma das apólices vigentes</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Nº Apólice</TableHead>
                  <TableHead>Seguradora</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Adesão</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const valorParcela = item.tem_parcelamento && item.numero_parcelas > 0 ? item.valor / item.numero_parcelas : item.valor;
                  return (
                    <TableRow key={item.id} className={`cursor-pointer ${selected.has(item.id) ? "bg-accent/5" : ""}`} onClick={() => setDetailItem(item)}>
                      <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} /></TableCell>
                      <TableCell className="font-medium text-sm">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</TableCell>
                      <TableCell className="font-mono text-sm">{item.numero_apolice}</TableCell>
                      <TableCell className="text-sm">{item.seguradora}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.vigencia_inicio).toLocaleDateString("pt-BR")} - {new Date(item.vigencia_fim).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-semibold text-sm">R$ {fmt(item.valor)}</TableCell>
                      <TableCell className="text-sm">
                        {item.tem_adesao ? <Badge variant="outline" className="text-xs">R$ {fmt(item.valor_adesao)}</Badge> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.tem_parcelamento ? `${item.numero_parcelas}x R$ ${fmt(valorParcela)}` : "À vista"}
                      </TableCell>
                      <TableCell>
                        <Badge className={item.status === "Vigente" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma apólice encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
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
            <div><Label>Valor do Seguro (R$)</Label><Input type="number" value={form.valor || ""} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} /></div>

            {/* Adesão */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm font-medium">Houve adesão?</Label>
                <p className="text-xs text-muted-foreground">Marque se houve taxa de adesão</p>
              </div>
              <Switch checked={form.tem_adesao} onCheckedChange={(v) => setForm({ ...form, tem_adesao: v, valor_adesao: v ? form.valor_adesao : 0 })} />
            </div>
            {form.tem_adesao && (
              <div><Label>Valor da Adesão (R$)</Label><Input type="number" value={form.valor_adesao || ""} onChange={(e) => setForm({ ...form, valor_adesao: Number(e.target.value) })} /></div>
            )}

            {/* Parcelamento */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm font-medium">Parcelamento?</Label>
                <p className="text-xs text-muted-foreground">Dividir o valor do seguro em parcelas</p>
              </div>
              <Switch checked={form.tem_parcelamento} onCheckedChange={(v) => setForm({ ...form, tem_parcelamento: v, numero_parcelas: v ? form.numero_parcelas : 1 })} />
            </div>
            {form.tem_parcelamento && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nº de Parcelas</Label><Input type="number" min={1} value={form.numero_parcelas} onChange={(e) => setForm({ ...form, numero_parcelas: Math.max(1, Number(e.target.value)) })} /></div>
                <div>
                  <Label>Valor por Parcela</Label>
                  <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted text-sm font-semibold">
                    R$ {form.valor && form.numero_parcelas > 0 ? fmt(form.valor / form.numero_parcelas) : "0,00"}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-accent" />Detalhes da Apólice</DialogTitle></DialogHeader>
          {detailItem && (() => {
            const valorParcela = detailItem.tem_parcelamento && detailItem.numero_parcelas > 0 ? detailItem.valor / detailItem.numero_parcelas : detailItem.valor;
            return (
              <div className="space-y-3 py-2">
                <Row label="Equipamento" value={`${detailItem.equipamentos?.tipo} ${detailItem.equipamentos?.modelo}`} />
                <Row label="Tag/Placa" value={detailItem.equipamentos?.tag_placa || "—"} />
                <Row label="Nº Apólice" value={detailItem.numero_apolice} />
                <Row label="Seguradora" value={detailItem.seguradora} />
                <Row label="Vigência" value={`${new Date(detailItem.vigencia_inicio).toLocaleDateString("pt-BR")} a ${new Date(detailItem.vigencia_fim).toLocaleDateString("pt-BR")}`} />
                <Row label="Valor do Seguro" value={`R$ ${fmt(detailItem.valor)}`} bold />
                <Row label="Adesão" value={detailItem.tem_adesao ? `Sim — R$ ${fmt(detailItem.valor_adesao)}` : "Não"} />
                <Row label="Parcelamento" value={detailItem.tem_parcelamento ? `${detailItem.numero_parcelas}x de R$ ${fmt(valorParcela)}` : "À vista"} />
                <Row label="Status" value={detailItem.status} badge={detailItem.status === "Vigente" ? "success" : "destructive"} />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

const Row = ({ label, value, bold, badge }: { label: string; value: string; bold?: boolean; badge?: "success" | "destructive" }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    {badge ? (
      <Badge className={badge === "success" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>{value}</Badge>
    ) : (
      <span className={`text-sm ${bold ? "font-bold" : "font-medium"} text-foreground`}>{value}</span>
    )}
  </div>
);

export default Apolices;
