import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save, FileText,
  RefreshCw, BookOpen, AlertCircle, CheckCircle2
} from "lucide-react";

export interface ModeloClausula {
  id?: string;
  numero: number;
  titulo: string;
  texto: string;
  ativo?: boolean;
}

// Cláusulas padrão do contrato Busato
const CLAUSULAS_PADRAO: Omit<ModeloClausula, "id">[] = [
  {
    numero: 1,
    titulo: "CLÁUSULA PRIMEIRA — OBJETO",
    texto: `É objeto do presente Contrato a locação de equipamento(s) para utilização conforme descrição acordada entre as Partes.

Fica acordado entre as Partes que o(s) bem(ns) locado(s) possuem franquia mensal mínima de horas por veículo/equipamento, individualmente, conforme valores unitários pactuados.

Nos casos de contratos de locação por HORA, será garantido à LOCADORA um mínimo de horas mensais de locação por veículo/equipamento, individualmente, e as horas extras trabalhadas ou à disposição que excedam esse limite serão acrescidas e registradas em Boletim de Medição, aplicando-se os preços unitários por hora pactuados, assim como possíveis deduções previstas na Cláusula Quarta.

Nos meses de mobilização e desmobilização do equipamento o valor mensal a ser medido será proporcional ao número de dias úteis do equipamento à disposição da obra.`,
    ativo: true,
  },
  {
    numero: 2,
    titulo: "CLÁUSULA SEGUNDA — PRAZO",
    texto: `O prazo de vigência do presente Contrato será conforme acordado entre as Partes, podendo ser prorrogado automaticamente, por iguais e sucessivos períodos, até o limite máximo de 12 (doze) meses de vigência total, salvo manifestação expressa, formalizada por escrito, em sentido contrário por qualquer das partes, com antecedência mínima de 15 (quinze) dias do término de cada período de vigência.

Até 15 (quinze) dias antes do término do prazo máximo de 12 (doze) meses, as partes poderão negociar e ajustar as novas condições comerciais, mediante celebração de aditivo contratual, com nova vigência e valores, mantendo-se todas as demais condições previamente pactuadas no contrato principal.

Caso a LOCATÁRIA deseje reduzir o prazo ou suspender a locação do bem, objeto deste contrato, deverá formalmente comunicar, mediante aviso prévio de 15 (quinze) dias, à LOCADORA para que esta manifeste sua concordância. A suspensão indevida da locação pela LOCATÁRIA implicará em rescisão contratual antecipada, aplicando-se as penalidades respectivas, nos termos da Cláusula Nona.`,
    ativo: true,
  },
  {
    numero: 3,
    titulo: "CLÁUSULA TERCEIRA — PREÇOS",
    texto: `O valor global estimado do presente Contrato é calculado conforme os valores unitários e prazos indicados. Este valor serve apenas como parâmetro orçamentário, não constituindo qualquer compromisso das Partes de virem a efetivamente utilizá-lo integralmente, sendo devido apenas o montante referente ao período em que o equipamento estiver efetivamente locado, observadas as premissas de medição estabelecidas neste instrumento.

Os preços unitários pactuados serão fixos e irreajustáveis durante toda a vigência do presente Contrato ou pelo período de 12 (doze) meses. Caso o presente instrumento vigore por prazo superior a este, os preços poderão ser reajustados mediante negociação entre as partes e formalização de Aditivo Contratual.`,
    ativo: true,
  },
  {
    numero: 4,
    titulo: "CLÁUSULA QUARTA — MEDIÇÃO",
    texto: `Os boletins de medição serão elaborados com base nas informações obtidas por meio da telemetria e manifestar eventual discordância, apresentando, obrigatoriamente, as evidências que comprovem a divergência. Decorrido o referido prazo sem manifestação, os boletins serão considerados aprovados, prosseguindo-se com o faturamento e envio para pagamento.

Serão deduzidas das medições as horas em que o equipamento estiver parado para manutenções preventivas e/ou corretivas, por defeitos no equipamento ou quaisquer outros aspectos de responsabilidade da LOCADORA que impeçam a operação efetiva do equipamento/veículo, conforme quadro definido pelas Partes, exceto em caso de mau uso ou culpa da LOCATÁRIA, quando esta deverá arcar com os custos sem deduções na medição.`,
    ativo: true,
  },
  {
    numero: 5,
    titulo: "CLÁUSULA QUINTA — PAGAMENTOS",
    texto: `Pela locação do bem objeto do presente Contrato, a LOCATÁRIA pagará à LOCADORA os valores unitários conforme prazo acordado entre as Partes.

Os pagamentos deverão ocorrer através de depósito bancário/PIX em conta corrente de titularidade da LOCADORA ou mediante boleto, sendo proibido o endosso de duplicatas, descontos de títulos bem como a utilização do sistema de cobrança bancária.

DADOS BANCÁRIOS PARA DEPÓSITO/PIX:
Favorecido: BUSATO LOCAÇÕES E SERVIÇOS LTDA | CNPJ: 54.167.719/0001-40
E-mail para comprovantes: financeiro@bsuatotransportes.com.br

As informações sobre programações dos pagamentos e/ou comprovantes de pagamento deverão ser solicitadas à LOCATÁRIA, através dos e-mails: alyson.oliveira@busatoloc.com.br, financeiro@bsuatotransportes.com.br, samara.rodrigues@busatoloc.com.br.`,
    ativo: true,
  },
  {
    numero: 6,
    titulo: "CLÁUSULA SEXTA — DAS OBRIGAÇÕES DA LOCADORA",
    texto: `Prestar à LOCATÁRIA quaisquer esclarecimentos e informações que se fizerem necessárias para utilização do bem locado.

Fornecer o bem locado em perfeitas condições de uso, conforme orientações de manutenções/operação do fabricante. Os implementos e características adicionais ao equipamento/veículo deverão ser negociados entre as Partes previamente à saída do equipamento do pátio.

Realizar as manutenções preventivas conforme plano de manutenção, podendo a LOCADORA indicar a concessionária ou oficina credenciada mais próxima para efetivar a manutenção devida ou autorizar que a manutenção seja realizada pela própria LOCATÁRIA.

Vistoriar e providenciar evidências na saída e na chegada do bem locado para comprovar o estado em que se encontra. Essa verificação deverá ser realizada mediante a participação de ambas as Partes.

Arcar com os custos de licenciamento de trânsito do veículo, IPVA e seguro obrigatório.

Fornecer à LOCATÁRIA cópia dos documentos e orientações referentes ao bem locado, sendo: CRLV, plano de manutenção, laudo eletromecânico e laudo de opacidade.

Substituir o bem locado, caso este apresente defeitos atestados pela equipe de manutenção além dos considerados normais, disponibilizando à LOCATÁRIA outro equipamento/veículo com as mesmas características técnicas e em perfeito estado de funcionamento.`,
    ativo: true,
  },
  {
    numero: 7,
    titulo: "CLÁUSULA SÉTIMA — DAS OBRIGAÇÕES DA LOCATÁRIA",
    texto: `Pagar à LOCADORA os valores devidos pela locação, obedecendo aos preços e prazos pactuados.

Apresentar mensalmente à LOCADORA os registros constantes do horímetro para realização da medição.

Informar à LOCADORA a necessidade de realização de manutenção corretiva no equipamento assim que constatado qualquer falha, anormalidade ou avaria.

Durante o período locado, toda lubrificação periódica necessária ao funcionamento será de inteira responsabilidade da LOCATÁRIA, devendo ser realizada conforme recomendações do fabricante.

Danos decorrentes de falta de lubrificação, uso sem óleo/fluido, combustível adulterado, combustível inadequado, impurezas, água no sistema, mistura incorreta, operação com nível baixo, superaquecimento ou travamento, serão considerados mau uso, respondendo a LOCATÁRIA integralmente por reparos, peças e mão de obra.

Conservar no equipamento/veículo o adesivo contendo a identificação e dados da LOCADORA.

Usar o bem locado de forma adequada e para o fim que se destina, sob pena de responder civil e criminalmente pelo mau uso ou deterioração do bem.

Não sublocar, emprestar, ceder, arrendar ou permitir que terceiros alheios ao presente contrato utilizem do veículo locado no todo ou em parte, temporária ou definitivamente.

Responsabilizar-se pela mobilização e desmobilização do bem locado, arcando com todos e quaisquer gastos, fretes e afins.

Fica expressamente vedado à LOCATÁRIA realizar qualquer tipo de intervenção, remoção, substituição, desativação ou alteração no sistema de rastreamento instalado pela LOCADORA.

Em caso de locação de máquina, caberá exclusivamente à LOCATÁRIA arcar com todos os custos de dentes, lâminas, adaptadores e quaisquer outros componentes que tenham contato direto com o solo durante a operação do equipamento.`,
    ativo: true,
  },
  {
    numero: 8,
    titulo: "CLÁUSULA OITAVA — DA MULTA",
    texto: `Em caso de não cumprimento de qualquer cláusula e/ou condições pactuadas neste instrumento, será aplicada multa conforme estabelecido entre as Partes.

As multas pecuniárias previstas não isentam a LOCATÁRIA do pagamento de reparação de eventuais danos ou prejuízos por ela causados à LOCADORA e a indenização por danos emergentes e por lucros cessantes.`,
    ativo: true,
  },
  {
    numero: 9,
    titulo: "CLÁUSULA NONA — DA RESCISÃO",
    texto: `Este Contrato poderá ser rescindido, total ou parcialmente, independentemente de qualquer interpelação judicial ou extrajudicial, nas seguintes hipóteses acordadas entre as Partes.

A transferência do bem locado para localidade diferente daquela estabelecida no Contrato deverá ser objeto de nova avaliação comercial e elaboração de Termo Aditivo para permitir a transferência do bem para outra localidade.`,
    ativo: true,
  },
  {
    numero: 10,
    titulo: "CLÁUSULA DÉCIMA — DO RECEBIMENTO E DEVOLUÇÃO DO BEM LOCADO",
    texto: `A LOCATÁRIA receberá o bem locado em condições normais de uso e assim o manterá até a sua efetiva devolução, ressalvados os desgastes considerados naturais.

A LOCATÁRIA não poderá realizar qualquer modificação no veículo/equipamento locado, sem a prévia e expressa autorização da LOCADORA.

Findo o prazo estabelecido, ou rescindida a locação por qualquer motivo, a LOCATÁRIA restituirá o bem locado à LOCADORA nas condições em que o recebeu, salvo os desgastes naturais.`,
    ativo: true,
  },
  {
    numero: 11,
    titulo: "CLÁUSULA DÉCIMA PRIMEIRA — DOS SEGUROS",
    texto: `Fica a cargo da LOCADORA, por sua conta exclusiva, a contratação de seguro automotivo em companhia de seguradora de idoneidade reconhecida, para cobertura de danos materiais e pessoais a terceiros e para cobrir os gastos em decorrência de acidente de trânsito envolvendo o bem.

Caso o seguro seja acionado em decorrência de sinistro causado durante a utilização do bem pela LOCATÁRIA, esta ficará responsável pelo pagamento da franquia, conforme apólice de seguro.

A LOCADORA se compromete a enviar a apólice do veículo/equipamento locado, após a assinatura do presente contrato.

Na hipótese excepcional de não ser possível acionar o seguro vigente, a LOCATÁRIA será responsável pelo pagamento de perdas e danos, limitado ao valor correspondente a 15% do valor do bem sinistrado.`,
    ativo: true,
  },
  {
    numero: 12,
    titulo: "CLÁUSULA DÉCIMA SEGUNDA — DA FISCALIZAÇÃO",
    texto: `A LOCADORA poderá fiscalizar a boa utilização do veículo/equipamento pela LOCATÁRIA, e em caso de constatar qualquer irregularidade na utilização do mesmo, a LOCATÁRIA deve providenciar a regularização imediata.`,
    ativo: true,
  },
  {
    numero: 13,
    titulo: "CLÁUSULA DÉCIMA TERCEIRA — DO GRAVAME",
    texto: `Sendo a LOCADORA legítima proprietária ou possuidora do bem locado, a LOCATÁRIA não poderá dá-lo em penhor, caução ou gravá-lo a favor de terceiros.`,
    ativo: true,
  },
  {
    numero: 14,
    titulo: "CLÁUSULA DÉCIMA QUARTA — RESPONSABILIDADE POR DANOS CAUSADOS",
    texto: `A LOCATÁRIA será integral e exclusivamente responsável pela condução, operação e uso dos veículos/equipamentos locados, incluindo a observância das normas de trânsito, segurança e legislações aplicáveis.

A responsabilidade da LOCATÁRIA abrange todas as ações ou omissões praticadas por seus motoristas, empregados, prepostos ou qualquer outra pessoa que utilizar os veículos, sendo de sua inteira responsabilidade quaisquer danos causados a terceiros, danos ambientais, multas, infrações, perdas, acidentes de trânsito, furtos, roubos, ou quaisquer outros eventos relacionados ao uso dos veículos.

A LOCADORA não será, em hipótese alguma, responsabilizada por qualquer evento decorrente da utilização dos veículos locados, ficando isenta de toda e qualquer obrigação ou encargo relacionado ao uso dos mesmos pela LOCATÁRIA.

A LOCATÁRIA ressarcirá a LOCADORA, independentemente do resultado dos processos judiciais ou administrativos, o valor das horas que forem despendidas por seu advogado, especialmente na elaboração de petições e nos deslocamentos para audiências, além das despesas judiciais e administrativas.`,
    ativo: true,
  },
  {
    numero: 15,
    titulo: "CLÁUSULA DÉCIMA QUINTA — LGPD",
    texto: `As Partes declaram-se cientes dos direitos, obrigações e penalidades aplicáveis constantes da Lei Geral de Proteção de Dados Pessoais (LGPD) e obrigam-se a adotar todas as medidas de segurança, técnicas, organizacionais e administrativas para garantir, por si, bem como por seu pessoal, colaboradores, empregados e subcontratados, o cumprimento da referida legislação.`,
    ativo: true,
  },
  {
    numero: 16,
    titulo: "CLÁUSULA DÉCIMA SEXTA — DAS DISPOSIÇÕES GERAIS",
    texto: `Os signatários do presente Contrato asseguram e afirmam que são os representantes legais competentes para assumir em nome das partes as obrigações descritas neste instrumento.

A LOCATÁRIA não poderá, em hipótese alguma, transferir ou delegar as atribuições e responsabilidades que assumem por força deste Contrato, a não ser com prévia concordância da LOCADORA.

As Partes são contratantes totalmente independentes, sendo cada uma inteiramente responsável por seus atos, obrigações e conteúdo das informações prestadas, em toda e qualquer circunstância.

O não exercício por qualquer das partes de direitos ou faculdades que lhe assistam em decorrência do presente instrumento não afetará aqueles direitos ou faculdades, os quais poderão ser exercidos a qualquer tempo.

Este Contrato somente poderá ser alterado mediante formalização de Termo Aditivo assinado por ambas as Partes.`,
    ativo: true,
  },
];

