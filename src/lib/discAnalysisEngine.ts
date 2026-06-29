export type DiscProfile = 'Executor (D)' | 'Comunicador (I)' | 'Planejador (S)' | 'Analista (C)';

export interface DetailedDiscAnalysis {
  sumario: {
    forcas: string[];
    desafios: string[];
    comunicacao: string;
    ambiente_ideal: string;
    dicas_gestao: string[];
  };
  analise_profissional: {
    concentracao: string;
    planejamento: string;
    tomada_decisao: string;
    perspectiva: string;
    interacao: string;
    organizacao: string;
    ritmo: string;
    inovacao: string;
    pdi: string[];
  };
  influencia_secundaria: {
    perfil: string;
    descricao: string;
  };
  carreira: {
    tecnicos: string;
    graduacao: string;
    livres: string;
    pos: string;
  };
  sliders: {
    foco: number; // -100 (Pessoas) to 100 (Tarefas)
    ritmo: number; // -100 (Calmo) to 100 (Rápido)
    decisao: number; // -100 (Colaborativa) to 100 (Autônoma)
    comunicacao: number; // -100 (Expressiva) to 100 (Direta)
    mudancas: number; // -100 (Estabilidade) to 100 (Ação)
    organizacao: number; // -100 (Adaptável) to 100 (Estruturada)
    interacao: number; // -100 (Reservada) to 100 (Expansiva)
    riscos: number; // -100 (Cautelosa) to 100 (Ousada)
  };
}

export function generateDiscAnalysis(
  d: number,
  i: number,
  s: number,
  c: number,
  perfilPredominante: string
): DetailedDiscAnalysis {
  
  // Identify secondary profile
  const scores = [
    { label: 'Executor (D)', value: d, letter: 'D' },
    { label: 'Comunicador (I)', value: i, letter: 'I' },
    { label: 'Planejador (S)', value: s, letter: 'S' },
    { label: 'Analista (C)', value: c, letter: 'C' }
  ];
  
  scores.sort((a, b) => b.value - a.value);
  const primary = scores[0];
  const secondary = scores[1].value > 0 ? scores[1] : scores[0];

  const result: DetailedDiscAnalysis = {
    sumario: getSumario(primary.letter),
    analise_profissional: getAnaliseProfissional(primary.letter),
    influencia_secundaria: getInfluenciaSecundaria(primary.letter, secondary.letter),
    carreira: getCarreira(primary.letter),
    sliders: calculateSliders(d, i, s, c)
  };

  return result;
}

function getSumario(primaryLetter: string) {
  switch (primaryLetter) {
    case 'D':
      return {
        forcas: ["Foco extremo em resultados", "Tomada de decisão rápida", "Coragem para assumir riscos", "Autoconfiança e assertividade"],
        desafios: ["Pode parecer autoritário ou insensível", "Impaciência com processos lentos", "Dificuldade em delegar controle", "Baixa atenção a detalhes minuciosos"],
        comunicacao: "Direta, objetiva e focada no resultado final. Prefere conversas rápidas e sem rodeios.",
        ambiente_ideal: "Ambientes competitivos, com metas agressivas, autonomia de decisão e recompensas baseadas em mérito.",
        dicas_gestao: ["Dê autonomia e desafios claros.", "Vá direto ao ponto, evite microgestão.", "Ofereça oportunidades de liderança."]
      };
    case 'I':
      return {
        forcas: ["Excelente habilidade interpessoal", "Poder de persuasão e motivação", "Criatividade e inovação", "Otimismo contagiante"],
        desafios: ["Dificuldade com organização e rotinas", "Pode perder o foco na execução técnica", "Tende a agir pela emoção", "Dificuldade com gestão de tempo"],
        comunicacao: "Comunicação expressiva, animada e voltada para o engajamento emocional das pessoas.",
        ambiente_ideal: "Ambientes dinâmicos, livres de rotina excessiva, onde possa expressar suas ideias e receber reconhecimento público.",
        dicas_gestao: ["Seja amigável e demonstre entusiasmo nas interações.", "Permita tempo para trocas de ideias antes de entrar nos detalhes técnicos.", "Forneça reconhecimento público e feedbacks positivos constantes."]
      };
    case 'S':
      return {
        forcas: ["Lealdade e consistência", "Excelente ouvinte e conciliador", "Paciência e foco na conclusão", "Alta previsibilidade e confiabilidade"],
        desafios: ["Resistência a mudanças bruscas", "Dificuldade em dizer 'não'", "Pode ser passivo em conflitos", "Demora para tomar decisões sob pressão"],
        comunicacao: "Comunicação calma, empática e acolhedora. Evita confrontos e valoriza o consenso.",
        ambiente_ideal: "Ambientes harmoniosos, seguros, com rotinas bem estabelecidas e liderança previsível e justa.",
        dicas_gestao: ["Avise sobre mudanças com antecedência.", "Valorize a contribuição leal e o apoio ao time.", "Crie um ambiente livre de conflitos agressivos."]
      };
    case 'C':
    default:
      return {
        forcas: ["Precisão técnica e alta qualidade", "Pensamento lógico e analítico", "Organização e planejamento", "Forte senso de regras e conformidade"],
        desafios: ["Excesso de perfeccionismo", "Lentidão em decisões que exigem intuição", "Crítico demais consigo mesmo e com os outros", "Pode se prender excessivamente aos detalhes"],
        comunicacao: "Formal, estruturada, baseada em dados, fatos e evidências lógicas.",
        ambiente_ideal: "Ambientes tranquilos, que exigem precisão técnica, onde a qualidade é valorizada acima da velocidade.",
        dicas_gestao: ["Forneça dados e fatos claros nas discussões.", "Evite surpresas ou cobranças sem base lógica.", "Reconheça a precisão e a qualidade do trabalho."]
      };
  }
}

