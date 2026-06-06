import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withCache, clearCache } from "@/lib/cache";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SortableTableHead } from "@/components/SortableTableHead";
import { 
  Building2, Receipt, Clock, AlertTriangle, TrendingUp, 
  FileDown, FileSpreadsheet, Link2, CalendarClock, ChevronDown, ChevronRight 
} from "lucide-react";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  obra: string | null;
}

interface Contrato {
  id: string;
  empresa_id: string;
  equipamento_id: string;
  status: string;
  data_inicio: string;
  data_fim: string;
  dia_medicao_inicio?: number;
  dia_medicao_fim?: number;
  prazo_faturamento?: number;
  empresas?: Empresa | null;
  equipamentos?: { tipo: string; modelo: string } | null;
  contratos_equipamentos?: any[];
}

interface Fatura {
  id: string;
  contrato_id: string;
  numero_sequencial: number;
  periodo: string;
  valor_total: number;
  status: string;
  emissao: string;
  numero_nota: string | null;
  periodo_medicao_inicio: string | null;
  periodo_medicao_fim: string | null;
  contratos: Contrato;
  data_aprovacao: string | null;
}

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

const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthKey = (dateStr: string) => dateStr.slice(0, 7);
const competenciaFromPeriod = (period: { inicio: string; fim: string }) => monthKey(period.inicio);
const formatCompetencia = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return `${meses[(month || 1) - 1]}/${year}`;
};

