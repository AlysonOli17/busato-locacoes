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
  TrendingDown, Percent, BarChart3, AlertCircle, Clock
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend
} from "recharts";

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
}

export const RelatoriosGerenciaisTab = ({
  empresas,
  contratos,
  faturas,
  equipamentos,
  gastos,
  medicoes,
  contratosEquipamentos = [],
  faturamentoGastos = []
}: RelatoriosGerenciaisTabProps) => {
  // Filtros
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("all");
  const [selectedEquipamento, setSelectedEquipamento] = useState<string>("all");
  const [faturamentoEquipamentosList, setFaturamentoEquipamentosList] = useState<any[]>([]);

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
      const emissao = f.emissao;
      if (dataInicio && emissao < dataInicio) return false;
      if (dataFim && emissao > dataFim) return false;
      
      const ct = contratos.find(c => c.id === f.contrato_id);
      if (selectedEmpresa !== "all" && ct?.empresa_id !== selectedEmpresa) return false;
      if (selectedEquipamento !== "all" && ct?.equipamento_id !== selectedEquipamento) return false;
      
      return true;
    });
  }, [faturas, dataInicio, dataFim, selectedEmpresa, selectedEquipamento, contratos]);

  const gastosFiltrados = useMemo(() => {
    // Map gastos to their invoice fatura if linked via faturamentoGastos
    const gastoToFaturaMap = new Map<string, string>();
    (faturamentoGastos || []).forEach(fg => {
      if (fg.gasto_id && fg.faturamento_id) {
        gastoToFaturaMap.set(fg.gasto_id, fg.faturamento_id);
      }
    });

    return gastos.filter(g => {
      if (!g.data) return false;
      if (dataInicio && g.data < dataInicio) return false;
      if (dataFim && g.data > dataFim) return false;

      // Filter by machine
      if (selectedEquipamento !== "all" && g.equipamento_id !== selectedEquipamento) return false;

      // Filter by client
      if (selectedEmpresa !== "all") {
        const faturaId = gastoToFaturaMap.get(g.id);
        if (faturaId) {
          const fatura = faturas.find(f => f.id === faturaId);
          const ct = fatura ? contratos.find(c => c.id === fatura.contrato_id) : null;
          if (ct?.empresa_id !== selectedEmpresa) return false;
        } else {
          // If not linked to a specific invoice, find if machine was allocated to this client on that date
          const allocated = (contratosEquipamentos || []).some((ce: any) => {
            const ct = contratos.find(c => c.id === ce.contrato_id);
            if (ct?.empresa_id !== selectedEmpresa || ce.equipamento_id !== g.equipamento_id) return false;
            const start = ce.data_inicio || ct.data_inicio || "1970-01-01";
            const end = ce.data_devolucao || ct.data_fim || "9999-12-31";
            return g.data >= start && g.data <= end;
          });
          if (!allocated) return false;
        }
      }

      return true;
    });
  }, [gastos, dataInicio, dataFim, selectedEmpresa, selectedEquipamento, faturas, contratos, faturamentoGastos, contratosEquipamentos]);

  // 2. DRE Operacional
  const dreStats = useMemo(() => {
    const receitaBruta = faturasFiltradas
      .filter(f => f.status === "Pago" || f.status === "Aprovado")
      .reduce((sum, f) => sum + Number(f.valor_total || 0), 0);

    const tiposFixos = ["Seguro Patrimonial", "Rastreadores / Telecom", "Parcelas e Financiamentos"];
    const tiposManutencao = ["Manutenção", "Peças", "Combustível"];
    const tiposMobilizacao = ["Mobilização", "Desmobilização"];

    const custoManutencao = gastosFiltrados
      .filter(g => tiposManutencao.includes(g.tipo))
      .reduce((sum, g) => sum + Number(g.valor || 0), 0);

    const custoMobilizacao = gastosFiltrados
      .filter(g => tiposMobilizacao.includes(g.tipo))
      .reduce((sum, g) => sum + Number(g.valor || 0), 0);

    const custoFixo = gastosFiltrados
      .filter(g => tiposFixos.includes(g.tipo))
      .reduce((sum, g) => sum + Number(g.valor || 0), 0);

    const custoOutros = gastosFiltrados
      .filter(g => !tiposManutencao.includes(g.tipo) && !tiposMobilizacao.includes(g.tipo) && !tiposFixos.includes(g.tipo))
      .reduce((sum, g) => sum + Number(g.valor || 0), 0);

    const totalCustos = custoManutencao + custoMobilizacao + custoFixo + custoOutros;
    const resultadoEbitda = receitaBruta - totalCustos;
    const margemEbitda = receitaBruta > 0 ? (resultadoEbitda / receitaBruta) * 100 : 0;

    return {
      receitaBruta,
      custoManutencao,
      custoMobilizacao,
      custoFixo,
      custoOutros,
      totalCustos,
      resultadoEbitda,
      margemEbitda
    };
  }, [faturasFiltradas, gastosFiltrados]);

  // 3. Rentabilidade por Equipamento
  const rentabilidadeEquipamentos = useMemo(() => {
    return equipamentos.map(eq => {
      // Find all items in faturamento_equipamentos for this machine
      const eqItems = faturamentoEquipamentosList.filter(item => item.equipamento_id === eq.id);
      
      // Filter items whose parent faturamento matches our active filters (faturasFiltradas)
      // and is Pago or Aprovado
      let receita = 0;
      eqItems.forEach(item => {
        const fat = faturasFiltradas.find(f => f.id === item.faturamento_id && (f.status === "Pago" || f.status === "Aprovado"));
        if (fat) {
          const horasNormais = Number(item.horas_normais ?? item.horas_medidas ?? 0);
          const valorHora = Number(item.valor_hora ?? 0);
          const horasExcedentes = Number(item.horas_excedentes ?? 0);
          const valorHoraExcedente = Number(item.valor_hora_excedente ?? item.valor_excedente_hora ?? 0);
          
          const totalItem = (horasNormais * valorHora) + (horasExcedentes * valorHoraExcedente);
          receita += totalItem;
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
      }

      const eqGastos = gastosFiltrados.filter(g => g.equipamento_id === eq.id);
      const despesa = eqGastos.reduce((sum, g) => sum + Number(g.valor || 0), 0);
      const margem = receita - despesa;
      const margemPct = receita > 0 ? (margem / receita) * 100 : 0;

      return {
        id: eq.id,
        tipo: eq.tipo,
        modelo: eq.modelo,
        tag: eq.tag_placa || "Sem Placa",
        receita,
        despesa,
        margem,
        margemPct,
        status: eq.status
      };
    }).sort((a, b) => b.margem - a.margem);
  }, [equipamentos, faturasFiltradas, gastosFiltrados, contratos, faturamentoEquipamentosList]);

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

    faturasFiltradas.forEach(f => {
      if (f.status === "Pago" || f.status === "Cancelado") return;

      const prazo = f.contratos?.prazo_faturamento || 30;
      const dateStr = f.data_aprovacao || f.emissao;
      if (!dateStr) return;

      const baseDate = parseLocalDate(dateStr);
      if (isNaN(baseDate.getTime())) return;

      const vencimento = new Date(baseDate);
      vencimento.setDate(vencimento.getDate() + prazo);

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
  }, [faturasFiltradas]);

  // 5. Histórico Mensal para Gráfico DRE
  const chartData = useMemo(() => {
    const map: Record<string, { mes: string; Receita: number; Custos: number }> = {};
    
    faturasFiltradas
      .filter(f => f.status === "Pago" || f.status === "Aprovado")
      .forEach(f => {
        if (!f.emissao) return;
        const key = f.emissao.slice(0, 7); // YYYY-MM
        if (!map[key]) {
          const date = new Date(f.emissao + "T00:00:00");
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

    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, val]) => val);
  }, [faturasFiltradas, gastosFiltrados]);

  // Função para exportação simples em CSV
  const handleExportCSV = (tipo: "rentabilidade" | "dre" | "aging") => {
    let headers = "";
    let rows = [] as string[];
    let filename = "";

    if (tipo === "rentabilidade") {
      headers = "Equipamento;Placa/Tag;Receita (R$);Despesa (R$);Margem Líquida (R$);Margem (%)\n";
      rows = rentabilidadeEquipamentos.map(eq => 
        `"${eq.tipo} ${eq.modelo}";"${eq.tag}";${eq.receita.toFixed(2)};${eq.despesa.toFixed(2)};${eq.margem.toFixed(2)};${eq.margemPct.toFixed(1)}`
      );
      filename = "relatorio_rentabilidade_equipamentos.csv";
    } else if (tipo === "dre") {
      headers = "Categoria;Valor (R$);% da Receita\n";
      const r = dreStats;
      rows = [
        `"Receita Bruta";${r.receitaBruta.toFixed(2)};100.0`,
        `"Custos de Manutenção";${r.custoManutencao.toFixed(2)};${r.receitaBruta > 0 ? ((r.custoManutencao / r.receitaBruta) * 100).toFixed(1) : "0.0"}`,
        `"Custos de Mobilização";${r.custoMobilizacao.toFixed(2)};${r.receitaBruta > 0 ? ((r.custoMobilizacao / r.receitaBruta) * 100).toFixed(1) : "0.0"}`,
        `"Encargos Fixos (Seguros, Parcelas, Telecom)";${r.custoFixo.toFixed(2)};${r.receitaBruta > 0 ? ((r.custoFixo / r.receitaBruta) * 100).toFixed(1) : "0.0"}`,
        `"Outros Custos";${r.custoOutros.toFixed(2)};${r.receitaBruta > 0 ? ((r.custoOutros / r.receitaBruta) * 100).toFixed(1) : "0.0"}`,
        `"Total Custos Operacionais";${r.totalCustos.toFixed(2)};${r.receitaBruta > 0 ? ((r.totalCustos / r.receitaBruta) * 100).toFixed(1) : "0.0"}`,
        `"Resultado Operacional (EBITDA)";${r.resultadoEbitda.toFixed(2)};${r.margemEbitda.toFixed(1)}`
      ];
      filename = "dre_operacional.csv";
    } else if (tipo === "aging") {
      headers = "Nota Fiscal;Periodo;Cliente;Valor (R$);Vencimento;Dias Atraso;Faixa\n";
      rows = agingList.list.map(f => 
        `"${f.numeroNota}";"${f.periodo}";"${f.cliente}";${f.valor.toFixed(2)};"${f.vencimento}";${f.diasAtraso};"${f.status}"`
      );
      filename = "relatorio_aging_list.csv";
    }

    const blob = new Blob(["\uFEFF" + headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros */}
      <Card className="glass shadow-sm border border-border/40">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase">Data Início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-background/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase">Data Fim</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-background/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase">Cliente/Empresa</Label>
            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Clientes</SelectItem>
                {empresas.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase">Equipamento</Label>
            <Select value={selectedEquipamento} onValueChange={setSelectedEquipamento}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Equipamentos</SelectItem>
                {equipamentos.map(eq => (
                  <SelectItem key={eq.id} value={eq.id}>{eq.tipo} {eq.modelo} ({eq.tag_placa || "S/P"})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* DRE KPIs e Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel do DRE */}
        <Card className="glass shadow-sm border border-border/40 lg:col-span-1">
          <CardHeader className="pb-3 border-b border-border/10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                DRE Operacional Simplificado
              </CardTitle>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleExportCSV("dre")}>
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>Resumo de receitas e despesas no período</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-border/5">
              <span className="text-xs font-bold text-muted-foreground uppercase">Receita Bruta</span>
              <span className="text-sm font-black text-foreground">R$ {fmt(dreStats.receitaBruta)}</span>
            </div>
            <div className="space-y-2 py-2 border-b border-border/5">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Custos de Manutenção</span>
                <span className="font-semibold text-foreground">R$ {fmt(dreStats.custoManutencao)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Mobilização / Desmobilização</span>
                <span className="font-semibold text-foreground">R$ {fmt(dreStats.custoMobilizacao)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Encargos Fixos (Seguros, Parcelas)</span>
                <span className="font-semibold text-foreground">R$ {fmt(dreStats.custoFixo)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Outros Gastos Diretos</span>
                <span className="font-semibold text-foreground">R$ {fmt(dreStats.custoOutros)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-xs font-bold text-muted-foreground uppercase">Total Custos</span>
              <span className="text-xs font-bold text-destructive">R$ {fmt(dreStats.totalCustos)}</span>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl space-y-2 border border-border/40">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase">EBITDA da Operação</span>
                <span className={`text-sm font-black ${dreStats.resultadoEbitda >= 0 ? "text-success" : "text-destructive"}`}>
                  R$ {fmt(dreStats.resultadoEbitda)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Margem Operacional</span>
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
          <Button size="sm" variant="outline" className="h-8 gap-2 bg-background/50" onClick={() => handleExportCSV("rentabilidade")}>
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
                      <TableRow key={eq.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-bold text-xs text-foreground">{eq.tipo} {eq.modelo}</TableCell>
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
            <Button size="sm" variant="outline" className="h-8 gap-2 bg-background/50" onClick={() => handleExportCSV("aging")}>
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
    </div>
  );
};
