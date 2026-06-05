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
  Wrench, FileText, Activity, BarChart3, PieChart, CalendarClock, Shield, Truck,
  Target, Zap, ArrowUpRight, ArrowDownRight, Info, Receipt
} from "lucide-react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, AreaChart, Area
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
    }).sort((a, b) => b.percentual - a.percentual);
  }, [equipamentos, faturas, gastos, contratos]);

  const totalFaturado = faturasFiltered.filter(f => f.status === "Pago").reduce((s: number, f: any) => s + Number(f.valor_total), 0);
  const totalGastos = gastosFiltered.reduce((s: number, g: any) => s + Number(g.valor), 0);
  const margemGeral = totalFaturado > 0 ? ((totalFaturado - totalGastos) / totalFaturado) * 100 : 0;

  const equipAtivos = equipamentos.filter(e => e.status === "Ativo").length;
  const taxaUtilizacao = equipamentos.length > 0 ? Math.round((equipAtivos / equipamentos.length) * 100) : 0;

  // ============ ADVANCED BI CALCULATIONS ============
  const mensalFinanceiroData = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const monthKey = d.toISOString().slice(0, 7);
      
      const receitasMes = faturas
        .filter(f => f && f.emissao && typeof f.emissao === "string" && f.emissao.slice(0, 7) === monthKey)
        .reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
        
      const custosMes = gastos
        .filter(g => g && g.data && typeof g.data === "string" && g.data.slice(0, 7) === monthKey)
        .reduce((sum, g) => sum + Number(g.valor || 0), 0);
        
      result.push({
        mes: label,
        "Receitas": receitasMes,
        "Custos": custosMes,
        "Resultado": receitasMes - custosMes
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

    return Array.from(map.values()).sort((a, b) => b.percentual - a.percentual);
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
      const despesa = eqGastos.reduce((s, g) => s + Number(g.valor), 0);
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
    }).sort((a, b) => b.percentual - a.percentual);
  }, [equipamentos, faturamentoPorEquipamento, gastos, activeContratoIds, faturamentoGastos, faturas, contratos, contratosEquipamentos]);

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
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/10">
          <div>
            <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary animate-pulse" />
              Cockpit Executivo & B.I.
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Análise macro-estratégica, eficiência operacional e indicadores financeiros integrados em tempo real.
            </p>
          </div>
          <div className="bg-background px-4 py-2 rounded-xl shadow-sm border text-xs font-semibold text-muted-foreground flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success animate-ping"></span>
            Dados Consolidados em Tempo Real
          </div>
        </div>

        {/* Premium BI KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* KPI 1: Yield Operacional */}
          <Card className="hover:shadow-md transition-all border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Yield Operacional / Máq</p>
                  <h3 className="text-2xl font-black text-foreground mt-2">
                    R$ {fmt(totalFaturado / Math.max(1, frotaStats.emLocacao))}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    Faturamento total dividido por {frotaStats.emLocacao} locados
                  </p>
                </div>
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI 2: EBITDA / Resultado Líquido */}
          <Card className="hover:shadow-md transition-all border-l-4 border-l-success">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Resultado da Operação</p>
                  <h3 className="text-2xl font-black text-success mt-2">
                    R$ {fmt(totalFaturado - totalGastos)}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    Margem EBITDA: <span className="font-bold text-success">{margemGeral.toFixed(1)}%</span>
                  </p>
                </div>
                <div className="h-10 w-10 bg-success/10 rounded-xl flex items-center justify-center text-success">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI 3: Inadimplência */}
          <Card className="hover:shadow-md transition-all border-l-4 border-l-warning">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Inadimplência / Atrasos</p>
                  <h3 className="text-2xl font-black text-warning mt-2">
                    R$ {fmtShort(inadimplenciaStats.valor)}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    {inadimplenciaStats.quantidade} fatura(s) — <span className="font-bold text-warning">{inadimplenciaStats.percentual.toFixed(1)}%</span> do faturado
                  </p>
                </div>
                <div className="h-10 w-10 bg-warning/10 rounded-xl flex items-center justify-center text-warning">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI 4: Confiabilidade Contratual */}
          <Card className="hover:shadow-md transition-all border-l-4 border-l-info cursor-pointer select-none" onClick={() => setActiveModal("confiabilidade")}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confiabilidade Contratual</p>
                  <h3 className="text-2xl font-black text-info mt-2">
                    {overallReliability.toFixed(1)}%
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Faturas Pagas vs Emitido Geral
                  </p>
                </div>
                <div className="h-10 w-10 bg-info/10 rounded-xl flex items-center justify-center text-info">
                  <Shield className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI 5: Taxa de Ocupação da Frota */}
          <Card className="hover:shadow-md transition-all border-l-4 border-l-accent">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ocupação da Frota</p>
                  <h3 className="text-2xl font-black text-foreground mt-2">
                    {taxaUtilizacao}%
                  </h3>
                  <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${taxaUtilizacao}%` }} />
                  </div>
                </div>
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Truck className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Projections Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evolução Mensal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Evolução Mensal: Receitas vs Custos
              </CardTitle>
              <CardDescription>Consolidado dos últimos 6 meses com saldo EBITDA</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mensalFinanceiroData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCustos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" fontSize={11} tickLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtShort} />
                  <Tooltip 
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString("pt-BR")}`, ""]}
                    contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Area type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReceitas)" />
                  <Area type="monotone" dataKey="Custos" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCustos)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Previsão de Receita Forecast */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Previsão de Receita (Cashflow Forecast)
              </CardTitle>
              <CardDescription>Baseado em contratos ativos e recorrentes</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            </CardContent>
          </Card>

          {/* Centro de Custos Operacionais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Centro de Custos Operacionais
              </CardTitle>
              <CardDescription>Distribuição de gastos por categoria</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={useMemo(() => {
                  const map: Record<string, number> = {};
                  gastosFiltered.forEach(g => { map[g.tipo] = (map[g.tipo] || 0) + Number(g.valor); });
                  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
                }, [gastosFiltered])} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="name" className="text-[10px]" axisLine={false} tickLine={false} />
                  <YAxis className="text-[10px]" axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${fmtShort(v)}`} />
                  <Tooltip formatter={(v: number) => [`R$ ${fmt(v)}`, "Gasto"]} />
                  <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Operacional da Frota */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Status Operacional da Frota
              </CardTitle>
              <CardDescription>Distribuição física dos {frotaStats.total} equipamentos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary inline-block"></span>Em Locação Ativa</span>
                  <span className="font-bold text-muted-foreground">{frotaStats.emLocacao} un. ({Math.round(frotaStats.emLocacao / Math.max(1, frotaStats.total) * 100)}%)</span>
                </div>
                <Progress value={(frotaStats.emLocacao / Math.max(1, frotaStats.total)) * 100} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success inline-block"></span>Disponível para Pátio</span>
                  <span className="font-bold text-muted-foreground">{frotaStats.disponiveis} un. ({Math.round(frotaStats.disponiveis / Math.max(1, frotaStats.total) * 100)}%)</span>
                </div>
                <Progress value={(frotaStats.disponiveis / Math.max(1, frotaStats.total)) * 100} className="h-2 bg-success/10" style={{ transform: "translateZ(0)" }} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning inline-block"></span>Manutenção / Sinistros</span>
                  <span className="font-bold text-muted-foreground">{frotaStats.emManutencaoOuSinistro} un. ({Math.round(frotaStats.emManutencaoOuSinistro / Math.max(1, frotaStats.total) * 100)}%)</span>
                </div>
                <Progress value={(frotaStats.emManutencaoOuSinistro / Math.max(1, frotaStats.total)) * 100} className="h-2 bg-warning/10" />
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Média de Contratos Ativos:</span>
                  <span className="font-bold text-foreground">{contratosStats.ativos} contratos</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Custo Fixo de Apólices/Mês:</span>
                  <span className="font-bold text-foreground">R$ {fmt(apolicesStats.totalMensal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <div key={idx} className="flex justify-between items-center py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-foreground truncate max-w-[180px] md:max-w-[240px]">{client.nome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {client.contratosCount} contrato(s) ativo(s) — <span className="font-semibold text-primary">{client.confiabilidade.toFixed(0)}% Pago</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-success block">
                        R$ {Number(client.totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Emitido: R$ {fmtShort(client.total)}
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
                        <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/10 text-[10px] py-0 px-1.5 font-bold">
                          {equip.percentual.toFixed(1)}%
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
                        <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/10 text-[10px] py-0 px-1.5 font-bold">
                          {equip.percentual.toFixed(1)}%
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
    </div>
  );
};
