import React, { useState, useMemo } from "react";
import type { Relequip } from "@/lib/relequip/types";
import { situacaoStyle, isMaquina, formatDateBR } from "@/lib/relequip/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  FilterX,
  History,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Truck,
  HardHat,
  SlidersHorizontal,
} from "lucide-react";

interface RelequipTableProps {
  registros: Relequip[];
  filtroSituacaoPadrao?: string;
  filtroCentroCustoPadrao?: string;
  onEditar?: (reg: Relequip) => void;
  onVerHistorico?: (reg: Relequip) => void;
  onVerDetalhes?: (reg: Relequip) => void;
  onExcluir?: (reg: Relequip) => void;
}

const ITEMS_PER_PAGE = 25;

export const RelequipTable: React.FC<RelequipTableProps> = ({
  registros,
  filtroSituacaoPadrao,
  filtroCentroCustoPadrao,
  onEditar,
  onVerHistorico,
  onVerDetalhes,
  onExcluir,
}) => {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState(filtroSituacaoPadrao || "all");
  const [centroCusto, setCentroCusto] = useState(filtroCentroCustoPadrao || "all");
  const [gestor, setGestor] = useState("all");
  const [mev, setMev] = useState("all");
  const [categoria, setCategoria] = useState<"all" | "veiculo" | "maquina">("all");
  const [pagina, setPagina] = useState(1);

  // Sincroniza caso o pai passe novo filtro
  React.useEffect(() => {
    if (filtroSituacaoPadrao) setSituacao(filtroSituacaoPadrao);
  }, [filtroSituacaoPadrao]);

  React.useEffect(() => {
    if (filtroCentroCustoPadrao) setCentroCusto(filtroCentroCustoPadrao);
  }, [filtroCentroCustoPadrao]);

  // Opções para os dropdowns
  const opcoesCentroCusto = useMemo(() => {
    const s = new Set<string>();
    registros.forEach((r) => r.centro_custo && s.add(r.centro_custo));
    return Array.from(s).sort();
  }, [registros]);

  const opcoesGestor = useMemo(() => {
    const s = new Set<string>();
    registros.forEach((r) => r.gestor && s.add(r.gestor));
    return Array.from(s).sort();
  }, [registros]);

  const opcoesSituacao = useMemo(() => {
    const s = new Set<string>();
    registros.forEach((r) => r.situacao && s.add(r.situacao));
    return Array.from(s).sort();
  }, [registros]);

  // Filtragem
  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return registros.filter((r) => {
      if (situacao !== "all" && r.situacao !== situacao) return false;
      if (centroCusto !== "all" && r.centro_custo !== centroCusto) return false;
      if (gestor !== "all" && r.gestor !== gestor) return false;
      if (mev !== "all" && r.mev !== mev) return false;

      if (categoria === "maquina" && !isMaquina(r)) return false;
      if (categoria === "veiculo" && isMaquina(r)) return false;

      if (b) {
        const text = [
          r.te_tag,
          r.placa,
          r.tag,
          r.modelo,
          r.fabricante,
          r.descricao,
          r.centro_custo,
          r.gestor,
          r.tipo_implemento,
          r.chassi_serie,
          r.observacao,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(b)) return false;
      }

      return true;
    });
  }, [registros, busca, situacao, centroCusto, gestor, mev, categoria]);

  const totalPaginas = Math.ceil(filtrados.length / ITEMS_PER_PAGE) || 1;
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * ITEMS_PER_PAGE;
  const paginados = filtrados.slice(inicio, inicio + ITEMS_PER_PAGE);

  const limparFiltros = () => {
    setBusca("");
    setSituacao("all");
    setCentroCusto("all");
    setGestor("all");
    setMev("all");
    setCategoria("all");
    setPagina(1);
  };

  const temFiltroAtivo =
    busca ||
    situacao !== "all" ||
    centroCusto !== "all" ||
    gestor !== "all" ||
    mev !== "all" ||
    categoria !== "all";

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por TE+TAG, Placa, Gestor, Modelo, Fabricante, Chassi..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              className="pl-9 bg-background"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={situacao}
              onValueChange={(v) => {
                setSituacao(v);
                setPagina(1);
              }}
            >
              <SelectTrigger className="w-[150px] bg-background">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Situações</SelectItem>
                {opcoesSituacao.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={centroCusto}
              onValueChange={(v) => {
                setCentroCusto(v);
                setPagina(1);
              }}
            >
              <SelectTrigger className="w-[170px] bg-background">
                <SelectValue placeholder="Centro de Custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Centros</SelectItem>
                {opcoesCentroCusto.map((cc) => (
                  <SelectItem key={cc} value={cc}>
                    {cc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={gestor}
              onValueChange={(v) => {
                setGestor(v);
                setPagina(1);
              }}
            >
              <SelectTrigger className="w-[160px] bg-background">
                <SelectValue placeholder="Gestor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Gestores</SelectItem>
                {opcoesGestor.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={categoria}
              onValueChange={(v) => {
                setCategoria(v as any);
                setPagina(1);
              }}
            >
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Veíc. & Máq.</SelectItem>
                <SelectItem value="veiculo">Veículos</SelectItem>
                <SelectItem value="maquina">Máquinas</SelectItem>
              </SelectContent>
            </Select>

            {temFiltroAtivo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                <FilterX className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Resumo de contagem */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
          <div>
            Exibindo <span className="font-semibold text-foreground">{filtrados.length}</span> de{" "}
            <span className="font-semibold text-foreground">{registros.length}</span> equipamentos
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {filtrados.filter((r) => !isMaquina(r)).length} veículos
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <HardHat className="h-3 w-3" />
              {filtrados.filter((r) => isMaquina(r)).length} máquinas
            </span>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="border border-border/60 rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[110px] font-semibold">TE + TAG</TableHead>
                <TableHead className="w-[100px] font-semibold">Placa</TableHead>
                <TableHead className="w-[130px] font-semibold">Situação</TableHead>
                <TableHead className="font-semibold">Centro de Custo</TableHead>
                <TableHead className="font-semibold">Gestor</TableHead>
                <TableHead className="font-semibold">Implemento / Descrição</TableHead>
                <TableHead className="font-semibold">Fabricante & Modelo</TableHead>
                <TableHead className="w-[85px] font-semibold text-center">Ano</TableHead>
                <TableHead className="w-[80px] font-semibold text-center">MEV</TableHead>
                <TableHead className="w-[120px] text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                    Nenhum equipamento encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                paginados.map((reg) => {
                  const style = situacaoStyle(reg.situacao);
                  const maquina = isMaquina(reg);
                  return (
                    <TableRow key={reg.id || reg.te_tag} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-bold text-foreground">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                          {maquina ? (
                            <HardHat className="h-3.5 w-3.5 text-amber-500 shrink-0" title="Máquina" />
                          ) : (
                            <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" title="Veículo" />
                          )}
                          {reg.te_tag}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {reg.placa || <span className="text-muted-foreground/50">N/A</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[11px] font-medium border ${style.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${style.dot}`} />
                          {reg.situacao || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground truncate max-w-[170px]" title={reg.centro_custo || ""}>
                          {reg.centro_custo || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]" title={reg.gestor || ""}>
                        {reg.gestor || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground truncate max-w-[200px]" title={reg.descricao || reg.tipo_implemento || ""}>
                          {reg.tipo_implemento || reg.descricao || "—"}
                        </div>
                        {reg.capacidade && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            Cap: {reg.capacidade}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground truncate max-w-[180px]">
                          {reg.fabricante} {reg.modelo}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center text-muted-foreground">
                        {reg.ano_fabricacao || "—"}
                        {reg.ano_modelo && reg.ano_modelo !== reg.ano_fabricacao ? `/${reg.ano_modelo}` : ""}
                      </TableCell>
                      <TableCell className="text-center">
                        {reg.mev === "Sim" ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            Sim
                          </Badge>
                        ) : reg.mev === "Em Preparação" ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                            Prep.
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">Não</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => onVerDetalhes?.(reg)}
                            title="Ver detalhes completos"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => onVerHistorico?.(reg)}
                            title="Histórico de alterações"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => onEditar?.(reg)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {onExcluir && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => onExcluir(reg)}
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
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
