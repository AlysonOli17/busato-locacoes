import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { ChecklistsTab } from "@/components/ChecklistsTab";
import { ComodatosTab } from "@/components/ComodatosTab";
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
import { Plus, Search, Pencil, Trash2, ShieldCheck, ShieldOff, Truck, ParkingSquare, FileText, FileSpreadsheet, AlertCircle, Wrench, Activity, Tractor, Box, LayoutGrid, List } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { SortableTableHead } from "@/components/SortableTableHead";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";

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

const EquipamentosLista = () => {
  const [items, setItems] = useState<Equipment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [insuredIds, setInsuredIds] = useState<Set<string>>(new Set());
  const [rentedIds, setRentedIds] = useState<Set<string>>(new Set());
  const [sinistroIds, setSinistroIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const [sortCol, setSortCol] = useState("tipo");
  const [sortAsc, setSortAsc] = useState(true);
  const toggleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };

  const fetchData = async () => {
    const [eqRes, apolicesRes, apolicesEqRes, contratosRes, ceRes, aditivosRes, aeRes] = await Promise.all([
      supabase.from("equipamentos").select("*").order("created_at", { ascending: false }),
      supabase.from("apolices").select("id, status"),
      supabase.from("apolices_equipamentos").select("equipamento_id, apolice_id"),
      supabase.from("contratos").select("id, status"),
      supabase.from("contratos_equipamentos").select("equipamento_id, contrato_id, data_devolucao"),
      supabase.from("contratos_aditivos").select("id, contrato_id, numero"),
      supabase.from("aditivos_equipamentos").select("equipamento_id, data_devolucao, aditivo_id")
    ]);

    if (eqRes.error) { toast({ title: "Erro", description: eqRes.error.message, variant: "destructive" }); return; }
    setItems(eqRes.data || []);

    const vigentesSet = new Set((apolicesRes.data || []).filter((a: any) => a.status === "Vigente").map((a: any) => a.id));
    const insured = new Set<string>();
    (apolicesEqRes.data || []).forEach((r: any) => {
      if (vigentesSet.has(r.apolice_id)) insured.add(r.equipamento_id);
    });
    setInsuredIds(insured);

    const rented = new Set<string>();
    const hoje = new Date().toISOString().slice(0, 10);

    const ativosSet = new Set((contratosRes.data || []).filter((c: any) => c.status === "Ativo").map((c: any) => c.id));
    
    // Contratos Ativos
    const ceList = (ceRes.data || []).filter((ce: any) => ativosSet.has(ce.contrato_id));
    
    // Aditivos Ativos
    const aditivosAtivos = (aditivosRes.data || []).filter((a: any) => ativosSet.has(a.contrato_id));

    const aditivoEquipMap = new Map<string, Set<string>>(); // contrato_id -> Set<equipamento_id> com aditivo
    const latestAditivoEntry = new Map<string, { numero: number; data_devolucao: string | null }>();

    if (aditivosAtivos.length > 0) {
      const aditivoIds = new Set(aditivosAtivos.map(a => a.id));
      const aditivosEquips = (aeRes.data || []).filter((ae: any) => aditivoIds.has(ae.aditivo_id));

      aditivosEquips.forEach((r: any) => {
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
    ceList.forEach((r: any) => {
      const contratoId = r.contrato_id;
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
      const payloadWithId = { ...payload, id: crypto.randomUUID() };
      const { error } = await supabase.from("equipamentos").insert(payloadWithId);
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
    <>
      <div className="space-y-6">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent p-5 rounded-2xl border border-accent/20 shadow-sm backdrop-blur-md">
          <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por tipo, modelo ou placa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background" />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportToPDF(getExportData())} className="bg-background">
                <FileText className="h-4 w-4 mr-2 text-destructive" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())} className="bg-background">
                <FileSpreadsheet className="h-4 w-4 mr-2 text-success" /> Excel
              </Button>
            </div>
            
            <div className="flex gap-1 bg-background p-1 rounded-md border border-border/50">
              <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" className="px-2 h-7" onClick={() => setViewMode("list")}>
                <List className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" className="px-2 h-7" onClick={() => setViewMode("grid")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm rounded-full px-5">
              <Plus className="h-4 w-4 mr-2" /> Novo Equipamento
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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

          {/* Cabeçalho sutil (desktop) */}
          {sorted.length > 0 && viewMode === "list" && (
            <div className="hidden md:flex items-center px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="w-[48px]"></div>
              <div className="flex-1 min-w-0">Equipamento</div>
              <div className="w-[140px]">Série / Ano</div>
              <div className="w-[140px] text-right">Valor do Bem</div>
              <div className="w-[100px] text-center ml-4">Status</div>
              <div className="w-[100px] text-center">Seguro</div>
              <div className="w-[100px] text-center">Locação</div>
              <div className="w-[80px]"></div>
            </div>
          )}

          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col gap-2"}>


          {sorted.map((item) => {
            const isInsured = insuredIds.has(item.id);
            const isRented = rentedIds.has(item.id);
            const hasSinistro = sinistroIds.has(item.id);
            
            const getBorderColor = () => {
              if (item.status === "Manutenção") return "border-warning";
              if (item.status === "Inativo") return "border-destructive";
              return "border-primary";
            };

            return (
              <div 
                key={item.id} 
                className={`group bg-card/60 backdrop-blur-sm hover:bg-accent/5 border border-border/60 hover:border-accent/40 rounded-2xl p-4 flex ${viewMode === "grid" ? "flex-col" : "flex-col md:flex-row md:items-center"} gap-4 transition-all duration-300 relative border-l-4 ${getBorderColor()} shadow-sm hover:shadow-md`}
              >
                {/* Header do Card (Ícone + Título + Ações) */}
                <div className={`flex ${viewMode === "grid" ? "items-start justify-between w-full" : "items-center gap-4 flex-1 min-w-0"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                      <Tractor className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground truncate">{item.tipo}</h3>
                        <Badge variant="secondary" className="font-normal text-[10px] py-0 px-1.5 bg-accent/10 text-accent border-accent/20">
                          {item.tag_placa || "S/ PLACA"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.modelo}</p>
                    </div>
                  </div>
                  
                  {viewMode === "grid" && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/20 hover:text-primary" onClick={() => openEdit(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {viewMode === "grid" && <div className="h-px w-full bg-border/50 my-1"></div>}

                {/* Série / Ano / Valor */}
                <div className={`flex ${viewMode === "grid" ? "justify-between w-full" : "items-center gap-4 md:gap-0 pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0"}`}>
                  <div className={`${viewMode === "grid" ? "" : "md:w-[140px]"} flex flex-col`}>
                    <span className={`text-[10px] text-muted-foreground uppercase mb-0.5 ${viewMode === "list" && "md:hidden"}`}>Série / Ano</span>
                    <span className="font-medium text-xs truncate" title={item.numero_serie || "S/N"}>{item.numero_serie || "—"}</span>
                    <span className="text-[10px] text-muted-foreground">{item.ano || "—"}</span>
                  </div>
                  <div className={`${viewMode === "grid" ? "text-right" : "md:w-[140px] md:text-right"} flex flex-col`}>
                    <span className={`text-[10px] text-muted-foreground uppercase mb-0.5 ${viewMode === "list" && "md:hidden"}`}>Valor do Bem</span>
                    <span className="font-bold text-sm text-foreground">{formatCurrency(item.valor_bem)}</span>
                  </div>
                </div>

                {/* Badges de Status (Status, Seguro, Locação) */}
                <div className={`flex ${viewMode === "grid" ? "flex-wrap gap-2 pt-2" : "items-center gap-2 md:gap-0 pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0 flex-wrap md:flex-nowrap"}`}>
                  <div className={`${viewMode === "grid" ? "" : "md:w-[100px] flex justify-start md:justify-center md:ml-4"}`}>
                    <Badge className={cn("text-[10px] py-0 px-1.5", statusColor(item.status))}>{item.status}</Badge>
                  </div>

                  <div className={`${viewMode === "grid" ? "" : "md:w-[100px] flex justify-start md:justify-center"}`}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn("flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-help w-fit", isInsured ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                            {isInsured ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                            {isInsured ? "Segurado" : "S/ Seguro"}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{isInsured ? "Possui apólice vigente" : "Sem cobertura de seguro"}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className={`${viewMode === "grid" ? "" : "md:w-[100px] flex justify-start md:justify-center"}`}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn("flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-help w-fit", hasSinistro ? "bg-destructive/10 text-destructive" : isRented ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                            {hasSinistro ? <AlertCircle className="h-3 w-3" /> : isRented ? <Truck className="h-3 w-3" /> : <ParkingSquare className="h-3 w-3" />}
                            {hasSinistro ? "Sinistro" : isRented ? "Locado" : "Disp."}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{hasSinistro ? "Equipamento em sinistro" : isRented ? "Em contrato ativo" : "Pátio / Disponível"}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Actions (List View) */}
                {viewMode === "list" && (
                  <div className="flex md:w-[80px] justify-end gap-1 pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/20 hover:text-primary" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          </div>
          
          {!loading && sorted.length === 0 && (
            <div className="py-12 text-center text-muted-foreground bg-card rounded-xl border border-border border-dashed">
              <Box className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Nenhum equipamento encontrado</p>
              <p className="text-xs opacity-70 mt-1">Tente ajustar seus filtros ou busca.</p>
            </div>
          )}
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
    </>
  );
};

const Equipamentos = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "cadastro";
  });

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab") || "cadastro";
    setActiveTab(tab);
  }, [location.search]);

  const getSubtitle = () => {
    switch (activeTab) {
      case "checklist":
        return "Inspeções e laudos de entrega e devolução";
      case "comodatos":
        return "Gerenciamento de contratos de comodato";
      default:
        return "Gestão e controle de frota";
    }
  };

  return (
    <Layout title="Equipamentos" subtitle={getSubtitle()}>
      {activeTab === "checklist" && <ChecklistsTab />}
      {activeTab === "comodatos" && <ComodatosTab />}
      {activeTab === "cadastro" && <EquipamentosLista />}
    </Layout>
  );
};

export default Equipamentos;
