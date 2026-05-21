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
  printParagraph("BUSATO LOCAÇÕES E SERVIÇOS LTDA, empresa estabelecida Av. Coronel Manoel Nunes, 145, Planalto de Carapina, Serra/ES, CEP 29.162-715, inscrita no CNPJ sob o nº 00.865.596/0001-92, neste ato denominada simplesmente CONTRATADA.", false, 5);

  printParagraph("De outro lado, como Locatária,", true, 3);
  const obraSuffix = params.empresa?.obra ? ` (Obra: ${params.empresa.obra})` : "";
  const locatariaNome = `${params.empresa?.razao_social || params.empresa?.nome || "LOCATÁRIA"}${obraSuffix}`;
  const locatariaCnpj = params.empresa?.cnpj || "—";
  const locatariaEnd = [params.empresa?.endereco_logradouro, params.empresa?.endereco_numero, params.empresa?.endereco_complemento, params.empresa?.endereco_bairro, params.empresa?.endereco_cidade, params.empresa?.endereco_uf].filter(Boolean).join(", ") || "—";
  printParagraph(`${locatariaNome}, empresa estabelecida na ${locatariaEnd}, inscrita no CNPJ sob o nº ${locatariaCnpj}, neste ato denominada simplesmente Locatária.`, false, 8);

  printParagraph("Resolvem celebrar o presente Contrato de Locação de Veículo / Equipamento, sem fornecimento de mão de obra, doravante denominado “Contrato”, mediante as seguintes cláusulas e condições.", false, 10);

  // Clause 1
  printParagraph("CLÁUSULA PRIMEIRA – OBJETO E CONDIÇÕES", true, 4);
  const numEquips = params.equipamentos.length;
  printParagraph(`1.1. É objeto do presente Contrato a locação de ${numEquips} equipamento(s) para utilização conforme descrição abaixo:`, false, 6);

  // Table
  const isDiaria = params.tipo_medicao === "diarias";
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [[
      "ITEM",
      "EQUIPAMENTO",
      "CHASSIS / SERIE",
      isDiaria ? "FRANQUIA DIÁRIA" : "FRANQUIA HORA",
      isDiaria ? "VALOR DIÁRIA" : "VALOR HORA",
      "VALOR TOTAL/MÊS"
    ]],
    body: params.equipamentos.map((eq, i) => [
      String(i + 1).padStart(2, "0"),
      eq.equipamento_tipo,
      eq.numero_serie || "—",
      eq.franquia_mensal ? `${eq.franquia_mensal} ${isDiaria ? "DIÁRIAS" : "HORAS"}` : "—",
      fmtBRL(eq.valor_hora),
      fmtBRL(eq.valor_mensal)
    ]),
    styles: { fontSize: 8, cellPadding: 3, textColor: darkGray },
    headStyles: { fillColor: brandBlue, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    theme: "striped",
  });
  
  y = (doc as any).lastAutoTable.finalY + 8;

  // Clause 1.2 & 1.3
  const firstEq = params.equipamentos[0];
  const franquiaUnidade = isDiaria ? "diárias" : "horas";
  const franquiaTxt = firstEq?.franquia_mensal ? `${firstEq.franquia_mensal} ${franquiaUnidade}` : "conforme tabela";
  const valorUnitLabel = isDiaria ? "diária" : "hora";
  const valorUnitTxt = firstEq ? fmtBRL(firstEq.valor_hora) : "—";

  if (isDiaria) {
    printParagraph(`1.2. Fica acordado entre as Partes que o bem(ns) locado(s) constante na Cláusula 1.1 acima possuem franquia mensal mínima de ${franquiaTxt} por veículo / equipamento, individualmente, sendo o valor unitário da ${valorUnitLabel} de ${valorUnitTxt}.`, false, 5);
    printParagraph(`1.3. Nos casos de contratos de locação por DIÁRIA, será garantido à LOCADORA um mínimo de ${franquiaTxt} mensais de locação por veículo / equipamento, individualmente, e as diárias extras trabalhadas ou à disposição que excedam esse limite serão acrescidas e registradas em Boletim de Medição, aplicando-se os preços unitários por diária pactuados na Cláusula 1.1 acima, assim como possíveis deduções previstas na Cláusula Quarta.`, false, 5);
  } else {
    printParagraph(`1.2. Fica acordado entre as Partes que o bem (ns) locado (s) constante na Cláusula 1.1 acima, possuem franquia mensal mínima de ${franquiaTxt} por veículo / equipamento, individualmente, sendo o valor unitário da hora de ${valorUnitTxt}.`, false, 5);
    printParagraph(`1.3. Nos casos de contratos de locação por HORA, será garantido à LOCADORA um mínimo de ${franquiaTxt} mensais de locação por veículo / equipamento, individualmente, e as horas extras trabalhadas ou à disposição que excedam esse limite serão acrescidas e registradas em Boletim de Medição, aplicando-se os preços unitários por hora pactuados na Cláusula 1.1 acima, assim como possíveis deduções previstas na Cláusula Quarta.`, false, 5);
  }

  printParagraph("1.3.1. Nos meses de mobilização e desmobilização do equipamento o valor mensal a ser medido será proporcional ao número de dias úteis do equipamento à disposição da obra.", false, 8);

  // Clause 2
  printParagraph("CLÁUSULA SEGUNDA – PRAZO", true, 4);
  const dtInicio = parseLocalDate(params.data_inicio).toLocaleDateString("pt-BR");
  const dtFim = parseLocalDate(params.data_fim).toLocaleDateString("pt-BR");
  const diffTime = Math.abs(new Date(params.data_fim).getTime() - new Date(params.data_inicio).getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  printParagraph(`2.1. O prazo de vigência do presente Contrato é de ${diffDays} dias, com início em ${dtInicio} e o término estimado para o dia ${dtFim}, podendo ser prorrogado automaticamente, por iguais e sucessivos períodos, até o limite máximo de 12 (doze) meses de vigência total, salvo manifestação expressa, formalizada por escrito, in sentido contrário por qualquer das partes, com antecedência mínima de 15 (quinze) dias do término de cada período de vigência.`, false, 5);

  printParagraph("2.2. Até 15 (quinze) dias antes do término do prazo máximo de 12 (doze) meses, as partes poderão negociar e ajustar as novas condições comerciais, mediante celebração de aditivo contratual, com nova vigência e valores, mantendo-se todas as demais condições previamente pactuadas no contrato principal.", false, 5);

  printParagraph("2.3. Caso a LOCATÁRIA deseje reduzir o prazo ou suspender a locação do bem, objeto deste contrato, deverá formalmente comunicar, mediante aviso prévio de 15 (quinze) dias, à LOCADORA para que esta manifeste sua concordância. A suspensão indevida da locação pela LOCATÁRIA implicará em rescisão contratual antecipada, aplicando-se as penalidades respectivas, nos termos da Cláusula Nona.", false, 8);

  // Clause 3
  printParagraph("CLÁUSULA TERCEIRA – PREÇOS", true, 4);
  const valorTotalMensal = params.equipamentos.reduce((sum, e) => sum + e.valor_mensal, 0);
  const dtInicioClause3 = parseLocalDate(params.data_inicio);
  const dtFimClause3 = parseLocalDate(params.data_fim);
  const diffTimeClause3 = Math.abs(dtFimClause3.getTime() - dtInicioClause3.getTime());
  const diffDaysClause3 = Math.ceil(diffTimeClause3 / (1000 * 60 * 60 * 24));
  const mesesContrato = diffDaysClause3 / 30;
  const valorGlobalEstimado = valorTotalMensal * mesesContrato;
  const valorGlobalEstimadoExt = valorExtenso(valorGlobalEstimado);
  printParagraph(`3.1. O valor global estimado do presente Contrato é de ${fmtBRL(valorGlobalEstimado)} (${valorGlobalEstimadoExt}), calculado conforme os valores unitários e prazos indicados na Cláusula 1.1 acima. Este valor serve apenas como parâmetro orçamentário, não constituindo qualquer compromisso das Partes de virem a efetivamente utilizá-lo integralmente, sendo devido apenas o montante referente ao período em que o equipamento estiver efetivamente locado, observadas as premissas de medição estabelecidas neste instrumento.`, false, 5);

  printParagraph("3.2. Os preços unitários pactuados na Cláusula 1.1 acima serão fixos e irreajustáveis durante toda a vigência do presente Contrato ou pelo período de 12 (doze) meses. Caso o presente instrumento vigore por prazo superior a 12 (doze) meses, o valor contratado entre as Partes será reajustado monetariamente de acordo com a variação positiva do IPCA/IBGE, ou índice que vier substituí-lo em caso de variação negativa.", false, 5);

  printParagraph("3.3. Os valores de locação acima indicados incluem todos os impostos incidentes sobre a atividade de locação de equipamento considerando o regime de tributação da empresa LOCADORA, nos termos da legislação em vigor nos âmbitos federal, estadual e municipal. Demais impostos ou taxas inerentes as atividades realizadas com o equipamento locado, deverão ser arcados exclusivamente pela LOCATÁRIA.", false, 5);

  printParagraph("3.4. Se porventura a LOCATÁRIA for beneficiária de incentivo fiscal legalmente concedido, que implique na suspensão/isenção de tributos incidentes sobre a operação ora contratada, o benefício deverá ser informado à LOCADORA no ato da contratação para que as informações pertinentes e o dispositivo legal correspondente sejam indicados no faturamento a ser emitido pela LOCADORA.", false, 8);

  // Clause 4
  printParagraph("CLÁUSULA QUARTA – MEDIÇÕES", true, 4);
  printParagraph("4.1. Para efeito de medição e pagamento, as Partes ajustam e acordam que a data inicial a ser considerada será o dia da saída do veículo/equipamento do pátio da LOCADORA.", false, 5);

  const diaMedInicio = parseInt(params.dia_inicio_medicao || "1", 10);
  const diaMedFim = parseInt(params.dia_fim_medicao || "30", 10);
  const diaMedInicioStr = String(diaMedInicio).padStart(2, "0");
  const diaMedFimStr = String(diaMedFim).padStart(2, "0");
  const diaMedInicioExt = dayToExtenso(diaMedInicioStr);
  const diaMedFimExt = dayToExtenso(diaMedFimStr);

  printParagraph(`4.2. A medição relativa à franquia mensal, compreenderá o período do dia ${diaMedInicioStr} (${diaMedInicioExt}) do mês anterior ao dia ${diaMedFimStr} (${diaMedFimExt}) do mês da locação, exceto quando ocorrer proporcionalidade, o que resultará também em pagamento proporcional, devendo a LOCATÁRIA encaminhar o registro constante do horímetro referente a esse período, no prazo de até 2 (dois) dias úteis.`, false, 5);

  printParagraph("4.3. Os boletins de medição serão elaborados com base nas informações obtidas por meio da telemetria e encaminhados à LOCATÁRIA para análise e aprovação. A LOCATÁRIA terá o prazo de 05 (cinco) dias para manifestar eventual discordância, apresentando, obrigatoriamente, as evidências que comprovem a divergência. Decorrido o referido prazo sem manifestação, os boletins serão considerados aprovados, prosseguindo-se com o faturamento e envio para pagamento, conforme o prazo estipulado na Cláusula 5.1.", false, 5);

  printParagraph("4.4. Serão deduzidas das medições as horas em que o equipamento estiver parado para manutenções preventivas e/ou corretivas, por defeitos no equipamento ou quaisquer outros aspectos de responsabilidade da LOCADORA que impeçam a operação efetiva do equipamento / veículo, conforme quadro abaixo, exceto em caso de mau uso ou culpa da LOCATÁRIA, quando esta deverá arcar com os custos sem deduções na medição.", false, 5);

  printParagraph("4.5. Serão deduzidas das medições as horas em que o equipamento estiver parado para manutenções preventivas e/ou corretivas, por defeitos no equipamento ou quaisquer outros aspectos de responsabilidade da LOCADORA que impeçam a operação efetiva do equipamento.", false, 8);

  // Clause 5
  printParagraph("CLÁUSULA QUINTA – PAGAMENTOS", true, 4);

  const prazoPgto = params.prazo_pagamento_dias || 30;
  const prazoPgtoExt = integerToExtenso(prazoPgto);

  printParagraph(`5.1. Pela locação do bem objeto do presente Contrato, a LOCATÁRIA pagará à LOCADORA os valores unitários descritos no quadro constante na Cláusula 1.1, em até ${prazoPgto} (${prazoPgtoExt}) dias após emissão da nota fiscal/fatura.`, false, 5);

  printParagraph("5.2. Os pagamentos deverão ocorrer através de depósito bancário/pix em conta corrente de titularidade da LOCADORA abaixo indicada ou mediante boleto, sendo proibido o endosso de duplicatas, descontos de títulos bem como a utilização do sistema de cobrança bancária.", false, 4);

  // Bank Info Card
  checkPageBreak(35);
  doc.setFillColor(245, 248, 252);
  doc.roundedRect(margin, y, contentW, 32, 2, 2, "F");
  doc.setDrawColor(...brandBlue);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentW, 32, 2, 2, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...brandBlue);
  doc.text("DADOS BANCÁRIOS PARA DEPÓSITO/PIX", margin + 6, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  doc.text("Favorecido: BUSATO LOCAÇÕES E SERVIÇOS LTDA   |   CNPJ: 54.167.719/0001-40", margin + 6, y + 13);
  doc.text("Banco: Santander (033)   |   Agência: 3883   |   Conta Corrente: 13005824-7", margin + 6, y + 20);
  doc.text("E-mail para comprovantes: financeiro@bsuatotransportes.com.br", margin + 6, y + 27);
  y += 38;

  const multaAtraso = params.multa_atraso_percent !== undefined ? params.multa_atraso_percent : 2.00;
  const jurosAtraso = params.juros_atraso_percent !== undefined ? params.juros_atraso_percent : 2.00;

  const fmtPercent = (val: number) => val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  const multaAtrasoFmt = fmtPercent(multaAtraso);
  const jurosAtrasoFmt = fmtPercent(jurosAtraso);
  const multaAtrasoExt = percentToExtenso(multaAtraso);
  const jurosAtrasoExt = percentToExtenso(jurosAtraso);

  printParagraph(`5.3. A impontualidade no pagamento sujeitará à CONTRATANTE, a multa de ${multaAtrasoFmt} (${multaAtrasoExt}) ao mês, mais ${jurosAtrasoFmt} (${jurosAtrasoExt}) referente a encargos financeiros, independentemente das demais sanções previstas em Lei.`, false, 5);

  printParagraph("5.4. As informações sobre programações dos pagamentos e/ou comprovantes de pagamento deverão ser solicitadas à LOCATÁRIA, através do e-mail: alyson.oliveira@busatoloc.com.br, financeiro@bsuatotransportes.com.br, samara.rodrigues@busatoloc.com.br.", false, 8);

  // Clause 6
  printParagraph("CLÁUSULA SEXTA – DAS OBRIGAÇÕES DA LOCADORA", true, 4);
  printParagraph("6.1. Prestar à LOCATÁRIA quaisquer esclarecimentos e informações que se fizerem necessárias para utilização do bem locado.", false, 5);
  printParagraph("6.2. Fornecer o bem locado em perfeitas condições de uso, conforme orientações de manutenções/operação do fabricante. Os implementos e características adicionais ao equipamento/veículo deverão ser negociados entre as Partes previamente à saída do equipamento do pátio.", false, 5);
  printParagraph("6.3. Executar a manutenção preventiva e corretiva (por desgaste natural) em tempo programado pela equipe de PCM (Planejamento e Controle da Manutenção) para evitar interrupções na execução dos serviços.", false, 5);
  printParagraph("6.4. Realizar as manutenções preventivas conforme plano de manutenção, podendo a LOCADORA indicar a concessionária ou oficina credenciada mais próxima para efetivar a manutenção devida ou autorizar que a manutenção seja realizada pela própria LOCATÁRIA.", false, 5);
  printParagraph("6.5. Vistoriar e providenciar evidências na saída e na chegada do bem locado para comprovar o estado em que se encontra. Essa verificação deverá ser realizada mediante a participação de ambas as Partes.", false, 5);
  printParagraph("6.6. Arcar com os custos de licenciamento de trânsito do veículo, IPVA e seguro obrigatório.", false, 5);
  printParagraph("6.7. Fornecer à LOCATÁRIA cópia dos documentos e orientações referentes ao bem locado, sendo: CRLV, plano de manutenção, laudo eletromecânico e laudo de opacidade.", false, 5);
  printParagraph("6.8. Substituir o bem locado, caso este apresente defeitos atestados pela equipe de manutenção além dos considerados normais ou por deliberação interna operacional, disponibilizando à LOCATÁRIA outro equipamento/veículo com as mesmas características técnicas e em perfeito estado de funcionamento, no prazo de até 30 (trinta) dias, sem ônus para a LOCATÁRIA, exceto se os defeitos/avarias tenham incorrido com dolo ou culpa.", false, 8);

  // Clause 7
  printParagraph("CLÁUSULA SÉTIMA – DAS OBRIGAÇÕES DA LOCATÁRIA", true, 4);
  printParagraph("7.1. Pagar à LOCADORA os valores devidos pela locação, objeto deste Contrato, obedecendo aos preços e prazos pactuados entre as Partes neste instrumento.", false, 5);
  printParagraph("7.2. Apresentar mensalmente à LOCADORA os registros constantes do horímetro para realização da medição.", false, 5);
  printParagraph("7.3. Programar sempre com antecedência mínima de 05 (cinco) dias úteis, com o responsável pelo setor de Locação da LOCADORA, todo e qualquer tipo de manutenção, independentemente de ser preventiva e/ou corretiva.", false, 5);
  printParagraph("7.4. Informar à LOCADORA a necessidade de realização de manutenção corretiva no equipamento assim que constatado qualquer falha, anormalidade ou avaria.", false, 5);
  printParagraph("7.5. Durante o período locado, toda lubrificação periódica necessária ao funcionamento será de inteira responsabilidade da LOCATÁRIA, devendo ser realizada conforme recomendações do fabricante ou instruções repassadas pela LOCADORA.", false, 5);
  printParagraph("7.6. Caso o equipamento exija óleo, graxa, fluido hidráulico, aditivo, filtro ou qualquer insumo, a LOCATÁRIA deverá manter os níveis adequados e utilizar produtos compatíveis.", false, 5);
  printParagraph("7.7. Danos decorrentes de falta de lubrificação, uso sem óleo/fluido, combustível adulterado, combustível inadequado, impurezas, água no sistema, mistura incorreta, operação com nível baixo, superaquecimento ou travamento, serão considerados mau uso, respondendo a LOCATÁRIA integralmente por reparos, peças e mão de obra.", false, 5);
  printParagraph("7.8. Entregar o equipamento à LOCADORA para realização de manutenção em boas condições de limpeza e higienização. Caso contrário, poderão ser gerados custos adicionais, e, no caso de desmobilização, o relatório de vistoria somente será realizado após a devida higienização.", false, 5);
  printParagraph("7.9. Conservar no equipamento/veículo o adesivo contendo a identificação e dados da LOCADORA.", false, 5);
  printParagraph("7.10. Usar o bem locado de forma adequada e para o fim que se destina, sob pena de responder civil e criminalmente pelo mau uso ou deterioração do bem.", false, 5);
  printParagraph("7.11. Não adulterar, remover ou introduzir quaisquer modificações aludidas no bem locado.", false, 5);
  printParagraph("7.12. Não sublocar, emprestar, ceder, arrendar ou permitir que terceiros alheios ao presente contrato utilizem do veículo locado no todo ou em parte, temporária ou definitivamente, bem como transferir ou ceder os direitos deste contrato, exceto se previamente acordado entre as Partes e ficando a LOCATÁRIA integralmente responsável pelo contrato de Sublocação.", false, 5);
  printParagraph("7.13. Responsabilizar-se pelo checklist de vistoria, juntamente com a LOCADORA.", false, 5);
  printParagraph("7.14. Responsabilizar-se pela mobilização e desmobilização do bem locado, arcando com todos e quaisquer gastos, fretes e afins.", false, 5);
  printParagraph("7.15. Arcar com o pagamento de combustível necessário para o funcionamento do equipamento (ex: Diesel).", false, 5);
  printParagraph("7.16. Responsabilizar-se integralmente por quaisquer ônus, encargos ou indenizações, decorrentes de danos causados e/ou provocados pelo equipamento, durante a vigência deste instrumento, inclusive contra terceiros.", false, 5);
  printParagraph("7.17. Responsabilizar-se pela mão-de-obra especializada para a condução e/ou operação do veículo/equipamento ora locado, assim como por todos os custos e responsabilidades daí decorrentes.", false, 5);
  printParagraph("7.18. Fica expressamente vedado à LOCATÁRIA realizar qualquer tipo de intervenção, remoção, substituição, desativação ou alteração no sistema de rastreamento instalado pela LOCADORA, sendo esta parte integrante das condições de monitoramento e controle da frota. O descumprimento desta obrigação poderá ensejar a aplicação de penalidades previstas contratualmente, sem prejuízo da responsabilização por eventuais perdas e danos.", false, 5);
  printParagraph("7.19. Em caso de locação de máquina, caberá exclusivamente à LOCATÁRIA arcar com todos os custos de manutenção, substituição e reposição das Ferramentas de Penetração no Solo (FPS), entendidas como pontas, dentes, lâminas, adaptadores e quaisquer outros componentes que tenham contato direto com o solo durante a operação do equipamento.", false, 8);

  // Clause 8
  printParagraph("CLÁUSULA OITAVA – DA MULTA", true, 4);
  printParagraph("8.1. A LOCATÁRIA estará sujeita a uma multa equivalente a 7% (sete por cento) do valor global do contrato pelo não cumprimento de qualquer cláusula e/ou condições pactuadas neste instrumento.", false, 5);
  printParagraph("8.2. A LOCADORA, considerando os riscos intrínsecos a atividade e o valor do veículo/equipamento objeto do presente contrato, por sua vez, estará sujeita a uma multa equivalente a 3% (três por cento) do valor global do contrato pelo descumprimento de qualquer cláusula e/ou condições pactuadas neste instrumento.", false, 5);
  printParagraph("8.3. As multas pecuniárias previstas acima, não isentam a LOCATÁRIA do pagamento de reparação de eventuais danos ou prejuízos por ela causados à LOCADORA e a indenização por danos emergentes e por lucros cessantes.", false, 8);

  // Clause 9
  printParagraph("CLÁUSULA NONA – DA RESCISÃO", true, 4);
  printParagraph("9.1. Este Contrato poderá ser rescindido, total ou parcialmente, independentemente de qualquer interpelação judicial ou extrajudicial, nas seguintes hipóteses:", false, 5);
  printParagraph("a) Atraso no pagamento superior a 30 (trinta) dias, desde que não seja causado por responsabilidade comprovada da LOCADORA.", false, 4);
  printParagraph("b) Falência, dissolução ou liquidação judicial ou extrajudicial, requeridas ou homologadas.", false, 4);
  printParagraph("c) Por inobservância da Cláusula 2.3 e a suspensão indevida da locação pela LOCATÁRIA, sem anuência expressa da LOCADORA mediante celebração do Termo Aditivo respectivo.", false, 4);
  printParagraph("d) Caso haja infração, por qualquer das Partes, às disposições deste Contrato, não remediada no prazo ajustado entre as Partes.", false, 4);
  printParagraph("e) Por qualquer das Partes, a qualquer tempo, desde que esta intenção seja comunicada por escrito, com antecedência mínima de 15 (quinze) dias e formalizada a anuência respectiva.", false, 4);
  printParagraph("f) Em caso de encerramento das obras, ou mesmo transferência dos trabalhos da LOCATÁRIA para outra localidade diferente daquela estabelecida no Contrato. Nessa hipótese, deverá haver nova avaliação comercial e elaboração de Termo Aditivo para permitir a transferência do bem para outra localidade.", false, 8);

  // Clause 10
  printParagraph("CLÁUSULA DÉCIMA – DO RECEBIMENTO E DEVOLUÇÃO DO BEM LOCADO", true, 4);
  printParagraph("10.1. A LOCATÁRIA receberá o bem locado em condições normais de uso e assim o manterá até a sua efetiva devolução, ressalvados os desgastes considerados naturais.", false, 5);
  printParagraph("10.2. A LOCATÁRIA não poderá realizar qualquer modificação no veículo/equipamento locado, sem a prévia e expressa autorização da LOCADORA.", false, 5);
  printParagraph("10.3. Findo o prazo estabelecido, ou rescindido a locação por qualquer motivo, a LOCATÁRIA restituirá o bem locado a LOCADORA nas condições em que o recebeu, salvo os desgastes naturais, sob pena de aplicação da multa descrita na Cláusula 7.1.", false, 8);

  // Clause 11
  printParagraph("CLÁUSULA DÉCIMA PRIMEIRA – DOS SEGUROS", true, 4);
  printParagraph("11.1. Fica a cargo da LOCADORA, por sua conta exclusiva, a contratação de seguro automotivo em companhia de seguradora de idoneidade reconhecida, para cobertura de danos materiais e pessoais a terceiros e para cobrir os gastos em decorrência de acidente de trânsito envolvendo o bem, exclusivamente nos termos da apólice firmada com a seguradora, excluindo da cobertura serviços como destombamento, guincho, assistência 24 (vinte e quatro) horas, assim como danos de qualquer natureza que atinjam vidros, para-brisa, janelas e demais superfícies envidraçadas do(s) bem(ns).", false, 5);
  printParagraph("11.1.1. Caso o seguro seja acionado em decorrência de sinistro causado durante a utilização do bem pela LOCATÁRIA, esta ficará responsável pelo pagamento da franquia, conforme apólice de seguro.", false, 5);
  printParagraph("11.1.2. A LOCADORA se compromete a enviar a apólice do veículo/equipamento locado, após a assinatura do presente contrato.", false, 5);
  printParagraph("11.2. Em casos de substituição do bem locado, a LOCADORA compromete a disponibilizar a apólice de seguro deste, com as mesmas condições estabelecidas no item 11.1 acima.", false, 5);
  printParagraph("11.3. Na hipótese excepcional de não ser possível acionar o seguro vigente, seja por negativa da seguradora, por exclusão expressa da cobertura para o sinistro ocorrido ou por qualquer outro motivo que inviabilize a indenização, a LOCATÁRIA será responsável pelo pagamento de perdas e danos, limitado ao valor correspondente a 15% (quinze por cento) do valor de mercado do equipamento de mesma marca e modelo.", false, 8);

  // Clause 12
  printParagraph("CLÁUSULA DÉCIMA SEGUNDA – DA FISCALIZAÇÃO", true, 4);
  printParagraph("12.1. A LOCADORA poderá fiscalizar a boa utilização do veículo/equipamento pela LOCATÁRIA, e em caso de constatar qualquer irregularidade na utilização do mesmo, a LOCATÁRIA deve providenciar a regularização da situação no prazo máximo de 10 (dez) dias, sob pena de aplicação das sanções previstas na Cláusula 8.1.", false, 8);

  // Clause 13
  printParagraph("CLÁUSULA DÉCIMA TERCEIRA – DO GRAVAME", true, 4);
  printParagraph("13.1. Sendo a LOCADORA legítima proprietária ou possuidora do bem locado, a LOCATÁRIA não poderá dá-lo em penhor, caução ou gravá-lo a favor de terceiros.", false, 8);

  // Clause 14
  printParagraph("CLÁUSULA DÉCIMA QUARTA – RESPONSABILIDADE POR DANOS CAUSADOS", true, 4);
  printParagraph("14.1. A LOCATÁRIA será integral e exclusivamente responsável pela condução, operação e uso dos veículos/equipamentos locados, incluindo a observância das normas de trânsito, segurança e legislações aplicáveis.", false, 5);
  printParagraph("14.2. A responsabilidade da LOCATÁRIA abrange todas as ações ou omissões praticadas por seus motoristas, empregados, prepostos ou qualquer outra pessoa que utilizar os veículos, sendo de sua inteira responsabilidade quaisquer danos causados a terceiros, danos ambientais, multas, infrações, perdas, acidentes de trânsito, furtos, roubos, ou quaisquer outros eventos relacionados ao uso dos veículos.", false, 5);
  printParagraph("14.3. A LOCATÁRIA se responsabilizará plenamente pela contratação de seus funcionários e demais colaboradores que utilizar na condução dos equipamentos/veículos locados, assim como por todas as suas obrigações fiscais, previdenciárias, trabalhistas e demais encargos incidentes, como verbas acidentárias, incluindo, o fornecimento de equipamentos de proteção, individual ou coletivo, em atendimento às exigências das normas regulamentadoras no MTE, sem prejuízo de outras despesas decorrentes da mão de obra utilizada.", false, 5);
  printParagraph("14.4. A LOCADORA não será, em hipótese alguma, responsabilizada por qualquer evento decorrente da utilização dos veículos locados, ficando isenta de toda e qualquer obrigação ou encargo relacionado ao uso dos mesmos pela LOCATÁRIA.", false, 5);
  printParagraph("14.5. A LOCADORA fica isenta de toda e qualquer responsabilidade pelo não cumprimento pela LOCATÁRIA de determinações administrativas e/ou legais relativas à execução do objeto do presente instrumento.", false, 5);
  printParagraph("14.6. Acordam as Partes que, se porventura a LOCADORA for autuada, notificada, intimada, citada ou condenada em razão do não pagamento, em época própria, de qualquer obrigação atribuível à LOCATÁRIA, sejam as mesmas de natureza contratual, fiscal, trabalhista, previdenciária ou de qualquer outra espécie, mesmo após o término do Contrato, assistirá à LOCADORA o direito de demandar em juízo o reembolso, indenização ou inclusão da LOCATÁRIA no processo/procedimento, a fim de liberar a LOCADORA da autuação, notificação, intimação, citação ou condenação.", false, 5);
  printParagraph("14.6.1. A LOCATÁRIA ressarcirá a LOCADORA, independentemente do resultado dos processos judiciais ou administrativos, o valor das horas que forem despendidas por seu advogado, especialmente na elaboração de petições e nos deslocamentos para audiências, e por seus prepostos, além das despesas judiciais e administrativas e do custo que ocorrer, servindo de base para o ressarcimento aqui pactuado a remuneração do advogado e do preposto da LOCADORA.", false, 5);
  printParagraph("14.6.2. A LOCATÁRIA responderá judicialmente e extrajudicialmente por quaisquer ações, reclamações ou reivindicações feitas por seus empregados ou pessoas alocadas na execução dos serviços objetos do presente instrumento, responsabilizando-se integralmente por indenizações cíveis ou trabalhistas feitas pelos mesmos, quer em nome da LOCATÁRIA, quer em nome da LOCADORA, esta última a qual terá direito de regresso na hipótese de vir a ser compelida a pagar, por qualquer meio ou razão indenização aos empregados e pessoas a serviço da LOCATÁRIA, as quais, em hipótese alguma, terão vínculo empregatício com a LOCADORA.", false, 8);

  // Clause 15
  printParagraph("CLÁUSULA DÉCIMA QUINTA – DA LEI GERAL DE PROTEÇÃO DE DADOS PESSOAIS (LGPD)", true, 4);
  printParagraph("15.1. As Partes declaram-se cientes dos direitos, obrigações e penalidades aplicáveis constantes da Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018 - “LGPD”) e demais normas que versem a respeito do tratamento de dados pessoais e obrigam-se a adotar todas as medidas de segurança, técnicas, organizacionais e administrativas para garantir, por si, bem como por seu pessoal, colaboradores, empregados e subcontratados, o cumprimento da referida legislação.", false, 8);

  // Clause 16
  printParagraph("CLÁUSULA DÉCIMA SEXTA – DAS DISPOSIÇÕES GERAIS", true, 4);
  printParagraph("16.1. Os signatários do presente Contrato asseguram e afirmam que são os representantes legais competentes para assumir em nome das partes as obrigações descritas neste instrumento e representar de forma efetiva seus interesses.", false, 5);
  printParagraph("16.2. A LOCATÁRIA não poderá, em hipótese alguma, transferir ou delegar as atribuições e responsabilidades que assumem por força deste Contrato, a não ser com prévia concordância da LOCADORA.", false, 5);
  printParagraph("16.3. As Partes são contratantes totalmente independentes, sendo cada uma inteiramente responsável por seus atos, obrigações e conteúdo das informações prestadas, em toda e qualquer circunstância, visto que o presente instrumento não cria relação de parceria, emprego e nem de representação comercial entre elas, e nenhuma delas poderá declarar que possui qualquer autoridade para assumir ou criar qualquer obrigação, expressa ou implícita, em nome da outra, e nem representá-la sob nenhum pretexto e em nenhuma situação.", false, 5);
  printParagraph("16.4. O não exercício por qualquer das partes de direitos ou faculdades que lhe assistam em decorrência do presente instrumento, ou a tolerância com o atraso no cumprimento das obrigações da outra parte, não afetará aqueles direitos ou faculdades, os quais poderão ser exercidos a qualquer tempo, a exclusivo critério do interessado, não alterando as condições neste instrumento estipuladas.", false, 5);
  printParagraph("16.5. Este Contrato somente poderá ser alterado, em qualquer de suas disposições, mediante a celebração por escrito de Termo Aditivo contratual.", false, 5);
  printParagraph("16.6. A invalidade, ineficácia e/ou inexequibilidade de qualquer das disposições contidas no presente, desde que assim declaradas por juízo ou tribunal competente, não afetará nem prejudicará a subsistência, validade, eficácia e/ou exequibilidade das demais disposições que deverão permanecer válidas, eficazes e exequíveis da forma mais fiel possível aos seus termos e intenções originais.", false, 5);
  printParagraph("16.7. Para os devidos fins de direito, as Partes reconhecem que, quando existente, a proposta comercial apresentada pela LOCADORA constitui parte integrante e complementar deste contrato, vinculando-se às suas disposições. A referida proposta, se aplicável, segue anexada ao presente instrumento.", false, 8);

  // Clause 17
  printParagraph("CLÁUSULA DÉCIMA SÉTIMA – DA CONFIDENCIALIDADE", true, 4);
  printParagraph("17.1. As Partes se obrigam a não divulgar os dados e informações às quais venham a ter acesso em razão deste Contrato, obrigando-se ainda, a não permitir que nenhum de seus empregados ou terceiros sob a sua responsabilidade façam uso destas informações para fins diversos do objeto contratual. Esta obrigação permanecerá em vigor por um período de 05 (cinco) anos após o término deste instrumento.", false, 8);

  // Clause 18
  printParagraph("CLÁUSULA DÉCIMA OITAVA – DO FORO", true, 4);
  printParagraph("18.1. Para solução de quaisquer conflitos oriundos do presente Contrato fica eleito o foro da Comarca de Vitória/ES, com renúncia expressa de quaisquer outros, por mais privilegiados que sejam, correndo por conta da parte vencida, todas as despesas judiciais ou extrajudiciais.", false, 5);
  printParagraph("18.2. As Partes reconhecem a veracidade, autenticidade, integridade, validade e eficácia deste instrumento, incluindo seus anexos, nos termos do art. 219 do Código Civil, em formato eletrônico e/ou assinado pelas Partes por meio de certificados eletrônicos, ainda que sejam certificados eletrônicos não emitidos pela ICP-Brasil, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2, de 24 de agosto de 2001 (“MP nº 2.200-2”), sendo nesse caso, dispensada as assinaturas das 02 (duas) testemunhas.", false, 5);
  printParagraph("18.3. E, por estarem justas e contratadas, as Partes assinam o presente instrumento juntamente com 02 (duas) testemunhas, para que surtam os efeitos legais, prometendo cumpri-lo por si e seus sucessores.", false, 8);

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

  // Line for Locadora
  doc.line(margin, y, margin + 75, y);
  // Line for Locataria
  doc.line(pw - margin - 75, y, pw - margin, y);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("BUSATO LOCAÇÕES E SERVIÇOS LTDA", margin, y + 4);
  doc.text("LOCADORA", margin, y + 8);

  doc.text(locatariaNome.toUpperCase().substring(0, 42), pw - margin - 75, y + 4);
  doc.text("LOCATÁRIA", pw - margin - 75, y + 8);

  y += 24;
  checkPageBreak(35);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Testemunhas:", margin, y);
  y += 8;

  // Testemunha 1 line
  doc.line(margin, y, margin + 75, y);
  // Testemunha 2 line
  doc.line(pw - margin - 75, y, pw - margin, y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${params.testemunhas.nome1 || "___________________"}`, margin, y + 4);
  doc.text(`CPF: ${params.testemunhas.cpf1 || "___________________"}`, margin, y + 8);

  doc.text(`Nome: ${params.testemunhas.nome2 || "___________________"}`, pw - margin - 75, y + 4);
  doc.text(`CPF: ${params.testemunhas.cpf2 || "___________________"}`, pw - margin - 75, y + 8);

  // Add footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  const cleanName = (locatariaNome || "contrato").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  doc.save(`CONTRATO_LOCACAO_${params.numero_proposta}_-_${cleanName}.pdf`);
};
