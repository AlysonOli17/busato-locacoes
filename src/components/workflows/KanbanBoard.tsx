import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreVertical, AlertCircle, Clock, Loader2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { SolicitacaoModal } from "./SolicitacaoModal";
import { AprovacaoModal } from "./AprovacaoModal";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  workflow: any;
}

export function KanbanBoard({ workflow }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [etapas, setEtapas] = useState<any[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [isSolicitacaoModalOpen, setIsSolicitacaoModalOpen] = useState(false);
  const [isAprovacaoModalOpen, setIsAprovacaoModalOpen] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<any>(null);
  const [targetEtapa, setTargetEtapa] = useState<any>(null);

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
      toast({ title: "Erro ao carregar Kanban", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, solicitacao: any) => {
    e.dataTransfer.setData("solicitacao_id", solicitacao.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
  };

  const handleDrop = async (e: React.DragEvent, novaEtapa: any) => {
    e.preventDefault();
    const solicitacaoId = e.dataTransfer.getData("solicitacao_id");
    const solicitacao = solicitacoes.find(s => s.id === solicitacaoId);
    
    if (!solicitacao || solicitacao.etapa_id === novaEtapa.id) return;

    // Verifica se a nova etapa exige aprovação
    if (novaEtapa.requer_aprovacao) {
      if (novaEtapa.aprovador_id && novaEtapa.aprovador_id !== user?.id) {
        toast({ title: "Acesso Negado", description: "Você não tem permissão para aprovar nesta etapa.", variant: "destructive" });
        return;
      }
      setSelectedSolicitacao(solicitacao);
      setTargetEtapa(novaEtapa);
      setIsAprovacaoModalOpen(true);
    } else {
      // Movimentação livre
      await moverSolicitacao(solicitacao, novaEtapa);
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
        usuario_nome: 'Sistema' // TODO: Pegar usuario logado
      }]);

      toast({ title: "Movido com sucesso!" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao mover", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
      {etapas.map(etapa => {
        const cards = solicitacoes.filter(s => s.etapa_id === etapa.id);
        
        return (
          <div 
            key={etapa.id} 
            className="flex-shrink-0 w-[320px] flex flex-col bg-muted/20 rounded-xl border border-border/50"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, etapa)}
          >
            {/* Header da Coluna */}
            <div className={`p-3 rounded-t-xl border-b border-border/50 flex items-center justify-between shadow-sm relative overflow-hidden bg-background/80 backdrop-blur-sm`}>
              <div className={`absolute top-0 left-0 w-full h-1 ${etapa.cor}`}></div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{etapa.nome}</h3>
                <Badge variant="secondary" className="text-xs px-1.5 py-0 rounded-full">{cards.length}</Badge>
              </div>
              {etapa.requer_aprovacao && (
                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                  Requer Aprovação
                </Badge>
              )}
            </div>

            {/* Corpo da Coluna */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]">
              {cards.map(card => (
                <div 
                  key={card.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, card)}
                  className="bg-card rounded-lg border border-border shadow-sm p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                  onClick={() => {
                    setSelectedSolicitacao(card);
                    setIsSolicitacaoModalOpen(true);
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-muted-foreground">#{card.codigo}</span>
                    <Badge variant={card.prioridade === 'Urgente' ? 'destructive' : card.prioridade === 'Alta' ? 'default' : 'secondary'} className="text-[10px]">
                      {card.prioridade}
                    </Badge>
                  </div>
                  <h4 className="font-medium text-sm leading-tight mb-2 line-clamp-2">{card.titulo}</h4>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-1 truncate max-w-[120px]">
                      <Clock className="h-3 w-3" />
                      <span className="truncate">{format(new Date(card.created_at), 'dd/MM')}</span>
                    </div>
                    {etapa.requer_aprovacao && (
                       <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full text-blue-500 bg-blue-500/10 hover:bg-blue-500/20" title="Notificar WhatsApp" onClick={(e) => {
                         e.stopPropagation();
                         const text = encodeURIComponent(`Olá! A solicitação #${card.codigo} (${card.titulo}) aguarda sua aprovação na etapa '${etapa.nome}'.`);
                         window.open(`https://wa.me/?text=${text}`, '_blank');
                       }}>
                         <MessageCircle className="h-3 w-3" />
                       </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer da Coluna */}
            {etapa.ordem === 1 && (
              <div className="p-3 pt-0">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-foreground border border-dashed border-border/50 bg-background/50"
                  onClick={() => {
                    setSelectedSolicitacao(null);
                    setTargetEtapa(etapa);
                    setIsSolicitacaoModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Nova Solicitação
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Modais omitidos nesta versão inicial, faremos a seguir */}
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
