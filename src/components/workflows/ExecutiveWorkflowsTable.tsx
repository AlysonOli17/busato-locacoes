import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Clock, Loader2, ShieldCheck, Send, CheckCircle2, Eye, Filter, ListFilter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { SolicitacaoModal } from "./SolicitacaoModal";
import { AprovacaoModal } from "./AprovacaoModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface Props {
  workflow: any;
}

export function ExecutiveWorkflowsTable({ workflow }: Props) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [etapas, setEtapas] = useState<any[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [isSolicitacaoModalOpen, setIsSolicitacaoModalOpen] = useState(false);
  const [isAprovacaoModalOpen, setIsAprovacaoModalOpen] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<any>(null);
  const [targetEtapa, setTargetEtapa] = useState<any>(null);
  
  // Filter
  const [filterMode, setFilterMode] = useState<"all" | "my_approvals" | "active">("active");

  useEffect(() => {
    if (workflow) {
      fetchData();
    }
  }, [workflow]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Etapas
      const { data: etData, error: etErr } = await supabase
        .from('workflow_etapas')
        .select('*')
        .eq('workflow_id', workflow.id)
        .order('ordem', { ascending: true });
      if (etErr) throw etErr;
      setEtapas(etData || []);

      // 2. Solicitacoes
      const { data: solData, error: solErr } = await supabase
        .from('solicitacoes')
        .select(`
          *,
          etapa:workflow_etapas(*)
        `)
        .eq('workflow_id', workflow.id)
        .order('created_at', { ascending: false });
      if (solErr) throw solErr;
      setSolicitacoes(solData || []);

    } catch (err: any) {
      toast({ title: "Erro ao carregar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const moverSolicitacao = async (solicitacao: any, novaEtapa: any) => {
    try {
      // 1. Update card
      const { error: updErr } = await supabase
        .from('solicitacoes')
        .update({ etapa_id: novaEtapa.id })
        .eq('id', solicitacao.id);
      if (updErr) throw updErr;

      // 2. Historico
      await supabase.from('solicitacoes_historico').insert([{
        solicitacao_id: solicitacao.id,
        etapa_anterior_id: solicitacao.etapa_id,
        etapa_nova_id: novaEtapa.id,
        acao: 'Movido',
        usuario_id: user?.id,
        usuario_nome: profile?.nome || 'Sistema'
      }]);

      toast({ title: "Avançado com sucesso!" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao avançar", description: err.message, variant: "destructive" });
    }
  };

  const handleAction = async (solicitacao: any, nextEtapa: any, requiresApproval: boolean, isApprover: boolean) => {
    if (requiresApproval) {
      if (!isApprover) {
        toast({ title: "Acesso Negado", description: "Apenas o aprovador designado pode assinar esta etapa.", variant: "destructive" });
        return;
      }
      // Open approval modal
      setSelectedSolicitacao(solicitacao);
      setTargetEtapa(nextEtapa);
      setIsAprovacaoModalOpen(true);
    } else {
      // Direct move
      await moverSolicitacao(solicitacao, nextEtapa);
    }
  };

  const handleNotifyWhatsapp = (solicitacao: any) => {
    const text = encodeURIComponent(`Olá! Existe uma solicitação de "${solicitacao.titulo}" (Prioridade: ${solicitacao.prioridade}) aguardando a sua aprovação no sistema Busato.\nProcesso: ${workflow.nome}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Filter Logic
  let filteredSolicitacoes = solicitacoes;
  if (filterMode === "my_approvals") {
    filteredSolicitacoes = solicitacoes.filter(s => {
      const idx = etapas.findIndex(e => e.id === s.etapa_id);
      const next = etapas[idx + 1];
      return next && next.requer_aprovacao && next.aprovador_id === user?.id;
    });
  } else if (filterMode === "active") {
    const lastEtapaId = etapas[etapas.length - 1]?.id;
    filteredSolicitacoes = solicitacoes.filter(s => s.etapa_id !== lastEtapaId);
  }

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border border-border shadow-sm overflow-hidden">
      
      {/* Header com Filtros */}
      <div className="p-4 border-b border-border/50 bg-muted/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-medium bg-background text-sm">
            {filteredSolicitacoes.length} Registros
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <ListFilter className="h-4 w-4 mr-2" />
                {filterMode === 'all' ? 'Todos' : filterMode === 'active' ? 'Em Andamento' : 'Minhas Aprovações'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filtros de Exibição</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterMode('active')}>
                Somente Em Andamento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterMode('my_approvals')}>
                Aguardando Minha Aprovação
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterMode('all')}>
                Mostrar Todos (Inclui Concluídos)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button onClick={() => {
          setSelectedSolicitacao(null);
          setIsSolicitacaoModalOpen(true);
        }} className="bg-primary/90 hover:bg-primary shadow-sm h-8">
          <Plus className="h-4 w-4 mr-2" /> Nova Solicitação
        </Button>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-[100px]">Ref</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="w-[120px]">Prioridade</TableHead>
              <TableHead className="w-[180px]">Data Criação</TableHead>
              <TableHead className="w-[300px]">Progresso</TableHead>
              <TableHead className="text-right w-[150px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSolicitacoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                  Nenhuma solicitação encontrada com o filtro atual.
                </TableCell>
              </TableRow>
            ) : (
              filteredSolicitacoes.map(solicitacao => {
                const etapaAtualIndex = etapas.findIndex(e => e.id === solicitacao.etapa_id);
                const isFinalizado = etapaAtualIndex === etapas.length - 1;
                const proximaEtapa = etapas[etapaAtualIndex + 1];
                
                let requiresApproval = false;
                let isApprover = false;
                if (proximaEtapa && proximaEtapa.requer_aprovacao) {
                  requiresApproval = true;
                  // Master roles ou Admin roles também deveriam poder aprovar se necessário, mas por enquanto seguimos a regra de negócio exata.
                  isApprover = proximaEtapa.aprovador_id === user?.id;
                }

                return (
                  <TableRow key={solicitacao.id} className="hover:bg-muted/5 group">
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      #{solicitacao.codigo}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors cursor-pointer" onClick={() => {
                        setSelectedSolicitacao(solicitacao);
                        setIsSolicitacaoModalOpen(true);
                      }}>
                        {solicitacao.titulo}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={solicitacao.prioridade === 'Urgente' ? 'destructive' : solicitacao.prioridade === 'Alta' ? 'default' : 'secondary'} className="text-[10px]">
                        {solicitacao.prioridade}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {format(new Date(solicitacao.created_at), "dd/MM/yyyy HH:mm")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {/* Tracker Visual Minimalista */}
                      <div className="flex flex-col gap-1 w-full max-w-[250px]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{solicitacao.etapa?.nome}</span>
                          <span className="text-[10px] text-muted-foreground">{etapaAtualIndex + 1} de {etapas.length}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {etapas.map((et, idx) => {
                            const isCompleted = idx < etapaAtualIndex;
                            const isCurrent = idx === etapaAtualIndex;
                            
                            return (
                              <div key={et.id} className="flex-1 h-1.5 rounded-full relative overflow-hidden bg-muted">
                                {(isCompleted || isCurrent) && (
                                  <div className={`absolute inset-0 ${isCurrent ? et.cor : 'bg-primary/30'} ${isCurrent && !isFinalizado ? 'animate-pulse' : ''}`}></div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isFinalizado ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Finalizado
                        </Badge>
                      ) : requiresApproval ? (
                        <div className="flex justify-end gap-1">
                          <Button 
                            size="sm" 
                            className={`h-7 px-3 text-xs ${isApprover ? 'bg-success hover:bg-success/90 text-white shadow-sm' : 'bg-muted text-muted-foreground cursor-not-allowed border border-border'}`}
                            onClick={() => handleAction(solicitacao, proximaEtapa, true, isApprover)}
                            disabled={!isApprover}
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" /> Aprovar
                          </Button>
                          {!isApprover && (
                            <Button size="icon" variant="outline" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleNotifyWhatsapp(solicitacao)} title="Notificar Aprovador no WhatsApp">
                              <Send className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 px-3 text-xs text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground shadow-sm"
                          onClick={() => handleAction(solicitacao, proximaEtapa, false, true)}
                        >
                          Avançar <CheckCircle2 className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modais */}
      {isAprovacaoModalOpen && (
        <AprovacaoModal 
          isOpen={isAprovacaoModalOpen} 
          onClose={() => setIsAprovacaoModalOpen(false)}
          solicitacao={selectedSolicitacao}
          novaEtapa={targetEtapa}
          onSuccess={() => {
            moverSolicitacao(selectedSolicitacao, targetEtapa);
            setIsAprovacaoModalOpen(false);
          }}
        />
      )}
      
      {isSolicitacaoModalOpen && (
        <SolicitacaoModal
          isOpen={isSolicitacaoModalOpen}
          onClose={() => setIsSolicitacaoModalOpen(false)}
          solicitacao={selectedSolicitacao}
          workflowId={workflow.id}
          etapaInicial={etapas[0]}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
