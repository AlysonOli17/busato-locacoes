import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Shield, FileDown, FileSpreadsheet, AlertTriangle, DollarSign, CalendarClock, RefreshCw, AlertCircle, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import ExcelJS from "exceljs";

interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; }

interface ApoliceEquipamento {
  id: string;
  equipamento_id: string;
  equipamentos: Equipamento;
}

interface Sinistro {
  id: string;
  apolice_id: string;
  equipamento_id: string;
  tipo_sinistro: string;
  franquia: number;
  data_sinistro: string;
  data_previsao_retorno: string | null;
  data_retorno: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
  apolices?: { seguradora: string };
  equipamentos?: Equipamento;
}

const TIPOS_SINISTRO = ["Colisão", "Roubo/Furto", "Incêndio", "Danos Elétricos", "Alagamento", "Vandalismo"];

const emptySinistroForm = {
  apolice_id: "",
  equipamento_id: "",
  tipo_sinistro: "",
  tipo_sinistro_custom: "",
  franquia: 0,
  data_sinistro: new Date().toISOString().slice(0, 10),
  data_previsao_retorno: "",
  data_retorno: "",
  observacoes: "",
  status: "Aberto",
};

interface Apolice {
  id: string;
  seguradora: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  valor: number;
  status: string;
  tem_adesao: boolean;
  valor_adesao: number;
  tem_parcelamento: boolean;
  numero_parcelas: number;
  renovacao_automatica: boolean;
  apolices_equipamentos: ApoliceEquipamento[];
}

