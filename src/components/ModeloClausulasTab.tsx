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
  RefreshCw, BookOpen, AlertCircle, CheckCircle2, Download
} from "lucide-react";
import { exportContractDocument } from "@/lib/contractExportUtils";

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
    "numero": 1,
    "titulo": "CLÁUSULA PRIMEIRA — OBJETO E LOCAL DE UTILIZAÇÃO",
    "texto": "É objeto do presente Contrato a locação de equipamento(s) para utilização conforme descrição abaixo, sem fornecimento de mão de obra, operador ou qualquer prestação de serviço pela LOCADORA.\n\nFica acordado entre as Partes que nos casos de contratos de locação por DIÁRIA, será garantido à LOCADORA um mínimo de diárias mensais de locação por veículo/equipamento, individualmente, e as diárias extras trabalhadas ou à disposição que excedam esse limite serão acrescidas e registradas em Boletim de Medição, aplicando-se os preços unitários por diária pactuados, assim como possíveis deduções previstas na Cláusula Quarta.\n\nNos meses de mobilização e desmobilização do equipamento o valor mensal a ser medido será proporcional ao número de dias úteis do equipamento à disposição da obra."
  },
  {
    "numero": 2,
    "titulo": "CLÁUSULA SEGUNDA — PRAZO, FRANQUIA MÍNIMA E RESILIÇÃO",
    "texto": "O prazo de vigência do presente Contrato será conforme acordado entre as Partes, podendo ser prorrogado automaticamente, por iguais e sucessivos períodos, até o limite máximo de 12 (doze) meses de vigência total, salvo manifestação expressa, formalizada por escrito, em sentido contrário por qualquer das partes, com antecedência mínima de 15 (quinze) dias do término de cada período de vigência.\n\nAté 15 (quinze) dias antes do término do prazo máximo de 12 (doze) meses, as partes poderão negociar e ajustar as novas condições comerciais, mediante celebração de aditivo contratual, com nova vigência e valores, mantendo-se todas as demais condições previamente pactuadas no contrato principal.\n\nCaso a LOCATÁRIA deseje reduzir o prazo ou suspender a locação do bem, objeto deste contrato, deverá formalmente comunicar, mediante aviso prévio de 15 (quinze) dias, à LOCADORA para que esta manifeste sua concordância. A suspensão indevida da locação pela LOCATÁRIA implicará em rescisão contratual antecipada, aplicando-se as penalidades respectivas, nos termos da Cláusula Vigésima Segunda."
  },
  {
    "numero": 3,
    "titulo": "CLÁUSULA TERCEIRA — PREÇOS, REAJUSTE E REEQUILÍBRIO",
    "texto": "O valor global estimado do presente Contrato é calculado conforme os valores unitários e prazos indicados. Este valor serve apenas como parâmetro orçamentário, não constituindo qualquer compromisso das Partes de virem a efetivamente utilizá-lo integralmente, sendo devido o montante referente ao período em que o equipamento estiver à disposição da LOCATÁRIA, observadas a franquia mínima e as premissas de medição estabelecidas neste instrumento.\n\n§1º. Os preços unitários pactuados serão fixos e irreajustáveis pelo prazo de 12 (doze) meses contados da assinatura. Prorrogado o Contrato por prazo superior, os valores serão reajustados pela variação acumulada do IPCA/IBGE no período ou, na sua falta, pelo IGP-M/FGV, mediante formalização de termo aditivo.\n\n§2º. Na hipótese de criação, majoração, extinção ou alteração de tributos, encargos ou obrigações legais que incidam sobre o objeto deste Contrato, inclusive em razão da transição prevista na Emenda Constitucional nº 132/2023 e na Lei Complementar nº 214/2025, as Partes promoverão, em até 15 (quinze) dias contados da vigência da alteração, a revisão dos preços para recomposição do equilíbrio econômico-financeiro original, mediante termo aditivo."
  },
  {
    "numero": 4,
    "titulo": "CLÁUSULA QUARTA — MEDIÇÃO",
    "texto": "Os boletins de medição serão elaborados mensalmente pela LOCADORA com base nas informações obtidas por meio da telemetria do equipamento, que prevalecerão em caso de divergência, e serão encaminhados à LOCATÁRIA por e-mail para os endereços indicados neste Contrato.\n\n§1º. A LOCATÁRIA terá o prazo de 5 (cinco) dias úteis, contados do envio, para manifestar eventual discordância, apresentando, obrigatoriamente, as evidências que comprovem a divergência. Decorrido o referido prazo sem manifestação, os boletins serão considerados aprovados, prosseguindo-se com o faturamento e o envio para pagamento.\n\n§2º. Na hipótese de falha ou indisponibilidade da telemetria, a medição será apurada pela leitura do horímetro do equipamento, cujo registro a LOCATÁRIA se obriga a enviar à LOCADORA até o dia 25 (vinte e cinco) de cada mês. Não enviado o registro, a medição do período será apurada pela média dos 2 (dois) últimos meses medidos ou pela franquia mínima contratada, prevalecendo o maior valor.\n\n§3º. A intervenção, remoção, desativação, obstrução ou alteração do sistema de telemetria ou de rastreamento implica a apuração da medição pela franquia mínima contratada, sem prejuízo das penalidades previstas na Cláusula Décima Oitava.\n\n§4º. Serão deduzidas das medições as horas em que o equipamento estiver parado para manutenções preventivas e/ou corretivas, por defeitos no equipamento ou por quaisquer outros aspectos de responsabilidade da LOCADORA que impeçam a operação efetiva do equipamento/veículo, exceto em caso de mau uso ou culpa da LOCATÁRIA, quando esta deverá arcar com os custos sem deduções na medição."
  },
  {
    "numero": 5,
    "titulo": "CLÁUSULA QUINTA — PAGAMENTOS",
    "texto": "Pela locação do bem objeto do presente Contrato, a LOCATÁRIA pagará à LOCADORA os valores unitários conforme prazo acordado entre as Partes, com vencimento a partir da aprovação do boletim de medição.\n\n§1º. Os pagamentos decorrentes deste Contrato deverão ser efetuados exclusivamente por meio de boleto bancário emitido pela LOCADORA.\n\n§2º. Em caso de atraso no pagamento de quaisquer valores devidos decorrentes deste Contrato, o montante em atraso será acrescido de multa moratória e não compensatória, além de juros de mora ao mês, calculados pro rata die, e correção monetária apurada pelo IGPM/FGV (ou índice oficial que venha a substituí-lo), calculados desde a data do vencimento até a data do efetivo pagamento.\n\n§3º. As informações sobre programações dos pagamentos e/ou comprovantes de pagamento deverão ser solicitadas à LOCADORA, através dos e-mails: alyson.oliveira@busatoloc.com.br, financeiro@busatotransportes.com.br, samara.rodrigues@busatoloc.com.br."
  },
  {
    "numero": 6,
    "titulo": "CLÁUSULA SEXTA — DAS OBRIGAÇÕES DA LOCADORA",
    "texto": "• [NOME/DADO]"
  },
  {
    "numero": 7,
    "titulo": "CLÁUSULA SÉTIMA — DAS OBRIGAÇÕES DA LOCATÁRIA",
    "texto": "• [NOME/DADO]"
  },
  {
    "numero": 8,
    "titulo": "CLÁUSULA OITAVA — DA ENTREGA, DA VISTORIA E DA DEVOLUÇÃO",
    "texto": "A entrega e a devolução do bem locado serão formalizadas por Termo de Vistoria, assinado por prepostos de ambas as Partes, acompanhado de registro fotográfico e da leitura do horímetro, na forma do Anexo I, que integra este Contrato para todos os fins.\n\n§1º. A ausência ou a recusa injustificada de preposto da LOCATÁRIA à vistoria autoriza a LOCADORA a realizá-la unilateralmente, mediante laudo com registro fotográfico, presumindo-se verdadeiro o estado nele consignado.\n\n§2º. A LOCATÁRIA receberá o bem locado em condições normais de uso e assim o manterá até a sua efetiva devolução, ressalvados os desgastes naturais, não podendo realizar qualquer modificação no veículo/equipamento locado sem a prévia e expressa autorização da LOCADORA.\n\n§3º. Considera-se desgaste natural exclusivamente aquele decorrente do uso regular do equipamento dentro das especificações do fabricante. Não se enquadram nesse conceito amassados, trincas, rupturas, empenamentos, perda de componentes, danos a pneus e ao material rodante por corte, impacto ou uso indevido, nem danos elétricos, hidráulicos ou de motor decorrentes de operação inadequada, falta de lubrificação, sobrecarga ou superaquecimento.\n\n§4º. Findo o prazo estabelecido, ou rescindida a locação por qualquer motivo, a LOCATÁRIA restituirá o bem locado à LOCADORA em até 5 (cinco) dias úteis, no pátio da LOCADORA ou em local por ela indicado, com o mesmo nível de combustível da entrega e em condições de limpeza que permitam a vistoria.\n\n§5º. Não devolvido o bem no prazo do parágrafo anterior, incidirá, por dia de atraso e por equipamento, diária equivalente a 1/30 (um trinta avos) do valor mensal contratado, sem prejuízo das perdas e danos e das medidas possessórias e criminais cabíveis.\n\n§6º. Constatados danos na vistoria de devolução, a LOCADORA apresentará orçamento em até 10 (dez) dias úteis, que a LOCATÁRIA deverá quitar em 10 (dez) dias contados do recebimento, facultada à LOCADORA a realização do reparo em oficina de sua escolha, respondendo ainda a LOCATÁRIA pelo valor da locação correspondente ao período de indisponibilidade do equipamento em reparo."
  },
  {
    "numero": 9,
    "titulo": "CLÁUSULA NONA — DOS SEGUROS",
    "texto": "A contratação do seguro do bem locado, em companhia seguradora de idoneidade reconhecida, para cobertura de danos materiais e pessoais a terceiros e para cobrir os gastos em decorrência de acidente envolvendo o bem, ficará a cargo da LOCADORA, sendo que o custo do prêmio e da franquia será suportado conforme negociação comercial entre as Partes.\n\n§1º. A LOCADORA se compromete a enviar a apólice do veículo/equipamento locado após a assinatura do presente Contrato, a qual integra este instrumento como Anexo III.\n\n§2º. Acionado o seguro em decorrência de sinistro causado durante a utilização do bem pela LOCATÁRIA, esta ficará responsável pelo pagamento integral da franquia, conforme apólice, pela participação obrigatória no aviso de sinistro e pelo fornecimento de toda a documentação exigida pela seguradora, no prazo por esta estipulado.\n\n§3º. A LOCATÁRIA declara ciência de que a apólice pode não cobrir determinados eventos, entre eles operação fora de via pública, tombamento, capotamento, submersão, danos ao material rodante, uso por condutor ou operador não habilitado, condução sob efeito de álcool ou substância psicoativa, agravamento de risco e uso em local diverso do contratado.\n\n§4º. A LOCATÁRIA manterá, durante toda a vigência, seguro de responsabilidade civil que cubra danos a terceiros decorrentes da operação do equipamento, comprovando a apólice à LOCADORA sempre que solicitado.\n\n§5º. Em caso de acidente, furto, roubo ou qualquer sinistro, a LOCATÁRIA comunicará a LOCADORA imediatamente e registrará o boletim de ocorrência em até 24 (vinte e quatro) horas, entregando cópia à LOCADORA."
  },
  {
    "numero": 10,
    "titulo": "CLÁUSULA DÉCIMA — DOS DANOS, DA PERDA, DO FURTO E DO ROUBO",
    "texto": "A LOCATÁRIA é depositária do bem locado e responde por sua guarda e conservação durante todo o período da locação, respondendo integralmente por danos, perda total, furto, roubo, apropriação indébita e quaisquer eventos que atinjam o equipamento.\n\n§1º. Na hipótese de não ser possível acionar o seguro vigente, ou em caso de recusa de cobertura por parte da seguradora devido a dolo, culpa, negligência, imperícia, imprudência, mau uso ou agravamento de risco por parte da LOCATÁRIA ou de seus prepostos, a LOCATÁRIA será integral e exclusivamente responsável pelo pagamento de todas as perdas e danos.\n\n§2º. Na hipótese do parágrafo anterior, a LOCATÁRIA ressarcirá à LOCADORA o valor correspondente a 100% (cem por cento) do valor de mercado para reposição do equipamento sinistrado, apurado pela tabela do fabricante ou por laudo de avaliação, ou arcará com os custos totais e integrais dos reparos necessários, sem prejuízo da cobrança do valor da locação pelos dias em que o equipamento ficar inoperante, até a efetiva reposição ou conclusão do reparo.\n\n§3º. Os valores previstos nesta cláusula serão pagos em até 10 (dez) dias contados da apresentação do orçamento, do laudo ou da negativa da seguradora, o que ocorrer por último."
  },
  {
    "numero": 11,
    "titulo": "CLÁUSULA DÉCIMA PRIMEIRA — DA RESPONSABILIDADE PERANTE TERCEIROS E DO DIREITO DE REGRESSO",
    "texto": "A LOCATÁRIA será integral e exclusivamente responsável pela posse, guarda, condução, operação e uso dos veículos/equipamentos locados, incluindo a observância das normas de trânsito, de segurança e das legislações aplicáveis.\n\n§1º. A responsabilidade da LOCATÁRIA abrange todas as ações ou omissões praticadas por seus motoristas, operadores, empregados, prepostos ou qualquer outra pessoa que utilizar os veículos/equipamentos, sendo de sua inteira responsabilidade quaisquer danos causados a terceiros, danos ambientais, multas, infrações, perdas, acidentes de trânsito, furtos, roubos ou quaisquer outros eventos relacionados ao uso dos bens locados.\n\n§2º. As Partes reconhecem que a estipulação prevista nesta cláusula produz efeitos entre elas, não sendo oponível a terceiros estranhos a este Contrato. Acionada a LOCADORA, judicial ou administrativamente, em razão de evento ocorrido na vigência da locação, a LOCATÁRIA obriga-se a assumir o polo passivo da demanda ou a integrar a lide, a apresentar defesa às suas expensas e a reembolsar integralmente a LOCADORA de todo valor que esta venha a desembolsar a título de condenação, acordo, custas, despesas processuais e honorários, independentemente do resultado do processo.\n\n§3º. O reembolso dos honorários advocatícios contratuais da LOCADORA observará o valor do percentual de 5% sobre o valor envolvido, conforme acordado entre as Partes, comprovado por relatório de atividades, abrangendo a elaboração de petições, os deslocamentos para audiências e as demais despesas judiciais e administrativas.\n\n§4º. A LOCATÁRIA comunicará a LOCADORA em até 48 (quarenta e oito) horas de qualquer acidente, notificação, autuação, reclamação ou citação relacionada ao bem locado, sob pena de responder pelas consequências da perda de prazo."
  },
  {
    "numero": 12,
    "titulo": "CLÁUSULA DÉCIMA SEGUNDA — DAS INFRAÇÕES DE TRÂNSITO",
    "texto": "As infrações de trânsito e as penalidades administrativas praticadas durante a vigência deste Contrato são de responsabilidade exclusiva da LOCATÁRIA, que responderá pelo valor das multas, juros, encargos e despesas correlatas.\n\n§1º. Recebida da LOCADORA a comunicação da autuação, a LOCATÁRIA fornecerá, em até 10 (dez) dias corridos, os dados e a documentação do condutor infrator, com a assinatura dos formulários necessários à indicação prevista no art. 257, §7º, do Código de Trânsito Brasileiro.\n\n§2º. Descumprido o prazo do parágrafo anterior, a LOCATÁRIA responderá integralmente pela multa aplicada ao proprietário do veículo na forma do art. 257, §8º, do Código de Trânsito Brasileiro, bem como pelos custos de defesa e de recursos administrativos.\n\n§3º. Os valores das multas poderão ser descontados da garantia prestada ou cobrados diretamente da LOCATÁRIA, a critério da LOCADORA."
  },
  {
    "numero": 13,
    "titulo": "CLÁUSULA DÉCIMA TERCEIRA — DA RESPONSABILIDADE TRABALHISTA",
    "texto": "A locação não envolve fornecimento de mão de obra, não se estabelecendo qualquer vínculo empregatício, de subordinação ou de prestação de serviços entre a LOCADORA e os empregados ou prepostos da LOCATÁRIA.\n\n§1º. A LOCATÁRIA obriga-se a designar para a operação do equipamento profissional habilitado, capacitado e treinado na forma das normas regulamentadoras aplicáveis, entre elas a NR-11, a NR-12 e a NR-18, mantendo em dia ordem de serviço, certificados de treinamento, exames ocupacionais e fornecimento de equipamentos de proteção individual.\n\n§2º. A LOCATÁRIA responde por todos os encargos trabalhistas, previdenciários, fiscais e securitários de seus empregados e prepostos, bem como por acidentes do trabalho ocorrido na operação do equipamento.\n\n§3º. A LOCATÁRIA obriga-se a reembolsar a LOCADORA de qualquer valor que esta venha a suportar em razão de reclamação trabalhista, ação indenizatória por acidente do trabalho ou autuação administrativa decorrente da execução deste Contrato, inclusive honorários advocatícios, custas e despesas processuais."
  },
  {
    "numero": 14,
    "titulo": "CLÁUSULA DÉCIMA QUARTA — DA RESPONSABILIDADE AMBIENTAL",
    "texto": "A LOCATÁRIA responde integralmente por danos ambientais decorrentes da operação do bem locado, entre eles vazamento de óleo, derramamento de combustível e contaminação de solo e de corpos d'água, obrigando-se a manter no local kit de contenção de emergência e a comunicar imediatamente à LOCADORA e aos órgãos competentes qualquer ocorrência.\n\nParágrafo único. Acionada a LOCADORA, na condição de proprietária do equipamento, por órgão ambiental, em ação civil pública ou em qualquer outra medida, a LOCATÁRIA a reembolsará integralmente de multas, custos de remediação, condenações, despesas processuais e honorários, sem prejuízo da rescisão imediata do Contrato."
  },
  {
    "numero": 15,
    "titulo": "CLÁUSULA DÉCIMA QUINTA — DA LIMITAÇÃO DE RESPONSABILIDADE DA LOCADORA",
    "texto": "A LOCADORA responde exclusivamente pela disponibilização do bem locado em condições de uso e pela manutenção preventiva prevista neste Contrato, não respondendo, em nenhuma hipótese, por lucros cessantes, perda de produtividade, atraso de cronograma, penalidades contratuais aplicadas por terceiros à LOCATÁRIA ou quaisquer danos indiretos decorrentes da indisponibilidade do equipamento.\n\nParágrafo único. O prazo de substituição do equipamento previsto na Cláusula Sétima fica suspenso nas hipóteses de caso fortuito, força maior, indisponibilidade de frota, greve, restrição ao transporte de carga especial ou impedimento de acesso ao canteiro, e a responsabilidade da LOCADORA, em qualquer caso, fica limitada ao valor proporcional da locação correspondente ao período de indisponibilidade."
  },
  {
    "numero": 16,
    "titulo": "CLÁUSULA DÉCIMA SEXTA — DA FISCALIZAÇÃO",
    "texto": "A LOCADORA poderá fiscalizar a boa utilização do veículo/equipamento pela LOCATÁRIA, inclusive mediante inspeção no local da obra, mediante comunicação prévia, e em caso de constatar qualquer irregularidade na utilização do mesmo, a LOCATÁRIA deve providenciar a regularização imediata, sob pena de rescisão."
  },
  {
    "numero": 17,
    "titulo": "CLÁUSULA DÉCIMA SÉTIMA — DO GRAVAME",
    "texto": "Sendo a LOCADORA legítima proprietária ou possuidora do bem locado, a LOCATÁRIA não poderá dá-lo em penhor, caução ou gravá-lo a favor de terceiros, nem oferecê-lo à penhora, obrigando-se a informar imediatamente à LOCADORA qualquer constrição judicial que recaia sobre o bem."
  },
  {
    "numero": 18,
    "titulo": "CLÁUSULA DÉCIMA OITAVA — DAS PENALIDADES",
    "texto": "O descumprimento de qualquer cláusula ou condição pactuada neste instrumento sujeita a parte infratora à multa não compensatória equivalente a 1 (uma) franquia mensal mínima por equipamento envolvido, sem prejuízo da reparação integral das perdas e danos, dos lucros cessantes e da faculdade de rescisão imediata do Contrato pela parte inocente.\n\nParágrafo único. A multa prevista nesta cláusula não se confunde com a multa moratória e os juros incidentes sobre o atraso de pagamento, previstos na Cláusula Quinta, nem com as indenizações e os reembolsos previstos nas Cláusulas Décima, Décima Primeira, Décima Segunda, Décima Quarta e Décima Quinta, que com ela são cumuláveis."
  },
  {
    "numero": 19,
    "titulo": "CLÁUSULA DÉCIMA NONA — DO INADIMPLEMENTO, DO VENCIMENTO ANTECIPADO, DA RESCISÃO E DA RETOMADA DO BEM",
    "texto": "O atraso superior a 15 (quinze) dias no pagamento de qualquer valor, a insuficiência ou a não recomposição da garantia, o deslocamento não autorizado do equipamento, a sublocação, a cessão do contrato sem anuência, o pedido de recuperação judicial ou a falência da LOCATÁRIA autorizam a LOCADORA a declarar o vencimento antecipado das obrigações e a rescindir o Contrato de pleno direito, independentemente de notificação judicial, nos termos do art. 474 do Código Civil.\n\n§1º. Rescindido o Contrato por qualquer motivo, a LOCATÁRIA restituirá o bem em até 48 (quarenta e oito) horas e, desde já, autoriza expressamente a LOCADORA, seus prepostos e a empresa de transporte por ela contratada a ingressar no local onde o equipamento estiver, em horário comercial, para promover a retirada, sem que isso configure turbação ou esbulho.\n\n§2º. A recusa de devolução sujeita a LOCATÁRIA à diária prevista na Cláusula Oitava e às medidas possessórias cabíveis, sem prejuízo das providências criminais em caso de apropriação indébita."
  },
  {
    "numero": 20,
    "titulo": "CLÁUSULA VIGÉSIMA — DO CASO FORTUITO E DA FORÇA MAIOR",
    "texto": "Nenhuma das Partes responderá pelo descumprimento de obrigação que decorra exclusivamente de caso fortuito ou de força maior, nos termos do art. 393 do Código Civil, devendo a parte afetada comunicar a outra em até 5 (cinco) dias contados do evento.\n\nParágrafo único. A ocorrência não afasta o pagamento dos valores devidos pelo período em que o equipamento esteve à disposição da LOCATÁRIA, nem a responsabilidade desta pela guarda do bem."
  },
  {
    "numero": 21,
    "titulo": "CLÁUSULA VIGÉSIMA PRIMEIRA — DA PROTEÇÃO DE DADOS E DA TELEMETRIA",
    "texto": "As Partes declaram-se cientes dos direitos, obrigações e penalidades aplicáveis constantes da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018) e obrigam-se a adotar todas as medidas de segurança, técnicas, organizacionais e administrativas para garantir, por si, bem como por seu pessoal, colaboradores, empregados e subcontratados, o cumprimento da referida legislação.\n\n§1º. A LOCATÁRIA declara ciência de que o bem locado possui sistema de telemetria e de rastreamento, operado pela LOCADORA na condição de controladora, com as finalidades de medição das horas contratadas, proteção patrimonial, gestão de manutenção e cumprimento de obrigações legais e contratuais, fundado na execução do contrato e no legítimo interesse, nos termos do art. 7º, incisos V e IX, da Lei nº 13.709/2018.\n\n§2º. A LOCATÁRIA obriga-se a informar seus empregados e prepostos sobre o monitoramento, respondendo perante a LOCADORA por eventual omissão, e a não intervir, remover, desativar ou alterar o sistema instalado."
  },
  {
    "numero": 22,
    "titulo": "CLÁUSULA VIGÉSIMA SEGUNDA — DO COMPLIANCE E DA CONDUTA EMPRESARIAL",
    "texto": "As Partes declaram que conhecem e observam a Lei nº 12.846/2013 e a legislação anticorrupção aplicável, bem como a legislação trabalhista, ambiental e de segurança do trabalho, obrigando-se a não empregar trabalho infantil, trabalho forçado ou em condições análogas à de escravo, e a não praticar qualquer ato lesivo à administração pública em razão deste Contrato.\n\nParágrafo único. A violação comprovada do disposto nesta cláusula autoriza a rescisão imediata do Contrato, sem prejuízo das perdas e danos e das penalidades previstas."
  },
  {
    "numero": 23,
    "titulo": "CLÁUSULA VIGÉSIMA TERCEIRA — DAS DISPOSIÇÕES GERAIS",
    "texto": "Os signatários do presente Contrato asseguram e afirmam que são os representantes legais competentes para assumir em nome das partes as obrigações descritas neste instrumento.\n\nA LOCATÁRIA não poderá, em hipótese alguma, transferir ou delegar as atribuições e responsabilidades que assume por força deste Contrato, a não ser com prévia concordância da LOCADORA.\n\nAs Partes são contratantes totalmente independentes, sendo cada uma inteiramente responsável por seus atos, obrigações e conteúdo das informações prestadas, em toda e qualquer circunstância.\n\nO não exercício por qualquer das partes de direitos ou faculdades que lhe assistam em decorrência do presente instrumento não afetará aqueles direitos ou faculdades, os quais poderão ser exercidos a qualquer tempo.\n\nEste Contrato somente poderá ser alterado mediante formalização de Termo Aditivo assinado por ambas as Partes.\n\nIntegram este Contrato, para todos os fins, o Anexo I — Termo de Vistoria de Entrega e Devolução, o Anexo II — proposta comercial e quadro de equipamentos, e o Anexo III — apólice de seguro vigente.\n\nEste Contrato constitui título executivo extrajudicial, nos termos do art. 784, inciso III, do Código de Processo Civil, sendo admitida a assinatura eletrônica em qualquer das modalidades previstas em lei, dispensada a assinatura de testemunhas quando a integridade do documento for conferida por provedor de assinatura, na forma do art. 784, §4º, do mesmo Código."
  },
  {
    "numero": 24,
    "titulo": "CLÁUSULA VIGÉSIMA QUARTA — DO FORO",
    "texto": "Fica eleito o foro da Comarca da Serra, Estado do Espírito Santo, com renúncia expressa a qualquer outro, por mais privilegiado que seja, para dirimir as controvérsias oriundas deste Contrato.\n\nE, por estarem justas e contratadas, as Partes assinam o presente instrumento, em via eletrônica ou em 2 (duas) vias de igual teor e forma, na presença de 2 (duas) testemunhas."
  }
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
          <Button variant="outline" size="sm" onClick={() => exportContractDocument(null, clausulas, true)}>
            <Download className="h-4 w-4 mr-2" /> PDF do Modelo
          </Button>
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
  contrato?: any;
}

export const ContratoClausulasTab = ({ contratoId, contrato }: ContratoClausulasTabProps) => {
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
          {contrato && (
            <Button variant="outline" size="sm" onClick={() => exportContractDocument(contrato, clausulas, false)} className="border-primary text-primary hover:bg-primary/5">
              <Download className="h-4 w-4 mr-1.5" /> Contrato PDF
            </Button>
          )}
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
