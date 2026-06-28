import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
  },
  // 6 perguntas (Rápido) - Base
  
  // Intermediário (+6 perguntas = 12 total)
  {
    id: 7,
    pergunta: "Ao tomar uma decisão importante, você se baseia mais em:",
    opcoes: [
      { id: "D", texto: "Na minha intuição e experiência para resolver logo." },
      { id: "I", texto: "No que os outros vão pensar e como isso afeta a equipe." },
      { id: "S", texto: "Em manter a harmonia e o que já está funcionando." },
      { id: "C", texto: "Em fatos, números e análises detalhadas." }
    ]
  },
  {
    id: 8,
    pergunta: "Quando você precisa delegar uma tarefa, como você faz?",
    opcoes: [
      { id: "D", texto: "Delego rápido focando apenas no prazo final." },
      { id: "I", texto: "Explico conversando bastante para motivar a pessoa." },
      { id: "S", texto: "Mostro passo a passo com calma para a pessoa aprender." },
      { id: "C", texto: "Passo um manual detalhado com os padrões de qualidade." }
    ]
  },
  {
    id: 9,
    pergunta: "No seu tempo livre, o que você mais gosta de fazer?",
    opcoes: [
      { id: "D", texto: "Praticar esportes competitivos ou realizar conquistas pessoais." },
      { id: "I", texto: "Sair com amigos, ir a festas ou eventos sociais." },
      { id: "S", texto: "Ficar em casa, ler um livro ou assistir algo em família." },
      { id: "C", texto: "Aprender algo novo, ler manuais ou focar em um hobby técnico." }
    ]
  },
  {
    id: 10,
    pergunta: "Como você lida com as regras de um projeto?",
    opcoes: [
      { id: "D", texto: "As regras podem ser quebradas se os resultados forem melhores." },
      { id: "I", texto: "As regras são guias, mas prefiro flexibilidade." },
      { id: "S", texto: "Sigo as regras para manter a estabilidade do grupo." },
      { id: "C", texto: "As regras existem para serem seguidas à risca." }
    ]
  },
  {
    id: 11,
    pergunta: "Quando o projeto dá errado, qual é sua primeira reação?",
    opcoes: [
      { id: "D", texto: "Assumir o controle e tentar resolver sozinho na hora." },
      { id: "I", texto: "Reunir a equipe para um brainstorm animado." },
      { id: "S", texto: "Ficar preocupado, mas seguir orientações dos líderes." },
      { id: "C", texto: "Investigar a causa raiz do problema e achar o culpado." }
    ]
  },
  {
    id: 12,
    pergunta: "Qual palavra melhor te define?",
    opcoes: [
      { id: "D", texto: "Ousado." },
      { id: "I", texto: "Entusiasmado." },
      { id: "S", texto: "Compreensivo." },
      { id: "C", texto: "Meticuloso." }
    ]
  },
  
  // Completo (+12 perguntas = 24 total)
  {
    id: 13,
    pergunta: "Como você gosta de ser reconhecido?",
    opcoes: [
      { id: "D", texto: "Pelos resultados que alcancei e metas que bati." },
      { id: "I", texto: "Elogios em público e aplausos da equipe." },
      { id: "S", texto: "Com um agradecimento sincero e valorização pessoal." },
      { id: "C", texto: "Pela excelência e ausência de erros no meu trabalho." }
    ]
  },
  {
    id: 14,
    pergunta: "Ao receber uma crítica, como você geralmente reage?",
    opcoes: [
      { id: "D", texto: "Posso me defender se achar que a pessoa está errada." },
      { id: "I", texto: "Levo para o lado pessoal, mas tento disfarçar com humor." },
      { id: "S", texto: "Fico magoado e demoro um pouco para processar." },
      { id: "C", texto: "Analiso se a crítica tem embasamento lógico e fatos." }
    ]
  },
  {
    id: 15,
    pergunta: "Em reuniões longas, qual é sua postura?",
    opcoes: [
      { id: "D", texto: "Fico impaciente e quero ir direto ao ponto." },
      { id: "I", texto: "Falo bastante, dou ideias e brinco com o pessoal." },
      { id: "S", texto: "Escuto com atenção e só falo se for solicitado." },
      { id: "C", texto: "Anoto tudo e questiono os dados apresentados." }
    ]
  },
  {
    id: 16,
    pergunta: "Qual seu estilo de planejamento?",
    opcoes: [
      { id: "D", texto: "Planejo o mínimo necessário e ajusto no caminho." },
      { id: "I", texto: "Planejo junto com a equipe conversando sobre as ideias." },
      { id: "S", texto: "Gosto de planejar de forma estruturada e consistente." },
      { id: "C", texto: "Faço planos detalhados cobrindo todos os cenários possíveis." }
    ]
  },
  {
    id: 17,
    pergunta: "Quando precisa aprender algo novo, você prefere:",
    opcoes: [
      { id: "D", texto: "Aprender na prática, testando e errando." },
      { id: "I", texto: "Aprender com outra pessoa me explicando de forma dinâmica." },
      { id: "S", texto: "Aprender com paciência, passo a passo." },
      { id: "C", texto: "Ler todo o material teórico antes de tentar na prática." }
    ]
  },
  {
    id: 18,
    pergunta: "O que você mais preza num líder?",
    opcoes: [
      { id: "D", texto: "Visão, pulso firme e foco em resultado." },
      { id: "I", texto: "Carisma, inspiração e boa comunicação." },
      { id: "S", texto: "Empatia, apoio e paciência." },
      { id: "C", texto: "Conhecimento técnico, justiça e clareza nas regras." }
    ]
  },
  {
    id: 19,
    pergunta: "Como você organiza seu local de trabalho?",
    opcoes: [
      { id: "D", texto: "Funcional. O que importa é ter o que preciso à mão." },
      { id: "I", texto: "Com fotos, lembranças e coisas coloridas." },
      { id: "S", texto: "Organizado de forma a não mudar muito o layout." },
      { id: "C", texto: "Extremamente limpo, organizado e categorizado." }
    ]
  },
  {
    id: 20,
    pergunta: "Qual é o seu ritmo natural de trabalho?",
    opcoes: [
      { id: "D", texto: "Acelerado e focado no próximo objetivo." },
      { id: "I", texto: "Dinâmico, mas varia muito dependendo do ambiente." },
      { id: "S", texto: "Constante, em um ritmo seguro e sem pressa." },
      { id: "C", texto: "Cuidadoso, no tempo necessário para não ter erros." }
    ]
  },
  {
    id: 21,
    pergunta: "Como você convence os outros?",
    opcoes: [
      { id: "D", texto: "Pela força e assertividade dos meus argumentos." },
      { id: "I", texto: "Pela empolgação, charme e entusiasmo." },
      { id: "S", texto: "Mostrando como isso ajudará o grupo todo." },
      { id: "C", texto: "Através da lógica, fatos e estatísticas." }
    ]
  },
  {
    id: 22,
    pergunta: "Qual é o seu maior medo profissional?",
    opcoes: [
      { id: "D", texto: "Perder o controle ou falhar." },
      { id: "I", texto: "Não ser notado, rejeição social." },
      { id: "S", texto: "Perder a segurança ou passar por mudanças bruscas." },
      { id: "C", texto: "Errar o trabalho ou não ter os dados corretos." }
    ]
  },
  {
    id: 23,
    pergunta: "Na hora do conflito, você busca:",
    opcoes: [
      { id: "D", texto: "Ganhar a discussão a qualquer custo." },
      { id: "I", texto: "Aliviar a tensão e voltar a ser amigo." },
      { id: "S", texto: "Ceder um pouco para acalmar a situação." },
      { id: "C", texto: "Achar o ponto onde a lógica falhou." }
    ]
  },
  {
    id: 24,
    pergunta: "Você costuma tomar decisões com base em:",
    opcoes: [
      { id: "D", texto: "O que vai trazer resultado mais rápido." },
      { id: "I", texto: "No que parece ser mais inovador e divertido." },
      { id: "S", texto: "No que é mais seguro para todos os envolvidos." },
      { id: "C", texto: "No que é correto e tem base sólida de dados." }
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
  const [success, setSuccess] = useState(false);
  
  const [step, setStep] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  
  // PDA States
  const [isPdaStage, setIsPdaStage] = useState(false);
  const [nivelEnergia, setNivelEnergia] = useState([50]);
  const [autocontrole, setAutocontrole] = useState([50]);
  
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

  const getListaPerguntas = () => {
    if (!teste || !teste.tipo_teste) return PERGUNTAS_DISC.slice(0, 6);
    
    if (teste.tipo_teste === 'Rápido') return PERGUNTAS_DISC.slice(0, 6);
    if (teste.tipo_teste === 'Intermediário') return PERGUNTAS_DISC.slice(0, 12);
    return PERGUNTAS_DISC;
  };

  const perguntasAtivas = getListaPerguntas();

  const handleOpcaoClick = (perguntaId: number, opcaoId: string) => {
    setRespostas({ ...respostas, [perguntaId]: opcaoId });
  };

  const handleNext = () => {
    if (!respostas[perguntasAtivas[step].id]) {
      toast({ title: "Atenção", description: "Selecione uma resposta para continuar." });
      return;
    }
    
    if (step < perguntasAtivas.length - 1) {
      setStep(step + 1);
    } else {
      setIsPdaStage(true);
    }
  };

  const finalizarTeste = async () => {
    try {
      setSubmitting(true);
      
      let counts = { D: 0, I: 0, S: 0, C: 0 };
      Object.values(respostas).forEach(val => {
        if (counts[val as keyof typeof counts] !== undefined) {
          counts[val as keyof typeof counts]++;
        }
      });
      
      let perfilPredominante = "D";
      let maxCount = -1;
      Object.entries(counts).forEach(([key, val]) => {
        if (val > maxCount) {
          maxCount = val;
          perfilPredominante = key;
        }
      });
      
      const nomes = {
        D: "Executor (D)",
        I: "Comunicador (I)",
        S: "Planejador (S)",
        C: "Analista (C)"
      };

      const { error } = await supabase
        .from('testes_comportamentais')
        .update({
          resultado_d: counts.D,
          resultado_i: counts.I,
          resultado_s: counts.S,
          resultado_c: counts.C,
          perfil_predominante: nomes[perfilPredominante as keyof typeof nomes],
          nivel_energia: nivelEnergia[0],
          autocontrole: autocontrole[0],
          status: 'Concluído',
          data_envio: new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        })
        .eq('id', teste.id);

      if (error) throw error;
      
      setSuccess(true);
      toast({ title: "Teste Finalizado com Sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao finalizar", description: err.message, variant: "destructive" });
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

  if (teste.status === 'Concluído' || success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full glass border-border/40 text-center py-12 px-6">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">Teste Concluído!</h2>
          <p className="text-muted-foreground mb-6">
            Obrigado, <strong>{teste.funcionarios?.nome}</strong>. 
            Suas respostas foram enviadas para o RH com sucesso.
          </p>
        </Card>
      </div>
    );
  }

  const perguntaAtual = perguntasAtivas[step];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
      <div className="max-w-xl w-full">
        <div className="mb-8 text-center">
          <Brain className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Teste de Perfil Comportamental</h1>
          <p className="text-muted-foreground mt-2">
            Responda o mais sinceramente possível. Não existe resposta certa ou errada.
            <br/><span className="text-sm opacity-70">Teste: {teste.tipo_teste} ({perguntasAtivas.length} perguntas)</span>
          </p>
        </div>

        <Card className="glass border-border/40 shadow-xl overflow-hidden">
          <div className="h-1 w-full bg-muted">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: isPdaStage ? '100%' : `${((step + 1) / perguntasAtivas.length) * 100}%` }}
            />
          </div>
          
          {isPdaStage ? (
            <>
              <CardHeader className="bg-muted/10 pb-6 border-b border-border/40">
                <CardDescription className="text-sm font-medium mb-2 text-primary">
                  Etapa Final
                </CardDescription>
                <CardTitle className="text-xl leading-relaxed">
                  Avaliação Dinâmica de Estado (PDA)
                </CardTitle>
                <p className="text-muted-foreground text-sm mt-2">
                  Use as barras deslizantes para indicar como você se encontra <strong>neste momento da sua vida/trabalho</strong>.
                </p>
              </CardHeader>
              <CardContent className="p-6 md:p-8">
                <div className="space-y-12">
                  <div className="space-y-6 bg-background/50 p-6 rounded-xl border border-border/40">
                    <div className="space-y-2">
                      <Label className="text-lg font-bold">1. Nível de Energia e Vitalidade</Label>
                      <p className="text-sm text-muted-foreground">Como está a sua "bateria" física e mental para lidar com as demandas diárias hoje?</p>
                    </div>
                    <Slider value={nivelEnergia} onValueChange={setNivelEnergia} max={100} step={1} className="py-4" />
                    <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                      <span className={nivelEnergia[0] < 30 ? "text-destructive" : ""}>Esgotado</span>
                      <span>Normal</span>
                      <span className={nivelEnergia[0] >= 70 ? "text-success" : ""}>Muito Energizado</span>
                    </div>
                  </div>
                  <div className="space-y-6 bg-background/50 p-6 rounded-xl border border-border/40">
                    <div className="space-y-2">
                      <Label className="text-lg font-bold">2. Autocontrole Emocional</Label>
                      <p className="text-sm text-muted-foreground">Sob forte pressão, como você tem reagido?</p>
                    </div>
                    <Slider value={autocontrole} onValueChange={setAutocontrole} max={100} step={1} className="py-4" />
                    <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                      <span className={autocontrole[0] < 30 ? "text-destructive" : ""}>Impulsivo</span>
                      <span>Racionalizo</span>
                      <span className={autocontrole[0] >= 70 ? "text-success" : ""}>Controle Absoluto</span>
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <Button size="lg" className="w-full md:w-auto px-8 shadow-md" onClick={finalizarTeste} disabled={submitting}>
                    {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finalizando...</> : "Concluir Avaliação Completa"}
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="bg-muted/10 pb-6 border-b border-border/40">
                <CardDescription className="text-sm font-medium mb-2">
                  Pergunta {step + 1} de {perguntasAtivas.length}
                </CardDescription>
                <CardTitle className="text-xl leading-relaxed">
                  {perguntaAtual.pergunta}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8">
                <div className="space-y-3">
                  {perguntaAtual.opcoes.map((opcao: any) => (
                    <div
                      key={opcao.id}
                      onClick={() => handleOpcaoClick(perguntaAtual.id, opcao.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center gap-3 ${respostas[perguntaAtual.id] === opcao.id ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/60 hover:border-primary/50 hover:bg-muted/30 bg-background'}`}
                    >
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${respostas[perguntaAtual.id] === opcao.id ? 'border-primary' : 'border-muted-foreground/50'}`}>
                        {respostas[perguntaAtual.id] === opcao.id && <div className="h-2.5 w-2.5 bg-primary rounded-full" />}
                      </div>
                      <span className={`text-base ${respostas[perguntaAtual.id] === opcao.id ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{opcao.texto}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex justify-end">
                  <Button size="lg" className="w-full md:w-auto px-8 shadow-md" onClick={handleNext}>
                    {step === perguntasAtivas.length - 1 ? "Ir para Etapa Final" : "Próxima Pergunta"}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
