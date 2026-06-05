import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { getEquipLabel, calcularHorasInterpoladas } from "@/lib/utils";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, CalendarIcon, FileBarChart, FileDown, Pencil, Trash2, Receipt, DollarSign, AlertTriangle, Activity, PenTool } from "lucide-react";
import { SortableTableHead } from "@/components/SortableTableHead";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { exportToPDF } from "@/lib/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FaturamentoContent } from "./Faturamento";
import { FaturamentoTab } from "@/components/FaturamentoTab";
import { PendenteMedicaoView, HistoricoFaturamentoView, ResumoEmpresaView } from "@/components/FinanceiroViews";


import { useLocation } from "react-router-dom";


interface Equipamento {id: string;tipo: string;modelo: string;tag_placa: string | null;numero_serie: string | null;}
interface Medicao {
  id: string;
  equipamento_id: string;
  data: string;
  horimetro_inicial: number;
  horimetro_final: number;
  horas_trabalhadas: number;
  tipo: string;
  observacoes: string | null;
  equipamentos: Equipamento;
}

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const Medicoes = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "medicoes";
  });

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab") || "medicoes";
    setActiveTab(tab);
  }, [location.search]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", val);
    window.history.pushState({}, "", url.pathname + url.search);
  };

  const [items, setItems] = useState<Medicao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ equipamento_id: "", data: new Date().toISOString().split("T")[0], horimetro: 0, tipo: "Trabalho", observacoes: "", horimetro_inicial_indisp: 0, horas_indisp: 0, horas_trab: 1 });
  const [sortCol, setSortCol] = useState<"equipamento" | "tag" | "data" | "tipo" | "horimetro" | "horas_indisp">("data");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterEquip, setFilterEquip] = useState("Todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [horimetroAnterior, setHorimetroAnterior] = useState<number>(0);
  const [baselines, setBaselines] = useState<Map<string, { horim: number; data: string }>>(new Map());
  const [equipMedicaoTypes, setEquipMedicaoTypes] = useState<Map<string, "horas" | "diarias">>(new Map());
  const { toast } = useToast();

  const fetchData = async () => {
    const [medRes, equipRes, contractsRes, ceRes, aditivosRes, aeRes] = await Promise.all([
      supabase.from("medicoes").select("*").order("data", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
      supabase.from("contratos").select("id, status, tipo_medicao, equipamento_id").eq("status", "Ativo"),
      supabase.from("contratos_equipamentos").select("contrato_id, equipamento_id"),
      supabase.from("contratos_aditivos").select("id, contrato_id"),
      supabase.from("aditivos_equipamentos").select("aditivo_id, equipamento_id")
    ]);
    
    if (equipRes.data) setEquipamentos(equipRes.data);

    if (contractsRes.data) {
      const map = new Map<string, "horas" | "diarias">();
      const contractMedicaoTypes = new Map<string, "horas" | "diarias">();
      const aditivoToContract = new Map<string, string>();
      
      contractsRes.data.forEach((c: any) => {
        const tipo = (c.tipo_medicao || "horas") as "horas" | "diarias";
        contractMedicaoTypes.set(c.id, tipo);
        if (c.equipamento_id) {
          map.set(c.equipamento_id, tipo);
        }
      });

      if (ceRes.data) {
        ceRes.data.forEach((ce: any) => {
          const tipo = contractMedicaoTypes.get(ce.contrato_id);
          if (tipo) {
            map.set(ce.equipamento_id, tipo);
          }
        });
      }

      if (aditivosRes.data) {
        aditivosRes.data.forEach((a: any) => {
          aditivoToContract.set(a.id, a.contrato_id);
        });
      }

      if (aeRes.data) {
        aeRes.data.forEach((ae: any) => {
          const contratoId = aditivoToContract.get(ae.aditivo_id);
          if (contratoId) {
            const tipo = contractMedicaoTypes.get(contratoId);
            if (tipo) {
              map.set(ae.equipamento_id, tipo);
            }
          }
        });
      }

      setEquipMedicaoTypes(map);
    }
    
    if (medRes.data && equipRes.data) {
      const equipMap = new Map(equipRes.data.map((e: any) => [e.id, e]));
      const mapped = medRes.data.map((m: any) => ({
        ...m,
        equipamentos: equipMap.get(m.equipamento_id) || null
      }));
      setItems(mapped as unknown as Medicao[]);
    } else if (medRes.data) {
      setItems(medRes.data as unknown as Medicao[]);
    }
    
    setLoading(false);
  };

  useEffect(() => {fetchData();}, []);

  const fetchHorimetroPorData = async (equipId: string, data: string, excludeId?: string) => {
    let query = supabase.
    from("medicoes").
    select("horimetro_final, data").
    eq("equipamento_id", equipId).
    lt("data", data).
    order("data", { ascending: false }).
    limit(1);

    const { data: result } = await query;
    if (result && result.length > 0) {
      setHorimetroAnterior(Number(result[0].horimetro_final));
    } else {
      setHorimetroAnterior(0);
    }
  };

  const lastEntryDate = items
    .filter(i => filterEquip === "Todos" || i.equipamento_id === filterEquip)
    .reduce((max, i) => (i.data > max ? i.data : max), "");

  const validDataFim = (() => {
    if (!dataFim) return undefined;
    if (lastEntryDate && format(dataFim, "yyyy-MM-dd") > lastEntryDate) {
      return parseLocalDate(lastEntryDate);
    }
    return dataFim;
  })();

  const filtered = items.filter((i) => {
    if (filterEquip !== "Todos" && i.equipamento_id !== filterEquip) return false;
    const itemDate = parseLocalDate(i.data);
    if (dataInicio) {if (itemDate < dataInicio) return false;}
    if (validDataFim) {const fim = new Date(validDataFim);fim.setHours(23, 59, 59, 999);if (itemDate > fim) return false;}
    return true;
  });

  const fetchBaselines = useCallback(async () => {
    if (!dataInicio) {
      setBaselines(new Map());
      return;
    }
    const inicioStr = dataInicio.toISOString().split("T")[0];
    const uniqueEquipIds = [...new Set(filtered.map(m => m.equipamento_id))];
    if (uniqueEquipIds.length === 0) {
      setBaselines(new Map());
      return;
    }
    const promises = uniqueEquipIds.map(eqId =>
      supabase.from("medicoes").select("equipamento_id, horimetro_final, data")
        .eq("equipamento_id", eqId).eq("tipo", "Trabalho").lt("data", inicioStr)
        .order("data", { ascending: false }).limit(1)
    );
    const results = await Promise.all(promises);
    const map = new Map<string, { horim: number; data: string }>();
    results.forEach(r => {
      if (r.data && r.data.length > 0) {
        map.set(r.data[0].equipamento_id, { horim: Number(r.data[0].horimetro_final), data: r.data[0].data });
      }
    });
    setBaselines(map);
  }, [filtered.length, dataInicio, filterEquip]);

  useEffect(() => { fetchBaselines(); }, [fetchBaselines]);

  const summaryMap = new Map<string, {totalHoras: number;entries: number;label: string;tag: string;mediaHorasDia: number;}>();
  const equipEntries = new Map<string, Medicao[]>();
  filtered.forEach((m) => {
    const arr = equipEntries.get(m.equipamento_id) || [];
    arr.push(m);
    equipEntries.set(m.equipamento_id, arr);
  });
  equipEntries.forEach((entries, eqId) => {
    const sorted = [...entries].sort((a, b) => a.data.localeCompare(b.data));
    const first = sorted[0];
    const label = `${first.equipamentos?.tipo} ${first.equipamentos?.modelo}`;
    const tag = first.equipamentos?.tag_placa || "";
    const trabalhoEntries = sorted.filter(e => (e.tipo || "Trabalho") === "Trabalho");

    const isDiaria = equipMedicaoTypes.get(eqId) === "diarias";
    let totalHoras = 0;
    let mediaHorasDia = 0;

    if (isDiaria) {
      totalHoras = trabalhoEntries.reduce((sum, e) => sum + Number(e.horas_trabalhadas || 0), 0);
      mediaHorasDia = 0;
    } else if (dataInicio && validDataFim) {
      const inicioStr = format(dataInicio, "yyyy-MM-dd");
      const fimStr = format(validDataFim, "yyyy-MM-dd");
      const allReadings: { data: string; horimetro_final: number }[] = [];
      const baseline = baselines.get(eqId);
      if (baseline) {
        allReadings.push({ data: baseline.data, horimetro_final: baseline.horim });
      }
      for (const e of trabalhoEntries) {
        allReadings.push({ data: e.data, horimetro_final: Number(e.horimetro_final) });
      }
      const result = calcularHorasInterpoladas(allReadings, inicioStr, fimStr);
      totalHoras = result.totalHoras;
      mediaHorasDia = result.mediaHorasDia;
    } else {
      const byDay = new Map<string, number>();
      for (const e of trabalhoEntries) {
        const d = String(e.data);
        const v = Number(e.horimetro_final);
        if (!byDay.has(d) || v > byDay.get(d)!) byDay.set(d, v);
      }
      const dayValues = Array.from(byDay.values());
      if (dayValues.length > 0) {
        const maior = Math.max(...dayValues);
        const menor = dayValues.length >= 2 ? Math.min(...dayValues) : maior;
        totalHoras = Math.max(0, maior - menor);
      }
    }
    summaryMap.set(eqId, { totalHoras, entries: entries.length, label, tag, mediaHorasDia });
  });

  const totalHorasGeral = Array.from(summaryMap.values()).reduce((acc, s) => acc + s.totalHoras, 0);

  const isDiaria = form.equipamento_id ? equipMedicaoTypes.get(form.equipamento_id) === "diarias" : false;
  const horasCalculadas = isDiaria 
    ? (form.tipo === "Indisponível" ? form.horas_indisp : form.horas_trab)
    : (form.tipo === "Indisponível"
      ? form.horas_indisp
      : Math.max(0, form.horimetro - (form.horimetro_inicial_indisp || horimetroAnterior)));

  const openNew = () => {
    const defaultEquip = equipamentos.length > 0 ? equipamentos[0].id : "";
    setEditingId(null);
    setForm({
      equipamento_id: defaultEquip,
      data: new Date().toISOString().split("T")[0],
      horimetro: 0,
      tipo: "Trabalho",
      observacoes: "",
      horimetro_inicial_indisp: 0,
      horas_indisp: 0,
      horas_trab: 1,
    });
    if (defaultEquip) fetchHorimetroPorData(defaultEquip, new Date().toISOString().split("T")[0]);
    setDialogOpen(true);
  };

  const openEdit = (m: Medicao) => {
    setEditingId(m.id);
    const isIndisp = m.tipo === "Indisponível";
    const isDiaria = equipMedicaoTypes.get(m.equipamento_id) === "diarias";
    setForm({ 
      equipamento_id: m.equipamento_id, 
      data: m.data, 
      horimetro: isDiaria ? 0 : Number(m.horimetro_final), 
      tipo: m.tipo || "Trabalho", 
      observacoes: m.observacoes || "", 
      horimetro_inicial_indisp: isIndisp ? Number(m.horimetro_inicial) : 0, 
      horas_indisp: isIndisp ? Number(m.horas_trabalhadas) : 0,
      horas_trab: !isIndisp && isDiaria ? Number(m.horas_trabalhadas) : 1
    });
    setHorimetroAnterior(Number(m.horimetro_inicial));
    setDialogOpen(true);
    fetchHorimetroPorData(m.equipamento_id, m.data, m.id);
  };

  const handleSave = async () => {
    if (!form.equipamento_id) {
      toast({ title: "Campos obrigatórios", description: "Selecione um equipamento.", variant: "destructive" });
      return;
    }

    const isDiaria = equipMedicaoTypes.get(form.equipamento_id) === "diarias";

    if (!isDiaria && form.horimetro <= 0 && form.tipo !== "Indisponível") {
      toast({ title: "Campos obrigatórios", description: "Informe o horímetro.", variant: "destructive" });
      return;
    }

    const isIndisp = form.tipo === "Indisponível";
    let hInicial = 0;
    let hFinal = 0;
    let horasTrabalhadas = 0;

    if (isDiaria) {
      hInicial = 0;
      hFinal = 0;
      horasTrabalhadas = isIndisp ? form.horas_indisp : form.horas_trab;
    } else {
      hInicial = isIndisp ? form.horimetro_inicial_indisp : horimetroAnterior;
      hFinal = form.horimetro;
      horasTrabalhadas = isIndisp ? form.horas_indisp : Math.max(0, form.horimetro - hInicial);
    }

    if (editingId) {
      const { error } = await supabase.from("medicoes").update({
        equipamento_id: form.equipamento_id,
        data: form.data,
        horimetro_inicial: hInicial,
        horimetro_final: hFinal,
        horas_trabalhadas: horasTrabalhadas,
        tipo: form.tipo,
        observacoes: form.observacoes || null,
      }).eq("id", editingId);
      if (error) {toast({ title: "Erro", description: error.message, variant: "destructive" });return;}
    } else {
      const { error } = await supabase.from("medicoes").insert({
        id: crypto.randomUUID(),
        equipamento_id: form.equipamento_id,
        data: form.data,
        horimetro_inicial: hInicial,
        horimetro_final: hFinal,
        horas_trabalhadas: horasTrabalhadas,
        tipo: form.tipo,
        observacoes: form.observacoes || null,
      });
      if (error) {toast({ title: "Erro", description: error.message, variant: "destructive" });return;}
    }
    setDialogOpen(false);
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("medicoes").delete().eq("id", deleteId);
    if (error) {toast({ title: "Erro", description: error.message, variant: "destructive" });return;}
    setDeleteId(null);
    fetchData();
  };

  const onEquipChange = (v: string) => {
    const isDiaria = equipMedicaoTypes.get(v) === "diarias";
    setForm((prev) => ({ 
      ...prev, 
      equipamento_id: v,
      horas_indisp: isDiaria ? 1 : prev.horas_indisp
    }));
    if (form.data) fetchHorimetroPorData(v, form.data, editingId || undefined);
  };

  const onDataChange = (v: string) => {
    setForm((prev) => ({ ...prev, data: v }));
    if (form.equipamento_id) fetchHorimetroPorData(form.equipamento_id, v, editingId || undefined);
  };

  const clearFilters = () => {setFilterEquip("Todos");setDataInicio(undefined);setDataFim(undefined);};
  const hasFilters = filterEquip !== "Todos" || dataInicio || dataFim;

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case "equipamento": cmp = `${a.equipamentos?.tipo} ${a.equipamentos?.modelo}`.localeCompare(`${b.equipamentos?.tipo} ${b.equipamentos?.modelo}`); break;
      case "tag": cmp = (a.equipamentos?.tag_placa || "").localeCompare(b.equipamentos?.tag_placa || ""); break;
      case "data": cmp = a.data.localeCompare(b.data); break;
      case "tipo": cmp = (a.tipo || "Trabalho").localeCompare(b.tipo || "Trabalho"); break;
      case "horimetro": cmp = Number(a.horimetro_final) - Number(b.horimetro_final); break;
      case "horas_indisp": cmp = Number(a.horas_trabalhadas) - Number(b.horas_trabalhadas); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const getLayoutHeader = () => {
    switch (activeTab) {
      case "faturamento":
        return { title: "Medição", subtitle: "Controle de medições de locações" };
      case "faturamento-novo":
        return { title: "Faturamento", subtitle: "Lançamento e controle de faturamentos" };
      case "pendentes-medicao":
        return { title: "Pendente de Medição", subtitle: "Alertas de medições e faturamentos pendentes" };
      case "historico-faturamento":
        return { title: "Histórico de Faturamento", subtitle: "Histórico completo de notas emitidas e pagamentos" };
      case "resumo-empresa":
        return { title: "Resumo por Empresa", subtitle: "Consolidado de contratos e faturamentos por cliente" };
      default:
        return { title: "Horímetro", subtitle: "Controle de horímetros e diárias" };
    }
  };

  const header = getLayoutHeader();

  return (
    <Layout title={header.title} subtitle={header.subtitle}>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsContent value="medicoes">
      <div className="space-y-6">
        {/* KPI Cards */}
        {hasFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-accent/30 bg-accent/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Geral</p>
                  <h3 className="text-2xl font-bold mt-1 text-sidebar">
                    {totalHorasGeral.toFixed(1)}
                    {filterEquip !== "Todos" && equipMedicaoTypes.get(filterEquip) === "diarias" ? "d" : "h"}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">{filtered.length} registros (filtrado)</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <Clock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            {Array.from(summaryMap.entries()).map(([id, data]) => {
              const isDiaria = equipMedicaoTypes.get(id) === "diarias";
              return (
                <Card key={id} className="hover:shadow-md transition-shadow bg-card shadow-sm border-border">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground line-clamp-1" title={data.label}>{data.label}</p>
                        <h3 className="text-xl font-bold mt-1 text-accent">
                          {data.totalHoras.toFixed(1)}
                          {isDiaria ? "d" : "h"}
                        </h3>
                        {data.tag && <p className="text-[10px] font-mono text-muted-foreground mt-1">{data.tag}</p>}
                      </div>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Activity className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-[10px] text-muted-foreground">{data.entries} registros</p>
                      {data.mediaHorasDia > 0 && (
                        <p className="text-[10px] text-accent/70 font-medium">Média: {data.mediaHorasDia.toFixed(2)} h/dia</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
            <div className="flex items-center gap-2">
              <FileBarChart className="h-4 w-4 text-accent hidden sm:block" />
              <SearchableSelect
                value={filterEquip}
                onValueChange={setFilterEquip}
                placeholder="Todos os Equipamentos"
                searchPlaceholder="Pesquisar equipamento..."
                className="w-full sm:w-64 bg-background"
                options={[
                  { value: "Todos", label: "Todos os Equipamentos" },
                  ...equipamentos.map((e) => ({ value: e.id, label: getEquipLabel(e) })),
                ]}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="date"
                className="w-full sm:w-40 bg-background"
                value={dataInicio ? format(dataInicio, "yyyy-MM-dd") : ""}
                onChange={(e) => setDataInicio(e.target.value ? parseLocalDate(e.target.value) : undefined)}
              />
              <span className="text-muted-foreground text-sm">até</span>
              <Input
                type="date"
                className="w-full sm:w-40 bg-background"
                value={dataFim ? format(dataFim, "yyyy-MM-dd") : ""}
                onChange={(e) => setDataFim(e.target.value ? parseLocalDate(e.target.value) : undefined)}
              />
            </div>
            {hasFilters &&
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground whitespace-nowrap">Limpar filtros</Button>
            }
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const headers = ["Equipamento", "Tag/Placa", "Data", "Tipo", "Horímetro/Diária", "Indisponibilidade"];
                const rows = filtered.map((m) => {
                  const isDiaria = equipMedicaoTypes.get(m.equipamento_id) === "diarias";
                  return [
                    `${m.equipamentos?.tipo} ${m.equipamentos?.modelo}`,
                    m.equipamentos?.tag_placa || "—",
                    parseLocalDate(m.data).toLocaleDateString("pt-BR"),
                    m.tipo || "Trabalho",
                    isDiaria ? "Diária (Trabalho)" : Number(m.horimetro_final).toFixed(1),
                    (m.tipo || "Trabalho") === "Indisponível" ? `${Number(m.horas_trabalhadas).toFixed(1)}${isDiaria ? "d" : "h"}` : "—"
                  ];
                });
                const periodo = dataInicio && dataFim ? ` - ${format(dataInicio, "dd/MM/yyyy")} a ${format(dataFim, "dd/MM/yyyy")}` : "";
                exportToPDF({ title: `Relatório de Horímetro Mensal${periodo}`, headers, rows, filename: `horimetro_mensal_${new Date().toISOString().slice(0, 10)}` });
              }} className="bg-background">
                <FileDown className="h-4 w-4 mr-1 text-primary" /> PDF
              </Button>
            </div>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Novo
            </Button>
          </div>
        </div>

        <Card className="shadow-sm border-border overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                 <TableRow>
                   <SortableTableHead column="equipamento" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Equipamento</SortableTableHead>
                   <SortableTableHead column="tag" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Tag/Placa</SortableTableHead>
                   <SortableTableHead column="data" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Data</SortableTableHead>
                   <SortableTableHead column="tipo" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Tipo</SortableTableHead>
                   <SortableTableHead column="horimetro" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Horímetro / Lançamento</SortableTableHead>
                   <SortableTableHead column="horas_indisp" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Horas / Diárias Indisp.</SortableTableHead>
                   <TableHead className="w-20">Ações</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((item) =>
                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <PenTool className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm leading-none">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                     <TableCell className="text-sm">{parseLocalDate(item.data).toLocaleDateString("pt-BR")}</TableCell>
                     <TableCell>
                       {(item.tipo || "Trabalho") === "Indisponível" ? (
                         <Badge variant="destructive" className="text-xs gap-1">
                           <AlertTriangle className="h-3 w-3" /> Indisponível
                         </Badge>
                       ) : (
                         <Badge className="bg-accent/10 text-accent border-0 text-xs">Trabalho</Badge>
                       )}
                     </TableCell>
                     <TableCell className="text-sm font-medium">
                       {equipMedicaoTypes.get(item.equipamento_id) === "diarias" 
                          ? (item.tipo === "Trabalho" ? `${Number(item.horas_trabalhadas).toFixed(1)}d` : "—") 
                          : Number(item.horimetro_final).toFixed(1)}
                     </TableCell>
                     <TableCell>
                        {(item.tipo || "Trabalho") === "Indisponível" ? (
                          <Badge className="font-semibold border-0 bg-destructive/10 text-destructive">
                            <Clock className="h-3 w-3 mr-1" />
                            {Number(item.horas_trabalhadas).toFixed(1)}
                            {equipMedicaoTypes.get(item.equipamento_id) === "diarias" ? "d" : "h"}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && sorted.length === 0 &&
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum horímetro encontrado</TableCell></TableRow>
                }
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
        </TabsContent>
        <TabsContent value="faturamento">
          <FaturamentoContent />
        </TabsContent>
        <TabsContent value="faturamento-novo">
          <FaturamentoTab />
        </TabsContent>
        <TabsContent value="pendentes-medicao">
          <PendenteMedicaoView />
        </TabsContent>
        <TabsContent value="historico-faturamento">
          <HistoricoFaturamentoView />
        </TabsContent>
        <TabsContent value="resumo-empresa">
          <ResumoEmpresaView />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          {(() => {
            const isDiaria = equipMedicaoTypes.get(form.equipamento_id) === "diarias";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-accent" />
                    {editingId ? (isDiaria ? "Editar Lançamento de Diária" : "Editar Horímetro") : (isDiaria ? "Novo Lançamento de Diária" : "Novo Horímetro")}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label>Equipamento</Label>
                    <SearchableSelect
                      value={form.equipamento_id}
                      onValueChange={onEquipChange}
                      placeholder="Selecione o equipamento"
                      searchPlaceholder="Pesquisar equipamento..."
                      options={equipamentos.map((e) => ({ value: e.id, label: getEquipLabel(e) }))}
                    />
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={form.data} onChange={(e) => onDataChange(e.target.value)} />
                  </div>
                  <div>
                    <Label>Tipo de Lançamento</Label>
                    <RadioGroup 
                      value={form.tipo} 
                      onValueChange={(v) => setForm({ 
                        ...form, 
                        tipo: v,
                        horas_indisp: v === "Indisponível" && isDiaria ? 1 : form.horas_indisp
                      })} 
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Trabalho" id="tipo-trabalho" />
                        <Label htmlFor="tipo-trabalho" className="cursor-pointer">Trabalho</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Indisponível" id="tipo-indisponivel" />
                        <Label htmlFor="tipo-indisponivel" className="cursor-pointer">Indisponível</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  {form.tipo === "Indisponível" && (
                    <>
                      <div>
                        <Label>Observação (motivo da indisponibilidade)</Label>
                        <Textarea
                          value={form.observacoes}
                          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                          placeholder="Ex: Manutenção preventiva, quebra mecânica..."
                          rows={3}
                        />
                      </div>
                      {!isDiaria && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Horímetro Inicial</Label>
                            <Input type="number" step="0.1" value={form.horimetro_inicial_indisp || ""} onChange={(e) => {
                              const val = Number(e.target.value);
                              const diff = Math.max(0, form.horimetro - val);
                              setForm({ ...form, horimetro_inicial_indisp: val, horas_indisp: diff });
                            }} placeholder="Ex: 180.0" />
                          </div>
                          <div>
                            <Label>Horímetro Final</Label>
                            <Input type="number" step="0.1" value={form.horimetro || ""} onChange={(e) => {
                              const val = Number(e.target.value);
                              const diff = Math.max(0, val - form.horimetro_inicial_indisp);
                              setForm({ ...form, horimetro: val, horas_indisp: diff });
                            }} placeholder="Ex: 189.5" />
                          </div>
                        </div>
                      )}
                      <div>
                        <Label>{isDiaria ? "Diárias Indisponíveis (editável)" : "Horas Indisponíveis (editável)"}</Label>
                        <Input type="number" step="0.1" value={form.horas_indisp || ""} onChange={(e) => setForm({ ...form, horas_indisp: Number(e.target.value) })} placeholder={isDiaria ? "Ex: 1.0" : "Ex: 9.5"} />
                        {!isDiaria && <p className="text-xs text-muted-foreground mt-1">Pré-calculado pela diferença do horímetro. Edite se necessário.</p>}
                      </div>
                    </>
                  )}
                  {form.tipo === "Trabalho" && (
                    <div>
                      {isDiaria ? (
                        <div className="space-y-4">
                          <div className="p-3 bg-accent/10 rounded-md border border-accent/20">
                            <p className="text-xs text-muted-foreground leading-normal">
                              <strong>Lançamento por Diárias:</strong> Este equipamento possui contrato por diárias. Ao registrar, insira a quantidade de diárias de trabalho realizadas.
                            </p>
                          </div>
                          <div>
                            <Label>Diárias Trabalhadas (editável)</Label>
                            <Input 
                              type="number" 
                              step="0.1" 
                              value={form.horas_trab || ""} 
                              onChange={(e) => setForm({ ...form, horas_trab: Number(e.target.value) })} 
                              placeholder="Ex: 1.0" 
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <Label>Horímetro Atual</Label>
                          <Input type="number" step="0.1" value={form.horimetro || ""} onChange={(e) => setForm({ ...form, horimetro: Number(e.target.value) })} placeholder="Ex: 189.5" />
                        </>
                      )}
                    </div>
                  )}
                  {!isDiaria && horasCalculadas > 0 && (
                    <div className={cn("p-3 rounded-lg text-center", form.tipo === "Indisponível" ? "bg-destructive/10" : "bg-accent/10")}>
                      <p className="text-sm text-muted-foreground">
                        {form.tipo === "Indisponível" ? "Horas indisponíveis (serão descontadas)" : "Horas trabalhadas (diferença)"}
                      </p>
                      <p className={cn("text-2xl font-bold", form.tipo === "Indisponível" ? "text-destructive" : "text-accent")}>{horasCalculadas.toFixed(1)}h</p>
                      <p className="text-xs text-muted-foreground">
                        {form.tipo === "Indisponível" ? form.horimetro_inicial_indisp.toFixed(1) : horimetroAnterior.toFixed(1)} → {form.horimetro.toFixed(1)}
                      </p>
                    </div>
                  )}
                  {isDiaria && form.tipo === "Indisponível" && form.horas_indisp > 0 && (
                    <div className="p-3 rounded-lg text-center bg-destructive/10">
                      <p className="text-sm text-muted-foreground">Diárias indisponíveis (serão descontadas)</p>
                      <p className="text-2xl font-bold text-destructive">{form.horas_indisp.toFixed(1)}d</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">
                    {editingId ? "Salvar" : "Registrar"}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Horímetro</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este registro de horímetro? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>);

};

import React from "react";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-xl mx-auto bg-destructive/10 text-destructive rounded-lg border border-destructive/20 mt-10">
          <h2 className="text-lg font-bold mb-2">Ops! Algo deu errado ao carregar a página.</h2>
          <p className="text-sm font-semibold mb-4">{this.state.error?.toString()}</p>
          <pre className="text-xs bg-card p-3 rounded border overflow-auto max-h-60 text-foreground">
            {this.state.error?.stack}
          </pre>
          <Button onClick={() => window.location.reload()} className="mt-4 bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Recarregar Página
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MedicoesWithErrorBoundary = () => (
  <ErrorBoundary>
    <Medicoes />
  </ErrorBoundary>
);

export default MedicoesWithErrorBoundary;