function getAnaliseProfissional(primaryLetter: string) {
  switch (primaryLetter) {
    case 'D':
      return {
        concentracao: "Foca energia em atingir metas agressivas e superar obstáculos no menor tempo possível.",
        planejamento: "Planejamento prático e macro. Foca no objetivo final e ajusta a rota durante a execução.",
        tomada_decisao: "Decisões rápidas, independentes e baseadas no impacto nos resultados do negócio.",
        perspectiva: "Visão focada no futuro, buscando crescimento, expansão e vitórias imediatas.",
        interacao: "Interação baseada no pragmatismo. Relaciona-se bem quando os objetivos estão alinhados.",
        organizacao: "Delega os detalhes organizacionais para focar na estratégia e no comando.",
        ritmo: "Ritmo muito acelerado, voltado para a ação e para a geração de impacto imediato.",
        inovacao: "Inovação voltada para a eficiência e para quebrar o status quo de forma disruptiva.",
        pdi: ["Praticar a empatia e escuta ativa", "Diminuir a agressividade sob pressão", "Prestar mais atenção aos riscos e detalhes"]
      };
    case 'I':
      return {
        concentracao: "Foca energia em criar conexões, motivar pessoas e gerar visibilidade para projetos.",
        planejamento: "Planejamento colaborativo e visionário. Gosta de debater ideias, mas pode perder o foco nos detalhes de execução.",
        tomada_decisao: "Decisões intuitivas e influenciadas pelo impacto que terão nas pessoas envolvidas e no clima.",
        perspectiva: "Visão ampla, otimista e voltada para o futuro e para as relações humanas.",
        interacao: "Extremamente sociável. Constrói redes de networking valiosas e resolve problemas através do diálogo.",
        organizacao: "Prefere ambientes dinâmicos e menos engessados. Pode precisar de ferramentas ou suporte para manter a organização.",
        ritmo: "Ritmo acelerado, enérgico e com muitas frentes abertas simultaneamente.",
        inovacao: "Alta criatividade focada no brainstorming e em soluções disruptivas que chamam a atenção.",
        pdi: ["Melhorar o acompanhamento de tarefas até a conclusão", "Basear decisões mais em dados e menos em intuição", "Desenvolver capacidade de focar em tarefas rotineiras"]
      };
    case 'S':
      return {
        concentracao: "Foca energia em apoiar o time, manter a harmonia e garantir a qualidade do que já funciona.",
        planejamento: "Planejamento estruturado e de longo prazo. Gosta de saber o passo a passo seguro para chegar ao objetivo.",
        tomada_decisao: "Decisões ponderadas, consultivas e que buscam minimizar riscos e desconfortos para a equipe.",
        perspectiva: "Visão voltada para o presente e a estabilidade. Valoriza a tradição e o que já foi comprovado.",
        interacao: "Relacionamentos profundos, leais e de longo prazo. Excelente para mediar conflitos internos.",
        organizacao: "Altamente organizado com suas rotinas diárias e processos conhecidos.",
        ritmo: "Ritmo constante, calmo e previsível. Consegue manter o foco em tarefas longas sem perder a consistência.",
        inovacao: "Inovação incremental. Prefere melhorar processos existentes do que criar rupturas agressivas.",
        pdi: ["Desenvolver flexibilidade e adaptabilidade a mudanças", "Acelerar a tomada de decisão em momentos críticos", "Aprender a dizer 'não' quando sobrecarregado"]
      };
    case 'C':
    default:
      return {
        concentracao: "Foca energia em análises profundas, qualidade máxima e prevenção de erros lógicos.",
        planejamento: "Planejamento meticuloso, focado em detalhes, regras, conformidade e redução a zero dos riscos.",
        tomada_decisao: "Decisões cautelosas e demoradas, baseadas puramente na análise exaustiva de dados e fatos.",
        perspectiva: "Visão crítica e realista. Foca em identificar problemas e desenhar soluções sistêmicas perfeitas.",
        interacao: "Relacionamentos formais e profissionais. Prefere trabalhar sozinho e evitar dinâmicas emocionais no trabalho.",
        organizacao: "Nível máximo de organização e sistematização. Tudo deve ter um processo e uma lógica clara.",
        ritmo: "Ritmo compassado e deliberado, focando na qualidade e não na velocidade da entrega.",
        inovacao: "Inovação tecnológica ou metodológica, sempre embasada em lógica sólida e necessidade comprovada.",
        pdi: ["Evitar a paralisia por análise (demorar demais para decidir)", "Desenvolver tolerância ao erro e à imperfeição", "Melhorar a comunicação interpessoal e empatia"]
      };
  }
}

