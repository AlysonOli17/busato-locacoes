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
import { Plus, Search, Pencil, Trash2, FileText, FileDown, FileSpreadsheet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

interface Empresa { id: string; nome: string; cnpj: string; razao_social: string; nome_fantasia: string; inscricao_estadual: string; inscricao_municipal: string; endereco_logradouro: string; endereco_numero: string; endereco_complemento: string; endereco_bairro: string; endereco_cidade: string; endereco_uf: string; endereco_cep: string; contato: string | null; telefone: string | null; email: string; atividade_principal: string; }
interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
interface ContratoEquipamento { id: string; equipamento_id: string; equipamentos: Equipamento; }
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
  contratos_equipamentos?: ContratoEquipamento[];
}

const emptyForm = { empresa_id: "", equipamento_id: "", valor_hora: 0, horas_contratadas: 0, data_inicio: "", data_fim: "", observacoes: "", status: "Ativo" };

const Contratos = () => {
  const [items, setItems] = useState<Contrato[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formEquipamentos, setFormEquipamentos] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchData = async () => {
    const [contratosRes, empresasRes, equipRes] = await Promise.all([
      supabase.from("contratos").select("*, empresas(id, nome, cnpj, razao_social, nome_fantasia, inscricao_estadual, inscricao_municipal, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, contato, telefone, email, atividade_principal), equipamentos(id, tipo, modelo, tag_placa, numero_serie), contratos_equipamentos(id, equipamento_id, equipamentos(id, tipo, modelo, tag_placa, numero_serie))").order("created_at", { ascending: false }),
      supabase.from("empresas").select("id, nome, cnpj").eq("status", "Ativa").order("nome") as any,
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
    ]);
    if (contratosRes.data) setItems(contratosRes.data as unknown as Contrato[]);
    if (empresasRes.data) setEmpresas(empresasRes.data);
    if (equipRes.data) setEquipamentos(equipRes.data as Equipamento[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getContratoEquipamentos = (item: Contrato): Equipamento[] => {
    const fromJunction = (item.contratos_equipamentos || []).map(ce => ce.equipamentos).filter(Boolean);
    if (fromJunction.length > 0) return fromJunction;
    if (item.equipamentos) return [item.equipamentos];
    return [];
  };

  const filtered = items.filter(
    (i) => i.empresas?.nome?.toLowerCase().includes(search.toLowerCase()) || i.empresas?.cnpj?.includes(search) || getContratoEquipamentos(i).some(eq => eq.modelo?.toLowerCase().includes(search.toLowerCase()) || eq.tag_placa?.toLowerCase().includes(search.toLowerCase()))
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
    const headers = ["Empresa", "CNPJ", "Equipamentos", "Tags", "Valor/Hora (R$)", "Horas Contratadas", "Início", "Fim", "Status"];
    const rows = data.map(i => {
      const eqs = getContratoEquipamentos(i);
      return [
        i.empresas?.nome || "",
        i.empresas?.cnpj || "",
        eqs.map(e => `${e.tipo} ${e.modelo}`).join(", ") || "—",
        eqs.map(e => e.tag_placa || "").filter(Boolean).join(", ") || "—",
        Number(i.valor_hora).toFixed(2),
        String(i.horas_contratadas),
        new Date(i.data_inicio).toLocaleDateString("pt-BR"),
        new Date(i.data_fim).toLocaleDateString("pt-BR"),
        i.status,
      ];
    });
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
      const eqs = getContratoEquipamentos(item);

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

      // Equipamentos
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text(`Equipamentos (${eqs.length})`, 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Tipo", "Modelo", "Tag/Placa", "Nº Série"]],
        body: eqs.map(eq => [eq.tipo || "—", eq.modelo || "—", eq.tag_placa || "—", eq.numero_serie || "—"]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
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

  const openNew = () => { setEditing(null); setForm(emptyForm); setFormEquipamentos([]); setDialogOpen(true); };
  const openEdit = (item: Contrato) => {
    setEditing(item);
    const eqs = getContratoEquipamentos(item);
    setFormEquipamentos(eqs.map(e => e.id));
    setForm({ empresa_id: item.empresa_id, equipamento_id: item.equipamento_id, valor_hora: item.valor_hora, horas_contratadas: item.horas_contratadas, data_inicio: item.data_inicio, data_fim: item.data_fim, observacoes: item.observacoes || "", status: item.status });
    setDialogOpen(true);
  };

  const addEquipamento = (equipId: string) => {
    if (equipId && !formEquipamentos.includes(equipId)) {
      setFormEquipamentos(prev => [...prev, equipId]);
    }
  };

  const removeEquipamento = (equipId: string) => {
    setFormEquipamentos(prev => prev.filter(id => id !== equipId));
  };

  const handleSave = async () => {
    if (!form.empresa_id || formEquipamentos.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Selecione a empresa e pelo menos um equipamento.", variant: "destructive" });
      return;
    }
    const mainEquipId = formEquipamentos[0];
    const payload = { ...form, equipamento_id: mainEquipId, valor_hora: Number(form.valor_hora), horas_contratadas: Number(form.horas_contratadas) };

    let contratoId: string;

    if (editing) {
      const { error } = await supabase.from("contratos").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      contratoId = editing.id;

      // Clear existing junction entries and re-insert
      await supabase.from("contratos_equipamentos").delete().eq("contrato_id", contratoId);
    } else {
      const { data, error } = await supabase.from("contratos").insert(payload).select("id").single();
      if (error || !data) { toast({ title: "Erro", description: error?.message || "Erro ao criar contrato", variant: "destructive" }); return; }
      contratoId = data.id;
    }

    // Insert all equipment associations
    const junctionRows = formEquipamentos.map(eId => ({ contrato_id: contratoId, equipamento_id: eId }));
    const { error: jError } = await supabase.from("contratos_equipamentos").insert(junctionRows);
    if (jError) { toast({ title: "Aviso", description: "Contrato salvo, mas houve erro ao associar equipamentos: " + jError.message, variant: "destructive" }); }

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

  const availableEquipamentos = equipamentos.filter(e => !formEquipamentos.includes(e.id));

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
                  <TableHead>Equipamentos</TableHead>
                  <TableHead>Valor/Hora</TableHead>
                  <TableHead>Horas Contratadas</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const eqs = getContratoEquipamentos(item);
                  return (
                    <TableRow key={item.id} className={selected.has(item.id) ? "bg-accent/5" : ""}>
                      <TableCell><Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} /></TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{item.empresas?.nome}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.empresas?.cnpj}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {eqs.map(eq => (
                            <Badge key={eq.id} variant="outline" className="text-xs">
                              {eq.tipo} {eq.modelo} {eq.tag_placa ? `(${eq.tag_placa})` : ""}
                            </Badge>
                          ))}
                          {eqs.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
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
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum contrato encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

            {/* Equipamentos - múltiplos */}
            <div className="space-y-2">
              <Label>Equipamentos</Label>
              <div className="flex gap-2">
                <Select value="" onValueChange={addEquipamento}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Adicionar equipamento..." /></SelectTrigger>
                  <SelectContent>
                    {availableEquipamentos.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.tipo} {e.modelo} {e.tag_placa ? `(${e.tag_placa})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formEquipamentos.length > 0 && (
                <div className="space-y-1 p-3 rounded-lg bg-muted/50">
                  {formEquipamentos.map(eId => {
                    const eq = equipamentos.find(e => e.id === eId);
                    if (!eq) return null;
                    return (
                      <div key={eId} className="flex items-center justify-between text-sm py-1">
                        <span>
                          <strong>{eq.tipo} {eq.modelo}</strong>
                          {eq.tag_placa && <span className="text-muted-foreground ml-2 font-mono">({eq.tag_placa})</span>}
                          {eq.numero_serie && <span className="text-muted-foreground ml-2 text-xs">Série: {eq.numero_serie}</span>}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeEquipamento(eId)}>
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground pt-1">{formEquipamentos.length} equipamento(s) selecionado(s)</p>
                </div>
              )}
              {formEquipamentos.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum equipamento adicionado. Selecione pelo menos um.</p>
              )}
            </div>

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