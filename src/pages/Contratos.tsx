import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, FileText, FileDown, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

interface Empresa { id: string; nome: string; cnpj: string; razao_social: string; nome_fantasia: string; inscricao_estadual: string; inscricao_municipal: string; endereco_logradouro: string; endereco_numero: string; endereco_complemento: string; endereco_bairro: string; endereco_cidade: string; endereco_uf: string; endereco_cep: string; contato: string | null; telefone: string | null; email: string; atividade_principal: string; }
interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
interface Contrato {
  id: string;
  empresa_id: string;
  equipamento_id: string;
  valor_hora: number;
  horas_contratadas: number;
  data_inicio: string;
  data_fim: string;
  observacoes: string | null;
  status: string;
  empresas: Empresa;
  equipamentos: Equipamento;
}

const emptyForm = { empresa_id: "", equipamento_id: "", valor_hora: 0, horas_contratadas: 0, data_inicio: "", data_fim: "", observacoes: "", status: "Ativo" };

const Contratos = () => {
  const [items, setItems] = useState<Contrato[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchData = async () => {
    const [contratosRes, empresasRes, equipRes] = await Promise.all([
      supabase.from("contratos").select("*, empresas(id, nome, cnpj, razao_social, nome_fantasia, inscricao_estadual, inscricao_municipal, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, contato, telefone, email, atividade_principal), equipamentos(id, tipo, modelo, tag_placa, numero_serie)").order("created_at", { ascending: false }),
      supabase.from("empresas").select("id, nome, cnpj").eq("status", "Ativa").order("nome") as any,
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
    ]);
    if (contratosRes.data) setItems(contratosRes.data as unknown as Contrato[]);
    if (empresasRes.data) setEmpresas(empresasRes.data);
    if (equipRes.data) setEquipamentos(equipRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter(
    (i) => i.empresas?.nome?.toLowerCase().includes(search.toLowerCase()) || i.empresas?.cnpj?.includes(search) || i.equipamentos?.modelo?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };

  const getExportData = () => {
    const data = filtered.filter(i => selected.size === 0 || selected.has(i.id));
    const headers = ["Empresa", "CNPJ", "Equipamento", "Tag", "Valor/Hora (R$)", "Horas Contratadas", "Início", "Fim", "Status"];
    const rows = data.map(i => [
      i.empresas?.nome || "",
      i.empresas?.cnpj || "",
      `${i.equipamentos?.tipo} ${i.equipamentos?.modelo}`,
      i.equipamentos?.tag_placa || "—",
      Number(i.valor_hora).toFixed(2),
      String(i.horas_contratadas),
      new Date(i.data_inicio).toLocaleDateString("pt-BR"),
      new Date(i.data_fim).toLocaleDateString("pt-BR"),
      i.status,
    ]);
    return { title: "Relatório de Contratos", headers, rows, filename: `contratos_${new Date().toISOString().slice(0,10)}` };
  };

  const exportDetailedPDF = async () => {
    const data = filtered.filter(i => selected.size === 0 || selected.has(i.id));
    if (data.length === 0) return;

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "portrait" });
    const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

    for (let idx = 0; idx < data.length; idx++) {
      const item = data[idx];
      if (idx > 0) doc.addPage();
      const emp = item.empresas;
      const eq = item.equipamentos;

      doc.setFontSize(18);
      doc.setTextColor(41, 128, 185);
      doc.text("Contrato Detalhado", 14, 18);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, 14, 24);

      let y = 32;

      // Empresa
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Dados da Empresa", 14, y);
      y += 2;
      const enderecoCompleto = [emp?.endereco_logradouro, emp?.endereco_numero, emp?.endereco_complemento].filter(Boolean).join(", ");
      const cidadeUf = [emp?.endereco_bairro, emp?.endereco_cidade, emp?.endereco_uf].filter(Boolean).join(" - ");
      autoTable(doc, {
        startY: y,
        head: [["Campo", "Valor"]],
        body: [
          ["Razão Social", emp?.razao_social || emp?.nome || "—"],
          ["Nome Fantasia", emp?.nome_fantasia || "—"],
          ["CNPJ", emp?.cnpj || "—"],
          ["Inscrição Estadual", emp?.inscricao_estadual || "—"],
          ["Inscrição Municipal", emp?.inscricao_municipal || "—"],
          ["Atividade Principal", emp?.atividade_principal || "—"],
          ["Endereço", enderecoCompleto || "—"],
          ["Bairro / Cidade / UF", cidadeUf || "—"],
          ["CEP", emp?.endereco_cep || "—"],
          ["Contato", emp?.contato || "—"],
          ["Telefone", emp?.telefone || "—"],
          ["E-mail", emp?.email || "—"],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Equipamento
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Dados do Equipamento", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Campo", "Valor"]],
        body: [
          ["Tipo", eq?.tipo || "—"],
          ["Modelo", eq?.modelo || "—"],
          ["Tag/Placa", eq?.tag_placa || "—"],
          ["Nº Série", eq?.numero_serie || "—"],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Contrato
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Dados do Contrato", 14, y);
      y += 2;
      const valorTotal = Number(item.valor_hora) * Number(item.horas_contratadas);
      autoTable(doc, {
        startY: y,
        head: [["Campo", "Valor"]],
        body: [
          ["Valor/Hora", fmt(Number(item.valor_hora))],
          ["Horas Contratadas", `${item.horas_contratadas}h`],
          ["Valor Total Estimado", fmt(valorTotal)],
          ["Período", `${new Date(item.data_inicio).toLocaleDateString("pt-BR")} - ${new Date(item.data_fim).toLocaleDateString("pt-BR")}`],
          ["Status", item.status],
          ["Observações", item.observacoes || "—"],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [39, 174, 96], textColor: 255 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
        theme: "grid",
      });
    }

    doc.save(`contratos_detalhado_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Contrato) => {
    setEditing(item);
    setForm({ empresa_id: item.empresa_id, equipamento_id: item.equipamento_id, valor_hora: item.valor_hora, horas_contratadas: item.horas_contratadas, data_inicio: item.data_inicio, data_fim: item.data_fim, observacoes: item.observacoes || "", status: item.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.empresa_id || !form.equipamento_id) return;
    const payload = { ...form, valor_hora: Number(form.valor_hora), horas_contratadas: Number(form.horas_contratadas) };
    if (editing) {
      const { error } = await supabase.from("contratos").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("contratos").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchData();
  };

  const statusColor = (s: string) => {
    if (s === "Ativo") return "bg-success text-success-foreground";
    if (s === "Encerrado") return "bg-muted text-muted-foreground";
    return "bg-warning text-warning-foreground";
  };

  const selectedEquip = equipamentos.find(e => e.id === form.equipamento_id);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
            <p className="text-sm text-muted-foreground">{items.length} contratos cadastrados{selected.size > 0 && ` · ${selected.size} selecionado(s)`}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportDetailedPDF}>
              <FileDown className="h-4 w-4 mr-1" /> PDF Detalhado
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToPDF(getExportData())}>
              <FileDown className="h-4 w-4 mr-1" /> PDF Simples
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Novo Contrato
            </Button>
          </div>
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
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Valor/Hora</TableHead>
                  <TableHead>Horas Contratadas</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className={selected.has(item.id) ? "bg-accent/5" : ""}>
                    <TableCell><Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} /></TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.empresas?.nome}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.empresas?.cnpj}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</TableCell>
                    <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                    <TableCell className="font-semibold text-sm text-accent">R$ {Number(item.valor_hora).toFixed(2)}</TableCell>
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
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum contrato encontrado</TableCell></TableRow>
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
            <div>
              <Label>Empresa</Label>
              <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome} — {e.cnpj}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Equipamento</Label>
              <Select value={form.equipamento_id} onValueChange={(v) => setForm({ ...form, equipamento_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                <SelectContent>
                  {equipamentos.map((e) => <SelectItem key={e.id} value={e.id}>{e.tipo} {e.modelo} {e.tag_placa ? `(${e.tag_placa})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedEquip && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p><strong>Tag:</strong> {selectedEquip.tag_placa || "—"} | <strong>Modelo:</strong> {selectedEquip.modelo}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor por Hora (R$)</Label><Input type="number" value={form.valor_hora || ""} onChange={(e) => setForm({ ...form, valor_hora: Number(e.target.value) })} /></div>
              <div><Label>Horas Contratadas</Label><Input type="number" value={form.horas_contratadas || ""} onChange={(e) => setForm({ ...form, horas_contratadas: Number(e.target.value) })} /></div>
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