const parsePeriodoKey = (periodo?: string | null) => {
  if (!periodo) return null;
  const normalized = periodo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const monthIndex = meses.findIndex(m => normalized.includes(m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
  const year = periodo.match(/\b(20\d{2}|19\d{2})\b/)?.[1];
  if (monthIndex < 0 || !year) return null;
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
};

// Custom Hook to load all shared data for billing reports
function useFinanceiroData() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [contratosEquipamentos, setContratosEquipamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshFaturas = async (force = false) => {
    if (force) clearCache();
    const [fatRes, ctRes, empRes, eqRes, ceRes, medRes, adRes, aeRes] = await withCache("financeiro_views", 5 * 60 * 1000, async () => Promise.all([
      supabase.from("faturamento").select("*").order("emissao", { ascending: false }),
      supabase.from("contratos").select("*").order("created_at", { ascending: false }),
      supabase.from("empresas").select("id, nome, cnpj, obra").order("nome"),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa"),
      supabase.from("contratos_equipamentos").select("*"),
      supabase.from("medicoes").select("*").order("data", { ascending: false }),
      supabase.from("contratos_aditivos").select("*"),
      supabase.from("aditivos_equipamentos").select("*")
    ]));

    if (fatRes.data && ctRes.data && empRes.data && eqRes.data) {
      setEmpresas(empRes.data as Empresa[]);
      setEquipamentos(eqRes.data);
      if (medRes.data) setMedicoes(medRes.data);
      if (ceRes.data) setContratosEquipamentos(ceRes.data);

      const empMap = new Map(empRes.data.map((e: any) => [e.id, e]));
      const eqMap = new Map(eqRes.data.map((e: any) => [e.id, e]));
      
      const ceMap = new Map<string, any[]>();
      if (ceRes.data) {
        ceRes.data.forEach((ce: any) => {
          const list = ceMap.get(ce.contrato_id) || [];
          list.push(ce);
          ceMap.set(ce.contrato_id, list);
        });
      }

      const aeMap = new Map<string, any[]>();
      if (aeRes.data) {
        aeRes.data.forEach((ae: any) => {
          const list = aeMap.get(ae.aditivo_id) || [];
          list.push(ae);
          aeMap.set(ae.aditivo_id, list);
        });
      }

      const adMap = new Map<string, any[]>();
      if (adRes.data) {
        adRes.data.forEach((ad: any) => {
          const list = adMap.get(ad.contrato_id) || [];
          list.push({
            ...ad,
            aditivos_equipamentos: aeMap.get(ad.id) || []
          });
          adMap.set(ad.contrato_id, list);
        });
      }

      const mappedContratos = ctRes.data.map((c: any) => ({
        ...c,
        empresas: empMap.get(c.empresa_id) || null,
        equipamentos: eqMap.get(c.equipamento_id) || null,
        contratos_equipamentos: ceMap.get(c.id) || [],
        contratos_aditivos: adMap.get(c.id) || []
      }));
      setContratos(mappedContratos as unknown as Contrato[]);

      const ctMap = new Map(mappedContratos.map(c => [c.id, c]));
      const mappedFaturas = fatRes.data.map((f: any) => ({
        ...f,
        contratos: ctMap.get(f.contrato_id) || null
      }));
      setFaturas(mappedFaturas as unknown as Fatura[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshFaturas();
  }, []);

  return { empresas, contratos, faturas, medicoes, equipamentos, contratosEquipamentos, loading, refreshFaturas };
}

function getVencimento(fatura: Fatura) {
  const prazo = fatura.contratos?.prazo_faturamento || 30;
  const dateStr = fatura.emissao || fatura.data_aprovacao;
  if (!dateStr) return null;
  const baseDate = parseLocalDate(dateStr);
  if (isNaN(baseDate.getTime())) return null;
  const venc = new Date(baseDate);
  venc.setDate(venc.getDate() + prazo);
  return venc;
}

function getDisplayStatus(fatura: Fatura) {
  if (fatura.status === "Pago" || fatura.status === "Cancelado") return fatura.status;
  const venc = getVencimento(fatura);
  if (venc && new Date() > venc) return "Em Atraso";
  return "Pendente";
}

const calcPeriodForMonth = (ct: Contrato, year: number, month: number) => {
  const diaInicio = ct.dia_medicao_inicio || 1;
  const diaFim = ct.dia_medicao_fim || 30;
  let mesInicio = month;
  let anoInicio = year;
  let mesFim = month;
  let anoFim = year;
  if (diaFim < diaInicio) {
    mesFim = month;
    anoFim = year;
    mesInicio = month - 1;
    if (mesInicio < 0) { mesInicio = 11; anoInicio--; }
  }
  const lastDayInicio = new Date(anoInicio, mesInicio + 1, 0).getDate();
  const lastDayFim = new Date(anoFim, mesFim + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const inicio = `${anoInicio}-${pad(mesInicio + 1)}-${pad(Math.min(diaInicio, lastDayInicio))}`;
  const fim = `${anoFim}-${pad(mesFim + 1)}-${pad(Math.min(diaFim, lastDayFim))}`;
  return { inicio, fim };
};

// Base view wrapper providing filters and KPI cards
interface BaseViewProps {
  children: React.ReactNode;
  filtroEmpresa: string;
  setFiltroEmpresa: (id: string) => void;
  empresas: Empresa[];
  faturasFiltered: Fatura[];
  contratosAtivos: Contrato[];
}

function SharedDashboardHeader({
  children,
  filtroEmpresa,
  setFiltroEmpresa,
  empresas,
  faturasFiltered,
  contratosAtivos
}: BaseViewProps) {
  const totalFaturado = faturasFiltered.filter(f => f.status === "Pago").reduce((s, f) => s + Number(f.valor_total), 0);
  const totalPendente = faturasFiltered.filter(f => getDisplayStatus(f) === "Pendente").reduce((s, f) => s + Number(f.valor_total), 0);
  const totalAtraso = faturasFiltered.filter(f => getDisplayStatus(f) === "Em Atraso").reduce((s, f) => s + Number(f.valor_total), 0);
  const qtdAtraso = faturasFiltered.filter(f => getDisplayStatus(f) === "Em Atraso").length;

  return (
    <div className="space-y-6">


      {/* KPI Cards - Compact Premium Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card/45 backdrop-blur-sm border-border/80 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center text-success shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Faturado (Pago)</p>
              <h3 className="text-base font-bold text-success truncate mt-0.5">R$ {totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 backdrop-blur-sm border-border/80 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center text-warning shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pendente</p>
              <h3 className="text-base font-bold text-warning truncate mt-0.5">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 backdrop-blur-sm border-border/80 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Em Atraso</p>
                {qtdAtraso > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-destructive/15 text-destructive animate-pulse">
                    {qtdAtraso}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-destructive truncate mt-0.5">R$ {totalAtraso.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 backdrop-blur-sm border-border/80 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contratos Ativos</p>
              <h3 className="text-base font-bold text-foreground mt-0.5">{contratosAtivos.length}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {children}
    </div>
  );
}

// 1. PENDENTE DE MEDIÇÃO VIEW
export function PendenteMedicaoView() {
  const { empresas, contratos, faturas, medicoes, loading, refreshFaturas } = useFinanceiroData();
  const [filtroEmpresa, setFiltroEmpresa] = useState("all");
  const [vincularDialog, setVincularDialog] = useState<{ open: boolean; alerta: any | null; faturaId: string }>({ open: false, alerta: null, faturaId: "" });
  const { toast } = useToast();

  const contratosAtivos = useMemo(() => {
    return contratos.filter(c => c.status === "Ativo" && (filtroEmpresa === "all" || c.empresa_id === filtroEmpresa));
  }, [contratos, filtroEmpresa]);

  const alertasPendentes = useMemo(() => {
    const hoje = new Date();
    type Alerta = {
      contrato: Contrato;
      period: { inicio: string; fim: string };
      tipo: "medicao" | "faturamento";
    };
    const alertas: Alerta[] = [];

    contratosAtivos.forEach(ct => {
      const dataInicio = parseLocalDate(ct.data_inicio);
      if (isNaN(dataInicio.getTime()) || hoje < dataInicio) return;

      const faturasContrato = faturas.filter(f => f.contrato_id === ct.id);
      if (faturasContrato.length === 0) return;

      const primeiraMedicao = faturasContrato
        .map(f => f.periodo_medicao_inicio || (() => {
          const periodoKey = parsePeriodoKey(f.periodo);
          return periodoKey ? `${periodoKey}-01` : null;
        })())
        .filter((p): p is string => !!p)
        .sort()[0];
      if (!primeiraMedicao) return;

      for (let offset = 0; offset <= 3; offset++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - offset, 1);
        const period = calcPeriodForMonth(ct, d.getFullYear(), d.getMonth());

        if (period.inicio < ct.data_inicio) continue;
        if (period.inicio < primeiraMedicao) continue;
        const periodEnd = parseLocalDate(period.fim);
        if (hoje <= periodEnd) continue;

        // Check if all equipments in this contract have been returned before this period starts
        const ces = ct.contratos_equipamentos || [];
        const ads = (ct as any).contratos_aditivos || [];
        const globalDev: Record<string, string> = {};
        for (const ce of ces) {
          if (ce.data_devolucao && (!globalDev[ce.equipamento_id] || ce.data_devolucao > globalDev[ce.equipamento_id])) {
            globalDev[ce.equipamento_id] = ce.data_devolucao;
          }
        }
        for (const ad of ads) {
          for (const ae of (ad.aditivos_equipamentos || [])) {
            if (ae.data_devolucao && (!globalDev[ae.equipamento_id] || ae.data_devolucao > globalDev[ae.equipamento_id])) {
              globalDev[ae.equipamento_id] = ae.data_devolucao;
            }
          }
        }

        const allEquipIds = new Set<string>();
        for (const ce of ces) {
          allEquipIds.add(ce.equipamento_id);
        }
        for (const ad of ads) {
          for (const ae of (ad.aditivos_equipamentos || [])) {
            allEquipIds.add(ae.equipamento_id);
          }
        }
        if (allEquipIds.size === 0 && ct.equipamento_id) {
          allEquipIds.add(ct.equipamento_id);
        }

        if (allEquipIds.size > 0) {
          const allReturnedBeforePeriod = Array.from(allEquipIds).every(eqId => {
            const devDate = globalDev[eqId];
            return devDate && devDate <= period.inicio;
          });
          if (allReturnedBeforePeriod) continue;
        }

        const competencias = new Set([monthKey(period.inicio), monthKey(period.fim)]);
        const faturado = faturasContrato.some(f => {
          const periodoKey = parsePeriodoKey(f.periodo);
          if (f.periodo_medicao_inicio && f.periodo_medicao_fim) {
            return f.periodo_medicao_inicio <= period.fim && f.periodo_medicao_fim >= period.inicio;
          }
          if (f.periodo_medicao_inicio) return f.periodo_medicao_inicio >= period.inicio && f.periodo_medicao_inicio <= period.fim;
          if (f.periodo_medicao_fim) return f.periodo_medicao_fim >= period.inicio && f.periodo_medicao_fim <= period.fim;
          return !!periodoKey && competencias.has(periodoKey);
        });
        if (faturado) continue;

        const contratoEquipIds = new Set([ct.equipamento_id, ...(ct.contratos_equipamentos || []).map(e => e.equipamento_id)]);
        const temMedicao = medicoes.some(m => {
          if (!contratoEquipIds.has(m.equipamento_id)) return false;
          return m.data >= period.inicio && m.data <= period.fim;
        });

        if (!temMedicao) {
          alertas.push({ contrato: ct, period, tipo: "medicao" });
        } else {
          alertas.push({ contrato: ct, period, tipo: "faturamento" });
        }
      }
    });

    return alertas;
  }, [contratosAtivos, faturas, medicoes]);

  const faturasFiltered = useMemo(() => {
    if (filtroEmpresa === "all") return faturas;
    return faturas.filter(f => f.contratos?.empresa_id === filtroEmpresa);
  }, [faturas, filtroEmpresa]);

  const vincularFaturaAoPeriodo = async () => {
    if (!vincularDialog.alerta || !vincularDialog.faturaId) return;
    const { alerta, faturaId } = vincularDialog;
    const { error } = await supabase
      .from("faturamento")
      .update({ periodo_medicao_inicio: alerta.period.inicio, periodo_medicao_fim: alerta.period.fim })
      .eq("id", faturaId);
    if (error) {
      toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Período vinculado", description: "Fatura associada ao período corretamente." });
    setVincularDialog({ open: false, alerta: null, faturaId: "" });
    await refreshFaturas(true);
  };

  const getExportData = () => {
    const headers = ["Empresa", "Competência", "Período", "Status / Pendência"];
    const rows = alertasPendentes.map(a => [
      a.contrato.empresas?.nome || "",
      formatCompetencia(competenciaFromPeriod(a.period)),
      `${parseLocalDate(a.period.inicio).toLocaleDateString("pt-BR")} — ${parseLocalDate(a.period.fim).toLocaleDateString("pt-BR")}`,
      a.tipo === "medicao" ? "Pendente de Medição" : "Pendente de Faturamento"
    ]);
    return { title: "Relatório de Pendências de Medição e Faturamento", headers, rows, filename: `pendencias_${new Date().toISOString().slice(0, 10)}` };
  };

  const empresasComAlerta = empresas.filter(emp => {
    if (filtroEmpresa !== "all" && emp.id !== filtroEmpresa) return false;
    return alertasPendentes.some(a => a.contrato.empresa_id === emp.id);
  });

  const alertasMedicao = alertasPendentes.filter(a => a.tipo === "medicao");
  const alertasFat = alertasPendentes.filter(a => a.tipo === "faturamento");

  return (
    <SharedDashboardHeader
      filtroEmpresa={filtroEmpresa}
      setFiltroEmpresa={setFiltroEmpresa}
      empresas={empresas}
      faturasFiltered={faturasFiltered}
      contratosAtivos={contratosAtivos}
    >
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando dados...</div>
      ) : empresasComAlerta.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-lg bg-card text-muted-foreground">
          Nenhuma medição ou faturamento pendente no momento.
        </div>
      ) : (
        <div className="space-y-6 mt-6">
          {alertasMedicao.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Pendente de Medição ({alertasMedicao.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {empresasComAlerta.filter(emp => alertasMedicao.some(a => a.contrato.empresa_id === emp.id)).map(emp => {
                  const alertasEmp = alertasMedicao.filter(a => a.contrato.empresa_id === emp.id);
                  return (
                    <Card key={`med-${emp.id}`} className="border-destructive/50 bg-destructive/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          {emp.nome}{emp.obra ? ` (Obra: ${emp.obra})` : ""}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-mono">{emp.cnpj}</p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {alertasEmp.map((a, i) => (
                          <div key={i} className="p-2 rounded bg-background border text-sm space-y-1">
                            <p className="font-medium">Competência: {formatCompetencia(competenciaFromPeriod(a.period))}</p>
                            <p className="text-xs text-muted-foreground">
                              Período: {parseLocalDate(a.period.inicio).toLocaleDateString("pt-BR")} — {parseLocalDate(a.period.fim).toLocaleDateString("pt-BR")}
                            </p>
                            <Badge className="bg-destructive text-destructive-foreground text-xs">
                              Contrato sem medição registrada
                            </Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {alertasFat.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-warning" />
                Pendente de Faturamento ({alertasFat.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {empresasComAlerta.filter(emp => alertasFat.some(a => a.contrato.empresa_id === emp.id)).map(emp => {
                  const alertasEmp = alertasFat.filter(a => a.contrato.empresa_id === emp.id);
                  return (
                    <Card key={`fat-${emp.id}`} className="border-warning/50 bg-warning/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4 text-warning" />
                          {emp.nome}{emp.obra ? ` (Obra: ${emp.obra})` : ""}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-mono">{emp.cnpj}</p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {alertasEmp.map((a, i) => (
                          <div key={i} className="p-2 rounded bg-background border text-sm space-y-1">
                            <p className="font-medium">Competência: {formatCompetencia(competenciaFromPeriod(a.period))}</p>
                            <p className="text-xs text-muted-foreground">
                              Período: {parseLocalDate(a.period.inicio).toLocaleDateString("pt-BR")} — {parseLocalDate(a.period.fim).toLocaleDateString("pt-BR")}
                            </p>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <Badge className="bg-warning text-warning-foreground text-xs">
                                Contrato com faturamento pendente
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setVincularDialog({ open: true, alerta: a, faturaId: "" })}
                              >
                                <Link2 className="h-3 w-3 mr-1" /> Vincular Fatura
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={vincularDialog.open} onOpenChange={(o) => !o && setVincularDialog({ open: false, alerta: null, faturaId: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Fatura ao Período</DialogTitle>
          </DialogHeader>
          {vincularDialog.alerta && (
            <div className="space-y-4">
              <div className="space-y-2 mt-4 text-sm border-t pt-4">
                <p className="font-semibold mb-2">Detalhes do Alerta:</p>
                <p>
                  <span className="text-muted-foreground">Empresa:</span>{" "}
                  <span className="font-medium">
                    {vincularDialog.alerta.contrato.empresas?.nome}
                    {vincularDialog.alerta.contrato.empresas?.obra ? ` (Obra: ${vincularDialog.alerta.contrato.empresas.obra})` : ""}
                  </span>
                </p>
                <p><span className="text-muted-foreground">Competência:</span> <span className="font-medium">{formatCompetencia(competenciaFromPeriod(vincularDialog.alerta.period))}</span></p>
                <p><span className="text-muted-foreground">Equipamento:</span> {vincularDialog.alerta.contrato.equipamentos?.tipo} {vincularDialog.alerta.contrato.equipamentos?.modelo}</p>
                <p><span className="text-muted-foreground">Período:</span> {parseLocalDate(vincularDialog.alerta.period.inicio).toLocaleDateString("pt-BR")} — {parseLocalDate(vincularDialog.alerta.period.fim).toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Selecione a fatura existente que cobre este período:</label>
                <Select value={vincularDialog.faturaId} onValueChange={(v) => setVincularDialog(prev => ({ ...prev, faturaId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma fatura..." />
                  </SelectTrigger>
                  <SelectContent>
                    {faturas
                      .filter(f => f.contrato_id === vincularDialog.alerta.contrato.id)
                      .sort((a, b) => (b.emissao || "").localeCompare(a.emissao || ""))
                      .map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.numero_nota ? `Nº ${f.numero_nota}` : "(sem número)"} — {parseLocalDate(f.emissao).toLocaleDateString("pt-BR")} — R$ {Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          {f.periodo_medicao_inicio && f.periodo_medicao_fim ? ` [${parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR")}-${parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR")}]` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">O período de medição da fatura selecionada será atualizado para este intervalo, removendo o alerta.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVincularDialog({ open: false, alerta: null, faturaId: "" })}>Cancelar</Button>
            <Button onClick={vincularFaturaAoPeriodo} disabled={!vincularDialog.faturaId}>Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SharedDashboardHeader>
  );
}

// 2. STUNNING UNIFIED HISTÓRICO FINANCEIRO VIEW
export function HistoricoFaturamentoView() {
  const { empresas, contratos, faturas, loading } = useFinanceiroData();
  const [filtroEmpresa, setFiltroEmpresa] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortCol, setSortCol] = useState("emissao");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  const toggleCompany = (companyKey: string) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyKey]: !prev[companyKey]
    }));
  };

  const toggleSort = (col: string) => { 
    if (sortCol === col) setSortAsc(!sortAsc); 
    else { setSortCol(col); setSortAsc(true); } 
  };

  const contratosAtivos = useMemo(() => {
    return contratos.filter(c => c.status === "Ativo" && (filtroEmpresa === "all" || c.empresa_id === filtroEmpresa));
  }, [contratos, filtroEmpresa]);

  const faturasFiltered = useMemo(() => {
    let result = faturas;
    if (filtroEmpresa !== "all") {
      result = result.filter(f => f.contratos?.empresa_id === filtroEmpresa);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => 
        (f.contratos?.empresas?.nome || "").toLowerCase().includes(q) ||
        (f.numero_nota || "").toLowerCase().includes(q) ||
        `${f.contratos?.equipamentos?.tipo} ${f.contratos?.equipamentos?.modelo}`.toLowerCase().includes(q)
      );
    }
    return result;
  }, [faturas, filtroEmpresa, searchQuery]);

  const sortedFaturas = useMemo(() => {
    return [...faturasFiltered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "empresa": cmp = (a.contratos?.empresas?.nome || "").localeCompare(b.contratos?.empresas?.nome || ""); break;
        case "nota": cmp = (a.numero_nota || "").localeCompare(b.numero_nota || ""); break;
        case "equipamento": cmp = `${a.contratos?.equipamentos?.tipo} ${a.contratos?.equipamentos?.modelo}`.localeCompare(`${b.contratos?.equipamentos?.tipo} ${b.contratos?.equipamentos?.modelo}`); break;
        case "emissao": cmp = (a.emissao || "").localeCompare(b.emissao || ""); break;
        case "vencimento": {
          const vencA = getVencimento(a);
          const vencB = getVencimento(b);
          cmp = (vencA ? vencA.getTime() : 0) - (vencB ? vencB.getTime() : 0);
          break;
        }
        case "valor": cmp = Number(a.valor_total) - Number(b.valor_total); break;
        case "status": cmp = getDisplayStatus(a).localeCompare(getDisplayStatus(b)); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [faturasFiltered, sortCol, sortAsc]);

  // Compute resume table rows
  const companyRows = useMemo(() => {
    const empresasFiltradas = empresas.filter(e => filtroEmpresa === "all" || e.id === filtroEmpresa);
    const grouped: Record<string, { ids: string[]; cnpjs: string[]; nome: string; obra: string | null }> = {};
    
    empresasFiltradas.forEach(emp => {
      const key = `${emp.nome}${emp.obra ? ` (Obra: ${emp.obra})` : ""}`;
      if (!grouped[key]) grouped[key] = { ids: [], cnpjs: [], nome: emp.nome, obra: emp.obra };
      grouped[key].ids.push(emp.id);
      if (!grouped[key].cnpjs.includes(emp.cnpj)) grouped[key].cnpjs.push(emp.cnpj);
    });

    return Object.entries(grouped)
      .map(([key, { ids, cnpjs, nome, obra }]) => {
        const empContratos = contratos.filter(c => ids.includes(c.empresa_id));
        const empFaturas = faturasFiltered.filter(f => {
          const ct = contratos.find(c => c.id === f.contrato_id);
          return ct && ids.includes(ct.empresa_id);
        });
        const pagas = empFaturas.filter(f => f.status === "Pago").length;
        const pendentes = empFaturas.filter(f => getDisplayStatus(f) === "Pendente").length;
        const atraso = empFaturas.filter(f => getDisplayStatus(f) === "Em Atraso").length;
        const total = empFaturas.reduce((s, f) => s + Number(f.valor_total), 0);
        
        // Filter out companies with no records under current filters
        if (empContratos.length === 0 && empFaturas.length === 0) return null;
        
        return { key, nome, obra, cnpjs, empContratos: empContratos.length, empFaturas: empFaturas.length, pagas, pendentes, atraso, total, ids };
      })
      .filter((r): r is Exclude<typeof r, null> => r !== null)
      .sort((a, b) => b.total - a.total); // Sort by total revenue
  }, [empresas, contratos, faturasFiltered, filtroEmpresa]);

  const getExportData = () => {
    const headers = ["Empresa", "CNPJ", "Equipamento", "Período Medição", "Emissão", "Vencimento", "Valor (R$)", "Status"];
    const rows = faturasFiltered.map(f => {
      const status = getDisplayStatus(f);
      const venc = getVencimento(f);
      return [
        f.contratos?.empresas?.nome || "",
        f.contratos?.empresas?.cnpj || "",
        `${f.contratos?.equipamentos?.tipo} ${f.contratos?.equipamentos?.modelo}`,
        f.periodo_medicao_inicio && f.periodo_medicao_fim ? `${parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR")}` : "—",
        f.emissao ? parseLocalDate(f.emissao).toLocaleDateString("pt-BR") : "—",
        venc ? venc.toLocaleDateString("pt-BR") : "—",
        Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        status,
      ];
    });
    return { title: "Relatório de Histórico Financeiro", headers, rows, filename: `historico_financeiro_${new Date().toISOString().slice(0, 10)}` };
  };

  return (
    <SharedDashboardHeader
      filtroEmpresa={filtroEmpresa}
      setFiltroEmpresa={setFiltroEmpresa}
      empresas={empresas}
      faturasFiltered={faturasFiltered}
      contratosAtivos={contratosAtivos}
    >
      <div className="space-y-4 mt-6">
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
          <div className="w-full sm:w-72">
            <Input 
              placeholder="Buscar por Nota, Empresa ou Equipamento..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-accent" />
                Resumo Financeiro Consolidado
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                Clique na empresa para ver as faturas correspondentes
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 p-4">
            {/* Cabeçalho sutil (desktop) */}
            <div className="hidden md:flex items-center px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="w-[40px]"></div>
              <div className="flex-1 min-w-0">Empresa</div>
              <div className="w-[100px] text-center">Contratos</div>
              <div className="w-[100px] text-center">Faturas</div>
              <div className="w-[100px] text-center text-success">Pagas</div>
              <div className="w-[100px] text-center text-warning">Pendentes</div>
              <div className="w-[100px] text-center text-destructive">Em Atraso</div>
              <div className="w-[140px] text-right">Total Faturado</div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground bg-card rounded-xl border border-border border-dashed">
                Carregando consolidado...
              </div>
            ) : companyRows.map((row) => {
              const isExpanded = !!expandedCompanies[row.key];
              const companyInvoices = [...sortedFaturas]
                .filter(f => {
                  const ct = contratos.find(c => c.id === f.contrato_id);
                  return ct && row.ids.includes(ct.empresa_id);
                })
                .sort((a, b) => {
                  if (a.numero_sequencial && b.numero_sequencial) {
                    return a.numero_sequencial - b.numero_sequencial;
                  }
                  const notaA = a.numero_nota || "";
                  const notaB = b.numero_nota || "";
                  return notaA.localeCompare(notaB, undefined, { numeric: true, sensitivity: 'base' });
                });

              return (
                <div key={row.key} className="flex flex-col gap-2">
                  <div 
                    onClick={() => toggleCompany(row.key)} 
                    className="group bg-card hover:bg-accent/5 border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 transition-all relative cursor-pointer"
                  >
                    
                    {/* Toggle Icon */}
                    <div className="absolute top-4 right-4 md:static md:w-[40px] flex justify-center text-muted-foreground">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </div>

                    {/* Empresa */}
                    <div className="flex-1 min-w-0 pr-8 md:pr-0">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-foreground truncate flex items-center gap-2">
                            {row.nome}
                            {row.obra && (
                              <Badge variant="secondary" className="font-normal text-[10px] py-0 px-1.5 bg-accent/10 text-accent border-accent/20">
                                {row.obra}
                              </Badge>
                            )}
                          </h3>
                          <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{row.cnpjs.join(", ")}</p>
                        </div>
                      </div>
                    </div>

                    {/* Resumo Quantidades */}
                    <div className="flex items-center gap-4 md:gap-0 pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0">
                      <div className="md:w-[100px] flex flex-col md:items-center">
                        <span className="text-[10px] text-muted-foreground uppercase md:hidden mb-0.5">Contratos</span>
                        <span className="font-semibold text-sm">{row.empContratos}</span>
                      </div>
                      <div className="md:w-[100px] flex flex-col md:items-center">
                        <span className="text-[10px] text-muted-foreground uppercase md:hidden mb-0.5">Faturas</span>
                        <span className="font-semibold text-sm">{row.empFaturas}</span>
                      </div>
                    </div>

                    {/* Status Faturas */}
                    <div className="flex items-center gap-4 md:gap-0 pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0">
                      <div className="md:w-[100px] flex flex-col md:items-center">
                        <span className="text-[10px] text-success uppercase md:hidden mb-0.5">Pagas</span>
                        <span className="font-bold text-sm text-success">{row.pagas}</span>
                      </div>
                      <div className="md:w-[100px] flex flex-col md:items-center">
                        <span className="text-[10px] text-warning uppercase md:hidden mb-0.5">Pendentes</span>
                        <span className="font-bold text-sm text-warning">{row.pendentes}</span>
                      </div>
                      <div className="md:w-[100px] flex flex-col md:items-center">
                        <span className="text-[10px] text-destructive uppercase md:hidden mb-0.5">Atraso</span>
                        <span className="font-bold text-sm text-destructive">{row.atraso}</span>
                      </div>
                    </div>

                    {/* Total Faturado */}
                    <div className="md:w-[140px] md:text-right flex flex-col pt-2 md:pt-0 border-t border-border/50 md:border-0 mt-2 md:mt-0">
                      <span className="text-[10px] text-muted-foreground uppercase md:hidden mb-0.5">Total Faturado</span>
                      <span className="font-bold text-sm text-foreground">
                        R$ {row.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                  </div>

                  {/* Expanded View */}
                  {isExpanded && (
                    <div className="ml-0 md:ml-10 bg-accent/5 rounded-xl border border-border p-4 shadow-inner space-y-2 relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent/20 rounded-l-xl"></div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 ml-2">
                        Detalhamento de Notas Emitidas — {row.nome}
                      </h4>
                      
                      {companyInvoices.length === 0 ? (
                        <div className="text-center py-4 text-xs text-muted-foreground">
                          Nenhuma fatura encontrada sob os filtros aplicados.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="hidden md:flex items-center px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            <div className="w-[100px]">Nº Nota</div>
                            <div className="flex-1">Equipamento</div>
                            <div className="w-[140px]">Período Medição</div>
                            <div className="w-[100px]">Emissão</div>
                            <div className="w-[100px]">Vencimento</div>
                            <div className="w-[120px] text-right">Valor</div>
                            <div className="w-[100px] text-center ml-4">Status</div>
                          </div>
                          {companyInvoices.map(f => {
                            const status = getDisplayStatus(f);
                            return (
                              <div key={f.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-0 bg-background border border-border/50 rounded-lg p-3 hover:bg-muted/20 transition-colors">
                                <div className="md:w-[100px] font-mono text-xs font-semibold">{f.numero_nota || "—"}</div>
                                <div className="flex-1 text-xs truncate pr-2" title={`${f.contratos?.equipamentos?.tipo} ${f.contratos?.equipamentos?.modelo}`}>
                                  {f.contratos?.equipamentos?.tipo} {f.contratos?.equipamentos?.modelo}
                                </div>
                                <div className="md:w-[140px] text-xs text-muted-foreground">
                                  {f.periodo_medicao_inicio && f.periodo_medicao_fim
                                    ? `${parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR")}`
                                    : "—"}
                                </div>
                                <div className="md:w-[100px] text-xs">{f.emissao ? parseLocalDate(f.emissao).toLocaleDateString("pt-BR") : "—"}</div>
                                <div className="md:w-[100px] text-xs font-medium">{(() => { const venc = getVencimento(f); return venc ? venc.toLocaleDateString("pt-BR") : "—"; })()}</div>
                                <div className="md:w-[120px] text-right text-xs font-bold text-foreground">
                                  R$ {Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </div>
                                <div className="md:w-[100px] flex justify-end md:justify-center mt-2 md:mt-0 md:ml-4">
                                  <Badge className={
                                    status === "Pago" ? "bg-success text-success-foreground text-[10px] py-0 px-1.5 w-fit" :
                                    status === "Em Atraso" ? "bg-destructive text-destructive-foreground text-[10px] py-0 px-1.5 w-fit" :
                                    status === "Cancelado" ? "bg-destructive text-destructive-foreground text-[10px] py-0 px-1.5 w-fit" :
                                    "bg-warning text-warning-foreground text-[10px] py-0 px-1.5 w-fit"
                                  }>
                                    {status}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </CardContent>
        </Card>
      </div>
    </SharedDashboardHeader>
  );
}
