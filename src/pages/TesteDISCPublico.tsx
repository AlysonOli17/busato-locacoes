import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Brain, CheckCircle2 } from "lucide-react";

// Perfil DISC:
// D = Dominância (Executor)
// I = Influência (Comunicador)
// S = Estabilidade (Planejador)
// C = Conformidade (Analista)

const PERGUNTAS_DISC = [
  {
    id: 1,
    pergunta: "Em um ambiente de trabalho novo, como você costuma agir?",
    opcoes: [
      { id: "D", texto: "Tomo a frente das decisões rapidamente." },
      { id: "I", texto: "Tento me enturmar e conhecer todos rapidamente." },
      { id: "S", texto: "Observo o ambiente e sigo o ritmo da equipe." },
      { id: "C", texto: "Procuro entender as regras e processos primeiro." }
    ]
  },
  {
    id: 2,
    pergunta: "Ao receber um projeto desafiador, o que você valoriza mais?",
    opcoes: [
      { id: "D", texto: "Alcançar os resultados no menor tempo possível." },
      { id: "I", texto: "Trabalhar com a equipe e manter o clima animado." },
      { id: "S", texto: "Ter clareza do passo a passo para não ter surpresas." },
      { id: "C", texto: "Ter dados precisos e fazer tudo com perfeição." }
    ]
  },
  {
    id: 3,
    pergunta: "Como você reage quando alguém discorda de você?",
    opcoes: [
      { id: "D", texto: "Bato de frente se tiver certeza que estou certo." },
      { id: "I", texto: "Tento convencer a pessoa através da conversa." },
      { id: "S", texto: "Evito o conflito direto e tento chegar num consenso." },
      { id: "C", texto: "Apresento fatos e números para provar meu ponto." }
    ]
  },
  {
    id: 4,
    pergunta: "Qual é o seu maior ponto forte?",
    opcoes: [
      { id: "D", texto: "Determinação e foco no resultado." },
      { id: "I", texto: "Comunicação e facilidade com pessoas." },
      { id: "S", texto: "Paciência, empatia e organização." },
      { id: "C", texto: "Atenção aos detalhes e qualidade." }
    ]
  },
  {
    id: 5,
    pergunta: "O que mais te desmotiva no trabalho?",
    opcoes: [
      { id: "D", texto: "Lentidão e falta de autonomia." },
      { id: "I", texto: "Rotina rígida e isolamento social." },
      { id: "S", texto: "Mudanças bruscas e ambiente instável." },
      { id: "C", texto: "Falta de clareza e trabalho mal feito." }
    ]
  },
  {
    id: 6,
    pergunta: "Sob pressão, você tende a...",
    opcoes: [
      { id: "D", texto: "Agir por impulso e focar na solução rápida." },
      { id: "I", texto: "Falar bastante e tentar aliviar a tensão." },
      { id: "S", texto: "Esperar orientações claras para não errar." },
      { id: "C", texto: "Se isolar para analisar os dados com calma." }
    ]
  }
];

