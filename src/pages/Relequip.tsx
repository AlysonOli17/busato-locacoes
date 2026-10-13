import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Relequip, RelequipInsert, RelequipHistorico } from "@/lib/relequip/types";
import { exportRelequipXlsx } from "@/lib/relequip/exporter";
import initialData from "@/lib/relequip/initialData.json";

import { RelequipDashboard } from "@/components/relequip/RelequipDashboard";
import { RelequipTable } from "@/components/relequip/RelequipTable";
import { RelequipVendaTab } from "@/components/relequip/RelequipVendaTab";
import { RelequipBaixadosTab } from "@/components/relequip/RelequipBaixadosTab";
import { RelequipHistoricoDialog } from "@/components/relequip/RelequipHistoricoDialog";
import { RelequipDetalhesDialog } from "@/components/relequip/RelequipDetalhesDialog";
import { RelequipFormDialog } from "@/components/relequip/RelequipFormDialog";
import { RelequipImportDialog } from "@/components/relequip/RelequipImportDialog";

import {
  BarChart3,
  Truck,
  Tag,
  Archive,
  History,
  Plus,
  Upload,
  Download,
  Database,
  Copy,
  RefreshCw,
} from "lucide-react";

const STORAGE_KEY = "busato_relequip_data_cache";

export default function RelequipPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";

  const [registros, setRegistros] = useState<Relequip[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbTableMissing, setDbTableMissing] = useState(false);

  // Filtros aplicados a partir do Dashboard
  const [filtroSituacaoRapido, setFiltroSituacaoRapido] = useState<string>("");
  const [filtroCentroCustoRapido, setFiltroCentroCustoRapido] = useState<string>("");

  // Diálogos
  const [formOpen, setFormOpen] = useState(false);
  const [registroEdicao, setRegistroEdicao] = useState<Relequip | null>(null);

  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [registroDetalhes, setRegistroDetalhes] = useState<Relequip | null>(null);

  const [importOpen, setImportOpen] = useState(false);

  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoTag, setHistoricoTag] = useState<string | undefined>();
  const [historicoLista, setHistoricoLista] = useState<RelequipHistorico[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  const { toast } = useToast();

  const handleTabChange = (newTab: string) => {
    setSearchParams({ tab: newTab });
  };

  // Carrega registros (do Supabase ou cache local / initialData)
  const carregarRegistros = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("relequip")
        .select("*")
        .order("te_tag", { ascending: true });

      if (error) {
        if (error.code === "PGRST205" || error.message?.includes("relequip")) {
          setDbTableMissing(true);
          const local = localStorage.getItem(STORAGE_KEY);
          if (local) {
            try {
              setRegistros(JSON.parse(local));
            } catch {
              setRegistros(initialData as unknown as Relequip[]);
            }
          } else {
            setRegistros(initialData as unknown as Relequip[]);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
          }
        } else {
          toast({
            title: "Erro ao consultar dados",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (data && data.length > 0) {
        setDbTableMissing(false);
        setRegistros(data as Relequip[]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        setDbTableMissing(false);
        setRegistros(initialData as unknown as Relequip[]);
      }
    } catch (err: any) {
      console.error(err);
      setRegistros(initialData as unknown as Relequip[]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregarRegistros();
  }, [carregarRegistros]);

  // Salvar registro manual (novo ou edição)
  const handleSalvar = async (dados: Partial<RelequipInsert>) => {
    try {
      if (dbTableMissing) {
        const agora = new Date().toISOString();
        let atualizados: Relequip[];
        if (registroEdicao) {
          atualizados = registros.map((r) =>
            r.te_tag === registroEdicao.te_tag ? ({ ...r, ...dados, updated_at: agora } as Relequip) : r
          );
        } else {
          const novo: Relequip = {
            id: crypto.randomUUID(),
            created_at: agora,
            updated_at: agora,
            ultima_origem: "manual",
            ...dados,
          } as Relequip;
          atualizados = [novo, ...registros];
        }
        setRegistros(atualizados);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
        toast({ title: "Registro salvo com sucesso" });
        return;
      }

      if (registroEdicao) {
        const { error } = await supabase
          .from("relequip")
          .update(dados)
          .eq("id", registroEdicao.id);
        if (error) throw error;
        toast({ title: "Equipamento atualizado com sucesso!" });
      } else {
        const { error } = await supabase.from("relequip").insert([dados as RelequipInsert]);
        if (error) throw error;
        toast({ title: "Equipamento cadastrado com sucesso!" });
      }
      await carregarRegistros();
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Excluir registro
  const handleExcluir = async (reg: Relequip) => {
    if (!confirm(`Deseja realmente excluir o equipamento ${reg.te_tag}?`)) return;

    try {
      if (dbTableMissing) {
        const atualizados = registros.filter((r) => r.te_tag !== reg.te_tag);
        setRegistros(atualizados);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados));
        toast({ title: "Registro removido com sucesso" });
        return;
      }

      const { error } = await supabase.from("relequip").delete().eq("id", reg.id);
      if (error) throw error;
      toast({ title: "Equipamento removido com sucesso!" });
      await carregarRegistros();
    } catch (err: any) {
      toast({
        title: "Erro ao excluir",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Confirmar importação da planilha
  const handleConfirmarImportacao = async (novosOuAtualizados: RelequipInsert[]) => {
    try {
      if (dbTableMissing) {
        const mapa = new Map(registros.map((r) => [r.te_tag, r]));
        novosOuAtualizados.forEach((n) => {
          const ex = mapa.get(n.te_tag);
          mapa.set(n.te_tag, {
            id: ex?.id || crypto.randomUUID(),
            created_at: ex?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...n,
          } as Relequip);
        });
        const lista = Array.from(mapa.values());
        setRegistros(lista);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
        toast({
          title: "Importação concluída!",
          description: `${novosOuAtualizados.length} registros processados localmente.`,
        });
        return;
      }

      const BATCH_SIZE = 100;
      for (let i = 0; i < novosOuAtualizados.length; i += BATCH_SIZE) {
        const batch = novosOuAtualizados.slice(i, i + BATCH_SIZE).map((r) => ({
          ...r,
          ultima_origem: "importacao" as const,
        }));
        const { error } = await supabase
          .from("relequip")
          .upsert(batch, { onConflict: "te_tag" });
        if (error) throw error;
      }

      toast({
        title: "Importação concluída!",
        description: `${novosOuAtualizados.length} equipamentos gravados no banco de dados.`,
      });
      await carregarRegistros();
    } catch (err: any) {
      toast({
        title: "Erro na importação",
        description: err.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Abrir histórico de um item
  const handleVerHistorico = async (reg: Relequip) => {
    setHistoricoTag(reg.te_tag);
    setHistoricoOpen(true);
    setHistoricoLoading(true);
    try {
      const { data, error } = await supabase
        .from("relequip_historico")
        .select("*")
        .eq("te_tag", reg.te_tag)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setHistoricoLista(data as RelequipHistorico[]);
      } else {
        setHistoricoLista([]);
      }
    } catch {
      setHistoricoLista([]);
    } finally {
      setHistoricoLoading(false);
    }
  };

  // Abrir histórico geral
  const handleVerHistoricoGeral = async () => {
    setHistoricoTag(undefined);
    setHistoricoOpen(true);
    setHistoricoLoading(true);
    try {
      const { data, error } = await supabase
        .from("relequip_historico")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error && data) {
        setHistoricoLista(data as RelequipHistorico[]);
      } else {
        setHistoricoLista([]);
      }
    } catch {
      setHistoricoLista([]);
    } finally {
      setHistoricoLoading(false);
    }
  };

  // Atalho do dashboard para a frota com filtro
  const handleFiltrarSituacaoDashboard = (sit: string) => {
    setFiltroSituacaoRapido(sit);
    handleTabChange("frota");
  };

  const handleFiltrarCentroCustoDashboard = (cc: string) => {
    setFiltroCentroCustoRapido(cc);
    handleTabChange("frota");
  };

  // Exportar Excel
  const handleExportarExcel = () => {
    if (registros.length === 0) {
      toast({ title: "Nenhum equipamento para exportar", variant: "destructive" });
      return;
    }
    exportRelequipXlsx(registros);
    toast({ title: "Planilha exportada com sucesso!" });
  };

  return (
    <Layout
      title="RELEQUIP"
      subtitle="Gestão, Controle e Acompanhamento de Veículos e Equipamentos"
    >
      <div className="space-y-5">
        {/* Barra superior de ações */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {registros.length} equipamentos
            </Badge>
            {registros.filter((r) => r.grupo === "frota").length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {registros.filter((r) => r.grupo === "frota").length} frota ativa
              </Badge>
            )}
            {registros.filter((r) => r.grupo === "baixado").length > 0 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {registros.filter((r) => r.grupo === "baixado").length} baixados
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerHistoricoGeral}
              className="text-xs h-9"
            >
              <History className="h-3.5 w-3.5 mr-1.5" />
              Histórico Geral
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarExcel}
              className="text-xs h-9"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="text-xs h-9 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              Importar Planilha
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setRegistroEdicao(null);
                setFormOpen(true);
              }}
              className="text-xs h-9"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Novo Equipamento
            </Button>
          </div>
        </div>

        {/* Abas do Módulo */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-card border border-border/60 w-full justify-start h-auto p-1 flex-wrap gap-1">
            <TabsTrigger value="dashboard" className="text-xs gap-1.5 py-1.5 px-3">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              Indicadores & Cockpit
            </TabsTrigger>
            <TabsTrigger value="frota" className="text-xs gap-1.5 py-1.5 px-3">
              <Truck className="h-3.5 w-3.5 text-blue-500" />
              Frota Ativa ({registros.filter((r) => r.grupo === "frota").length})
            </TabsTrigger>
            <TabsTrigger value="venda" className="text-xs gap-1.5 py-1.5 px-3">
              <Tag className="h-3.5 w-3.5 text-rose-500" />
              Acompanhamento de Venda (
              {
                registros.filter(
                  (r) =>
                    r.situacao === "Venda" ||
                    r.situacao === "Av. Venda" ||
                    r.tempo_parado ||
                    r.custo_recuperacao !== null
                ).length
              }
              )
            </TabsTrigger>
            <TabsTrigger value="baixados" className="text-xs gap-1.5 py-1.5 px-3">
              <Archive className="h-3.5 w-3.5 text-slate-500" />
              Vendidos & Devolvidos ({registros.filter((r) => r.grupo === "baixado").length})
            </TabsTrigger>
          </TabsList>

          {/* 1. Indicadores */}
          <TabsContent value="dashboard" className="pt-4">
            <RelequipDashboard
              registros={registros}
              onFiltrarSituacao={handleFiltrarSituacaoDashboard}
              onFiltrarCentroCusto={handleFiltrarCentroCustoDashboard}
            />
          </TabsContent>

          {/* 2. Frota Ativa */}
          <TabsContent value="frota" className="pt-4">
            <RelequipTable
              registros={registros.filter((r) => r.grupo === "frota")}
              filtroSituacaoPadrao={filtroSituacaoRapido}
              filtroCentroCustoPadrao={filtroCentroCustoRapido}
              onEditar={(reg) => {
                setRegistroEdicao(reg);
                setFormOpen(true);
              }}
              onVerHistorico={handleVerHistorico}
              onVerDetalhes={(reg) => {
                setRegistroDetalhes(reg);
                setDetalhesOpen(true);
              }}
              onExcluir={handleExcluir}
            />
          </TabsContent>

          {/* 3. Acompanhamento de Venda */}
          <TabsContent value="venda" className="pt-4">
            <RelequipVendaTab
              registros={registros}
              onEditar={(reg) => {
                setRegistroEdicao(reg);
                setFormOpen(true);
              }}
              onVerHistorico={handleVerHistorico}
            />
          </TabsContent>

          {/* 4. Vendidos & Devolvidos */}
          <TabsContent value="baixados" className="pt-4">
            <RelequipBaixadosTab
              registros={registros}
              onVerHistorico={handleVerHistorico}
              onVerDetalhes={(reg) => {
                setRegistroDetalhes(reg);
                setDetalhesOpen(true);
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Diálogos */}
        <RelequipFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          registro={registroEdicao}
          onSalvar={handleSalvar}
        />

        <RelequipDetalhesDialog
          open={detalhesOpen}
          onOpenChange={setDetalhesOpen}
          registro={registroDetalhes}
        />

        <RelequipImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          existentes={registros}
          onConfirmarImportacao={handleConfirmarImportacao}
        />

        <RelequipHistoricoDialog
          open={historicoOpen}
          onOpenChange={setHistoricoOpen}
          teTag={historicoTag}
          historico={historicoLista}
          loading={historicoLoading}
        />
      </div>
    </Layout>
  );
}
