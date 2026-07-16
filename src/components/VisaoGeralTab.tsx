import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, Building2,
  Wrench, FileText, Activity, BarChart3, PieChart as PieChartIcon, CalendarClock, Shield, Truck,
  Target, Zap, ArrowUpRight, ArrowDownRight, Info, Receipt
} from "lucide-react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  AreaChart, Area, ComposedChart, Cell, Line,
  PieChart, Pie, Legend
} from "recharts";

const parseLocalDate = (dateStr: any): Date => {
  const mkFallback = () => {
    const d = new Date(NaN);
    (d as any).toLocaleDateString = () => "—";
    return d;
  };
  if (!dateStr) return mkFallback();
  const str = String(dateStr).trim();
  if (!str || str === "null" || str === "undefined") return mkFallback();
  const d = str.includes("T") ? new Date(str) : new Date(str + "T00:00:00");
  if (isNaN(d.getTime())) return mkFallback();
  return d;
};

const fmt = (v: any) => {
  const val = Number(v);
  if (isNaN(val)) return "0,00";
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtShort = (v: any) => {
  const val = Number(v);
  if (isNaN(val)) return "0";
  if (val >= 1000000) return (val / 1000000).toFixed(1) + "M";
  if (val >= 1000) return (val / 1000).toFixed(1) + "k";
  return val.toFixed(0);
};

// ─── CostChart sub-component ────────────────────────────────────────────────
const COST_COLORS = [
  "hsl(221, 83%, 53%)", // blue
  "hsl(142, 71%, 45%)", // green
  "hsl(38, 92%, 50%)", // yellow
  "hsl(348, 83%, 47%)", // red
  "hsl(280, 65%, 60%)", // purple
  "hsl(199, 89%, 48%)", // cyan
];

const CostChart = ({ gastosFiltered, fmt, fmtShort }: { gastosFiltered: any[]; fmt: (v: any) => string; fmtShort: (v: any) => string }) => {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    gastosFiltered.forEach(g => { const t = g.tipo || "Outros"; map[t] = (map[t] || 0) + Number(g.valor); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [gastosFiltered]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="overflow-hidden shadow-sm border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/80">
            <PieChartIcon className="h-4 w-4 text-primary" />
            Centro de Custos Operacionais
          </CardTitle>
          <span className="text-[11px] font-bold bg-muted px-2 py-1 rounded-md text-foreground/80">Total: R$ {fmtShort(total)}</span>
        </div>
      </CardHeader>
      <CardContent className="h-[280px] px-2 pb-2">
        {data.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground opacity-70">
            <PieChartIcon className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-sm font-medium">Nenhum gasto registrado no período.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: "hsl(var(--foreground))", fontWeight: 600 }} 
                width={100}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
                  return (
                    <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-3 min-w-[180px]">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{item.name}</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium text-foreground/70">Valor:</span>
                          <span className="text-sm font-black text-foreground">R$ {fmt(item.value)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium text-foreground/70">Representa:</span>
                          <span className="text-xs font-bold text-primary">{pct}%</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COST_COLORS[index % COST_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

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
  const [activeModal, setActiveModal] = useState<"clientes" | "maquinas" | "seguros" | "vencimentos" | "confiabilidade" | null>(null);
  const [faturamentoEquipamentosList, setFaturamentoEquipamentosList] = useState<any[]>([]);

  useEffect(() => {
    const loadFaturamentoEquipamentos = async () => {
      const { data } = await supabase.from("faturamento_equipamentos").select("*");
      if (data) setFaturamentoEquipamentosList(data);
    };
    loadFaturamentoEquipamentos();
  }, []);

  // ============ MULTI-PAGE AGGREGATED CALCULATIONS ============

  // 1. Frota & Equipamentos
  // Active contract IDs Set helper
  const activeContratoIds = useMemo(() => {
    return new Set(contratos.filter(c => c.status === "Ativo").map(c => c.id));
  }, [contratos]);

  // Set of currently rented equipment IDs
  const rentedEquipamentosIds = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const rented = new Set<string>();
    const aditivoEquipMap = new Map<string, Set<string>>();
    const latestAditivoEntry = new Map<string, { numero: number; data_devolucao: string | null }>();

    const aditivosAtivos = (contratosAditivos || []).filter(a => activeContratoIds.has(a.contrato_id));
    const ceList = (contratosEquipamentos || []).filter(ce => activeContratoIds.has(ce.contrato_id));

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

    return rented;
  }, [activeContratoIds, contratosAditivos, aditivosEquipamentos, contratosEquipamentos]);

  // 1. Frota & Equipamentos
  const frotaStats = useMemo(() => {
    const total = equipamentos.length;
    const sinistroSet = new Set<string>();
    (sinistros || []).filter(s => s.status === "Aberto").forEach(s => sinistroSet.add(s.equipamento_id));

    const emManutencaoOuSinistro = equipamentos.filter(i => i.status === "Manutenção" || sinistroSet.has(i.id)).length;
    const emLocacao = equipamentos.filter(i => rentedEquipamentosIds.has(i.id) && !sinistroSet.has(i.id)).length;
    const disponiveis = equipamentos.filter(i => !rentedEquipamentosIds.has(i.id) && i.status !== "Manutenção" && !sinistroSet.has(i.id)).length;

    return { total, disponiveis, emLocacao, emManutencaoOuSinistro };
  }, [equipamentos, rentedEquipamentosIds, sinistros]);

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
    const tiposFixos = ["Seguro Patrimonial", "Rastreadores / Telecom", "Parcelas e Financiamentos", "Depreciação", "Impostos e Taxas (IPVA)"];
    const tiposMob = ["Mobilização", "Desmobilização"];

    const semMob = gastos.filter(g => !tiposMob.includes(g.tipo));
    const mob = gastos.filter(g => tiposMob.includes(g.tipo));
    const fixos = gastos.filter(g => tiposFixos.includes(g.tipo));
    
    const fatGastoSet = new Set((faturamentoGastos || []).map(fg => fg.gasto_id));
    const deduzidosList = gastos.filter(g => fatGastoSet.has(g.id));
    const naoDeduzidosList = gastos.filter(g => !fatGastoSet.has(g.id));

    const totalCustos = semMob.reduce((acc, i) => acc + Number(i.valor), 0);
    const totalMobilizacao = mob.reduce((acc, i) => acc + Number(i.valor), 0);
    const totalFixo = fixos.reduce((acc, i) => acc + Number(i.valor), 0);
    const totalDeduzido = deduzidosList.reduce((acc, i) => acc + Number(i.valor), 0);
    const totalNaoDeduzido = naoDeduzidosList.reduce((acc, i) => acc + Number(i.valor), 0);

    return { totalCustos, totalMobilizacao, totalFixo, totalDeduzido, totalNaoDeduzido };
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
      // Ignora faturas que não devem compor o relatório de faturamento consolidado
      if (f.status === "Cancelado" || f.status === "Pendente" || f.status === "Aguardando Aprovação") return false;
      
      const emissao = f.emissao;
      if (dataInicio && emissao < dataInicio) return false;
      if (dataFim && emissao > dataFim) return false;
      return true;
    });
  }, [faturas, dataInicio, dataFim]);

  const gastosFiltered = useMemo(() => {
    return gastos.filter(g => {
      if (!g.data) return false;
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
      const eqFaturas = faturas.filter(f => f.status !== "Cancelado" && f.contrato_id && contratos.find(c => c.id === f.contrato_id && c.equipamento_id === eq.id));
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
    }).sort((a, b) => b.percentual - a.percentual);
  }, [equipamentos, faturas, gastos, contratos]);

  const totalFaturado = faturasFiltered.filter(f => f.status === "Pago").reduce((s: number, f: any) => s + Number(f.valor_total), 0);
  const totalGastos = gastosFiltered.reduce((s: number, g: any) => s + Number(g.valor), 0);
  const margemGeral = totalFaturado > 0 ? ((totalFaturado - totalGastos) / totalFaturado) * 100 : 0;

  // Ocupação real = máquinas efetivamente locadas / total da frota
  const taxaUtilizacao = frotaStats.total > 0 ? Math.round((frotaStats.emLocacao / frotaStats.total) * 100) : 0;

  // ============ ADVANCED BI CALCULATIONS ============
  const mensalFinanceiroData = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const monthKey = d.toISOString().slice(0, 7);
      
      const receitasMes = faturas
        .filter(f => f && f.status !== "Cancelado" && f.emissao && typeof f.emissao === "string" && f.emissao.slice(0, 7) === monthKey)
        .reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
        
      const tiposFixos = ["Seguro Patrimonial", "Rastreadores / Telecom", "Parcelas e Financiamentos", "Depreciação", "Impostos e Taxas (IPVA)"];
      let custosFixosMes = 0;
      let custosVarMes = 0;
      gastos.forEach(g => {
        if (g && g.data && typeof g.data === "string" && g.data.slice(0, 7) === monthKey) {
          if (tiposFixos.includes(g.tipo)) custosFixosMes += Number(g.valor || 0);
          else custosVarMes += Number(g.valor || 0);
        }
      });
      
      custosFixosMes += (apolicesStats?.totalMensal || 0);
        
      result.push({
        mes: label,
        "Receitas": receitasMes,
        "Custos Operacionais": custosVarMes,
        "Custos Fixos": custosFixosMes,
        "Resultado": receitasMes - custosVarMes - custosFixosMes
      });
    }
    return result;
  }, [faturas, gastos]);

  const todosClientes = useMemo(() => {
    const map = new Map<string, { 
      nome: string; 
      total: number; 
      totalPago: number;
      contratosCount: number;
      despesa: number;
      margem: number;
      percentual: number;
      confiabilidade: number;
    }>();

    // Initialize all companies from faturas and contracts
    faturas.forEach(f => {
      if (!f || f.status === "Cancelado") return;
      if (!f.contrato_id || !activeContratoIds.has(f.contrato_id)) return;
      const empresa = f.contratos?.empresas;
      if (!empresa) return;
      const key = String(empresa.id || empresa.nome);
      const valor = Number(f.valor_total || 0);
      const isPago = f.status === "Pago";
      if (!map.has(key)) {
        map.set(key, { 
          nome: empresa.nome || "Cliente sem Nome", 
          total: 0, 
          totalPago: 0,
          contratosCount: 0,
          despesa: 0,
          margem: 0,
          percentual: 0,
          confiabilidade: 0
        });
      }
      const entry = map.get(key)!;
      entry.total += valor;
      if (isPago) {
        entry.totalPago += valor;
      }
    });
    
    contratos.forEach(c => {
      if (c && c.empresas) {
        if (c.status !== "Ativo") return;
        const key = String(c.empresas.id || c.empresas.nome);
        if (!map.has(key)) {
          map.set(key, {
            nome: c.empresas.nome || "Cliente sem Nome",
            total: 0,
            totalPago: 0,
            contratosCount: 0,
            despesa: 0,
            margem: 0,
            percentual: 0,
            confiabilidade: 0
          });
        }
        map.get(key)!.contratosCount += 1;
      }
    });

    // Map gastos to their invoice fatura if linked via faturamentoGastos
    const gastoToFaturaMap = new Map<string, string>();
    (faturamentoGastos || []).forEach(fg => {
      if (fg.gasto_id && fg.faturamento_id) {
        gastoToFaturaMap.set(fg.gasto_id, fg.faturamento_id);
      }
    });

    // Attribute gastos to the company
    gastos.forEach(g => {
      const valor = Number(g.valor || 0);
      if (valor === 0) return;

      // Check if linked to an invoice fatura
      const faturaId = gastoToFaturaMap.get(g.id);
      if (faturaId) {
        const fatura = faturas.find(f => f.id === faturaId);
        const contrato = fatura ? contratos.find(c => c.id === fatura.contrato_id) : null;
        if (contrato && contrato.status === "Ativo" && contrato.empresas) {
          const key = String(contrato.empresas.id || contrato.empresas.nome);
          const entry = map.get(key);
          if (entry) {
            entry.despesa += valor;
            return;
          }
        }
      }

      // Check machine allocation dates if not explicitly linked to an invoice
      const gDate = g.data;
      if (!gDate || !g.equipamento_id) return;

      for (const c of contratos) {
        if (c.status !== "Ativo" || !c.empresas) continue;
        
        const belongsToContract = (contratosEquipamentos || []).some((ce: any) => {
          if (ce.contrato_id !== c.id || ce.equipamento_id !== g.equipamento_id) return false;
          const start = ce.data_inicio || c.data_inicio || "1970-01-01";
          const end = ce.data_devolucao || c.data_fim || "9999-12-31";
          return gDate >= start && gDate <= end;
        }) || (aditivosEquipamentos || []).some((ae: any) => {
          if (ae.equipamento_id !== g.equipamento_id) return false;
          const aditivo = (contratosAditivos || []).find(ad => ad.id === ae.aditivo_id && ad.contrato_id === c.id);
          if (!aditivo) return false;
          const start = aditivo.data_inicio || c.data_inicio || "1970-01-01";
          const end = ae.data_devolucao || aditivo.data_fim || c.data_fim || "9999-12-31";
          return gDate >= start && gDate <= end;
        });

        if (belongsToContract) {
          const key = String(c.empresas.id || c.empresas.nome);
          const entry = map.get(key);
          if (entry) {
            entry.despesa += valor;
            break; 
          }
        }
      }
    });

    // Calculate margins and percentages
    map.forEach(entry => {
      entry.margem = entry.totalPago - entry.despesa;
      entry.percentual = entry.totalPago > 0 ? (entry.margem / entry.totalPago) * 100 : 0;
      entry.confiabilidade = entry.total > 0 ? (entry.totalPago / entry.total) * 100 : 100;
    });

    return Array.from(map.values()).sort((a, b) => b.margem - a.margem);
  }, [faturas, contratos, gastos, faturamentoGastos, contratosEquipamentos, aditivosEquipamentos, contratosAditivos, activeContratoIds]);

  const overallReliability = useMemo(() => {
    const totalInvoiced = faturas.filter(f => f && f.status !== "Cancelado" && activeContratoIds.has(f.contrato_id)).reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
    const totalPaid = faturas.filter(f => f && f.status === "Pago" && activeContratoIds.has(f.contrato_id)).reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
    return totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 100;
  }, [faturas, activeContratoIds]);

  const topClientes = useMemo(() => {
    return todosClientes.slice(0, 5);
  }, [todosClientes]);

  const faturamentoPorEquipamento = useMemo(() => {
    const map = new Map<string, number>();
    faturamentoEquipamentosList.forEach(item => {
      const fat = faturas.find(f => f.id === item.faturamento_id);
      if (fat && fat.status === "Pago" && fat.contrato_id && activeContratoIds.has(fat.contrato_id)) {
        const horasNormais = Number(item.horas_normais ?? item.horas_medidas ?? 0);
        const valorHora = Number(item.valor_hora ?? 0);
        const horasExcedentes = Number(item.horas_excedentes ?? 0);
        const valorHoraExcedente = Number(item.valor_hora_excedente ?? item.valor_excedente_hora ?? 0);
        
        const totalItem = (horasNormais * valorHora) + (horasExcedentes * valorHoraExcedente);
        map.set(item.equipamento_id, (map.get(item.equipamento_id) || 0) + totalItem);
      }
    });
    return map;
  }, [faturamentoEquipamentosList, faturas, activeContratoIds]);

  const todosEquipamentos = useMemo(() => {
    // Calcular custo de seguro rateado por equipamento
    const custoSeguroPorEquipamento = new Map<string, number>();
    const vigentes = (apolices || []).filter(a => a.status === "Vigente");
    vigentes.forEach(ap => {
      let valorMensal = 0;
      if (ap.tem_parcelamento && ap.numero_parcelas > 0) {
        valorMensal = ap.valor / ap.numero_parcelas;
      } else {
        const inicio = new Date(ap.vigencia_inicio);
        const fim = new Date(ap.vigencia_fim);
        const meses = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        valorMensal = ap.valor / meses;
      }
      
      const equipIds = (apolicesEquipamentos || [])
        .filter(ae => ae.apolice_id === ap.id)
        .map(ae => ae.equipamento_id);
        
      if (equipIds.length > 0) {
        const valorPorEquipamento = valorMensal / equipIds.length;
        equipIds.forEach(id => {
          custoSeguroPorEquipamento.set(id, (custoSeguroPorEquipamento.get(id) || 0) + valorPorEquipamento);
        });
      }
    });

    return equipamentos.map(eq => {
      const receita = faturamentoPorEquipamento.get(eq.id) || 0;
      const eqGastos = gastos.filter(g => {
        if (g.equipamento_id !== eq.id) return false;
        
        // Exclude expenses associated with finished contracts
        const fatId = (faturamentoGastos || []).find(fg => fg.gasto_id === g.id)?.faturamento_id;
        if (fatId) {
          const fat = faturas.find(f => f.id === fatId);
          return fat && activeContratoIds.has(fat.contrato_id);
        }

        const belongsToConcluded = contratos.some(c => {
          if (c.status === "Ativo") return false;
          return (contratosEquipamentos || []).some((ce: any) => {
            if (ce.contrato_id !== c.id || ce.equipamento_id !== g.equipamento_id) return false;
            const start = ce.data_inicio || c.data_inicio || "1970-01-01";
            const end = ce.data_devolucao || c.data_fim || "9999-12-31";
            return g.data >= start && g.data <= end;
          });
        });
        return !belongsToConcluded;
      });
      
      let despesa = eqGastos.reduce((s, g) => s + Number(g.valor), 0);
      despesa += custoSeguroPorEquipamento.get(eq.id) || 0;
      
      const margem = receita - despesa;
      const percentual = receita > 0 ? (margem / receita) * 100 : 0;
      
      return {
        id: eq.id,
        nome: `${eq.tipo} ${eq.modelo}`,
        tag: eq.tag_placa || "Sem Placa",
        receita,
        despesa,
        margem,
        percentual,
        status: eq.status
      };
    }).sort((a, b) => b.margem - a.margem);
  }, [equipamentos, faturamentoPorEquipamento, gastos, activeContratoIds, faturamentoGastos, faturas, contratos, contratosEquipamentos, apolices, apolicesEquipamentos]);

  const topEquipamentos = useMemo(() => {
    return todosEquipamentos.slice(0, 5);
  }, [todosEquipamentos]);

  const todosContratosAVencer = useMemo(() => {
    const limitDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return contratos
      .filter(c => c.status === "Ativo" && c.data_fim && !isNaN(parseLocalDate(c.data_fim).getTime()) && parseLocalDate(c.data_fim) < limitDate)
      .sort((a, b) => parseLocalDate(a.data_fim).getTime() - parseLocalDate(b.data_fim).getTime());
  }, [contratos]);

  const inadimplenciaStats = useMemo(() => {
    const hoje = new Date();
    
    const getVenc = (f: any) => {
      const prazo = f.contratos?.prazo_faturamento || 30;
      const dateStr = f.data_aprovacao || f.emissao;
      if (!dateStr) return null;
      const baseDate = parseLocalDate(dateStr);
      if (isNaN(baseDate.getTime())) return null;
      const v = new Date(baseDate);
      v.setDate(v.getDate() + prazo);
      return v;
    };

    const emAtraso = faturas.filter(f => {
      if (!f || f.status === "Pago" || f.status === "Cancelado") return false;
      const venc = getVenc(f);
      return venc && hoje > venc;
    });
    
    const totalEmitido = faturas.reduce((sum, f) => sum + Number(f ? f.valor_total : 0), 0);
    const totalAtrasoVal = emAtraso.reduce((sum, f) => sum + Number(f ? f.valor_total : 0), 0);
    const percentualAtraso = totalEmitido > 0 ? (totalAtrasoVal / totalEmitido) * 100 : 0;
    
    return {
      quantidade: emAtraso.length,
      valor: totalAtrasoVal,
      percentual: percentualAtraso
    };
  }, [faturas]);

  const equipSemSeguro = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const ativosSet = new Set(contratos.filter(c => c.status === "Ativo").map(c => c.id));
    const locadosSet = new Set<string>();
    
    (contratosEquipamentos || []).forEach((ce: any) => {
      if (ativosSet.has(ce.contrato_id) && (!ce.data_devolucao || ce.data_devolucao > hoje)) {
        locadosSet.add(ce.equipamento_id);
      }
    });

    const vigentesApolices = (apolices || []).filter(a => a.status === "Vigente");
    const insuredEquipIds = new Set<string>();
    
    vigentesApolices.forEach(ap => {
      (apolicesEquipamentos || [])
        .filter(ae => ae.apolice_id === ap.id)
        .forEach(ae => insuredEquipIds.add(ae.equipamento_id));
    });

    return equipamentos.filter(e => locadosSet.has(e.id) && !insuredEquipIds.has(e.id));
  }, [equipamentos, contratos, contratosEquipamentos, apolices, apolicesEquipamentos]);

  return (
    <div className="space-y-8">
      {/* 1. Global Filters */}
      <Card className="border-border/50 bg-muted/10 shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Período Início</span>
              <input type="date" className="flex h-9 w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Período Fim</span>
              <input type="date" className="flex h-9 w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground bg-background px-4 py-2 rounded-lg border shadow-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Cockpit Executivo
          </div>
        </CardContent>
      </Card>

      <div className="space-y-8 animate-in fade-in duration-300">
        {/* 2. Tríade Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Faturamento e Yield */}
          <Card className="hover:shadow-lg transition-all border-none bg-gradient-to-br from-primary/10 to-primary/5 relative overflow-hidden cursor-pointer hover:ring-2 ring-primary/50" onClick={() => setActiveModal("faturamento_detalhes")}>
            <div className="absolute -top-4 -right-4 p-4 opacity-10 pointer-events-none"><DollarSign className="w-32 h-32 text-primary" /></div>
            <CardContent className="p-6 relative z-10">
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Faturamento Total (Período)</p>
              <h3 className="text-3xl font-black text-foreground mb-4">R$ {fmt(totalFaturado)}</h3>
              <div className="inline-flex items-center gap-3 bg-background/60 rounded-xl p-3 border border-primary/20 backdrop-blur-sm">
                <div className="h-8 w-8 shrink-0 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Yield Operacional / Máq</span>
                  <span className="text-sm font-black text-foreground">R$ {fmt(totalFaturado / Math.max(1, frotaStats.emLocacao))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Resultado da Operação */}
          <Card className={`hover:shadow-lg transition-all border-none relative overflow-hidden cursor-pointer hover:ring-2 ${margemGeral >= 0 ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 ring-emerald-500/50' : 'bg-gradient-to-br from-rose-500/10 to-rose-500/5 ring-rose-500/50'}`} onClick={() => setActiveModal("ebitda_detalhes")}>
            <div className="absolute -top-4 -right-4 p-4 opacity-10 pointer-events-none">{margemGeral >= 0 ? <TrendingUp className="w-32 h-32 text-emerald-500" /> : <TrendingDown className="w-32 h-32 text-rose-500" />}</div>
            <CardContent className="p-6 relative z-10">
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${margemGeral >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Resultado (EBITDA)</p>
              <h3 className="text-3xl font-black text-foreground mb-4">R$ {fmt(totalFaturado - totalGastos)}</h3>
              <div className={`inline-flex items-center gap-3 bg-background/60 rounded-xl p-3 border backdrop-blur-sm ${margemGeral >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
                <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${margemGeral >= 0 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-rose-500/20 text-rose-600'}`}>
                  <Target className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Margem Operacional</span>
                  <span className={`text-sm font-black ${margemGeral >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{margemGeral.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Ocupação da Frota */}
          <Card className="hover:shadow-lg transition-all border-none bg-gradient-to-br from-accent/10 to-accent/5 relative overflow-hidden cursor-pointer hover:ring-2 ring-accent-foreground/50" onClick={() => setActiveModal("frota_detalhes")}>
            <div className="absolute -top-4 -right-4 p-4 opacity-10 pointer-events-none"><Truck className="w-32 h-32 text-accent-foreground" /></div>
            <CardContent className="p-6 relative z-10 flex flex-col justify-center h-full">
              <div className="flex items-center justify-between gap-4">
                <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
                  <svg width="88" height="88" viewBox="0 0 88 88">
                    <circle cx="44" cy="44" r="36" fill="transparent" stroke="hsl(var(--muted))" strokeWidth="12" />
                    <circle
                      cx="44"
                      cy="44"
                      r="36"
                      fill="transparent"
                      stroke="#10b981"
                      strokeWidth="12"
                      strokeDasharray={`${(frotaStats.emLocacao / Math.max(1, frotaStats.total)) * 226} 226`}
                      strokeLinecap="round"
                      transform="rotate(-90 44 44)"
                    />
                    {frotaStats.emManutencaoOuSinistro > 0 && (
                      <circle
                        cx="44" cy="44" r="36" fill="none"
                        stroke="#f59e0b"
                        strokeWidth="10"
                        strokeDasharray={`${(frotaStats.emManutencaoOuSinistro / Math.max(1, frotaStats.total)) * 226.2} 226.2`}
                        strokeLinecap="round"
                        strokeDashoffset={`-${(frotaStats.emLocacao / Math.max(1, frotaStats.total)) * 226.2}`}
                        transform="rotate(-90 44 44)"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-foreground leading-none">{taxaUtilizacao}%</span>
                  </div>
                </div>

                <div className="flex-1 space-y-3 min-w-0">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ocupação da Frota</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs bg-background/50 px-2 py-1 rounded-md">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0"/>Locado
                      </span>
                      <span className="font-black text-emerald-600">{frotaStats.emLocacao} <span className="font-normal text-muted-foreground">/ {frotaStats.total}</span></span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-background/50 px-2 py-1 rounded-md">
                      <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground shrink-0"/>No Pátio
                      </span>
                      <span className="font-bold text-muted-foreground">{frotaStats.disponiveis}</span>
                    </div>
                    {frotaStats.emManutencaoOuSinistro > 0 && (
                      <div className="flex items-center justify-between text-xs bg-background/50 px-2 py-1 rounded-md">
                        <span className="flex items-center gap-1.5 font-semibold text-warning">
                          <span className="h-2.5 w-2.5 rounded-full bg-warning shrink-0"/>Oficina
                        </span>
                        <span className="font-bold text-warning">{frotaStats.emManutencaoOuSinistro}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3. Análise Visual (Gráficos Principais) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Evolução Mensal — ComposedChart com tooltip rico */}
          <Card className="overflow-hidden shadow-sm border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Evolução Mensal: Receitas vs Custos
                </CardTitle>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-semibold flex-wrap mt-1">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"/> Receitas</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"/> Custos Operacionais</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500"/> Custos Fixos</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/30"/> Resultado</span>
              </div>
            </CardHeader>
            <CardContent className="h-[280px] px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={mensalFinanceiroData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02}/>
                    </linearGradient>
                    <linearGradient id="gradCustosVar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02}/>
                    </linearGradient>
                    <linearGradient id="gradCustosFixos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="mes"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "4 4" }}
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      const rec = payload.find((p: any) => p.dataKey === "Receitas")?.value || 0;
                      const cVar = payload.find((p: any) => p.dataKey === "Custos Operacionais")?.value || 0;
                      const cFix = payload.find((p: any) => p.dataKey === "Custos Fixos")?.value || 0;
                      const res = rec - cVar - cFix;
                      return (
                        <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-3 min-w-[200px]">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-500"/>Receitas</span>
                              <span className="text-xs font-black text-emerald-600">R$ {Number(rec).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold"><span className="h-2 w-2 rounded-full bg-amber-500"/>C. Operacionais</span>
                              <span className="text-xs font-black text-amber-500">R$ {Number(cVar).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold"><span className="h-2 w-2 rounded-full bg-rose-500"/>Custos Fixos</span>
                              <span className="text-xs font-black text-rose-500">R$ {Number(cFix).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="border-t border-border pt-1.5 flex items-center justify-between gap-4">
                              <span className="text-xs font-bold text-foreground">Resultado</span>
                              <span className={`text-xs font-black ${res >= 0 ? "text-emerald-600" : "text-rose-500"}`}>R$ {Number(res).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="Custos Operacionais" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="Custos Fixos" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={14} />
                  <Line type="monotone" dataKey="Resultado" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))", stroke: "#background", strokeWidth: 2 }} activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "#background", strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Centro de Custos Operacionais */}
          <CostChart gastosFiltered={gastosFiltered} fmt={fmt} fmtShort={fmtShort} />
        </div>

        {/* 4. Painel de Alertas e Riscos */}
        <div className="pt-2">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-foreground/80">
            <AlertTriangle className="w-5 h-5 text-warning"/> Painel de Alertas e Projeções
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="space-y-4 flex flex-col justify-between">
              {/* Inadimplência */}
              <Card className="hover:shadow-md transition-all border-l-4 border-l-warning">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1 min-w-0">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Inadimplência / Atrasos</p>
                      <h3 className="text-xl font-black text-warning mt-1 truncate">
                        R$ {fmtShort(inadimplenciaStats.valor)}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
                        {inadimplenciaStats.quantidade} fatura(s) — <span className="font-bold text-warning">{inadimplenciaStats.percentual.toFixed(1)}%</span> do faturado
                      </p>
                    </div>
                    <div className="h-10 w-10 shrink-0 bg-warning/10 rounded-full flex items-center justify-center text-warning">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Confiabilidade */}
              <Card className="hover:shadow-md transition-all border-l-4 border-l-info cursor-pointer select-none" onClick={() => setActiveModal("confiabilidade")}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1 min-w-0">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Confiabilidade Contratual</p>
                      <h3 className="text-xl font-black text-info mt-1 truncate">
                        {overallReliability.toFixed(1)}%
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        Faturas Pagas vs Emitido
                      </p>
                    </div>
                    <div className="h-10 w-10 shrink-0 bg-info/10 rounded-full flex items-center justify-center text-info">
                      <Shield className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Previsão de Receita Forecast (Col Span 2) */}
            <Card className="overflow-hidden lg:col-span-2 shadow-sm border-border/50 flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Cashflow Forecast
                  </CardTitle>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Próximos 5 meses</span>
                </div>
                <CardDescription>Projeção baseada em contratos ativos — passe o mouse para ver valores</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-2 pb-2 min-h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                    <XAxis
                      dataKey="mes"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null;
                        const val = payload[0]?.value || 0;
                        return (
                          <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-3 min-w-[180px]">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-xs text-primary font-semibold"><span className="h-2 w-2 rounded-full bg-primary"/>Projeção</span>
                              <span className="text-sm font-black text-primary">R$ {Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="valor"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Rankings and Controls Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top 5 Clients by Revenue */}
          <Card className="hover:shadow-md hover:border-primary/40 cursor-pointer transition-all select-none" onClick={() => setActiveModal("clientes")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Top 5 Clientes (Rentabilidade)
              </CardTitle>
              <CardDescription>Clientes ordenados por nível de rentabilidade real e confiabilidade</CardDescription>
            </CardHeader>
            <CardContent className="p-0 px-6 pb-6">
              <div className="divide-y text-sm">
                {topClientes.map((client, idx) => (
                  <div key={idx} className="flex justify-between items-center py-3 gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-bold text-foreground truncate">{client.nome}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {client.contratosCount} contrato(s) ativo(s) — <span className="font-semibold text-primary">{client.confiabilidade.toFixed(0)}% Pago</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-success block whitespace-nowrap" title="Rentabilidade Real (Margem Líquida)">
                        R$ {Number(client.margem).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-muted-foreground block whitespace-nowrap" title="Total Faturado Pago">
                        Receita: R$ {fmtShort(client.totalPago)}
                      </span>
                    </div>
                  </div>
                ))}
                {topClientes.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum faturamento registrado.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Confiabilidade Contratual Card (Middle) */}
          <Card className="hover:shadow-md hover:border-primary/40 cursor-pointer transition-all select-none" onClick={() => setActiveModal("confiabilidade")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Confiabilidade Contratual
              </CardTitle>
              <CardDescription>Índices de adimplência e cumprimento de faturas</CardDescription>
            </CardHeader>
            <CardContent className="p-0 px-6 pb-6">
              <div className="space-y-4 text-sm">
                {/* Top 3 Confiáveis */}
                <div>
                  <h5 className="text-xs font-bold text-success uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" /> Mais Adimplentes
                  </h5>
                  <div className="divide-y text-xs">
                    {todosClientes.filter(c => c.total > 0).sort((a, b) => b.confiabilidade - a.confiabilidade).slice(0, 3).map((client, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2">
                        <span className="font-semibold truncate max-w-[160px]">{client.nome}</span>
                        <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/10 text-[10px] py-0 px-1.5 font-bold">
                          {client.confiabilidade.toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Bottom 2 Confiáveis */}
                <div className="pt-2 border-t">
                  <h5 className="text-xs font-bold text-destructive uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ArrowDownRight className="h-3 w-3" /> Menos Adimplentes
                  </h5>
                  <div className="divide-y text-xs">
                    {todosClientes.filter(c => c.total > 0).sort((a, b) => a.confiabilidade - b.confiabilidade).slice(0, 2).map((client, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2">
                        <span className="font-semibold truncate max-w-[160px]">{client.nome}</span>
                        <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/10 text-[10px] py-0 px-1.5 font-bold">
                          {client.confiabilidade.toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top 5 Most Profitable Equipments */}
          <Card className="hover:shadow-md hover:border-primary/40 cursor-pointer transition-all select-none" onClick={() => setActiveModal("maquinas")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Máquinas & Rentabilidade Real
              </CardTitle>
              <CardDescription>Equipamentos mais e menos rentáveis apurados no sistema</CardDescription>
            </CardHeader>
            <CardContent className="p-0 px-6 pb-6">
              <div className="space-y-4 text-sm">
                {/* Top 3 Rentáveis */}
                <div>
                  <h5 className="text-xs font-bold text-success uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" /> Mais Rentáveis
                  </h5>
                  <div className="divide-y text-xs">
                    {todosEquipamentos.filter(e => rentedEquipamentosIds.has(e.id)).slice(0, 3).map((equip, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2">
                        <div className="truncate max-w-[160px]">
                          <span className="font-semibold">{equip.nome}</span>
                          <p className="text-[9px] text-muted-foreground">Placa: {equip.tag}</p>
                        </div>
                        <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/10 text-[10px] py-0 px-1.5 font-bold" title={`${equip.percentual.toFixed(1)}% de Margem`}>
                          R$ {fmtShort(equip.margem)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Bottom 2 Rentáveis */}
                <div className="pt-2 border-t">
                  <h5 className="text-xs font-bold text-destructive uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ArrowDownRight className="h-3 w-3" /> Menos Rentáveis / Ociosas
                  </h5>
                  <div className="divide-y text-xs">
                    {todosEquipamentos.slice().reverse().slice(0, 2).map((equip, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2">
                        <div className="truncate max-w-[160px]">
                          <span className="font-semibold">{equip.nome}</span>
                          <p className="text-[9px] text-muted-foreground">Placa: {equip.tag}</p>
                        </div>
                        <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/10 text-[10px] py-0 px-1.5 font-bold" title={`${equip.percentual.toFixed(1)}% de Margem`}>
                          R$ {fmtShort(equip.margem)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Audit / Alerts Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Insurance Alert */}
          <Card className="bg-destructive/5 border-destructive/20 hover:bg-destructive/10 hover:border-destructive/40 cursor-pointer transition-all select-none" onClick={() => setActiveModal("seguros")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-destructive flex items-center gap-2">
                <Shield className="h-4 w-4 text-destructive" />
                Auditoria de Riscos: Sem Seguro Ativo
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              <p className="text-muted-foreground mb-3">
                Equipamentos atualmente alocados que não possuem apólice de seguro ativa.
              </p>
              {equipSemSeguro.length > 0 ? (
                <div className="max-h-[120px] overflow-y-auto space-y-1.5 border rounded-lg p-2.5 bg-background">
                  {equipSemSeguro.map((eq, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b last:border-0">
                      <span className="font-bold text-foreground">{eq.tipo} {eq.modelo}</span>
                      <span className="text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{eq.tag_placa || "Sem Placa"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 border border-success/20 rounded-lg bg-success/10 text-success font-semibold text-center">
                  ✓ Todos os equipamentos alocados têm cobertura de seguro.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Renovations Alert */}
          <Card className="bg-warning/5 border-warning/20 hover:bg-warning/10 hover:border-warning/40 cursor-pointer transition-all select-none" onClick={() => setActiveModal("vencimentos")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-warning flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-warning" />
                Renovações Críticas: Vencer (&lt;30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              <p className="text-muted-foreground mb-3">
                Contratos ativos que expiram nos próximos 30 dias e exigem negociação.
              </p>
              {todosContratosAVencer.length > 0 ? (
                <div className="max-h-[120px] overflow-y-auto space-y-1.5 border rounded-lg p-2.5 bg-background">
                  {todosContratosAVencer.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b last:border-0">
                      <span className="font-bold text-foreground truncate max-w-[200px]">{c.empresas?.nome}</span>
                      <span className="text-warning font-semibold">{parseLocalDate(c.data_fim).toLocaleDateString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 border border-success/20 rounded-lg bg-success/10 text-success font-semibold text-center">
                  ✓ Sem contratos expirando nos próximos 30 dias.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerta de Ociosidade */}
          <Card className="bg-warning/5 border-warning/20 hover:bg-warning/10 hover:border-warning/40 select-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-warning flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Alerta de Ociosidade & Manutenção
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              <p className="text-muted-foreground mb-3">
                Equipamentos parados ou em manutenção gerando custos operacionais.
              </p>
              {equipamentos.filter(e => e.status !== "Ativo").length > 0 ? (
                <div className="max-h-[120px] overflow-y-auto space-y-1.5 border rounded-lg p-2.5 bg-background">
                  {equipamentos.filter(e => e.status !== "Ativo").slice(0, 4).map((eq) => (
                    <div key={eq.id} className="flex justify-between items-center py-1 border-b last:border-0">
                      <span className="font-bold text-foreground truncate max-w-[140px]">{eq.tipo} {eq.modelo}</span>
                      <span className="text-destructive font-semibold text-[10px]">{eq.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 border border-success/20 rounded-lg bg-success/10 text-success font-semibold text-center">
                  ✓ Toda a frota está ativa e operando!
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Insight Box */}
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold text-primary mb-1">Insight do Cockpit:</p>
            <p className="text-foreground leading-relaxed">
              Sua frota está com <strong className="text-primary">{taxaUtilizacao}%</strong> de ocupação ({frotaStats.emLocacao} locadas de {frotaStats.total} disponíveis).
              {frotaStats.emManutencaoOuSinistro > 0 && (
                <> <span className="text-warning font-semibold">{frotaStats.emManutencaoOuSinistro} equipamento(s)</span> em manutenção ou sinistro estão gerando custos sem gerar receita.</>
              )}
              {frotaStats.disponiveis > 0 && (
                <> <span className="text-muted-foreground font-semibold">{frotaStats.disponiveis} disponível(is) no pátio</span> sem utilização.</>
              )}
              {' '}Fique atento aos contratos a vencer para garantir a receita projetada de{' '}
              <strong className="text-primary">R$ {fmtShort(forecastData[1]?.valor || 0)}</strong> para o próximo mês.
            </p>
          </div>
        </div>

        {/* Quick Access Grid */}
        <div className="pt-4 border-t">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Painel de Acesso Rápido aos Módulos</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
            <button onClick={() => navigate("/equipamentos")} className="flex flex-col items-center justify-center p-3 border rounded-xl bg-card hover:bg-muted/50 transition-all gap-1.5 group">
              <Truck className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold">Frota</span>
            </button>
            <button onClick={() => navigate("/empresas")} className="flex flex-col items-center justify-center p-3 border rounded-xl bg-card hover:bg-muted/50 transition-all gap-1.5 group">
              <Building2 className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold">Clientes</span>
            </button>
            <button onClick={() => navigate("/contratos?tab=contratos")} className="flex flex-col items-center justify-center p-3 border rounded-xl bg-card hover:bg-muted/50 transition-all gap-1.5 group">
              <FileText className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold">Contratos</span>
            </button>
            <button onClick={() => navigate("/apolices?tab=apolices")} className="flex flex-col items-center justify-center p-3 border rounded-xl bg-card hover:bg-muted/50 transition-all gap-1.5 group">
              <Shield className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold">Seguros</span>
            </button>
            <button onClick={() => navigate("/medicoes?tab=medicoes")} className="flex flex-col items-center justify-center p-3 border rounded-xl bg-card hover:bg-muted/50 transition-all gap-1.5 group">
              <Clock className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold">Horímetro</span>
            </button>
            <button onClick={() => navigate("/medicoes?tab=faturamento")} className="flex flex-col items-center justify-center p-3 border rounded-xl bg-card hover:bg-muted/50 transition-all gap-1.5 group">
              <Receipt className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold whitespace-nowrap">Emitir medição</span>
            </button>
            <button onClick={() => navigate("/medicoes?tab=faturamento-novo")} className="flex flex-col items-center justify-center p-3 border rounded-xl bg-card hover:bg-muted/50 transition-all gap-1.5 group">
              <DollarSign className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold whitespace-nowrap">Emissão de faturas</span>
            </button>
            <button onClick={() => navigate("/medicoes?tab=historico-faturamento")} className="flex flex-col items-center justify-center p-3 border rounded-xl bg-card hover:bg-muted/50 transition-all gap-1.5 group">
              <BarChart3 className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold whitespace-nowrap">Histórico Financeiro</span>
            </button>
            <button onClick={() => navigate("/gastos")} className="flex flex-col items-center justify-center p-3 border rounded-xl bg-card hover:bg-muted/50 transition-all gap-1.5 group">
              <DollarSign className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold">Custos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dialogs for detailing info from clicked cards */}
      {/* 1. Clientes Modal */}
      <Dialog open={activeModal === "clientes"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Detalhamento de Faturamento e Custos por Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto flex-1 pr-1">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                <TableRow>
                  <TableHead className="w-12 text-center bg-background">Posição</TableHead>
                  <TableHead className="bg-background">Cliente / Empresa</TableHead>
                  <TableHead className="text-center bg-background">Contratos Ativos</TableHead>
                  <TableHead className="text-right bg-background">Total Faturado</TableHead>
                  <TableHead className="text-right text-destructive bg-background">Custo Real</TableHead>
                  <TableHead className="text-right bg-background">Margem Líquida</TableHead>
                  <TableHead className="text-right bg-background">Rentabilidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todosClientes.map((client, idx) => {
                  const isPositive = client.margem >= 0;
                  return (
                    <TableRow key={idx} className="hover:bg-muted/30">
                      <TableCell className="text-center font-bold text-muted-foreground">#{idx + 1}</TableCell>
                      <TableCell className="font-semibold">{client.nome}</TableCell>
                      <TableCell className="text-center">{client.contratosCount}</TableCell>
                      <TableCell className="text-right font-bold text-success">
                        R$ {Number(client.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-destructive font-semibold">
                        R$ {Number(client.despesa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${isPositive ? "text-success" : "text-destructive"}`}>
                        R$ {Number(client.margem).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={isPositive ? "bg-success/15 text-success hover:bg-success/20 border-success/10" : "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/10"}>
                          {isPositive ? "▲" : "▼"} {client.percentual.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {todosClientes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">Nenhum faturamento registrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Máquinas Modal */}
      <Dialog open={activeModal === "maquinas"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Detalhamento de Faturamento e Custos por Máquina (Real)
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto flex-1 pr-1">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                <TableRow>
                  <TableHead className="w-12 text-center bg-background">Posição</TableHead>
                  <TableHead className="bg-background">Equipamento</TableHead>
                  <TableHead className="bg-background">Placa</TableHead>
                  <TableHead className="bg-background">Status</TableHead>
                  <TableHead className="text-right bg-background">Faturamento Real</TableHead>
                  <TableHead className="text-right text-destructive bg-background">Custo Real</TableHead>
                  <TableHead className="text-right bg-background">Margem Líquida</TableHead>
                  <TableHead className="text-right bg-background">Rentabilidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todosEquipamentos.map((equip, idx) => {
                  const isPositive = equip.margem >= 0;
                  return (
                    <TableRow key={idx} className="hover:bg-muted/30">
                      <TableCell className="text-center font-bold text-muted-foreground">#{idx + 1}</TableCell>
                      <TableCell className="font-semibold">{equip.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{equip.tag}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/20 text-primary">
                          {equip.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                        R$ {equip.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-destructive font-semibold">
                        R$ {equip.despesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${isPositive ? "text-success" : "text-destructive"}`}>
                        R$ {equip.margem.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={isPositive ? "bg-success/15 text-success hover:bg-success/20 border-success/10" : "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/10"}>
                          {isPositive ? "▲" : "▼"} {equip.percentual.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {todosEquipamentos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">Nenhum faturamento de equipamento registrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Seguros Modal */}
      <Dialog open={activeModal === "seguros"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5 text-destructive" />
              Equipamentos sem Seguro Ativo
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto flex-1 pr-1">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                <TableRow>
                  <TableHead className="bg-background">Equipamento</TableHead>
                  <TableHead className="bg-background">Placa / Identificação</TableHead>
                  <TableHead className="bg-background">Status Operacional</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipSemSeguro.map((eq, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold">{eq.tipo} {eq.modelo}</TableCell>
                    <TableCell className="font-mono text-xs bg-muted/30 px-2 py-0.5 rounded w-fit">{eq.tag_placa || "Sem Placa"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] px-2 py-0 border-destructive/20 text-destructive">
                        {eq.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {equipSemSeguro.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-success font-semibold">
                      ✓ Todos os equipamentos alocados estão devidamente cobertos por seguros vigentes.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Vencimentos Modal */}
      <Dialog open={activeModal === "vencimentos"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <CalendarClock className="h-5 w-5 text-warning" />
              Contratos a Vencer nos Próximos 30 Dias
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto flex-1 pr-1">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                <TableRow>
                  <TableHead className="bg-background">Empresa / Cliente</TableHead>
                  <TableHead className="bg-background">Data de Início</TableHead>
                  <TableHead className="bg-background">Data de Fim (Expiração)</TableHead>
                  <TableHead className="bg-background">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todosContratosAVencer.map((c, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold">{c.empresas?.nome}</TableCell>
                    <TableCell>{parseLocalDate(c.data_inicio).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-bold text-warning">{parseLocalDate(c.data_fim).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] px-2 py-0 border-warning/20 text-warning">
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {todosContratosAVencer.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-success font-semibold">
                      ✓ Nenhuma renovação de contrato necessária nos próximos 30 dias.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. Confiabilidade Modal */}
      <Dialog open={activeModal === "confiabilidade"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Detalhamento de Confiabilidade Contratual por Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto flex-1 pr-1">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                <TableRow>
                  <TableHead className="w-12 text-center bg-background">Posição</TableHead>
                  <TableHead className="bg-background">Cliente / Empresa</TableHead>
                  <TableHead className="text-center bg-background">Contratos Ativos</TableHead>
                  <TableHead className="text-right bg-background">Faturamento Emitido</TableHead>
                  <TableHead className="text-right bg-background text-success">Faturamento Recebido</TableHead>
                  <TableHead className="text-right bg-background text-destructive">Em Aberto / Atrasado</TableHead>
                  <TableHead className="text-center bg-background">Confiabilidade de Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todosClientes.slice().sort((a, b) => b.confiabilidade - a.confiabilidade).map((client, idx) => {
                  const emAberto = client.total - client.totalPago;
                  const isReliable = client.confiabilidade >= 90;
                  const isMediumReliable = client.confiabilidade >= 70;
                  return (
                    <TableRow key={idx} className="hover:bg-muted/30">
                      <TableCell className="text-center font-bold text-muted-foreground">#{idx + 1}</TableCell>
                      <TableCell className="font-semibold">{client.nome}</TableCell>
                      <TableCell className="text-center">{client.contratosCount}</TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {Number(client.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                        R$ {Number(client.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        R$ {emAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={
                          isReliable 
                            ? "bg-success/15 text-success hover:bg-success/20 border-success/10" 
                            : isMediumReliable 
                              ? "bg-warning/15 text-warning hover:bg-warning/20 border-warning/10" 
                              : "bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/10"
                        }>
                          {client.confiabilidade.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {todosClientes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">Nenhum faturamento registrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
      {/* 6. Faturamento Detalhes Modal */}
      <Dialog open={activeModal === "faturamento_detalhes"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <DollarSign className="h-5 w-5" />
              Detalhamento de Faturamento no Período
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto flex-1 pr-1">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                <TableRow>
                  <TableHead className="bg-background">Fatura</TableHead>
                  <TableHead className="bg-background">Cliente / Contrato</TableHead>
                  <TableHead className="bg-background">Emissão</TableHead>
                  <TableHead className="bg-background">Status</TableHead>
                  <TableHead className="text-right bg-background">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturasFiltered.map((fatura, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{fatura.numero_fatura || `FAT-${fatura.id?.substring(0,6)}`}</TableCell>
                    <TableCell className="font-semibold">{fatura.contratos?.empresas?.nome || "Não informado"}</TableCell>
                    <TableCell>{parseLocalDate(fatura.data_emissao).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        fatura.status === "Pago" ? "border-success/20 text-success bg-success/10" : 
                        fatura.status === "Atrasado" ? "border-destructive/20 text-destructive bg-destructive/10" : 
                        "border-warning/20 text-warning bg-warning/10"
                      }>
                        {fatura.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-black text-primary">
                      R$ {Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                {faturasFiltered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhuma fatura no período selecionado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 7. EBITDA Detalhes Modal */}
      <Dialog open={activeModal === "ebitda_detalhes"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Target className="h-5 w-5" />
              Demonstrativo de Resultado (EBITDA)
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto flex-1 pr-1 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-xs font-bold text-emerald-600 uppercase">Receita Bruta</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">R$ {fmt(totalFaturado)}</h3>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                <p className="text-xs font-bold text-rose-600 uppercase">Custos e Despesas</p>
                <h3 className="text-2xl font-black text-rose-600 mt-1">R$ {fmt(totalGastos)}</h3>
              </div>
              <div className={`border rounded-xl p-4 ${margemGeral >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'}`}>
                <p className={`text-xs font-bold uppercase ${margemGeral >= 0 ? 'text-primary' : 'text-destructive'}`}>EBITDA Acumulado</p>
                <h3 className={`text-2xl font-black mt-1 ${margemGeral >= 0 ? 'text-primary' : 'text-destructive'}`}>R$ {fmt(totalFaturado - totalGastos)}</h3>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50 rounded-t-lg">
                  <TableRow>
                    <TableHead className="font-bold">Categoria</TableHead>
                    <TableHead className="font-bold">Tipo</TableHead>
                    <TableHead className="text-right font-bold">Valor Consolidado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                    <TableCell className="font-bold text-emerald-600">Faturamento Operacional</TableCell>
                    <TableCell className="text-emerald-600">Receitas</TableCell>
                    <TableCell className="text-right font-black text-emerald-600">R$ {fmt(totalFaturado)}</TableCell>
                  </TableRow>
                  {Object.entries(
                    gastosFiltered.reduce((acc, g) => {
                      const t = g.tipo || "Outros";
                      acc[t] = (acc[t] || 0) + Number(g.valor);
                      return acc;
                    }, {} as Record<string, number>)
                  ).sort((a, b) => b[1] - a[1]).map(([tipo, valor], idx) => (
                    <TableRow key={idx} className="hover:bg-rose-500/5 transition-colors">
                      <TableCell className="font-semibold text-foreground/80">{tipo}</TableCell>
                      <TableCell className="text-muted-foreground">{tipo === "Custo Fixo" ? "Fixo" : "Variável"}</TableCell>
                      <TableCell className="text-right font-bold text-rose-500">- R$ {fmt(valor as number)}</TableCell>
                    </TableRow>
                  ))}
                  {gastosFiltered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Nenhum custo registrado no período.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 8. Frota Detalhes Modal */}
      <Dialog open={activeModal === "frota_detalhes"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Truck className="h-5 w-5 text-accent-foreground" />
              Detalhamento de Ocupação da Frota
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto flex-1 pr-1">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                <TableRow>
                  <TableHead className="bg-background">Equipamento</TableHead>
                  <TableHead className="bg-background">Placa / Tag</TableHead>
                  <TableHead className="bg-background">Categoria</TableHead>
                  <TableHead className="bg-background">Status Atual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipamentos.map((eq, idx) => {
                  let statusClass = "border-muted text-muted-foreground bg-muted/10";
                  if (eq.status === "Em Locação") statusClass = "border-emerald-500/20 text-emerald-600 bg-emerald-500/10";
                  else if (eq.status === "Disponível") statusClass = "border-foreground/20 text-foreground/80 bg-background";
                  else if (eq.status === "Em Manutenção" || eq.status === "Sinistro") statusClass = "border-warning/20 text-warning bg-warning/10";
                  
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-bold">{eq.modelo}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{eq.tag_placa || "Sem placa"}</TableCell>
                      <TableCell className="text-muted-foreground">{eq.tipo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass}>
                          {eq.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