export default function TesteDISCPublico() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [teste, setTeste] = useState<any>(null);
  
  const [step, setStep] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  
  useEffect(() => {
    const carregarTeste = async () => {
      if (!token) return;
      
      try {
        const { data, error } = await supabase
          .from('testes_comportamentais')
          .select(`*, funcionarios(nome)`)
          .eq('token_acesso', token)
          .single();
          
        if (error) throw error;
        setTeste(data);
      } catch (err) {
        console.error(err);
        toast({ title: "Teste não encontrado", description: "O link pode estar inválido.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    
    carregarTeste();
  }, [token]);

  const handleNext = () => {
    if (!respostas[PERGUNTAS_DISC[step].id]) {
      toast({ title: "Atenção", description: "Selecione uma resposta para continuar." });
      return;
    }
    
    if (step < PERGUNTAS_DISC.length - 1) {
      setStep(step + 1);
    } else {
      finalizarTeste();
    }
  };

  const calcularResultado = () => {
    const contagem = { D: 0, I: 0, S: 0, C: 0 };
    Object.values(respostas).forEach(valor => {
      contagem[valor as keyof typeof contagem]++;
    });

    let perfilPredominante = "Equilibrado";
    let maior = -1;
    
    if (contagem.D > maior) { maior = contagem.D; perfilPredominante = "Executor (D)"; }
    if (contagem.I > maior) { maior = contagem.I; perfilPredominante = "Comunicador (I)"; }
    if (contagem.S > maior) { maior = contagem.S; perfilPredominante = "Planejador (S)"; }
    if (contagem.C > maior) { maior = contagem.C; perfilPredominante = "Analista (C)"; }

    return { contagem, perfilPredominante };
  };

  const finalizarTeste = async () => {
    try {
      setSubmitting(true);
      const { contagem, perfilPredominante } = calcularResultado();

      const { error } = await supabase
        .from('testes_comportamentais')
        .update({
          status: 'Concluído',
          data_envio: new Date().toISOString(),
          resultado_d: contagem.D,
          resultado_i: contagem.I,
          resultado_s: contagem.S,
          resultado_c: contagem.C,
          perfil_predominante: perfilPredominante,
          respostas: respostas,
          atualizado_em: new Date().toISOString()
        })
        .eq('token_acesso', token);

      if (error) throw error;
      
      setTeste({ ...teste, status: 'Concluído', perfil_predominante: perfilPredominante });
      toast({ title: "Teste Finalizado com Sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Carregando teste...</p>
      </div>
    );
  }

  if (!teste) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full glass border-border/40 text-center py-12">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold">Teste não encontrado</h2>
          <p className="text-muted-foreground mt-2">O link informado é inválido ou não existe.</p>
        </Card>
      </div>
    );
  }

  if (teste.status === 'Concluído') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full glass border-border/40 text-center py-12 px-6">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">Teste Concluído!</h2>
          <p className="text-muted-foreground mb-6">
            Obrigado, <strong>{teste.funcionarios?.nome}</strong>. 
            Suas respostas foram enviadas para o RH da Busato com sucesso.
          </p>
          <div className="p-4 bg-primary/10 rounded-lg inline-block border border-primary/20">
            <p className="text-sm text-primary font-medium">Seu Perfil Predominante:</p>
            <p className="text-xl font-bold text-primary mt-1">{teste.perfil_predominante}</p>
          </div>
        </Card>
      </div>
    );
  }

  const perguntaAtual = PERGUNTAS_DISC[step];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
      <div className="max-w-xl w-full">
        <div className="mb-8 text-center">
          <Brain className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Teste de Perfil Comportamental</h1>
          <p className="text-muted-foreground mt-2">
            Responda o mais sinceramente possível. Não existe resposta certa ou errada.
          </p>
        </div>

        <Card className="glass border-border/40 shadow-xl overflow-hidden">
          <div className="h-1 w-full bg-muted">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((step + 1) / PERGUNTAS_DISC.length) * 100}%` }}
            />
          </div>
          
          <CardHeader className="bg-muted/10 pb-6 border-b border-border/40">
            <CardDescription className="text-sm font-medium mb-2">
              Pergunta {step + 1} de {PERGUNTAS_DISC.length}
            </CardDescription>
            <CardTitle className="text-xl leading-relaxed">
              {perguntaAtual.pergunta}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="pt-6">
            <RadioGroup
              value={respostas[perguntaAtual.id]}
              onValueChange={(v) => setRespostas({ ...respostas, [perguntaAtual.id]: v })}
              className="space-y-3"
            >
              {perguntaAtual.opcoes.map((opcao, idx) => (
                <Label 
                  key={idx}
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer hover:bg-muted/50 ${
                    respostas[perguntaAtual.id] === opcao.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border/50'
                  }`}
                >
                  <RadioGroupItem value={opcao.id} />
                  <span className="text-base font-normal leading-tight">{opcao.texto}</span>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>

          <div className="p-6 bg-muted/10 border-t border-border/40 flex justify-end">
            <Button 
              onClick={handleNext} 
              size="lg" 
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finalizando...</>
              ) : step === PERGUNTAS_DISC.length - 1 ? (
                "Finalizar Teste"
              ) : (
                "Próxima Pergunta"
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