function getInfluenciaSecundaria(primary: string, secondary: string) {
  if (primary === secondary) {
    return {
      perfil: `Perfil Puro (${primary})`,
      descricao: "Seu perfil apresenta uma predominância tão forte neste traço que suas características principais são extremamente intensificadas, sem a moderação de um segundo fator."
    };
  }

  const map: Record<string, string> = {
    'DI': "O I (Influência) suaviza a sua abordagem agressiva (D), tornando-o um líder mais carismático e inspirador, focado em atingir metas motivando as pessoas.",
    'DS': "O S (Estabilidade) ancora o seu perfil executor (D), adicionando mais paciência, consistência e um ritmo mais sustentável para suas ambições.",
    'DC': "O C (Conformidade) potencializa sua orientação a tarefas. Você busca resultados rápidos (D), mas garantindo que tudo seja feito com extrema precisão e qualidade (C).",
    'ID': "O D (Dominância) adiciona tração ao seu perfil sociável (I). Você não apenas inspira as pessoas, mas foca em transformar essa energia em resultados palpáveis e rápidos.",
    'IS': "O S (Estabilidade) aprofunda sua empatia (I). Você é um 'Pessoa de Pessoas' nato, focando intensamente em criar um ambiente harmonioso, seguro e alegre para o time.",
    'IC': "O C (Conformidade) age como moderador das suas tendências expansivas (I). Você traz inovação e comunicação, mas garante que os processos e a qualidade sejam mantidos.",
    'SD': "O D (Dominância) traz iniciativa para sua estabilidade (S). Você é leal e calmo, mas sabe ser firme e decisivo quando os objetivos ou o seu time estão ameaçados.",
    'SI': "O I (Influência) adiciona calor humano e extroversão ao seu perfil (S). Você é excelente em criar laços duradouros e em se comunicar de forma extremamente acolhedora.",
    'SC': "O C (Conformidade) reforça sua necessidade de segurança (S) com um apreço pelas regras e dados (C). Você é altamente procedimental, leal e técnico.",
    'CD': "O D (Dominância) traz ação para a sua análise (C). Você gosta da precisão dos dados, mas usa isso para tomar decisões executivas rápidas e voltadas para o resultado.",
    'CI': "O I (Influência) suaviza o seu rigor técnico (C). Você é detalhista e analítico, mas consegue comunicar suas descobertas de forma carismática e envolvente.",
    'CS': "O S (Estabilidade) reforça a sua cautela e organização (C). Você é extremamente sistemático, previsível e focado em manter a qualidade a longo prazo."
  };

  const key = primary + secondary;
  const labels: Record<string, string> = { 'D': 'Dominância', 'I': 'Influência', 'S': 'Estabilidade', 'C': 'Conformidade' };

  return {
    perfil: `Perfil Secundário: ${secondary} (${labels[secondary]})`,
    descricao: map[key] || "Seu perfil secundário age como um moderador ou acelerador das suas tendências naturais mais fortes."
  };
}

