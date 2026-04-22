import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Clock, Receipt, Building2, FileDown, FileSpreadsheet, TrendingUp, TrendingDown, CalendarClock, LayoutDashboard, Link2 } from "lucide-react";
import { SortableTableHead } from "@/components/SortableTableHead";
import { supabase } from "@/integrations/supabase/client";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { VisaoGeralTab } from "@/components/VisaoGeralTab";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
}

interface Contrato {
  id: string;
  empresa_id: string;
  equipamento_id: string;
  valor_hora: number;
  horas_contratadas: number;
  data_inicio: string;
  data_fim: string;
  dia_medicao_inicio: number;
  dia_medicao_fim: number;
  prazo_faturamento: number;
  status: string;
  empresas: { nome: string; cnpj: string };
  equipamentos: { tipo: string; modelo: string; tag_placa: string | null };
}

interface Fatura {
  id: string;
  contrato_id: string;
  emissao: string;
  numero_nota: string | null;
  status: string;
  valor_total: number;
  horas_normais: number;
  horas_excedentes: number;
  periodo_medicao_inicio: string | null;
  periodo_medicao_fim: string | null;
  total_gastos: number;
  contratos: {
    id: string;
    empresas: { nome: string; cnpj: string };
    equipamentos: { tipo: string; modelo: string; tag_placa: string | null };
    horas_contratadas: number;
    valor_hora: number;
    dia_medicao_inicio?: number;
    dia_medicao_fim?: number;
    prazo_faturamento?: number;
  };
}

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const Acompanhamento = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState("emissao");
  const [sortAsc, setSortAsc] = useState(false);
  const toggleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };
  const { toast } = useToast();
  const [vincularDialog, setVincularDialog] = useState<{ open: boolean; alerta: any | null; faturaId: string }>({ open: false, alerta: null, faturaId: "" });

  const refreshFaturas = async () => {
    const { data } = await supabase.from("faturamento").select("*, contratos(id, empresas(nome, cnpj), equipamentos(tipo, modelo, tag_placa), horas_contratadas, valor_hora, dia_medicao_inicio, dia_medicao_fim, prazo_faturamento)").order("emissao", { ascending: false });
    if (data) setFaturas(data as unknown as Fatura[]);
  };

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
    await refreshFaturas();
  };

  useEffect(() => {
    const fetchAll = async () => {
      const [empRes, ctRes, fatRes, eqRes, gastRes, medRes] = await Promise.all([
        supabase.from("empresas").select("id, nome, cnpj").order("nome"),
        supabase.from("contratos").select("*, empresas(nome, cnpj), equipamentos(tipo, modelo, tag_placa)").order("created_at", { ascending: false }),
        supabase.from("faturamento").select("*, contratos(id, empresas(nome, cnpj), equipamentos(tipo, modelo, tag_placa), horas_contratadas, valor_hora, dia_medicao_inicio, dia_medicao_fim, prazo_faturamento)").order("emissao", { ascending: false }),
        supabase.from("equipamentos").select("*").order("tipo"),
        supabase.from("gastos").select("*").order("data", { ascending: false }),
        supabase.from("medicoes").select("*").order("data", { ascending: false }),
      ]);
      if (empRes.data) setEmpresas(empRes.data as Empresa[]);
      if (ctRes.data) setContratos(ctRes.data as unknown as Contrato[]);
      if (fatRes.data) setFaturas(fatRes.data as unknown as Fatura[]);
      if (eqRes.data) setEquipamentos(eqRes.data);
      if (gastRes.data) setGastos(gastRes.data);
      if (medRes.data) setMedicoes(medRes.data);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const getVencimento = (fatura: Fatura) => {
    const prazo = fatura.contratos?.prazo_faturamento || 30;
    const baseDate = (fatura as any).data_aprovacao
      ? new Date((fatura as any).data_aprovacao + "T00:00:00")
      : new Date(fatura.emissao);
    const venc = new Date(baseDate);
    venc.setDate(venc.getDate() + prazo);
    return venc;
  };

  const getDisplayStatus = (fatura: Fatura) => {
    if (fatura.status === "Pago" || fatura.status === "Cancelado") return fatura.status;
    const venc = getVencimento(fatura);
    if (new Date() > venc) return "Em Atraso";
    return "Pendente";
  };

  // calcCurrentPeriod removed - using calcPeriodForMonth instead

  const contratosAtivos = useMemo(() => {
    return contratos.filter(c => c.status === "Ativo" && (filtroEmpresa === "all" || c.empresa_id === filtroEmpresa));
  }, [contratos, filtroEmpresa]);

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
      if (hoje < dataInicio) return;

      // Get all billings for this contract
      const faturasContrato = faturas.filter(f => f.contrato_id === ct.id);
      if (faturasContrato.length === 0) return; // Only alert after first billing

      // Find the earliest billed period start - we only alert from this point forward
      const primeiraMedicao = faturasContrato
        .map(f => f.periodo_medicao_inicio)
        .filter((p): p is string => !!p)
        .sort()[0];
      if (!primeiraMedicao) return;

      // Check current and up to 3 past periods
      for (let offset = 0; offset <= 3; offset++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - offset, 1);
        const period = calcPeriodForMonth(ct, d.getFullYear(), d.getMonth());

        if (period.inicio < ct.data_inicio) continue;
        // Skip periods earlier than the first billed measurement
        if (period.inicio < primeiraMedicao) continue;
        const periodEnd = parseLocalDate(period.fim);
        if (hoje <= periodEnd) continue; // Period not yet ended

        // Considera faturado se houver fatura cujo período se sobrepõe ao período calculado
        // (evita falsos alertas por diferença de 1 dia no fim do ciclo)
        const faturado = faturasContrato.some(f => {
          if (!f.periodo_medicao_inicio || !f.periodo_medicao_fim) return false;
          // Sobreposição de intervalos
          return f.periodo_medicao_inicio <= period.fim && f.periodo_medicao_fim >= period.inicio;
        });
        if (faturado) continue;

        // Check if there are horímetro readings for this contract's equipment in this period
        const ctEquipId = ct.equipamento_id;
        const temMedicao = medicoes.some(m => {
          if (m.equipamento_id !== ctEquipId) return false;
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
    return faturas.filter(f => {
      const ct = contratos.find(c => c.id === f.contrato_id);
      return ct?.empresa_id === filtroEmpresa;
    });
  }, [faturas, filtroEmpresa, contratos]);

  const sortedFaturas = useMemo(() => {
    return [...faturasFiltered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "empresa": cmp = (a.contratos?.empresas?.nome || "").localeCompare(b.contratos?.empresas?.nome || ""); break;
        case "nota": cmp = (a.numero_nota || "").localeCompare(b.numero_nota || ""); break;
        case "equipamento": cmp = `${a.contratos?.equipamentos?.tipo} ${a.contratos?.equipamentos?.modelo}`.localeCompare(`${b.contratos?.equipamentos?.tipo} ${b.contratos?.equipamentos?.modelo}`); break;
        case "emissao": cmp = a.emissao.localeCompare(b.emissao); break;
        case "vencimento": cmp = getVencimento(a).getTime() - getVencimento(b).getTime(); break;
        case "valor": cmp = Number(a.valor_total) - Number(b.valor_total); break;
        case "status": cmp = getDisplayStatus(a).localeCompare(getDisplayStatus(b)); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [faturasFiltered, sortCol, sortAsc]);

  const totalFaturado = faturasFiltered.filter(f => f.status === "Pago").reduce((s, f) => s + Number(f.valor_total), 0);
  const totalPendente = faturasFiltered.filter(f => getDisplayStatus(f) === "Pendente").reduce((s, f) => s + Number(f.valor_total), 0);
  const totalAtraso = faturasFiltered.filter(f => getDisplayStatus(f) === "Em Atraso").reduce((s, f) => s + Number(f.valor_total), 0);
  const qtdAtraso = faturasFiltered.filter(f => getDisplayStatus(f) === "Em Atraso").length;

  const getExportData = () => {
    const headers = ["Empresa", "CNPJ", "Equipamento", "Período Medição", "Emissão", "Vencimento", "Valor (R$)", "Status"];
    const rows = faturasFiltered.map(f => {
      const status = getDisplayStatus(f);
      return [
        f.contratos?.empresas?.nome || "",
        f.contratos?.empresas?.cnpj || "",
        `${f.contratos?.equipamentos?.tipo} ${f.contratos?.equipamentos?.modelo}`,
        f.periodo_medicao_inicio && f.periodo_medicao_fim ? `${parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR")}` : "—",
        parseLocalDate(f.emissao).toLocaleDateString("pt-BR"),
        getVencimento(f).toLocaleDateString("pt-BR"),
        Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        status,
      ];
    });
    return { title: "Relatório de Acompanhamento Geral", headers, rows, filename: `acompanhamento_${new Date().toISOString().slice(0, 10)}` };
  };

  return (
    <Layout title="Acompanhamento Geral" subtitle="Visão completa de faturamento, vencimentos e alertas">
      <div className="space-y-6">

        <Tabs defaultValue="visao-geral" className="w-full">
          <TabsList>
            <TabsTrigger value="visao-geral" className="flex items-center gap-1">
              <LayoutDashboard className="h-4 w-4" /> Visão Geral
            </TabsTrigger>
            <TabsTrigger value="faturamento" className="flex items-center gap-1">
              <Receipt className="h-4 w-4" /> Faturamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-6">
            <VisaoGeralTab
              empresas={empresas}
              contratos={contratos}
              faturas={faturas}
              equipamentos={equipamentos}
              gastos={gastos}
              medicoes={medicoes}
            />
          </TabsContent>

          <TabsContent value="faturamento" className="mt-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportToPDF(getExportData())}>
                  <FileDown className="h-4 w-4 mr-1" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                </Button>
              </div>
            </div>

            <div className="max-w-sm">
              <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Empresas</SelectItem>
                  {empresas.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Faturado (Pago)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">R$ {totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
                  <Clock className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Em Atraso</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">R$ {totalAtraso.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                  {qtdAtraso > 0 && <p className="text-xs text-destructive mt-1">{qtdAtraso} fatura(s) em atraso</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Contratos Ativos</CardTitle>
                  <Building2 className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{contratosAtivos.length}</div>
                </CardContent>
              </Card>
            </div>

              {(() => {
                const empresasComAlerta = empresas.filter(emp => {
                  if (filtroEmpresa !== "all" && emp.id !== filtroEmpresa) return false;
                  return alertasPendentes.some(a => a.contrato.empresa_id === emp.id);
                });
                if (empresasComAlerta.length === 0) return null;

                const alertasMedicao = alertasPendentes.filter(a => a.tipo === "medicao");
                const alertasFat = alertasPendentes.filter(a => a.tipo === "faturamento");

                return (
                  <div className="space-y-6">
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
                                    {emp.nome}
                                  </CardTitle>
                                  <p className="text-xs text-muted-foreground font-mono">{emp.cnpj}</p>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  {alertasEmp.map((a, i) => (
                                    <div key={i} className="p-2 rounded bg-background border text-sm space-y-1">
                                      <p className="font-medium">{a.contrato.equipamentos?.tipo} {a.contrato.equipamentos?.modelo}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Período: {parseLocalDate(a.period.inicio).toLocaleDateString("pt-BR")} — {parseLocalDate(a.period.fim).toLocaleDateString("pt-BR")}
                                      </p>
                                      <Badge className="bg-destructive text-destructive-foreground text-xs">
                                        Sem Medição Registrada
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
                                    {emp.nome}
                                  </CardTitle>
                                  <p className="text-xs text-muted-foreground font-mono">{emp.cnpj}</p>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  {alertasEmp.map((a, i) => (
                                    <div key={i} className="p-2 rounded bg-background border text-sm space-y-1">
                                      <p className="font-medium">{a.contrato.equipamentos?.tipo} {a.contrato.equipamentos?.modelo}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Período: {parseLocalDate(a.period.inicio).toLocaleDateString("pt-BR")} — {parseLocalDate(a.period.fim).toLocaleDateString("pt-BR")}
                                      </p>
                                      <Badge className="bg-warning text-warning-foreground text-xs">
                                        Pendente de Emissão
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
                  </div>
                );
              })()}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-accent" />
                  Histórico de Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead column="empresa" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Empresa</SortableTableHead>
                      <SortableTableHead column="nota" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Nº Nota</SortableTableHead>
                      <SortableTableHead column="equipamento" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Equipamento</SortableTableHead>
                      <TableHead>Período Medição</TableHead>
                      <SortableTableHead column="emissao" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Emissão</SortableTableHead>
                      <SortableTableHead column="vencimento" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Vencimento</SortableTableHead>
                      <SortableTableHead column="valor" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Valor (R$)</SortableTableHead>
                      <SortableTableHead column="status" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Status</SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFaturas.map(f => {
                      const status = getDisplayStatus(f);
                      return (
                        <TableRow key={f.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{f.contratos?.empresas?.nome}</p>
                              <p className="text-xs text-muted-foreground font-mono">{f.contratos?.empresas?.cnpj}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{f.numero_nota || "—"}</TableCell>
                          <TableCell className="text-sm">{f.contratos?.equipamentos?.tipo} {f.contratos?.equipamentos?.modelo}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {f.periodo_medicao_inicio && f.periodo_medicao_fim
                              ? `${parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR")}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{parseLocalDate(f.emissao).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-sm">{getVencimento(f).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="font-bold text-sm">R$ {Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <Badge className={
                              status === "Pago" ? "bg-success text-success-foreground" :
                              status === "Em Atraso" ? "bg-destructive text-destructive-foreground" :
                              status === "Cancelado" ? "bg-destructive text-destructive-foreground" :
                              "bg-warning text-warning-foreground"
                            }>
                              {status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!loading && sortedFaturas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhuma fatura encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  Resumo por Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Contratos</TableHead>
                      <TableHead>Faturas Emitidas</TableHead>
                      <TableHead>Pagas</TableHead>
                      <TableHead>Pendentes</TableHead>
                      <TableHead>Em Atraso</TableHead>
                      <TableHead>Total Faturado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const empresasFiltradas = empresas.filter(e => filtroEmpresa === "all" || e.id === filtroEmpresa);
                      // Group by nome
                      const grouped: Record<string, { ids: string[]; cnpjs: string[] }> = {};
                      empresasFiltradas.forEach(emp => {
                        if (!grouped[emp.nome]) grouped[emp.nome] = { ids: [], cnpjs: [] };
                        grouped[emp.nome].ids.push(emp.id);
                        if (!grouped[emp.nome].cnpjs.includes(emp.cnpj)) grouped[emp.nome].cnpjs.push(emp.cnpj);
                      });
                      return Object.entries(grouped)
                        .map(([nome, { ids, cnpjs }]) => {
                          const empContratos = contratos.filter(c => ids.includes(c.empresa_id));
                          const empFaturas = faturas.filter(f => {
                            const ct = contratos.find(c => c.id === f.contrato_id);
                            return ct && ids.includes(ct.empresa_id);
                          });
                          const pagas = empFaturas.filter(f => f.status === "Pago").length;
                          const pendentes = empFaturas.filter(f => getDisplayStatus(f) === "Pendente").length;
                          const atraso = empFaturas.filter(f => getDisplayStatus(f) === "Em Atraso").length;
                          const total = empFaturas.reduce((s, f) => s + Number(f.valor_total), 0);
                          if (empContratos.length === 0 && empFaturas.length === 0) return null;
                          return { nome, cnpjs, empContratos: empContratos.length, empFaturas: empFaturas.length, pagas, pendentes, atraso, total };
                        })
                        .filter(Boolean)
                        .sort((a, b) => b!.empContratos - a!.empContratos)
                        .map((row) => (
                          <TableRow key={row!.nome}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{row!.nome}</p>
                                <p className="text-xs text-muted-foreground font-mono">{row!.cnpjs.join(", ")}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{row!.empContratos}</TableCell>
                            <TableCell className="text-sm">{row!.empFaturas}</TableCell>
                            <TableCell className="text-sm text-success font-semibold">{row!.pagas}</TableCell>
                            <TableCell className="text-sm text-warning font-semibold">{row!.pendentes}</TableCell>
                            <TableCell className="text-sm text-destructive font-semibold">{row!.atraso}</TableCell>
                            <TableCell className="font-bold text-sm">R$ {row!.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ));
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Acompanhamento;
