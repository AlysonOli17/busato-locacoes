import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, AlertTriangle, CheckCircle2, UserPlus, Loader2 } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { Funcionario } from "@/pages/RecursosHumanos";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface Props {
  funcionarios: Funcionario[];
}

export function ExperienciaTab({ funcionarios }: Props) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFunc, setSelectedFunc] = useState<Funcionario | null>(null);
  
  const [formData, setFormData] = useState({
    adaptacao_cultura: "3",
    velocidade_aprendizado: "3",
    decisao: "",
    observacoes: ""
  });

  const getStatusExperiencia = (dataAdmissao: string | null) => {
    if (!dataAdmissao) return null;
    
    // Se a data de admissão vier apenas com 'YYYY-MM-DD' e sem timezone, vamos garantir a leitura certa
    const dataAdm = new Date(dataAdmissao);
    const dias = differenceInDays(new Date(), dataAdm);
    
    if (dias > 90) return { dias, status: 'Efetivado', cor: 'bg-muted text-muted-foreground' };
    
    if (dias >= 0 && dias <= 45) {
      if (45 - dias <= 5) return { dias, status: 'Alerta 45 Dias (Vencendo)', cor: 'bg-yellow-500/20 text-yellow-600 border-yellow-500' };
      return { dias, status: '1º Período (Até 45)', cor: 'bg-blue-500/10 text-blue-600 border-blue-500' };
    }
    
    if (dias > 45 && dias <= 90) {
      if (90 - dias <= 5) return { dias, status: 'Alerta 90 Dias (Vencendo)', cor: 'bg-red-500/20 text-red-600 border-red-500 font-bold' };
      return { dias, status: '2º Período (Até 90)', cor: 'bg-purple-500/10 text-purple-600 border-purple-500' };
    }
    
    return null;
  };

  const funcionariosEmExperiencia = funcionarios
    .filter(f => f.status === 'Ativo' && f.data_admissao)
    .map(f => {
      const exp = getStatusExperiencia(f.data_admissao);
      return { ...f, exp };
    })
    .filter(f => f.exp && f.exp.dias <= 90)
    .sort((a, b) => (b.exp?.dias || 0) - (a.exp?.dias || 0));

  const handleAvaliarExperiencia = (funcionario: Funcionario) => {
    setSelectedFunc(funcionario);
    setFormData({ adaptacao_cultura: "3", velocidade_aprendizado: "3", decisao: "", observacoes: "" });
    setIsDialogOpen(true);
  };

  const handleSalvar = async () => {
    if (!formData.decisao) {
      toast({ title: "Decisão Obrigatória", description: "Por favor, indique se o colaborador deve ser aprovado, estendido ou desligado.", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      
      const { error } = await supabase
        .from('avaliacoes_desempenho')
        .insert([{
          funcionario_id: selectedFunc?.id,
          tipo: '180_Graus', // Usando o tipo lider para avaliacao de exp
          status: 'Concluído',
          observacoes: `[AVALIAÇÃO DE EXPERIÊNCIA - ${selectedFunc?.exp?.dias} dias]\nDecisão: ${formData.decisao}\n\nObservações: ${formData.observacoes}`,
          respostas_ancoras: {
            adaptacao_cultura: formData.adaptacao_cultura,
            velocidade_aprendizado: formData.velocidade_aprendizado,
            fase_experiencia: selectedFunc?.exp?.dias
          }
        }]);
        
      if (error) throw error;
      
      toast({ title: "Avaliação registrada com sucesso!" });
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-background/50 p-4 rounded-lg border border-border/40">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Período de Experiência (45/90 Dias)
          </h2>
          <p className="text-muted-foreground text-sm">Monitore prazos críticos de retenção e faça as avaliações no tempo certo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Total em Experiência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{funcionariosEmExperiencia.length}</div>
          </CardContent>
        </Card>
        <Card className="glass border-border/40 border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Vencendo 45 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {funcionariosEmExperiencia.filter(f => f.exp && f.exp.dias > 39 && f.exp.dias <= 45).length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/40 border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Vencendo 90 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {funcionariosEmExperiencia.filter(f => f.exp && f.exp.dias > 84 && f.exp.dias <= 90).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass shadow-sm border-border/40">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Colaborador</TableHead>
                <TableHead>Admissão</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Status Experiência</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funcionariosEmExperiencia.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    Nenhum colaborador no período de experiência (até 90 dias).
                  </TableCell>
                </TableRow>
              ) : (
                funcionariosEmExperiencia.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      {f.nome}
                      <div className="text-xs text-muted-foreground">{f.cargo}</div>
                    </TableCell>
                    <TableCell>
                      {f.data_admissao ? format(new Date(f.data_admissao), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{f.exp?.dias} dias</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border ${f.exp?.cor}`}>
                        {f.exp?.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleAvaliarExperiencia(f)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Avaliar Retenção
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Avaliação de Período de Experiência</DialogTitle>
            <DialogDescription>
              {selectedFunc?.nome} está há {selectedFunc?.exp?.dias} dias na empresa.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Adaptação à Cultura e Regras da Empresa</Label>
              <Select value={formData.adaptacao_cultura} onValueChange={(v) => setFormData({...formData, adaptacao_cultura: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Ruim (Resistente às normas)</SelectItem>
                  <SelectItem value="3">Regular (Adaptando-se aos poucos)</SelectItem>
                  <SelectItem value="5">Excelente (Total aderência à cultura)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Velocidade de Aprendizado Operacional</Label>
              <Select value={formData.velocidade_aprendizado} onValueChange={(v) => setFormData({...formData, velocidade_aprendizado: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Abaixo do esperado (Dificuldade de pegar as rotinas)</SelectItem>
                  <SelectItem value="3">Dentro do esperado (Aprendizado normal)</SelectItem>
                  <SelectItem value="5">Acima do esperado (Já domina a função rapidamente)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-primary font-bold">Decisão do Gestor *</Label>
              <Select value={formData.decisao} onValueChange={(v) => setFormData({...formData, decisao: v})}>
                <SelectTrigger><SelectValue placeholder="Qual será o parecer?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aprovar/Efetivar">Aprovar / Efetivar</SelectItem>
                  <SelectItem value="Estender (Atenção)">Estender Período de Experiência (Atenção)</SelectItem>
                  <SelectItem value="Desligar (Reprovado)">Desligar (Reprovado na Experiência)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Justificativa / Observações Finais</Label>
              <Textarea 
                placeholder="Detalhe o motivo da decisão..." 
                value={formData.observacoes}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Registrar Decisão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
