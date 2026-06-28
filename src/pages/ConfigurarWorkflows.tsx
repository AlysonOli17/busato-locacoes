import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, ArrowLeft, GitMerge, Settings2, Trash2, GripVertical, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ConfigurarWorkflows() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection
  const [selectedWf, setSelectedWf] = useState<any>(null);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [etapasLoading, setEtapasLoading] = useState(false);

  // Modals
  const [isWfModalOpen, setIsWfModalOpen] = useState(false);
  const [isEtapaModalOpen, setIsEtapaModalOpen] = useState(false);
  const [newWfName, setNewWfName] = useState("");
  
  const [etapaForm, setEtapaForm] = useState({
    nome: "",
    cor: "bg-gray-500",
    requer_aprovacao: false,
    aprovador_id: "",
    ordem: 1
  });

  useEffect(() => {
    fetchWorkflows();
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id, full_name').order('full_name');
      if (!error && data) {
        setUsuarios(data);
      }
    } catch (e) {}
  };

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setWorkflows(data || []);
      if (data && data.length > 0 && !selectedWf) {
        handleSelectWf(data[0]);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWf = async (wf: any) => {
    setSelectedWf(wf);
    setEtapasLoading(true);
    try {
      const { data, error } = await supabase
        .from('workflow_etapas')
        .select('*')
        .eq('workflow_id', wf.id)
        .order('ordem', { ascending: true });
      if (error) throw error;
      setEtapas(data || []);
    } catch (err: any) {
      toast({ title: "Erro nas etapas", description: err.message, variant: "destructive" });
    } finally {
      setEtapasLoading(false);
    }
  };

  const handleCreateWf = async () => {
    if (!newWfName) return;
    try {
      const { data, error } = await supabase.from('workflows').insert([{
        nome: newWfName,
        descricao: '',
      }]).select().single();
      if (error) throw error;
      toast({ title: "Processo criado!" });
      setNewWfName("");
      setIsWfModalOpen(false);
      fetchWorkflows();
      handleSelectWf(data);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteWf = async (id: string) => {
    if(!confirm("Tem certeza que deseja apagar este processo? Tudo será perdido.")) return;
    try {
      await supabase.from('workflows').delete().eq('id', id);
      toast({ title: "Deletado" });
      setSelectedWf(null);
      fetchWorkflows();
    } catch (err: any) {
      toast({ title: "Erro ao deletar", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateEtapa = async () => {
    if (!etapaForm.nome || !selectedWf) return;
    try {
      const novaOrdem = etapas.length > 0 ? Math.max(...etapas.map(e => e.ordem)) + 1 : 1;
      
      const { error } = await supabase.from('workflow_etapas').insert([{
        workflow_id: selectedWf.id,
        nome: etapaForm.nome,
        ordem: etapaForm.ordem || novaOrdem,
        cor: etapaForm.cor,
        requer_aprovacao: etapaForm.requer_aprovacao,
        aprovador_id: etapaForm.aprovador_id || null
      }]);
      if (error) throw error;
      toast({ title: "Etapa criada!" });
      setIsEtapaModalOpen(false);
      setEtapaForm({ nome: "", cor: "bg-gray-500", requer_aprovacao: false, aprovador_id: "", ordem: 1 });
      handleSelectWf(selectedWf);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteEtapa = async (id: string) => {
    if(!confirm("Excluir esta etapa? (Não faça isso se já existirem tickets nela)")) return;
    try {
      await supabase.from('workflow_etapas').delete().eq('id', id);
      toast({ title: "Deletada" });
      handleSelectWf(selectedWf);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 pt-6 pb-20 md:pb-8 h-screen overflow-y-auto w-full bg-background/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/workflows')} className="mb-2 -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para o Kanban
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" /> Configurar Processos
          </h1>
          <p className="text-muted-foreground text-sm">Crie novos fluxos (Workflows) e defina quantas etapas de aprovação quiser.</p>
        </div>
        <Button onClick={() => setIsWfModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Processo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Lado Esquerdo - Lista de Workflows */}
        <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-3">
          <h3 className="font-semibold text-lg text-muted-foreground mb-2">Processos Ativos</h3>
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            workflows.map(wf => (
              <Card 
                key={wf.id} 
                className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedWf?.id === wf.id ? 'border-primary shadow-sm bg-primary/5' : ''}`}
                onClick={() => handleSelectWf(wf)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-md"><GitMerge className="h-4 w-4 text-primary" /></div>
                    <span className="font-medium">{wf.nome}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Lado Direito - Etapas do Workflow Selecionado */}
        <div className="md:col-span-8 lg:col-span-9">
          {selectedWf ? (
            <Card className="h-full border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between bg-muted/20 border-b pb-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    Funil: {selectedWf.nome}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Crie as etapas (colunas do Kanban) da esquerda para a direita. Marque se exigem aprovação.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => handleDeleteWf(selectedWf.id)}>
                    Excluir Funil
                  </Button>
                  <Button size="sm" onClick={() => setIsEtapaModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Etapa
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {etapasLoading ? (
                   <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : etapas.length === 0 ? (
                  <div className="text-center p-12 text-muted-foreground">
                    <GitMerge className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Nenhuma etapa neste processo.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {etapas.map((etapa, idx) => (
                      <div key={etapa.id} className="flex items-center justify-between p-4 bg-background border border-border/60 rounded-lg shadow-sm hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-4">
                          <GripVertical className="h-5 w-5 text-muted-foreground/50 cursor-grab" />
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{etapa.nome}</h4>
                              <div className={`w-3 h-3 rounded-full ${etapa.cor}`}></div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {etapa.requer_aprovacao ? (
                                <Badge variant="outline" className="text-blue-600 bg-blue-500/10 border-blue-500/20 text-[10px]">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Requer Aprovação Formada (1)
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                  Livre trânsito
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteEtapa(etapa.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="h-full min-h-[400px] flex items-center justify-center border border-dashed rounded-xl bg-muted/10 text-muted-foreground">
              Selecione ou crie um processo à esquerda
            </div>
          )}
        </div>
      </div>

      {/* Modal Workflow */}
      <Dialog open={isWfModalOpen} onOpenChange={setIsWfModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Processo (Workflow)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Processo</Label>
              <Input placeholder="Ex: Compra de Peças" value={newWfName} onChange={(e) => setNewWfName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWfModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateWf}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Etapa */}
      <Dialog open={isEtapaModalOpen} onOpenChange={setIsEtapaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Etapa (Coluna Kanban)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Etapa</Label>
              <Input placeholder="Ex: Aprovação Gerência" value={etapaForm.nome} onChange={(e) => setEtapaForm({...etapaForm, nome: e.target.value})} />
            </div>
            
            <div className="space-y-2 pt-4">
              <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg border border-border/50">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold text-primary">Requer Aprovação?</Label>
                  <p className="text-xs text-muted-foreground">O sistema travará a tela exigindo justificativa e nome do gestor para entrar nesta coluna.</p>
                </div>
                <Switch 
                  checked={etapaForm.requer_aprovacao}
                  onCheckedChange={(c) => setEtapaForm({...etapaForm, requer_aprovacao: c})}
                />
              </div>
            </div>

            {etapaForm.requer_aprovacao && (
              <div className="space-y-2">
                <Label>Quem deve aprovar?</Label>
                <select 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={etapaForm.aprovador_id}
                  onChange={(e) => setEtapaForm({...etapaForm, aprovador_id: e.target.value})}
                >
                  <option value="">Qualquer pessoa com acesso</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Cor de Destaque</Label>
              <div className="flex gap-2">
                {['bg-gray-500', 'bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500'].map(cor => (
                  <button 
                    key={cor} 
                    className={`w-8 h-8 rounded-full ${cor} ${etapaForm.cor === cor ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    onClick={() => setEtapaForm({...etapaForm, cor})}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEtapaModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateEtapa}>Adicionar Etapa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
