import React, { useState, useMemo } from "react";
import type { Relequip } from "@/lib/relequip/types";
import { formatDateBR } from "@/lib/relequip/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Search, Archive, CheckCircle2, ChevronLeft, ChevronRight, History, Eye } from "lucide-react";

interface RelequipBaixadosTabProps {
  registros: Relequip[];
  onVerHistorico?: (reg: Relequip) => void;
  onVerDetalhes?: (reg: Relequip) => void;
}

const ITEMS_PER_PAGE = 25;

export const RelequipBaixadosTab: React.FC<RelequipBaixadosTabProps> = ({
  registros,
  onVerHistorico,
  onVerDetalhes,
}) => {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"all" | "Vendido" | "Devolvido">("all");
  const [pagina, setPagina] = useState(1);

  const baixados = useMemo(() => {
    return registros.filter((r) => r.grupo === "baixado" || r.situacao_cadastro === "Vendido" || r.situacao_cadastro === "Devolvido");
  }, [registros]);

  const kpis = useMemo(() => {
    let vendidos = 0;
    let devolvidos = 0;
    baixados.forEach((r) => {
      if ((r.situacao_cadastro || "").toLowerCase().includes("devolvido")) devolvidos++;
      else vendidos++;
    });
    return { total: baixados.length, vendidos, devolvidos };
  }, [baixados]);

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return baixados.filter((r) => {
      const isDev = (r.situacao_cadastro || "").toLowerCase().includes("devolvido");
      if (filtroTipo === "Devolvido" && !isDev) return false;
      if (filtroTipo === "Vendido" && isDev) return false;

      if (b) {
        const text = [
          r.te_tag,
          r.placa,
          r.modelo,
          r.fabricante,
          r.vendido_para,
          r.comprador,
          r.comprado_de,
          r.localidade,
          r.observacao_baixa,
          r.observacao,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(b)) return false;
      }
      return true;
    });
  }, [baixados, busca, filtroTipo]);

  const totalPaginas = Math.ceil(filtrados.length / ITEMS_PER_PAGE) || 1;
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * ITEMS_PER_PAGE;
  const paginados = filtrados.slice(inicio, inicio + ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border border-border/60 bg-gradient-to-br from-card to-card/60 shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Total Desmobilizados</span>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold tracking-tight">{kpis.total}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Histórico completo de baixas</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-gradient-to-br from-slate-500/5 to-transparent shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Equipamentos Vendidos</span>
            <CheckCircle2 className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">{kpis.vendidos}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Venda definitiva ou leilão</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-gradient-to-br from-teal-500/5 to-transparent shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Agregados Devolvidos</span>
            <Archive className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{kpis.devolvidos}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Devolução ao proprietário</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-card border border-border/60 rounded-xl p-3 shadow-sm">
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, tag, comprador, vendido para, destino..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={filtroTipo === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFiltroTipo("all");
              setPagina(1);
            }}
            className="text-xs h-8"
          >
            Todos ({baixados.length})
          </Button>
          <Button
            variant={filtroTipo === "Vendido" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFiltroTipo("Vendido");
              setPagina(1);
            }}
            className="text-xs h-8"
          >
            Vendidos ({kpis.vendidos})
          </Button>
          <Button
            variant={filtroTipo === "Devolvido" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFiltroTipo("Devolvido");
              setPagina(1);
            }}
            className="text-xs h-8"
          >
            Devolvidos ({kpis.devolvidos})
          </Button>
        </div>
      </div>

      {/* Tabela de Baixados */}
      <div className="border border-border/60 rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[110px] font-semibold">TE + TAG</TableHead>
                <TableHead className="w-[100px] font-semibold">Placa</TableHead>
                <TableHead className="w-[110px] font-semibold">Situação</TableHead>
                <TableHead className="font-semibold">Implemento / Modelo</TableHead>
                <TableHead className="font-semibold">Fabricante</TableHead>
                <TableHead className="w-[80px] font-semibold text-center">Ano</TableHead>
                <TableHead className="w-[110px] font-semibold">Data da Baixa</TableHead>
                <TableHead className="font-semibold">Destino / Comprador</TableHead>
                <TableHead className="font-semibold min-w-[200px]">Observações</TableHead>
                <TableHead className="w-[80px] text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                    Nenhum registro baixado encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paginados.map((reg) => (
                  <TableRow key={reg.id || reg.te_tag} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-bold font-mono text-xs text-foreground">
                      {reg.te_tag}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {reg.placa || <span className="text-muted-foreground/50">N/A</span>}
                    </TableCell>
                    <TableCell>
                      {(reg.situacao_cadastro || "").toLowerCase().includes("devolvido") ? (
                        <Badge variant="outline" className="bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30 text-[11px]">
                          Devolvido
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30 text-[11px]">
                          Vendido
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium text-foreground">{reg.tipo_implemento || reg.modelo}</div>
                      <div className="text-[10px] text-muted-foreground">{reg.modelo}</div>
                    </TableCell>
                    <TableCell className="text-xs">{reg.fabricante || "—"}</TableCell>
                    <TableCell className="text-xs text-center text-muted-foreground">
                      {reg.ano_fabricacao || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {formatDateBR(reg.data_venda)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium text-foreground max-w-[220px] truncate" title={reg.vendido_para || reg.comprador || ""}>
                        {reg.vendido_para || reg.comprador || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="max-w-[280px] truncate" title={reg.observacao_baixa || reg.observacao || ""}>
                        {reg.observacao_baixa || reg.observacao || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onVerDetalhes?.(reg)}
                          title="Detalhes"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => onVerHistorico?.(reg)}
                          title="Histórico"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-border/40 text-xs text-muted-foreground bg-muted/20">
            <div>
              Página <span className="font-semibold text-foreground">{paginaAtual}</span> de{" "}
              <span className="font-semibold text-foreground">{totalPaginas}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={paginaAtual <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={paginaAtual >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              >
                Próxima
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
