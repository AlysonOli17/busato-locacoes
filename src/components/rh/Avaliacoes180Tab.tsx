import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Plus, Copy, Link, CheckCircle2, Loader2, RefreshCw, Trash2, Eye, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Funcionario } from "@/pages/RecursosHumanos";

export interface AvaliacaoDesempenho {
  id: string;
  funcionario_id: string;
  avaliador_id: string | null;
  tipo: 'Autoavaliacao' | '180_Graus';
  status: 'Pendente' | 'Concluído';
  token_acesso: string | null;
  nota_tecnica: number | null;
  nota_pontualidade: number | null;
  nota_trabalho_equipe: number | null;
  nota_proatividade: number | null;
  nota_cuidado_equipamentos: number | null;
  observacoes: string | null;
  criado_em: string;
  funcionarios?: { nome: string };
  avaliador?: { nome: string };
}

interface Props {
  funcionarios: Funcionario[];
}

export function Avaliacoes180Tab({ funcionarios }: Props) {
  const { toast } = useToast();
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoDesempenho[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States para Autoavaliação
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // States para Avaliação 180 Graus
  const [is180DialogOpen, setIs180DialogOpen] = useState(false);
  const [formData180, setFormData180] = useState<Partial<AvaliacaoDesempenho>>({});
  
  // State para Comparativo
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareData, setCompareData] = useState<{auto: AvaliacaoDesempenho | null, lider: AvaliacaoDesempenho | null}>({auto: null, lider: null});

  const fetchAvaliacoes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('avaliacoes_desempenho')
        .select(`
          *,
          funcionarios!avaliacoes_desempenho_funcionario_id_fkey (nome),
          avaliador:funcionarios!avaliacoes_desempenho_avaliador_id_fkey (nome)
        `)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      setAvaliacoes(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar avaliações", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvaliacoes();
  }, []);

  const handleGenerateLink = async () => {
    if (!selectedFuncionarioId) {
      toast({ title: "Selecione um funcionário", variant: "destructive" });
      return;
    }

    try {
      setIsGenerating(true);
      
      // Gera um token aleatório simples para o link
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const { data, error } = await supabase
        .from('avaliacoes_desempenho')
        .insert([{
          funcionario_id: selectedFuncionarioId,
          tipo: 'Autoavaliacao',
          token_acesso: token
        }]);
      
      if (error) throw error;
      
      toast({ title: "Link gerado com sucesso!" });
      setIsDialogOpen(false);
      setSelectedFuncionarioId("");
      fetchAvaliacoes();
    } catch (err: any) {
      toast({ title: "Erro ao gerar link", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (token: string | null) => {
    if (!token) return;
    const url = `${window.location.origin}/autoavaliacao/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: "Envie este link para o funcionário." });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta avaliação?")) return;
    try {
      const { error } = await supabase.from('avaliacoes_desempenho').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Excluída com sucesso" });
      fetchAvaliacoes();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };
  
  const open180Dialog = (funcionarioId?: string) => {
    setFormData180({
      funcionario_id: funcionarioId || "",
      tipo: '180_Graus',
      status: 'Concluído',
      nota_tecnica: 0,
      nota_pontualidade: 0,
      nota_trabalho_equipe: 0,
      nota_proatividade: 0,
      nota_cuidado_equipamentos: 0,
      observacoes: ""
    });
    setIs180DialogOpen(true);
  };
  
  const handleSave180 = async () => {
    if (!formData180.funcionario_id) {
      toast({ title: "Selecione o funcionário", variant: "destructive" });
      return;
    }
    
    // Validar se todas as notas foram preenchidas > 0
    if (!formData180.nota_tecnica || !formData180.nota_pontualidade || !formData180.nota_trabalho_equipe || !formData180.nota_proatividade || !formData180.nota_cuidado_equipamentos) {
      toast({ title: "Preencha todas as notas", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('avaliacoes_desempenho')
        .insert([{
          funcionario_id: formData180.funcionario_id,
          tipo: '180_Graus',
          status: 'Concluído',
          nota_tecnica: formData180.nota_tecnica,
          nota_pontualidade: formData180.nota_pontualidade,
          nota_trabalho_equipe: formData180.nota_trabalho_equipe,
          nota_proatividade: formData180.nota_proatividade,
          nota_cuidado_equipamentos: formData180.nota_cuidado_equipamentos,
          observacoes: formData180.observacoes
        }]);
      
      if (error) throw error;
      
      toast({ title: "Avaliação 180º salva com sucesso!" });
      setIs180DialogOpen(false);
      fetchAvaliacoes();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const openCompare = (funcionarioId: string) => {
    const funcs = avaliacoes.filter(a => a.funcionario_id === funcionarioId && a.status === 'Concluído');
    const auto = funcs.find(a => a.tipo === 'Autoavaliacao') || null;
    const lider = funcs.find(a => a.tipo === '180_Graus') || null;
    
    if (!auto && !lider) {
      toast({ title: "Nenhuma avaliação concluída para comparar", variant: "destructive" });
      return;
    }
    
    setCompareData({ auto, lider });
    setIsCompareOpen(true);
  };

  const StarRating = ({ value, onChange, readonly = false }: { value: number, onChange?: (val: number) => void, readonly?: boolean }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            className={`h-6 w-6 ${readonly ? '' : 'cursor-pointer'} ${star <= value ? 'fill-primary text-primary' : 'text-muted-foreground opacity-30'}`}
            onClick={() => !readonly && onChange && onChange(star)}
          />
        ))}
      </div>
    );
  };

  const CompareRow = ({ label, valAuto, valLider }: { label: string, valAuto?: number | null, valLider?: number | null }) => {
    const diff = (valAuto || 0) - (valLider || 0);
    let diffColor = "text-muted-foreground";
    if (diff > 1) diffColor = "text-destructive font-bold"; // Funcionario se acha muito melhor que o lider acha
    else if (diff < -1) diffColor = "text-success font-bold"; // Lider acha melhor que o proprio funcionario
    
    return (
      <div className="grid grid-cols-12 gap-4 items-center py-2 border-b border-border/40 text-sm">
        <div className="col-span-4 font-medium">{label}</div>
        <div className="col-span-3 flex justify-center"><StarRating value={valAuto || 0} readonly /></div>
        <div className="col-span-3 flex justify-center"><StarRating value={valLider || 0} readonly /></div>
        <div className="col-span-2 text-right">
          <span className={diffColor}>{diff > 0 ? `+${diff}` : diff}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-background/50 p-4 rounded-lg border border-border/40">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Avaliações de Desempenho
          </h2>
          <p className="text-muted-foreground text-sm">Autoavaliação e Avaliação 180 Graus (Líder x Liderado)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="shadow-sm">
            <Link className="h-4 w-4 mr-2" /> Link Autoavaliação
          </Button>
          <Button onClick={() => open180Dialog()} className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Nova Avaliação 180º
          </Button>
        </div>
      </div>

      <Card className="glass shadow-sm border-border/40">
        <CardContent className="p-0">
          <div className="rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Data</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : avaliacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      Nenhuma avaliação cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  avaliacoes.map(a => (
                    <TableRow key={a.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>{format(new Date(a.criado_em), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{a.funcionarios?.nome || 'Desconhecido'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={a.tipo === 'Autoavaliacao' ? 'border-blue-500/30 text-blue-500 bg-blue-500/10' : 'border-purple-500/30 text-purple-500 bg-purple-500/10'}>
                          {a.tipo === 'Autoavaliacao' ? 'Autoavaliação' : '180 Graus (Líder)'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.status === 'Concluído' ? (
                          <Badge variant="success" className="font-normal"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</Badge>
                        ) : (
                          <Badge variant="secondary" className="font-normal"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {a.tipo === 'Autoavaliacao' && a.status === 'Pendente' && (
                            <Button variant="secondary" size="sm" onClick={() => copyToClipboard(a.token_acesso)}>
                              <Copy className="h-4 w-4 mr-2" /> Copiar Link
                            </Button>
                          )}
                          {a.status === 'Concluído' && (
                            <Button variant="outline" size="sm" onClick={() => openCompare(a.funcionario_id)}>
                              <Eye className="h-4 w-4 mr-2" /> Comparar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
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
      </Card>

      {/* Modal Gerar Link Autoavaliação */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Autoavaliação</DialogTitle>
            <DialogDescription>
              Gere um link para o funcionário realizar sua autoavaliação.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">Selecione o Funcionário</Label>
            <Select value={selectedFuncionarioId} onValueChange={setSelectedFuncionarioId}>
              <SelectTrigger>
                <SelectValue placeholder="Busque um funcionário..." />
              </SelectTrigger>
              <SelectContent>
                {funcionarios.filter(f => f.status === 'Ativo').map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateLink} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link className="h-4 w-4 mr-2" />}
              Gerar Link Público
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Avaliação 180 Graus (Líder) */}
      <Dialog open={is180DialogOpen} onOpenChange={setIs180DialogOpen}>
        <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Avaliação 180 Graus (Visão do Líder)</DialogTitle>
            <DialogDescription>
              Avalie o desempenho e comportamento do colaborador.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            <div>
              <Label className="mb-2 block">Colaborador Avaliado *</Label>
              <Select 
                value={formData180.funcionario_id} 
                onValueChange={(v) => setFormData180({...formData180, funcionario_id: v})}
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

            <div className="space-y-4">
              <h4 className="font-semibold border-b pb-2 text-primary">Notas de 1 a 5</h4>
              
              <div className="flex justify-between items-center">
                <Label>Qualidade Técnica do Trabalho</Label>
                <StarRating 
                  value={formData180.nota_tecnica || 0} 
                  onChange={(v) => setFormData180({...formData180, nota_tecnica: v})} 
                />
              </div>
              <div className="flex justify-between items-center">
                <Label>Pontualidade e Assiduidade</Label>
                <StarRating 
                  value={formData180.nota_pontualidade || 0} 
                  onChange={(v) => setFormData180({...formData180, nota_pontualidade: v})} 
                />
              </div>
              <div className="flex justify-between items-center">
                <Label>Trabalho em Equipe e Relacionamento</Label>
                <StarRating 
                  value={formData180.nota_trabalho_equipe || 0} 
                  onChange={(v) => setFormData180({...formData180, nota_trabalho_equipe: v})} 
                />
              </div>
              <div className="flex justify-between items-center">
                <Label>Proatividade e Resolução de Problemas</Label>
                <StarRating 
                  value={formData180.nota_proatividade || 0} 
                  onChange={(v) => setFormData180({...formData180, nota_proatividade: v})} 
                />
              </div>
              <div className="flex justify-between items-center">
                <Label>Cuidado com Equipamentos/Ferramentas</Label>
                <StarRating 
                  value={formData180.nota_cuidado_equipamentos || 0} 
                  onChange={(v) => setFormData180({...formData180, nota_cuidado_equipamentos: v})} 
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Observações Gerais (Pontos Fortes e a Desenvolver)</Label>
              <Textarea 
                placeholder="Descreva aqui o feedback qualitativo..." 
                rows={4}
                value={formData180.observacoes || ""}
                onChange={(e) => setFormData180({...formData180, observacoes: e.target.value})}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIs180DialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave180}>Salvar Avaliação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Comparativo (Auto vs 180) */}
      <Dialog open={isCompareOpen} onOpenChange={setIsCompareOpen}>
        <DialogContent className="sm:max-w-[700px] bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Comparativo de Avaliação</DialogTitle>
            <DialogDescription>
              {compareData.auto?.funcionarios?.nome || compareData.lider?.funcionarios?.nome}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            <div className="grid grid-cols-12 gap-4 pb-2 border-b-2 border-border font-bold text-sm text-center">
              <div className="col-span-4 text-left text-muted-foreground">Competência</div>
              <div className="col-span-3 text-blue-500">Autoavaliação</div>
              <div className="col-span-3 text-purple-500">Visão do Líder</div>
              <div className="col-span-2 text-right text-muted-foreground">Gap</div>
            </div>

            <div className="space-y-1">
              <CompareRow label="Qualidade Técnica" valAuto={compareData.auto?.nota_tecnica} valLider={compareData.lider?.nota_tecnica} />
              <CompareRow label="Pontualidade/Assiduidade" valAuto={compareData.auto?.nota_pontualidade} valLider={compareData.lider?.nota_pontualidade} />
              <CompareRow label="Trabalho em Equipe" valAuto={compareData.auto?.nota_trabalho_equipe} valLider={compareData.lider?.nota_trabalho_equipe} />
              <CompareRow label="Proatividade" valAuto={compareData.auto?.nota_proatividade} valLider={compareData.lider?.nota_proatividade} />
              <CompareRow label="Cuidado c/ Equipamentos" valAuto={compareData.auto?.nota_cuidado_equipamentos} valLider={compareData.lider?.nota_cuidado_equipamentos} />
            </div>

            <div className="grid grid-cols-2 gap-6 mt-6">
              <div className="bg-blue-500/5 p-4 rounded-lg border border-blue-500/20">
                <h4 className="font-semibold text-blue-500 mb-2 text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Comentários da Autoavaliação
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {compareData.auto?.observacoes || "Nenhuma observação."}
                </p>
              </div>
              <div className="bg-purple-500/5 p-4 rounded-lg border border-purple-500/20">
                <h4 className="font-semibold text-purple-500 mb-2 text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Comentários do Líder (180º)
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {compareData.lider?.observacoes || "Nenhuma observação."}
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsCompareOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
