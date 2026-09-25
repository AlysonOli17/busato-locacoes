import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import {
  AlertTriangle, TrendingUp, TrendingDown, DollarSign, Clock, CalendarClock,
  Building2, FileDown, Filter, X, ChevronRight, AlertCircle, CheckCircle2,
  XCircle, ArrowUpRight, ArrowDownRight, BarChart3, Eye, Search, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { SearchableSelect } from "@/components/SearchableSelect";

// ─── Helpers ────────────────────────────────────────────────────────────────

const parseLocalDate = (dateStr: any): Date => {
  if (!dateStr) return new Date(NaN);
  const str = String(dateStr).trim();
  if (!str || str === "null" || str === "undefined") return new Date(NaN);
  return str.includes("T") ? new Date(str) : new Date(str + "T00:00:00");
};

const fmtCurrency = (v: number) =>
  isNaN(v) ? "R$ 0,00" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const safeISO = (d: Date): string => {
  try { return isNaN(d.getTime()) ? "" : d.toISOString(); } catch { return ""; }
};

const fmtShort = (v: number) => {
  if (v >= 1_000_000) return "R$ " + (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return "R$ " + (v / 1_000).toFixed(1) + "k";
  return "R$ " + v.toFixed(0);
};

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const date = parseLocalDate(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

const diffDays = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

const getAgingBucket = (days: number): string => {
  if (days <= 0) return "Em dia";
  if (days <= 15) return "1-15 dias";
  if (days <= 30) return "16-30 dias";
  if (days <= 60) return "31-60 dias";
  if (days <= 90) return "61-90 dias";
  return "90+ dias";
};

const getAgingColor = (bucket: string): string => {
  switch (bucket) {
    case "Em dia": return "#10b981";
    case "1-15 dias": return "#f59e0b";
    case "16-30 dias": return "#f97316";
    case "31-60 dias": return "#ef4444";
    case "61-90 dias": return "#dc2626";
    case "90+ dias": return "#991b1b";
    default: return "#6b7280";
  }
};

const getUrgencyStyle = (days: number) => {
  if (days <= 0) return { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-500", badge: "bg-emerald-100 text-emerald-800" };
  if (days <= 15) return { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-500", badge: "bg-amber-100 text-amber-800" };
  if (days <= 30) return { bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-500", badge: "bg-orange-100 text-orange-800" };
  if (days <= 60) return { bg: "bg-red-500/10 border-red-500/30", text: "text-red-500", badge: "bg-red-100 text-red-800" };
  return { bg: "bg-red-700/10 border-red-700/30", text: "text-red-700", badge: "bg-red-200 text-red-900" };
};

// ─── KPI Card ───────────────────────────────────────────────────────────────

const KpiCard = ({
  icon: Icon, label, value, sub, gradient, iconBg, trend, trendLabel, onClick
}: {
  icon: any; label: string; value: string; sub?: string;
  gradient: string; iconBg: string; trend?: "up" | "down" | "neutral";
  trendLabel?: string; onClick?: () => void;
}) => (
  <Card
    className={`relative overflow-hidden border-0 shadow-lg cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${gradient}`}
    onClick={onClick}
  >
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-xs font-medium text-white/70 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-black text-white tracking-tight leading-none">{value}</p>
          {sub && <p className="text-xs text-white/60 mt-1 truncate">{sub}</p>}
          {trend && trendLabel && (
            <div className="flex items-center gap-1 mt-1.5">
              {trend === "up" ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-red-300" />
              ) : trend === "down" ? (
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-300" />
              ) : null}
              <span className={`text-[11px] font-medium ${trend === "up" ? "text-red-300" : trend === "down" ? "text-emerald-300" : "text-white/50"}`}>
                {trendLabel}
              </span>
            </div>
          )}
        </div>
        <div className={`${iconBg} p-2.5 rounded-xl shadow-inner`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ─── Mini Stat Bar ──────────────────────────────────────────────────────────

const MiniStatBar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="font-bold" style={{ color }}>{fmtCurrency(value)}</span>
    </div>
    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

interface FaturaInadimplente {
  id: string;
  contrato_id: string;
  emissao: string;
  periodo: string;
  status: string;
  valor_total: number;
  numero_nota: string | null;
  periodo_medicao_fim: string | null;
  prazo_faturamento: number;
  empresa_nome: string;
  empresa_id: string;
  equipamento_label: string;
  data_vencimento: Date;
  dias_atraso: number;
  aging_bucket: string;
}

export const InadimplenciaTab = () => {
  const [faturas, setFaturas] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("__all__");
  const [filtroStatus, setFiltroStatus] = useState<string>("__all__");
  const [filtroBucket, setFiltroBucket] = useState<string>("__all__");
  const [filtroSearch, setFiltroSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Detail dialog
  const [selectedFatura, setSelectedFatura] = useState<FaturaInadimplente | null>(null);

  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [fatRes, ctRes, empRes, eqRes, ceRes] = await Promise.all([
      supabase.from("faturamento").select("*").order("emissao", { ascending: false }),
      supabase.from("contratos").select("*"),
      supabase.from("empresas").select("*").order("nome"),
      supabase.from("equipamentos").select("*"),
      supabase.from("contratos_equipamentos").select("*"),
    ]);

    if (fatRes.data) setFaturas(fatRes.data);
    if (ctRes.data) setContratos(ctRes.data);
    if (empRes.data) setEmpresas(empRes.data);
    if (eqRes.data) setEquipamentos(eqRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Process Data ───────────────────────────────────────────────────────

  const processedFaturas = useMemo<FaturaInadimplente[]>(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const empMap = new Map(empresas.map(e => [e.id, e]));
    const eqMap = new Map(equipamentos.map(e => [e.id, e]));
    const ctMap = new Map(contratos.map(c => [c.id, c]));

    return faturas
      .filter(f => f.contrato_id) // apenas faturas com contrato
      .map(f => {
        const ct = ctMap.get(f.contrato_id);
        if (!ct) return null;

        const emp = empMap.get(ct.empresa_id);
        const eq = eqMap.get(ct.equipamento_id);
        const prazo = ct.prazo_faturamento || 30;

        // Calcula data de vencimento: emissão + prazo de faturamento
        const dataEmissao = parseLocalDate(f.emissao);
        if (isNaN(dataEmissao.getTime())) return null;
        const dataVencimento = new Date(dataEmissao);
        dataVencimento.setDate(dataVencimento.getDate() + prazo);
        if (isNaN(dataVencimento.getTime())) return null;

        const diasAtraso = diffDays(dataVencimento, hoje);

        return {
          id: f.id,
          contrato_id: f.contrato_id,
          emissao: f.emissao,
          periodo: f.periodo,
          status: f.status,
          valor_total: Number(f.valor_total) || 0,
          numero_nota: f.numero_nota,
          periodo_medicao_fim: f.periodo_medicao_fim,
          prazo_faturamento: prazo,
          empresa_nome: emp?.nome || "Sem empresa",
          empresa_id: ct.empresa_id,
          equipamento_label: eq ? `${eq.tipo} ${eq.modelo} ${eq.tag_placa || ""}`.trim() : "—",
          data_vencimento: dataVencimento,
          dias_atraso: diasAtraso,
          aging_bucket: getAgingBucket(diasAtraso),
        } as FaturaInadimplente;
      })
      .filter((f): f is FaturaInadimplente => f !== null);
  }, [faturas, contratos, empresas, equipamentos]);

  // Faturas inadimplentes (vencidas e não pagas)
  const faturasInadimplentes = useMemo(() =>
    processedFaturas.filter(f =>
      f.dias_atraso > 0 &&
      !["Pago", "Cancelado", "Cancelada"].includes(f.status)
    ),
    [processedFaturas]
  );

  // All faturas for display (not paid/cancelled)
  const faturasAtivas = useMemo(() =>
    processedFaturas.filter(f =>
      !["Pago", "Cancelado", "Cancelada"].includes(f.status)
    ),
    [processedFaturas]
  );

  // Filtered list
  const faturasFiltered = useMemo(() => {
    let list = [...faturasAtivas];
    if (filtroEmpresa !== "__all__") list = list.filter(f => f.empresa_id === filtroEmpresa);
    if (filtroStatus !== "__all__") {
      if (filtroStatus === "vencido") list = list.filter(f => f.dias_atraso > 0);
      else if (filtroStatus === "a_vencer") list = list.filter(f => f.dias_atraso <= 0);
    }
    if (filtroBucket !== "__all__") list = list.filter(f => f.aging_bucket === filtroBucket);
    if (filtroSearch.trim()) {
      const s = filtroSearch.toLowerCase();
      list = list.filter(f =>
        f.empresa_nome.toLowerCase().includes(s) ||
        f.equipamento_label.toLowerCase().includes(s) ||
        (f.numero_nota && f.numero_nota.toLowerCase().includes(s))
      );
    }
    return list.sort((a, b) => b.dias_atraso - a.dias_atraso);
  }, [faturasAtivas, filtroEmpresa, filtroStatus, filtroBucket, filtroSearch]);

  // ─── KPI Calculations ──────────────────────────────────────────────────

  const totalInadimplente = faturasInadimplentes.reduce((acc, f) => acc + f.valor_total, 0);
  const totalFaturado = faturasAtivas.reduce((acc, f) => acc + f.valor_total, 0);
  const taxaInadimplencia = totalFaturado > 0 ? (totalInadimplente / totalFaturado) * 100 : 0;
  const qtdInadimplentes = faturasInadimplentes.length;
  const pmrDias = faturasInadimplentes.length > 0
    ? Math.round(faturasInadimplentes.reduce((acc, f) => acc + f.dias_atraso, 0) / faturasInadimplentes.length)
    : 0;

  // Aging analysis
  const agingData = useMemo(() => {
    const buckets = ["1-15 dias", "16-30 dias", "31-60 dias", "61-90 dias", "90+ dias"];
    return buckets.map(bucket => {
      const items = faturasInadimplentes.filter(f => f.aging_bucket === bucket);
      return {
        bucket,
        valor: items.reduce((acc, f) => acc + f.valor_total, 0),
        quantidade: items.length,
        color: getAgingColor(bucket),
      };
    }).filter(b => b.valor > 0 || b.quantidade > 0);
  }, [faturasInadimplentes]);

  // Top clients by inadimplencia
  const topClientes = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number; qtd: number; maiorAtraso: number }>();
    faturasInadimplentes.forEach(f => {
      const existing = map.get(f.empresa_id) || { nome: f.empresa_nome, valor: 0, qtd: 0, maiorAtraso: 0 };
      existing.valor += f.valor_total;
      existing.qtd += 1;
      existing.maiorAtraso = Math.max(existing.maiorAtraso, f.dias_atraso);
      map.set(f.empresa_id, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [faturasInadimplentes]);

  // Pie chart for distribution
  const pieData = useMemo(() => {
    if (topClientes.length === 0) return [];
    const top5 = topClientes.slice(0, 5);
    const remaining = topClientes.slice(5).reduce((acc, c) => acc + c.valor, 0);
    const result = top5.map(c => ({ name: c.nome.length > 18 ? c.nome.substring(0, 18) + "…" : c.nome, value: c.valor }));
    if (remaining > 0) result.push({ name: "Outros", value: remaining });
    return result;
  }, [topClientes]);

  const PIE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#8b5cf6", "#06b6d4", "#6b7280"];

  // Monthly evolution (last 6 months)
  const evolutionData = useMemo(() => {
    const hoje = new Date();
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      months.push({
        label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        start: d,
        end,
      });
    }

    return months.map(m => {
      // Faturas que estavam vencidas naquele mês
      const vencidas = processedFaturas.filter(f => {
        if (["Pago", "Cancelado", "Cancelada"].includes(f.status)) return false;
        return f.data_vencimento <= m.end && f.data_vencimento >= new Date(m.start.getFullYear() - 1, 0, 1);
      });
      const valor = vencidas
        .filter(f => f.data_vencimento <= m.end && diffDays(f.data_vencimento, m.end) > 0)
        .reduce((acc, f) => acc + f.valor_total, 0);
      const qtd = vencidas.filter(f => f.data_vencimento <= m.end && diffDays(f.data_vencimento, m.end) > 0).length;
      return {
        mes: m.label,
        valor,
        quantidade: qtd,
      };
    });
  }, [processedFaturas]);

  // Critical items (> 60 days)
  const faturaCriticas = faturasInadimplentes.filter(f => f.dias_atraso > 60);
  const valorCritico = faturaCriticas.reduce((acc, f) => acc + f.valor_total, 0);

  // ─── Export ─────────────────────────────────────────────────────────────

  const handleExportPDF = () => {
    const rows = faturasFiltered.map(f => [
      f.empresa_nome,
      f.equipamento_label,
      fmtDate(f.emissao),
      fmtDate(safeISO(f.data_vencimento)),
      `${f.dias_atraso} dias`,
      f.aging_bucket,
      fmtCurrency(f.valor_total),
      f.status,
    ]);
    exportToPDF({
      title: "Painel de Inadimplência - Relatório Gerencial",
      headers: ["Cliente", "Equipamento", "Emissão", "Vencimento", "Atraso", "Faixa", "Valor", "Status"],
      rows,
      filename: `inadimplencia_${new Date().toISOString().slice(0, 10)}`,
    });
  };

  const handleExportExcel = () => {
    const rows = faturasFiltered.map(f => [
      f.empresa_nome,
      f.equipamento_label,
      fmtDate(f.emissao),
      fmtDate(safeISO(f.data_vencimento)),
      `${f.dias_atraso} dias`,
      f.aging_bucket,
      fmtCurrency(f.valor_total),
      f.status,
    ]);
    exportToExcel({
      title: "Inadimplência",
      headers: ["Cliente", "Equipamento", "Emissão", "Vencimento", "Atraso", "Faixa", "Valor", "Status"],
      rows,
      filename: `inadimplencia_${new Date().toISOString().slice(0, 10)}`,
    });
  };

  const clearFilters = () => {
    setFiltroEmpresa("__all__");
    setFiltroStatus("__all__");
    setFiltroBucket("__all__");
    setFiltroSearch("");
  };

  const hasActiveFilters = filtroEmpresa !== "__all__" || filtroStatus !== "__all__" || filtroBucket !== "__all__" || filtroSearch.trim() !== "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando painel de inadimplência...</p>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Painel de Inadimplência
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestão gerencial de títulos vencidos e análise de aging
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-1.5" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">!</Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileDown className="w-4 h-4 mr-1.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileDown className="w-4 h-4 mr-1.5" /> Excel
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchData} className="h-8 w-8">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Filters Panel ──────────────────────────────────────────────── */}
      {showFilters && (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="h-8 text-sm pl-8"
                    placeholder="Cliente, equipamento, NF..."
                    value={filtroSearch}
                    onChange={e => setFiltroSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Cliente</Label>
                <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os clientes</SelectItem>
                    {empresas.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Situação</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    <SelectItem value="vencido">Vencidas</SelectItem>
                    <SelectItem value="a_vencer">A vencer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Faixa de Atraso</Label>
                <Select value={filtroBucket} onValueChange={setFiltroBucket}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    <SelectItem value="1-15 dias">1-15 dias</SelectItem>
                    <SelectItem value="16-30 dias">16-30 dias</SelectItem>
                    <SelectItem value="31-60 dias">31-60 dias</SelectItem>
                    <SelectItem value="61-90 dias">61-90 dias</SelectItem>
                    <SelectItem value="90+ dias">90+ dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                    <X className="w-3.5 h-3.5 mr-1" /> Limpar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={DollarSign}
          label="Total Inadimplente"
          value={fmtShort(totalInadimplente)}
          sub={`${qtdInadimplentes} fatura${qtdInadimplentes !== 1 ? "s" : ""} vencida${qtdInadimplentes !== 1 ? "s" : ""}`}
          gradient="bg-gradient-to-br from-red-600 to-red-800"
          iconBg="bg-red-500/30"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Taxa de Inadimplência"
          value={`${taxaInadimplencia.toFixed(1)}%`}
          sub={`sobre ${fmtShort(totalFaturado)} faturado`}
          gradient="bg-gradient-to-br from-orange-600 to-orange-800"
          iconBg="bg-orange-500/30"
          trend={taxaInadimplencia > 10 ? "up" : taxaInadimplencia > 0 ? "neutral" : "down"}
          trendLabel={taxaInadimplencia > 10 ? "Acima da meta" : taxaInadimplencia > 5 ? "Atenção" : "Saudável"}
        />
        <KpiCard
          icon={Clock}
          label="PMR (Prazo Médio)"
          value={`${pmrDias} dias`}
          sub="Prazo médio de recebimento em atraso"
          gradient="bg-gradient-to-br from-amber-600 to-amber-800"
          iconBg="bg-amber-500/30"
        />
        <KpiCard
          icon={AlertCircle}
          label="Críticos (60+ dias)"
          value={fmtShort(valorCritico)}
          sub={`${faturaCriticas.length} fatura${faturaCriticas.length !== 1 ? "s" : ""} crítica${faturaCriticas.length !== 1 ? "s" : ""}`}
          gradient="bg-gradient-to-br from-rose-700 to-rose-900"
          iconBg="bg-rose-500/30"
        />
        <KpiCard
          icon={Building2}
          label="Clientes Inadimplentes"
          value={`${topClientes.length}`}
          sub={topClientes.length > 0 ? `Maior: ${topClientes[0]?.nome?.substring(0, 20) || "—"}` : "Nenhum inadimplente"}
          gradient="bg-gradient-to-br from-violet-600 to-violet-800"
          iconBg="bg-violet-500/30"
        />
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Aging Analysis */}
        <Card className="lg:col-span-1 border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              Aging de Inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {agingData.length > 0 ? (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtShort(v)} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                        formatter={(value: number) => [fmtCurrency(value), "Valor"]}
                      />
                      <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                        {agingData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-3 border-t pt-3">
                  {agingData.map((a, i) => (
                    <MiniStatBar key={i} label={`${a.bucket} (${a.quantidade})`} value={a.valor} max={Math.max(...agingData.map(d => d.valor))} color={a.color} />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-52 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                <p className="text-sm font-medium">Nenhuma inadimplência</p>
                <p className="text-xs">Todas as faturas estão em dia!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Distribution */}
        <Card className="lg:col-span-1 border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-500" />
              Distribuição por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {pieData.length > 0 ? (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                        formatter={(value: number) => [fmtCurrency(value), "Valor"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground truncate max-w-[140px]">{item.name}</span>
                      </div>
                      <span className="font-semibold">{fmtCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-52 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                <p className="text-sm font-medium">Sem inadimplentes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evolution */}
        <Card className="lg:col-span-1 border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionData}>
                  <defs>
                    <linearGradient id="gradientInad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtShort(v)} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                    formatter={(value: number, name: string) => [
                      name === "valor" ? fmtCurrency(value) : value,
                      name === "valor" ? "Valor Inadimplente" : "Qtd. Faturas"
                    ]}
                  />
                  <Area type="monotone" dataKey="valor" stroke="#ef4444" strokeWidth={2.5} fill="url(#gradientInad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 border-t pt-3">
              {evolutionData.slice(-3).map((m, i) => (
                <div key={i} className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">{m.mes}</p>
                  <p className="text-sm font-bold mt-0.5">{fmtShort(m.valor)}</p>
                  <p className="text-[10px] text-muted-foreground">{m.quantidade} faturas</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Top Clientes Ranking ───────────────────────────────────────── */}
      {topClientes.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-red-500" />
              Ranking de Inadimplência por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {topClientes.map((c, i) => {
                const style = getUrgencyStyle(c.maiorAtraso);
                const pct = totalInadimplente > 0 ? (c.valor / totalInadimplente) * 100 : 0;
                return (
                  <div key={i} className={`rounded-xl border p-3.5 ${style.bg} transition-all hover:scale-[1.01]`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          i === 0 ? "bg-red-500 text-white" : i === 1 ? "bg-orange-500 text-white" : i === 2 ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                        }`}>
                          {i + 1}
                        </div>
                        <span className="text-sm font-semibold truncate">{c.nome}</span>
                      </div>
                      <Badge className={`${style.badge} text-[10px] px-1.5 shrink-0`}>
                        {c.maiorAtraso}d
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{c.qtd} fatura{c.qtd > 1 ? "s" : ""}</span>
                        <span className={`font-bold ${style.text}`}>{fmtCurrency(c.valor)}</span>
                      </div>
                      <div className="h-1.5 bg-background/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: getAgingColor(getAgingBucket(c.maiorAtraso)) }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-right">{pct.toFixed(1)}% do total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-blue-500" />
              Detalhamento de Faturas
              <Badge variant="outline" className="ml-2 text-xs">{faturasFiltered.length} registros</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-semibold">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold">Equipamento</TableHead>
                  <TableHead className="text-xs font-semibold">Emissão</TableHead>
                  <TableHead className="text-xs font-semibold">Vencimento</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Atraso</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Faixa</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Valor</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                  <TableHead className="text-xs font-semibold w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturasFiltered.slice(0, 50).map((f) => {
                  const style = getUrgencyStyle(f.dias_atraso);
                  return (
                    <TableRow key={f.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="text-xs font-medium max-w-[160px] truncate">{f.empresa_nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{f.equipamento_label}</TableCell>
                      <TableCell className="text-xs">{fmtDate(f.emissao)}</TableCell>
                      <TableCell className="text-xs">{fmtDate(safeISO(f.data_vencimento))}</TableCell>
                      <TableCell className="text-center">
                        {f.dias_atraso > 0 ? (
                          <span className={`text-xs font-bold ${style.text}`}>{f.dias_atraso}d</span>
                        ) : (
                          <span className="text-xs text-emerald-500 font-medium">Em dia</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className="text-[10px] px-1.5 font-medium border-0"
                          style={{ backgroundColor: getAgingColor(f.aging_bucket) + "20", color: getAgingColor(f.aging_bucket) }}
                        >
                          {f.aging_bucket}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right text-xs font-mono font-bold ${f.dias_atraso > 0 ? "text-red-600" : ""}`}>
                        {fmtCurrency(f.valor_total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] ${
                          f.status === "Emitida" ? "border-blue-300 text-blue-600" :
                          f.status === "Aprovado" ? "border-emerald-300 text-emerald-600" :
                          f.status === "Pendente" ? "border-amber-300 text-amber-600" :
                          "border-muted text-muted-foreground"
                        }`}>
                          {f.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => setSelectedFatura(f)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {faturasFiltered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        <p className="text-sm font-medium">Nenhuma fatura encontrada</p>
                        <p className="text-xs">Ajuste os filtros ou verifique os dados.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {faturasFiltered.length > 50 && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Exibindo 50 de {faturasFiltered.length} registros. Exporte para ver todos.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Summary Footer ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-red-600/80 font-medium">Total Vencido</p>
                <p className="text-lg font-black text-red-700">{fmtCurrency(totalInadimplente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600/80 font-medium">A Vencer (em dia)</p>
                <p className="text-lg font-black text-amber-700">
                  {fmtCurrency(faturasAtivas.filter(f => f.dias_atraso <= 0).reduce((acc, f) => acc + f.valor_total, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-emerald-600/80 font-medium">Total Faturado Ativo</p>
                <p className="text-lg font-black text-emerald-700">{fmtCurrency(totalFaturado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Detail Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!selectedFatura} onOpenChange={(open) => !open && setSelectedFatura(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-500" />
              Detalhe da Fatura
            </DialogTitle>
          </DialogHeader>
          {selectedFatura && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Cliente</p>
                  <p className="text-sm font-semibold">{selectedFatura.empresa_nome}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Equipamento</p>
                  <p className="text-sm font-semibold">{selectedFatura.equipamento_label}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Data de Emissão</p>
                  <p className="text-sm">{fmtDate(selectedFatura.emissao)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Data de Vencimento</p>
                  <p className="text-sm">{fmtDate(safeISO(selectedFatura.data_vencimento))}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Prazo de Faturamento</p>
                  <p className="text-sm">{selectedFatura.prazo_faturamento} dias</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">NF</p>
                  <p className="text-sm">{selectedFatura.numero_nota || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Período</p>
                  <p className="text-sm">{selectedFatura.periodo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Status</p>
                  <Badge variant="outline">{selectedFatura.status}</Badge>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Valor da Fatura</p>
                    <p className="text-xl font-black">{fmtCurrency(selectedFatura.valor_total)}</p>
                  </div>
                  <div className="text-right">
                    {selectedFatura.dias_atraso > 0 ? (
                      <>
                        <p className="text-xs text-red-500 font-medium">Dias em atraso</p>
                        <p className="text-2xl font-black text-red-600">{selectedFatura.dias_atraso}d</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-emerald-500 font-medium">Dias até vencimento</p>
                        <p className="text-2xl font-black text-emerald-600">{Math.abs(selectedFatura.dias_atraso)}d</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <Badge
                    className="text-xs border-0"
                    style={{ backgroundColor: getAgingColor(selectedFatura.aging_bucket) + "20", color: getAgingColor(selectedFatura.aging_bucket) }}
                  >
                    {selectedFatura.aging_bucket}
                  </Badge>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedFatura(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
