import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Clock, AlertTriangle, TrendingUp,
  Package, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight,
  Building2, CalendarClock,
  BarChart3, ChevronRight, AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────

const parseLocalDate = (dateStr: any): Date => {
  if (!dateStr) return new Date(NaN);
  const str = String(dateStr).trim();
  if (!str || str === "null" || str === "undefined") return new Date(NaN);
  return str.includes("T") ? new Date(str) : new Date(str + "T00:00:00");
};

const fmt = (v: any) => {
  const val = Number(v);
  if (isNaN(val)) return "0,00";
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtShort = (v: any) => {
  const val = Number(v);
  if (isNaN(val)) return "0";
  if (val >= 1_000_000) return "R$ " + (val / 1_000_000).toFixed(2) + "M";
  if (val >= 1_000) return "R$ " + (val / 1_000).toFixed(1) + "k";
  return "R$ " + val.toFixed(0);
};

const diffDays = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

const urgencyColor = (days: number) => {
  if (days <= 7) return { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" };
  if (days <= 14) return { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400", badge: "bg-amber-500/20 text-amber-300" };
  if (days <= 30) return { bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-400", badge: "bg-orange-500/20 text-orange-300" };
  return { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", badge: "bg-red-500/20 text-red-300" };
};

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── KPI Card ────────────────────────────────────────────────────────────────

const KpiCard = ({
  icon: Icon, label, value, sub, gradient, iconBg, onClick
}: {
  icon: any; label: string; value: string; sub?: string;
  gradient: string; iconBg: string; onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={`relative overflow-hidden rounded-2xl cursor-pointer group transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl shadow-lg ${gradient}`}
  >
    {/* Decorative glow blob */}
    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 blur-2xl bg-white" />
    <div className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg} shadow-inner`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        {onClick && <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-white/80 transition-colors mt-1" />}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1">{label}</p>
      <p className="text-2xl font-black tabular-nums leading-tight text-white drop-shadow">{value}</p>
      {sub && <p className="text-[11px] text-white/60 mt-1 leading-tight">{sub}</p>}
    </div>
  </div>
);

// ─── Section Header ───────────────────────────────────────────────────────────

const SectionTitle = ({ icon: Icon, title, sub, badge }: { icon: any; title: string; sub?: string; badge?: { label: string; variant: string } }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shadow-sm">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div>
      <h3 className="font-bold text-foreground leading-none">{title}</h3>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
    {badge && (
      <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full ${badge.variant}`}>
        {badge.label}
      </span>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const VisaoGeralTab = ({
  contratos = [],
  faturas = [],
  equipamentos = [],
  gastos = [],
  medicoes = [],
  contratosAditivos = [],
  aditivosEquipamentos = [],
  faturamentoGastos = [],
  contratosEquipamentos = [],
}: VisaoGeralTabProps) => {
  const [modalGastos, setModalGastos] = useState<null | "faturados" | "nao_faturados">(null);
  const [modalInadimplencia, setModalInadimplencia] = useState(false);
  const [modalPipeline, setModalPipeline] = useState(false);
  const [modalMedicoesAtrasadas, setModalMedicoesAtrasadas] = useState(false);
  const [modalContasReceber, setModalContasReceber] = useState(false);

  const hoje = useMemo(() => new Date(), []);

  // ── Gastos: faturados vs não faturados ──────────────────────────────────────
  const gastosFaturadosSet = useMemo(
    () => new Set((faturamentoGastos || []).map((fg) => fg.gasto_id)),
    [faturamentoGastos]
  );

  const gastosFaturados = useMemo(
    () => gastos.filter((g) => gastosFaturadosSet.has(g.id)),
    [gastos, gastosFaturadosSet]
  );

  const gastosNaoFaturados = useMemo(
    () => gastos.filter((g) => !gastosFaturadosSet.has(g.id)),
    [gastos, gastosFaturadosSet]
  );

  const totalGastosFaturados = useMemo(
    () => gastosFaturados.reduce((s, g) => s + Number(g.valor || 0), 0),
    [gastosFaturados]
  );

  const totalGastosNaoFaturados = useMemo(
    () => gastosNaoFaturados.reduce((s, g) => s + Number(g.valor || 0), 0),
    [gastosNaoFaturados]
  );

  // ── Contas a Receber (faturas Aprovado) ─────────────────────────────────────
  const faturasAprovadas = useMemo(
    () => faturas.filter((f) => f.status === "Aprovado"),
    [faturas]
  );

  const totalContasReceber = useMemo(
    () => faturasAprovadas.reduce((s, f) => s + Number(f.valor_total || 0), 0),
    [faturasAprovadas]
  );

  // ── Inadimplência (aprovadas com vencimento ultrapassado) ───────────────────
  const faturasVencidas = useMemo(() => {
    return faturas.filter((f) => {
      if (f.status === "Pago" || f.status === "Cancelado" || f.status === "Aguardando Aprovação") return false;
      const prazo = f.contratos?.prazo_faturamento || 30;
      const baseStr = f.data_aprovacao || f.emissao;
      if (!baseStr) return false;
      const base = parseLocalDate(baseStr);
      if (isNaN(base.getTime())) return false;
      const venc = new Date(base);
      venc.setDate(venc.getDate() + prazo);
      return venc < hoje;
    }).map((f) => {
      const prazo = f.contratos?.prazo_faturamento || 30;
      const base = parseLocalDate(f.data_aprovacao || f.emissao);
      const venc = new Date(base);
      venc.setDate(venc.getDate() + prazo);
      const diasAtraso = diffDays(venc, hoje);
      return { ...f, vencimento: venc, diasAtraso };
    }).sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [faturas, hoje]);

  const totalInadimplencia = useMemo(
    () => faturasVencidas.reduce((s, f) => s + Number(f.valor_total || 0), 0),
    [faturasVencidas]
  );

  // ── Pipeline de Faturamento (medições sem fatura) ───────────────────────────
  const pipelineFaturamento = useMemo(() => {
    // Períodos já faturados (pelo periodo_medicao_fim da fatura)
    const periodosFaturados = new Set(
      faturas
        .filter((f) => f.status !== "Cancelado" && f.periodo_medicao_fim)
        .map((f) => `${f.contrato_id}::${f.periodo_medicao_fim?.slice(0, 7)}`)
    );

    const result: {
      contratoId: string;
      cliente: string;
      equipamento: string;
      periodoFim: string;
      diasAguardando: number;
    }[] = [];

    contratos.filter((c) => c.status === "Ativo").forEach((c) => {
      // Monta o período atual de medição
      const diaFim = c.dia_medicao_fim || 30;
      const mesPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      // Período de medição que deveria já ter acontecido
      let periodoFimDate = new Date(mesPeriodo.getFullYear(), mesPeriodo.getMonth(), diaFim);
      // Se ainda não chegou o fim do período neste mês, olha para o mês anterior
      if (periodoFimDate > hoje) {
        periodoFimDate = new Date(mesPeriodo.getFullYear(), mesPeriodo.getMonth() - 1, diaFim);
      }

      const key = `${c.id}::${periodoFimDate.toISOString().slice(0, 7)}`;
      if (periodosFaturados.has(key)) return;

      const diasAguardando = diffDays(periodoFimDate, hoje);
      if (diasAguardando < 0) return;

      result.push({
        contratoId: c.id,
        cliente: c.empresas?.nome || "—",
        equipamento: c.equipamentos ? `${c.equipamentos.tipo} ${c.equipamentos.modelo}` : "—",
        periodoFim: periodoFimDate.toLocaleDateString("pt-BR"),
        diasAguardando,
      });
    });

    return result.sort((a, b) => b.diasAguardando - a.diasAguardando);
  }, [contratos, faturas, hoje]);

  // ── Medições Atrasadas ──────────────────────────────────────────────────────
  const medicoesAtrasadas = useMemo(() => {
    const medicoesSet = new Set(
      medicoes.map((m) => `${m.equipamento_id}::${(m.data || "").slice(0, 7)}`)
    );

    const result: {
      contratoId: string;
      cliente: string;
      equipamento: string;
      tag: string;
      diaLimite: string;
      diasAtraso: number;
    }[] = [];

    contratos.filter((c) => c.status === "Ativo").forEach((c) => {
      const diaFim = c.dia_medicao_fim || 30;
      const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const limiteMedicao = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), diaFim);

      // Só verifica se o prazo de medição já passou
      if (limiteMedicao > hoje) return;

      const equipId = c.equipamento_id;
      const mesKey = mesAtual.toISOString().slice(0, 7);
      const key = `${equipId}::${mesKey}`;

      if (!medicoesSet.has(key)) {
        const diasAtraso = diffDays(limiteMedicao, hoje);
        result.push({
          contratoId: c.id,
          cliente: c.empresas?.nome || "—",
          equipamento: c.equipamentos ? `${c.equipamentos.tipo} ${c.equipamentos.modelo}` : "—",
          tag: c.equipamentos?.tag_placa || "—",
          diaLimite: limiteMedicao.toLocaleDateString("pt-BR"),
          diasAtraso,
        });
      }
    });

    return result.sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [contratos, medicoes, hoje]);

  // ── Breakdown por Cliente ───────────────────────────────────────────────────
  const clientesBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        nome: string;
        totalFaturado: number;
        totalPago: number;
        totalPendente: number;
        totalVencido: number;
        contratosAtivos: number;
        faturas: any[];
      }
    >();

    faturas.filter((f) => f.status !== "Cancelado").forEach((f) => {
      const empresa = f.contratos?.empresas;
      if (!empresa) return;
      const key = String(empresa.id || empresa.nome);
      if (!map.has(key)) {
        map.set(key, {
          nome: empresa.nome || "—",
          totalFaturado: 0,
          totalPago: 0,
          totalPendente: 0,
          totalVencido: 0,
          contratosAtivos: 0,
          faturas: [],
        });
      }
      const entry = map.get(key)!;
      const valor = Number(f.valor_total || 0);
      entry.totalFaturado += valor;
      entry.faturas.push(f);
      if (f.status === "Pago") entry.totalPago += valor;
      if (f.status === "Aprovado") {
        entry.totalPendente += valor;
        // Verificar se vencido
        const prazo = f.contratos?.prazo_faturamento || 30;
        const base = parseLocalDate(f.data_aprovacao || f.emissao);
        if (!isNaN(base.getTime())) {
          const venc = new Date(base);
          venc.setDate(venc.getDate() + prazo);
          if (venc < hoje) entry.totalVencido += valor;
        }
      }
    });

    contratos.filter((c) => c.status === "Ativo" && c.empresas).forEach((c) => {
      const key = String(c.empresas.id || c.empresas.nome);
      if (!map.has(key)) {
        map.set(key, {
          nome: c.empresas.nome || "—",
          totalFaturado: 0,
          totalPago: 0,
          totalPendente: 0,
          totalVencido: 0,
          contratosAtivos: 0,
          faturas: [],
        });
      }
      map.get(key)!.contratosAtivos += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.totalFaturado - a.totalFaturado);
  }, [faturas, contratos, hoje]);

  // ── Gráfico Mensal ──────────────────────────────────────────────────────────
  const mensalData = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const mk = d.toISOString().slice(0, 7);

      const receita = faturas
        .filter((f) => f.status !== "Cancelado" && (f.emissao || "").slice(0, 7) === mk)
        .reduce((s, f) => s + Number(f.valor_total || 0), 0);

      const pago = faturas
        .filter((f) => f.status === "Pago" && (f.emissao || "").slice(0, 7) === mk)
        .reduce((s, f) => s + Number(f.valor_total || 0), 0);

      const custo = gastos
        .filter((g) => (g.data || "").slice(0, 7) === mk)
        .reduce((s, g) => s + Number(g.valor || 0), 0);

      result.push({ mes: label, Faturado: receita, Recebido: pago, Custos: custo });
    }
    return result;
  }, [faturas, gastos, hoje]);

  // ── Previsão do mês ─────────────────────────────────────────────────────────
  const previsaoMes = useMemo(() => {
    const mk = hoje.toISOString().slice(0, 7);
    const hojeIso = hoje.toISOString().slice(0, 10);
    return contratos
      .filter((c) => c.status === "Ativo" && c.data_inicio <= hojeIso && c.data_fim >= hojeIso)
      .reduce((s, c) => s + Number(c.valor_hora || 0) * Number(c.horas_contratadas || 160), 0);
  }, [contratos, hoje]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── KPIs Executivos ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <span className="inline-block w-3 h-0.5 bg-primary rounded" />
          Indicadores Executivos
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard
            icon={ArrowUpRight}
            label="Contas a Receber"
            value={fmtShort(totalContasReceber)}
            sub={`${faturasAprovadas.length} título${faturasAprovadas.length !== 1 ? "s" : ""} em aberto`}
            gradient="bg-gradient-to-br from-blue-500 to-blue-700"
            iconBg="bg-blue-400/30"
            onClick={() => setModalContasReceber(true)}
          />
          <KpiCard
            icon={AlertCircle}
            label="Inadimplência"
            value={fmtShort(totalInadimplencia)}
            sub={`${faturasVencidas.length} fatura${faturasVencidas.length !== 1 ? "s" : ""} vencida${faturasVencidas.length !== 1 ? "s" : ""}`}
            gradient="bg-gradient-to-br from-rose-500 to-red-700"
            iconBg="bg-rose-400/30"
            onClick={() => setModalInadimplencia(true)}
          />
          <KpiCard
            icon={TrendingUp}
            label="Previsão do Mês"
            value={fmtShort(previsaoMes)}
            sub={`${contratos.filter((c) => c.status === "Ativo").length} contratos ativos`}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-700"
            iconBg="bg-emerald-400/30"
          />
          <KpiCard
            icon={Package}
            label="Gastos Faturados"
            value={fmtShort(totalGastosFaturados)}
            sub={`${gastosFaturados.length} deduzidos em faturas`}
            gradient="bg-gradient-to-br from-violet-500 to-purple-700"
            iconBg="bg-violet-400/30"
            onClick={() => setModalGastos("faturados")}
          />
          <KpiCard
            icon={XCircle}
            label="Gastos Não Faturados"
            value={fmtShort(totalGastosNaoFaturados)}
            sub={`${gastosNaoFaturados.length} fora de faturas`}
            gradient="bg-gradient-to-br from-orange-500 to-amber-700"
            iconBg="bg-orange-400/30"
            onClick={() => setModalGastos("nao_faturados")}
          />
          <KpiCard
            icon={CalendarClock}
            label="Aguard. Faturamento"
            value={String(pipelineFaturamento.length)}
            sub={pipelineFaturamento.length > 0 ? `Maior: ${pipelineFaturamento[0]?.diasAguardando}d — ${pipelineFaturamento[0]?.cliente}` : "Tudo em dia ✓"}
            gradient={pipelineFaturamento.length > 0 ? "bg-gradient-to-br from-amber-500 to-yellow-700" : "bg-gradient-to-br from-slate-500 to-slate-700"}
            iconBg="bg-amber-400/30"
            onClick={() => setModalPipeline(true)}
          />
        </div>
      </div>

      {/* ── Linha 2: Pipeline de Faturamento + Medições Atrasadas ──────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Pipeline de Faturamento */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <SectionTitle
              icon={CalendarClock}
              title="Pipeline de Faturamento"
              sub="Contratos ativos aguardando emissão de fatura"
              badge={
                pipelineFaturamento.length > 0
                  ? { label: `${pipelineFaturamento.length} pendente${pipelineFaturamento.length > 1 ? "s" : ""}`, variant: "bg-amber-500/20 text-amber-400" }
                  : { label: "Em dia ✓", variant: "bg-emerald-500/20 text-emerald-400" }
              }
            />
          </CardHeader>
          <CardContent className="p-0">
            {pipelineFaturamento.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-500/60" />
                <p className="text-sm font-medium">Nenhum faturamento pendente</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
                  {pipelineFaturamento.slice(0, 8).map((item, i) => {
                    const urg = urgencyColor(item.diasAguardando);
                    return (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 border-l-2 ${urg.bg} ${i === 0 ? "" : ""}`} style={{ borderLeftColor: "transparent" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{item.cliente}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.equipamento}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${urg.badge}`}>
                            {item.diasAguardando}d
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-1">desde {item.periodoFim}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {pipelineFaturamento.length > 8 && (
                  <button
                    className="w-full py-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    onClick={() => setModalPipeline(true)}
                  >
                    Ver todos ({pipelineFaturamento.length})
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Medições Atrasadas */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <SectionTitle
              icon={Clock}
              title="Medições Atrasadas"
              sub="Contratos com medição do mês não registrada"
              badge={
                medicoesAtrasadas.length > 0
                  ? { label: `${medicoesAtrasadas.length} em atraso`, variant: "bg-red-500/20 text-red-400" }
                  : { label: "Em dia ✓", variant: "bg-emerald-500/20 text-emerald-400" }
              }
            />
          </CardHeader>
          <CardContent className="p-0">
            {medicoesAtrasadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-500/60" />
                <p className="text-sm font-medium">Todas as medições registradas</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
                  {medicoesAtrasadas.slice(0, 8).map((item, i) => {
                    const urg = urgencyColor(item.diasAtraso);
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{item.cliente}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.equipamento} · {item.tag}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${urg.badge}`}>
                            {item.diasAtraso}d atraso
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-1">limite {item.diaLimite}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {medicoesAtrasadas.length > 8 && (
                  <button
                    className="w-full py-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    onClick={() => setModalMedicoesAtrasadas(true)}
                  >
                    Ver todos ({medicoesAtrasadas.length})
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Inadimplência por Cliente ────────────────────────────────────────── */}
      {faturasVencidas.length > 0 && (
        <Card className="border-red-500/20 shadow-sm bg-red-500/3">
          <CardHeader className="pb-3">
            <SectionTitle
              icon={AlertTriangle}
              title="Inadimplência"
              sub="Faturas com prazo de recebimento ultrapassado"
              badge={{ label: `R$ ${fmt(totalInadimplencia)} em aberto`, variant: "bg-red-500/20 text-red-400" }}
            />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Fatura</TableHead>
                  <TableHead className="text-xs">Vencimento</TableHead>
                  <TableHead className="text-xs">Atraso</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs">Urgência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturasVencidas.slice(0, 8).map((f, i) => {
                  const urg = urgencyColor(f.diasAtraso);
                  const pct = Math.min(100, (f.diasAtraso / 60) * 100);
                  return (
                    <TableRow key={i} className="border-border/30">
                      <TableCell className="py-2.5">
                        <p className="font-semibold text-sm">{f.contratos?.empresas?.nome || "—"}</p>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        {f.numero_nota || `#${f.numero_sequencial || f.id?.slice(-5)}`}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        {f.vencimento?.toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urg.badge}`}>
                          {f.diasAtraso}d
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-bold text-sm">
                        R$ {fmt(f.valor_total)}
                      </TableCell>
                      <TableCell className="py-2.5 w-24">
                        <Progress value={pct} className="h-1.5" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {faturasVencidas.length > 8 && (
              <div className="p-3 text-center">
                <button
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                  onClick={() => setModalInadimplencia(true)}
                >
                  Ver todas ({faturasVencidas.length} faturas vencidas)
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Breakdown por Cliente ─────────────────────────────────────────────── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <SectionTitle
            icon={Building2}
            title="Posição por Cliente"
            sub="Faturamento, recebimentos e pendências por empresa"
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40">
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs text-right">Faturado</TableHead>
                <TableHead className="text-xs text-right">Recebido</TableHead>
                <TableHead className="text-xs text-right">Pendente</TableHead>
                <TableHead className="text-xs text-right">Vencido</TableHead>
                <TableHead className="text-xs">% Pago</TableHead>
                <TableHead className="text-xs text-center">Contratos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesBreakdown.map((c, i) => {
                const pct = c.totalFaturado > 0 ? (c.totalPago / c.totalFaturado) * 100 : 0;
                const hasVencido = c.totalVencido > 0;
                return (
                  <TableRow key={i} className="border-border/30 group hover:bg-muted/30 transition-colors">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <p className="font-semibold text-sm">{c.nome}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-mono">
                      R$ {fmt(c.totalFaturado)}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-mono text-emerald-500">
                      R$ {fmt(c.totalPago)}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-mono text-amber-500">
                      R$ {fmt(c.totalPendente)}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-mono">
                      {hasVencido ? (
                        <span className="text-red-400 font-bold">R$ {fmt(c.totalVencido)}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 w-32">
                      <div className="space-y-1">
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground text-right">{pct.toFixed(0)}%</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">
                        {c.contratosAtivos}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Gráfico Mensal ────────────────────────────────────────────────────── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <SectionTitle
            icon={BarChart3}
            title="Evolução Financeira Mensal"
            sub="Faturado × Recebido × Custos — últimos 6 meses"
          />
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mensalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(221,83%,53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142,71%,45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142,71%,45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCust" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(348,83%,47%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(348,83%,47%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtShort(v).replace("R$ ", "")} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-3 min-w-[180px]">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                        {payload.map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between gap-4 text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
                              {p.name}
                            </span>
                            <span className="font-bold">R$ {fmt(p.value)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="Faturado" stroke="hsl(221,83%,53%)" strokeWidth={2} fill="url(#gradFat)" />
                <Area type="monotone" dataKey="Recebido" stroke="hsl(142,71%,45%)" strokeWidth={2} fill="url(#gradRec)" />
                <Area type="monotone" dataKey="Custos" stroke="hsl(348,83%,47%)" strokeWidth={2} fill="url(#gradCust)" strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-2">
            {[
              { color: "hsl(221,83%,53%)", label: "Faturado" },
              { color: "hsl(142,71%,45%)", label: "Recebido" },
              { color: "hsl(348,83%,47%)", label: "Custos" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 inline-block rounded" style={{ background: l.color }} />
                <span className="text-xs text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════ MODALS ══════════════ */}

      {/* Modal Gastos */}
      <Dialog open={modalGastos !== null} onOpenChange={() => setModalGastos(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalGastos === "faturados" ? (
                <><Package className="h-5 w-5 text-violet-400" /> Gastos Faturados (deduzidos em faturas)</>
              ) : (
                <><XCircle className="h-5 w-5 text-orange-400" /> Gastos Não Faturados (fora de faturas)</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-black text-lg">
                R$ {fmt(modalGastos === "faturados" ? totalGastosFaturados : totalGastosNaoFaturados)}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Equipamento</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(modalGastos === "faturados" ? gastosFaturados : gastosNaoFaturados)
                  .slice(0, 100)
                  .map((g, i) => {
                    const eq = equipamentos.find((e) => e.id === g.equipamento_id);
                    return (
                      <TableRow key={i} className="border-border/30">
                        <TableCell className="py-2">
                          <Badge variant="outline" className="text-[10px]">{g.tipo || "—"}</Badge>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {g.data ? parseLocalDate(g.data).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {eq ? `${eq.tipo} ${eq.modelo}` : "—"}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                          {g.descricao || g.observacoes || "—"}
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm font-bold">
                          R$ {fmt(g.valor)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Contas a Receber */}
      <Dialog open={modalContasReceber} onOpenChange={setModalContasReceber}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-blue-400" /> Contas a Receber
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm text-muted-foreground">{faturasAprovadas.length} faturas em aberto</span>
              <span className="font-black text-lg">R$ {fmt(totalContasReceber)}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Nº Nota</TableHead>
                  <TableHead className="text-xs">Emissão</TableHead>
                  <TableHead className="text-xs">Vencimento</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturasAprovadas.map((f, i) => {
                  const prazo = f.contratos?.prazo_faturamento || 30;
                  const base = parseLocalDate(f.data_aprovacao || f.emissao);
                  let vencStr = "—";
                  if (!isNaN(base.getTime())) {
                    const venc = new Date(base);
                    venc.setDate(venc.getDate() + prazo);
                    vencStr = venc.toLocaleDateString("pt-BR");
                  }
                  return (
                    <TableRow key={i} className="border-border/30">
                      <TableCell className="py-2 font-semibold text-sm">
                        {f.contratos?.empresas?.nome || "—"}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {f.numero_nota || `#${f.numero_sequencial || f.id?.slice(-5)}`}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {f.emissao ? parseLocalDate(f.emissao).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="py-2 text-xs">{vencStr}</TableCell>
                      <TableCell className="py-2 text-right font-bold">
                        R$ {fmt(f.valor_total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Inadimplência */}
      <Dialog open={modalInadimplencia} onOpenChange={setModalInadimplencia}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" /> Inadimplência — Faturas Vencidas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
              <span className="text-sm text-muted-foreground">{faturasVencidas.length} faturas vencidas</span>
              <span className="font-black text-lg text-red-400">R$ {fmt(totalInadimplencia)}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Fatura</TableHead>
                  <TableHead className="text-xs">Vencimento</TableHead>
                  <TableHead className="text-xs">Atraso</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturasVencidas.map((f, i) => {
                  const urg = urgencyColor(f.diasAtraso);
                  return (
                    <TableRow key={i} className="border-border/30">
                      <TableCell className="py-2 font-semibold text-sm">
                        {f.contratos?.empresas?.nome || "—"}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {f.numero_nota || `#${f.numero_sequencial || f.id?.slice(-5)}`}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {f.vencimento?.toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="py-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urg.badge}`}>
                          {f.diasAtraso}d
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-right font-bold text-red-400">
                        R$ {fmt(f.valor_total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Pipeline Faturamento */}
      <Dialog open={modalPipeline} onOpenChange={setModalPipeline}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-400" /> Pipeline — Aguardando Faturamento
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Equipamento</TableHead>
                <TableHead className="text-xs">Fim do Período</TableHead>
                <TableHead className="text-xs">Aguardando</TableHead>
                <TableHead className="text-xs">Urgência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pipelineFaturamento.map((item, i) => {
                const urg = urgencyColor(item.diasAguardando);
                return (
                  <TableRow key={i} className="border-border/30">
                    <TableCell className="py-2 font-semibold text-sm">{item.cliente}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{item.equipamento}</TableCell>
                    <TableCell className="py-2 text-xs">{item.periodoFim}</TableCell>
                    <TableCell className="py-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urg.badge}`}>
                        {item.diasAguardando} dias
                      </span>
                    </TableCell>
                    <TableCell className="py-2 w-28">
                      <Progress value={Math.min(100, (item.diasAguardando / 30) * 100)} className="h-1.5" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Modal Medições Atrasadas */}
      <Dialog open={modalMedicoesAtrasadas} onOpenChange={setModalMedicoesAtrasadas}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-400" /> Medições Atrasadas
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Equipamento</TableHead>
                <TableHead className="text-xs">Tag/Placa</TableHead>
                <TableHead className="text-xs">Limite</TableHead>
                <TableHead className="text-xs">Atraso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medicoesAtrasadas.map((item, i) => {
                const urg = urgencyColor(item.diasAtraso);
                return (
                  <TableRow key={i} className="border-border/30">
                    <TableCell className="py-2 font-semibold text-sm">{item.cliente}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{item.equipamento}</TableCell>
                    <TableCell className="py-2 text-xs">{item.tag}</TableCell>
                    <TableCell className="py-2 text-xs">{item.diaLimite}</TableCell>
                    <TableCell className="py-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urg.badge}`}>
                        {item.diasAtraso}d
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

    </div>
  );
};
