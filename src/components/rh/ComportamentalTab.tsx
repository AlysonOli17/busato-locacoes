import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Brain, Plus, Copy, Link, CheckCircle2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Funcionario } from "@/pages/RecursosHumanos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export interface TesteComportamental {
  id: string;
  funcionario_id: string;
  token_acesso: string;
  status: string;
  data_envio: string | null;
  resultado_d: number;
  resultado_i: number;
  resultado_s: number;
  resultado_c: number;
  tipo_teste: string;
  perfil_predominante: string | null;
  nivel_energia?: number | null;
  autocontrole?: number | null;
  criado_em: string;
  funcionarios?: { nome: string };
}

interface Props {
  funcionarios: Funcionario[];
}

export function ComportamentalTab({ funcionarios }: Props) {
  const { toast } = useToast();
  const [testes, setTestes] = useState<TesteComportamental[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string>("");
  const [tipoTeste, setTipoTeste] = useState<string>("Rápido");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [testDetails, setTestDetails] = useState<TesteComportamental | null>(null);

  const fetchTestes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('testes_comportamentais')
        .select(`
          *,
          funcionarios:funcionario_id (nome)
        `)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      setTestes(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar testes", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestes();
  }, []);

  const handleGenerateLink = async () => {
    if (!selectedFuncionarioId) {
      toast({ title: "Atenção", description: "Selecione um funcionário.", variant: "destructive" });
      return;
    }

    try {
      setIsGenerating(true);
      const { data, error } = await supabase
        .from('testes_comportamentais')
        .insert([{
          funcionario_id: selectedFuncionarioId,
          tipo_teste: tipoTeste
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      toast({ title: "Link gerado com sucesso!" });
      setIsDialogOpen(false);
      setSelectedFuncionarioId("");
      fetchTestes();
      
      // Copy to clipboard right away
      if (data?.token_acesso) {
        copyToClipboard(data.token_acesso);
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar link", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (token: string) => {
    const link = `${window.location.origin}/teste-disc/${token}`;
    navigator.clipboard.writeText(link);
    toast({ 
      title: "Link Copiado!", 
      description: "O link foi copiado para a área de transferência. Envie para o funcionário.",
      variant: "default"
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Concluído') {
      return <Badge variant="success" className="font-normal"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</Badge>;
    }
    return <Badge variant="secondary" className="font-normal"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pendente</Badge>;
  };

  const openDetails = (teste: TesteComportamental) => {
    setTestDetails(teste);
    setDetailsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este teste?")) return;
    try {
      const { error } = await supabase.from('testes_comportamentais').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Teste excluído com sucesso" });
      fetchTestes();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="glass shadow-sm border-border/40">
      <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4">
        <div>
          <CardTitle className="text-lg">Testes Comportamentais (DISC)</CardTitle>
          <CardDescription>Gere links para mapear o perfil da sua equipe</CardDescription>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 shadow-sm">
              <Link className="h-4 w-4 mr-2" /> Gerar Novo Teste
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>Gerar Link do Teste DISC</DialogTitle>
              <DialogDescription>
                Selecione o funcionário. Um link exclusivo será gerado para que ele responda pelo celular.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label className="mb-2 block">Funcionário *</Label>
              <Select 
                value={selectedFuncionarioId} 
                onValueChange={setSelectedFuncionarioId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.filter(f => f.status === 'Ativo').map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pb-4">
              <Label className="mb-2 block">Tamanho do Teste *</Label>
              <Select 
                value={tipoTeste} 
                onValueChange={setTipoTeste}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rápido">Rápido (6 perguntas)</SelectItem>
                  <SelectItem value="Intermediário">Intermediário (12 perguntas)</SelectItem>
                  <SelectItem value="Completo">Completo (24 perguntas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleGenerateLink} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar Link"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border border-border/50 bg-background/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Data Criação</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Perfil Predominante</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : testes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum teste gerado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                testes.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>{format(new Date(t.criado_em), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{t.funcionarios?.nome || 'Desconhecido'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal bg-background/50">
                        {t.tipo_teste || 'Rápido'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell>
                      {t.status === 'Concluído' ? (
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-primary">{t.perfil_predominante}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Aguardando resposta...</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {t.status === 'Pendente' ? (
                          <Button variant="secondary" size="sm" onClick={() => copyToClipboard(t.token_acesso)}>
                            <Copy className="h-4 w-4 mr-2" /> Copiar Link
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => openDetails(t)}>
                            Ver Detalhes
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Modal de Detalhes do DISC */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Brain className="h-6 w-6 text-primary" />
              Resultado DISC
            </DialogTitle>
            <DialogDescription>
              Análise comportamental de <strong>{testDetails?.funcionarios?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          
          {testDetails && (
            <div className="py-6 space-y-8">
              <div className="text-center p-6 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-sm font-medium text-primary uppercase tracking-widest mb-1">Perfil Predominante</p>
                <h3 className="text-3xl font-black text-primary">{testDetails.perfil_predominante}</h3>
              </div>

              <div className="space-y-6">
                <h4 className="font-semibold border-b border-border/50 pb-2">Distribuição dos Fatores</h4>
                
                <div className="space-y-4">
                  {/* D - Dominância */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-red-500">D - Dominância (Executor)</span>
                      <span className="font-mono">{testDetails.resultado_d} pts</span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${(testDetails.resultado_d / 6) * 100}%` }} />
                    </div>
                  </div>

                  {/* I - Influência */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-yellow-500">I - Influência (Comunicador)</span>
                      <span className="font-mono">{testDetails.resultado_i} pts</span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500" style={{ width: `${(testDetails.resultado_i / 6) * 100}%` }} />
                    </div>
                  </div>

                  {/* S - Estabilidade */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-green-500">S - Estabilidade (Planejador)</span>
                      <span className="font-mono">{testDetails.resultado_s} pts</span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${(testDetails.resultado_s / 6) * 100}%` }} />
                    </div>
                  </div>

                  {/* C - Conformidade */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-blue-500">C - Conformidade (Analista)</span>
                      <span className="font-mono">{testDetails.resultado_c} pts</span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${(testDetails.resultado_c / 6) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Análise PDA */}
              {(testDetails.nivel_energia !== undefined && testDetails.nivel_energia !== null) && (
                <div className="space-y-6 pt-6 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">Análise PDA (Estado Dinâmico)</h4>
                    <Badge variant="outline" className="bg-primary/5 text-primary">Novo</Badge>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Energia */}
                    <div className="space-y-2 bg-background/50 p-4 rounded-lg border border-border/40">
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="font-bold">Nível de Energia / Vitalidade</span>
                        <span className="font-mono font-bold">{testDetails.nivel_energia}%</span>
                      </div>
                      <Progress 
                        value={testDetails.nivel_energia} 
                        className="h-3"
                        indicatorClassName={
                          testDetails.nivel_energia < 30 ? "bg-destructive" :
                          testDetails.nivel_energia < 70 ? "bg-primary" : "bg-success"
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {testDetails.nivel_energia < 30 ? 
                          "Atenção: Nível de energia crítico. O colaborador pode estar em sobrecarga ou próximo ao esgotamento (Burnout). Recomenda-se acompanhamento." :
                         testDetails.nivel_energia < 70 ?
                          "Energia estável. O colaborador consegue lidar com as demandas atuais de forma equilibrada." :
                          "Alta vitalidade. O colaborador está muito energizado e pronto para assumir novos desafios e maior carga."
                        }
                      </p>
                    </div>

                    {/* Autocontrole */}
                    <div className="space-y-2 bg-background/50 p-4 rounded-lg border border-border/40">
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="font-bold">Autocontrole Emocional</span>
                        <span className="font-mono font-bold">{testDetails.autocontrole}%</span>
                      </div>
                      <Progress 
                        value={testDetails.autocontrole} 
                        className="h-3"
                        indicatorClassName={
                          testDetails.autocontrole! < 30 ? "bg-destructive" :
                          testDetails.autocontrole! < 70 ? "bg-primary" : "bg-success"
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {testDetails.autocontrole! < 30 ? 
                          "Baixo autocontrole. Tende a ser impulsivo e pode perder a calma facilmente sob pressão." :
                         testDetails.autocontrole! < 70 ?
                          "Autocontrole moderado. Consegue racionalizar após o impacto inicial do estresse." :
                          "Alto autocontrole. Mantém a postura e o raciocínio lógico absoluto, mesmo sob forte pressão."
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setDetailsOpen(false)}>Fechar Relatório</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