// ─── Standalone ModeloClausulasTab (for main page tab) ──────────────────────
export const ModeloClausulasTab = () => {
  const { toast } = useToast();
  const [clausulas, setClausulas] = useState<ModeloClausula[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadModelo();
  }, []);

  const loadModelo = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("modelos_clausula" as any)
      .select("*")
      .eq("ativo", true)
      .order("numero", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar modelo", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      // Pre-populate with standard clauses
      setClausulas(CLAUSULAS_PADRAO.map((c, i) => ({ ...c, id: `new-${i}` })));
      setDirty(true);
    } else {
      setClausulas(data as ModeloClausula[]);
      setDirty(false);
    }
    setLoading(false);
  };

  const handleChange = (idx: number, field: keyof ModeloClausula, value: string) => {
    setClausulas(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    setDirty(true);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setClausulas(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((c, i) => ({ ...c, numero: i + 1 }));
    });
    setDirty(true);
  };

  const moveDown = (idx: number) => {
    setClausulas(prev => {
      if (idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((c, i) => ({ ...c, numero: i + 1 }));
    });
    setDirty(true);
  };

  const addClausula = () => {
    setClausulas(prev => [
      ...prev,
      { id: `new-${Date.now()}`, numero: prev.length + 1, titulo: `Nova Cláusula ${prev.length + 1}`, texto: "", ativo: true }
    ]);
    setDirty(true);
  };

  const removeClausula = (idx: number) => {
    setClausulas(prev => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, numero: i + 1 })));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    // Delete all and re-insert (simplest strategy for reorder support)
    await supabase.from("modelos_clausula" as any).delete().eq("ativo", true);

    const rows = clausulas.map((c, i) => ({
      numero: i + 1,
      titulo: c.titulo,
      texto: c.texto,
      ativo: true,
    }));

    const { error } = await supabase.from("modelos_clausula" as any).insert(rows);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Modelo salvo!", description: "As cláusulas padrão foram atualizadas com sucesso.", className: "border-success" });
      setDirty(false);
      loadModelo();
    }
    setSaving(false);
  };

  const resetToDefault = () => {
    setClausulas(CLAUSULAS_PADRAO.map((c, i) => ({ ...c, id: `new-${i}` })));
    setDirty(true);
    toast({ title: "Modelo restaurado", description: "Texto padrão carregado. Clique em Salvar para confirmar." });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando cláusulas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Modelo de Cláusulas Padrão</h2>
            <p className="text-sm text-muted-foreground">
              Estas cláusulas são aplicadas automaticamente a novos contratos gerados pelo sistema.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={resetToDefault}>
            <RefreshCw className="h-4 w-4 mr-2" /> Restaurar Padrão
          </Button>
          <Button size="sm" onClick={addClausula} variant="outline">
            <Plus className="h-4 w-4 mr-2" /> Adicionar Cláusula
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px]"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? "Salvando..." : "Salvar Modelo"}
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 text-sm text-warning font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Você tem alterações não salvas. Clique em "Salvar Modelo" para confirmar.
        </div>
      )}

      {/* Clause list */}
      <div className="space-y-4">
        {clausulas.map((clausula, idx) => (
          <Card key={clausula.id || idx} className="border border-border shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-start gap-3">
                {/* Number badge */}
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-black shrink-0 mt-0.5">
                  {clausula.numero}
                </div>
                {/* Title input */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={clausula.titulo}
                    onChange={e => handleChange(idx, "titulo", e.target.value)}
                    className="w-full text-sm font-bold bg-transparent border-0 border-b border-dashed border-border focus:border-primary focus:outline-none px-0 py-0.5 text-foreground placeholder:text-muted-foreground"
                    placeholder="Título da cláusula..."
                  />
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveUp(idx)} disabled={idx === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveDown(idx)} disabled={idx === clausulas.length - 1}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeClausula(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <Textarea
                value={clausula.texto}
                onChange={e => handleChange(idx, "texto", e.target.value)}
                rows={5}
                className="text-sm resize-y bg-muted/20 font-mono leading-relaxed"
                placeholder="Texto da cláusula..."
              />
              <p className="text-xs text-muted-foreground mt-1.5 text-right">
                {clausula.texto.length} caracteres
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {clausulas.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Nenhuma cláusula cadastrada</p>
          <p className="text-sm mt-1">Clique em "Restaurar Padrão" ou "Adicionar Cláusula" para começar.</p>
        </div>
      )}

      {clausulas.length > 0 && (
        <div className="flex justify-end pb-6">
          <Button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Salvando..." : "Salvar Modelo"}
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── ContratoClausulasTab (inside contract management dialog) ────────────────
interface ContratoClausulasTabProps {
  contratoId: string;
}

export const ContratoClausulasTab = ({ contratoId }: ContratoClausulasTabProps) => {
  const { toast } = useToast();
  const [clausulas, setClausulas] = useState<(ModeloClausula & { is_customizada?: boolean })[]>([]);
  const [modelo, setModelo] = useState<ModeloClausula[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (contratoId) loadClausulas();
  }, [contratoId]);

  const loadClausulas = async () => {
    setLoading(true);

    // Load global model
    const { data: modeloData } = await supabase
      .from("modelos_clausula" as any)
      .select("*")
      .eq("ativo", true)
      .order("numero", { ascending: true });

    const modeloList = (modeloData || []) as ModeloClausula[];
    setModelo(modeloList);

    // Load contract-specific clauses
    const { data: contratoData } = await supabase
      .from("contratos_clausulas" as any)
      .select("*")
      .eq("contrato_id", contratoId)
      .order("numero", { ascending: true });

    if (!contratoData || contratoData.length === 0) {
      // Use model (or default if model is empty)
      const source = modeloList.length > 0 ? modeloList : CLAUSULAS_PADRAO;
      setClausulas(source.map(c => ({ ...c, id: undefined, is_customizada: false })));
    } else {
      setClausulas((contratoData as any[]).map(c => ({ ...c, is_customizada: c.is_customizada || false })));
    }
    setDirty(false);
    setLoading(false);
  };

  const handleChange = (idx: number, field: "titulo" | "texto", value: string) => {
    setClausulas(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const modeloItem = modelo.find(m => m.numero === c.numero);
      const isCustom = modeloItem
        ? (field === "titulo" ? value !== modeloItem.titulo : value !== modeloItem.texto) ||
          (field === "titulo" ? c.texto !== modeloItem.texto : c.titulo !== modeloItem.titulo)
        : true;
      return { ...c, [field]: value, is_customizada: isCustom };
    }));
    setDirty(true);
  };

  const restoreFromModelo = (idx: number) => {
    const clausula = clausulas[idx];
    const modeloItem = modelo.find(m => m.numero === clausula.numero);
    if (!modeloItem) return;
    setClausulas(prev => prev.map((c, i) =>
      i === idx ? { ...c, titulo: modeloItem.titulo, texto: modeloItem.texto, is_customizada: false } : c
    ));
    setDirty(true);
    toast({ title: "Cláusula restaurada", description: "O texto do modelo padrão foi aplicado." });
  };

  const applyFullModelo = () => {
    const source = modelo.length > 0 ? modelo : CLAUSULAS_PADRAO;
    setClausulas(source.map(c => ({ ...c, id: undefined, is_customizada: false })));
    setDirty(true);
    toast({ title: "Modelo aplicado", description: "Todas as cláusulas foram substituídas pelo modelo padrão." });
  };

  const handleSave = async () => {
    setSaving(true);

    // Delete existing
    await supabase.from("contratos_clausulas" as any).delete().eq("contrato_id", contratoId);

    const rows = clausulas.map((c, i) => ({
      contrato_id: contratoId,
      numero: i + 1,
      titulo: c.titulo,
      texto: c.texto,
      is_customizada: !!c.is_customizada,
    }));

    const { error } = await supabase.from("contratos_clausulas" as any).insert(rows);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cláusulas salvas!", description: "As cláusulas deste contrato foram atualizadas.", className: "border-success" });
      setDirty(false);
      loadClausulas();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando cláusulas...
      </div>
    );
  }

  const customCount = clausulas.filter(c => c.is_customizada).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/30 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>{clausulas.length} cláusulas</span>
          {customCount > 0 && (
            <Badge variant="outline" className="text-warning border-warning text-xs">
              {customCount} customizada{customCount > 1 ? "s" : ""}
            </Badge>
          )}
          {customCount === 0 && clausulas.length > 0 && (
            <Badge variant="outline" className="text-success border-success text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Modelo padrão
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={applyFullModelo}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Aplicar Modelo Global
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 text-xs text-warning font-medium">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Alterações não salvas neste contrato.
        </div>
      )}

      {/* Clause list */}
      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {clausulas.map((clausula, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-4 space-y-2 transition-colors ${
              clausula.is_customizada
                ? "border-warning/50 bg-warning/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shrink-0">
                {clausula.numero}
              </div>
              <input
                type="text"
                value={clausula.titulo}
                onChange={e => handleChange(idx, "titulo", e.target.value)}
                className="flex-1 text-sm font-bold bg-transparent border-0 border-b border-dashed border-border focus:border-primary focus:outline-none px-0 py-0.5 text-foreground"
              />
              {clausula.is_customizada && (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] text-warning border-warning px-1.5 py-0">
                    Customizada
                  </Badge>
                  <Button
                    variant="ghost" size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
                    onClick={() => restoreFromModelo(idx)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Restaurar
                  </Button>
                </div>
              )}
            </div>
            <Textarea
              value={clausula.texto}
              onChange={e => handleChange(idx, "texto", e.target.value)}
              rows={4}
              className="text-xs resize-y bg-background/50 leading-relaxed font-mono"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
