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
    1: "um", 2: "dois", 3: "trÃªs", 4: "quatro", 5: "cinco", 6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
    11: "onze", 12: "doze", 13: "treze", 14: "catorze", 15: "quinze", 16: "dezesseis", 17: "dezessete", 18: "dezoito", 19: "dezenove", 20: "vinte",
    21: "vinte e um", 22: "vinte e dois", 23: "vinte e trÃªs", 24: "vinte e quatro", 25: "vinte e cinco", 26: "vinte e seis", 27: "vinte e sete", 28: "vinte e oito", 29: "vinte e nove", 30: "trinta", 31: "trinta e um"
  };
  return map[d] || dStr;
}

function integerToExtenso(n: number): string {
  if (n === 0) return "zero";
  const unidades = ["", "um", "dois", "trÃªs", "quatro", "cinco", "seis", "sete", "oito", "nove"];
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
    return `${intWords} vÃ­rgula ${decWords} por cento`;
  }
}

function converterNumeroParaExtenso(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  
  const unidades = ["", "um", "dois", "trÃªs", "quatro", "cinco", "seis", "sete", "oito", "nove"];
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
      milhaoText = "um milhÃ£o";
    } else {
      milhaoText = converterNumeroParaExtenso(milhao) + " milhÃµes";
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
    doc.text("BUSATO LOCAÃ‡Ã•ES E SERVIÃ‡OS LTDA  â€¢  CNPJ: 54.167.719/0001-40", margin, ph - 10);
    doc.text(`PÃ¡gina ${pageNum} de ${totalPages}`, pw - margin, ph - 10, { align: "right" });
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
  const titleLines = doc.splitTextToSize("CONTRATO DE LOCAÃ‡ÃƒO DE VEÃCULO / EQUIPAMENTO SEM UTILIZAÃ‡ÃƒO DE MÃƒO DE OBRA", contentW - 55);
  doc.text(titleLines, margin + 55, 15);

  doc.setDrawColor(...brandBlue);
  doc.setLineWidth(0.8);
  doc.line(margin, 28, pw - margin, 28);
  y = 35;


  // Parts
  printParagraph("De um lado, como Locadora,", true, 3);
  printParagraph("BUSATO LOCAÃ‡Ã•ES E SERVIÃ‡OS LTDA., empresa estabelecida na Av. Nossa Senhora da Penha, 595, Sala 510, Santa LÃºcia, VitÃ³ria/ES, CEP 29.056-250, inscrita no CNPJ sob o nÂº 54.167.719/0001-40, neste ato denominada simplesmente Locadora.", false, 5);

  printParagraph("De outro lado, como LocatÃ¡ria,", true, 3);
  const obraSuffix = params.empresa?.obra ? ` (Obra: ${params.empresa.obra})` : "";
  const locatariaNome = `${params.empresa?.razao_social || params.empresa?.nome || "LOCATÃRIA"}${obraSuffix}`;
  const locatariaCnpj = params.empresa?.cnpj || "â€”";
  const locatariaEnd = [params.empresa?.endereco_logradouro, params.empresa?.endereco_numero, params.empresa?.endereco_complemento, params.empresa?.endereco_bairro, params.empresa?.endereco_cidade, params.empresa?.endereco_uf].filter(Boolean).join(", ") || "â€”";
  printParagraph(`${locatariaNome}, empresa estabelecida Ã  ${locatariaEnd}, inscrita no CNPJ sob o nÂº ${locatariaCnpj}, neste ato denominada simplesmente LocatÃ¡ria.`, false, 8);

  printParagraph("Resolvem celebrar o presente Contrato de LocaÃ§Ã£o de VeÃ­culo / Equipamento, doravante denominado \"Contrato\", mediante as seguintes clÃ¡usulas e condiÃ§Ãµes:", false, 10);

  // â”€â”€â”€ CLÃUSULA PRIMEIRA â€” OBJETO E LOCAL DE UTILIZAÃ‡ÃƒO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA PRIMEIRA â€” OBJETO E LOCAL DE UTILIZAÃ‡ÃƒO", true, 4);
  const isDiaria = params.tipo_medicao === "diarias";
  const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  printParagraph("Ã‰ objeto do presente Contrato a locaÃ§Ã£o de equipamento(s) para utilizaÃ§Ã£o conforme descriÃ§Ã£o abaixo, sem fornecimento de mÃ£o de obra, operador ou qualquer prestaÃ§Ã£o de serviÃ§o pela LOCADORA.", false, 5);

  if (isDiaria) {
    printParagraph("Fica acordado entre as Partes que nos casos de contratos de locaÃ§Ã£o por DIÃRIA, serÃ¡ garantido Ã  LOCADORA um mÃ­nimo de diÃ¡rias mensais de locaÃ§Ã£o por veÃ­culo/equipamento, individualmente, e as diÃ¡rias extras trabalhadas ou Ã  disposiÃ§Ã£o que excedam esse limite serÃ£o acrescidas e registradas em Boletim de MediÃ§Ã£o, aplicando-se os preÃ§os unitÃ¡rios por diÃ¡ria pactuados, assim como possÃ­veis deduÃ§Ãµes previstas na ClÃ¡usula Quarta.", false, 5);
  } else {
    printParagraph("Fica acordado entre as Partes que nos casos de contratos de locaÃ§Ã£o por HORA, serÃ¡ garantido Ã  LOCADORA um mÃ­nimo de horas mensais de locaÃ§Ã£o por veÃ­culo/equipamento, individualmente, e as horas extras trabalhadas ou Ã  disposiÃ§Ã£o que excedam esse limite serÃ£o acrescidas e registradas em Boletim de MediÃ§Ã£o, aplicando-se os preÃ§os unitÃ¡rios por hora pactuados, assim como possÃ­veis deduÃ§Ãµes previstas na ClÃ¡usula Quarta.", false, 5);
  }

  printParagraph("Nos meses de mobilizaÃ§Ã£o e desmobilizaÃ§Ã£o do equipamento o valor mensal a ser medido serÃ¡ proporcional ao nÃºmero de dias Ãºteis do equipamento Ã  disposiÃ§Ã£o da obra.", false, 6);

  // Equipment table
  const franquiaUnidade = isDiaria ? "DIÃRIAS" : "HORAS";
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["ITEM", "EQUIPAMENTO", "CHASSIS / SÃ‰RIE", `FRANQUIA MENSAL ${franquiaUnidade}`, isDiaria ? "VALOR DIÃRIA" : "VALOR HORA", "VALOR TOTAL EQUIPAMENTO"]],
    body: params.equipamentos.map((eq, i) => [
      String(i + 1).padStart(2, "0"),
      eq.equipamento_tipo,
      eq.numero_serie || "â€”",
      eq.franquia_mensal ? `${eq.franquia_mensal} ${franquiaUnidade}` : "â€”",
      fmtBRL(eq.valor_hora),
      fmtBRL(eq.valor_mensal),
    ]),
    styles: { fontSize: 8, cellPadding: 3, textColor: darkGray },
    headStyles: { fillColor: brandBlue, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    theme: "striped",
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  printParagraph("Â§1Âº. O(s) equipamento(s) serÃ¡(Ã£o) utilizado(s) exclusivamente na obra/local indicado neste Contrato, sendo vedado o deslocamento para local diverso, ainda que de propriedade ou posse da LOCATÃRIA, sem prÃ©via e expressa autorizaÃ§Ã£o escrita da LOCADORA.", false, 5);
  printParagraph("Â§2Âº. O deslocamento nÃ£o autorizado caracteriza agravamento de risco, autoriza a rescisÃ£o imediata do Contrato e a retomada do bem e transfere Ã  LOCATÃRIA a responsabilidade integral por qualquer sinistro ocorrido fora do local contratado, inclusive na hipÃ³tese de recusa de cobertura pela seguradora.", false, 5);
  printParagraph("Â§3Âº. Os implementos e as caracterÃ­sticas adicionais ao equipamento/veÃ­culo deverÃ£o ser negociados entre as Partes previamente Ã  saÃ­da do equipamento do pÃ¡tio da LOCADORA.", false, 8);

  // â”€â”€â”€ CLÃUSULA SEGUNDA â€” PRAZO, FRANQUIA MÃNIMA E RESILIÃ‡ÃƒO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA SEGUNDA â€” PRAZO, FRANQUIA MÃNIMA E RESILIÃ‡ÃƒO", true, 4);
  const dtInicio = parseLocalDate(params.data_inicio).toLocaleDateString("pt-BR");
  const dtFim = parseLocalDate(params.data_fim).toLocaleDateString("pt-BR");
  const diffMs = Math.abs(new Date(params.data_fim).getTime() - new Date(params.data_inicio).getTime());
  const diffMonths = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30)));
  const diffMonthsExtenso = integerToExtenso(diffMonths);
  printParagraph(`O prazo de vigÃªncia do presente Contrato serÃ¡ de ${diffMonths} (${diffMonthsExtenso}) meses, com inÃ­cio em ${dtInicio} e tÃ©rmino em ${dtFim}, encerrando-se automaticamente ao final desse perÃ­odo, independentemente de aviso ou notificaÃ§Ã£o.`, false, 5);
  printParagraph("Â§1Âº. O Contrato poderÃ¡ ser prorrogado mediante anuÃªncia expressa de ambas as Partes, formalizada por escrito antes do tÃ©rmino de sua vigÃªncia, por meio de termo aditivo, no qual serÃ£o estabelecidos o novo prazo e, se aplicÃ¡vel, as demais condiÃ§Ãµes da prorrogaÃ§Ã£o.", false, 5);
  printParagraph("Â§2Âº. A franquia mensal mÃ­nima de horas por equipamento Ã© devida integralmente em cada mÃªs de vigÃªncia, ainda que a utilizaÃ§Ã£o seja inferior, ressalvadas apenas as deduÃ§Ãµes previstas na ClÃ¡usula Quarta e os meses de mobilizaÃ§Ã£o e desmobilizaÃ§Ã£o, em que o valor serÃ¡ proporcional aos dias Ãºteis de disponibilizaÃ§Ã£o.", false, 5);
  printParagraph("Â§3Âº. A LOCATÃRIA poderÃ¡ resilir unilateralmente o presente Contrato mediante comunicaÃ§Ã£o escrita Ã  LOCADORA com antecedÃªncia mÃ­nima de 30 (trinta) dias corridos, respondendo pelos valores devidos atÃ© a efetiva devoluÃ§Ã£o do bem, observada, em qualquer caso, a franquia mÃ­nima do perÃ­odo, inclusive durante o prazo de aviso prÃ©vio.", false, 5);
  printParagraph("Â§4Âº. NÃ£o observado o aviso prÃ©vio previsto no parÃ¡grafo anterior, serÃ¡ devida multa equivalente a 1 (uma) franquia mensal mÃ­nima por equipamento, sem prejuÃ­zo dos valores em aberto e das perdas e danos comprovadas.", false, 8);

  // â”€â”€â”€ CLÃUSULA TERCEIRA â€” PREÃ‡OS, REAJUSTE E REEQUILÃBRIO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA TERCEIRA â€” PREÃ‡OS, REAJUSTE E REEQUILÃBRIO", true, 4);
  const valorTotalMensal = params.equipamentos.reduce((sum, e) => sum + e.valor_mensal, 0);
  const valorGlobalEstimado = valorTotalMensal * diffMonths;
  const valorGlobalExt = valorExtenso(valorGlobalEstimado);
  printParagraph(`O valor global estimado do presente Contrato Ã© de ${fmtBRL(valorGlobalEstimado)} (${valorGlobalExt}), calculado conforme os valores unitÃ¡rios e prazos indicados. Este valor serve apenas como parÃ¢metro orÃ§amentÃ¡rio, nÃ£o constituindo qualquer compromisso das Partes de virem a efetivamente utilizÃ¡-lo integralmente, sendo devido o montante referente ao perÃ­odo em que o equipamento estiver Ã  disposiÃ§Ã£o da LOCATÃRIA, observadas a franquia mÃ­nima e as premissas de mediÃ§Ã£o estabelecidas neste instrumento.`, false, 5);
  printParagraph("Â§1Âº. Os preÃ§os unitÃ¡rios pactuados serÃ£o fixos e irreajustÃ¡veis pelo prazo de 12 (doze) meses contados da assinatura. Prorrogado o Contrato por prazo superior, os valores serÃ£o reajustados pela variaÃ§Ã£o acumulada do IPCA/IBGE no perÃ­odo ou, na sua falta, pelo IGP-M/FGV, mediante formalizaÃ§Ã£o de termo aditivo.", false, 5);
  printParagraph("Â§2Âº. Na hipÃ³tese de criaÃ§Ã£o, majoraÃ§Ã£o, extinÃ§Ã£o ou alteraÃ§Ã£o de tributos, encargos ou obrigaÃ§Ãµes legais que incidam sobre o objeto deste Contrato, inclusive em razÃ£o da transiÃ§Ã£o prevista na Emenda Constitucional nÂº 132/2023 e na Lei Complementar nÂº 214/2025, as Partes promoverÃ£o, em atÃ© 15 (quinze) dias contados da vigÃªncia da alteraÃ§Ã£o, a revisÃ£o dos preÃ§os para recomposiÃ§Ã£o do equilÃ­brio econÃ´mico-financeiro original, mediante termo aditivo.", false, 8);

  // â”€â”€â”€ CLÃUSULA QUARTA â€” MEDIÃ‡ÃƒO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA QUARTA â€” MEDIÃ‡ÃƒO", true, 4);
  const diaMedFim = parseInt(params.dia_fim_medicao || "25", 10);
  printParagraph("Os boletins de mediÃ§Ã£o serÃ£o elaborados mensalmente pela LOCADORA com base nas informaÃ§Ãµes obtidas por meio da telemetria do equipamento, que prevalecerÃ£o em caso de divergÃªncia, e serÃ£o encaminhados Ã  LOCATÃRIA por e-mail para os endereÃ§os indicados neste Contrato.", false, 5);
  printParagraph("Â§1Âº. A LOCATÃRIA terÃ¡ o prazo de 5 (cinco) dias Ãºteis, contados do envio, para manifestar eventual discordÃ¢ncia, apresentando, obrigatoriamente, as evidÃªncias que comprovem a divergÃªncia. Decorrido o referido prazo sem manifestaÃ§Ã£o, os boletins serÃ£o considerados aprovados, prosseguindo-se com o faturamento e o envio para pagamento.", false, 5);
  printParagraph(`Â§2Âº. Na hipÃ³tese de falha ou indisponibilidade da telemetria, a mediÃ§Ã£o serÃ¡ apurada pela leitura do horÃ­metro do equipamento, cujo registro a LOCATÃRIA se obriga a enviar Ã  LOCADORA atÃ© o dia ${diaMedFim} (${dayToExtenso(String(diaMedFim))} e ${diaMedFim < 30 ? "" : "trinta"}) de cada mÃªs. NÃ£o enviado o registro, a mediÃ§Ã£o do perÃ­odo serÃ¡ apurada pela mÃ©dia dos 2 (dois) Ãºltimos meses medidos ou pela franquia mÃ­nima contratada, prevalecendo o maior valor.`, false, 5);
  printParagraph("Â§3Âº. A intervenÃ§Ã£o, remoÃ§Ã£o, desativaÃ§Ã£o, obstruÃ§Ã£o ou alteraÃ§Ã£o do sistema de telemetria ou de rastreamento implica a apuraÃ§Ã£o da mediÃ§Ã£o pela franquia mÃ­nima contratada, sem prejuÃ­zo das penalidades previstas na ClÃ¡usula DÃ©cima Oitava.", false, 5);
  printParagraph("Â§4Âº. SerÃ£o deduzidas das mediÃ§Ãµes as horas em que o equipamento estiver parado para manutenÃ§Ãµes preventivas e/ou corretivas, por defeitos no equipamento ou por quaisquer outros aspectos de responsabilidade da LOCADORA que impeÃ§am a operaÃ§Ã£o efetiva do equipamento/veÃ­culo, exceto em caso de mau uso ou culpa da LOCATÃRIA, quando esta deverÃ¡ arcar com os custos sem deduÃ§Ãµes na mediÃ§Ã£o.", false, 8);

  // â”€â”€â”€ CLÃUSULA QUINTA â€” PAGAMENTOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA QUINTA â€” PAGAMENTOS", true, 4);
  const prazoPagDias = params.prazo_pagamento_dias || 30;
  const prazoPagExt = integerToExtenso(prazoPagDias);
  printParagraph(`Pela locaÃ§Ã£o do bem objeto do presente Contrato, a LOCATÃRIA pagarÃ¡ Ã  LOCADORA os valores unitÃ¡rios conforme prazo acordado entre as Partes, com vencimento em ${prazoPagDias} (${prazoPagExt}) dias a partir da aprovaÃ§Ã£o do boletim de mediÃ§Ã£o.`, false, 5);
  printParagraph("Â§1Âº. Os pagamentos decorrentes deste Contrato deverÃ£o ser efetuados exclusivamente por meio de boleto bancÃ¡rio emitido pela LOCADORA.", false, 5);
  const multaAtraso = params.multa_atraso_percent || 2;
  const jurosAtraso = params.juros_atraso_percent || 1;
  printParagraph(`Â§2Âº. Em caso de atraso no pagamento de quaisquer valores devidos decorrentes deste Contrato, o montante em atraso serÃ¡ acrescido de multa moratÃ³ria e nÃ£o compensatÃ³ria de ${multaAtraso}% (${percentToExtenso(multaAtraso)}), alÃ©m de juros de mora de ${jurosAtraso}% (${percentToExtenso(jurosAtraso)}) ao mÃªs, calculados pro rata die, e correÃ§Ã£o monetÃ¡ria apurada pelo IGPM/FGV (ou Ã­ndice oficial que venha a substituÃ­-lo), calculados desde a data do vencimento atÃ© a data do efetivo pagamento.`, false, 5);
  printParagraph("Â§3Âº. As informaÃ§Ãµes sobre programaÃ§Ãµes dos pagamentos e/ou comprovantes de pagamento deverÃ£o ser solicitadas Ã  LOCADORA, atravÃ©s dos e-mails: alyson.oliveira@busatoloc.com.br, financeiro@busatotransportes.com.br, samara.rodrigues@busatoloc.com.br.", false, 5);
  printParagraph("DADOS BANCÃRIOS: Favorecido: BUSATO LOCAÃ‡Ã•ES E SERVIÃ‡OS LTDA | CNPJ: 54.167.719/0001-40.", true, 8);

  // â”€â”€â”€ CLÃUSULA SEXTA â€” DAS OBRIGAÃ‡Ã•ES DA LOCADORA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA SEXTA â€” DAS OBRIGAÃ‡Ã•ES DA LOCADORA", true, 4);
  const obrigLocadora = [
    "Prestar Ã  LOCATÃRIA quaisquer esclarecimentos e informaÃ§Ãµes que se fizerem necessÃ¡rios para utilizaÃ§Ã£o do bem locado.",
    "Fornecer o bem locado em perfeitas condiÃ§Ãµes de uso, conforme orientaÃ§Ãµes de manutenÃ§Ãµes/operaÃ§Ã£o do fabricante.",
    "Realizar as manutenÃ§Ãµes preventivas conforme plano de manutenÃ§Ã£o, podendo a LOCADORA indicar a concessionÃ¡ria ou oficina credenciada mais prÃ³xima para efetivar a manutenÃ§Ã£o devida ou autorizar que a manutenÃ§Ã£o seja realizada pela prÃ³pria LOCATÃRIA, mediante reembolso previamente aprovado.",
    "Vistoriar e providenciar evidÃªncias na saÃ­da e na chegada do bem locado para comprovar o estado em que se encontra, na forma da ClÃ¡usula Oitava.",
    "Arcar com os custos de licenciamento de trÃ¢nsito do veÃ­culo, IPVA e seguro obrigatÃ³rio.",
    "Fornecer Ã  LOCATÃRIA cÃ³pia dos documentos e orientaÃ§Ãµes referentes ao bem locado, sendo: CRLV, plano de manutenÃ§Ã£o, laudo eletromecÃ¢nico e laudo de opacidade, quando aplicÃ¡veis ao equipamento.",
    "Substituir o bem locado, caso este apresente defeitos atestados pela equipe de manutenÃ§Ã£o alÃ©m dos considerados normais, disponibilizando Ã  LOCATÃRIA outro equipamento/veÃ­culo com as mesmas caracterÃ­sticas tÃ©cnicas e em perfeito estado de funcionamento, no prazo de 48 (quarenta e oito) horas, ressalvadas as hipÃ³teses previstas na ClÃ¡usula DÃ©cima Quinta.",
  ];
  obrigLocadora.forEach(o => printParagraph(`â€¢ ${o}`, false, 4));
  y += 4;

  // â”€â”€â”€ CLÃUSULA SÃ‰TIMA â€” DAS OBRIGAÃ‡Ã•ES DA LOCATÃRIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA SÃ‰TIMA â€” DAS OBRIGAÃ‡Ã•ES DA LOCATÃRIA", true, 4);
  const obrigLocataria = [
    "Pagar Ã  LOCADORA os valores devidos pela locaÃ§Ã£o, obedecendo aos preÃ§os e prazos pactuados.",
    "Apresentar mensalmente Ã  LOCADORA os registros constantes do horÃ­metro para realizaÃ§Ã£o da mediÃ§Ã£o, na forma da ClÃ¡usula Quarta.",
    "Informar Ã  LOCADORA a necessidade de realizaÃ§Ã£o de manutenÃ§Ã£o corretiva no equipamento assim que constatada qualquer falha, anormalidade ou avaria.",
    "Durante o perÃ­odo locado, toda lubrificaÃ§Ã£o periÃ³dica necessÃ¡ria ao funcionamento serÃ¡ de inteira responsabilidade da LOCATÃRIA, devendo ser realizada conforme recomendaÃ§Ãµes do fabricante.",
    "Danos decorrentes de falta de lubrificaÃ§Ã£o, uso sem Ã³leo/fluido, combustÃ­vel adulterado, combustÃ­vel inadequado, impurezas, Ã¡gua no sistema, mistura incorreta, operaÃ§Ã£o com nÃ­vel baixo, superaquecimento ou travamento serÃ£o considerados mau uso, respondendo a LOCATÃRIA integralmente por reparos, peÃ§as e mÃ£o de obra.",
    "Arcar com o abastecimento do equipamento durante todo o perÃ­odo da locaÃ§Ã£o, recebendo e devolvendo o bem com o mesmo nÃ­vel de combustÃ­vel, e utilizar combustÃ­vel e lubrificantes dentro das especificaÃ§Ãµes do fabricante.",
    "Conservar no equipamento/veÃ­culo o adesivo contendo a identificaÃ§Ã£o e dados da LOCADORA.",
    "Usar o bem locado de forma adequada e para o fim a que se destina, sob pena de responder civil e criminalmente pelo mau uso ou deterioraÃ§Ã£o do bem.",
    "NÃ£o sublocar, emprestar, ceder, arrendar ou permitir que terceiros alheios ao presente contrato utilizem do veÃ­culo locado no todo ou em parte, temporÃ¡ria ou definitivamente.",
    "Responsabilizar-se pela mobilizaÃ§Ã£o e desmobilizaÃ§Ã£o do bem locado, arcando com todos e quaisquer gastos, fretes e afins.",
    "Fica expressamente vedado Ã  LOCATÃRIA realizar qualquer tipo de intervenÃ§Ã£o, remoÃ§Ã£o, substituiÃ§Ã£o, desativaÃ§Ã£o ou alteraÃ§Ã£o no sistema de rastreamento e de telemetria instalado pela LOCADORA.",
    "Em caso de locaÃ§Ã£o de mÃ¡quina, caberÃ¡ exclusivamente Ã  LOCATÃRIA arcar com todos os custos de pneus, material rodante, dentes, lÃ¢minas, adaptadores e quaisquer outros componentes que tenham contato direto com o solo durante a operaÃ§Ã£o do equipamento, salvo desgaste decorrente de uso regular dentro das especificaÃ§Ãµes do fabricante.",
    "Designar para a operaÃ§Ã£o do equipamento profissional habilitado, capacitado e treinado, na forma da ClÃ¡usula DÃ©cima Terceira.",
    "Comunicar imediatamente Ã  LOCADORA qualquer acidente, sinistro, furto, roubo, autuaÃ§Ã£o, notificaÃ§Ã£o ou citaÃ§Ã£o relacionada ao bem locado, na forma das ClÃ¡usulas DÃ©cima, DÃ©cima Segunda e DÃ©cima Terceira.",
  ];
  obrigLocataria.forEach(o => printParagraph(`â€¢ ${o}`, false, 4));
  y += 4;

  // â”€â”€â”€ CLÃUSULA OITAVA â€” DA ENTREGA, DA VISTORIA E DA DEVOLUÃ‡ÃƒO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA OITAVA â€” DA ENTREGA, DA VISTORIA E DA DEVOLUÃ‡ÃƒO", true, 4);
  printParagraph("A entrega e a devoluÃ§Ã£o do bem locado serÃ£o formalizadas por Termo de Vistoria, assinado por prepostos de ambas as Partes, acompanhado de registro fotogrÃ¡fico e da leitura do horÃ­metro, na forma do Anexo I, que integra este Contrato para todos os fins.", false, 5);
  printParagraph("Â§1Âº. A ausÃªncia ou a recusa injustificada de preposto da LOCATÃRIA Ã  vistoria autoriza a LOCADORA a realizÃ¡-la unilateralmente, mediante laudo com registro fotogrÃ¡fico, presumindo-se verdadeiro o estado nele consignado.", false, 5);
  printParagraph("Â§2Âº. A LOCATÃRIA receberÃ¡ o bem locado em condiÃ§Ãµes normais de uso e assim o manterÃ¡ atÃ© a sua efetiva devoluÃ§Ã£o, ressalvados os desgastes naturais, nÃ£o podendo realizar qualquer modificaÃ§Ã£o no veÃ­culo/equipamento locado sem a prÃ©via e expressa autorizaÃ§Ã£o da LOCADORA.", false, 5);
  printParagraph("Â§3Âº. Considera-se desgaste natural exclusivamente aquele decorrente do uso regular do equipamento dentro das especificaÃ§Ãµes do fabricante. NÃ£o se enquadram nesse conceito amassados, trincas, rupturas, empenamentos, perda de componentes, danos a pneus e ao material rodante por corte, impacto ou uso indevido, nem danos elÃ©tricos, hidrÃ¡ulicos ou de motor decorrentes de operaÃ§Ã£o inadequada, falta de lubrificaÃ§Ã£o, sobrecarga ou superaquecimento.", false, 5);
  printParagraph("Â§4Âº. Findo o prazo estabelecido, ou rescindida a locaÃ§Ã£o por qualquer motivo, a LOCATÃRIA restituirÃ¡ o bem locado Ã  LOCADORA em atÃ© 5 (cinco) dias Ãºteis, no pÃ¡tio da LOCADORA ou em local por ela indicado, com o mesmo nÃ­vel de combustÃ­vel da entrega e em condiÃ§Ãµes de limpeza que permitam a vistoria.", false, 5);
  printParagraph("Â§5Âº. NÃ£o devolvido o bem no prazo do parÃ¡grafo anterior, incidirÃ¡, por dia de atraso e por equipamento, diÃ¡ria equivalente a 1/30 (um trinta avos) do valor mensal contratado, sem prejuÃ­zo das perdas e danos e das medidas possessÃ³rias e criminais cabÃ­veis.", false, 5);
  printParagraph("Â§6Âº. Constatados danos na vistoria de devoluÃ§Ã£o, a LOCADORA apresentarÃ¡ orÃ§amento em atÃ© 10 (dez) dias Ãºteis, que a LOCATÃRIA deverÃ¡ quitar em 10 (dez) dias contados do recebimento, facultada Ã  LOCADORA a realizaÃ§Ã£o do reparo em oficina de sua escolha, respondendo ainda a LOCATÃRIA pelo valor da locaÃ§Ã£o correspondente ao perÃ­odo de indisponibilidade do equipamento em reparo.", false, 8);

  // â”€â”€â”€ CLÃUSULA NONA â€” DOS SEGUROS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA NONA â€” DOS SEGUROS", true, 4);
  printParagraph("A contrataÃ§Ã£o do seguro do bem locado, em companhia seguradora de idoneidade reconhecida, para cobertura de danos materiais e pessoais a terceiros e para cobrir os gastos em decorrÃªncia de acidente envolvendo o bem, ficarÃ¡ a cargo da LOCADORA, sendo que o custo do prÃªmio e da franquia serÃ¡ suportado conforme negociaÃ§Ã£o comercial entre as Partes.", false, 5);
  printParagraph("Â§1Âº. A LOCADORA se compromete a enviar a apÃ³lice do veÃ­culo/equipamento locado apÃ³s a assinatura do presente Contrato, a qual integra este instrumento como Anexo III.", false, 5);
  printParagraph("Â§2Âº. Acionado o seguro em decorrÃªncia de sinistro causado durante a utilizaÃ§Ã£o do bem pela LOCATÃRIA, esta ficarÃ¡ responsÃ¡vel pelo pagamento integral da franquia, conforme apÃ³lice, pela participaÃ§Ã£o obrigatÃ³ria no aviso de sinistro e pelo fornecimento de toda a documentaÃ§Ã£o exigida pela seguradora, no prazo por esta estipulado.", false, 5);
  printParagraph("Â§3Âº. A LOCATÃRIA declara ciÃªncia de que a apÃ³lice pode nÃ£o cobrir determinados eventos, entre eles operaÃ§Ã£o fora de via pÃºblica, tombamento, capotamento, submersÃ£o, danos ao material rodante, uso por condutor ou operador nÃ£o habilitado, conduÃ§Ã£o sob efeito de Ã¡lcool ou substÃ¢ncia psicoativa, agravamento de risco e uso em local diverso do contratado.", false, 5);
  printParagraph("Â§4Âº. A LOCATÃRIA manterÃ¡, durante toda a vigÃªncia, seguro de responsabilidade civil que cubra danos a terceiros decorrentes da operaÃ§Ã£o do equipamento, comprovando a apÃ³lice Ã  LOCADORA sempre que solicitado.", false, 5);
  printParagraph("Â§5Âº. Em caso de acidente, furto, roubo ou qualquer sinistro, a LOCATÃRIA comunicarÃ¡ a LOCADORA imediatamente e registrarÃ¡ o boletim de ocorrÃªncia em atÃ© 24 (vinte e quatro) horas, entregando cÃ³pia Ã  LOCADORA.", false, 8);

  // â”€â”€â”€ CLÃUSULA DÃ‰CIMA â€” DOS DANOS, DA PERDA, DO FURTO E DO ROUBO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA DÃ‰CIMA â€” DOS DANOS, DA PERDA, DO FURTO E DO ROUBO", true, 4);
  printParagraph("A LOCATÃRIA Ã© depositÃ¡ria do bem locado e responde por sua guarda e conservaÃ§Ã£o durante todo o perÃ­odo da locaÃ§Ã£o, respondendo integralmente por danos, perda total, furto, roubo, apropriaÃ§Ã£o indÃ©bita e quaisquer eventos que atinjam o equipamento.", false, 5);
  printParagraph("Â§1Âº. Na hipÃ³tese de nÃ£o ser possÃ­vel acionar o seguro vigente, ou em caso de recusa de cobertura por parte da seguradora devido a dolo, culpa, negligÃªncia, imperÃ­cia, imprudÃªncia, mau uso ou agravamento de risco por parte da LOCATÃRIA ou de seus prepostos, a LOCATÃRIA serÃ¡ integral e exclusivamente responsÃ¡vel pelo pagamento de todas as perdas e danos.", false, 5);
  printParagraph("Â§2Âº. Na hipÃ³tese do parÃ¡grafo anterior, a LOCATÃRIA ressarcirÃ¡ Ã  LOCADORA o valor correspondente a 100% (cem por cento) do valor de mercado para reposiÃ§Ã£o do equipamento sinistrado, apurado pela tabela do fabricante ou por laudo de avaliaÃ§Ã£o, ou arcarÃ¡ com os custos totais e integrais dos reparos necessÃ¡rios, sem prejuÃ­zo da cobranÃ§a do valor da locaÃ§Ã£o pelos dias em que o equipamento ficar inoperante, atÃ© a efetiva reposiÃ§Ã£o ou conclusÃ£o do reparo.", false, 5);
  printParagraph("Â§3Âº. Os valores previstos nesta clÃ¡usula serÃ£o pagos em atÃ© 10 (dez) dias contados da apresentaÃ§Ã£o do orÃ§amento, do laudo ou da negativa da seguradora, o que ocorrer por Ãºltimo.", false, 8);

  // â”€â”€â”€ CLÃUSULA DÃ‰CIMA PRIMEIRA â€” DA RESPONSABILIDADE PERANTE TERCEIROS â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA DÃ‰CIMA PRIMEIRA â€” DA RESPONSABILIDADE PERANTE TERCEIROS E DO DIREITO DE REGRESSO", true, 4);
  printParagraph("A LOCATÃRIA serÃ¡ integral e exclusivamente responsÃ¡vel pela posse, guarda, conduÃ§Ã£o, operaÃ§Ã£o e uso dos veÃ­culos/equipamentos locados, incluindo a observÃ¢ncia das normas de trÃ¢nsito, de seguranÃ§a e das legislaÃ§Ãµes aplicÃ¡veis.", false, 5);
  printParagraph("Â§1Âº. A responsabilidade da LOCATÃRIA abrange todas as aÃ§Ãµes ou omissÃµes praticadas por seus motoristas, operadores, empregados, prepostos ou qualquer outra pessoa que utilizar os veÃ­culos/equipamentos, sendo de sua inteira responsabilidade quaisquer danos causados a terceiros, danos ambientais, multas, infraÃ§Ãµes, perdas, acidentes de trÃ¢nsito, furtos, roubos ou quaisquer outros eventos relacionados ao uso dos bens locados.", false, 5);
  printParagraph("Â§2Âº. As Partes reconhecem que a estipulaÃ§Ã£o prevista nesta clÃ¡usula produz efeitos entre elas, nÃ£o sendo oponÃ­vel a terceiros estranhos a este Contrato. Acionada a LOCADORA, judicial ou administrativamente, em razÃ£o de evento ocorrido na vigÃªncia da locaÃ§Ã£o, a LOCATÃRIA obriga-se a assumir o polo passivo da demanda ou a integrar a lide, a apresentar defesa Ã s suas expensas e a reembolsar integralmente a LOCADORA de todo valor que esta venha a desembolsar a tÃ­tulo de condenaÃ§Ã£o, acordo, custas, despesas processuais e honorÃ¡rios, independentemente do resultado do processo.", false, 5);
  printParagraph("Â§3Âº. O reembolso dos honorÃ¡rios advocatÃ­cios contratuais da LOCADORA observarÃ¡ o valor do percentual de 5% sobre o valor envolvido, conforme acordado entre as Partes, comprovado por relatÃ³rio de atividades, abrangendo a elaboraÃ§Ã£o de petiÃ§Ãµes, os deslocamentos para audiÃªncias e as demais despesas judiciais e administrativas.", false, 5);
  printParagraph("Â§4Âº. A LOCATÃRIA comunicarÃ¡ a LOCADORA em atÃ© 48 (quarenta e oito) horas de qualquer acidente, notificaÃ§Ã£o, autuaÃ§Ã£o, reclamaÃ§Ã£o ou citaÃ§Ã£o relacionada ao bem locado, sob pena de responder pelas consequÃªncias da perda de prazo.", false, 8);

  // â”€â”€â”€ CLÃUSULA DÃ‰CIMA SEGUNDA â€” DAS INFRAÃ‡Ã•ES DE TRÃ‚NSITO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA DÃ‰CIMA SEGUNDA â€” DAS INFRAÃ‡Ã•ES DE TRÃ‚NSITO", true, 4);
  printParagraph("As infraÃ§Ãµes de trÃ¢nsito e as penalidades administrativas praticadas durante a vigÃªncia deste Contrato sÃ£o de responsabilidade exclusiva da LOCATÃRIA, que responderÃ¡ pelo valor das multas, juros, encargos e despesas correlatas.", false, 5);
  printParagraph("Â§1Âº. Recebida da LOCADORA a comunicaÃ§Ã£o da autuaÃ§Ã£o, a LOCATÃRIA fornecerÃ¡, em atÃ© 10 (dez) dias corridos, os dados e a documentaÃ§Ã£o do condutor infrator, com a assinatura dos formulÃ¡rios necessÃ¡rios Ã  indicaÃ§Ã£o prevista no art. 257, Â§7Âº, do CÃ³digo de TrÃ¢nsito Brasileiro.", false, 5);
  printParagraph("Â§2Âº. Descumprido o prazo do parÃ¡grafo anterior, a LOCATÃRIA responderÃ¡ integralmente pela multa aplicada ao proprietÃ¡rio do veÃ­culo na forma do art. 257, Â§8Âº, do CÃ³digo de TrÃ¢nsito Brasileiro, bem como pelos custos de defesa e de recursos administrativos.", false, 5);
  printParagraph("Â§3Âº. Os valores das multas poderÃ£o ser descontados da garantia prestada ou cobrados diretamente da LOCATÃRIA, a critÃ©rio da LOCADORA.", false, 8);

  // â”€â”€â”€ CLÃUSULA DÃ‰CIMA TERCEIRA â€” DA RESPONSABILIDADE TRABALHISTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA DÃ‰CIMA TERCEIRA â€” DA RESPONSABILIDADE TRABALHISTA", true, 4);
  printParagraph("A locaÃ§Ã£o nÃ£o envolve fornecimento de mÃ£o de obra, nÃ£o se estabelecendo qualquer vÃ­nculo empregatÃ­cio, de subordinaÃ§Ã£o ou de prestaÃ§Ã£o de serviÃ§os entre a LOCADORA e os empregados ou prepostos da LOCATÃRIA.", false, 5);
  printParagraph("Â§1Âº. A LOCATÃRIA obriga-se a designar para a operaÃ§Ã£o do equipamento profissional habilitado, capacitado e treinado na forma das normas regulamentadoras aplicÃ¡veis, entre elas a NR-11, a NR-12 e a NR-18, mantendo em dia ordem de serviÃ§o, certificados de treinamento, exames ocupacionais e fornecimento de equipamentos de proteÃ§Ã£o individual.", false, 5);
  printParagraph("Â§2Âº. A LOCATÃRIA responde por todos os encargos trabalhistas, previdenciÃ¡rios, fiscais e securitÃ¡rios de seus empregados e prepostos, bem como por acidentes do trabalho ocorrido na operaÃ§Ã£o do equipamento.", false, 5);
  printParagraph("Â§3Âº. A LOCATÃRIA obriga-se a reembolsar a LOCADORA de qualquer valor que esta venha a suportar em razÃ£o de reclamaÃ§Ã£o trabalhista, aÃ§Ã£o indenizatÃ³ria por acidente do trabalho ou autuaÃ§Ã£o administrativa decorrente da execuÃ§Ã£o deste Contrato, inclusive honorÃ¡rios advocatÃ­cios, custas e despesas processuais.", false, 8);

  // â”€â”€â”€ CLÃUSULA DÃ‰CIMA QUARTA â€” DA RESPONSABILIDADE AMBIENTAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA DÃ‰CIMA QUARTA â€” DA RESPONSABILIDADE AMBIENTAL", true, 4);
  printParagraph("A LOCATÃRIA responde integralmente por danos ambientais decorrentes da operaÃ§Ã£o do bem locado, entre eles vazamento de Ã³leo, derramamento de combustÃ­vel e contaminaÃ§Ã£o de solo e de corpos d'Ã¡gua, obrigando-se a manter no local kit de contenÃ§Ã£o de emergÃªncia e a comunicar imediatamente Ã  LOCADORA e aos Ã³rgÃ£os competentes qualquer ocorrÃªncia.", false, 5);
  printParagraph("ParÃ¡grafo Ãºnico. Acionada a LOCADORA, na condiÃ§Ã£o de proprietÃ¡ria do equipamento, por Ã³rgÃ£o ambiental, em aÃ§Ã£o civil pÃºblica ou em qualquer outra medida, a LOCATÃRIA a reembolsarÃ¡ integralmente de multas, custos de remediaÃ§Ã£o, condenaÃ§Ãµes, despesas processuais e honorÃ¡rios, sem prejuÃ­zo da rescisÃ£o imediata do Contrato.", false, 8);

  // â”€â”€â”€ CLÃUSULA DÃ‰CIMA QUINTA â€” DA LIMITAÃ‡ÃƒO DE RESPONSABILIDADE DA LOCADORA â”€â”€â”€
  printParagraph("CLÃUSULA DÃ‰CIMA QUINTA â€” DA LIMITAÃ‡ÃƒO DE RESPONSABILIDADE DA LOCADORA", true, 4);
  printParagraph("A LOCADORA responde exclusivamente pela disponibilizaÃ§Ã£o do bem locado em condiÃ§Ãµes de uso e pela manutenÃ§Ã£o preventiva prevista neste Contrato, nÃ£o respondendo, em nenhuma hipÃ³tese, por lucros cessantes, perda de produtividade, atraso de cronograma, penalidades contratuais aplicadas por terceiros Ã  LOCATÃRIA ou quaisquer danos indiretos decorrentes da indisponibilidade do equipamento.", false, 5);
  printParagraph("ParÃ¡grafo Ãºnico. O prazo de substituiÃ§Ã£o do equipamento previsto na ClÃ¡usula SÃ©tima fica suspenso nas hipÃ³teses de caso fortuito, forÃ§a maior, indisponibilidade de frota, greve, restriÃ§Ã£o ao transporte de carga especial ou impedimento de acesso ao canteiro, e a responsabilidade da LOCADORA, em qualquer caso, fica limitada ao valor proporcional da locaÃ§Ã£o correspondente ao perÃ­odo de indisponibilidade.", false, 8);

  // â”€â”€â”€ CLÃUSULA DÃ‰CIMA SEXTA â€” DA FISCALIZAÃ‡ÃƒO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA DÃ‰CIMA SEXTA â€” DA FISCALIZAÃ‡ÃƒO", true, 4);
  printParagraph("A LOCADORA poderÃ¡ fiscalizar a boa utilizaÃ§Ã£o do veÃ­culo/equipamento pela LOCATÃRIA, inclusive mediante inspeÃ§Ã£o no local da obra, mediante comunicaÃ§Ã£o prÃ©via, e em caso de constatar qualquer irregularidade na utilizaÃ§Ã£o do mesmo, a LOCATÃRIA deve providenciar a regularizaÃ§Ã£o imediata, sob pena de rescisÃ£o.", false, 8);

  // â”€â”€â”€ CLÃUSULA DÃ‰CIMA SÃ‰TIMA â€” DO GRAVAME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA DÃ‰CIMA SÃ‰TIMA â€” DO GRAVAME", true, 4);
  printParagraph("Sendo a LOCADORA legÃ­tima proprietÃ¡ria ou possuidora do bem locado, a LOCATÃRIA nÃ£o poderÃ¡ dÃ¡-lo em penhor, cauÃ§Ã£o ou gravÃ¡-lo a favor de terceiros, nem oferecÃª-lo Ã  penhora, obrigando-se a informar imediatamente Ã  LOCADORA qualquer constriÃ§Ã£o judicial que recaia sobre o bem.", false, 8);

  // â”€â”€â”€ CLÃUSULA DÃ‰CIMA OITAVA â€” DAS PENALIDADES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA DÃ‰CIMA OITAVA â€” DAS PENALIDADES", true, 4);
  printParagraph("O descumprimento de qualquer clÃ¡usula ou condiÃ§Ã£o pactuada neste instrumento sujeita a parte infratora Ã  multa nÃ£o compensatÃ³ria equivalente a 1 (uma) franquia mensal mÃ­nima por equipamento envolvido, sem prejuÃ­zo da reparaÃ§Ã£o integral das perdas e danos, dos lucros cessantes e da faculdade de rescisÃ£o imediata do Contrato pela parte inocente.", false, 5);
  printParagraph("ParÃ¡grafo Ãºnico. A multa prevista nesta clÃ¡usula nÃ£o se confunde com a multa moratÃ³ria e os juros incidentes sobre o atraso de pagamento, previstos na ClÃ¡usula Quinta, nem com as indenizaÃ§Ãµes e os reembolsos previstos nas ClÃ¡usulas DÃ©cima, DÃ©cima Primeira, DÃ©cima Segunda, DÃ©cima Quarta e DÃ©cima Quinta, que com ela sÃ£o cumulÃ¡veis.", false, 8);

  // â”€â”€â”€ CLÃUSULA DÃ‰CIMA NONA â€” DO INADIMPLEMENTO E DA RESCISÃƒO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA DÃ‰CIMA NONA â€” DO INADIMPLEMENTO, DO VENCIMENTO ANTECIPADO, DA RESCISÃƒO E DA RETOMADA DO BEM", true, 4);
  printParagraph("O atraso superior a 15 (quinze) dias no pagamento de qualquer valor, a insuficiÃªncia ou a nÃ£o recomposiÃ§Ã£o da garantia, o deslocamento nÃ£o autorizado do equipamento, a sublocaÃ§Ã£o, a cessÃ£o do contrato sem anuÃªncia, o pedido de recuperaÃ§Ã£o judicial ou a falÃªncia da LOCATÃRIA autorizam a LOCADORA a declarar o vencimento antecipado das obrigaÃ§Ãµes e a rescindir o Contrato de pleno direito, independentemente de notificaÃ§Ã£o judicial, nos termos do art. 474 do CÃ³digo Civil.", false, 5);
  printParagraph("Â§1Âº. Rescindido o Contrato por qualquer motivo, a LOCATÃRIA restituirÃ¡ o bem em atÃ© 48 (quarenta e oito) horas e, desde jÃ¡, autoriza expressamente a LOCADORA, seus prepostos e a empresa de transporte por ela contratada a ingressar no local onde o equipamento estiver, em horÃ¡rio comercial, para promover a retirada, sem que isso configure turbaÃ§Ã£o ou esbulho.", false, 5);
  printParagraph("Â§2Âº. A recusa de devoluÃ§Ã£o sujeita a LOCATÃRIA Ã  diÃ¡ria prevista na ClÃ¡usula Oitava e Ã s medidas possessÃ³rias cabÃ­veis, sem prejuÃ­zo das providÃªncias criminais em caso de apropriaÃ§Ã£o indÃ©bita.", false, 8);

  // â”€â”€â”€ CLÃUSULA VIGÃ‰SIMA â€” DO CASO FORTUITO E DA FORÃ‡A MAIOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA VIGÃ‰SIMA â€” DO CASO FORTUITO E DA FORÃ‡A MAIOR", true, 4);
  printParagraph("Nenhuma das Partes responderÃ¡ pelo descumprimento de obrigaÃ§Ã£o que decorra exclusivamente de caso fortuito ou de forÃ§a maior, nos termos do art. 393 do CÃ³digo Civil, devendo a parte afetada comunicar a outra em atÃ© 5 (cinco) dias contados do evento.", false, 5);
  printParagraph("ParÃ¡grafo Ãºnico. A ocorrÃªncia nÃ£o afasta o pagamento dos valores devidos pelo perÃ­odo em que o equipamento esteve Ã  disposiÃ§Ã£o da LOCATÃRIA, nem a responsabilidade desta pela guarda do bem.", false, 8);

  // â”€â”€â”€ CLÃUSULA VIGÃ‰SIMA PRIMEIRA â€” DA PROTEÃ‡ÃƒO DE DADOS E DA TELEMETRIA â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA VIGÃ‰SIMA PRIMEIRA â€” DA PROTEÃ‡ÃƒO DE DADOS E DA TELEMETRIA", true, 4);
  printParagraph("As Partes declaram-se cientes dos direitos, obrigaÃ§Ãµes e penalidades aplicÃ¡veis constantes da Lei Geral de ProteÃ§Ã£o de Dados Pessoais (Lei nÂº 13.709/2018) e obrigam-se a adotar todas as medidas de seguranÃ§a, tÃ©cnicas, organizacionais e administrativas para garantir, por si, bem como por seu pessoal, colaboradores, empregados e subcontratados, o cumprimento da referida legislaÃ§Ã£o.", false, 5);
  printParagraph("Â§1Âº. A LOCATÃRIA declara ciÃªncia de que o bem locado possui sistema de telemetria e de rastreamento, operado pela LOCADORA na condiÃ§Ã£o de controladora, com as finalidades de mediÃ§Ã£o das horas contratadas, proteÃ§Ã£o patrimonial, gestÃ£o de manutenÃ§Ã£o e cumprimento de obrigaÃ§Ãµes legais e contratuais, fundado na execuÃ§Ã£o do contrato e no legÃ­timo interesse, nos termos do art. 7Âº, incisos V e IX, da Lei nÂº 13.709/2018.", false, 5);
  printParagraph("Â§2Âº. A LOCATÃRIA obriga-se a informar seus empregados e prepostos sobre o monitoramento, respondendo perante a LOCADORA por eventual omissÃ£o, e a nÃ£o intervir, remover, desativar ou alterar o sistema instalado.", false, 8);

  // â”€â”€â”€ CLÃUSULA VIGÃ‰SIMA SEGUNDA â€” DO COMPLIANCE E DA CONDUTA EMPRESARIAL â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA VIGÃ‰SIMA SEGUNDA â€” DO COMPLIANCE E DA CONDUTA EMPRESARIAL", true, 4);
  printParagraph("As Partes declaram que conhecem e observam a Lei nÂº 12.846/2013 e a legislaÃ§Ã£o anticorrupÃ§Ã£o aplicÃ¡vel, bem como a legislaÃ§Ã£o trabalhista, ambiental e de seguranÃ§a do trabalho, obrigando-se a nÃ£o empregar trabalho infantil, trabalho forÃ§ado ou em condiÃ§Ãµes anÃ¡logas Ã  de escravo, e a nÃ£o praticar qualquer ato lesivo Ã  administraÃ§Ã£o pÃºblica em razÃ£o deste Contrato.", false, 5);
  printParagraph("ParÃ¡grafo Ãºnico. A violaÃ§Ã£o comprovada do disposto nesta clÃ¡usula autoriza a rescisÃ£o imediata do Contrato, sem prejuÃ­zo das perdas e danos e das penalidades previstas.", false, 8);

  // â”€â”€â”€ CLÃUSULA VIGÃ‰SIMA TERCEIRA â€” DAS DISPOSIÃ‡Ã•ES GERAIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA VIGÃ‰SIMA TERCEIRA â€” DAS DISPOSIÃ‡Ã•ES GERAIS", true, 4);
  printParagraph("Os signatÃ¡rios do presente Contrato asseguram e afirmam que sÃ£o os representantes legais competentes para assumir em nome das partes as obrigaÃ§Ãµes descritas neste instrumento.", false, 5);
  printParagraph("A LOCATÃRIA nÃ£o poderÃ¡, em hipÃ³tese alguma, transferir ou delegar as atribuiÃ§Ãµes e responsabilidades que assume por forÃ§a deste Contrato, a nÃ£o ser com prÃ©via concordÃ¢ncia da LOCADORA.", false, 5);
  printParagraph("As Partes sÃ£o contratantes totalmente independentes, sendo cada uma inteiramente responsÃ¡vel por seus atos, obrigaÃ§Ãµes e conteÃºdo das informaÃ§Ãµes prestadas, em toda e qualquer circunstÃ¢ncia.", false, 5);
  printParagraph("O nÃ£o exercÃ­cio por qualquer das partes de direitos ou faculdades que lhe assistam em decorrÃªncia do presente instrumento nÃ£o afetarÃ¡ aqueles direitos ou faculdades, os quais poderÃ£o ser exercidos a qualquer tempo.", false, 5);
  printParagraph("Este Contrato somente poderÃ¡ ser alterado mediante formalizaÃ§Ã£o de Termo Aditivo assinado por ambas as Partes.", false, 5);
  printParagraph("Integram este Contrato, para todos os fins, o Anexo I â€” Termo de Vistoria de Entrega e DevoluÃ§Ã£o, o Anexo II â€” proposta comercial e quadro de equipamentos, e o Anexo III â€” apÃ³lice de seguro vigente.", false, 5);
  printParagraph("Este Contrato constitui tÃ­tulo executivo extrajudicial, nos termos do art. 784, inciso III, do CÃ³digo de Processo Civil, sendo admitida a assinatura eletrÃ´nica em qualquer das modalidades previstas em lei, dispensada a assinatura de testemunhas quando a integridade do documento for conferida por provedor de assinatura, na forma do art. 784, Â§4Âº, do mesmo CÃ³digo.", false, 8);

  // â”€â”€â”€ CLÃUSULA VIGÃ‰SIMA QUARTA â€” DO FORO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  printParagraph("CLÃUSULA VIGÃ‰SIMA QUARTA â€” DO FORO", true, 4);
  printParagraph("Fica eleito o foro da Comarca da Serra, Estado do EspÃ­rito Santo, com renÃºncia expressa a qualquer outro, por mais privilegiado que seja, para dirimir as controvÃ©rsias oriundas deste Contrato.", false, 5);
  printParagraph("E, por estarem justas e contratadas, as Partes assinam o presente instrumento, em via eletrÃ´nica ou em 2 (duas) vias de igual teor e forma, na presenÃ§a de 2 (duas) testemunhas.", false, 10);

  // Date and Signatures
  checkPageBreak(65);
  const now = new Date();
  const meses = ["janeiro", "fevereiro", "marÃ§o", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
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
  doc.text("BUSATO LOCAÃ‡Ã•ES E SERVIÃ‡OS LTDA.", margin, y + 4);
  doc.text("LOCADORA", margin, y + 8);

  doc.text(locatariaNome.toUpperCase().substring(0, 42), pw - margin - 75, y + 4);
  doc.text("LOCATÃRIA", pw - margin - 75, y + 8);

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