const emptyForm = {
  equipamento_ids: [] as string[],
  seguradora: "",
  vigencia_inicio: "",
  vigencia_fim: "",
  valor: 0,
  tem_adesao: false,
  valor_adesao: 0,
  tem_parcelamento: false,
  numero_parcelas: 1,
  renovacao_automatica: false,
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
  const [equipSearch, setEquipSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"todos" | "Vigente" | "Vencida" | "Vence30">("todos");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sinistro state
  const [sinistros, setSinistros] = useState<Sinistro[]>([]);
  const [sinistroDialogOpen, setSinistroDialogOpen] = useState(false);
  const [editingSinistro, setEditingSinistro] = useState<Sinistro | null>(null);
  const [sinistroForm, setSinistroForm] = useState(emptySinistroForm);
  const [sinistroSearch, setSinistroSearch] = useState("");
  const [sinistroDetailItem, setSinistroDetailItem] = useState<Sinistro | null>(null);

  const fetchData = async () => {
    const [apolicesRes, equipRes] = await Promise.all([
      supabase.from("apolices").select("*, apolices_equipamentos(id, equipamento_id, equipamentos(id, tipo, modelo, tag_placa))").order("created_at", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").order("tipo"),
    ]);
    if (apolicesRes.data) setItems(apolicesRes.data as unknown as Apolice[]);
    if (equipRes.data) setEquipamentos(equipRes.data);
    setLoading(false);
  };

  const fetchSinistros = async () => {
    const { data } = await supabase
      .from("sinistros")
      .select("*, apolices(seguradora), equipamentos(id, tipo, modelo, tag_placa)")
      .order("created_at", { ascending: false });
    if (data) setSinistros(data as unknown as Sinistro[]);
  };

  useEffect(() => { fetchData(); fetchSinistros(); }, []);

  const getEquipLabelFromEquip = (eq: Equipamento | undefined) =>
    eq ? `${eq.tipo} ${eq.modelo}${eq.tag_placa ? ` (${eq.tag_placa})` : ""}` : "—";

  const equipamentosAssegurados = (apoliceId?: string) => {
    const apolice = items.find(a => a.id === apoliceId);
    if (!apolice) return [];
    return apolice.apolices_equipamentos?.map(ae => ae.equipamentos).filter(Boolean) || [];
  };

  const openNewSinistro = () => {
    setEditingSinistro(null);
    setSinistroForm(emptySinistroForm);
    setSinistroDialogOpen(true);
  };

  const openEditSinistro = (s: Sinistro) => {
    setEditingSinistro(s);
    const tipoCustom = TIPOS_SINISTRO.includes(s.tipo_sinistro) ? "" : s.tipo_sinistro;
    const tipoSelect = TIPOS_SINISTRO.includes(s.tipo_sinistro) ? s.tipo_sinistro : "Outro";
    setSinistroForm({
      apolice_id: s.apolice_id,
      equipamento_id: s.equipamento_id,
      tipo_sinistro: tipoSelect,
      tipo_sinistro_custom: tipoCustom,
      franquia: s.franquia,
      data_sinistro: s.data_sinistro,
      data_previsao_retorno: s.data_previsao_retorno || "",
      data_retorno: s.data_retorno || "",
      observacoes: s.observacoes || "",
      status: s.status,
    });
    setSinistroDialogOpen(true);
  };

  const handleSaveSinistro = async () => {
    if (!sinistroForm.apolice_id || !sinistroForm.equipamento_id) {
      toast({ title: "Erro", description: "Selecione a apólice e o equipamento", variant: "destructive" });
      return;
    }
    const tipoFinal = sinistroForm.tipo_sinistro === "Outro" ? sinistroForm.tipo_sinistro_custom : sinistroForm.tipo_sinistro;
    if (!tipoFinal) {
      toast({ title: "Erro", description: "Informe o tipo de sinistro", variant: "destructive" });
      return;
    }

    // Auto-close if return date is set
    const status = sinistroForm.data_retorno ? "Concluído" : sinistroForm.status;

    const payload = {
      apolice_id: sinistroForm.apolice_id,
      equipamento_id: sinistroForm.equipamento_id,
      tipo_sinistro: tipoFinal,
      franquia: Number(sinistroForm.franquia),
      data_sinistro: sinistroForm.data_sinistro,
      data_previsao_retorno: sinistroForm.data_previsao_retorno || null,
      data_retorno: sinistroForm.data_retorno || null,
      observacoes: sinistroForm.observacoes || "",
      status,
    };

    if (editingSinistro) {
      const { error } = await supabase.from("sinistros").update(payload).eq("id", editingSinistro.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("sinistros").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }

    setSinistroDialogOpen(false);
    fetchSinistros();
    toast({ title: "Sucesso", description: editingSinistro ? "Sinistro atualizado" : "Sinistro registrado" });
  };

  const handleDeleteSinistro = async (id: string) => {
    const { error } = await supabase.from("sinistros").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchSinistros();
  };

  const sinistrosAbertos = sinistros.filter(s => s.status === "Aberto");

  const filteredSinistros = sinistros.filter(s => {
    const q = sinistroSearch.toLowerCase();
    const eqLabel = getEquipLabelFromEquip(s.equipamentos);
    return eqLabel.toLowerCase().includes(q) || s.tipo_sinistro.toLowerCase().includes(q) || (s.apolices?.seguradora || "").toLowerCase().includes(q);
  });

  const getEquipLabel = (ae: ApoliceEquipamento) =>
    `${ae.equipamentos?.tipo} ${ae.equipamentos?.modelo}${ae.equipamentos?.tag_placa ? ` (${ae.equipamentos.tag_placa})` : ""}`;

  const getEquipLabels = (item: Apolice) =>
    item.apolices_equipamentos?.map(getEquipLabel).join(", ") || "—";

  // Summary calculations
  const hoje = new Date();
  const em30dias = new Date();
  em30dias.setDate(em30dias.getDate() + 30);

  const vigentes = items.filter(i => i.status === "Vigente");
  const vencendoEm30 = vigentes.filter(i => {
    const fim = new Date(i.vigencia_fim);
    return fim >= hoje && fim <= em30dias;
  });

  const isVence30 = (item: Apolice) => {
    if (item.status !== "Vigente") return false;
    const fim = new Date(item.vigencia_fim);
    return fim >= hoje && fim <= em30dias;
  };

  const filtered = items.filter((i) => {
    const s = search.toLowerCase();
    const matchSearch = getEquipLabels(i).toLowerCase().includes(s) || i.seguradora.toLowerCase().includes(s);
    if (statusFilter === "todos") return matchSearch;
    if (statusFilter === "Vence30") return matchSearch && isVence30(i);
    return matchSearch && i.status === statusFilter;
  });

  const totalMensal = vigentes.reduce((acc, i) => {
    if (i.tem_parcelamento && i.numero_parcelas > 0) {
      return acc + i.valor / i.numero_parcelas;
    }
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
    const headers = ["Equipamentos", "Seguradora", "Vigência", "Valor (R$)", "Adesão", "Valor Adesão", "Parcelas", "Valor Parcela", "Renovação Auto", "Status"];
    const rows = data.map(i => {
      const valorParcela = i.tem_parcelamento && i.numero_parcelas > 0 ? i.valor / i.numero_parcelas : i.valor;
      return [
        getEquipLabels(i),
        i.seguradora,
        `${new Date(i.vigencia_inicio).toLocaleDateString("pt-BR")} - ${new Date(i.vigencia_fim).toLocaleDateString("pt-BR")}`,
        Number(i.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        i.tem_adesao ? "Sim" : "Não",
        i.tem_adesao ? Number(i.valor_adesao).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—",
        i.tem_parcelamento ? `${i.numero_parcelas}x` : "À vista",
        valorParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        i.renovacao_automatica ? "Sim" : "Não",
        i.status,
      ];
    });
    return { title: "Relatório de Apólices de Seguro", headers, rows, filename: `apolices_${new Date().toISOString().slice(0, 10)}` };
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setEquipSearch(""); setDialogOpen(true); };
  const openEdit = (item: Apolice) => {
    setEditing(item);
    setForm({
      equipamento_ids: item.apolices_equipamentos?.map(ae => ae.equipamento_id) || [],
      seguradora: item.seguradora,
      vigencia_inicio: item.vigencia_inicio,
      vigencia_fim: item.vigencia_fim,
      valor: item.valor,
      tem_adesao: item.tem_adesao,
      valor_adesao: item.valor_adesao,
      tem_parcelamento: item.tem_parcelamento,
      numero_parcelas: item.numero_parcelas,
      renovacao_automatica: item.renovacao_automatica ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (form.equipamento_ids.length === 0) {
      toast({ title: "Erro", description: "Selecione ao menos um equipamento", variant: "destructive" });
      return;
    }

    const status = new Date(form.vigencia_fim) >= new Date() ? "Vigente" : "Vencida";

    if (status === "Vigente") {
      const editingId = editing?.id;
      const duplicados = form.equipamento_ids.filter(eid => {
        return items.some(a =>
          a.id !== editingId &&
          a.status === "Vigente" &&
          a.apolices_equipamentos?.some(ae => ae.equipamento_id === eid)
        );
      });
      if (duplicados.length > 0) {
        const nomes = duplicados.map(eid => {
          const eq = equipamentos.find(e => e.id === eid);
          return eq ? `${eq.tipo} ${eq.modelo}` : eid;
        }).join(", ");
        toast({ title: "Equipamento já segurado", description: `Os seguintes equipamentos já possuem apólice vigente: ${nomes}`, variant: "destructive" });
        return;
      }
    }
    const payload = {
      seguradora: form.seguradora,
      vigencia_inicio: form.vigencia_inicio,
      vigencia_fim: form.vigencia_fim,
      valor: Number(form.valor),
      status,
      tem_adesao: form.tem_adesao,
      valor_adesao: form.tem_adesao ? Number(form.valor_adesao) : 0,
      tem_parcelamento: form.tem_parcelamento,
      numero_parcelas: form.tem_parcelamento ? Number(form.numero_parcelas) : 1,
      renovacao_automatica: form.renovacao_automatica,
    };

    let apoliceId: string;

    if (editing) {
      const { error } = await supabase.from("apolices").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      apoliceId = editing.id;
      await supabase.from("apolices_equipamentos").delete().eq("apolice_id", editing.id);
    } else {
      const { data, error } = await supabase.from("apolices").insert(payload).select("id").single();
      if (error || !data) { toast({ title: "Erro", description: error?.message || "Erro ao criar", variant: "destructive" }); return; }
      apoliceId = data.id;
    }

    const links = form.equipamento_ids.map(eid => ({ apolice_id: apoliceId, equipamento_id: eid }));
    const { error: linkError } = await supabase.from("apolices_equipamentos").insert(links);
    if (linkError) { toast({ title: "Erro", description: linkError.message, variant: "destructive" }); return; }

    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("apolices").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchData();
  };

  const equipamentosComApoliceVigente = new Set(
    items
      .filter(a => a.status === "Vigente" && a.id !== editing?.id)
      .flatMap(a => a.apolices_equipamentos?.map(ae => ae.equipamento_id) || [])
  );

  const toggleEquipamento = (id: string) => {
    setForm(prev => ({
      ...prev,
      equipamento_ids: prev.equipamento_ids.includes(id)
        ? prev.equipamento_ids.filter(eid => eid !== id)
        : [...prev.equipamento_ids, id],
    }));
  };

  const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("Planilha vazia");

      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = (cell.value?.toString() || "").trim().toLowerCase();
      });

      const colMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        const n = h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (n.includes("seguradora")) colMap["seguradora"] = String(idx);
        else if (n.includes("inicio") || n.includes("vigencia") && n.includes("ini")) colMap["vigencia_inicio"] = String(idx);
        else if (n.includes("fim") || n.includes("vencimento")) colMap["vigencia_fim"] = String(idx);
        else if (n.includes("valor") && !n.includes("adesao")) colMap["valor"] = String(idx);
        else if (n.includes("equipamento") || n.includes("placa") || n.includes("tag")) colMap["equipamento"] = String(idx);
        else if (n.includes("adesao") && n.includes("valor")) colMap["valor_adesao"] = String(idx);
        else if (n.includes("parcela")) colMap["parcelas"] = String(idx);
      });

      if (!colMap["seguradora"]) throw new Error("Coluna 'Seguradora' não encontrada na planilha.");

      let importCount = 0;

      const dataRows: any[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const getCellVal = (field: string) => {
          const colIdx = colMap[field];
          if (!colIdx) return null;
          const cell = row.getCell(parseInt(colIdx));
          return cell.value?.toString()?.trim() || null;
        };

        const seguradora = getCellVal("seguradora");
        if (!seguradora) return;

        const vigenciaInicio = getCellVal("vigencia_inicio") || new Date().toISOString().slice(0, 10);
        const vigenciaFim = getCellVal("vigencia_fim") || new Date().toISOString().slice(0, 10);
        const valorStr = getCellVal("valor");
        const valor = valorStr ? parseFloat(valorStr.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 : 0;
        const valorAdesaoStr = getCellVal("valor_adesao");
        const valorAdesao = valorAdesaoStr ? parseFloat(valorAdesaoStr.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 : 0;
        const parcelasStr = getCellVal("parcelas");
        const parcelas = parcelasStr ? parseInt(parcelasStr.replace(/\D/g, "")) || 1 : 1;
        const equipRef = getCellVal("equipamento");

        const parseDate = (s: string) => {
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
            const [d, m, y] = s.split("/");
            return `${y}-${m}-${d}`;
          }
          return s;
        };

        const inicio = parseDate(vigenciaInicio);
        const fim = parseDate(vigenciaFim);
        const status = new Date(fim) >= new Date() ? "Vigente" : "Vencida";

        dataRows.push({
          seguradora,
          vigencia_inicio: inicio,
          vigencia_fim: fim,
          valor,
          status,
          tem_adesao: valorAdesao > 0,
          valor_adesao: valorAdesao,
          tem_parcelamento: parcelas > 1,
          numero_parcelas: parcelas,
          equipRef,
        });
      });

      if (dataRows.length === 0) throw new Error("Nenhum registro encontrado na planilha.");

      for (const row of dataRows) {
        const { equipRef, ...payload } = row;
        const { data: apolice, error } = await supabase.from("apolices").insert(payload).select("id").single();
        if (error || !apolice) continue;

        if (equipRef) {
          const refs = equipRef.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
          for (const ref of refs) {
            const match = equipamentos.find(eq => {
              const tag = (eq.tag_placa || "").toLowerCase();
              const label = `${eq.tipo} ${eq.modelo}`.toLowerCase();
              return tag === ref.toLowerCase() || label === ref.toLowerCase();
            });
            if (match) {
              await supabase.from("apolices_equipamentos").insert({ apolice_id: apolice.id, equipamento_id: match.id });
            }
          }
        }
        importCount++;
      }

      toast({ title: "Importação concluída", description: `${importCount} apólice(s) importada(s) com sucesso.` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message || "Erro ao processar o arquivo.", variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filterButtons: { key: typeof statusFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "Vigente", label: "Vigente" },
    { key: "Vencida", label: "Vencida" },
    { key: "Vence30", label: "Vence em 30d" },
  ];

  return (
    <Layout>
      <Tabs defaultValue="apolices" className="space-y-6">
        <TabsList>
          <TabsTrigger value="apolices" className="gap-2"><Shield className="h-4 w-4" /> Apólices</TabsTrigger>
          <TabsTrigger value="sinistro" className="gap-2"><AlertCircle className="h-4 w-4" /> Acionamento de Sinistro</TabsTrigger>
        </TabsList>
        <TabsContent value="apolices">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Apólices de Seguro</h1>
                <p className="text-sm text-muted-foreground">{items.length} apólices cadastradas{selected.size > 0 && ` · ${selected.size} selecionada(s)`}</p>
              </div>
          <div className="flex flex-wrap gap-2">
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

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar apólices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1">
            {filterButtons.map(({ key, label }) => (
              <Button
                key={key}
                variant={statusFilter === key ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(key)}
                className={statusFilter === key ? "bg-accent text-accent-foreground" : ""}
              >
                {label}
                {key === "Vence30" && vencendoEm30.length > 0 && (
                  <Badge className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0">{vencendoEm30.length}</Badge>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="h-[160px] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" /> Apólices Vigentes
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
              <p className="text-2xl font-bold text-foreground">{vigentes.length}</p>
              <p className="text-xs text-muted-foreground">de {items.length} cadastradas</p>
            </CardContent>
          </Card>
          <Card className={`h-[160px] flex flex-col ${vencendoEm30.length > 0 ? "border-destructive/50 bg-destructive/5" : ""}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${vencendoEm30.length > 0 ? "text-destructive" : ""}`} /> Vencimento / Renovação
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
              <p className={`text-2xl font-bold ${vencendoEm30.length > 0 ? "text-destructive" : "text-foreground"}`}>{vencendoEm30.length}</p>
              <p className="text-xs text-muted-foreground">vencem nos próximos 30 dias</p>
              {vencendoEm30.length > 0 && (
                <div className="mt-2 space-y-1">
                  {vencendoEm30.map(a => (
                    <div key={a.id} className="text-xs flex justify-between items-center">
                      <span className="font-medium text-foreground truncate mr-2">{getEquipLabels(a)}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {a.renovacao_automatica && <RefreshCw className="h-3 w-3 text-success" />}
                        <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">
                          {new Date(a.vigencia_fim).toLocaleDateString("pt-BR")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="h-[160px] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Custo Mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
              <p className="text-2xl font-bold text-foreground">R$ {fmt(totalMensal)}</p>
              <p className="text-xs text-muted-foreground">Estimativa mensal das vigentes</p>
            </CardContent>
          </Card>
          <Card className="h-[160px] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Total Anual
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
              <p className="text-2xl font-bold text-foreground">R$ {fmt(totalAnual)}</p>
              <p className="text-xs text-muted-foreground">Soma das apólices vigentes</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Seguradora</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Adesão</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Renov.</TableHead>
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
                      <TableCell className="font-medium text-sm max-w-[250px]">
                        <div className="flex flex-wrap gap-1">
                          {item.apolices_equipamentos?.map(ae => (
                            <Badge key={ae.id} variant="outline" className="text-xs">
                              {ae.equipamentos?.tipo} {ae.equipamentos?.modelo}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-wrap gap-1">
                          {item.apolices_equipamentos?.map(ae => (
                            <span key={ae.id} className="text-xs text-muted-foreground">
                              {ae.equipamentos?.tag_placa || "—"}
                            </span>
                          ))}
                        </div>
                      </TableCell>
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
                      <TableCell className="text-sm">
                        {item.renovacao_automatica ? (
                          <Badge className="bg-success/10 text-success border-0 text-xs"><RefreshCw className="h-3 w-3 mr-1" />Auto</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Manual</span>
                        )}
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
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma apólice encontrada</TableCell></TableRow>
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
              <Label>Equipamentos</Label>
              <p className="text-xs text-muted-foreground mb-2">Selecione um ou mais equipamentos</p>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filtrar equipamentos..."
                  value={equipSearch}
                  onChange={(e) => setEquipSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                {equipamentos
                  .filter((e) => {
                    const q = equipSearch.toLowerCase();
                    return !q || `${e.tipo} ${e.modelo} ${e.tag_placa || ""}`.toLowerCase().includes(q);
                  })
                  .map((e) => (
                  <label key={e.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50 text-sm">
                    <Checkbox
                      checked={form.equipamento_ids.includes(e.id)}
                      onCheckedChange={() => toggleEquipamento(e.id)}
                    />
                    <span>{e.tipo} {e.modelo} {e.tag_placa ? `(${e.tag_placa})` : ""}</span>
                    {equipamentosComApoliceVigente.has(e.id) && <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/30 ml-auto">Vigente</Badge>}
                  </label>
                ))}
              </div>
              {form.equipamento_ids.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{form.equipamento_ids.length} equipamento(s) selecionado(s)</p>
              )}
            </div>
            <div>
              <Label>Seguradora</Label>
              <Input value={form.seguradora} onChange={(e) => setForm({ ...form, seguradora: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Início Vigência</Label><Input type="date" value={form.vigencia_inicio} onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value })} /></div>
              <div><Label>Fim Vigência</Label><Input type="date" value={form.vigencia_fim} onChange={(e) => setForm({ ...form, vigencia_fim: e.target.value })} /></div>
            </div>
            <div><Label>Valor do Seguro (R$)</Label><Input type="number" value={form.valor || ""} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} /></div>

            {/* Renovação Automática */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm font-medium">Renovação Automática?</Label>
                <p className="text-xs text-muted-foreground">O seguro será renovado automaticamente</p>
              </div>
              <Switch checked={form.renovacao_automatica} onCheckedChange={(v) => setForm({ ...form, renovacao_automatica: v })} />
            </div>

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
                <div className="py-1.5 border-b border-border">
                  <span className="text-sm text-muted-foreground block mb-1">Equipamentos</span>
                  <div className="flex flex-wrap gap-1">
                    {detailItem.apolices_equipamentos?.map(ae => (
                      <Badge key={ae.id} variant="outline" className="text-xs">
                        {ae.equipamentos?.tipo} {ae.equipamentos?.modelo} {ae.equipamentos?.tag_placa ? `(${ae.equipamentos.tag_placa})` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Row label="Seguradora" value={detailItem.seguradora} />
                <Row label="Vigência" value={`${new Date(detailItem.vigencia_inicio).toLocaleDateString("pt-BR")} a ${new Date(detailItem.vigencia_fim).toLocaleDateString("pt-BR")}`} />
                <Row label="Valor do Seguro" value={`R$ ${fmt(detailItem.valor)}`} bold />
                <Row label="Renovação Automática" value={detailItem.renovacao_automatica ? "Sim" : "Não"} />
                <Row label="Adesão" value={detailItem.tem_adesao ? `Sim — R$ ${fmt(detailItem.valor_adesao)}` : "Não"} />
                <Row label="Parcelamento" value={detailItem.tem_parcelamento ? `${detailItem.numero_parcelas}x de R$ ${fmt(valorParcela)}` : "À vista"} />
                <Row label="Status" value={detailItem.status} badge={detailItem.status === "Vigente" ? "success" : "destructive"} />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
        </TabsContent>
        <TabsContent value="sinistro">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Acionamento de Sinistro</h1>
                <p className="text-sm text-muted-foreground">
                  {sinistros.length} sinistro(s) registrado(s) · {sinistrosAbertos.length} aberto(s)
                </p>
              </div>
              <Button onClick={openNewSinistro} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-2" /> Novo Sinistro
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Sinistros Abertos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{sinistrosAbertos.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Total Franquias (Abertos)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {sinistrosAbertos.reduce((acc, s) => acc + Number(s.franquia), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Equipamentos Indisponíveis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{sinistrosAbertos.length}</p>
                  <p className="text-xs text-muted-foreground">em sinistro ativo</p>
                </CardContent>
              </Card>
            </div>

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar sinistros..." value={sinistroSearch} onChange={(e) => setSinistroSearch(e.target.value)} className="pl-9" />
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Seguradora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data Sinistro</TableHead>
                    <TableHead>Franquia</TableHead>
                    <TableHead>Prev. Retorno</TableHead>
                    <TableHead>Retorno</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSinistros.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum sinistro registrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSinistros.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{getEquipLabelFromEquip(s.equipamentos)}</TableCell>
                        <TableCell>{s.apolices?.seguradora || "—"}</TableCell>
                        <TableCell>{s.tipo_sinistro}</TableCell>
                        <TableCell>{new Date(s.data_sinistro).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>R$ {fmt(s.franquia)}</TableCell>
                        <TableCell>{s.data_previsao_retorno ? new Date(s.data_previsao_retorno).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell>{s.data_retorno ? new Date(s.data_retorno).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell>
                          <Badge className={s.status === "Aberto" ? "bg-destructive text-destructive-foreground" : "bg-success text-success-foreground"}>
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setSinistroDetailItem(s)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEditSinistro(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteSinistro(s.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Sinistro Form Dialog */}
          <Dialog open={sinistroDialogOpen} onOpenChange={setSinistroDialogOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSinistro ? "Editar Sinistro" : "Novo Sinistro"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Apólice *</Label>
                  <Select value={sinistroForm.apolice_id} onValueChange={(v) => setSinistroForm(p => ({ ...p, apolice_id: v, equipamento_id: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione a apólice" /></SelectTrigger>
                    <SelectContent>
                      {items.filter(a => a.status === "Vigente").map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.seguradora} — {getEquipLabels(a)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Equipamento *</Label>
                  <Select value={sinistroForm.equipamento_id} onValueChange={(v) => {
                    const apolice = items.find(a => a.id === sinistroForm.apolice_id);
                    const defaultFranquia = apolice ? apolice.valor_adesao : 0;
                    setSinistroForm(p => ({ ...p, equipamento_id: v, franquia: p.franquia || defaultFranquia }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                    <SelectContent>
                      {equipamentosAssegurados(sinistroForm.apolice_id).map(eq => (
                        <SelectItem key={eq.id} value={eq.id}>{getEquipLabelFromEquip(eq)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Sinistro *</Label>
                    <Select value={sinistroForm.tipo_sinistro} onValueChange={(v) => setSinistroForm(p => ({ ...p, tipo_sinistro: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_SINISTRO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {sinistroForm.tipo_sinistro === "Outro" && (
                    <div>
                      <Label>Especifique</Label>
                      <Input value={sinistroForm.tipo_sinistro_custom} onChange={e => setSinistroForm(p => ({ ...p, tipo_sinistro_custom: e.target.value }))} />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Franquia (R$)</Label>
                    <Input type="number" step="0.01" value={sinistroForm.franquia} onChange={e => setSinistroForm(p => ({ ...p, franquia: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label>Data do Sinistro *</Label>
                    <Input type="date" value={sinistroForm.data_sinistro} onChange={e => setSinistroForm(p => ({ ...p, data_sinistro: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Previsão de Retorno</Label>
                    <Input type="date" value={sinistroForm.data_previsao_retorno} onChange={e => setSinistroForm(p => ({ ...p, data_previsao_retorno: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Data de Retorno</Label>
                    <Input type="date" value={sinistroForm.data_retorno} onChange={e => setSinistroForm(p => ({ ...p, data_retorno: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={sinistroForm.status} onValueChange={(v) => setSinistroForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aberto">Aberto</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={sinistroForm.observacoes} onChange={e => setSinistroForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSinistroDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveSinistro}>{editingSinistro ? "Salvar" : "Registrar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Sinistro Detail Dialog */}
          <Dialog open={!!sinistroDetailItem} onOpenChange={() => setSinistroDetailItem(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Detalhes do Sinistro</DialogTitle>
              </DialogHeader>
              {sinistroDetailItem && (
                <div className="space-y-1">
                  <Row label="Equipamento" value={getEquipLabelFromEquip(sinistroDetailItem.equipamentos)} />
                  <Row label="Seguradora" value={sinistroDetailItem.apolices?.seguradora || "—"} />
                  <Row label="Tipo" value={sinistroDetailItem.tipo_sinistro} />
                  <Row label="Data do Sinistro" value={new Date(sinistroDetailItem.data_sinistro).toLocaleDateString("pt-BR")} />
                  <Row label="Franquia" value={`R$ ${fmt(sinistroDetailItem.franquia)}`} bold />
                  <Row label="Prev. Retorno" value={sinistroDetailItem.data_previsao_retorno ? new Date(sinistroDetailItem.data_previsao_retorno).toLocaleDateString("pt-BR") : "—"} />
                  <Row label="Data Retorno" value={sinistroDetailItem.data_retorno ? new Date(sinistroDetailItem.data_retorno).toLocaleDateString("pt-BR") : "—"} />
                  <Row label="Status" value={sinistroDetailItem.status} badge={sinistroDetailItem.status === "Aberto" ? "destructive" : "success"} />
                  {sinistroDetailItem.observacoes && <Row label="Observações" value={sinistroDetailItem.observacoes} />}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
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
