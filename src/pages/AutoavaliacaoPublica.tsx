import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Loader2, Star, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function AutoavaliacaoPublica() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [avaliacao, setAvaliacao] = useState<any>(null);
  
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [observacoes, setObservacoes] = useState("");

  const fitCulturalQuestions = [
    { id: "q1", title: "Preocupação com a empresa como um todo", desc: "Pratica senso de dono, se preocupa com a performance de outros setores, coopera com pares." },
    { id: "q2", title: "Postura voltada ao desenvolvimento da equipe", desc: "Estimula o crescimento da equipe, realiza feedbacks." },
    { id: "q3", title: "Proporciona um ambiente de trabalho saudável", desc: "Pratica um diálogo aberto, transparente e respeitador." },
    { id: "q4", title: "Proporciona um ambiente de trabalho inclusivo", desc: "Sem discriminação de qualquer natureza." },
    { id: "q5", title: "Possui atitudes/práticas voltadas à saúde, segurança e meio ambiente", desc: "Demonstra no dia a dia a preocupação com estes temas." },
    { id: "q6", title: "Utiliza de forma racional os recursos da empresa", desc: "Tem preocupação com desperdícios de qualquer natureza." },
    { id: "q7", title: "Atua com princípios éticos", desc: "Não compactua com corrupção ou uso indevido de recursos da empresa." },
    { id: "q8", title: "Atua de forma alinhada com os 3 C's da empresa", desc: "Disciplina com horário, demandas, valores e compromissos assumidos." },
    { id: "q9", title: "Desenvolvimento pessoal/profissional", desc: "Realiza cursos, seminários e especializações." },
    { id: "q10", title: "Busca do desenvolvimento do negócio de forma sustentável", desc: "Atitudes voltadas ao bem estar geral incluindo sociedade e parceiros." }
  ];

  useEffect(() => {
    carregarAvaliacao();
  }, [token]);

  const carregarAvaliacao = async () => {
    if (!token) {
      toast({ title: "Token inválido", variant: "destructive" });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('avaliacoes_desempenho')
        .select(`
          *,
          funcionarios!avaliacoes_desempenho_funcionario_id_fkey (nome, cargo)
        `)
        .eq('token_acesso', token)
        .eq('tipo', 'Autoavaliacao')
        .single();
      
      if (error || !data) {
        toast({ title: "Avaliação não encontrada ou link expirado", variant: "destructive" });
        navigate("/");
        return;
      }
      
      if (data.status === 'Concluído') {
        setSuccess(true);
        setLoading(false);
        return;
      }

      setAvaliacao(data);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao carregar", variant: "destructive" });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    // Validar se todas as notas foram preenchidas > 0
    if (fitCulturalQuestions.some(q => !notas[q.id] || notas[q.id] === 0)) {
      toast({ title: "Preencha todas as estrelas", description: "Por favor, avalie todas as competências de 1 a 5.", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      
      // Compute an average or just a fake number for the required DB columns if they are NOT NULL.
      // But usually they are nullable. 
      const avg = Math.round(Object.values(notas).reduce((a, b) => a + b, 0) / 10);
      
      const { error } = await supabase
        .from('avaliacoes_desempenho')
        .update({
          nota_tecnica: avg,
          nota_pontualidade: avg,
          nota_trabalho_equipe: avg,
          nota_proatividade: avg,
          nota_cuidado_equipamentos: avg,
          respostas_ancoras: notas as any,
          observacoes: observacoes,
          status: 'Concluído',
          atualizado_em: new Date().toISOString()
        })
        .eq('id', avaliacao.id);
        
      if (error) throw error;
      
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Erro ao enviar avaliação", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange }: { value: number, onChange: (val: number) => void }) => {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            className={`h-8 w-8 cursor-pointer transition-colors ${star <= value ? 'fill-primary text-primary' : 'text-muted-foreground opacity-30 hover:opacity-60'}`}
            onClick={() => onChange(star)}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Carregando sua autoavaliação...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
        <Card className="max-w-md w-full glass border-border/40 shadow-xl text-center p-8">
          <CheckCircle2 className="h-20 w-20 text-success mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Avaliação Concluída!</h2>
          <p className="text-muted-foreground mb-8">
            Muito obrigado pela sua sinceridade e dedicação. Suas respostas foram enviadas para o RH com sucesso.
          </p>
          <Button className="w-full" onClick={() => window.close()}>Fechar Janela</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
      <div className="max-w-2xl w-full">
        <div className="mb-8 text-center">
          <ClipboardList className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Autoavaliação de Desempenho</h1>
          <p className="text-muted-foreground mt-2">
            Olá, <strong>{avaliacao?.funcionarios?.nome}</strong>. Esta é a sua oportunidade de refletir sobre o seu trabalho.
          </p>
        </div>

        <Card className="glass border-border/40 shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/10 pb-6 border-b border-border/40">
            <CardTitle className="text-xl">Questionário de Fit Cultural</CardTitle>
            <CardDescription>
              Seja sincero. Dê uma nota de 1 (Muito abaixo) a 5 (Muito acima do esperado) para cada critério.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 md:p-8 space-y-8">
            
            <div className="space-y-4">
              {fitCulturalQuestions.map(q => (
                <div key={q.id} className="bg-background/50 p-4 rounded-xl border border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-base font-semibold">{q.title}</Label>
                    <p className="text-xs text-muted-foreground">{q.desc}</p>
                  </div>
                  <StarRating 
                    value={notas[q.id] || 0} 
                    onChange={(v) => setNotas({...notas, [q.id]: v})} 
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border/40">
              <Label className="text-lg font-semibold mb-2 block">Considerações Finais</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Quais foram suas maiores conquistas recentemente? Onde você acha que precisa melhorar? Deixe um comentário geral sobre o seu momento na empresa.
              </p>
              <Textarea 
                placeholder="Escreva aqui suas observações de forma livre..." 
                className="min-h-[120px] resize-none"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
            
            <div className="pt-4">
              <Button 
                size="lg" 
                className="w-full text-base py-6 shadow-lg"
                onClick={handleSalvar}
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Enviando...</>
                ) : (
                  "Finalizar Autoavaliação"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
