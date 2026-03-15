import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, Building2,
  Wrench, FileText, Activity, BarChart3, PieChart, CalendarClock, Shield, Truck
} from "lucide-react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from "recharts";

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface VisaoGeralTabProps {
  empresas: Array<{ id: string; nome: string; cnpj: string }>;
  contratos: Array<any>;
  faturas: Array<any>;
  equipamentos: Array<any>;
  gastos: Array<any>;
  medicoes: Array<any>;
}

export const VisaoGeralTab = ({ empresas, contratos, faturas, equipamentos, gastos, medicoes }: VisaoGeralTabProps) => {
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [filtroEquipamento, setFiltroEquipamento] = useState("all");

  // Filtered data by date range
  const faturasFiltered = useMemo(() => {
    return faturas.filter(f => {
      const emissao = f.emissao;
      if (dataInicio && emissao < dataInicio) return false;
      if (dataFim && emissao > dataFim) return false;
      return true;
    });
  }, [faturas, dataInicio, dataFim]);

  const gastosFiltered = useMemo(() => {
    return gastos.filter(g => {
      if (dataInicio && g.data < dataInicio) return false;
      if (dataFim && g.data > dataFim) return false;
      if (filtroEquipamento !== "all" && g.equipamento_id !== filtroEquipamento) return false;
      return true;
    });
  }, [gastos, dataInicio, dataFim, filtroEquipamento]);

  const medicoesFiltered = useMemo(() => {
    return medicoes.filter(m => {
      if (dataInicio && m.data < dataInicio) return false;
      if (dataFim && m.data > dataFim) return false;
      if (filtroEquipamento !== "all" && m.equipamento_id !== filtroEquipamento) return false;
      return true;
    });
  }, [medicoes, dataInicio, dataFim, filtroEquipamento]);

  // ============ SETOR FINANCEIRO ============
  const totalFaturado = faturasFiltered.filter(f => f.status === "Pago").reduce((s: number, f: any) => s + Number(f.valor_total), 0);
  const totalPendente = faturasFiltered.filter(f => f.status === "Pendente" || f.status === "Aprovado").reduce((s: number, f: any) => s + Number(f.valor_total), 0);
  const totalAtraso = faturasFiltered.filter(f => {
    if (f.status === "Pago" || f.status === "Cancelado") return false;
    const prazo = f.contratos?.prazo_faturamento || 30;
    const venc = new Date(f.emissao);
    venc.setDate(venc.getDate() + prazo);
    return new Date() > venc;
  }).reduce((s: number, f: any) => s + Number(f.valor_total), 0);
  const totalGastos = gastosFiltered.reduce((s: number, g: any) => s + Number(g.valor), 0);
  const receitaLiquida = totalFaturado - totalGastos;

  // Faturamento por mês (chart)
  const faturamentoPorMes = useMemo(() => {
    const map: Record<string, { mes: string; faturado: number; gastos: number }> = {};
    faturasFiltered.forEach(f => {
      const mes = f.emissao.slice(0, 7);
      if (!map[mes]) map[mes] = { mes, faturado: 0, gastos: 0 };
      if (f.status === "Pago") map[mes].faturado += Number(f.valor_total);
    });
    gastosFiltered.forEach(g => {
      const mes = g.data.slice(0, 7);
      if (!map[mes]) map[mes] = { mes, faturado: 0, gastos: 0 };
      map[mes].gastos += Number(g.valor);
    });
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).map(item => ({
      ...item,
      mesLabel: parseLocalDate(item.mes + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    }));
  }, [faturasFiltered, gastosFiltered]);

  // ============ SETOR CONTRATOS ============
  const contratosAtivos = contratos.filter(c => c.status === "Ativo").length;
  const contratosVencendo = contratos.filter(c => {
    if (c.status !== "Ativo") return false;
    const fim = parseLocalDate(c.data_fim);
    const diff = (fim.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;
  const contratosVencidos = contratos.filter(c => {
    if (c.status !== "Ativo") return false;
    return parseLocalDate(c.data_fim) < new Date();
  }).length;

  // Faturas por status (pie chart)
  const faturasPorStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    faturasFiltered.forEach(f => {
      const status = f.status === "Pago" ? "Pago" :
        f.status === "Cancelado" ? "Cancelado" :
        (() => {
          const prazo = f.contratos?.prazo_faturamento || 30;
          const venc = new Date(f.emissao);
          venc.setDate(venc.getDate() + prazo);
          return new Date() > venc ? "Em Atraso" : f.status;
        })();
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [faturasFiltered]);

  const PIE_COLORS: Record<string, string> = {
    "Pago": "hsl(var(--success))",
    "Pendente": "hsl(var(--warning))",
    "Aprovado": "hsl(var(--accent))",
    "Em Atraso": "hsl(var(--destructive))",
    "Cancelado": "hsl(var(--muted-foreground))",
  };

  // ============ SETOR EQUIPAMENTOS ============
  const totalEquipamentos = equipamentos.length;
  const equipAtivos = equipamentos.filter(e => e.status === "Ativo").length;
  const equipManutencao = equipamentos.filter(e => e.status === "Manutenção").length;
  const equipIndisponiveis = equipamentos.filter(e => e.status === "Indisponível").length;
  const taxaUtilizacao = totalEquipamentos > 0 ? Math.round((equipAtivos / totalEquipamentos) * 100) : 0;

  // Gastos por tipo (chart)
  const gastosPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    gastosFiltered.forEach(g => {
      map[g.tipo] = (map[g.tipo] || 0) + Number(g.valor);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [gastosFiltered]);

  // ============ SETOR OPERACIONAL ============
  const totalHorasMedidas = medicoesFiltered.reduce((s: number, m: any) => s + Number(m.horas_trabalhadas || 0), 0);
  const mediaDiariaHoras = medicoesFiltered.length > 0 ? totalHorasMedidas / medicoesFiltered.length : 0;

  // Top 5 equipamentos por horas
  const topEquipHoras = useMemo(() => {
    const map: Record<string, number> = {};
    medicoesFiltered.forEach(m => {
      map[m.equipamento_id] = (map[m.equipamento_id] || 0) + Number(m.horas_trabalhadas || 0);
    });
    return Object.entries(map)
      .map(([id, horas]) => {
        const eq = equipamentos.find((e: any) => e.id === id);
        return { nome: eq ? `${eq.tipo} ${eq.modelo}` : id.slice(0, 8), horas };
      })
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 5);
  }, [medicoesFiltered, equipamentos]);

  // Top 5 equipamentos por gastos
  const topEquipGastos = useMemo(() => {
    const map: Record<string, number> = {};
    gastosFiltered.forEach(g => {
      map[g.equipamento_id] = (map[g.equipamento_id] || 0) + Number(g.valor);
    });
    return Object.entries(map)
      .map(([id, valor]) => {
        const eq = equipamentos.find((e: any) => e.id === id);
        return { nome: eq ? `${eq.tipo} ${eq.modelo}` : id.slice(0, 8), valor };
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [gastosFiltered, equipamentos]);

  // Faturamento por empresa
  const faturamentoPorEmpresa = useMemo(() => {
    const map: Record<string, number> = {};
    faturasFiltered.forEach(f => {
      const nome = f.contratos?.empresas?.nome || "Sem empresa";
      map[nome] = (map[nome] || 0) + Number(f.valor_total);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [faturasFiltered]);

  const chartConfig = {
    faturado: { label: "Faturado", color: "hsl(var(--success))" },
    gastos: { label: "Gastos", color: "hsl(var(--destructive))" },
  };

  const barConfig = {
    horas: { label: "Horas", color: "hsl(var(--primary))" },
  };

  const gastoConfig = {
    valor: { label: "Valor (R$)", color: "hsl(var(--warning))" },
  };

  const empresaConfig = {
    value: { label: "Valor (R$)", color: "hsl(var(--primary))" },
  };

  return (
    <div className="space-y-8">
      {/* ===== FILTROS ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Data Início</label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Data Fim</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Equipamento</label>
              <Select value={filtroEquipamento} onValueChange={setFiltroEquipamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Equipamentos</SelectItem>
                  {equipamentos.map((eq: any) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.tipo} {eq.modelo} {eq.tag_placa ? `(${eq.tag_placa})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== SETOR 1: FINANCEIRO ===== */}
      <section>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-success" />
          Financeiro
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Receita Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-success">R$ {fmt(totalFaturado)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pendente</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-warning">R$ {fmt(totalPendente)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Em Atraso</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-destructive">R$ {fmt(totalAtraso)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Gastos</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-destructive">R$ {fmt(totalGastos)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Receita Líquida</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className={`text-xl font-bold ${receitaLiquida >= 0 ? "text-success" : "text-destructive"}`}>
                R$ {fmt(receitaLiquida)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart: Faturamento vs Gastos por mês */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Faturamento vs Gastos (Mensal)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {faturamentoPorMes.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <BarChart data={faturamentoPorMes}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mesLabel" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="faturado" fill="var(--color-faturado)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados no período</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Faturamento por Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {faturamentoPorEmpresa.length > 0 ? (
                <ChartContainer config={empresaConfig} className="h-[280px] w-full">
                  <BarChart data={faturamentoPorEmpresa.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" className="text-xs" width={120} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados no período</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===== SETOR 2: CONTRATOS ===== */}
      <section>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-primary" />
          Contratos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Ativos</CardTitle>
              <FileText className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{contratosAtivos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Vencendo em 30 dias</CardTitle>
              <CalendarClock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-warning">{contratosVencendo}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Vencidos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{contratosVencidos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Geral</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{contratos.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Pie chart: faturas por status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" /> Faturas por Status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {faturasPorStatus.length > 0 ? (
                <div className="h-[280px] w-full max-w-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={faturasPorStatus}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {faturasPorStatus.map((entry) => (
                          <Cell key={entry.name} fill={PIE_COLORS[entry.name] || "hsl(var(--muted))"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, "Qtd"]} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4 text-warning" /> Gastos por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gastosPorTipo.length > 0 ? (
                <ChartContainer config={gastoConfig} className="h-[280px] w-full">
                  <BarChart data={gastosPorTipo}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="valor" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados no período</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===== SETOR 3: EQUIPAMENTOS & FROTA ===== */}
      <section>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <Truck className="h-5 w-5 text-accent" />
          Frota & Equipamentos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Equipamentos</CardTitle>
              <Truck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{totalEquipamentos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Ativos</CardTitle>
              <Activity className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-success">{equipAtivos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Em Manutenção</CardTitle>
              <Wrench className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-warning">{equipManutencao}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Indisponíveis</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{equipIndisponiveis}</p>
            </CardContent>
          </Card>
        </div>

        {/* Taxa de utilização */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Taxa de Utilização da Frota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={taxaUtilizacao} className="flex-1 h-3" />
              <span className="text-lg font-bold text-foreground">{taxaUtilizacao}%</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top equipamentos por gastos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" /> Top 5 Equipamentos — Gastos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topEquipGastos.length > 0 ? (
                <ChartContainer config={gastoConfig} className="h-[280px] w-full">
                  <BarChart data={topEquipGastos} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="nome" type="category" className="text-xs" width={140} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="valor" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados no período</p>
              )}
            </CardContent>
          </Card>

          {/* Top equipamentos por horas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Top 5 Equipamentos — Horas Trabalhadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topEquipHoras.length > 0 ? (
                <ChartContainer config={barConfig} className="h-[280px] w-full">
                  <BarChart data={topEquipHoras} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="nome" type="category" className="text-xs" width={140} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados no período</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===== SETOR 4: OPERACIONAL ===== */}
      <section>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          Operacional
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Horas Medidas</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{fmt(totalHorasMedidas)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Medições no Período</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{medicoesFiltered.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Média Horas/Medição</CardTitle>
              <Activity className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{fmt(mediaDiariaHoras)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Faturas</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{faturasFiltered.length}</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};
