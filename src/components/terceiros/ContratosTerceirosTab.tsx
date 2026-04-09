import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTableHead } from "@/components/SortableTableHead";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";

interface Fornecedor { id: string; nome: string; }
interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
interface ContratoEquip {
  id?: string; equipamento_id: string; valor_hora: number; valor_hora_excedente: number;
  horas_contratadas: number; hora_minima: number; data_entrega: string; data_devolucao: string;
}
interface Contrato {
  id: string; fornecedor_id: string; data_inicio: string; data_fim: string;
  tipo_medicao: string; dia_medicao_inicio: number; dia_medicao_fim: number;
  prazo_pagamento: number; status: string; observacoes: string | null;
  fornecedor?: Fornecedor | null;
  equipamentos?: ContratoEquip[];
}

const getLabel = (eq: Equipamento | null) => {
  if (!eq) return "—";
  let l = `${eq.tipo} ${eq.modelo}`.trim();
  if (eq.tag_placa) l += ` (${eq.tag_placa})`;
  if (eq.numero_serie) l += ` - NS: ${eq.numero_serie}`;
  return l;
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyEquip: ContratoEquip = { equipamento_id: "", valor_hora: 0, valor_hora_excedente: 0, horas_contratadas: 0, hora_minima: 0, data_entrega: "", data_devolucao: "" };

export const ContratosTerceirosTab = () => {
  const [items, setItems] = useState<Contrato[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState("data_inicio");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { toast } = useToast();

  const [form, setForm] = useState({
    id: "", fornecedor_id: "", data_inicio: "", data_fim: "",
    tipo_medicao: "horas", dia_medicao_inicio: 1, dia_medicao_fim: 30,
    prazo_pagamento: 30, status: "Ativo", observacoes: "",
  });
  const [formEquips, setFormEquips] = useState<ContratoEquip[]>([{ ...emptyEquip }]);

  const fetchData = async () => {
    const [cRes, fRes, eqRes] = await Promise.all([
      supabase.from("contratos_terceiros").select("*, fornecedores(id, nome)").order("created_at", { ascending: false }),
      supabase.from("fornecedores").select("id, nome").order("nome"),
      supabase.from("equipamentos_terceiros").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
    ]);

    let contratos: Contrato[] = [];
    if (cRes.data) {
      contratos = cRes.data.map((c: any) => ({ ...c, fornecedor: c.fornecedores }));
      // Load equipment for each contract
      const ids = contratos.map(c => c.id);
      if (ids.length > 0) {
        const { data: ceData } = await supabase.from("contratos_terceiros_equipamentos").select("*").in("contrato_id", ids);
        if (ceData) {
          const byContrato = new Map<string, ContratoEquip[]>();
          ceData.forEach((ce: any) => {
            if (!byContrato.has(ce.contrato_id)) byContrato.set(ce.contrato_id, []);
            byContrato.get(ce.contrato_id)!.push(ce);
          });
          contratos.forEach(c => { c.equipamentos = byContrato.get(c.id) || []; });
        }
      }
    }
    setItems(contratos);
    if (fRes.data) setFornecedores(fRes.data);
    if (eqRes.data) setEquipamentos(eqRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return items.filter(i => [i.fornecedor?.nome, i.status, i.observacoes].some(v => v?.toLowerCase().includes(s)));
  }, [items, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortCol === "fornecedor") {
        const av = a.fornecedor?.nome ?? ""; const bv = b.fornecedor?.nome ?? "";
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av = (a as any)[sortCol] ?? ""; const bv = (b as any)[sortCol] ?? "";
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const openNew = () => {
    setForm({ id: "", fornecedor_id: "", data_inicio: "", data_fim: "", tipo_medicao: "horas", dia_medicao_inicio: 1, dia_medicao_fim: 30, prazo_pagamento: 30, status: "Ativo", observacoes: "" });
    setFormEquips([{ ...emptyEquip }]);
    setEditing(false); setDialogOpen(true);
  };

  const openEdit = async (item: Contrato) => {
    setForm({
      id: item.id, fornecedor_id: item.fornecedor_id, data_inicio: item.data_inicio, data_fim: item.data_fim,
      tipo_medicao: item.tipo_medicao, dia_medicao_inicio: item.dia_medicao_inicio, dia_medicao_fim: item.dia_medicao_fim,
      prazo_pagamento: item.prazo_pagamento, status: item.status, observacoes: item.observacoes ?? "",
    });
    setFormEquips(item.equipamentos && item.equipamentos.length > 0
      ? item.equipamentos.map(e => ({ ...e, data_entrega: e.data_entrega ?? "", data_devolucao: e.data_devolucao ?? "" }))
      : [{ ...emptyEquip }]
    );
    setEditing(true); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.fornecedor_id || !form.data_inicio || !form.data_fim) {
      toast({ title: "Fornecedor e período são obrigatórios", variant: "destructive" }); return;
    }
    const validEquips = formEquips.filter(e => e.equipamento_id);
    if (validEquips.length === 0) { toast({ title: "Adicione pelo menos um equipamento", variant: "destructive" }); return; }

    const payload: any = {
      fornecedor_id: form.fornecedor_id, data_inicio: form.data_inicio, data_fim: form.data_fim,
      tipo_medicao: form.tipo_medicao, dia_medicao_inicio: form.dia_medicao_inicio, dia_medicao_fim: form.dia_medicao_fim,
      prazo_pagamento: form.prazo_pagamento, status: form.status, observacoes: form.observacoes || null,
    };

    let contratoId = form.id;
    if (editing) {
      await supabase.from("contratos_terceiros").update(payload).eq("id", form.id);
      // Re-create equipment
      await supabase.from("contratos_terceiros_equipamentos").delete().eq("contrato_id", form.id);
    } else {
      const { data } = await supabase.from("contratos_terceiros").insert(payload).select("id").single();
      if (!data) { toast({ title: "Erro ao criar contrato", variant: "destructive" }); return; }
      contratoId = data.id;
    }

    const eqInserts = validEquips.map(e => ({
      contrato_id: contratoId, equipamento_id: e.equipamento_id,
      valor_hora: e.valor_hora, valor_hora_excedente: e.valor_hora_excedente,
      horas_contratadas: e.horas_contratadas, hora_minima: e.hora_minima,
      data_entrega: e.data_entrega || null, data_devolucao: e.data_devolucao || null,
    }));
    await supabase.from("contratos_terceiros_equipamentos").insert(eqInserts);

    toast({ title: editing ? "Contrato atualizado" : "Contrato criado" });
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("contratos_terceiros").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Contrato excluído" });
    fetchData();
  };

  const addEquip = () => setFormEquips(prev => [...prev, { ...emptyEquip }]);
  const removeEquip = (idx: number) => setFormEquips(prev => prev.filter((_, i) => i !== idx));
  const updateEquip = (idx: number, field: string, value: any) => {
    setFormEquips(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const valorLabel = form.tipo_medicao === "diarias" ? "Valor/Diária" : "Valor/Hora";
  const horasLabel = form.tipo_medicao === "diarias" ? "Diárias Contrat." : "Horas Contrat.";
  const horaMinLabel = form.tipo_medicao === "diarias" ? "Diária Mín." : "Hora Mín.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Contrato</Button>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="fornecedor"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Fornecedor</SortableTableHead>
              <SortableTableHead column="data_inicio"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Início</SortableTableHead>
              <SortableTableHead column="data_fim"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Fim</SortableTableHead>
              <TableHead>Medição</TableHead>
              <TableHead>Equip.</TableHead>
              <SortableTableHead column="status"  sortCol={sortCol} sortAsc={sortDir === "asc"} onSort={toggleSort}>Status</SortableTableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.fornecedor?.nome || "—"}</TableCell>
                <TableCell>{new Date(item.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{new Date(item.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell><Badge variant="outline">{item.tipo_medicao === "diarias" ? "Diárias" : "Horas"}</Badge></TableCell>
                <TableCell>{item.equipamentos?.length || 0}</TableCell>
                <TableCell><Badge variant={item.status === "Ativo" ? "default" : "secondary"}>{item.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum contrato cadastrado</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{editing ? "Editar Contrato" : "Novo Contrato"}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Fornecedor *</Label>
                <SearchableSelect value={form.fornecedor_id} onValueChange={v => setForm(f => ({ ...f, fornecedor_id: v }))} placeholder="Selecione..." options={fornecedores.map(f => ({ value: f.id, label: f.nome }))} />
              </div>
              <div><Label>Data Início *</Label><Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} /></div>
              <div><Label>Data Fim *</Label><Input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} /></div>
              <div>
                <Label>Tipo de Medição</Label>
                <Select value={form.tipo_medicao} onValueChange={v => setForm(f => ({ ...f, tipo_medicao: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="horas">Por Horas</SelectItem><SelectItem value="diarias">Por Diárias</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Dia Medição Início</Label><Input type="number" min={1} max={31} value={form.dia_medicao_inicio} onChange={e => setForm(f => ({ ...f, dia_medicao_inicio: Number(e.target.value) }))} /></div>
              <div><Label>Dia Medição Fim</Label><Input type="number" min={1} max={31} value={form.dia_medicao_fim} onChange={e => setForm(f => ({ ...f, dia_medicao_fim: Number(e.target.value) }))} /></div>
              <div><Label>Prazo Pagamento (dias)</Label><Input type="number" value={form.prazo_pagamento} onChange={e => setForm(f => ({ ...f, prazo_pagamento: Number(e.target.value) }))} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Encerrado">Encerrado</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Equipamentos</Label>
                <Button type="button" variant="outline" size="sm" onClick={addEquip}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
              </div>
              <div className="space-y-3">
                {formEquips.map((eq, idx) => (
                  <div key={idx} className="border rounded-lg p-3 relative">
                    {formEquips.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-6 w-6" onClick={() => removeEquip(idx)}><X className="h-3.5 w-3.5" /></Button>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs">Equipamento</Label>
                        <SearchableSelect value={eq.equipamento_id} onValueChange={v => updateEquip(idx, "equipamento_id", v)} placeholder="Selecione..." options={equipamentos.map(e => ({ value: e.id, label: getLabel(e) }))} />
                      </div>
                      <div><Label className="text-xs">{valorLabel}</Label><CurrencyInput value={eq.valor_hora} onValueChange={v => updateEquip(idx, "valor_hora", v)} /></div>
                      <div><Label className="text-xs">Valor Excedente</Label><CurrencyInput value={eq.valor_hora_excedente} onValueChange={v => updateEquip(idx, "valor_hora_excedente", v)} /></div>
                      <div><Label className="text-xs">{horasLabel}</Label><Input type="number" step="0.1" value={eq.horas_contratadas} onChange={e => updateEquip(idx, "horas_contratadas", Number(e.target.value))} /></div>
                      <div><Label className="text-xs">{horaMinLabel}</Label><Input type="number" step="0.1" value={eq.hora_minima} onChange={e => updateEquip(idx, "hora_minima", Number(e.target.value))} /></div>
                      <div><Label className="text-xs">Entrega</Label><Input type="date" value={eq.data_entrega} onChange={e => updateEquip(idx, "data_entrega", e.target.value)} /></div>
                      <div><Label className="text-xs">Devolução</Label><Input type="date" value={eq.data_devolucao} onChange={e => updateEquip(idx, "data_devolucao", e.target.value)} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir contrato?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Todos os equipamentos vinculados serão removidos.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
