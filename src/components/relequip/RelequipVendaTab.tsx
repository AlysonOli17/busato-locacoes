import React, { useState, useMemo } from "react";
import type { Relequip } from "@/lib/relequip/types";
import { formatCurrencyBR, tempoParadoEmDias } from "@/lib/relequip/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tag,
  DollarSign,
  Clock,
  AlertTriangle,
  Search,
  Pencil,
  History,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";

interface RelequipVendaTabProps {
  registros: Relequip[];
  onEditar?: (reg: Relequip) => void;
  onVerHistorico?: (reg: Relequip) => void;
}

export const RelequipVendaTab: React.FC<RelequipVendaTabProps> = ({
  registros,
  onEditar,
  onVerHistorico,
}) => {
  const [busca, setBusca] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState<"all" | "Venda" | "Av. Venda">("all");

  // Filtra itens destinados à venda (ou com dados de venda preenchidos)
  const itensVenda = useMemo(() => {
    return registros.filter((r) => {
      const s = (r.situacao || "").trim();
      return (
        s === "Venda" ||
        s === "Av. Venda" ||
        r.tempo_parado ||
        r.custo_recuperacao !== null ||
        r.observacao_venda
      );
    });
  }, [registros]);

  // KPIs de venda
  const kpis = useMemo(() => {
    let custoTotal = 0;
    let itensComOrcamento = 0;
    let paradosMaisDe1Ano = 0;
    let aindaAtuando = 0;
    let emVendaDireta = 0;
    let emAvaliacao = 0;

    itensVenda.forEach((r) => {
      if (r.situacao === "Venda") emVendaDireta++;
      else if (r.situacao === "Av. Venda") emAvaliacao++;

      if (typeof r.custo_recuperacao === "number" && r.custo_recuperacao > 0) {
        custoTotal += r.custo_recuperacao;
        itensComOrcamento++;
      }

      const dias = tempoParadoEmDias(r.tempo_parado);
      if (dias !== null && dias >= 365) paradosMaisDe1Ano++;
      if ((r.tempo_parado || "").toUpperCase().includes("ATUANDO")) aindaAtuando++;
    });

    return {
      total: itensVenda.length,
      emVendaDireta,
      emAvaliacao,
      custoTotal,
      itensComOrcamento,
      paradosMaisDe1Ano,
      aindaAtuando,
    };
  }, [itensVenda]);

  // Filtragem da lista
  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return itensVenda.filter((r) => {
      if (filtroSituacao !== "all" && r.situacao !== filtroSituacao) return false;
      if (b) {
        const text = [
          r.te_tag,
          r.placa,
          r.modelo,
          r.fabricante,
          r.centro_custo,
          r.observacao_venda,
          r.observacao,
          r.tempo_parado,
          r.custo_recuperacao_obs,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(b)) return false;
      }
      return true;
    });
  }, [itensVenda, busca, filtroSituacao]);

  const tempoParadoBadge = (tempo: string | null | undefined) => {
    if (!tempo) return <span className="text-muted-foreground/60">—</span>;
    const dias = tempoParadoEmDias(tempo);
    const upper = tempo.toUpperCase();

    if (upper.includes("ATUANDO")) {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px]">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Atuando
        </Badge>
      );
    }
    if (dias !== null && dias >= 365) {
      return (
        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[11px] font-semibold">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {tempo}
        </Badge>
      );
    }
    if (dias !== null && dias >= 60) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[11px]">
          <Clock className="h-3 w-3 mr-1" />
          {tempo}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[11px]">
        {tempo}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cards de Indicadores de Venda */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border border-border/60 bg-gradient-to-br from-card to-card/60 shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Itens em Acompanhamento</span>
            <Tag className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold tracking-tight text-foreground">{kpis.total}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {kpis.emVendaDireta} Venda · {kpis.emAvaliacao} Av. Venda
            </p>
          </CardContent>
        </Card>

        <Card className="border border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Custo Total de Recuperação
            </span>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-xl md:text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrencyBR(kpis.custoTotal)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {kpis.itensComOrcamento} equipamentos com valor orçado
            </p>
          </CardContent>
        </Card>

        <Card className="border border-rose-500/30 bg-rose-500/5 shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-rose-700 dark:text-rose-400">
              Parados há +1 Ano
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {kpis.paradosMaisDe1Ano}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Prioridade alta de sucateamento/venda</p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Ainda Atuando
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {kpis.aindaAtuando}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Aguardando desmobilização</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-card border border-border/60 rounded-xl p-3 shadow-sm">
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, tag, centro de custo, observação..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant={filtroSituacao === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroSituacao("all")}
            className="text-xs h-8"
          >
            Todos ({itensVenda.length})
          </Button>
          <Button
            variant={filtroSituacao === "Av. Venda" ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroSituacao("Av. Venda")}
            className="text-xs h-8"
          >
            Av. Venda ({kpis.emAvaliacao})
          </Button>
          <Button
            variant={filtroSituacao === "Venda" ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroSituacao("Venda")}
            className="text-xs h-8"
          >
            Venda ({kpis.emVendaDireta})
          </Button>
        </div>
      </div>

      {/* Tabela de Acompanhamento de Venda */}
      <div className="border border-border/60 rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[110px] font-semibold">TE + TAG</TableHead>
                <TableHead className="w-[100px] font-semibold">Placa</TableHead>
                <TableHead className="w-[110px] font-semibold">Situação</TableHead>
                <TableHead className="font-semibold">Centro de Custo</TableHead>
                <TableHead className="font-semibold">Fabricante & Modelo</TableHead>
                <TableHead className="w-[80px] font-semibold text-center">Ano</TableHead>
                <TableHead className="w-[120px] font-semibold text-center">Tempo Parado</TableHead>
                <TableHead className="w-[140px] font-semibold text-right">Custo Recuperação</TableHead>
                <TableHead className="font-semibold min-w-[240px]">Diagnóstico / Observação</TableHead>
                <TableHead className="w-[90px] text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                    Nenhum equipamento em processo de venda encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((reg) => (
                  <TableRow key={reg.id || reg.te_tag} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-bold font-mono text-xs text-foreground">
                      {reg.te_tag}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {reg.placa || <span className="text-muted-foreground/50">N/A</span>}
                    </TableCell>
                    <TableCell>
                      {reg.situacao === "Venda" ? (
                        <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[11px]">
                          Venda
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30 text-[11px]">
                          Av. Venda
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">
                      {reg.centro_custo || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {reg.fabricante} {reg.modelo}
                    </TableCell>
                    <TableCell className="text-xs text-center text-muted-foreground">
                      {reg.ano_fabricacao || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {tempoParadoBadge(reg.tempo_parado)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {typeof reg.custo_recuperacao === "number" && reg.custo_recuperacao > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-mono">
                          {formatCurrencyBR(reg.custo_recuperacao)}
                        </span>
                      ) : reg.custo_recuperacao_obs ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {reg.custo_recuperacao_obs}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="max-w-[340px] truncate" title={reg.observacao_venda || reg.observacao || ""}>
                        {reg.observacao_venda || reg.observacao || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => onVerHistorico?.(reg)}
                          title="Histórico"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => onEditar?.(reg)}
                          title="Editar dados de venda"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
