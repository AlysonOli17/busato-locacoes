import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, GitMerge, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { KanbanBoard } from "@/components/workflows/KanbanBoard";
import { Layout } from "@/components/Layout";

export default function Workflows() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setWorkflows(data || []);
      if (data && data.length > 0 && !activeWorkflow) {
        setActiveWorkflow(data[0]);
      }
    } catch (err: any) {
      toast({ title: "Erro ao carregar workflows", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMockWorkflow = async () => {
    // Cria um workflow inicial para demonstração
    try {
      setLoading(true);
      
      const { data: wf, error: e1 } = await supabase.from('workflows').insert([{
        nome: 'Manutenção de Equipamento',
        descricao: 'Fluxo para aprovação e execução de manutenções',
        icone: 'wrench'
      }]).select().single();
      if (e1) throw e1;

      // Cria as etapas
      const etapas = [
        { workflow_id: wf.id, nome: 'Abertura', ordem: 1, cor: 'bg-gray-500', requer_aprovacao: false },
        { workflow_id: wf.id, nome: 'Orçamento', ordem: 2, cor: 'bg-yellow-500', requer_aprovacao: false },
        { workflow_id: wf.id, nome: 'Aprovação Diretoria', ordem: 3, cor: 'bg-blue-500', requer_aprovacao: true, qtd_aprovacoes_necessarias: 1, notificar_whatsapp: true },
        { workflow_id: wf.id, nome: 'Em Execução', ordem: 4, cor: 'bg-purple-500', requer_aprovacao: false },
        { workflow_id: wf.id, nome: 'Concluído', ordem: 5, cor: 'bg-green-500', requer_aprovacao: false }
      ];

      const { error: e2 } = await supabase.from('workflow_etapas').insert(etapas);
      if (e2) throw e2;

      toast({ title: "Workflow criado!" });
      fetchWorkflows();
    } catch (err: any) {
      toast({ title: "Erro ao criar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Processos (Workflows)" subtitle="Gerencie processos, aprovações e chamados.">
      <div className="flex justify-end mb-4">
        <Button variant="outline" onClick={() => navigate('/workflows/configurar')}>
          <Settings className="h-4 w-4 mr-2" /> Configurar Processos
        </Button>
      </div>

      <div className="flex-1 flex flex-col h-[calc(100vh-140px)] overflow-hidden bg-background rounded-lg border border-border shadow-sm p-4 gap-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="p-6 bg-muted/30 rounded-full">
              <GitMerge className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold">Nenhum processo configurado</h2>
            <p className="text-muted-foreground max-w-md">
              Crie seu primeiro workflow para começar a orquestrar ordens de serviço, aprovações e tarefas.
            </p>
            <Button onClick={handleCreateMockWorkflow}>
              <Plus className="h-4 w-4 mr-2" /> Gerar Workflow de Manutenção (Demo)
            </Button>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Abas de Workflows (caso tenha mais de um) */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 flex-shrink-0 custom-scrollbar">
              {workflows.map(wf => (
                <Button 
                  key={wf.id} 
                  variant={activeWorkflow?.id === wf.id ? "default" : "outline"}
                  onClick={() => setActiveWorkflow(wf)}
                  className="whitespace-nowrap"
                >
                  {wf.nome}
                </Button>
              ))}
            </div>

            {/* Kanban Board Container */}
            {activeWorkflow && (
              <div className="flex-1 overflow-hidden min-h-0">
                <KanbanBoard workflow={activeWorkflow} />
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
