import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, Pencil, Trash2, ShieldCheck, ShieldOff, Truck, ParkingSquare, FileText, FileSpreadsheet, AlertCircle } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { SortableTableHead } from "@/components/SortableTableHead";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

interface Equipment {
  id: string;
  tipo: string;
  modelo: string;
  numero_serie: string | null;
  tag_placa: string | null;
  observacoes: string | null;
  status: string;
  ano: number | null;
  valor_bem: number | null;
}

const emptyForm = { tipo: "", modelo: "", numero_serie: "", tag_placa: "", observacoes: "", status: "Ativo", ano: "", valor_bem: "" };

type StatusFilter = "todos" | "assegurados" | "nao-assegurados" | "locados" | "disponiveis";

const Equipamentos = () => {
  const [items, setItems] = useState<Equipment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [insuredIds, setInsuredIds] = useState<Set<string>>(new Set());
  const [rentedIds, setRentedIds] = useState<Set<string>>(new Set());
  const [sinistroIds, setSinistroIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const [sortCol, setSortCol] = useState("tipo");
  const [sortAsc, setSortAsc] = useState(true);
  const toggleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };

  const fetchData = async () => {
    const [eqRes, insRes, rentRes] = await Promise.all([
      supabase.from("equipamentos").select("*").order("created_at", { ascending: false }),
      supabase.from("apolices_equipamentos").select("equipamento_id, apolices!inner(status)").eq("apolices.status", "Vigente"),
      supabase.from("contratos_equipamentos").select("equipamento_id, contrato_id, data_devolucao, contratos!inner(status)").eq("contratos.status", "Ativo"),
    ]);

    if (eqRes.error) { toast({ title: "Erro", description: eqRes.error.message, variant: "destructive" }); return; }
    setItems(eqRes.data || []);

    const insured = new Set<string>();
    (insRes.data || []).forEach((r: any) => insured.add(r.equipamento_id));
    setInsuredIds(insured);

    const rented = new Set<string>();
    const hoje = new Date().toISOString().slice(0, 10);

    // Buscar equipamentos de aditivos de contratos ativos
    const { data: aditivosAtivos } = await supabase
      .from("contratos_aditivos")
      .select("id, contrato_id, contratos!inner(status)")
      .eq("contratos.status", "Ativo");

    const aditivoEquipMap = new Map<string, Set<string>>(); // contrato_id -> Set<equipamento_id> com aditivo
    if (aditivosAtivos && aditivosAtivos.length > 0) {
      const aditivoIds = aditivosAtivos.map(a => a.id);
      const { data: aditivosEquips } = await supabase
        .from("aditivos_equipamentos")
        .select("equipamento_id, data_devolucao, aditivo_id")
        .in("aditivo_id", aditivoIds);

      // Para cada (equipamento, contrato), manter apenas o aditivo mais recente (maior numero)
      // Chave: `${contrato_id}::${equipamento_id}` -> { numero, data_devolucao }
      const latestAditivoEntry = new Map<string, { numero: number; data_devolucao: string | null }>();

      (aditivosEquips || []).forEach((r: any) => {
        const aditivo = aditivosAtivos.find(a => a.id === r.aditivo_id);
        if (!aditivo) return;
        
        if (!aditivoEquipMap.has(aditivo.contrato_id)) aditivoEquipMap.set(aditivo.contrato_id, new Set());
        aditivoEquipMap.get(aditivo.contrato_id)!.add(r.equipamento_id);

        const key = `${aditivo.contrato_id}::${r.equipamento_id}`;
        const existing = latestAditivoEntry.get(key);
        const aditivoNumero = (aditivo as any).numero ?? 0;
        if (!existing || aditivoNumero > existing.numero) {
          latestAditivoEntry.set(key, { numero: aditivoNumero, data_devolucao: r.data_devolucao });
        }
      });

      // Considerar locado apenas pelo aditivo mais recente
      latestAditivoEntry.forEach((entry, key) => {
        const equipId = key.split("::")[1];
        if (!entry.data_devolucao || entry.data_devolucao > hoje) {
          rented.add(equipId);
        }
      });
    }

    // Para contratos_equipamentos: só considerar locado se NÃO existe aditivo cobrindo esse equipamento nesse contrato
    (rentRes.data || []).forEach((r: any) => {
      const contratoId = r.contratos?.id || r.contrato_id;
      // Se existe aditivo para este equipamento neste contrato, o aditivo prevalece (já tratado acima)
      if (aditivoEquipMap.has(contratoId) && aditivoEquipMap.get(contratoId)!.has(r.equipamento_id)) return;
      if (r.data_devolucao && r.data_devolucao <= hoje) return;
      rented.add(r.equipamento_id);
    });

    setRentedIds(rented);

    // Buscar equipamentos com sinistro aberto
    const { data: sinistrosAbertos } = await supabase
      .from("sinistros")
      .select("equipamento_id")
      .eq("status", "Aberto");
    const sinistroSet = new Set<string>();
    (sinistrosAbertos || []).forEach((r: any) => sinistroSet.add(r.equipamento_id));
    setSinistroIds(sinistroSet);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) => {
    const s = search.toLowerCase();
    const matchesSearch =
      i.tipo.toLowerCase().includes(s) ||
      i.modelo.toLowerCase().includes(s) ||
      (i.tag_placa || "").toLowerCase().includes(s) ||
      (i.numero_serie || "").toLowerCase().includes(s);

    if (!matchesSearch) return false;

    switch (statusFilter) {
      case "assegurados": return insuredIds.has(i.id);
      case "nao-assegurados": return !insuredIds.has(i.id);
      case "locados": return rentedIds.has(i.id);
      case "disponiveis": return !rentedIds.has(i.id);
      default: return true;
    }
  });

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "tipo": cmp = a.tipo.localeCompare(b.tipo); break;
        case "tag": cmp = (a.tag_placa || "").localeCompare(b.tag_placa || ""); break;
        case "modelo": cmp = a.modelo.localeCompare(b.modelo); break;
        case "serie": cmp = (a.numero_serie || "").localeCompare(b.numero_serie || ""); break;
        case "ano": cmp = (a.ano || 0) - (b.ano || 0); break;
        case "valor": cmp = (a.valor_bem || 0) - (b.valor_bem || 0); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortAsc]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Equipment) => {
    setEditing(item);
    setForm({
      tipo: item.tipo,
      modelo: item.modelo,
      numero_serie: item.numero_serie || "",
      tag_placa: item.tag_placa || "",
      observacoes: item.observacoes || "",
      status: item.status,
      ano: item.ano?.toString() || "",
      valor_bem: item.valor_bem?.toString() || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.tipo || !form.modelo) {
      toast({ title: "Campos obrigatórios", description: "Tipo e Modelo são obrigatórios.", variant: "destructive" });
      return;
    }

    // Verificar duplicatas por numero_serie ou tag_placa
    if (form.numero_serie) {
      const existing = items.find(i => i.numero_serie?.toLowerCase() === form.numero_serie.toLowerCase() && i.id !== editing?.id);
      if (existing) {
        toast({ title: "Erro", description: `Já existe um equipamento com o número de série "${form.numero_serie}" (${existing.tipo} ${existing.modelo}).`, variant: "destructive" });
        return;
      }
    }
    if (form.tag_placa) {
      const existing = items.find(i => i.tag_placa?.toLowerCase() === form.tag_placa.toLowerCase() && i.id !== editing?.id);
      if (existing) {
        toast({ title: "Erro", description: `Já existe um equipamento com a tag/placa "${form.tag_placa}" (${existing.tipo} ${existing.modelo}).`, variant: "destructive" });
        return;
      }
    }

    const payload = {
      tipo: form.tipo,
      modelo: form.modelo,
      numero_serie: form.numero_serie || null,
      tag_placa: form.tag_placa || null,
      observacoes: form.observacoes || null,
      status: form.status,
      ano: form.ano ? parseInt(form.ano) : null,
      valor_bem: form.valor_bem ? parseFloat(form.valor_bem) : null,
    };
    if (editing) {
      const { error } = await supabase.from("equipamentos").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("equipamentos").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("equipamentos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchData();
  };



  const statusColor = (s: string) => {
    if (s === "Ativo") return "bg-success text-success-foreground";
    if (s === "Manutenção") return "bg-warning text-warning-foreground";
    return "bg-muted text-muted-foreground";
  };

  const formatCurrency = (v: number | null) => {
    if (v == null) return "—";
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const getExportData = () => {
    const headers = ["Tipo", "Tag/Placa", "Modelo", "Nº Série", "Ano", "Valor do Bem", "Status", "Seguro", "Locação"];
    const rows = filtered.map(i => [
      i.tipo,
      i.tag_placa || "—",
      i.modelo,
      i.numero_serie || "—",
      i.ano?.toString() || "—",
      formatCurrency(i.valor_bem),
      i.status,
      insuredIds.has(i.id) ? "Sim" : "Não",
      rentedIds.has(i.id) ? "Locado" : "Disponível",
    ]);
    return { title: "Equipamentos", headers, rows, filename: "equipamentos" };
  };

  const filterButtons: { label: string; value: StatusFilter }[] = [
    { label: "Todos", value: "todos" },
    { label: "Assegurados", value: "assegurados" },
    { label: "Não-Assegurados", value: "nao-assegurados" },
    { label: "Locados", value: "locados" },
    { label: "Disponíveis", value: "disponiveis" },
  ];

  return (
    <Layout title="Equipamentos" subtitle={`${items.length} equipamentos cadastrados`}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToPDF(getExportData())}>
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Novo Equipamento
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar equipamentos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterButtons.map((fb) => (
              <Button
                key={fb.value}
                size="sm"
                variant={statusFilter === fb.value ? "default" : "outline"}
                onClick={() => setStatusFilter(fb.value)}
                className="text-xs"
              >
                {fb.label}
                {fb.value !== "todos" && (
                  <span className="ml-1 opacity-70">
                    ({fb.value === "assegurados" ? items.filter(i => insuredIds.has(i.id)).length
                      : fb.value === "nao-assegurados" ? items.filter(i => !insuredIds.has(i.id)).length
                      : fb.value === "locados" ? items.filter(i => rentedIds.has(i.id)).length
                      : items.filter(i => !rentedIds.has(i.id)).length})
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="tipo" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Tipo</SortableTableHead>
                  <SortableTableHead column="tag" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Tag / Placa</SortableTableHead>
                  <SortableTableHead column="modelo" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Modelo</SortableTableHead>
                  <SortableTableHead column="serie" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Nº Série</SortableTableHead>
                  <SortableTableHead column="ano" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Ano</SortableTableHead>
                  <SortableTableHead column="valor" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Valor do Bem</SortableTableHead>
                  <SortableTableHead column="status" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Status</SortableTableHead>
                  <TableHead className="text-center">Seguro</TableHead>
                  <TableHead className="text-center">Locação</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TooltipProvider>
                <TableBody>
                  {sorted.map((item) => {
                    const isInsured = insuredIds.has(item.id);
                    const isRented = rentedIds.has(item.id);
                    const hasSinistro = sinistroIds.has(item.id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.tipo}</TableCell>
                        <TableCell className="font-mono text-sm">{item.tag_placa}</TableCell>
                        <TableCell>{item.modelo}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.numero_serie}</TableCell>
                        <TableCell>{item.ano || "—"}</TableCell>
                        <TableCell>{formatCurrency(item.valor_bem)}</TableCell>
                        <TableCell><Badge className={statusColor(item.status)}>{item.status}</Badge></TableCell>
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                {isInsured ? (
                                  <ShieldCheck className="h-5 w-5 text-success" />
                                ) : (
                                  <ShieldOff className="h-5 w-5 text-destructive/60" />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{isInsured ? "Assegurado" : "Sem seguro"}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                {hasSinistro ? (
                                  <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs gap-1">
                                    <AlertCircle className="h-3.5 w-3.5" /> Indisponível
                                  </Badge>
                                ) : isRented ? (
                                  <Badge className="bg-primary/10 text-primary border-primary/30 text-xs gap-1">
                                    <Truck className="h-3.5 w-3.5" /> Locado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground text-xs gap-1">
                                    <ParkingSquare className="h-3.5 w-3.5" /> Disponível
                                  </Badge>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{hasSinistro ? "Em sinistro — equipamento indisponível" : isRented ? "Em contrato ativo" : "Disponível para locação"}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && sorted.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum equipamento encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </TooltipProvider>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Tipo</Label><Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="Ex: Escavadeira" /></div>
              <div><Label>Tag / Placa</Label><Input value={form.tag_placa} onChange={(e) => setForm({ ...form, tag_placa: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Modelo</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Ex: CAT 320" /></div>
              <div><Label>Nº Série</Label><Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label>Ano</Label><Input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })} placeholder="Ex: 2023" /></div>
              <div><Label>Valor do Bem (R$)</Label><CurrencyInput value={Number(form.valor_bem) || 0} onValueChange={(v) => setForm({ ...form, valor_bem: String(v) })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Manutenção">Manutenção</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} /></div>
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

export default Equipamentos;
