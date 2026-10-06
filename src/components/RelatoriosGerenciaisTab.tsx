import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, DollarSign, Calendar, FileDown, ArrowUpRight, ArrowDownRight,
  TrendingDown, Percent, BarChart3, AlertCircle, Clock, FileText, Wrench, Activity,
  Gauge, Timer, CheckCircle2, XCircle, AlertTriangle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend
} from "recharts";
import { generateDrePdf } from "@/lib/dreExportUtils";

interface RelatoriosGerenciaisTabProps {
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
  despesasAdministrativas?: Array<any>;
  globalEmpresaId?: string;
  globalEquipamentoId?: string;
  globalDataInicio?: string;
  globalDataFim?: string;
}

export const RelatoriosGerenciaisTab = ({
  empresas,
  contratos,
  faturas,
  equipamentos,
  gastos,
  medicoes,
  apolices = [],
  apolicesEquipamentos = [],
  contratosEquipamentos = [],
  faturamentoGastos = [],
  despesasAdministrativas = [],
  globalEmpresaId = "all",
  globalEquipamentoId = "all",
  globalDataInicio = "",
  globalDataFim = ""
}: RelatoriosGerenciaisTabProps) => {
  // Filtros
  const [faturamentoEquipamentosList, setFaturamentoEquipamentosList] = useState<any[]>([]);

  // Modais de detalhamento
  const [dreDetailModal, setDreDetailModal] = useState<{ isOpen: boolean; type: "receitaBruta" | "custoManutencao" | "custoMobilizacao" | "custoFixo" | "custoOutros" | "despesasAdmin" | null; title: string; }>({ isOpen: false, type: null, title: "" });
  const [rentabilidadeDetailModal, setRentabilidadeDetailModal] = useState<{ isOpen: boolean; equipId: string | null; }>({ isOpen: false, equipId: null });
  const [horasDetailModal, setHorasDetailModal] = useState<{ isOpen: boolean; equipId: string | null; }>({ isOpen: false, equipId: null });

  useEffect(() => {
    const loadFaturamentoEquipamentos = async () => {
      const { data } = await supabase.from("faturamento_equipamentos").select("*");
      if (data) setFaturamentoEquipamentosList(data);
    };
    loadFaturamentoEquipamentos();
  }, []);

  const fmt = (v: any) => {
    const val = Number(v);
    if (isNaN(val)) return "0,00";
    return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseLocalDate = (dateStr: any): Date => {
    if (!dateStr) return new Date(NaN);
    const str = String(dateStr).trim();
    const d = str.includes("T") ? new Date(str) : new Date(str + "T00:00:00");
    return d;
  };

  // 1. Filtrar Faturas e Gastos
  const faturasFiltradas = useMemo(() => {
    return faturas.filter(f => {
      const emissao = f.emissao || f.data_aprovacao || f.created_at || "";
      if (!emissao) return false;
      if (globalDataInicio && emissao < globalDataInicio) return false;
      if (globalDataFim && emissao > globalDataFim) return false;
      
      const ct = contratos.find(c => c.id === f.contrato_id);
      if (globalEmpresaId !== "all" && ct?.empresa_id !== globalEmpresaId) return false;
      if (globalEquipamentoId !== "all" && ct?.equipamento_id !== globalEquipamentoId) return false;
      
      return true;
    });
  }, [faturas, globalDataInicio, globalDataFim, globalEmpresaId, globalEquipamentoId, contratos]);

  const gastosFiltrados = useMemo(() => {
    // Map gastos to their invoice fatura if linked via faturamentoGastos
    const gastoToFaturaMap = new Map<string, string>();
    (faturamentoGastos || []).forEach(fg => {
      if (fg.gasto_id && fg.faturamento_id) {
        gastoToFaturaMap.set(fg.gasto_id, fg.faturamento_id);
      }
    });

    return gastos.filter(g => {
      // Regras de classificação:
      // - "A Cobrar do Cliente" / "Cobrado do Cliente": cliente paga = NOT meu custo = remove
      // - "Não Cobrado": registro histórico sem cobrança = NOT meu custo = remove
      // - "Custo Assumido" / "Custo Interno": empresa pagou = inclui
      // - "A Reembolsar ao Cliente": empresa pagou mas cobra cliente = inclui
      // - sem classificação: tratado como custo da empresa por precaução = inclui
      const classif = g.classificacao || "";
      if (
        classif === "A Cobrar do Cliente" ||
        classif === "Cobrado do Cliente" ||
        classif === "Não Cobrado"
      ) return false;

      if (!g.data) return false;
      if (globalDataInicio && g.data < globalDataInicio) return false;
      if (globalDataFim && g.data > globalDataFim) return false;

      // Filter by machine
      if (globalEquipamentoId !== "all" && g.equipamento_id !== globalEquipamentoId) return false;

      // Filter by client
      if (globalEmpresaId !== "all") {
        const faturaId = gastoToFaturaMap.get(g.id);
        if (faturaId) {
          const fatura = faturas.find(f => f.id === faturaId);
          const ct = fatura ? contratos.find(c => c.id === fatura.contrato_id) : null;
          if (ct?.empresa_id !== globalEmpresaId) return false;
        } else {
          // If not linked to a specific invoice, find if machine was allocated to this client on that date
          const allocated = (contratosEquipamentos || []).some((ce: any) => {
            const ct = contratos.find(c => c.id === ce.contrato_id);
            if (ct?.empresa_id !== globalEmpresaId || ce.equipamento_id !== g.equipamento_id) return false;
            const start = ce.data_inicio || ct.data_inicio || "1970-01-01";
            const end = ce.data_devolucao || ct.data_fim || "9999-12-31";
            return g.data >= start && g.data <= end;
          });
          if (!allocated) return false;
        }
      }

      return true;
    });
  }, [gastos, globalDataInicio, globalDataFim, globalEmpresaId, globalEquipamentoId, faturas, contratos, faturamentoGastos, contratosEquipamentos]);

  // 2. DRE Operacional
  const dreStats = useMemo(() => {
    const faturasReceita = faturasFiltradas.filter(f => f.status === "Pago" || f.status === "Aprovado");
    const receitaBruta = faturasReceita.reduce((sum, f) => sum + Number(f.valor_total || 0), 0);

    const tiposFixos = ["Seguro Patrimonial", "Rastreadores / Telecom", "Parcelas e Financiamentos"];
    const tiposManutencao = ["Manutenção", "Peças", "Combustível"];
    const tiposMobilizacao = ["Mobilização", "Desmobilização"];

    const gastosManutencao = gastosFiltrados.filter(g => tiposManutencao.includes(g.tipo));
    const custoManutencao = gastosManutencao.reduce((sum, g) => sum + Number(g.valor || 0), 0);

    // Mobilização/Desmobilização: NÃO entra como custo apenas se for "Cobrado do Cliente" ou "Não Cobrado"
    // Custo Assumido, A Reembolsar ao Cliente e sem classificação = custo real da empresa
    const gastosMobilizacao = gastosFiltrados.filter(g =>
      tiposMobilizacao.includes(g.tipo) &&
      g.classificacao !== "Cobrado do Cliente" &&
      g.classificacao !== "Não Cobrado"
    );
    const custoMobilizacao = gastosMobilizacao.reduce((sum, g) => sum + Number(g.valor || 0), 0);

    const gastosFixo = gastosFiltrados.filter(g => tiposFixos.includes(g.tipo));
    const custoFixo = gastosFixo.reduce((sum, g) => sum + Number(g.valor || 0), 0);

    // Outros: exclui qualquer gasto marcado como "Cobrado do Cliente" ou "Não Cobrado"
    const gastosOutros = gastosFiltrados.filter(g =>
      !tiposManutencao.includes(g.tipo) &&
      !tiposMobilizacao.includes(g.tipo) &&
      !tiposFixos.includes(g.tipo) &&
      g.classificacao !== "Cobrado do Cliente" &&
      g.classificacao !== "Não Cobrado"
    );
    const custoOutros = gastosOutros.reduce((sum, g) => sum + Number(g.valor || 0), 0);

    const totalCustosDiretos = custoManutencao + custoMobilizacao + custoFixo + custoOutros;
    const lucroBruto = receitaBruta - totalCustosDiretos;

    // Controladoria (Despesas Administrativas)
    const despesasAdminFiltradas = despesasAdministrativas.filter(d => {
      if (!d.data_vencimento) return false;
      if (globalDataInicio && d.data_vencimento < globalDataInicio) return false;
      if (globalDataFim && d.data_vencimento > globalDataFim) return false;
      return true;
    });
    const totalDespesasAdmin = despesasAdminFiltradas.reduce((sum, d) => sum + Number(d.valor || 0), 0);

    const totalCustosGerais = totalCustosDiretos + totalDespesasAdmin;
    const resultadoEbitda = receitaBruta - totalCustosGerais;
    const margemEbitda = receitaBruta > 0 ? (resultadoEbitda / receitaBruta) * 100 : 0;

    return {
      receitaBruta, faturasReceita,
      custoManutencao, gastosManutencao,
      custoMobilizacao, gastosMobilizacao,
      custoFixo, gastosFixo,
      custoOutros, gastosOutros,
      totalCustos: totalCustosDiretos,
      totalDespesasAdmin, despesasAdminFiltradas,
      lucroBruto,
      resultadoEbitda,
      margemEbitda
    };
  }, [faturasFiltradas, gastosFiltrados, despesasAdministrativas, globalDataInicio, globalDataFim]);

  // 3. Rentabilidade por Equipamento
  const rentabilidadeEquipamentos = useMemo(() => {
    return equipamentos.map(eq => {
      // Find all items in faturamento_equipamentos for this machine
      const eqItems = faturamentoEquipamentosList.filter(item => item.equipamento_id === eq.id);
      
      // Filter items whose parent faturamento matches our active filters (faturasFiltradas)
      // and is Pago or Aprovado
      let receita = 0;
      let faturasReceita: any[] = [];
      eqItems.forEach(item => {
        const fat = faturasFiltradas.find(f => f.id === item.faturamento_id && (f.status === "Pago" || f.status === "Aprovado"));
        if (fat) {
          const horasNormais = Number(item.horas_normais ?? item.horas_medidas ?? 0);
          const valorHora = Number(item.valor_hora ?? 0);
          const horasExcedentes = Number(item.horas_excedentes ?? 0);
          const valorHoraExcedente = Number(item.valor_hora_excedente ?? item.valor_excedente_hora ?? 0);
          
          const totalItem = (horasNormais * valorHora) + (horasExcedentes * valorHoraExcedente);
          receita += totalItem;
          faturasReceita.push({
            faturaId: fat.id,
            numero_nota: fat.numero_nota,
            periodo: fat.periodo,
            valor_original: fat.valor_total,
            valor_atribuido: totalItem,
            cliente: contratos.find(c => c.id === fat.contrato_id)?.empresas?.nome || "Desconhecido"
          });
        }
      });

      // Fallback to contract association if there are no sub-items yet in faturamento_equipamentos
      // (some old faturamentos might only be registered as general invoices in faturamento table)
      if (receita === 0) {
        const eqFaturas = faturasFiltradas.filter(f => {
          const ct = contratos.find(c => c.id === f.contrato_id);
          return ct?.equipamento_id === eq.id && (f.status === "Pago" || f.status === "Aprovado");
        });
        receita = eqFaturas.reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
        faturasReceita = eqFaturas.map(f => ({
          faturaId: f.id,
          numero_nota: f.numero_nota,
          periodo: f.periodo,
          valor_original: f.valor_total,
          valor_atribuido: f.valor_total,
          cliente: contratos.find(c => c.id === f.contrato_id)?.empresas?.nome || "Desconhecido"
        }));
      }

      const eqGastos = gastosFiltrados.filter(g => g.equipamento_id === eq.id);
      const gastosDespesa = eqGastos;
      let seguroMensalEq = 0;
      (apolices || []).forEach(ap => {
        if (ap.status !== "Vigente") return;
        const eqIds = (apolicesEquipamentos || []).filter(ae => ae.apolice_id === ap.id).map(ae => ae.equipamento_id);
        if (eqIds.includes(eq.id)) {
          let vMes = 0;
          if (ap.tem_parcelamento && ap.numero_parcelas > 0) {
            vMes = ap.valor / ap.numero_parcelas;
          } else {
            const inicio = new Date(ap.vigencia_inicio);
            const fim = new Date(ap.vigencia_fim);
            const meses = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30)));
            vMes = ap.valor / meses;
          }
          seguroMensalEq += (vMes / eqIds.length);
        }
      });

      const despesa = gastosDespesa.reduce((sum, g) => sum + Number(g.valor || 0), 0) + seguroMensalEq;
      const margem = receita - despesa;
      const margemPct = receita > 0 ? (margem / receita) * 100 : 0;

      return {
        id: eq.id,
        tipo: eq.tipo,
        modelo: eq.modelo,
        tag: eq.tag_placa || "Sem Placa",
        receita,
        despesa,
        seguroRateado: seguroMensalEq,
        margem,
        margemPct,
        status: eq.status,
        faturasReceita,
        gastosDespesa
      };
    }).sort((a, b) => b.margem - a.margem);
  }, [equipamentos, faturasFiltradas, gastosFiltrados, contratos, faturamentoEquipamentosList, apolices, apolicesEquipamentos]);

  // 4. Aging List (Contas a Receber por Vencer e Atrasados)
  const agingList = useMemo(() => {
    const hoje = new Date();
    const result = {
      aVencer: 0,
      atrasado1_30: 0,
      atrasado31_60: 0,
      atrasado60Plus: 0,
      list: [] as any[]
    };

    faturas.forEach(f => {
      if (f.status === "Pago" || f.status === "Cancelado") return;

      const ct = contratos.find(c => c.id === f.contrato_id);
      if (globalEmpresaId !== "all" && ct?.empresa_id !== globalEmpresaId) return;
      if (globalEquipamentoId !== "all" && ct?.equipamento_id !== globalEquipamentoId) return;

      const prazo = ct?.prazo_faturamento || f.contratos?.prazo_faturamento || 30;
      const dateStr = f.data_aprovacao || f.emissao || f.created_at || "";
      if (!dateStr) return;

      const baseDate = parseLocalDate(dateStr);
      if (isNaN(baseDate.getTime())) return;

      const vencimento = new Date(baseDate);
      vencimento.setDate(vencimento.getDate() + prazo);
      const vencimentoStr = vencimento.toISOString().slice(0, 10);

      if (globalDataInicio && vencimentoStr < globalDataInicio) return;
      if (globalDataFim && vencimentoStr > globalDataFim) return;

      const diffTime = hoje.getTime() - vencimento.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const valor = Number(f.valor_total || 0);
      const clientName = f.contratos?.empresas?.nome || "Cliente Desconhecido";

      let statusAging: "A Vencer" | "Atrasado 1-30d" | "Atrasado 31-60d" | "Atrasado 60d+" = "A Vencer";

      if (diffDays <= 0) {
        result.aVencer += valor;
        statusAging = "A Vencer";
      } else if (diffDays <= 30) {
        result.atrasado1_30 += valor;
        statusAging = "Atrasado 1-30d";
      } else if (diffDays <= 60) {
        result.atrasado31_60 += valor;
        statusAging = "Atrasado 31-60d";
      } else {
        result.atrasado60Plus += valor;
        statusAging = "Atrasado 60d+";
      }

      result.list.push({
        id: f.id,
        numeroNota: f.numero_nota || "Sem Nota",
        periodo: f.periodo,
        cliente: clientName,
        valor,
        vencimento: vencimento.toLocaleDateString("pt-BR"),
        diasAtraso: diffDays > 0 ? diffDays : 0,
        status: statusAging
      });
    });

    return result;
  }, [faturas, contratos, globalEmpresaId, globalEquipamentoId, globalDataInicio, globalDataFim]);

  // 5. Histórico Mensal para Gráfico DRE
  const chartData = useMemo(() => {
    const map: Record<string, { mes: string; Receita: number; Custos: number }> = {};
    
    faturasFiltradas
      .filter(f => f.status === "Pago" || f.status === "Aprovado")
      .forEach(f => {
        const emissao = f.emissao || f.data_aprovacao || f.created_at || "";
        if (!emissao) return;
        const key = emissao.slice(0, 7); // YYYY-MM
        if (!map[key]) {
          const date = new Date(emissao + "T00:00:00");
          map[key] = {
            mes: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
            Receita: 0,
            Custos: 0
          };
        }
        map[key].Receita += Number(f.valor_total || 0);
      });

    gastosFiltrados.forEach(g => {
      if (!g.data) return;
      const key = g.data.slice(0, 7); // YYYY-MM
      if (!map[key]) {
        const date = new Date(g.data + "T00:00:00");
        map[key] = {
          mes: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          Receita: 0,
          Custos: 0
        };
      }
      map[key].Custos += Number(g.valor || 0);
    });

    // Adiciona Despesas Administrativas
    dreStats.despesasAdminFiltradas.forEach(d => {
      if (!d.data_vencimento) return;
      const key = d.data_vencimento.slice(0, 7);
      if (!map[key]) {
        const date = new Date(d.data_vencimento + "T00:00:00");
        map[key] = {
          mes: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          Receita: 0,
          Custos: 0
        };
      }
      map[key].Custos += Number(d.valor || 0);
    });

    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, val]) => val);
  }, [faturasFiltradas, gastosFiltrados, dreStats]);

  // ====================================================================
  // 6. KPI DE GESTÃO DE HORAS CONTRATUAIS
  // ====================================================================
  const horasContratuaisStats = useMemo(() => {
    // Aggregate per-equipment hours from faturamento_equipamentos (filtered invoices only)
    const faturaIdsSet = new Set(faturasFiltradas.filter(f => f.status === "Pago" || f.status === "Aprovado").map(f => f.id));

    // Build per-equipment aggregation
    interface EquipHoras {
      equipamento_id: string;
      horasContratadas: number;
      horasTrabalhadas: number;  // horas_medidas from faturamento_equipamentos
      horasNormais: number;
      horasExcedentes: number;
      horasCorretivas: number;   // from medicoes tipo=Indisponível
      horasRealUtilizadas: number; // trabalhadas - corretivas
      periodos: number;
      detalhes: Array<{ periodo: string; contratadas: number; trabalhadas: number; normais: number; excedentes: number; corretivas: number; cliente: string; }>;
    }

    const equipMap = new Map<string, EquipHoras>();

    // Process faturamento_equipamentos items
    faturamentoEquipamentosList.forEach(feItem => {
      if (!faturaIdsSet.has(feItem.faturamento_id)) return;

      const eqId = feItem.equipamento_id;
      if (globalEquipamentoId !== "all" && eqId !== globalEquipamentoId) return;

      // Find parent fatura for client filtering and period
      const fatura = faturasFiltradas.find(f => f.id === feItem.faturamento_id);
      if (!fatura) return;

      const ct = contratos.find(c => c.id === fatura.contrato_id);
      if (globalEmpresaId !== "all" && ct?.empresa_id !== globalEmpresaId) return;

      if (!equipMap.has(eqId)) {
        equipMap.set(eqId, {
          equipamento_id: eqId,
          horasContratadas: 0,
          horasTrabalhadas: 0,
          horasNormais: 0,
          horasExcedentes: 0,
          horasCorretivas: 0,
          horasRealUtilizadas: 0,
          periodos: 0,
          detalhes: []
        });
      }

      const entry = equipMap.get(eqId)!;
      const horasContratadas = Number(feItem.horas_contratadas ?? feItem.hora_minima ?? 0);
      const horasMedidas = Number(feItem.horas_totais ?? feItem.horas_medidas ?? 0);
      const horasNormais = Number(feItem.horas_normais ?? 0);
      const horasExcedentes = Number(feItem.horas_excedentes ?? 0);

      // Get contracted hours from the contratos_equipamentos linked to this contract+equipment
      const ce = contratosEquipamentos.find((c: any) => c.contrato_id === fatura.contrato_id && c.equipamento_id === eqId);
      const horasContrat = ce ? Number(ce.horas_contratadas || 0) : (ct ? Number(ct.horas_contratadas || 0) : horasContratadas);

      entry.horasContratadas += horasContrat;
      entry.horasTrabalhadas += horasMedidas;
      entry.horasNormais += horasNormais;
      entry.horasExcedentes += horasExcedentes;
      entry.periodos += 1;

      entry.detalhes.push({
        periodo: fatura.periodo || "",
        contratadas: horasContrat,
        trabalhadas: horasMedidas,
        normais: horasNormais,
        excedentes: horasExcedentes,
        corretivas: 0,
        cliente: ct?.empresas?.nome || "Desconhecido"
      });
    });

    // Process medições to compute corrective hours per equipment in the period
    medicoes.forEach(m => {
      if (m.tipo !== "Indisponível") return;
      if (!m.data) return;
      if (globalDataInicio && m.data < globalDataInicio) return;
      if (globalDataFim && m.data > globalDataFim) return;

      const eqId = m.equipamento_id;
      if (globalEquipamentoId !== "all" && eqId !== globalEquipamentoId) return;

      // Client filtering: check if equipment is allocated to selected client
      if (globalEmpresaId !== "all") {
        const allocated = contratosEquipamentos.some((ce: any) => {
          const ct = contratos.find(c => c.id === ce.contrato_id);
          if (ct?.empresa_id !== globalEmpresaId || ce.equipamento_id !== eqId) return false;
          const start = ce.data_entrega || ct.data_inicio || "1970-01-01";
          const end = ce.data_devolucao || ct.data_fim || "9999-12-31";
          return m.data >= start && m.data <= end;
        });
        if (!allocated) return;
      }

      if (!equipMap.has(eqId)) {
        equipMap.set(eqId, {
          equipamento_id: eqId,
          horasContratadas: 0,
          horasTrabalhadas: 0,
          horasNormais: 0,
          horasExcedentes: 0,
          horasCorretivas: 0,
          horasRealUtilizadas: 0,
          periodos: 0,
          detalhes: []
        });
      }

      const horasIndisp = Number(m.horas_trabalhadas || 0);
      equipMap.get(eqId)!.horasCorretivas += horasIndisp;
    });

    // Compute real utilized hours
    equipMap.forEach(entry => {
      entry.horasRealUtilizadas = Math.max(0, entry.horasTrabalhadas - entry.horasCorretivas);
    });

    // Convert to sorted array
    const list = Array.from(equipMap.values())
      .filter(e => e.horasContratadas > 0 || e.horasTrabalhadas > 0 || e.horasCorretivas > 0)
      .sort((a, b) => b.horasContratadas - a.horasContratadas);

    // Totals
    const totalContratadas = list.reduce((s, e) => s + e.horasContratadas, 0);
    const totalTrabalhadas = list.reduce((s, e) => s + e.horasTrabalhadas, 0);
    const totalCorretivas = list.reduce((s, e) => s + e.horasCorretivas, 0);
    const totalNormais = list.reduce((s, e) => s + e.horasNormais, 0);
    const totalExcedentes = list.reduce((s, e) => s + e.horasExcedentes, 0);
    const totalRealUtilizadas = list.reduce((s, e) => s + e.horasRealUtilizadas, 0);

    // KPI percentages
    const taxaUtilizacao = totalContratadas > 0 ? (totalTrabalhadas / totalContratadas) * 100 : 0;
    const taxaDisponibilidade = totalTrabalhadas > 0 ? ((totalTrabalhadas - totalCorretivas) / totalTrabalhadas) * 100 : 100;
    const taxaCorretiva = totalContratadas > 0 ? (totalCorretivas / totalContratadas) * 100 : 0;
    const taxaOciosidade = totalContratadas > 0 ? (Math.max(0, totalContratadas - totalTrabalhadas) / totalContratadas) * 100 : 0;

    return {
      list,
      totalContratadas,
      totalTrabalhadas,
      totalCorretivas,
      totalNormais,
      totalExcedentes,
      totalRealUtilizadas,
      taxaUtilizacao,
      taxaDisponibilidade,
      taxaCorretiva,
      taxaOciosidade,
      totalEquipamentos: list.length
    };
  }, [faturasFiltradas, faturamentoEquipamentosList, medicoes, contratos, contratosEquipamentos, equipamentos, globalEmpresaId, globalEquipamentoId, globalDataInicio, globalDataFim]);

  // 7. Chart data for Hours KPI (monthly breakdown)
  const horasChartData = useMemo(() => {
    const map: Record<string, { mes: string; Contratadas: number; Trabalhadas: number; Corretivas: number; }> = {};
    const faturaIdsSet = new Set(faturasFiltradas.filter(f => f.status === "Pago" || f.status === "Aprovado").map(f => f.id));

    faturamentoEquipamentosList.forEach(feItem => {
      if (!faturaIdsSet.has(feItem.faturamento_id)) return;
      const fatura = faturasFiltradas.find(f => f.id === feItem.faturamento_id);
      if (!fatura) return;

      const eqId = feItem.equipamento_id;
      if (globalEquipamentoId !== "all" && eqId !== globalEquipamentoId) return;
      const ct = contratos.find(c => c.id === fatura.contrato_id);
      if (globalEmpresaId !== "all" && ct?.empresa_id !== globalEmpresaId) return;

      const emissao = fatura.emissao || fatura.data_aprovacao || fatura.created_at || "";
      if (!emissao) return;
      const key = emissao.slice(0, 7);
      if (!map[key]) {
        const date = new Date(emissao + "T00:00:00");
        map[key] = {
          mes: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          Contratadas: 0,
          Trabalhadas: 0,
          Corretivas: 0
        };
      }

      const ce = contratosEquipamentos.find((c: any) => c.contrato_id === fatura.contrato_id && c.equipamento_id === eqId);
      const horasContrat = ce ? Number(ce.horas_contratadas || 0) : (ct ? Number(ct.horas_contratadas || 0) : 0);
      map[key].Contratadas += horasContrat;
      map[key].Trabalhadas += Number(feItem.horas_totais ?? feItem.horas_medidas ?? 0);
    });

    medicoes.forEach(m => {
      if (m.tipo !== "Indisponível" || !m.data) return;
      if (globalDataInicio && m.data < globalDataInicio) return;
      if (globalDataFim && m.data > globalDataFim) return;
      if (globalEquipamentoId !== "all" && m.equipamento_id !== globalEquipamentoId) return;

      const key = m.data.slice(0, 7);
      if (!map[key]) {
        const date = new Date(m.data + "T00:00:00");
        map[key] = {
          mes: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          Contratadas: 0,
          Trabalhadas: 0,
          Corretivas: 0
        };
      }
      map[key].Corretivas += Number(m.horas_trabalhadas || 0);
    });

    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, val]) => val);
  }, [faturasFiltradas, faturamentoEquipamentosList, medicoes, contratos, contratosEquipamentos, globalEmpresaId, globalEquipamentoId, globalDataInicio, globalDataFim]);

  // Função para exportação em Excel (XLSX)
  const handleExportExcel = (tipo: "rentabilidade" | "dre" | "aging") => {
    let data: any[] = [];
    let filename = "";

    if (tipo === "rentabilidade") {
      data = rentabilidadeEquipamentos.map(eq => ({
        "Equipamento": `${eq.tipo} ${eq.modelo}`,
        "Placa/Tag": eq.tag,
        "Receita Bruta (R$)": Number(eq.receita.toFixed(2)),
        "Despesas Operacionais (R$)": Number(eq.despesa.toFixed(2)),
        "Margem Líquida (R$)": Number(eq.margem.toFixed(2)),
        "Margem (%)": Number(eq.margemPct.toFixed(1)) / 100,
        "Lucratividade": eq.margemPct >= 30 ? "Alta" : eq.margemPct > 0 ? "Apertada" : eq.despesa === 0 && eq.receita === 0 ? "Inativo" : "Prejuízo",
        "Status": eq.status
      }));
      filename = "Rentabilidade_Equipamentos.xlsx";
    } else if (tipo === "dre") {
      const r = dreStats;
      data = [
        { "Categoria": "Receita Bruta", "Valor (R$)": Number(r.receitaBruta.toFixed(2)), "% da Receita": 1 },
        { "Categoria": "Custos de Manutenção", "Valor (R$)": Number(r.custoManutencao.toFixed(2)), "% da Receita": r.receitaBruta > 0 ? Number((r.custoManutencao / r.receitaBruta).toFixed(4)) : 0 },
        { "Categoria": "Custos de Mobilização", "Valor (R$)": Number(r.custoMobilizacao.toFixed(2)), "% da Receita": r.receitaBruta > 0 ? Number((r.custoMobilizacao / r.receitaBruta).toFixed(4)) : 0 },
        { "Categoria": "Encargos Fixos", "Valor (R$)": Number(r.custoFixo.toFixed(2)), "% da Receita": r.receitaBruta > 0 ? Number((r.custoFixo / r.receitaBruta).toFixed(4)) : 0 },
        { "Categoria": "Outros Custos Diretos", "Valor (R$)": Number(r.custoOutros.toFixed(2)), "% da Receita": r.receitaBruta > 0 ? Number((r.custoOutros / r.receitaBruta).toFixed(4)) : 0 },
        { "Categoria": "Total Custos Operacionais", "Valor (R$)": Number(r.totalCustos.toFixed(2)), "% da Receita": r.receitaBruta > 0 ? Number((r.totalCustos / r.receitaBruta).toFixed(4)) : 0 },
        { "Categoria": "Lucro Bruto (Gross Profit)", "Valor (R$)": Number(r.lucroBruto.toFixed(2)), "% da Receita": r.receitaBruta > 0 ? Number((r.lucroBruto / r.receitaBruta).toFixed(4)) : 0 },
        { "Categoria": "Despesas Administrativas (Fixas)", "Valor (R$)": Number(r.totalDespesasAdmin.toFixed(2)), "% da Receita": r.receitaBruta > 0 ? Number((r.totalDespesasAdmin / r.receitaBruta).toFixed(4)) : 0 },
        { "Categoria": "EBITDA (Resultado Líquido)", "Valor (R$)": Number(r.resultadoEbitda.toFixed(2)), "% da Receita": r.receitaBruta > 0 ? Number((r.resultadoEbitda / r.receitaBruta).toFixed(4)) : 0 }
      ];
      filename = "DRE_Completo_EBITDA.xlsx";
    } else if (tipo === "aging") {
      data = agingList.list.map(f => ({
        "Nota Fiscal": f.numeroNota,
        "Período": f.periodo,
        "Cliente": f.cliente,
        "Valor (R$)": Number(f.valor.toFixed(2)),
        "Vencimento": f.vencimento,
        "Dias em Aberto": f.diasAtraso,
        "Faixa": f.status
      }));
      filename = "Aging_Contas_Receber.xlsx";
    }

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Configurações básicas de coluna para melhor leitura no Excel
    if (tipo === "rentabilidade") {
      ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    } else if (tipo === "dre") {
          ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 15 }];
    } else if (tipo === "aging") {
      ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, filename);
  };

  // Função para exportação em PDF (usada para o DRE)
  const handleExportPDF = async (tipo: "dre") => {
    if (tipo !== "dre") return;
    
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const r = dreStats;

      // Add Header
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("DRE Completo (Full EBITDA)", 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Período analisado: ${globalDataInicio ? new Date(globalDataInicio + "T00:00:00").toLocaleDateString("pt-BR") : "Início"} até ${globalDataFim ? new Date(globalDataFim + "T00:00:00").toLocaleDateString("pt-BR") : "Hoje"}`, 14, 26);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 14, 31);

      // Add Table
      const tableData = [
        ["RECEITA BRUTA", `R$ ${fmt(r.receitaBruta)}`, "100.0%"],
        ["Custos de Manutenção", `R$ ${fmt(r.custoManutencao)}`, `${r.receitaBruta > 0 ? ((r.custoManutencao / r.receitaBruta) * 100).toFixed(1) : "0.0"}%`],
        ["Mobilização / Desmobilização", `R$ ${fmt(r.custoMobilizacao)}`, `${r.receitaBruta > 0 ? ((r.custoMobilizacao / r.receitaBruta) * 100).toFixed(1) : "0.0"}%`],
        ["Encargos Fixos", `R$ ${fmt(r.custoFixo)}`, `${r.receitaBruta > 0 ? ((r.custoFixo / r.receitaBruta) * 100).toFixed(1) : "0.0"}%`],
        ["Outros Gastos Diretos", `R$ ${fmt(r.custoOutros)}`, `${r.receitaBruta > 0 ? ((r.custoOutros / r.receitaBruta) * 100).toFixed(1) : "0.0"}%`],
        ["TOTAL CUSTOS OPERACIONAIS", `R$ ${fmt(r.totalCustos)}`, `${r.receitaBruta > 0 ? ((r.totalCustos / r.receitaBruta) * 100).toFixed(1) : "0.0"}%`],
        ["LUCRO BRUTO (GROSS PROFIT)", `R$ ${fmt(r.lucroBruto)}`, `${r.receitaBruta > 0 ? ((r.lucroBruto / r.receitaBruta) * 100).toFixed(1) : "0.0"}%`],
        ["Despesas Administrativas (Fixas)", `R$ ${fmt(r.totalDespesasAdmin)}`, `${r.receitaBruta > 0 ? ((r.totalDespesasAdmin / r.receitaBruta) * 100).toFixed(1) : "0.0"}%`],
        ["EBITDA (RESULTADO LÍQUIDO)", `R$ ${fmt(r.resultadoEbitda)}`, `${r.receitaBruta > 0 ? ((r.resultadoEbitda / r.receitaBruta) * 100).toFixed(1) : "0.0"}%`]
      ];

      autoTable(doc, {
        startY: 38,
        head: [["Categoria", "Valor", "% da Receita"]],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 40, halign: 'right' },
          2: { cellWidth: 40, halign: 'right' },
        },
        didParseCell: function(data) {
          if (data.section === 'body') {
            if (data.row.index === 0) { // Receita Bruta
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [241, 245, 249];
            } else if (data.row.index === 5) { // Total Custos
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [220, 38, 38]; 
            } else if (data.row.index === 6) { // Lucro Bruto
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [16, 185, 129]; 
            } else if (data.row.index === 8) { // EBITDA
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [240, 253, 244];
              if (r.resultadoEbitda >= 0) {
                data.cell.styles.textColor = [16, 185, 129]; 
              } else {
                data.cell.styles.textColor = [220, 38, 38];
              }
            }
          }
        }
      });

      doc.save(`DRE_Completo_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF do DRE:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Exportar PDF Button */}
      <div className="flex w-full items-end justify-end">
        <Button 
          variant="default" 
          className="gap-2 bg-primary/90 hover:bg-primary text-primary-foreground shadow-sm font-semibold"
          onClick={() => generateDrePdf({
            dataInicio: globalDataInicio,
            dataFim: globalDataFim,
            dreStats,
            rentabilidadeEquipamentos,
            agingList,
            horasContratuaisStats,
            equipamentos
          })}
        >
          <FileText className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* DRE KPIs e Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel do DRE */}
        <Card className="glass shadow-sm border border-border/40 lg:col-span-1">
          <CardHeader className="pb-3 border-b border-border/10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                DRE Completo (Full EBITDA)
              </CardTitle>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleExportPDF("dre")}>
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>Resumo de receitas e despesas no período</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div 
              className="flex justify-between items-center py-2 border-b border-border/5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
              onClick={() => setDreDetailModal({ isOpen: true, type: "receitaBruta", title: "Receita Bruta" })}
            >
              <span className="text-xs font-bold text-muted-foreground uppercase">Receita Bruta</span>
              <span className="text-sm font-black text-foreground">R$ {fmt(dreStats.receitaBruta)}</span>
            </div>
            <div className="space-y-0.5 py-1 border-b border-border/5">
              <div 
                className="flex justify-between items-center text-xs text-muted-foreground py-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                onClick={() => setDreDetailModal({ isOpen: true, type: "custoManutencao", title: "Custos de Manutenção" })}
              >
                <span>Custos de Manutenção</span>
                <span className="font-semibold text-foreground">R$ {fmt(dreStats.custoManutencao)}</span>
              </div>
              <div 
                className="flex justify-between items-center text-xs text-muted-foreground py-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                onClick={() => setDreDetailModal({ isOpen: true, type: "custoMobilizacao", title: "Mobilização / Desmobilização" })}
              >
                <span>Mobilização / Desmobilização</span>
                <span className="font-semibold text-foreground">R$ {fmt(dreStats.custoMobilizacao)}</span>
              </div>
              <div 
                className="flex justify-between items-center text-xs text-muted-foreground py-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                onClick={() => setDreDetailModal({ isOpen: true, type: "custoFixo", title: "Encargos Fixos (Seguros, Parcelas)" })}
              >
                <span>Encargos Fixos (Seguros, Parcelas)</span>
                <span className="font-semibold text-foreground">R$ {fmt(dreStats.custoFixo)}</span>
              </div>
              <div 
                className="flex justify-between items-center text-xs text-muted-foreground py-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                onClick={() => setDreDetailModal({ isOpen: true, type: "custoOutros", title: "Outros Gastos Diretos" })}
              >
                <span>Outros Gastos Diretos</span>
                <span className="font-semibold text-foreground">R$ {fmt(dreStats.custoOutros)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-1 px-2 -mx-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Total Custos Operacionais</span>
              <span className="text-xs font-bold text-destructive">R$ {fmt(dreStats.totalCustos)}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-border/5 bg-accent/5 px-2 -mx-2 rounded">
              <span className="text-xs font-bold text-accent uppercase">Lucro Bruto (Gross Profit)</span>
              <span className={`text-sm font-black ${dreStats.lucroBruto >= 0 ? "text-success" : "text-destructive"}`}>
                R$ {fmt(dreStats.lucroBruto)}
              </span>
            </div>

            <div className="space-y-0.5 py-1 border-b border-border/5">
              <div 
                className="flex justify-between items-center text-xs text-muted-foreground py-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                onClick={() => setDreDetailModal({ isOpen: true, type: "despesasAdmin", title: "Despesas Administrativas (Controladoria)" })}
              >
                <span>Despesas Fixas (Controladoria)</span>
                <span className="font-semibold text-foreground">R$ {fmt(dreStats.totalDespesasAdmin)}</span>
              </div>
            </div>

            <div className="p-4 bg-muted/30 rounded-xl space-y-2 border border-border/40">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase">EBITDA Real da Empresa</span>
                <span className={`text-sm font-black ${dreStats.resultadoEbitda >= 0 ? "text-success" : "text-destructive"}`}>
                  R$ {fmt(dreStats.resultadoEbitda)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Margem EBITDA</span>
                <Badge className={`font-bold border-0 text-white ${dreStats.resultadoEbitda >= 0 ? "bg-success" : "bg-destructive"}`}>
                  {dreStats.margemEbitda.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico Mensal */}
        <Card className="glass shadow-sm border border-border/40 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Evolução Mensal (Receitas vs Custos)
            </CardTitle>
            <CardDescription>Fluxo financeiro mês a mês consolidado</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pb-4">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Sem histórico de dados financeiros no período filtrado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-background border border-border rounded-xl shadow-xl p-3 min-w-[150px]">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{payload[0].payload.mes}</p>
                          {payload.map((p: any) => (
                            <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
                              <span className="text-xs font-semibold text-muted-foreground">{p.name}</span>
                              <span className={`text-xs font-bold ${p.name === "Receita" ? "text-success" : "text-destructive"}`}>
                                R$ {fmt(p.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend tick={{ fontSize: 10 }} />
                  <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Custos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ====================================================================
          KPI DE GESTÃO DE HORAS CONTRATUAIS
          ==================================================================== */}
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: Horas Contratadas */}
          <Card className="glass shadow-sm border border-border/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horas Contratadas</span>
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              <p className="text-2xl font-black text-foreground">{horasContratuaisStats.totalContratadas.toFixed(0)}h</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {horasContratuaisStats.totalEquipamentos} equipamento{horasContratuaisStats.totalEquipamentos !== 1 ? "s" : ""} no período
              </p>
            </CardContent>
          </Card>

          {/* Card: Horas Trabalhadas */}
          <Card className="glass shadow-sm border border-border/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horas Trabalhadas</span>
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <p className="text-2xl font-black text-foreground">{horasContratuaisStats.totalTrabalhadas.toFixed(1)}h</p>
              <div className="flex items-center gap-1 mt-1">
                <Badge className={`text-[9px] font-bold border-0 text-white px-1.5 py-0 ${
                  horasContratuaisStats.taxaUtilizacao >= 85 ? "bg-emerald-500" :
                  horasContratuaisStats.taxaUtilizacao >= 60 ? "bg-amber-500" : "bg-red-500"
                }`}>
                  {horasContratuaisStats.taxaUtilizacao.toFixed(1)}% utilização
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card: Horas em Corretivas */}
          <Card className="glass shadow-sm border border-border/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-400" />
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horas em Corretivas</span>
                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-red-500" />
                </div>
              </div>
              <p className="text-2xl font-black text-destructive">{horasContratuaisStats.totalCorretivas.toFixed(1)}h</p>
              <div className="flex items-center gap-1 mt-1">
                <Badge className={`text-[9px] font-bold border-0 text-white px-1.5 py-0 ${
                  horasContratuaisStats.taxaCorretiva <= 5 ? "bg-emerald-500" :
                  horasContratuaisStats.taxaCorretiva <= 15 ? "bg-amber-500" : "bg-red-500"
                }`}>
                  {horasContratuaisStats.taxaCorretiva.toFixed(1)}% das contratadas
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card: Horas Real Utilizadas */}
          <Card className="glass shadow-sm border border-border/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-purple-400" />
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horas Real Utilizadas</span>
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Gauge className="h-4 w-4 text-violet-500" />
                </div>
              </div>
              <p className="text-2xl font-black text-foreground">{horasContratuaisStats.totalRealUtilizadas.toFixed(1)}h</p>
              <div className="flex items-center gap-1 mt-1">
                <Badge className={`text-[9px] font-bold border-0 text-white px-1.5 py-0 ${
                  horasContratuaisStats.taxaDisponibilidade >= 95 ? "bg-emerald-500" :
                  horasContratuaisStats.taxaDisponibilidade >= 85 ? "bg-amber-500" : "bg-red-500"
                }`}>
                  {horasContratuaisStats.taxaDisponibilidade.toFixed(1)}% disponibilidade
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart + KPI Gauges Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Painel de Indicadores Chave */}
          <Card className="glass shadow-sm border border-border/40 lg:col-span-1">
            <CardHeader className="pb-3 border-b border-border/10">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                Indicadores de Gestão
              </CardTitle>
              <CardDescription>Performance consolidada do contrato</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              {/* Taxa de Utilização */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" /> Taxa de Utilização
                  </span>
                  <span className={`text-sm font-black ${
                    horasContratuaisStats.taxaUtilizacao >= 85 ? "text-emerald-500" :
                    horasContratuaisStats.taxaUtilizacao >= 60 ? "text-amber-500" : "text-red-500"
                  }`}>
                    {horasContratuaisStats.taxaUtilizacao.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      horasContratuaisStats.taxaUtilizacao >= 85 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                      horasContratuaisStats.taxaUtilizacao >= 60 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                      "bg-gradient-to-r from-red-500 to-red-400"
                    }`}
                    style={{ width: `${Math.min(100, horasContratuaisStats.taxaUtilizacao)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {horasContratuaisStats.totalTrabalhadas.toFixed(0)}h trabalhadas de {horasContratuaisStats.totalContratadas.toFixed(0)}h contratadas
                </p>
              </div>

              {/* Taxa de Disponibilidade */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Disponibilidade Mecânica
                  </span>
                  <span className={`text-sm font-black ${
                    horasContratuaisStats.taxaDisponibilidade >= 95 ? "text-emerald-500" :
                    horasContratuaisStats.taxaDisponibilidade >= 85 ? "text-amber-500" : "text-red-500"
                  }`}>
                    {horasContratuaisStats.taxaDisponibilidade.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      horasContratuaisStats.taxaDisponibilidade >= 95 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                      horasContratuaisStats.taxaDisponibilidade >= 85 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                      "bg-gradient-to-r from-red-500 to-red-400"
                    }`}
                    style={{ width: `${Math.min(100, horasContratuaisStats.taxaDisponibilidade)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {horasContratuaisStats.totalRealUtilizadas.toFixed(0)}h efetivas de {horasContratuaisStats.totalTrabalhadas.toFixed(0)}h trabalhadas
                </p>
              </div>

              {/* Taxa de Corretivas */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" /> Impacto Corretivas
                  </span>
                  <span className={`text-sm font-black ${
                    horasContratuaisStats.taxaCorretiva <= 5 ? "text-emerald-500" :
                    horasContratuaisStats.taxaCorretiva <= 15 ? "text-amber-500" : "text-red-500"
                  }`}>
                    {horasContratuaisStats.taxaCorretiva.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      horasContratuaisStats.taxaCorretiva <= 5 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                      horasContratuaisStats.taxaCorretiva <= 15 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                      "bg-gradient-to-r from-red-500 to-red-400"
                    }`}
                    style={{ width: `${Math.min(100, horasContratuaisStats.taxaCorretiva)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {horasContratuaisStats.totalCorretivas.toFixed(0)}h paradas de {horasContratuaisStats.totalContratadas.toFixed(0)}h contratadas
                </p>
              </div>

              {/* Taxa de Ociosidade */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" /> Ociosidade
                  </span>
                  <span className={`text-sm font-black ${
                    horasContratuaisStats.taxaOciosidade <= 10 ? "text-emerald-500" :
                    horasContratuaisStats.taxaOciosidade <= 25 ? "text-amber-500" : "text-red-500"
                  }`}>
                    {horasContratuaisStats.taxaOciosidade.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      horasContratuaisStats.taxaOciosidade <= 10 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                      horasContratuaisStats.taxaOciosidade <= 25 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                      "bg-gradient-to-r from-red-500 to-red-400"
                    }`}
                    style={{ width: `${Math.min(100, horasContratuaisStats.taxaOciosidade)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {Math.max(0, horasContratuaisStats.totalContratadas - horasContratuaisStats.totalTrabalhadas).toFixed(0)}h ociosas no período
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Horas Mensal */}
          <Card className="glass shadow-sm border border-border/40 lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Evolução Mensal de Horas
              </CardTitle>
              <CardDescription>Comparativo mensal: contratadas × trabalhadas × corretivas</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] pb-4">
              {horasChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Sem dados de horas no período filtrado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={horasChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-background border border-border rounded-xl shadow-xl p-3 min-w-[170px]">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{payload[0].payload.mes}</p>
                            {payload.map((p: any) => (
                              <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
                                <span className="text-xs font-semibold text-muted-foreground">{p.name}</span>
                                <span className={`text-xs font-bold ${
                                  p.name === "Contratadas" ? "text-blue-500" :
                                  p.name === "Trabalhadas" ? "text-emerald-500" : "text-red-500"
                                }`}>
                                  {Number(p.value).toFixed(1)}h
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Contratadas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Trabalhadas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Corretivas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela Detalhada por Equipamento */}
        <Card className="glass shadow-sm border border-border/40">
          <CardHeader className="pb-3 border-b border-border/10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Gestão de Horas por Equipamento
              </CardTitle>
              <CardDescription>Controle detalhado de horas contratadas, trabalhadas, corretivas e reais por ativo</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-2 bg-background/50" onClick={() => {
              const data = horasContratuaisStats.list.map(entry => {
                const eq = equipamentos.find(e => e.id === entry.equipamento_id);
                const utilizacao = entry.horasContratadas > 0 ? (entry.horasTrabalhadas / entry.horasContratadas * 100) : 0;
                const disponibilidade = entry.horasTrabalhadas > 0 ? ((entry.horasTrabalhadas - entry.horasCorretivas) / entry.horasTrabalhadas * 100) : 100;
                return {
                  "Equipamento": eq ? `${eq.tipo} ${eq.modelo}` : "Desconhecido",
                  "Placa/Tag": eq?.tag_placa || "S/P",
                  "Horas Contratadas": Number(entry.horasContratadas.toFixed(1)),
                  "Horas Trabalhadas": Number(entry.horasTrabalhadas.toFixed(1)),
                  "Horas Corretivas": Number(entry.horasCorretivas.toFixed(1)),
                  "Horas Real Utilizadas": Number(entry.horasRealUtilizadas.toFixed(1)),
                  "Horas Normais": Number(entry.horasNormais.toFixed(1)),
                  "Horas Excedentes": Number(entry.horasExcedentes.toFixed(1)),
                  "Utilização (%)": Number(utilizacao.toFixed(1)) / 100,
                  "Disponibilidade (%)": Number(disponibilidade.toFixed(1)) / 100,
                  "Períodos": entry.periodos
                };
              });
              const ws = XLSX.utils.json_to_sheet(data);
              ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 10 }];
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Horas Contratuais");
              XLSX.writeFile(wb, "KPI_Horas_Contratuais.xlsx");
            }}>
              <FileDown className="h-3.5 w-3.5" />
              <span>Exportar</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[400px] scrollbar-thin">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Equipamento</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Placa/Tag</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Contratadas</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Trabalhadas</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Corretivas</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Real Utiliz.</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center" style={{ minWidth: "130px" }}>Utilização</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center" style={{ minWidth: "130px" }}>Disponib.</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {horasContratuaisStats.list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-xs text-muted-foreground">
                        Nenhum dado de horas encontrado no período filtrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {horasContratuaisStats.list.map(entry => {
                        const eq = equipamentos.find(e => e.id === entry.equipamento_id);
                        const utilizacao = entry.horasContratadas > 0 ? (entry.horasTrabalhadas / entry.horasContratadas * 100) : 0;
                        const disponibilidade = entry.horasTrabalhadas > 0 ? ((entry.horasTrabalhadas - entry.horasCorretivas) / entry.horasTrabalhadas * 100) : 100;

                        const statusLabel = utilizacao >= 85
                          ? { text: "Otimizado", color: "bg-emerald-500" }
                          : utilizacao >= 60
                            ? { text: "Moderado", color: "bg-amber-500" }
                            : utilizacao > 0
                              ? { text: "Subutilizado", color: "bg-red-500" }
                              : { text: "Sem Dados", color: "bg-muted-foreground" };

                        return (
                          <TableRow
                            key={entry.equipamento_id}
                            className="hover:bg-muted/20 transition-colors cursor-pointer"
                            onClick={() => setHorasDetailModal({ isOpen: true, equipId: entry.equipamento_id })}
                          >
                            <TableCell className="font-bold text-xs text-foreground">
                              {eq ? `${eq.tipo} ${eq.modelo}` : "Desconhecido"}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold">
                              {eq?.tag_placa || "S/P"}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold text-blue-500">
                              {entry.horasContratadas.toFixed(1)}h
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold text-emerald-500">
                              {entry.horasTrabalhadas.toFixed(1)}h
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold text-destructive">
                              {entry.horasCorretivas.toFixed(1)}h
                            </TableCell>
                            <TableCell className="text-right text-xs font-black text-violet-500">
                              {entry.horasRealUtilizadas.toFixed(1)}h
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-muted/50 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      utilizacao >= 85 ? "bg-emerald-500" : utilizacao >= 60 ? "bg-amber-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${Math.min(100, utilizacao)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-bold min-w-[38px] text-right ${
                                  utilizacao >= 85 ? "text-emerald-500" : utilizacao >= 60 ? "text-amber-500" : "text-red-500"
                                }`}>
                                  {utilizacao.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-muted/50 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      disponibilidade >= 95 ? "bg-emerald-500" : disponibilidade >= 85 ? "bg-amber-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${Math.min(100, disponibilidade)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-bold min-w-[38px] text-right ${
                                  disponibilidade >= 95 ? "text-emerald-500" : disponibilidade >= 85 ? "text-amber-500" : "text-red-500"
                                }`}>
                                  {disponibilidade.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={`text-[9px] font-bold uppercase py-0.5 px-2 border-0 text-white ${statusLabel.color}`}>
                                {statusLabel.text}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Total Row */}
                      <TableRow className="bg-muted/30 border-t-2 border-border/40">
                        <TableCell colSpan={2} className="text-xs font-black text-foreground uppercase">Totais</TableCell>
                        <TableCell className="text-right text-xs font-black text-blue-500">
                          {horasContratuaisStats.totalContratadas.toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-right text-xs font-black text-emerald-500">
                          {horasContratuaisStats.totalTrabalhadas.toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-right text-xs font-black text-destructive">
                          {horasContratuaisStats.totalCorretivas.toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-right text-xs font-black text-violet-500">
                          {horasContratuaisStats.totalRealUtilizadas.toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-[9px] font-bold border-0 text-white px-1.5 py-0 ${
                            horasContratuaisStats.taxaUtilizacao >= 85 ? "bg-emerald-500" :
                            horasContratuaisStats.taxaUtilizacao >= 60 ? "bg-amber-500" : "bg-red-500"
                          }`}>
                            {horasContratuaisStats.taxaUtilizacao.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-[9px] font-bold border-0 text-white px-1.5 py-0 ${
                            horasContratuaisStats.taxaDisponibilidade >= 95 ? "bg-emerald-500" :
                            horasContratuaisStats.taxaDisponibilidade >= 85 ? "bg-amber-500" : "bg-red-500"
                          }`}>
                            {horasContratuaisStats.taxaDisponibilidade.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Relatório de Rentabilidade por Equipamento */}
      <Card className="glass shadow-sm border border-border/40">
        <CardHeader className="pb-3 border-b border-border/10 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Rentabilidade por Equipamento
            </CardTitle>
            <CardDescription>Relação de receita líquida e eficiência financeira por ativo</CardDescription>
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-2 bg-background/50" onClick={() => handleExportExcel("rentabilidade")}>
            <FileDown className="h-3.5 w-3.5" />
            <span>Exportar</span>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[350px] scrollbar-thin">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Equipamento</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Placa/Tag</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Receita Bruta</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Despesas Operacionais</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Margem Líquida</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Margem (%)</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Lucratividade</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentabilidadeEquipamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground">
                      Nenhum equipamento correspondente encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  rentabilidadeEquipamentos.map(eq => {
                    const isProfit = eq.margem >= 0;
                    const margemColor = eq.margemPct >= 40 ? "text-success font-black" : eq.margemPct >= 10 ? "text-warning font-black" : "text-destructive font-black";
                    return (
                      <TableRow 
                        key={eq.id} 
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => setRentabilidadeDetailModal({ isOpen: true, equipId: eq.id })}
                      >
                        <TableCell className="font-bold text-xs text-foreground hover:underline">{eq.tipo} {eq.modelo}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold">{eq.tag}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-foreground">R$ {fmt(eq.receita)}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-destructive">R$ {fmt(eq.despesa)}</TableCell>
                        <TableCell className={`text-right text-xs font-black ${isProfit ? "text-success" : "text-destructive"}`}>
                          R$ {fmt(eq.margem)}
                        </TableCell>
                        <TableCell className={`text-right text-xs ${margemColor}`}>
                          {eq.margemPct.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          {eq.margemPct >= 30 ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 text-[10px]">Alta</Badge>
                          ) : eq.margemPct > 0 ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0 text-[10px]">Apertada</Badge>
                          ) : eq.despesa === 0 && eq.receita === 0 ? (
                            <Badge variant="outline" className="text-slate-500 border-0 text-[10px]">Inativo</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-0 text-[10px]">Prejuízo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[9px] font-bold uppercase py-0.5 px-2 border-0 text-white ${
                            eq.status === "Ativo" || eq.status === "Locado" ? "bg-success" :
                            eq.status === "Manutenção" ? "bg-warning" : "bg-muted-foreground"
                          }`}>
                            {eq.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Relatório de Contas a Receber (Aging List) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Painel do Aging List (Categorias) */}
        <Card className="glass shadow-sm border border-border/40 lg:col-span-1">
          <CardHeader className="pb-3 border-b border-border/10">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Aging de Contas a Receber
            </CardTitle>
            <CardDescription>Consolidado de faturas pendentes de liquidação</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">A Vencer</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-foreground">R$ {fmt(agingList.aVencer)}</span>
                <Badge variant="outline" className="bg-success/5 text-success border-success/20 text-[9px] font-bold">Em Dia</Badge>
              </div>
            </div>
            <div className="space-y-1 pt-2 border-t border-border/5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Atrasado 1 a 30 dias</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-warning">R$ {fmt(agingList.atrasado1_30)}</span>
                <Badge variant="outline" className="bg-warning/5 text-warning border-warning/20 text-[9px] font-bold">Cobrança N1</Badge>
              </div>
            </div>
            <div className="space-y-1 pt-2 border-t border-border/5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Atrasado 31 a 60 dias</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-orange-500">R$ {fmt(agingList.atrasado31_60)}</span>
                <Badge variant="outline" className="bg-orange-500/5 text-orange-500 border-orange-500/20 text-[9px] font-bold">Cobrança N2</Badge>
              </div>
            </div>
            <div className="space-y-1 pt-2 border-t border-border/5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Atrasado 60+ dias</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-destructive">R$ {fmt(agingList.atrasado60Plus)}</span>
                <Badge variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 text-[9px] font-bold">Cobrança Crítica</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela do Aging List */}
        <Card className="glass shadow-sm border border-border/40 lg:col-span-3">
          <CardHeader className="pb-3 border-b border-border/10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                Faturas Pendentes e em Atraso
              </CardTitle>
              <CardDescription>Detalhamento de faturamento por vencimento e dias em aberto</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-2 bg-background/50" onClick={() => handleExportExcel("aging")}>
              <FileDown className="h-3.5 w-3.5" />
              <span>Exportar</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[300px] scrollbar-thin">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Nota Fiscal</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Período</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Valor</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Vencimento</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Dias em Aberto</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Faixa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agingList.list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground">
                        Nenhuma fatura em aberto encontrada no período filtrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agingList.list.map(f => {
                      const isAtrasado = f.diasAtraso > 0;
                      return (
                        <TableRow key={f.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="font-bold text-xs text-foreground">{f.numeroNota}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{f.periodo}</TableCell>
                          <TableCell className="text-xs font-semibold text-foreground truncate max-w-[150px]">{f.cliente}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-foreground">R$ {fmt(f.valor)}</TableCell>
                          <TableCell className="text-xs font-semibold">{f.vencimento}</TableCell>
                          <TableCell className={`text-right text-xs font-bold ${isAtrasado ? "text-destructive" : "text-success"}`}>
                            {f.diasAtraso}d
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`text-[9px] font-bold uppercase py-0.5 px-2 border-0 text-white ${
                              f.status === "A Vencer" ? "bg-success" :
                              f.status === "Atrasado 1-30d" ? "bg-warning" :
                              f.status === "Atrasado 31-60d" ? "bg-orange-500" : "bg-destructive"
                            }`}>
                              {f.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MODAL DE DETALHES DO DRE */}
      <Dialog open={dreDetailModal.isOpen} onOpenChange={(v) => !v && setDreDetailModal({ isOpen: false, type: null, title: "" })}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhamento: {dreDetailModal.title}</DialogTitle>
            <DialogDescription>
              Lista de itens que compõem este indicador no período selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {dreDetailModal.type === "receitaBruta" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nota Fiscal</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dreStats.faturasReceita.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem registros</TableCell></TableRow>
                  )}
                  {dreStats.faturasReceita.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.numero_nota || f.numero_sequencial || "Sem nota"}</TableCell>
                      <TableCell>{f.periodo}</TableCell>
                      <TableCell>{contratos.find(c => c.id === f.contrato_id)?.empresas?.nome || "-"}</TableCell>
                      <TableCell className="text-right font-bold text-success">R$ {fmt(f.valor_total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold text-success">R$ {fmt(dreStats.receitaBruta)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : dreDetailModal.type && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    let list: any[] = [];
                    let total = 0;
                    if (dreDetailModal.type === "custoManutencao") { list = dreStats.gastosManutencao; total = dreStats.custoManutencao; }
                    if (dreDetailModal.type === "custoMobilizacao") { list = dreStats.gastosMobilizacao; total = dreStats.custoMobilizacao; }
                    if (dreDetailModal.type === "custoFixo") { list = dreStats.gastosFixo; total = dreStats.custoFixo; }
                    if (dreDetailModal.type === "custoOutros") { list = dreStats.gastosOutros; total = dreStats.custoOutros; }
                    if (dreDetailModal.type === "despesasAdmin") { list = dreStats.despesasAdminFiltradas; total = dreStats.totalDespesasAdmin; }
                    
                    if (list.length === 0) return <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem registros</TableCell></TableRow>;
                    
                    return (
                      <>
                        {list.map(g => (
                          <TableRow key={g.id}>
                            <TableCell>{g.data ? new Date(g.data + "T00:00:00").toLocaleDateString("pt-BR") : (g.data_vencimento ? new Date(g.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "")}</TableCell>
                            <TableCell className="font-medium max-w-[200px] truncate" title={g.descricao}>{g.descricao}</TableCell>
                            <TableCell><Badge variant="outline">{g.tipo || g.tipo_despesa || "Geral"}</Badge></TableCell>
                            <TableCell>{g.equipamento_id ? (equipamentos.find(eq => eq.id === g.equipamento_id)?.tag_placa || "Geral") : (dreDetailModal.type === "despesasAdmin" ? "Escritório" : "-")}</TableCell>
                            <TableCell className="text-right font-bold text-destructive">R$ {fmt(g.valor)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={4} className="text-right font-bold">Total</TableCell>
                          <TableCell className="text-right font-bold text-destructive">R$ {fmt(total)}</TableCell>
                        </TableRow>
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE DETALHES DE RENTABILIDADE POR EQUIPAMENTO */}
      <Dialog open={rentabilidadeDetailModal.isOpen} onOpenChange={(v) => !v && setRentabilidadeDetailModal({ isOpen: false, equipId: null })}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {(() => {
            const eqData = rentabilidadeEquipamentos.find(r => r.id === rentabilidadeDetailModal.equipId);
            if (!eqData) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Rentabilidade: {eqData.tipo} {eqData.modelo} ({eqData.tag})</DialogTitle>
                  <DialogDescription>
                    Detalhamento de faturas atribuídas e gastos lançados neste equipamento no período.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="p-4 bg-success/10 rounded-xl border border-success/20">
                    <span className="text-xs font-bold text-success uppercase block">Total Receita</span>
                    <span className="text-2xl font-black text-success">R$ {fmt(eqData.receita)}</span>
                  </div>
                  <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20">
                    <span className="text-xs font-bold text-destructive uppercase block">Total Despesa</span>
                    <span className="text-2xl font-black text-destructive">R$ {fmt(eqData.despesa)}</span>
                  </div>
                </div>

                <div className="space-y-6 mt-4">
                  <div>
                    <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-success">
                      <TrendingUp className="h-4 w-4" /> Composição das Receitas (Medições)
                    </h3>
                    <div className="border border-border/40 rounded-md">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead>Mês/Período</TableHead>
                            <TableHead>Nota</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="text-right">Valor Original</TableHead>
                            <TableHead className="text-right">Valor Atribuído</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {eqData.faturasReceita.length === 0 && (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma fatura associada</TableCell></TableRow>
                          )}
                          {eqData.faturasReceita.map((f: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{f.periodo}</TableCell>
                              <TableCell>{f.numero_nota || "S/N"}</TableCell>
                              <TableCell className="truncate max-w-[150px]">{f.cliente}</TableCell>
                              <TableCell className="text-right text-muted-foreground">R$ {fmt(f.valor_original)}</TableCell>
                              <TableCell className="text-right font-bold text-success">R$ {fmt(f.valor_atribuido)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-destructive">
                      <TrendingDown className="h-4 w-4" /> Composição das Despesas (O.S / Custos)
                    </h3>
                    <div className="border border-border/40 rounded-md">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {eqData.gastosDespesa.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum gasto associado</TableCell></TableRow>
                          )}
                          {eqData.gastosDespesa.map((g: any) => (
                            <TableRow key={g.id}>
                              <TableCell>{g.data ? new Date(g.data + "T00:00:00").toLocaleDateString("pt-BR") : ""}</TableCell>
                              <TableCell className="truncate max-w-[200px]" title={g.descricao}>{g.descricao}</TableCell>
                              <TableCell><Badge variant="outline">{g.tipo}</Badge></TableCell>
                              <TableCell className="text-right font-bold text-destructive">R$ {fmt(g.valor)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* MODAL DE DETALHES DE HORAS POR EQUIPAMENTO */}
      <Dialog open={horasDetailModal.isOpen} onOpenChange={(v) => !v && setHorasDetailModal({ isOpen: false, equipId: null })}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {(() => {
            const entry = horasContratuaisStats.list.find(e => e.equipamento_id === horasDetailModal.equipId);
            if (!entry) return null;
            const eq = equipamentos.find(e => e.id === entry.equipamento_id);
            const utilizacao = entry.horasContratadas > 0 ? (entry.horasTrabalhadas / entry.horasContratadas * 100) : 0;
            const disponibilidade = entry.horasTrabalhadas > 0 ? ((entry.horasTrabalhadas - entry.horasCorretivas) / entry.horasTrabalhadas * 100) : 100;

            // Get corrective medicoes for this equipment in the period
            const corretivaMedicoes = medicoes.filter(m =>
              m.tipo === "Indisponível" &&
              m.equipamento_id === entry.equipamento_id &&
              (!dataInicio || m.data >= dataInicio) &&
              (!dataFim || m.data <= dataFim)
            );

            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    Horas Contratuais: {eq ? `${eq.tipo} ${eq.modelo}` : "Equipamento"} ({eq?.tag_placa || "S/P"})
                  </DialogTitle>
                  <DialogDescription>
                    Detalhamento de horas contratadas, trabalhadas, corretivas e real utilizadas no período.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-center">
                    <span className="text-[10px] font-bold text-blue-500 uppercase block">Contratadas</span>
                    <span className="text-xl font-black text-blue-500">{entry.horasContratadas.toFixed(1)}h</span>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-center">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase block">Trabalhadas</span>
                    <span className="text-xl font-black text-emerald-500">{entry.horasTrabalhadas.toFixed(1)}h</span>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-center">
                    <span className="text-[10px] font-bold text-red-500 uppercase block">Corretivas</span>
                    <span className="text-xl font-black text-red-500">{entry.horasCorretivas.toFixed(1)}h</span>
                  </div>
                  <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20 text-center">
                    <span className="text-[10px] font-bold text-violet-500 uppercase block">Real Utiliz.</span>
                    <span className="text-xl font-black text-violet-500">{entry.horasRealUtilizadas.toFixed(1)}h</span>
                  </div>
                </div>

                {/* KPI bars */}
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-semibold">Utilização</span>
                      <span className={`font-black ${utilizacao >= 85 ? "text-emerald-500" : utilizacao >= 60 ? "text-amber-500" : "text-red-500"}`}>
                        {utilizacao.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          utilizacao >= 85 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                          utilizacao >= 60 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                          "bg-gradient-to-r from-red-500 to-red-400"
                        }`}
                        style={{ width: `${Math.min(100, utilizacao)}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-semibold">Disponibilidade</span>
                      <span className={`font-black ${disponibilidade >= 95 ? "text-emerald-500" : disponibilidade >= 85 ? "text-amber-500" : "text-red-500"}`}>
                        {disponibilidade.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          disponibilidade >= 95 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                          disponibilidade >= 85 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                          "bg-gradient-to-r from-red-500 to-red-400"
                        }`}
                        style={{ width: `${Math.min(100, disponibilidade)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mt-4">
                  {/* Períodos Faturados */}
                  {entry.detalhes.length > 0 && (
                    <div>
                      <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-blue-500">
                        <Clock className="h-4 w-4" /> Períodos Faturados
                      </h3>
                      <div className="border border-border/40 rounded-md">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow>
                              <TableHead>Período</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead className="text-right">Contratadas</TableHead>
                              <TableHead className="text-right">Trabalhadas</TableHead>
                              <TableHead className="text-right">Normais</TableHead>
                              <TableHead className="text-right">Excedentes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.detalhes.map((d, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{d.periodo}</TableCell>
                                <TableCell className="truncate max-w-[150px]">{d.cliente}</TableCell>
                                <TableCell className="text-right text-blue-500 font-semibold">{d.contratadas.toFixed(1)}h</TableCell>
                                <TableCell className="text-right text-emerald-500 font-semibold">{d.trabalhadas.toFixed(1)}h</TableCell>
                                <TableCell className="text-right font-semibold">{d.normais.toFixed(1)}h</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {d.excedentes > 0 ? (
                                    <span className="text-amber-500">+{d.excedentes.toFixed(1)}h</span>
                                  ) : (
                                    <span className="text-muted-foreground">0h</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Corretivas / Paradas */}
                  {corretivaMedicoes.length > 0 && (
                    <div>
                      <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" /> Registros de Parada / Corretiva
                      </h3>
                      <div className="border border-border/40 rounded-md">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead>Observações</TableHead>
                              <TableHead className="text-right">Horas Paradas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {corretivaMedicoes.map(m => (
                              <TableRow key={m.id}>
                                <TableCell>{m.data ? new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR") : ""}</TableCell>
                                <TableCell className="truncate max-w-[250px] text-muted-foreground" title={m.observacoes || ""}>
                                  {m.observacoes || "Sem observação"}
                                </TableCell>
                                <TableCell className="text-right font-bold text-destructive">
                                  {Number(m.horas_trabalhadas || 0).toFixed(1)}h
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50">
                              <TableCell colSpan={2} className="text-right font-bold">Total Corretivas</TableCell>
                              <TableCell className="text-right font-bold text-destructive">
                                {entry.horasCorretivas.toFixed(1)}h
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
