import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Relequip } from "@/lib/relequip/types";
import { isMaquina, situacaoStyle, SITUACOES, formatCurrencyBR } from "@/lib/relequip/types";
import {
  Truck,
  Wrench,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertTriangle,
  Building2,
  HardHat,
  PieChart as PieChartIcon,
  Tag,
  Archive,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface RelequipDashboardProps {
  registros: Relequip[];
  onFiltrarSituacao?: (situacao: string) => void;
  onFiltrarCentroCusto?: (cc: string) => void;
}

export const RelequipDashboard: React.FC<RelequipDashboardProps> = ({
  registros,
  onFiltrarSituacao,
  onFiltrarCentroCusto,
}) => {
  const frota = useMemo(() => registros.filter((r) => r.grupo === "frota"), [registros]);
  const baixados = useMemo(() => registros.filter((r) => r.grupo === "baixado"), [registros]);

  // Contadores principais
  const kpis = useMemo(() => {
    let atuando = 0;
    let disponivel = 0;
    let locado = 0;
    let oficina = 0;
    let emVenda = 0;
    let maquinas = 0;
    let veiculos = 0;
    let custoVendaTotal = 0;
    let itensComCustoVenda = 0;

    frota.forEach((r) => {
      const s = (r.situacao || "").trim();
      if (s === "Atuando") atuando++;
      else if (s === "Disponível") disponivel++;
      else if (s === "Locado") locado++;
      else if (s === "Rep. Mecânico") oficina++;
      else if (s === "Av. Venda" || s === "Venda") emVenda++;

      if (isMaquina(r)) maquinas++;
      else veiculos++;

      if (typeof r.custo_recuperacao === "number" && r.custo_recuperacao > 0) {
        custoVendaTotal += r.custo_recuperacao;
        itensComCustoVenda++;
      }
    });

    return {
      totalFrota: frota.length,
      totalBaixados: baixados.length,
      atuando,
      disponivel,
      locado,
      oficina,
      emVenda,
      maquinas,
      veiculos,
      custoVendaTotal,
      itensComCustoVenda,
    };
  }, [frota, baixados]);

  // Distribuição por situação
  const dadosSituacao = useMemo(() => {
    const mapa: Record<string, number> = {};
    frota.forEach((r) => {
      const s = (r.situacao || "Outros").trim();
      mapa[s] = (mapa[s] || 0) + 1;
    });
    return Object.entries(mapa)
      .map(([name, value]) => ({
        name,
        value,
        color: situacaoStyle(name).chart,
      }))
      .sort((a, b) => b.value - a.value);
  }, [frota]);

  // Top centros de custo
  const dadosCentroCusto = useMemo(() => {
    const mapa: Record<string, number> = {};
    frota.forEach((r) => {
      const cc = (r.centro_custo || "Sem Centro de Custo").trim();
      mapa[cc] = (mapa[cc] || 0) + 1;
    });
    return Object.entries(mapa)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [frota]);

  // Top tipos de implemento
  const dadosImplementos = useMemo(() => {
    const mapa: Record<string, number> = {};
    frota.forEach((r) => {
      const tipo = (r.tipo_implemento || "Não Definido").trim();
      mapa[tipo] = (mapa[tipo] || 0) + 1;
    });
    return Object.entries(mapa)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [frota]);

  return (
    <div className="space-y-6">
      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="border border-border/60 bg-gradient-to-br from-card to-card/60 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Frota Ativa</span>
            <Truck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold tracking-tight">{kpis.totalFrota}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {kpis.veiculos} veículos · {kpis.maquinas} máquinas
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => onFiltrarSituacao?.("Atuando")}
          className="cursor-pointer border border-border/60 bg-gradient-to-br from-emerald-500/5 to-transparent hover:border-emerald-500/40 transition-colors shadow-sm"
        >
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Atuando</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {kpis.atuando}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {((kpis.atuando / (kpis.totalFrota || 1)) * 100).toFixed(0)}% da frota
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => onFiltrarSituacao?.("Disponível")}
          className="cursor-pointer border border-border/60 bg-gradient-to-br from-indigo-500/5 to-transparent hover:border-indigo-500/40 transition-colors shadow-sm"
        >
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Disponível</span>
            <Clock className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {kpis.disponivel}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Prontos p/ contrato</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => onFiltrarSituacao?.("Rep. Mecânico")}
          className="cursor-pointer border border-border/60 bg-gradient-to-br from-amber-500/5 to-transparent hover:border-amber-500/40 transition-colors shadow-sm"
        >
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Oficina</span>
            <Wrench className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {kpis.oficina}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Reparo mecânico</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => onFiltrarSituacao?.("Venda")}
          className="cursor-pointer border border-border/60 bg-gradient-to-br from-rose-500/5 to-transparent hover:border-rose-500/40 transition-colors shadow-sm"
        >
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Em Venda / Av.</span>
            <Tag className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {kpis.emVenda}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Desmobilização</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-gradient-to-br from-slate-500/5 to-transparent shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Baixados</span>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold text-muted-foreground">{kpis.totalBaixados}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Vendidos/Devolvidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Destaque Financeiro de Venda */}
      {kpis.custoVendaTotal > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                Custo Estimado de Recuperação para Venda:{" "}
                <span className="text-amber-600 dark:text-amber-400">
                  {formatCurrencyBR(kpis.custoVendaTotal)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Mapeado em {kpis.itensComCustoVenda} equipamentos da aba de Venda com orçamento definido.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 self-start md:self-auto">
            Acompanhamento de Venda Ativo
          </Badge>
        </div>
      )}

      {/* Gráficos de Análise */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição por Situação */}
        <Card className="border border-border/60">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" />
              Distribuição por Situação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosSituacao}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {dadosSituacao.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`${val} equipamentos`, "Quantidade"]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2">
              {dadosSituacao.slice(0, 6).map((item) => (
                <button
                  key={item.name}
                  onClick={() => onFiltrarSituacao?.(item.name)}
                  className="flex items-center justify-between text-xs p-1 rounded hover:bg-muted/50 text-left"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="font-semibold ml-1">{item.value}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Frota por Centro de Custo */}
        <Card className="border border-border/60 lg:col-span-2">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Frota Ativa por Centro de Custo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosCentroCusto} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis type="number" fontSize={11} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={130}
                    fontSize={11}
                    tickFormatter={(val) => (val.length > 16 ? `${val.slice(0, 16)}...` : val)}
                  />
                  <Tooltip
                    formatter={(val: number) => [`${val} equipamentos`, "Quantidade"]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                    onClick={(entry) => onFiltrarCentroCusto?.(entry.name)}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Tipos de Implemento */}
      <Card className="border border-border/60">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HardHat className="h-4 w-4 text-primary" />
            Top Implementos & Equipamentos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
            {dadosImplementos.map((item) => (
              <div
                key={item.name}
                className="p-2.5 rounded-lg border border-border/50 bg-muted/20 flex flex-col items-center text-center"
              >
                <div className="text-base font-bold text-foreground">{item.value}</div>
                <div className="text-[11px] text-muted-foreground truncate w-full mt-0.5" title={item.name}>
                  {item.name}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