function getCarreira(primaryLetter: string) {
  switch (primaryLetter) {
    case 'D':
      return {
        tecnicos: "Gestão de Projetos, Logística, Engenharia de Produção, Administração.",
        graduacao: "Direito, Engenharia, Administração de Empresas, Economia.",
        livres: "Liderança de Alta Performance, Gestão de Tempo, Negociação Estratégica, Empreendedorismo.",
        pos: "MBA em Gestão Empresarial, Gerenciamento de Projetos, Gestão Estratégica de Negócios."
      };
    case 'I':
      return {
        tecnicos: "Marketing, Recursos Humanos, Eventos, Vendas.",
        graduacao: "Comunicação Social, Jornalismo, Relações Públicas, Psicologia.",
        livres: "Oratória, Storytelling, Marketing Digital, Gestão de Pessoas, Criatividade.",
        pos: "Especialização em Comunicação Corporativa, Gestão de Pessoas e Liderança, Marketing Estratégico."
      };
    case 'S':
      return {
        tecnicos: "Enfermagem, Assistência Social, Secretariado Executivo, Pedagogia.",
        graduacao: "Psicologia, Pedagogia, Serviço Social, Fisioterapia, Letras.",
        livres: "Mediação de Conflitos, Inteligência Emocional, Atendimento ao Cliente, Escuta Ativa.",
        pos: "Psicologia Organizacional, Gestão Escolar, Gestão de Saúde, Terapia Familiar."
      };
    case 'C':
    default:
      return {
        tecnicos: "Contabilidade, TI/Programação, Qualidade, Desenho Industrial.",
        graduacao: "Ciências Contábeis, Sistemas de Informação, Matemática, Ciências da Computação, Engenharia de Software.",
        livres: "Análise de Dados (Data Science), Power BI, Gestão da Qualidade (Lean Six Sigma), Lógica de Programação.",
        pos: "Auditoria e Controladoria, Ciência de Dados, Engenharia de Qualidade, Gestão de Riscos."
      };
  }
}

function calculateSliders(d: number, i: number, s: number, c: number) {
  const sum = (d + i + s + c) || 1; 
  
  const tarefas = d + c;
  const pessoas = i + s;
  const foco = ((tarefas - pessoas) / sum) * 100;

  const rapido = d + i;
  const calmo = s + c;
  const ritmo = ((rapido - calmo) / sum) * 100;

  const autonoma = (d * 1.5) + (c * 0.5);
  const colaborativa = (s * 1.5) + (i * 0.5);
  const decisao = ((autonoma - colaborativa) / sum) * 100;

  const direta = (d * 1.5) + (c * 1.0);
  const expressiva = (i * 1.5) + (s * 1.0);
  const comunicacao = ((direta - expressiva) / sum) * 100;

  const acao = (d * 1.5) + (i * 1.0);
  const estabilidade = (s * 1.5) + (c * 1.0);
  const mudancas = ((acao - estabilidade) / sum) * 100;

  const estruturada = (c * 1.5) + (s * 1.0);
  const adaptavel = (i * 1.5) + (d * 1.0);
  const organizacao = ((estruturada - adaptavel) / sum) * 100;

  const expansiva = (i * 1.5) + (d * 0.5);
  const reservada = (c * 1.5) + (s * 0.5);
  const interacao = ((expansiva - reservada) / sum) * 100;

  const ousada = (d * 1.5) + (i * 0.5);
  const cautelosa = (c * 1.5) + (s * 0.5);
  const riscos = ((ousada - cautelosa) / sum) * 100;

  return {
    foco: Math.max(-100, Math.min(100, foco)),
    ritmo: Math.max(-100, Math.min(100, ritmo)),
    decisao: Math.max(-100, Math.min(100, decisao)),
    comunicacao: Math.max(-100, Math.min(100, comunicacao)),
    mudancas: Math.max(-100, Math.min(100, mudancas)),
    organizacao: Math.max(-100, Math.min(100, organizacao)),
    interacao: Math.max(-100, Math.min(100, interacao)),
    riscos: Math.max(-100, Math.min(100, riscos))
  };
}
