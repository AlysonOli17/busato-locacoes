import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, AreaChart, Area
} from "recharts";

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (v: number) => {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return (v / 1000).toFixed(1) + "k";
  return v.toFixed(0);
};

interface VisaoGeralTabProps {
  empresas: Array<any>;
  contratos: Array<any>;
  faturas: Array<any>;
  equipamentos: Array<any>;
  gastos: Array<any>;
  medicoes: Array<any>;
  apolices?: Array<any>;
  apolicesEquipamentos?: Array<any>;
  contratosAditivos?: Array<any>;
  aditivosEquipamentos?: Array<any>;
  sinistros?: Array<any>;
  faturamentoGastos?: Array<any>;
  contratosEquipamentos?: Array<any>;
  mode?: "dashboard" | "modules";
}

export const VisaoGeralTab = ({
  empresas,
  contratos,
  faturas,
  equipamentos,
  gastos,
  medicoes,
  apolices = [],
  apolicesEquipamentos = [],
  contratosAditivos = [],
  aditivosEquipamentos = [],
  sinistros = [],
  faturamentoGastos = [],
  contratosEquipamentos = [],
  mode = "dashboard"
}: VisaoGeralTabProps) => {
  const navigate = useNavigate();
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [filtroEquipamento, setFiltroEquipamento] = useState("all");

  // ============ MULTI-PAGE AGGREGATED CALCULATIONS ============

  // 1. Frota & Equipamentos
  const frotaStats = useMemo(() => {
    const total = equipamentos.length;
    const hoje = new Date().toISOString().slice(0, 10);
    
    const ativosSet = new Set(contratos.filter(c => c.status === "Ativo").map(c => c.id));
    const ceList = (contratosEquipamentos || []).filter(ce => ativosSet.has(ce.contrato_id));
    const aditivosAtivos = (contratosAditivos || []).filter(a => ativosSet.has(a.contrato_id));
    
    const rented = new Set<string>();
    const aditivoEquipMap = new Map<string, Set<string>>();
    const latestAditivoEntry = new Map<string, { numero: number; data_devolucao: string | null }>();

    if (aditivosAtivos.length > 0 && aditivosEquipamentos.length > 0) {
      const aditivoIds = new Set(aditivosAtivos.map(a => a.id));
      const aditivosEquips = aditivosEquipamentos.filter(ae => aditivoIds.has(ae.aditivo_id));

      aditivosEquips.forEach((r: any) => {
        const aditivo = aditivosAtivos.find(a => a.id === r.aditivo_id);
        if (!aditivo) return;
        
        if (!aditivoEquipMap.has(aditivo.contrato_id)) aditivoEquipMap.set(aditivo.contrato_id, new Set());
        aditivoEquipMap.get(aditivo.contrato_id)!.add(r.equipamento_id);

        const key = `${aditivo.contrato_id}::${r.equipamento_id}`;
        const existing = latestAditivoEntry.get(key);
        const aditivoNumero = aditivo.numero ?? 0;
        if (!existing || aditivoNumero > existing.numero) {
          latestAditivoEntry.set(key, { numero: aditivoNumero, data_devolucao: r.data_devolucao });
        }
      });

      latestAditivoEntry.forEach((entry, key) => {
        const equipId = key.split("::")[1];
        if (!entry.data_devolucao || entry.data_devolucao > hoje) {
          rented.add(equipId);
        }
      });
    }

    ceList.forEach((r: any) => {
      const contratoId = r.contrato_id;
      if (aditivoEquipMap.has(contratoId) && aditivoEquipMap.get(contratoId)!.has(r.equipamento_id)) return;
      if (r.data_devolucao && r.data_devolucao <= hoje) return;
      rented.add(r.equipamento_id);
    });

    const sinistroSet = new Set<string>();
    (sinistros || []).filter(s => s.status === "Aberto").forEach(s => sinistroSet.add(s.equipamento_id));

    const emManutencaoOuSinistro = equipamentos.filter(i => i.status === "Manutenção" || sinistroSet.has(i.id)).length;
    const emLocacao = equipamentos.filter(i => rented.has(i.id) && !sinistroSet.has(i.id)).length;
    const disponiveis = equipamentos.filter(i => !rented.has(i.id) && i.status !== "Manutenção" && !sinistroSet.has(i.id)).length;

    return { total, disponiveis, emLocacao, emManutencaoOuSinistro };
  }, [equipamentos, contratos, contratosEquipamentos, contratosAditivos, aditivosEquipamentos, sinistros]);

  // 2. Contratos & Locações
  const contratosStats = useMemo(() => {
    const total = contratos.length;
    const ativos = contratos.filter(c => c.status === "Ativo").length;
    const encerrados = contratos.filter(c => c.status === "Encerrado").length;
    
    const hojeStr = new Date().toISOString().slice(0, 10);
    const locados = contratos.filter(i => i.status === "Ativo").reduce((acc, curr) => {
      const allAditivos = (contratosAditivos || []).filter(ad => ad.contrato_id === curr.id);
      const vigentes = allAditivos.filter(ad => ad.data_inicio <= hojeStr && ad.data_fim >= hojeStr);
      const ultimoAditivo = vigentes.length > 0 ? vigentes.reduce((latest, ad) => ad.numero > latest.numero ? ad : latest, vigentes[0]) : null;
      if (ultimoAditivo) {
        const aeList = (aditivosEquipamentos || []).filter(ae => ae.aditivo_id === ultimoAditivo.id);
        return acc + aeList.filter(ae => !ae.data_devolucao || ae.data_devolucao > hojeStr).length;
      }
      const ceList = (contratosEquipamentos || []).filter(ce => ce.contrato_id === curr.id);
      return acc + ceList.filter(ce => !ce.data_devolucao || ce.data_devolucao > hojeStr).length;
    }, 0);

    return { total, ativos, encerrados, locados };
  }, [contratos, contratosAditivos, aditivosEquipamentos, contratosEquipamentos]);

  // 3. Seguros & Apólices
  const apolicesStats = useMemo(() => {
    const hojeDate = new Date();
    const em30dias = new Date();
    em30dias.setDate(em30dias.getDate() + 30);

    const vigentes = (apolices || []).filter(i => i.status === "Vigente");
    const vencendoEm30 = vigentes.filter(i => {
      const fim = new Date(i.vigencia_fim);
      return fim >= hojeDate && fim <= em30dias;
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

    return { vigentes: vigentes.length, vencendoEm30: vencendoEm30.length, totalMensal, totalAnual };
  }, [apolices]);

  // 4. Finanças & Custos
  const gastosStats = useMemo(() => {
    const semMob = gastos.filter(g => g.tipo !== "Mobilização" && g.tipo !== "Desmobilização");
    const mob = gastos.filter(g => g.tipo === "Mobilização" || g.tipo === "Desmobilização");
    
    const fatGastoSet = new Set((faturamentoGastos || []).map(fg => fg.gasto_id));
    const deduzidosList = gastos.filter(g => fatGastoSet.has(g.id));
    const naoDeduzidosList = gastos.filter(g => !fatGastoSet.has(g.id));

    const totalCustos = semMob.reduce((acc, i) => acc + Number(i.valor), 0);
    const totalMobilizacao = mob.reduce((acc, i) => acc + Number(i.valor), 0);
    const totalDeduzido = deduzidosList.reduce((acc, i) => acc + Number(i.valor), 0);
    const totalNaoDeduzido = naoDeduzidosList.reduce((acc, i) => acc + Number(i.valor), 0);

    return { totalCustos, totalMobilizacao, totalDeduzido, totalNaoDeduzido };
  }, [gastos, faturamentoGastos]);

  // 5. Medições
  const medicoesStats = useMemo(() => {
    const total = medicoes.length;
    const medidos = new Set(medicoes.map(m => m.equipamento_id)).size;
    const trabalho = medicoes.filter(m => (m.tipo || "Trabalho") === "Trabalho").length;
    const indisponivel = medicoes.filter(m => (m.tipo || "Trabalho") === "Indisponível").length;
    return { total, medidos, trabalho, indisponivel };
  }, [medicoes]);


  // ============ EXECUTIVE METRICS ============

  // Filtered faturas & gastos by date
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
        const cInicio = (c.data_inicio && typeof c.data_inicio === "string") ? c.data_inicio.slice(0, 7) : "";
        const cFim = (c.data_fim && typeof c.data_fim === "string") ? c.data_fim.slice(0, 7) : "";
        if (cInicio && cFim && monthKey >= cInicio && monthKey <= cFim) {
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
    <div className="space-y-8">
      {mode === "dashboard" && (
        /* HEADER EXECUTIVO */
        <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-sidebar">Painel de Acompanhamento Geral</h2>
            <p className="text-muted-foreground text-sm">Resumo operacional e financeiro consolidado de todo o sistema.</p>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg border">
            <CalendarClock className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Período: {new Date(dataInicio).toLocaleDateString()} - {new Date(dataFim).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {mode === "modules" && (
        /* ============ SECTIONS OF MULTI-PAGE CARDS (CLICKABLE) ============ */
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Acompanhamento por Módulos</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Module: Frota */}
          <div 
            onClick={() => navigate("/equipamentos")}
            className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Frota & Equipamentos</h4>
                    <p className="text-[10px] text-muted-foreground">Clique para gerenciar frota</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Total</p>
                  <p className="text-base font-bold mt-1 text-foreground">{frotaStats.total}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Disponíveis</p>
                  <p className="text-base font-bold mt-1 text-success">{frotaStats.disponiveis}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Em Locação</p>
                  <p className="text-base font-bold mt-1 text-primary">{frotaStats.emLocacao}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Manut. / Sinistro</p>
                  <p className="text-base font-bold mt-1 text-warning">{frotaStats.emManutencaoOuSinistro}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Module: Empresas */}
          <div 
            onClick={() => navigate("/empresas")}
            className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Empresas & Parceiros</h4>
                    <p className="text-[10px] text-muted-foreground">Clique para gerenciar clientes</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Total</p>
                  <p className="text-base font-bold mt-1 text-foreground">{empresas.length}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Ativas</p>
                  <p className="text-base font-bold mt-1 text-success">{empresas.filter((e: any) => e.status === "Ativa").length}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Inativas</p>
                  <p className="text-base font-bold mt-1 text-muted-foreground">{empresas.filter((e: any) => e.status === "Inativa").length}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Cidades</p>
                  <p className="text-base font-bold mt-1 text-primary">{new Set(empresas.map((e: any) => e.endereco_cidade).filter(Boolean)).size}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Module: Contratos */}
          <div 
            onClick={() => navigate("/contratos")}
            className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Contratos & Locações</h4>
                    <p className="text-[10px] text-muted-foreground">Clique para gerenciar locações</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Total Contratos</p>
                  <p className="text-base font-bold mt-1 text-foreground">{contratosStats.total}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Ativos</p>
                  <p className="text-base font-bold mt-1 text-success">{contratosStats.ativos}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Equip. Locados</p>
                  <p className="text-base font-bold mt-1 text-primary">{contratosStats.locados}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Encerrados</p>
                  <p className="text-base font-bold mt-1 text-muted-foreground">{contratosStats.encerrados}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Module: Seguros */}
          <div 
            onClick={() => navigate("/apolices")}
            className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Seguros & Apólices</h4>
                    <p className="text-[10px] text-muted-foreground">Clique para gerenciar apólices</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Vigentes</p>
                  <p className="text-base font-bold mt-1 text-success">{apolicesStats.vigentes}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Vencendo (30 dias)</p>
                  <p className="text-base font-bold mt-1 text-warning">{apolicesStats.vencendoEm30}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Custo Mensal</p>
                  <p className="text-sm font-bold mt-1 text-foreground leading-snug">R$ {fmtShort(apolicesStats.totalMensal)}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Total Anual</p>
                  <p className="text-sm font-bold mt-1 text-primary leading-snug">R$ {fmtShort(apolicesStats.totalAnual)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Module: Custos */}
          <div 
            onClick={() => navigate("/gastos")}
            className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Centro de Custos & Gastos</h4>
                    <p className="text-[10px] text-muted-foreground">Clique para gerenciar custos</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Total de Custos</p>
                  <p className="text-sm font-bold mt-1 text-foreground leading-none">R$ {fmtShort(gastosStats.totalCustos)}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Receita Mobilização</p>
                  <p className="text-sm font-bold mt-1 text-primary leading-none">R$ {fmtShort(gastosStats.totalMobilizacao)}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Faturado/Deduzido</p>
                  <p className="text-sm font-bold mt-1 text-success leading-none">R$ {fmtShort(gastosStats.totalDeduzido)}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Não Faturado</p>
                  <p className="text-sm font-bold mt-1 text-destructive leading-none">R$ {fmtShort(gastosStats.totalNaoDeduzido)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Module: Medições */}
          <div 
            onClick={() => navigate("/medicoes")}
            className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Medições & Faturamento</h4>
                    <p className="text-[10px] text-muted-foreground">Clique para gerenciar medições</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Total Registros</p>
                  <p className="text-base font-bold mt-1 text-foreground leading-none">{medicoesStats.total}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Equip. Medidos</p>
                  <p className="text-base font-bold mt-1 text-primary leading-none">{medicoesStats.medidos}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Reg. Trabalho</p>
                  <p className="text-base font-bold mt-1 text-success leading-none">{medicoesStats.trabalho}</p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">Reg. Indisponíveis</p>
                  <p className="text-base font-bold mt-1 text-destructive leading-none">{medicoesStats.indisponivel}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {mode === "dashboard" && (
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Métricas de Performance Operacional</h3>

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
      )}
    </div>
  );
};
