import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Brain, TrendingUp, Target, AlertTriangle, Lightbulb, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export default function DossieAnalitico() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [funcionario, setFuncionario] = useState<any>(null);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [testes, setTestes] = useState<any[]>([]);
  const [pdis, setPdis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) carregarDossie();
  }, [id]);

  const carregarDossie = async () => {
    try {
      setLoading(true);
      
      // 1. Funcionario
      const { data: func, error: err1 } = await supabase
        .from('funcionarios')
        .select('*')
        .eq('id', id)
        .single();
      if (err1) throw err1;
      setFuncionario(func);

      // 2. Avaliações (Evolução)
      const { data: aval, error: err2 } = await supabase
        .from('avaliacoes_desempenho')
        .select('*')
        .eq('funcionario_id', id)
        .eq('status', 'Concluído')
        .order('criado_em', { ascending: true });
      if (err2) throw err2;
      setAvaliacoes(aval || []);

      // 3. Testes Comportamentais (DISC/PDA)
      const { data: tst, error: err3 } = await supabase
        .from('testes_comportamentais')
        .select('*')
        .eq('funcionario_id', id)
        .eq('status', 'Concluído')
        .order('criado_em', { ascending: false })
        .limit(1);
      if (err3) throw err3;
      setTestes(tst || []);

      // 4. PDIs
      const { data: pdi, error: err4 } = await supabase
        .from('9box_pdi')
        .select('*')
        .eq('funcionario_id', id)
        .order('criado_em', { ascending: false });
      if (err4) throw err4;
      setPdis(pdi || []);

    } catch (err: any) {
      toast({ title: "Erro ao carregar dossiê", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Gerando Dossiê Analítico...</div>;
  }

  if (!funcionario) {
    return <div className="p-8 text-center text-destructive">Funcionário não encontrado.</div>;
  }

  // Preparar dados para o gráfico de evolução
  const dadosEvolucao = avaliacoes.map(a => {
    const media = ((a.nota_tecnica || 0) + (a.nota_pontualidade || 0) + (a.nota_trabalho_equipe || 0) + (a.nota_proatividade || 0) + (a.nota_cuidado_equipamentos || 0)) / 5;
    return {
      data: format(new Date(a.criado_em), 'MMM/yy'),
      media: Number(media.toFixed(1)),
      tipo: a.tipo === 'Autoavaliacao' ? 'Auto' : 'Líder'
    };
  });

  // Teste mais recente
  const ultimoTeste = testes.length > 0 ? testes[0] : null;
  const radarData = ultimoTeste ? [
    { subject: 'Executor (D)', A: ultimoTeste.resultado_d || 0, fullMark: 10 },
    { subject: 'Comunicador (I)', A: ultimoTeste.resultado_i || 0, fullMark: 10 },
    { subject: 'Planejador (S)', A: ultimoTeste.resultado_s || 0, fullMark: 10 },
    { subject: 'Analista (C)', A: ultimoTeste.resultado_c || 0, fullMark: 10 },
  ] : [];

  // Insight Generator
  const gerarInsights = () => {
    const insights = [];
    
    // 1. Conflito DISC vs Equipe
    if (ultimoTeste?.resultado_d > 6) {
      const ultimaAvLider = avaliacoes.filter(a => a.tipo === '180_Graus').pop();
      if (ultimaAvLider && ultimaAvLider.nota_trabalho_equipe < 3) {
        insights.push({
          tipo: 'alerta',
          texto: "Perfil altamente Executor (D) com nota baixa em Trabalho em Equipe. Pode estar tratorando colegas para entregar resultado. Foco sugerido no PDI: Inteligência Relacional."
        });
      }
    }

    // 2. Risco de Burnout (PDA)
    if (ultimoTeste && ultimoTeste.nivel_energia && ultimoTeste.nivel_energia < 30) {
      insights.push({
        tipo: 'critico',
        texto: "Nível de energia vital abaixo de 30% (PDA). Alto risco de esgotamento/Burnout. Necessário aliviar carga ou rever distribuição de tarefas urgentemente."
      });
    }

    // 3. Subaproveitamento
    if (ultimoTeste?.resultado_i > 6 && funcionario.setor === 'Financeiro') {
      insights.push({
        tipo: 'sugestao',
        texto: "Perfil Comunicador/Influente (I) alocado no Financeiro. Tendência a perder atenção a detalhes. Considere realocação para áreas comerciais/atendimento se o desempenho técnico cair."
      });
    }
    
    // 4. Evolução positiva
    if (dadosEvolucao.length >= 2) {
      const ultimo = dadosEvolucao[dadosEvolucao.length - 1].media;
      const penultimo = dadosEvolucao[dadosEvolucao.length - 2].media;
      if (ultimo > penultimo + 0.5) {
        insights.push({
          tipo: 'positivo',
          texto: "Crescimento notável na média de avaliação 180º no último ciclo. O plano de desenvolvimento está surtindo efeito positivo."
        });
      }
    }

    if (insights.length === 0) {
      insights.push({ tipo: 'info', texto: "Dados insuficientes para gerar insights cruzados complexos. Continue realizando avaliações." });
    }

    return insights;
  };

  const insights = gerarInsights();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/rh')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6 text-primary" /> Dossiê Analítico: {funcionario.nome}
            </h1>
            <p className="text-muted-foreground">{funcionario.cargo} • {funcionario.setor}</p>
          </div>
        </div>
        <Badge variant={funcionario.status === 'Ativo' ? 'success' : 'secondary'}>{funcionario.status}</Badge>
      </div>

      {/* INSIGHTS */}
      <Card className="glass border-primary/20 shadow-lg">
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <Lightbulb className="h-5 w-5" /> Insights Cruzados (People Analytics IA)
          </CardTitle>
          <CardDescription>Conclusões automáticas geradas pelo cruzamento de DISC, PDA e Avaliações</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          {insights.map((ins, idx) => (
            <div key={idx} className={`p-4 rounded-lg border ${
              ins.tipo === 'critico' ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400' :
              ins.tipo === 'alerta' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400' :
              ins.tipo === 'positivo' ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' :
              'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400'
            }`}>
              {ins.tipo === 'critico' && <AlertTriangle className="h-4 w-4 inline mr-2 mb-1" />}
              {ins.texto}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* EVOLUÇÃO 180 GRAUS */}
        <Card className="glass border-border/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" /> Evolução de Desempenho
            </CardTitle>
            <CardDescription>Média das avaliações ao longo do tempo (1 a 5 estrelas)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dadosEvolucao.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosEvolucao} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line type="monotone" dataKey="media" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados suficientes para o gráfico.</div>
            )}
          </CardContent>
        </Card>

        {/* RADAR COMPORTAMENTAL E PDA */}
        <Card className="glass border-border/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" /> Comportamento e PDA
            </CardTitle>
            <CardDescription>Último mapeamento ({ultimoTeste ? format(new Date(ultimoTeste.criado_em), 'dd/MM/yyyy') : 'N/A'})</CardDescription>
          </CardHeader>
          <CardContent>
            {ultimoTeste ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                      <Radar name="Perfil" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4 flex flex-col justify-center">
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="font-semibold">Nível de Energia Vital</span><span>{ultimoTeste.nivel_energia || 0}%</span></div>
                    <Progress value={ultimoTeste.nivel_energia || 0} className="h-2" indicatorClassName={(ultimoTeste.nivel_energia||0) < 30 ? "bg-destructive" : (ultimoTeste.nivel_energia||0) < 70 ? "bg-primary" : "bg-success"} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="font-semibold">Autocontrole (Sob Pressão)</span><span>{ultimoTeste.autocontrole || 0}%</span></div>
                    <Progress value={ultimoTeste.autocontrole || 0} className="h-2" indicatorClassName={(ultimoTeste.autocontrole||0) < 30 ? "bg-destructive" : (ultimoTeste.autocontrole||0) < 70 ? "bg-primary" : "bg-success"} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground min-h-[200px]">Nenhum teste comportamental concluído.</div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
