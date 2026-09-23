import { parseLocalDate } from "@/lib/utils";

let logoCache: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (logoCache) return logoCache;
  try {
    const resp = await fetch("/images/logo-busato-horizontal.png");
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoCache = reader.result as string;
        resolve(logoCache);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Helpers for Portuguese numbers in words (extenso)
function dayToExtenso(dStr: string): string {
  const d = parseInt(dStr, 10);
  const map: Record<number, string> = {
    1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco", 6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
    11: "onze", 12: "doze", 13: "treze", 14: "catorze", 15: "quinze", 16: "dezesseis", 17: "dezessete", 18: "dezoito", 19: "dezenove", 20: "vinte",
    21: "vinte e um", 22: "vinte e dois", 23: "vinte e três", 24: "vinte e quatro", 25: "vinte e cinco", 26: "vinte e seis", 27: "vinte e sete", 28: "vinte e oito", 29: "vinte e nove", 30: "trinta", 31: "trinta e um"
  };
  return map[d] || dStr;
}

function integerToExtenso(n: number): string {
  if (n === 0) return "zero";
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dezenasEspecial = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  if (n === 100) return "cem";

  let parts: string[] = [];

  const c = Math.floor(n / 100);
  const r1 = n % 100;
  const d = Math.floor(r1 / 10);
  const u = r1 % 10;

  if (c > 0) {
    parts.push(centenas[c]);
  }

  if (r1 > 0) {
    if (c > 0) parts.push("e");
    if (r1 >= 10 && r1 < 20) {
      parts.push(dezenasEspecial[r1 - 10]);
    } else {
      if (d > 0) {
        parts.push(dezenas[d]);
        if (u > 0) {
          parts.push("e");
          parts.push(unidades[u]);
        }
      } else if (u > 0) {
        parts.push(unidades[u]);
      }
    }
  }

  return parts.join(" ");
}

function percentToExtenso(p: number): string {
  const integerPart = Math.floor(p);
  const decimalPart = Math.round((p - integerPart) * 100);

  const intWords = integerToExtenso(integerPart);
  if (decimalPart === 0) {
    return `${intWords} por cento`;
  } else {
    const decWords = integerToExtenso(decimalPart);
    return `${intWords} vírgula ${decWords} por cento`;
  }
}

function converterNumeroParaExtenso(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dezenasEspecial = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  if (n < 10) return unidades[n];
  if (n >= 10 && n < 20) return dezenasEspecial[n - 10];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return dezenas[d] + (u > 0 ? " e " + unidades[u] : "");
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const rest = n % 100;
    return centenas[c] + (rest > 0 ? " e " + converterNumeroParaExtenso(rest) : "");
  }
  if (n < 1000000) {
    const mil = Math.floor(n / 1000);
    const rest = n % 1000;
    let milText = "";
    if (mil === 1) {
      milText = "mil";
    } else {
      milText = converterNumeroParaExtenso(mil) + " mil";
    }
    if (rest === 0) return milText;
    const separator = (rest < 100 || rest % 100 === 0) ? " e " : " ";
    return milText + separator + converterNumeroParaExtenso(rest);
  }
  if (n < 1000000000) {
    const milhao = Math.floor(n / 1000000);
    const rest = n % 1000000;
    let milhaoText = "";
    if (milhao === 1) {
      milhaoText = "um milhão";
    } else {
      milhaoText = converterNumeroParaExtenso(milhao) + " milhões";
    }
    if (rest === 0) return milhaoText;
    const separator = (rest < 100 || rest % 100 === 0) ? " e " : " ";
    return milhaoText + separator + converterNumeroParaExtenso(rest);
  }
  return String(n);
}

function valorExtenso(valor: number): string {
  const valorArredondado = Math.round(valor * 100) / 100;
  if (valorArredondado === 0) return "zero reais";
  
  const inteira = Math.floor(valorArredondado);
  const centavos = Math.round((valorArredondado - inteira) * 100);
  
  let partes: string[] = [];
  
  if (inteira > 0) {
    partes.push(converterNumeroParaExtenso(inteira) + (inteira === 1 ? " real" : " reais"));
  }
  
  if (centavos > 0) {
    partes.push(converterNumeroParaExtenso(centavos) + (centavos === 1 ? " centavo" : " centavos"));
  }
  
  return partes.join(" e ");
}

