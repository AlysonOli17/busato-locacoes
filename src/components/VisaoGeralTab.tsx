import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, Building2,
  Wrench, FileText, Activity, BarChart3, PieChart, CalendarClock, Shield, Truck,
  Target, Zap, ArrowUpRight, ArrowDownRight, Info
} from "lucide-react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area
} from "recharts";

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (v: number) => {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return (v / 1000).toFixed(1) + "k";
  return v.toFixed(0);
};

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

  // ============ MÉTRICAS EXECUTIVAS ============
  
  // 1. Previsão de Receita (Forecast)
  const forecastData = useMemo(() => {
    const today = new Date();
    const result = [];
    for (let i = 0; i < 5; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthLabel = targetDate.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const monthKey = targetDate.toISOString().slice(0, 7);
      
      let projectedRevenue = 0;
      contratos.filter(c => c.status === "Ativo").forEach(c => {
        const cInicio = c.data_inicio.slice(0, 7);
        const cFim = c.data_fim.slice(0, 7);
        if (monthKey >= cInicio && monthKey <= cFim) {
          projectedRevenue += Number(c.valor_hour || c.valor_hora || 0) * Number(c.horas_contratadas || 160);
        }
      });
      
      result.push({ mes: monthLabel, valor: projectedRevenue });
    }
    return result;
  }, [contratos]);

  // 2. Saúde da Frota (Profitability per Machine)
  const equipmentHealth = useMemo(() => {
    return equipamentos.map(eq => {
      const eqFaturas = faturas.filter(f => f.contrato_id && contratos.find(c => c.id === f.contrato_id && c.equipamento_id === eq.id));
      const eqGastos = gastos.filter(g => g.equipamento_id === eq.id);
      
      const receita = eqFaturas.filter(f => f.status === "Pago").reduce((s, f) => s + Number(f.valor_total), 0);
      const despesa = eqGastos.reduce((s, g) => s + Number(g.valor), 0);
      const margem = receita - despesa;
      const percentual = receita > 0 ? (margem / receita) * 100 : 0;
      
      return {
        id: eq.id,
        nome: `${eq.tipo} ${eq.modelo}`,
        tag: eq.tag_placa,
        receita,
        despesa,
        margem,
        percentual,
        status: eq.status
      };
    }).sort((a, b) => b.margem - a.margem);
  }, [equipamentos, faturas, gastos, contratos]);

  const totalFaturado = faturasFiltered.filter(f => f.status === "Pago").reduce((s: number, f: any) => s + Number(f.valor_total), 0);
  const totalGastos = gastosFiltered.reduce((s: number, g: any) => s + Number(g.valor), 0);
  const margemGeral = totalFaturado > 0 ? ((totalFaturado - totalGastos) / totalFaturado) * 100 : 0;

  const equipAtivos = equipamentos.filter(e => e.status === "Ativo").length;
  const taxaUtilizacao = equipamentos.length > 0 ? Math.round((equipAtivos / equipamentos.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* HEADER EXECUTIVO */}
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard de Performance</h2>
          <p className="text-muted-foreground text-sm">Análise estratégica de ativos e rentabilidade da frota.</p>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg border">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Período: {new Date(dataInicio).toLocaleDateString()} - {new Date(dataFim).toLocaleDateString()}</span>
        </div>
      </div>

      {/* KPI CARDS - NÍVEL EXECUTIVO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-l-4 border-l-success">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">EBITDA Estimado</p>
                <h3 className="text-2xl font-bold mt-1">R$ {fmt(totalFaturado - totalGastos)}</h3>
              </div>
              <div className="h-12 w-12 bg-success/10 rounded-full flex items-center justify-center">
                <Target className="h-6 w-6 text-success" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-xs">
              <ArrowUpRight className="h-3 w-3 text-success mr-1" />
              <span className="text-success font-bold">{margemGeral.toFixed(1)}%</span>
              <span className="text-muted-foreground ml-1">de margem operacional</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Utilização da Frota</p>
                <h3 className="text-2xl font-bold mt-1">{taxaUtilizacao}%</h3>
              </div>
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Activity className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={taxaUtilizacao} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-2">{equipAtivos} de {equipamentos.length} máquinas operando</p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-accent">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receita Projetada</p>
                <h3 className="text-2xl font-bold mt-1">R$ {fmtShort(forecastData[1]?.valor || 0)}</h3>
              </div>
              <div className="h-12 w-12 bg-accent/10 rounded-full flex items-center justify-center">
                <Zap className="h-6 w-6 text-accent" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1" />
              <span>Expectativa para o próximo mês</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-warning">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contratos Críticos</p>
                <h3 className="text-2xl font-bold mt-1">{contratos.filter(c => c.status === "Ativo" && parseLocalDate(c.data_fim) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length}</h3>
              </div>
              <div className="h-12 w-12 bg-warning/10 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 text-warning" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-xs text-warning font-medium">
              <Clock className="h-3 w-3 mr-1" />
              <span>Vencendo nos próximos 30 dias</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO DE PREVISÃO DE RECEITA */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Previsão de Receita (Cashflow Forecast)
            </CardTitle>
            <CardDescription>Baseado em contratos ativos e recorrentes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} className="text-xs" />
                  <YAxis axisLine={false} tickLine={false} className="text-xs" tickFormatter={(v) => `R$ ${fmtShort(v)}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--background))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    formatter={(v: number) => [`R$ ${fmt(v)}`, "Projeção"]}
                  />
                  <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* RANKING DE LUCRATIVIDADE */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" /> Top Ativos (Rentabilidade)
            </CardTitle>
            <CardDescription>Máquinas com maior margem líquida</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {equipmentHealth.slice(0, 5).map((eq, idx) => (
                <div key={eq.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="space-y-1">
                    <p className="text-sm font-bold truncate max-w-[150px]">{eq.nome}</p>
                    <Badge variant="outline" className="text-[10px] py-0">{eq.tag || "Sem Tag"}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-success">+ R$ {fmtShort(eq.margem)}</p>
                    <p className="text-[10px] text-muted-foreground">{eq.percentual.toFixed(0)}% de margem</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COMPOSIÇÃO DE GASTOS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Centro de Custos Operacionais</CardTitle>
            <CardDescription>Distribuição de gastos por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={useMemo(() => {
                  const map: Record<string, number> = {};
                  gastosFiltered.forEach(g => { map[g.tipo] = (map[g.tipo] || 0) + Number(g.valor); });
                  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
                }, [gastosFiltered])}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="name" className="text-[10px]" axisLine={false} tickLine={false} />
                  <YAxis className="text-[10px]" axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${fmtShort(v)}`} />
                  <Tooltip formatter={(v: number) => [`R$ ${fmt(v)}`, "Gasto"]} />
                  <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ALERTA DE OCIOSIDADE */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" /> Alerta de Ociosidade
              </CardTitle>
              <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Atenção</Badge>
            </div>
            <CardDescription>Equipamentos parados ou em manutenção</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {equipamentos.filter(e => e.status !== "Ativo").slice(0, 4).map((eq) => (
                <div key={eq.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${eq.status === 'Manutenção' ? 'bg-warning/20' : 'bg-destructive/20'}`}>
                    {eq.status === 'Manutenção' ? <Wrench className="h-5 w-5 text-warning" /> : <Clock className="h-5 w-5 text-destructive" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{eq.tipo} {eq.modelo}</p>
                    <p className="text-xs text-muted-foreground">Status: {eq.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-destructive">Gerando Custo Fixo</p>
                  </div>
                </div>
              ))}
              {equipamentos.filter(e => e.status !== "Ativo").length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Shield className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm italic">Toda a frota está ativa e produzindo!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FOOTER INFO */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-primary mt-0.5" />
        <div className="text-sm text-primary-foreground/80">
          <p className="font-bold text-primary">Insight do Sistema:</p>
          <p>Sua frota está com <strong>{taxaUtilizacao}%</strong> de utilização. Equipamentos em manutenção estão impactando a margem operacional em aproximadamente <strong>R$ {fmt(gastosFiltered.filter(g => g.tipo === 'Manutenção').reduce((s, g) => s + Number(g.valor), 0))}</strong> este mês.</p>
        </div>
      </div>
    </div>
  );
};
     </section>
    </div>
  );
};
