import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Plus, Copy, Link, CheckCircle2, Loader2, RefreshCw, Trash2, Eye, Star, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Funcionario } from "@/pages/RecursosHumanos";

export const fitCulturalQuestions = [
  { id: "q1", title: "Preocupação com a empresa como um todo" },
  { id: "q2", title: "Postura voltada ao desenvolvimento da equipe" },
  { id: "q3", title: "Proporciona um ambiente de trabalho saudável" },
  { id: "q4", title: "Proporciona um ambiente de trabalho inclusivo" },
  { id: "q5", title: "Saúde, Segurança e Meio Ambiente" },
  { id: "q6", title: "Uso racional de recursos da empresa" },
  { id: "q7", title: "Atua com princípios éticos" },
  { id: "q8", title: "Alinhamento com os 3 C's da empresa" },
  { id: "q9", title: "Desenvolvimento pessoal/profissional" },
  { id: "q10", title: "Desenvolvimento sustentável do negócio" }
];

interface Props {
  funcionarios: Funcionario[];
}

export function FitCulturalTab({ funcionarios }: Props) {
  const { toast } = useToast();
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState<any>({});

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState("");

  const [isManagerDialogOpen, setIsManagerDialogOpen] = useState(false);
  const [managerForm, setManagerForm] = useState<any>({ notas: {} });

  const [isCalibracaoOpen, setIsCalibracaoOpen] = useState(false);
  const [calibracaoData, setCalibracaoData] = useState<any>({ auto: null, lider: null, notas_calibradas: {} });

  useEffect(() => {
    fetchAvaliacoes();
  }, []);

  const fetchAvaliacoes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('avaliacoes_desempenho')
        .select('*, funcionarios!avaliacoes_desempenho_funcionario_id_fkey(nome)')
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      setAvaliacoes(data || []);

      // Group by funcionario_id AND month/year to separate cycles
      const groups: any = {};
      (data || []).forEach(av => {
        const monthYear = av.criado_em.substring(0, 7);
        const cycleKey = `${av.funcionario_id}_${monthYear}`;

        if (!groups[cycleKey]) {
          groups[cycleKey] = { 
            cycleKey,
            funcionario_id: av.funcionario_id,
            monthYear,
            auto: null, 
            lider: null, 
            funcionario: av.funcionarios 
          };
        }
        if (av.tipo === 'Autoavaliacao') groups[cycleKey].auto = av;
        if (av.tipo === '180_Graus') groups[cycleKey].lider = av;
      });
      // Sort groups by monthYear descending
      const sortedGroups = Object.values(groups).sort((a: any, b: any) => b.monthYear.localeCompare(a.monthYear));
      setGrouped(sortedGroups);
    } catch (err: any) {
      toast({ title: "Erro ao carregar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!selectedFuncionarioId) return;
    try {
      setIsGenerating(true);
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const { error } = await supabase
        .from('avaliacoes_desempenho')
        .insert([{
          funcionario_id: selectedFuncionarioId,
          tipo: 'Autoavaliacao',
          token_acesso: token
        }]);
      
      if (error) throw error;
      
      toast({ title: "Link gerado com sucesso!" });
      setIsDialogOpen(false);
      fetchAvaliacoes();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (token: string) => {
    const link = `${window.location.origin}/autoavaliacao/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link Copiado!" });
  };

  const openManagerDialog = (funcionarioId: string) => {
    setManagerForm({ funcionario_id: funcionarioId, notas: {}, observacoes: "" });
    setIsManagerDialogOpen(true);
  };

  const saveManagerEvaluation = async () => {
    try {
      const avg = Math.round(Object.values(managerForm.notas).reduce((a: any, b: any) => a + b, 0) / 10);
      const { error } = await supabase
        .from('avaliacoes_desempenho')
        .insert([{
          funcionario_id: managerForm.funcionario_id,
          tipo: '180_Graus',
          status: 'Concluído',
          nota_tecnica: avg,
          nota_pontualidade: avg,
          nota_trabalho_equipe: avg,
          nota_proatividade: avg,
          nota_cuidado_equipamentos: avg,
          respostas_ancoras: managerForm.notas,
          observacoes: managerForm.observacoes
        }]);
      
      if (error) throw error;
      toast({ title: "Avaliação do gestor salva!" });
      setIsManagerDialogOpen(false);
      fetchAvaliacoes();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const openCalibracao = (cycleKey: string) => {
    const data = (grouped as any[]).find(g => g.cycleKey === cycleKey);
    if (!data) return;
    setCalibracaoData({
      cycleKey,
      funcionario_id: data.funcionario_id,
      auto: data.auto,
      lider: data.lider,
      notas_calibradas: data.lider?.respostas_ancoras?.calibracao || {},
      validado: data.lider?.respostas_ancoras?.validado || false
    });
    setIsCalibracaoOpen(true);
  };

  const saveCalibracao = async (validar: boolean) => {
    try {
      const payload = {
        ...calibracaoData.lider.respostas_ancoras,
        calibracao: calibracaoData.notas_calibradas,
        validado: validar
      };

      const { error } = await supabase
        .from('avaliacoes_desempenho')
        .update({ respostas_ancoras: payload })
        .eq('id', calibracaoData.lider.id);

      if (error) throw error;
      toast({ title: validar ? "Workflow Validado!" : "Calibração salva!" });
      setIsCalibracaoOpen(false);
      fetchAvaliacoes();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (autoId: string | null, liderId: string | null) => {
    if (!confirm("Tem certeza que deseja excluir este ciclo de avaliação? O funcionário precisará refazer o processo.")) return;
    try {
      if (autoId) {
        const { error } = await supabase.from('avaliacoes_desempenho').delete().eq('id', autoId);
        if (error) throw error;
      }
      if (liderId) {
        const { error } = await supabase.from('avaliacoes_desempenho').delete().eq('id', liderId);
        if (error) throw error;
      }
      toast({ title: "Avaliação excluída com sucesso!" });
      fetchAvaliacoes();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const StarRating = ({ value, onChange }: { value: number, onChange: (val: number) => void }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            className={`h-5 w-5 cursor-pointer transition-colors ${star <= value ? 'fill-primary text-primary' : 'text-muted-foreground opacity-30 hover:opacity-60'}`}
            onClick={() => onChange(star)}
          />
        ))}
      </div>
    );
  };

  const getWorkflowStatus = (data: any) => {
    if (data.lider?.respostas_ancoras?.validado) return <Badge variant="success">Validado</Badge>;
    if (data.lider?.respostas_ancoras?.calibracao) return <Badge variant="default" className="bg-purple-500">Calibrado</Badge>;
    if (data.lider) return <Badge variant="secondary">Avaliado (Gestor)</Badge>;
    if (data.auto?.status === 'Concluído') return <Badge variant="outline">Autoavaliação Concluída</Badge>;
    if (data.auto) return <Badge variant="secondary" className="opacity-50">Aguardando Funcionário</Badge>;
    return <Badge variant="outline" className="opacity-30">Não Iniciado</Badge>;
  };

  return (
    <Card className="glass shadow-sm border-border/40">
      <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4">
        <div>
          <CardTitle className="text-lg">Workflow de Fit Cultural (4 Etapas)</CardTitle>
          <CardDescription>Autoavaliação, Gestor, Calibração e Validação</CardDescription>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Iniciar Novo Ciclo
        </Button>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>1. Autoavaliação</TableHead>
              <TableHead>2. Gestor</TableHead>
              <TableHead>Status Geral</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(grouped as any[]).map(g => {
              return (
                <TableRow key={g.cycleKey}>
                  <TableCell className="font-medium">
                    {g.funcionario?.nome} 
                    <Badge variant="secondary" className="ml-2 text-xs opacity-70">{g.monthYear}</Badge>
                  </TableCell>
                  <TableCell>
                    {g.auto ? (
                      g.auto.status === 'Concluído' ? <CheckCircle2 className="h-5 w-5 text-success" /> : 
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(g.auto.token_acesso)}>Copiar Link</Button>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {g.lider ? <CheckCircle2 className="h-5 w-5 text-success" /> : 
                     (g.auto?.status === 'Concluído' ? <Button variant="secondary" size="sm" onClick={() => openManagerDialog(g.funcionario_id)}>Avaliar</Button> : '-')}
                  </TableCell>
                  <TableCell>{getWorkflowStatus(g)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {g.auto?.status === 'Concluído' && g.lider && (
                        <Button variant="outline" size="sm" onClick={() => openCalibracao(g.cycleKey)}>
                          <Scale className="h-4 w-4 mr-2" /> 3. Calibrar
                        </Button>
                      )}
                      {(g.auto || g.lider) && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                          onClick={() => handleDelete(g.auto?.id || null, g.lider?.id || null)}
                          title="Excluir Avaliação"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      {/* Modal Iniciar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Avaliação de Fit Cultural</DialogTitle>
          </DialogHeader>
          <Select value={selectedFuncionarioId} onValueChange={setSelectedFuncionarioId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {funcionarios.filter(f => f.status === 'Ativo').map(f => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={handleGenerateLink}>Gerar Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Gestor */}
      <Dialog open={isManagerDialogOpen} onOpenChange={setIsManagerDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Etapa 2: Avaliação do Gestor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {fitCulturalQuestions.map(q => (
              <div key={q.id} className="flex justify-between items-center border-b pb-2">
                <Label>{q.title}</Label>
                <StarRating value={managerForm.notas[q.id] || 0} onChange={(v) => setManagerForm({...managerForm, notas: {...managerForm.notas, [q.id]: v}})} />
              </div>
            ))}
            <Textarea placeholder="Observações..." value={managerForm.observacoes} onChange={(e) => setManagerForm({...managerForm, observacoes: e.target.value})} />
          </div>
          <DialogFooter>
            <Button onClick={saveManagerEvaluation}>Salvar Avaliação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Calibração */}
      <Dialog open={isCalibracaoOpen} onOpenChange={setIsCalibracaoOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Etapas 3 e 4: Calibração e Validação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-12 gap-2 font-bold mb-2">
              <div className="col-span-6">Critério</div>
              <div className="col-span-2 text-blue-500">Auto</div>
              <div className="col-span-2 text-purple-500">Gestor</div>
              <div className="col-span-2 text-green-600">Calibrado</div>
            </div>
            {fitCulturalQuestions.map(q => (
              <div key={q.id} className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                <div className="col-span-6 text-sm">{q.title}</div>
                <div className="col-span-2 font-mono text-blue-500">{calibracaoData.auto?.respostas_ancoras?.[q.id] || '-'}</div>
                <div className="col-span-2 font-mono text-purple-500">{calibracaoData.lider?.respostas_ancoras?.[q.id] || '-'}</div>
                <div className="col-span-2">
                  <Select 
                    value={String(calibracaoData.notas_calibradas[q.id] || '')} 
                    onValueChange={(v) => setCalibracaoData({...calibracaoData, notas_calibradas: {...calibracaoData.notas_calibradas, [q.id]: Number(v)}})}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="Nota" /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex justify-between w-full">
            <Button variant="outline" onClick={() => saveCalibracao(false)}>Salvar Calibração Parcial</Button>
            <Button onClick={() => saveCalibracao(true)} className="bg-green-600 hover:bg-green-700">4. Validar e Finalizar Workflow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
