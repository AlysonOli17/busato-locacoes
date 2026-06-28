import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Grid, Plus, Pencil, Trash2, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Funcionario } from "@/pages/RecursosHumanos";
import { Textarea } from "@/components/ui/textarea";

export interface Avaliacao9Box {
  id: string;
  funcionario_id: string;
  data_avaliacao: string;
  desempenho: 'Baixo' | 'Médio' | 'Alto';
  potencial: 'Baixo' | 'Médio' | 'Alto';
  classificacao: string;
  avaliador: string | null;
  observacoes: string | null;
  funcionarios?: { nome: string };
}

interface Props {
  funcionarios: Funcionario[];
}

export function NineBoxTab({ funcionarios }: Props) {
  const { toast } = useToast();
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao9Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Avaliacao9Box>>({
    desempenho: 'Médio',
    potencial: 'Médio',
    data_avaliacao: new Date().toISOString().split('T')[0]
  });

  const fetchAvaliacoes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('avaliacoes_9box')
        .select(`
          *,
          funcionarios:funcionario_id (nome)
        `)
        .order('data_avaliacao', { ascending: false });
      
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

  const calcularClassificacao = (desempenho: string, potencial: string) => {
    if (desempenho === 'Baixo' && potencial === 'Baixo') return 'Risco de Desligamento';
    if (desempenho === 'Baixo' && potencial === 'Médio') return 'Questionável';
    if (desempenho === 'Baixo' && potencial === 'Alto') return 'Enigma';
    
    if (desempenho === 'Médio' && potencial === 'Baixo') return 'Profissional Eficaz';
    if (desempenho === 'Médio' && potencial === 'Médio') return 'Mantenedor';
    if (desempenho === 'Médio' && potencial === 'Alto') return 'Forte Desempenho';

    if (desempenho === 'Alto' && potencial === 'Baixo') return 'Especialista';
    if (desempenho === 'Alto' && potencial === 'Médio') return 'Forte Desempenho / Líder';
    if (desempenho === 'Alto' && potencial === 'Alto') return 'Alto Potencial (Talento)';
    
    return 'Indefinido';
  };

  const handleOpenSheet = (avaliacao?: Avaliacao9Box) => {
    if (avaliacao) {
      setFormData(avaliacao);
      setIsEditing(true);
    } else {
      setFormData({ 
        desempenho: 'Médio',
        potencial: 'Médio',
        data_avaliacao: new Date().toISOString().split('T')[0]
      });
      setIsEditing(false);
    }
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!formData.funcionario_id || !formData.desempenho || !formData.potencial) {
      toast({ title: "Campos obrigatórios", description: "Selecione o funcionário, desempenho e potencial.", variant: "destructive" });
      return;
    }

    const classificacao = calcularClassificacao(formData.desempenho, formData.potencial);

    try {
      if (isEditing && formData.id) {
        const { error } = await supabase
          .from('avaliacoes_9box')
          .update({
            funcionario_id: formData.funcionario_id,
            data_avaliacao: formData.data_avaliacao,
            desempenho: formData.desempenho,
            potencial: formData.potencial,
            classificacao,
            avaliador: formData.avaliador,
            observacoes: formData.observacoes,
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.id);
        
        if (error) throw error;
        toast({ title: "Avaliação atualizada com sucesso" });
      } else {
        const { error } = await supabase
          .from('avaliacoes_9box')
          .insert([{
            funcionario_id: formData.funcionario_id,
            data_avaliacao: formData.data_avaliacao,
            desempenho: formData.desempenho,
            potencial: formData.potencial,
            classificacao,
            avaliador: formData.avaliador,
            observacoes: formData.observacoes
          }]);
        
        if (error) throw error;
        toast({ title: "Avaliação cadastrada com sucesso" });
      }
      
      setIsSheetOpen(false);
      fetchAvaliacoes();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta avaliação?")) return;
    try {
      const { error } = await supabase.from('avaliacoes_9box').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Avaliação excluída" });
      fetchAvaliacoes();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="glass shadow-sm border-border/40">
      <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4">
        <div>
          <CardTitle className="text-lg">Matriz 9 Box</CardTitle>
          <CardDescription>Mapeamento de Desempenho e Potencial da equipe</CardDescription>
        </div>
        <Button onClick={() => handleOpenSheet()} className="shrink-0 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Nova Avaliação
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border/50 bg-background/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Data</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Desempenho</TableHead>
                <TableHead>Potencial</TableHead>
                <TableHead>Classificação 9 Box</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : avaliacoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma avaliação cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                avaliacoes.map((av) => (
                  <TableRow key={av.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>{format(new Date(av.data_avaliacao), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{av.funcionarios?.nome || 'Desconhecido'}</TableCell>
                    <TableCell>{av.desempenho}</TableCell>
                    <TableCell>{av.potencial}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal bg-background">
                        {av.classificacao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenSheet(av)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(av.id)}>
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

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto border-l-border/40 bg-background/95 backdrop-blur-xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <Grid className="h-5 w-5 text-primary" />
              {isEditing ? "Editar Avaliação" : "Nova Avaliação 9 Box"}
            </SheetTitle>
            <SheetDescription>
              Selecione o funcionário e avalie o desempenho e potencial atual.
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Funcionário *</Label>
              <Select 
                value={formData.funcionario_id} 
                onValueChange={(v) => setFormData({...formData, funcionario_id: v})}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funcionário..." />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.filter(f => f.status === 'Ativo').map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome} - {f.cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data da Avaliação</Label>
              <Input
                type="date"
                value={formData.data_avaliacao || ""}
                onChange={(e) => setFormData({...formData, data_avaliacao: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2 border border-border/50 p-4 rounded-lg bg-background/50">
                <Label>Desempenho *</Label>
                <Select 
                  value={formData.desempenho} 
                  onValueChange={(v: any) => setFormData({...formData, desempenho: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixo">Abaixo do Esperado</SelectItem>
                    <SelectItem value="Médio">Atinge o Esperado</SelectItem>
                    <SelectItem value="Alto">Supera o Esperado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  Avalia as entregas e metas passadas.
                </p>
              </div>

              <div className="space-y-2 border border-border/50 p-4 rounded-lg bg-background/50">
                <Label>Potencial *</Label>
                <Select 
                  value={formData.potencial} 
                  onValueChange={(v: any) => setFormData({...formData, potencial: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixo">Baixo (No limite)</SelectItem>
                    <SelectItem value="Médio">Médio (Pode crescer)</SelectItem>
                    <SelectItem value="Alto">Alto (Pronto para promoção)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  Avalia capacidade futura e aprendizado.
                </p>
              </div>
            </div>

            <div className="p-3 bg-primary/10 rounded-lg flex items-start gap-2 mt-2">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-primary">
                Classificação Prevista: {calcularClassificacao(formData.desempenho || 'Médio', formData.potencial || 'Médio')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Avaliador / Gestor</Label>
              <Input
                value={formData.avaliador || ""}
                onChange={(e) => setFormData({...formData, avaliador: e.target.value})}
                placeholder="Ex: Nome do gestor responsável"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações / Feedback</Label>
              <Textarea
                value={formData.observacoes || ""}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                placeholder="Anotações gerais sobre a avaliação..."
                rows={4}
              />
            </div>
          </div>
          
          <SheetFooter className="mt-8">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Avaliação
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
