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

// Helpers for currency
function fmtCurrency(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return "R$ 0,00";
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function exportAditivoToPDF(aditivo: any, contrato: any, equipamentos: any[], download: boolean = true) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const margin = 20;
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const contentWidth = pw - 2 * margin;

  const brandBlue: [number, number, number] = [41, 128, 185];
  const darkGray: [number, number, number] = [30, 30, 30];
  const medGray: [number, number, number] = [60, 60, 60];
  const lightGray: [number, number, number] = [140, 140, 140];

  let y = 35;

  // Header Footer and Page breaks
  const totalPagesExp = "{total_pages_count_string}";

  await loadLogo();

  const printHeaderFooter = (pageNum: number) => {
    // Header
    if (logoCache) {
      doc.addImage(logoCache, "PNG", margin, 10, 48, 12);
    }
    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...lightGray);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(margin, ph - 15, pw - margin, ph - 15);
    doc.text("BUSATO LOCAÇÕES E SERVIÇOS LTDA  •  CNPJ: 54.167.719/0001-40", margin, ph - 10);
    doc.text(`Página ${pageNum} de ${totalPagesExp}`, pw - margin, ph - 10, { align: "right" });
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > ph - 22) {
      doc.addPage();
      const pageCount = (doc.internal as any).getNumberOfPages();
      printHeaderFooter(pageCount);
      y = 30; // Start position on next page
      return true;
    }
    return false;
  };

  const printParagraph = (text: string, isTitle = false, spacing = 5, alignment: "left" | "justify" | "center" = "justify") => {
    doc.setFont("helvetica", isTitle ? "bold" : "normal");
    doc.setFontSize(isTitle ? 10 : 9.5);
    doc.setTextColor(...(isTitle ? darkGray : medGray));

    const lines = doc.splitTextToSize(text, contentWidth);
    const needed = lines.length * 4.5 + spacing;
    
    checkPageBreak(needed);

    if (alignment === "justify" && !isTitle) {
      doc.text(text, margin, y, { align: "justify", maxWidth: contentWidth });
    } else if (alignment === "center") {
      doc.text(lines, pw / 2, y, { align: "center" });
    } else {
      doc.text(lines, margin, y);
    }
    y += lines.length * 4.5 + spacing;
  };

  printHeaderFooter(1);

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...brandBlue);
  const title = `${aditivo.numero}º TERMO ADITIVO AO CONTRATO DE LOCAÇÃO DE EQUIPAMENTO`;
  const titleLines = doc.splitTextToSize(title, contentWidth - 55);
  doc.text(titleLines, margin + 55, 15);

  doc.setDrawColor(...brandBlue);
  doc.setLineWidth(0.8);
  doc.line(margin, 28, pw - margin, 28);
  y = 35;

  // Qualificação das Partes
  const emp = contrato.empresas;
  const qualifLocadora = `De um lado, como Locadora,\nBUSATO LOCAÇÕES E SERVIÇOS LTDA, empresa estabelecida Av. Coronel Manoel Nunes, 145, Planalto de Carapina, Serra/ES, CEP 29.162-715, inscrita no CNPJ sob o nº 00.865.596/0001-92, neste ato denominada simplesmente Locadora.`;
  
  const qualifLocataria = `De outro lado, como Locatária,\n${emp.razao_social || emp.nome}, empresa estabelecida à ${emp.endereco_logradouro}, nº ${emp.endereco_numero}${emp.endereco_complemento ? ` - ${emp.endereco_complemento}` : ""}, ${emp.endereco_bairro}, ${emp.endereco_cidade} - ${emp.endereco_uf}, inscrita no CNPJ sob o nº ${emp.cnpj}, neste ato denominada simplesmente Locatária.`;
  
  printParagraph(qualifLocadora, false, 8, "left");
  printParagraph(qualifLocataria, false, 8, "left");

  printParagraph(`Resolvem celebrar o presente Termo Aditivo ao Contrato de Locação de Veículo / Equipamento, doravante denominado “Contrato”, mediante as seguintes cláusulas e condições.`);

  y += 5;

  // Cláusula Primeira - Objeto
  printParagraph("CLÁUSULA PRIMEIRA – DO OBJETO E CONDIÇÕES", true, 4);
  printParagraph(`1. Por meio deste instrumento, as Partes acordam em: ${aditivo.motivo}.`);

  if (aditivo.observacoes) {
    printParagraph(`Observações adicionais: ${aditivo.observacoes}`);
  }

  printParagraph(`1.1. Os equipamentos que integram o Contrato, conforme o aditivo, passaram a ser os que aqui seguem listados:`);

  // Tabela de Equipamentos do Aditivo
  const eqs = aditivo.aditivos_equipamentos || [];
  const eqsAtivos = eqs.filter((ae: any) => !ae.data_devolucao);
  const eqsDesmobilizados = eqs.filter((ae: any) => ae.data_devolucao);

  if (eqsAtivos.length > 0) {
    const tableHeaders = [["ITEM", "TIPO", "PLACA/TAG", "MODELO", "Nº SÉRIE", "VALOR", "DATA DE INÍCIO"]];
    const tableBody = eqsAtivos.map((ae: any, idx: number) => {
      const eq = equipamentos.find(e => e.id === ae.equipamento_id);
      return [
        (idx + 1).toString().padStart(2, '0'),
        eq?.tipo || "—",
        eq?.tag_placa || "—",
        eq?.modelo || "—",
        eq?.numero_serie || "—",
        fmtCurrency(ae.valor_hora),
        ae.data_entrega ? new Date(ae.data_entrega + "T00:00:00").toLocaleDateString("pt-BR") : (aditivo.data_inicio ? new Date(aditivo.data_inicio + "T00:00:00").toLocaleDateString("pt-BR") : "—")
      ];
    });

    checkPageBreak(tableBody.length * 8 + 15);

    autoTable(doc, {
      startY: y,
      head: tableHeaders,
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3, textColor: darkGray, halign: "center", valign: "middle" },
      headStyles: { fillColor: brandBlue, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      theme: "striped",
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    printParagraph(`(Nenhum equipamento listado neste aditivo)`, false, 5, "center");
  }

  if (eqsDesmobilizados.length > 0) {
    printParagraph(`1.2. Fica registrado a desmobilização dos seguintes equipamentos:`);
    const tableHeaders = [["ITEM", "TIPO", "PLACA/TAG", "MODELO", "Nº SÉRIE", "VALOR", "DATA DE DEVOLUÇÃO"]];
    const tableBody = eqsDesmobilizados.map((ae: any, idx: number) => {
      const eq = equipamentos.find(e => e.id === ae.equipamento_id);
      return [
        (idx + 1).toString().padStart(2, '0'),
        eq?.tipo || "—",
        eq?.tag_placa || "—",
        eq?.modelo || "—",
        eq?.numero_serie || "—",
        fmtCurrency(ae.valor_hora),
        new Date(ae.data_devolucao + "T00:00:00").toLocaleDateString("pt-BR")
      ];
    });

    checkPageBreak(tableBody.length * 8 + 15);

    autoTable(doc, {
      startY: y,
      head: tableHeaders,
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3, textColor: darkGray, halign: "center", valign: "middle" },
      headStyles: { fillColor: brandBlue, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      theme: "striped",
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Cláusula Segunda - Preço
  printParagraph("CLÁUSULA SEGUNDA – DO PREÇO", true, 4);
  
  // Pegar a hora mínima média ou a principal
  const hm = eqs.length > 0 ? (eqs[0].hora_minima > 0 ? eqs[0].hora_minima : 200) : 200;
  printParagraph(`2. A Locatária pagará à Locadora o valor de acordo com a tabela definida no item 1.1 considerando o mínimo de ${hm} horas mensais por equipamento.`);

  y += 5;

  // Cláusula Terceira - Vigência
  printParagraph("CLÁUSULA TERCEIRA – DA VIGÊNCIA", true, 4);
  const dataInicioStr = aditivo.data_inicio ? new Date(aditivo.data_inicio + "T00:00:00").toLocaleDateString("pt-BR") : "—";
  const dataFimStr = aditivo.data_fim ? new Date(aditivo.data_fim + "T00:00:00").toLocaleDateString("pt-BR") : "—";
  printParagraph(`3. O presente Termo Aditivo terá início em ${dataInicioStr} e término em ${dataFimStr}, podendo ser rescindido por qualquer das partes mediante comunicação prévia, escrita, com antecedência mínima de 5 (cinco) dias, sendo passível de prorrogação de comum acordo entre as partes, conforme necessidade da Locatária.`);

  y += 5;

  // Cláusula Quarta - Ratificação
  printParagraph("CLÁUSULA QUARTA – DAS DEMAIS CONDIÇÕES CONTRATUAIS", true, 4);
  printParagraph(`4. Permanecem inalteradas e em pleno vigor todas as demais cláusulas e condições do contrato original de locação, bem como os termos dos Aditivos anteriores, que não tenham sido expressamente modificadas por este instrumento.`);

  y += 10;

  // Data e Assinaturas
  const hoje = new Date();
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  printParagraph(`E, por assim estarem justas e contratadas, assinam as partes e duas testemunhas o presente instrumento, eletronicamente.\n\nSerra/ES, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`, false, 20, "left");

  checkPageBreak(50);

  const sigWidth = (contentWidth - 15) / 2;
  doc.setLineWidth(0.2);
  doc.setDrawColor(...darkGray);
  
  // Assinaturas Partes
  doc.line(margin, y, margin + sigWidth, y);
  doc.line(margin + sigWidth + 15, y, margin + 2 * sigWidth + 15, y);

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("BUSATO LOCAÇÕES E SERVIÇOS LTDA", margin, y);
  doc.text(emp.razao_social || emp.nome, margin + sigWidth + 15, y);

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ: 54.167.719/0001-40`, margin, y);
  doc.text(`CNPJ: ${emp.cnpj}`, margin + sigWidth + 15, y);

  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("TESTEMUNHAS:", margin, y);
  
  y += 15;
  // Assinaturas Testemunhas
  doc.line(margin, y, margin + sigWidth, y);
  doc.line(margin + sigWidth + 15, y, margin + 2 * sigWidth + 15, y);

  y += 4;
  doc.text("Nome:", margin, y);
  doc.text("Nome:", margin + sigWidth + 15, y);

  y += 6;
  doc.text("CPF:", margin, y);
  doc.text("CPF:", margin + sigWidth + 15, y);

  // Update total pages
  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(totalPagesExp);
  }

  // Save PDF conditionally
  if (download) {
    const filename = `Aditivo_${aditivo.numero}_${emp.nome.replace(/\s+/g, "_")}.pdf`;
    doc.save(filename);
  }
  return doc;
}