export const generateContratoPDF = async (params: {
  empresa: any;
  equipamentos: {
    equipamento_tipo: string; // Used as the model/identification text
    quantidade: number;
    valor_hora: number;
    franquia_mensal: number;
    numero_serie: string;     // Explicit serial number
    valor_mensal: number;
  }[];
  data_inicio: string;
  data_fim: string;
  testemunhas: { nome1: string; cpf1: string; nome2: string; cpf2: string };
  numero_proposta: string;
  dia_inicio_medicao: string;
  dia_fim_medicao: string;
  prazo_pagamento_dias: number;
  multa_atraso_percent: number;
  juros_atraso_percent: number;
  tipo_medicao?: string;
}) => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pw - margin * 2;

  const brandBlue: [number, number, number] = [41, 128, 185];
  const darkGray: [number, number, number] = [30, 30, 30];
  const medGray: [number, number, number] = [60, 60, 60];
  const lightGray: [number, number, number] = [140, 140, 140];

  const logo = await loadLogo();

  const addHeader = () => {
    if (logo) {
      doc.addImage(logo, "PNG", margin, 10, 48, 12);
    }
  };

  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...lightGray);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(margin, ph - 15, pw - margin, ph - 15);
    doc.text("BUSATO LOCAÇÕES E SERVIÇOS LTDA  •  CNPJ: 54.167.719/0001-40", margin, ph - 10);
    doc.text(`Página ${pageNum} de ${totalPages}`, pw - margin, ph - 10, { align: "right" });
  };

  addHeader();

  let y = 35;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > ph - 22) {
      doc.addPage();
      addHeader();
      y = 30;
    }
  };

  const printParagraph = (text: string, isTitle = false, spacing = 5, alignment: "left" | "justify" = "justify") => {
    doc.setFont("helvetica", isTitle ? "bold" : "normal");
    doc.setFontSize(isTitle ? 10 : 9.5);
    doc.setTextColor(...(isTitle ? darkGray : medGray));
    
    const lines = doc.splitTextToSize(text, contentW);
    const needed = lines.length * 4.5 + spacing;
    checkPageBreak(needed);
    
    if (alignment === "justify" && !isTitle) {
      doc.text(text, margin, y, { align: "justify", maxWidth: contentW });
    } else {
      doc.text(lines, margin, y);
    }
    y += lines.length * 4.5 + spacing;
  };

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...brandBlue);
  const titleLines = doc.splitTextToSize("CONTRATO DE LOCAÇÃO DE VEÍCULO / EQUIPAMENTO SEM UTILIZAÇÃO DE MÃO DE OBRA", contentW - 55);
  doc.text(titleLines, margin + 55, 15);

  doc.setDrawColor(...brandBlue);
  doc.setLineWidth(0.8);
  doc.line(margin, 28, pw - margin, 28);
  y = 35;

  // Parts
  printParagraph("De um lado, como Locadora,", true, 3);
  printParagraph("BUSATO LOCAÇÕES E SERVIÇOS LTDA., empresa estabelecida na Av. Nossa Senhora da Penha, 595, Sala 510, Santa Lúcia, Vitória/ES, CEP 29.056-250, inscrita no CNPJ sob o nº 54.167.719/0001-40, neste ato denominada simplesmente Locadora.", false, 5);

  printParagraph("De outro lado, como Locatária,", true, 3);
  const obraSuffix = params.empresa?.obra ? ` (Obra: ${params.empresa.obra})` : "";
  const locatariaNome = `${params.empresa?.razao_social || params.empresa?.nome || "LOCATÁRIA"}${obraSuffix}`;
  const locatariaCnpj = params.empresa?.cnpj || "—";
  const locatariaEnd = [params.empresa?.endereco_logradouro, params.empresa?.endereco_numero, params.empresa?.endereco_complemento, params.empresa?.endereco_bairro, params.empresa?.endereco_cidade, params.empresa?.endereco_uf].filter(Boolean).join(", ") || "—";
  printParagraph(`${locatariaNome}, empresa estabelecida à ${locatariaEnd}, inscrita no CNPJ sob o nº ${locatariaCnpj}, neste ato denominada simplesmente Locatária.`, false, 8);

  printParagraph("Resolvem celebrar o presente Contrato de Locação de Veículo / Equipamento, doravante denominado \"Contrato\", mediante as seguintes cláusulas e condições:", false, 10);

  // ─── CLÁUSULA PRIMEIRA — OBJETO E LOCAL DE UTILIZAÇÃO ───────────────────────
  printParagraph("CLÁUSULA PRIMEIRA — OBJETO E LOCAL DE UTILIZAÇÃO", true, 4);
  const isDiaria = params.tipo_medicao === "diarias";
  const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  printParagraph("É objeto do presente Contrato a locação de equipamento(s) para utilização conforme descrição abaixo, sem fornecimento de mão de obra, operador ou qualquer prestação de serviço pela LOCADORA.", false, 5);

  if (isDiaria) {
    printParagraph("Fica acordado entre as Partes que nos casos de contratos de locação por DIÁRIA, será garantido à LOCADORA um mínimo de diárias mensais de locação por veículo/equipamento, individualmente, e as diárias extras trabalhadas ou à disposição que excedam esse limite serão acrescidas e registradas em Boletim de Medição, aplicando-se os preços unitários por diária pactuados, assim como possíveis deduções previstas na Cláusula Quarta.", false, 5);
  } else {
    printParagraph("Fica acordado entre as Partes que nos casos de contratos de locação por HORA, será garantido à LOCADORA um mínimo de horas mensais de locação por veículo/equipamento, individualmente, e as horas extras trabalhadas ou à disposição que excedam esse limite serão acrescidas e registradas em Boletim de Medição, aplicando-se os preços unitários por hora pactuados, assim como possíveis deduções previstas na Cláusula Quarta.", false, 5);
  }

  printParagraph("Nos meses de mobilização e desmobilização do equipamento o valor mensal a ser medido será proporcional ao número de dias úteis do equipamento à disposição da obra.", false, 6);

  // Equipment table
  const franquiaUnidade = isDiaria ? "DIÁRIAS" : "HORAS";
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["ITEM", "EQUIPAMENTO", "CHASSIS / SÉRIE", `FRANQUIA MENSAL ${franquiaUnidade}`, isDiaria ? "VALOR DIÁRIA" : "VALOR HORA", "VALOR TOTAL EQUIPAMENTO"]],
    body: params.equipamentos.map((eq, i) => [
      String(i + 1).padStart(2, "0"),
      eq.equipamento_tipo,
      eq.numero_serie || "—",
      eq.franquia_mensal ? `${eq.franquia_mensal} ${franquiaUnidade}` : "—",
      fmtBRL(eq.valor_hora),
      fmtBRL(eq.valor_mensal),
    ]),
    styles: { fontSize: 8, cellPadding: 3, textColor: darkGray },
    headStyles: { fillColor: brandBlue, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    theme: "striped",
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  printParagraph("§1º. O(s) equipamento(s) será(ão) utilizado(s) exclusivamente na obra/local indicado neste Contrato, sendo vedado o deslocamento para local diverso, ainda que de propriedade ou posse da LOCATÁRIA, sem prévia e expressa autorização escrita da LOCADORA.", false, 5);
  printParagraph("§2º. O deslocamento não autorizado caracteriza agravamento de risco, autoriza a rescisão imediata do Contrato e a retomada do bem e transfere à LOCATÁRIA a responsabilidade integral por qualquer sinistro ocorrido fora do local contratado, inclusive na hipótese de recusa de cobertura pela seguradora.", false, 5);
  printParagraph("§3º. Os implementos e as características adicionais ao equipamento/veículo deverão ser negociados entre as Partes previamente à saída do equipamento do pátio da LOCADORA.", false, 8);

  // ─── CLÁUSULA SEGUNDA — PRAZO, FRANQUIA MÍNIMA E RESILIÇÃO ──────────────────
  printParagraph("CLÁUSULA SEGUNDA — PRAZO, FRANQUIA MÍNIMA E RESILIÇÃO", true, 4);
  const dtInicio = parseLocalDate(params.data_inicio).toLocaleDateString("pt-BR");
  const dtFim = parseLocalDate(params.data_fim).toLocaleDateString("pt-BR");
  const diffMs = Math.abs(new Date(params.data_fim).getTime() - new Date(params.data_inicio).getTime());
  const diffMonths = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30)));
  const diffMonthsExtenso = integerToExtenso(diffMonths);
  printParagraph(`O prazo de vigência do presente Contrato será de ${diffMonths} (${diffMonthsExtenso}) meses, com início em ${dtInicio} e término em ${dtFim}, encerrando-se automaticamente ao final desse período, independentemente de aviso ou notificação.`, false, 5);
  printParagraph("§1º. O Contrato poderá ser prorrogado mediante anuência expressa de ambas as Partes, formalizada por escrito antes do término de sua vigência, por meio de termo aditivo, no qual serão estabelecidos o novo prazo e, se aplicável, as demais condições da prorrogação.", false, 5);
  printParagraph("§2º. A franquia mensal mínima de horas por equipamento é devida integralmente em cada mês de vigência, ainda que a utilização seja inferior, ressalvadas apenas as deduções previstas na Cláusula Quarta e os meses de mobilização e desmobilização, em que o valor será proporcional aos dias úteis de disponibilização.", false, 5);
  printParagraph("§3º. A LOCATÁRIA poderá resilir unilateralmente o presente Contrato mediante comunicação escrita à LOCADORA com antecedência mínima de 30 (trinta) dias corridos, respondendo pelos valores devidos até a efetiva devolução do bem, observada, em qualquer caso, a franquia mínima do período, inclusive durante o prazo de aviso prévio.", false, 5);
  printParagraph("§4º. Não observado o aviso prévio previsto no parágrafo anterior, será devida multa equivalente a 1 (uma) franquia mensal mínima por equipamento, sem prejuízo dos valores em aberto e das perdas e danos comprovadas.", false, 8);

  // ─── CLÁUSULA TERCEIRA — PREÇOS, REAJUSTE E REEQUILÍBRIO ────────────────────
  printParagraph("CLÁUSULA TERCEIRA — PREÇOS, REAJUSTE E REEQUILÍBRIO", true, 4);
  const valorTotalMensal = params.equipamentos.reduce((sum, e) => sum + e.valor_mensal, 0);
  const valorGlobalEstimado = valorTotalMensal * diffMonths;
  const valorGlobalExt = valorExtenso(valorGlobalEstimado);
  printParagraph(`O valor global estimado do presente Contrato é de ${fmtBRL(valorGlobalEstimado)} (${valorGlobalExt}), calculado conforme os valores unitários e prazos indicados. Este valor serve apenas como parâmetro orçamentário, não constituindo qualquer compromisso das Partes de virem a efetivamente utilizá-lo integralmente, sendo devido o montante referente ao período em que o equipamento estiver à disposição da LOCATÁRIA, observadas a franquia mínima e as premissas de medição estabelecidas neste instrumento.`, false, 5);
  printParagraph("§1º. Os preços unitários pactuados serão fixos e irreajustáveis pelo prazo de 12 (doze) meses contados da assinatura. Prorrogado o Contrato por prazo superior, os valores serão reajustados pela variação acumulada do IPCA/IBGE no período ou, na sua falta, pelo IGP-M/FGV, mediante formalização de termo aditivo.", false, 5);
  printParagraph("§2º. Na hipótese de criação, majoração, extinção ou alteração de tributos, encargos ou obrigações legais que incidam sobre o objeto deste Contrato, inclusive em razão da transição prevista na Emenda Constitucional nº 132/2023 e na Lei Complementar nº 214/2025, as Partes promoverão, em até 15 (quinze) dias contados da vigência da alteração, a revisão dos preços para recomposição do equilíbrio econômico-financeiro original, mediante termo aditivo.", false, 8);

  // ─── CLÁUSULA QUARTA — MEDIÇÃO ───────────────────────────────────────────────
  printParagraph("CLÁUSULA QUARTA — MEDIÇÃO", true, 4);
  const diaMedFim = parseInt(params.dia_fim_medicao || "25", 10);
  printParagraph("Os boletins de medição serão elaborados mensalmente pela LOCADORA com base nas informações obtidas por meio da telemetria do equipamento, que prevalecerão em caso de divergência, e serão encaminhados à LOCATÁRIA por e-mail para os endereços indicados neste Contrato.", false, 5);
  printParagraph("§1º. A LOCATÁRIA terá o prazo de 5 (cinco) dias úteis, contados do envio, para manifestar eventual discordância, apresentando, obrigatoriamente, as evidências que comprovem a divergência. Decorrido o referido prazo sem manifestação, os boletins serão considerados aprovados, prosseguindo-se com o faturamento e o envio para pagamento.", false, 5);
  printParagraph(`§2º. Na hipótese de falha ou indisponibilidade da telemetria, a medição será apurada pela leitura do horímetro do equipamento, cujo registro a LOCATÁRIA se obriga a enviar à LOCADORA até o dia ${diaMedFim} (${dayToExtenso(String(diaMedFim))} e ${diaMedFim < 30 ? "" : "trinta"}) de cada mês. Não enviado o registro, a medição do período será apurada pela média dos 2 (dois) últimos meses medidos ou pela franquia mínima contratada, prevalecendo o maior valor.`, false, 5);
  printParagraph("§3º. A intervenção, remoção, desativação, obstrução ou alteração do sistema de telemetria ou de rastreamento implica a apuração da medição pela franquia mínima contratada, sem prejuízo das penalidades previstas na Cláusula Décima Oitava.", false, 5);
  printParagraph("§4º. Serão deduzidas das medições as horas em que o equipamento estiver parado para manutenções preventivas e/ou corretivas, por defeitos no equipamento ou por quaisquer outros aspectos de responsabilidade da LOCADORA que impeçam a operação efetiva do equipamento/veículo, exceto em caso de mau uso ou culpa da LOCATÁRIA, quando esta deverá arcar com os custos sem deduções na medição.", false, 8);

  // ─── CLÁUSULA QUINTA — PAGAMENTOS ───────────────────────────────────────────
  printParagraph("CLÁUSULA QUINTA — PAGAMENTOS", true, 4);
  const prazoPagDias = params.prazo_pagamento_dias || 30;
  const prazoPagExt = integerToExtenso(prazoPagDias);
  printParagraph(`Pela locação do bem objeto do presente Contrato, a LOCATÁRIA pagará à LOCADORA os valores unitários conforme prazo acordado entre as Partes, com vencimento em ${prazoPagDias} (${prazoPagExt}) dias a partir da aprovação do boletim de medição.`, false, 5);
  printParagraph("§1º. Os pagamentos decorrentes deste Contrato deverão ser efetuados exclusivamente por meio de boleto bancário emitido pela LOCADORA.", false, 5);
  const multaAtraso = params.multa_atraso_percent || 2;
  const jurosAtraso = params.juros_atraso_percent || 1;
  printParagraph(`§2º. Em caso de atraso no pagamento de quaisquer valores devidos decorrentes deste Contrato, o montante em atraso será acrescido de multa moratória e não compensatória de ${multaAtraso}% (${percentToExtenso(multaAtraso)}), além de juros de mora de ${jurosAtraso}% (${percentToExtenso(jurosAtraso)}) ao mês, calculados pro rata die, e correção monetária apurada pelo IGPM/FGV (ou índice oficial que venha a substituí-lo), calculados desde a data do vencimento até a data do efetivo pagamento.`, false, 5);
  printParagraph("§3º. As informações sobre programações dos pagamentos e/ou comprovantes de pagamento deverão ser solicitadas à LOCADORA, através dos e-mails: alyson.oliveira@busatoloc.com.br, financeiro@busatotransportes.com.br, samara.rodrigues@busatoloc.com.br.", false, 5);
  printParagraph("DADOS BANCÁRIOS: Favorecido: BUSATO LOCAÇÕES E SERVIÇOS LTDA | CNPJ: 54.167.719/0001-40.", true, 8);

  // ─── CLÁUSULA SEXTA — DAS OBRIGAÇÕES DA LOCADORA ────────────────────────────
  printParagraph("CLÁUSULA SEXTA — DAS OBRIGAÇÕES DA LOCADORA", true, 4);
  const obrigLocadora = [
    "Prestar à LOCATÁRIA quaisquer esclarecimentos e informações que se fizerem necessários para utilização do bem locado.",
    "Fornecer o bem locado em perfeitas condições de uso, conforme orientações de manutenções/operação do fabricante.",
    "Realizar as manutenções preventivas conforme plano de manutenção, podendo a LOCADORA indicar a concessionária ou oficina credenciada mais próxima para efetivar a manutenção devida ou autorizar que a manutenção seja realizada pela própria LOCATÁRIA, mediante reembolso previamente aprovado.",
    "Vistoriar e providenciar evidências na saída e na chegada do bem locado para comprovar o estado em que se encontra, na forma da Cláusula Oitava.",
    "Arcar com os custos de licenciamento de trânsito do veículo, IPVA e seguro obrigatório.",
    "Fornecer à LOCATÁRIA cópia dos documentos e orientações referentes ao bem locado, sendo: CRLV, plano de manutenção, laudo eletromecânico e laudo de opacidade, quando aplicáveis ao equipamento.",
    "Substituir o bem locado, caso este apresente defeitos atestados pela equipe de manutenção além dos considerados normais, disponibilizando à LOCATÁRIA outro equipamento/veículo com as mesmas características técnicas e em perfeito estado de funcionamento, no prazo de 48 (quarenta e oito) horas, ressalvadas as hipóteses previstas na Cláusula Décima Quinta.",
  ];
  obrigLocadora.forEach(o => printParagraph(`• ${o}`, false, 4));
  y += 4;

  // ─── CLÁUSULA SÉTIMA — DAS OBRIGAÇÕES DA LOCATÁRIA ──────────────────────────
  printParagraph("CLÁUSULA SÉTIMA — DAS OBRIGAÇÕES DA LOCATÁRIA", true, 4);
  const obrigLocataria = [
    "Pagar à LOCADORA os valores devidos pela locação, obedecendo aos preços e prazos pactuados.",
    "Apresentar mensalmente à LOCADORA os registros constantes do horímetro para realização da medição, na forma da Cláusula Quarta.",
    "Informar à LOCADORA a necessidade de realização de manutenção corretiva no equipamento assim que constatada qualquer falha, anormalidade ou avaria.",
    "Durante o período locado, toda lubrificação periódica necessária ao funcionamento será de inteira responsabilidade da LOCATÁRIA, devendo ser realizada conforme recomendações do fabricante.",
    "Danos decorrentes de falta de lubrificação, uso sem óleo/fluido, combustível adulterado, combustível inadequado, impurezas, água no sistema, mistura incorreta, operação com nível baixo, superaquecimento ou travamento serão considerados mau uso, respondendo a LOCATÁRIA integralmente por reparos, peças e mão de obra.",
    "Arcar com o abastecimento do equipamento durante todo o período da locação, recebendo e devolvendo o bem com o mesmo nível de combustível, e utilizar combustível e lubrificantes dentro das especificações do fabricante.",
    "Conservar no equipamento/veículo o adesivo contendo a identificação e dados da LOCADORA.",
    "Usar o bem locado de forma adequada e para o fim a que se destina, sob pena de responder civil e criminalmente pelo mau uso ou deterioração do bem.",
    "Não sublocar, emprestar, ceder, arrendar ou permitir que terceiros alheios ao presente contrato utilizem do veículo locado no todo ou em parte, temporária ou definitivamente.",
    "Responsabilizar-se pela mobilização e desmobilização do bem locado, arcando com todos e quaisquer gastos, fretes e afins.",
    "Fica expressamente vedado à LOCATÁRIA realizar qualquer tipo de intervenção, remoção, substituição, desativação ou alteração no sistema de rastreamento e de telemetria instalado pela LOCADORA.",
    "Em caso de locação de máquina, caberá exclusivamente à LOCATÁRIA arcar com todos os custos de pneus, material rodante, dentes, lâminas, adaptadores e quaisquer outros componentes que tenham contato direto com o solo durante a operação do equipamento, salvo desgaste decorrente de uso regular dentro das especificações do fabricante.",
    "Designar para a operação do equipamento profissional habilitado, capacitado e treinado, na forma da Cláusula Décima Terceira.",
    "Comunicar imediatamente à LOCADORA qualquer acidente, sinistro, furto, roubo, autuação, notificação ou citação relacionada ao bem locado, na forma das Cláusulas Décima, Décima Segunda e Décima Terceira.",
  ];
  obrigLocataria.forEach(o => printParagraph(`• ${o}`, false, 4));
  y += 4;

  // ─── CLÁUSULA OITAVA — DA ENTREGA, DA VISTORIA E DA DEVOLUÇÃO ───────────────
  printParagraph("CLÁUSULA OITAVA — DA ENTREGA, DA VISTORIA E DA DEVOLUÇÃO", true, 4);
  printParagraph("A entrega e a devolução do bem locado serão formalizadas por Termo de Vistoria, assinado por prepostos de ambas as Partes, acompanhado de registro fotográfico e da leitura do horímetro, na forma do Anexo I, que integra este Contrato para todos os fins.", false, 5);
  printParagraph("§1º. A ausência ou a recusa injustificada de preposto da LOCATÁRIA à vistoria autoriza a LOCADORA a realizá-la unilateralmente, mediante laudo com registro fotográfico, presumindo-se verdadeiro o estado nele consignado.", false, 5);
  printParagraph("§2º. A LOCATÁRIA receberá o bem locado em condições normais de uso e assim o manterá até a sua efetiva devolução, ressalvados os desgastes naturais, não podendo realizar qualquer modificação no veículo/equipamento locado sem a prévia e expressa autorização da LOCADORA.", false, 5);
  printParagraph("§3º. Considera-se desgaste natural exclusivamente aquele decorrente do uso regular do equipamento dentro das especificações do fabricante. Não se enquadram nesse conceito amassados, trincas, rupturas, empenamentos, perda de componentes, danos a pneus e ao material rodante por corte, impacto ou uso indevido, nem danos elétricos, hidráulicos ou de motor decorrentes de operação inadequada, falta de lubrificação, sobrecarga ou superaquecimento.", false, 5);
  printParagraph("§4º. Findo o prazo estabelecido, ou rescindida a locação por qualquer motivo, a LOCATÁRIA restituirá o bem locado à LOCADORA em até 5 (cinco) dias úteis, no pátio da LOCADORA ou em local por ela indicado, com o mesmo nível de combustível da entrega e em condições de limpeza que permitam a vistoria.", false, 5);
  printParagraph("§5º. Não devolvido o bem no prazo do parágrafo anterior, incidirá, por dia de atraso e por equipamento, diária equivalente a 1/30 (um trinta avos) do valor mensal contratado, sem prejuízo das perdas e danos e das medidas possessórias e criminais cabíveis.", false, 5);
  printParagraph("§6º. Constatados danos na vistoria de devolução, a LOCADORA apresentará orçamento em até 10 (dez) dias úteis, que a LOCATÁRIA deverá quitar em 10 (dez) dias contados do recebimento, facultada à LOCADORA a realização do reparo em oficina de sua escolha, respondendo ainda a LOCATÁRIA pelo valor da locação correspondente ao período de indisponibilidade do equipamento em reparo.", false, 8);

  // ─── CLÁUSULA NONA — DOS SEGUROS ─────────────────────────────────────────────
  printParagraph("CLÁUSULA NONA — DOS SEGUROS", true, 4);
  printParagraph("A contratação do seguro do bem locado, em companhia seguradora de idoneidade reconhecida, para cobertura de danos materiais e pessoais a terceiros e para cobrir os gastos em decorrência de acidente envolvendo o bem, ficará a cargo da LOCADORA, sendo que o custo do prêmio e da franquia será suportado conforme negociação comercial entre as Partes.", false, 5);
  printParagraph("§1º. A LOCADORA se compromete a enviar a apólice do veículo/equipamento locado após a assinatura do presente Contrato, a qual integra este instrumento como Anexo III.", false, 5);
  printParagraph("§2º. Acionado o seguro em decorrência de sinistro causado durante a utilização do bem pela LOCATÁRIA, esta ficará responsável pelo pagamento integral da franquia, conforme apólice, pela participação obrigatória no aviso de sinistro e pelo fornecimento de toda a documentação exigida pela seguradora, no prazo por esta estipulado.", false, 5);
  printParagraph("§3º. A LOCATÁRIA declara ciência de que a apólice pode não cobrir determinados eventos, entre eles operação fora de via pública, tombamento, capotamento, submersão, danos ao material rodante, uso por condutor ou operador não habilitado, condução sob efeito de álcool ou substância psicoativa, agravamento de risco e uso em local diverso do contratado.", false, 5);
  printParagraph("§4º. A LOCATÁRIA manterá, durante toda a vigência, seguro de responsabilidade civil que cubra danos a terceiros decorrentes da operação do equipamento, comprovando a apólice à LOCADORA sempre que solicitado.", false, 5);
  printParagraph("§5º. Em caso de acidente, furto, roubo ou qualquer sinistro, a LOCATÁRIA comunicará a LOCADORA imediatamente e registrará o boletim de ocorrência em até 24 (vinte e quatro) horas, entregando cópia à LOCADORA.", false, 8);

  // ─── CLÁUSULA DÉCIMA — DOS DANOS, DA PERDA, DO FURTO E DO ROUBO ─────────────
  printParagraph("CLÁUSULA DÉCIMA — DOS DANOS, DA PERDA, DO FURTO E DO ROUBO", true, 4);
  printParagraph("A LOCATÁRIA é depositária do bem locado e responde por sua guarda e conservação durante todo o período da locação, respondendo integralmente por danos, perda total, furto, roubo, apropriação indébita e quaisquer eventos que atinjam o equipamento.", false, 5);
  printParagraph("§1º. Na hipótese de não ser possível acionar o seguro vigente, ou em caso de recusa de cobertura por parte da seguradora devido a dolo, culpa, negligência, imperícia, imprudência, mau uso ou agravamento de risco por parte da LOCATÁRIA ou de seus prepostos, a LOCATÁRIA será integral e exclusivamente responsável pelo pagamento de todas as perdas e danos.", false, 5);
  printParagraph("§2º. Na hipótese do parágrafo anterior, a LOCATÁRIA ressarcirá à LOCADORA o valor correspondente a 100% (cem por cento) do valor de mercado para reposição do equipamento sinistrado, apurado pela tabela do fabricante ou por laudo de avaliação, ou arcará com os custos totais e integrais dos reparos necessários, sem prejuízo da cobrança do valor da locação pelos dias em que o equipamento ficar inoperante, até a efetiva reposição ou conclusão do reparo.", false, 5);
  printParagraph("§3º. Os valores previstos nesta cláusula serão pagos em até 10 (dez) dias contados da apresentação do orçamento, do laudo ou da negativa da seguradora, o que ocorrer por último.", false, 8);

  // ─── CLÁUSULA DÉCIMA PRIMEIRA — DA RESPONSABILIDADE PERANTE TERCEIROS ────────
  printParagraph("CLÁUSULA DÉCIMA PRIMEIRA — DA RESPONSABILIDADE PERANTE TERCEIROS E DO DIREITO DE REGRESSO", true, 4);
  printParagraph("A LOCATÁRIA será integral e exclusivamente responsável pela posse, guarda, condução, operação e uso dos veículos/equipamentos locados, incluindo a observância das normas de trânsito, de segurança e das legislações aplicáveis.", false, 5);
  printParagraph("§1º. A responsabilidade da LOCATÁRIA abrange todas as ações ou omissões praticadas por seus motoristas, operadores, empregados, prepostos ou qualquer outra pessoa que utilizar os veículos/equipamentos, sendo de sua inteira responsabilidade quaisquer danos causados a terceiros, danos ambientais, multas, infrações, perdas, acidentes de trânsito, furtos, roubos ou quaisquer outros eventos relacionados ao uso dos bens locados.", false, 5);
  printParagraph("§2º. As Partes reconhecem que a estipulação prevista nesta cláusula produz efeitos entre elas, não sendo oponível a terceiros estranhos a este Contrato. Acionada a LOCADORA, judicial ou administrativamente, em razão de evento ocorrido na vigência da locação, a LOCATÁRIA obriga-se a assumir o polo passivo da demanda ou a integrar a lide, a apresentar defesa às suas expensas e a reembolsar integralmente a LOCADORA de todo valor que esta venha a desembolsar a título de condenação, acordo, custas, despesas processuais e honorários, independentemente do resultado do processo.", false, 5);
  printParagraph("§3º. O reembolso dos honorários advocatícios contratuais da LOCADORA observará o valor do percentual de 5% sobre o valor envolvido, conforme acordado entre as Partes, comprovado por relatório de atividades, abrangendo a elaboração de petições, os deslocamentos para audiências e as demais despesas judiciais e administrativas.", false, 5);
  printParagraph("§4º. A LOCATÁRIA comunicará a LOCADORA em até 48 (quarenta e oito) horas de qualquer acidente, notificação, autuação, reclamação ou citação relacionada ao bem locado, sob pena de responder pelas consequências da perda de prazo.", false, 8);

  // ─── CLÁUSULA DÉCIMA SEGUNDA — DAS INFRAÇÕES DE TRÂNSITO ────────────────────
  printParagraph("CLÁUSULA DÉCIMA SEGUNDA — DAS INFRAÇÕES DE TRÂNSITO", true, 4);
  printParagraph("As infrações de trânsito e as penalidades administrativas praticadas durante a vigência deste Contrato são de responsabilidade exclusiva da LOCATÁRIA, que responderá pelo valor das multas, juros, encargos e despesas correlatas.", false, 5);
  printParagraph("§1º. Recebida da LOCADORA a comunicação da autuação, a LOCATÁRIA fornecerá, em até 10 (dez) dias corridos, os dados e a documentação do condutor infrator, com a assinatura dos formulários necessários à indicação prevista no art. 257, §7º, do Código de Trânsito Brasileiro.", false, 5);
  printParagraph("§2º. Descumprido o prazo do parágrafo anterior, a LOCATÁRIA responderá integralmente pela multa aplicada ao proprietário do veículo na forma do art. 257, §8º, do Código de Trânsito Brasileiro, bem como pelos custos de defesa e de recursos administrativos.", false, 5);
  printParagraph("§3º. Os valores das multas poderão ser descontados da garantia prestada ou cobrados diretamente da LOCATÁRIA, a critério da LOCADORA.", false, 8);

  // ─── CLÁUSULA DÉCIMA TERCEIRA — DA RESPONSABILIDADE TRABALHISTA ──────────────
  printParagraph("CLÁUSULA DÉCIMA TERCEIRA — DA RESPONSABILIDADE TRABALHISTA", true, 4);
  printParagraph("A locação não envolve fornecimento de mão de obra, não se estabelecendo qualquer vínculo empregatício, de subordinação ou de prestação de serviços entre a LOCADORA e os empregados ou prepostos da LOCATÁRIA.", false, 5);
  printParagraph("§1º. A LOCATÁRIA obriga-se a designar para a operação do equipamento profissional habilitado, capacitado e treinado na forma das normas regulamentadoras aplicáveis, entre elas a NR-11, a NR-12 e a NR-18, mantendo em dia ordem de serviço, certificados de treinamento, exames ocupacionais e fornecimento de equipamentos de proteção individual.", false, 5);
  printParagraph("§2º. A LOCATÁRIA responde por todos os encargos trabalhistas, previdenciários, fiscais e securitários de seus empregados e prepostos, bem como por acidentes do trabalho ocorrido na operação do equipamento.", false, 5);
  printParagraph("§3º. A LOCATÁRIA obriga-se a reembolsar a LOCADORA de qualquer valor que esta venha a suportar em razão de reclamação trabalhista, ação indenizatória por acidente do trabalho ou autuação administrativa decorrente da execução deste Contrato, inclusive honorários advocatícios, custas e despesas processuais.", false, 8);

  // ─── CLÁUSULA DÉCIMA QUARTA — DA RESPONSABILIDADE AMBIENTAL ─────────────────
  printParagraph("CLÁUSULA DÉCIMA QUARTA — DA RESPONSABILIDADE AMBIENTAL", true, 4);
  printParagraph("A LOCATÁRIA responde integralmente por danos ambientais decorrentes da operação do bem locado, entre eles vazamento de óleo, derramamento de combustível e contaminação de solo e de corpos d'água, obrigando-se a manter no local kit de contenção de emergência e a comunicar imediatamente à LOCADORA e aos órgãos competentes qualquer ocorrência.", false, 5);
  printParagraph("Parágrafo único. Acionada a LOCADORA, na condição de proprietária do equipamento, por órgão ambiental, em ação civil pública ou em qualquer outra medida, a LOCATÁRIA a reembolsará integralmente de multas, custos de remediação, condenações, despesas processuais e honorários, sem prejuízo da rescisão imediata do Contrato.", false, 8);

  // ─── CLÁUSULA DÉCIMA QUINTA — DA LIMITAÇÃO DE RESPONSABILIDADE DA LOCADORA ───
  printParagraph("CLÁUSULA DÉCIMA QUINTA — DA LIMITAÇÃO DE RESPONSABILIDADE DA LOCADORA", true, 4);
  printParagraph("A LOCADORA responde exclusivamente pela disponibilização do bem locado em condições de uso e pela manutenção preventiva prevista neste Contrato, não respondendo, em nenhuma hipótese, por lucros cessantes, perda de produtividade, atraso de cronograma, penalidades contratuais aplicadas por terceiros à LOCATÁRIA ou quaisquer danos indiretos decorrentes da indisponibilidade do equipamento.", false, 5);
  printParagraph("Parágrafo único. O prazo de substituição do equipamento previsto na Cláusula Sétima fica suspenso nas hipóteses de caso fortuito, força maior, indisponibilidade de frota, greve, restrição ao transporte de carga especial ou impedimento de acesso ao canteiro, e a responsabilidade da LOCADORA, em qualquer caso, fica limitada ao valor proporcional da locação correspondente ao período de indisponibilidade.", false, 8);

  // ─── CLÁUSULA DÉCIMA SEXTA — DA FISCALIZAÇÃO ────────────────────────────────
  printParagraph("CLÁUSULA DÉCIMA SEXTA — DA FISCALIZAÇÃO", true, 4);
  printParagraph("A LOCADORA poderá fiscalizar a boa utilização do veículo/equipamento pela LOCATÁRIA, inclusive mediante inspeção no local da obra, mediante comunicação prévia, e em caso de constatar qualquer irregularidade na utilização do mesmo, a LOCATÁRIA deve providenciar a regularização imediata, sob pena de rescisão.", false, 8);

  // ─── CLÁUSULA DÉCIMA SÉTIMA — DO GRAVAME ────────────────────────────────────
  printParagraph("CLÁUSULA DÉCIMA SÉTIMA — DO GRAVAME", true, 4);
  printParagraph("Sendo a LOCADORA legítima proprietária ou possuidora do bem locado, a LOCATÁRIA não poderá dá-lo em penhor, caução ou gravá-lo a favor de terceiros, nem oferecê-lo à penhora, obrigando-se a informar imediatamente à LOCADORA qualquer constrição judicial que recaia sobre o bem.", false, 8);

  // ─── CLÁUSULA DÉCIMA OITAVA — DAS PENALIDADES ───────────────────────────────
  printParagraph("CLÁUSULA DÉCIMA OITAVA — DAS PENALIDADES", true, 4);
  printParagraph("O descumprimento de qualquer cláusula ou condição pactuada neste instrumento sujeita a parte infratora à multa não compensatória equivalente a 1 (uma) franquia mensal mínima por equipamento envolvido, sem prejuízo da reparação integral das perdas e danos, dos lucros cessantes e da faculdade de rescisão imediata do Contrato pela parte inocente.", false, 5);
  printParagraph("Parágrafo único. A multa prevista nesta cláusula não se confunde com a multa moratória e os juros incidentes sobre o atraso de pagamento, previstos na Cláusula Quinta, nem com as indenizações e os reembolsos previstos nas Cláusulas Décima, Décima Primeira, Décima Segunda, Décima Quarta e Décima Quinta, que com ela são cumuláveis.", false, 8);

  // ─── CLÁUSULA DÉCIMA NONA — DO INADIMPLEMENTO E DA RESCISÃO ─────────────────
  printParagraph("CLÁUSULA DÉCIMA NONA — DO INADIMPLEMENTO, DO VENCIMENTO ANTECIPADO, DA RESCISÃO E DA RETOMADA DO BEM", true, 4);
  printParagraph("O atraso superior a 15 (quinze) dias no pagamento de qualquer valor, a insuficiência ou a não recomposição da garantia, o deslocamento não autorizado do equipamento, a sublocação, a cessão do contrato sem anuência, o pedido de recuperação judicial ou a falência da LOCATÁRIA autorizam a LOCADORA a declarar o vencimento antecipado das obrigações e a rescindir o Contrato de pleno direito, independentemente de notificação judicial, nos termos do art. 474 do Código Civil.", false, 5);
  printParagraph("§1º. Rescindido o Contrato por qualquer motivo, a LOCATÁRIA restituirá o bem em até 48 (quarenta e oito) horas e, desde já, autoriza expressamente a LOCADORA, seus prepostos e a empresa de transporte por ela contratada a ingressar no local onde o equipamento estiver, em horário comercial, para promover a retirada, sem que isso configure turbação ou esbulho.", false, 5);
  printParagraph("§2º. A recusa de devolução sujeita a LOCATÁRIA à diária prevista na Cláusula Oitava e às medidas possessórias cabíveis, sem prejuízo das providências criminais em caso de apropriação indébita.", false, 8);

  // ─── CLÁUSULA VIGÉSIMA — DO CASO FORTUITO E DA FORÇA MAIOR ──────────────────
  printParagraph("CLÁUSULA VIGÉSIMA — DO CASO FORTUITO E DA FORÇA MAIOR", true, 4);
  printParagraph("Nenhuma das Partes responderá pelo descumprimento de obrigação que decorra exclusivamente de caso fortuito ou de força maior, nos termos do art. 393 do Código Civil, devendo a parte afetada comunicar a outra em até 5 (cinco) dias contados do evento.", false, 5);
  printParagraph("Parágrafo único. A ocorrência não afasta o pagamento dos valores devidos pelo período em que o equipamento esteve à disposição da LOCATÁRIA, nem a responsabilidade desta pela guarda do bem.", false, 8);

  // ─── CLÁUSULA VIGÉSIMA PRIMEIRA — DA PROTEÇÃO DE DADOS E DA TELEMETRIA ───────
  printParagraph("CLÁUSULA VIGÉSIMA PRIMEIRA — DA PROTEÇÃO DE DADOS E DA TELEMETRIA", true, 4);
  printParagraph("As Partes declaram-se cientes dos direitos, obrigações e penalidades aplicáveis constantes da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018) e obrigam-se a adotar todas as medidas de segurança, técnicas, organizacionais e administrativas para garantir, por si, bem como por seu pessoal, colaboradores, empregados e subcontratados, o cumprimento da referida legislação.", false, 5);
  printParagraph("§1º. A LOCATÁRIA declara ciência de que o bem locado possui sistema de telemetria e de rastreamento, operado pela LOCADORA na condição de controladora, com as finalidades de medição das horas contratadas, proteção patrimonial, gestão de manutenção e cumprimento de obrigações legais e contratuais, fundado na execução do contrato e no legítimo interesse, nos termos do art. 7º, incisos V e IX, da Lei nº 13.709/2018.", false, 5);
  printParagraph("§2º. A LOCATÁRIA obriga-se a informar seus empregados e prepostos sobre o monitoramento, respondendo perante a LOCADORA por eventual omissão, e a não intervir, remover, desativar ou alterar o sistema instalado.", false, 8);

  // ─── CLÁUSULA VIGÉSIMA SEGUNDA — DO COMPLIANCE E DA CONDUTA EMPRESARIAL ──────
  printParagraph("CLÁUSULA VIGÉSIMA SEGUNDA — DO COMPLIANCE E DA CONDUTA EMPRESARIAL", true, 4);
  printParagraph("As Partes declaram que conhecem e observam a Lei nº 12.846/2013 e a legislação anticorrupção aplicável, bem como a legislação trabalhista, ambiental e de segurança do trabalho, obrigando-se a não empregar trabalho infantil, trabalho forçado ou em condições análogas à de escravo, e a não praticar qualquer ato lesivo à administração pública em razão deste Contrato.", false, 5);
  printParagraph("Parágrafo único. A violação comprovada do disposto nesta cláusula autoriza a rescisão imediata do Contrato, sem prejuízo das perdas e danos e das penalidades previstas.", false, 8);

  // ─── CLÁUSULA VIGÉSIMA TERCEIRA — DAS DISPOSIÇÕES GERAIS ────────────────────
  printParagraph("CLÁUSULA VIGÉSIMA TERCEIRA — DAS DISPOSIÇÕES GERAIS", true, 4);
  printParagraph("Os signatários do presente Contrato asseguram e afirmam que são os representantes legais competentes para assumir em nome das partes as obrigações descritas neste instrumento.", false, 5);
  printParagraph("A LOCATÁRIA não poderá, em hipótese alguma, transferir ou delegar as atribuições e responsabilidades que assume por força deste Contrato, a não ser com prévia concordância da LOCADORA.", false, 5);
  printParagraph("As Partes são contratantes totalmente independentes, sendo cada uma inteiramente responsável por seus atos, obrigações e conteúdo das informações prestadas, em toda e qualquer circunstância.", false, 5);
  printParagraph("O não exercício por qualquer das partes de direitos ou faculdades que lhe assistam em decorrência do presente instrumento não afetará aqueles direitos ou faculdades, os quais poderão ser exercidos a qualquer tempo.", false, 5);
  printParagraph("Este Contrato somente poderá ser alterado mediante formalização de Termo Aditivo assinado por ambas as Partes.", false, 5);
  printParagraph("Integram este Contrato, para todos os fins, o Anexo I — Termo de Vistoria de Entrega e Devolução, o Anexo II — proposta comercial e quadro de equipamentos, e o Anexo III — apólice de seguro vigente.", false, 5);
  printParagraph("Este Contrato constitui título executivo extrajudicial, nos termos do art. 784, inciso III, do Código de Processo Civil, sendo admitida a assinatura eletrônica em qualquer das modalidades previstas em lei, dispensada a assinatura de testemunhas quando a integridade do documento for conferida por provedor de assinatura, na forma do art. 784, §4º, do mesmo Código.", false, 8);

  // ─── CLÁUSULA VIGÉSIMA QUARTA — DO FORO ─────────────────────────────────────
  printParagraph("CLÁUSULA VIGÉSIMA QUARTA — DO FORO", true, 4);
  printParagraph("Fica eleito o foro da Comarca da Serra, Estado do Espírito Santo, com renúncia expressa a qualquer outro, por mais privilegiado que seja, para dirimir as controvérsias oriundas deste Contrato.", false, 5);
  printParagraph("E, por estarem justas e contratadas, as Partes assinam o presente instrumento, em via eletrônica ou em 2 (duas) vias de igual teor e forma, na presença de 2 (duas) testemunhas.", false, 10);

  // Date and Signatures
  checkPageBreak(65);
  const now = new Date();
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const dataExtenso = `Serra/ES, ${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}.`;
  printParagraph(dataExtenso, false, 15);

  // Signature lines
  y += 5;
  doc.setLineWidth(0.4);
  doc.setDrawColor(50, 50, 50);

  doc.line(margin, y, margin + 75, y);
  doc.line(pw - margin - 75, y, pw - margin, y);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("BUSATO LOCAÇÕES E SERVIÇOS LTDA.", margin, y + 4);
  doc.text("LOCADORA", margin, y + 8);

  doc.text(locatariaNome.toUpperCase().substring(0, 42), pw - margin - 75, y + 4);
  doc.text("LOCATÁRIA", pw - margin - 75, y + 8);

  y += 24;
  checkPageBreak(35);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Testemunhas:", margin, y);
  y += 8;

  doc.line(margin, y, margin + 75, y);
  doc.line(pw - margin - 75, y, pw - margin, y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${params.testemunhas.nome1 || "___________________"}`, margin, y + 4);
  doc.text(`CPF: ${params.testemunhas.cpf1 || "___________________"}`, margin, y + 8);

  doc.text(`Nome: ${params.testemunhas.nome2 || "___________________"}`, pw - margin - 75, y + 4);
  doc.text(`CPF: ${params.testemunhas.cpf2 || "___________________"}`, pw - margin - 75, y + 8);

  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  const cleanName = (locatariaNome || "contrato").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  doc.save(`CONTRATO_LOCACAO_${params.numero_proposta}_-_${cleanName}.pdf`);
};