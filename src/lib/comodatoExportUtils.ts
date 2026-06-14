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

function getMesNome(mesIndex: number): string {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  return meses[mesIndex];
}

export async function exportComodatoToPDF(comodato: any, equipamento: any) {
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

  let y = 20;

  // Helper function to print page headers/footers
  const printHeaderFooter = (pageNumber: number) => {
    // Header Logo
    if (logoCache) {
      doc.addImage(logoCache, "PNG", margin, 15, 36, 9);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text("BUSATO", margin, 20);
    }
    // Footer Page Number
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${pageNumber} de 2`, pw - margin, ph - 10, { align: "right" });
  };

  // Helper for page break checks
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > ph - 20) {
      doc.addPage();
      y = 35; // Start position on next page (leaves room for header)
      return true;
    }
    return false;
  };

  // Unified paragraph printer with automatic text justification and wrapping
  const printParagraph = (text: string, isTitle = false, spacing = 5, alignment: "left" | "justify" = "justify") => {
    doc.setFont("helvetica", isTitle ? "bold" : "normal");
    doc.setFontSize(isTitle ? 10 : 9.5);
    doc.setTextColor(0, 0, 0);

    const lines = doc.splitTextToSize(text, contentWidth);
    const needed = lines.length * 4.5 + spacing;
    
    checkPageBreak(needed);

    if (alignment === "justify" && !isTitle) {
      doc.text(text, margin, y, { align: "justify", maxWidth: contentWidth });
    } else {
      doc.text(lines, margin, y);
    }
    y += lines.length * 4.5 + spacing;
  };

  // Pre-load logo to cache
  await loadLogo();

  // Page 1 Setup
  printHeaderFooter(1);
  y = 35;

  // 1. Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("CONTRATO DE COMODATO DE EQUIPAMENTO", pw / 2, y, { align: "center" });
  y += 12;

  // 2. Opening Paragraph
  const openingText = `Pelo presente instrumento particular de contrato de comodato, de um lado, como COMODANTE:
${comodato.comodante_nome.toUpperCase()}, pessoa jurídica de direito privado, com sede na ${comodato.comodante_endereco}, inscrita no CNPJ/MF sob o nº ${comodato.comodante_cnpj}, doravante denominada COMODANTE.

E, de outro lado, como COMODATÁRIA:
${comodato.comodataria_nome.toUpperCase()}, pessoa jurídica de direito privado, com sede na ${comodato.comodataria_endereco}, inscrita no CNPJ/MF sob o nº ${comodato.comodataria_cnpj}, doravante denominada COMODATÁRIA.

As partes acima qualificadas, de comum acordo, celebram o presente contrato de comodato de equipamento, mediante as seguintes cláusulas e condições:`;

  printParagraph(openingText, false, 8, "justify");

  // 3. Clause 1
  printParagraph("CLÁUSULA PRIMEIRA - DO OBJETO", true, 3, "left");
  printParagraph("O presente contrato tem como objeto o empréstimo gratuito dos seguintes equipamentos:", false, 5, "justify");

  // Table of equipment
  const tableHeaders = [["EQUIPAMENTO", "PLACA", "FABRICANTE", "MODELO", "ANO", "CHASSI"]];
  const tableData = [[
    (equipamento.tipo || "—").toUpperCase(),
    (equipamento.tag_placa || "—").toUpperCase(),
    (comodato.fabricante || "—").toUpperCase(),
    (equipamento.modelo || "—").toUpperCase(),
    (comodato.ano || "—"),
    (equipamento.numero_serie || "—").toUpperCase()
  ]];

  checkPageBreak(25); // Ensure enough space for table
  autoTable(doc, {
    startY: y,
    head: tableHeaders,
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      halign: "center",
      valign: "middle",
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [240, 240, 240],
      fontStyle: "bold"
    },
    theme: "grid"
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // 4. Clause 2
  printParagraph("CLÁUSULA SEGUNDA - DO PRAZO", true, 3, "left");
  printParagraph("O prazo do comodato terá início na data da assinatura deste contrato e permanecerá vigente por prazo indeterminado, podendo ser rescindido por qualquer das partes mediante notificação prévia por escrito com antecedência de 30 (trinta) dias.", false, 6, "justify");

  // 5. Clause 3
  printParagraph("CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES DA COMODATÁRIA", true, 3, "left");
  printParagraph("A COMODATÁRIA se compromete a: I - Utilizar o equipamento exclusivamente para os fins a que se destina; II - Zelar pela conservação e manutenção do equipamento, arcando com os custos de eventuais reparos decorrentes do uso inadequado; III - Restituir o equipamento ao COMODANTE no estado em que recebeu, salvo desgastes naturais pelo uso adequado.", false, 6, "justify");

  // 6. Clause 4
  printParagraph("CLÁUSULA QUARTA - DAS OBRIGAÇÕES DO COMODANTE", true, 3, "left");
  printParagraph("A COMODANTE se compromete a: I - Entregar o equipamento em perfeitas condições de funcionamento; II - Permitir a utilização do equipamento pelo tempo de vigência do contrato, salvo rescisão antecipada nos termos da Cláusula Segunda.", false, 6, "justify");

  // 7. Clause 5
  printParagraph("CLÁUSULA QUINTA – DA AUTORIZAÇÃO PARA USO E LOCAÇÃO A TERCEIROS", true, 3, "left");
  printParagraph("A COMODANTE autoriza expressamente a COMODATÁRIA a utilizar o equipamento tanto para fins próprios quanto para locação a terceiros, respondendo esta integralmente pela integridade do bem e pelo cumprimento das condições deste contrato.", false, 6, "justify");

  // FORCE PAGE BREAK FOR PAGE 2
  doc.addPage();
  y = 35;
  printHeaderFooter(2);

  // 8. Clause 6
  printParagraph("CLÁUSULA SEXTA - DA RESCISÃO", true, 3, "left");
  printParagraph("O presente contrato poderá ser rescindido: I - Por mútuo acordo entre as partes; II - Pelo descumprimento de qualquer das obrigações aqui estabelecidas; III - Por interesse unilateral de qualquer das partes, mediante notificação prévia de 30 (trinta) dias.", false, 6, "justify");

  // 9. Clause 7
  printParagraph("CLÁUSULA SÉTIMA - DO FORO", true, 3, "left");
  printParagraph(`Para dirimir quaisquer questões oriundas deste contrato, as partes elegem o foro da Comarca de ${comodato.cidade.split("/")[0]}/ES, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
E, por estarem justas e contratadas, assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença de 02 (duas) testemunhas.`, false, 12, "justify");

  // 10. Date
  const dateObj = parseLocalDate(comodato.data_inicio);
  const dia = dateObj.getDate();
  const mes = getMesNome(dateObj.getMonth());
  const ano = dateObj.getFullYear();
  const locationText = `${comodato.cidade}, ${String(dia).padStart(2, "0")} de ${mes} de ${ano}.`;
  printParagraph(locationText, false, 25, "left");

  // 11. Signature Lines side by side
  const sigWidth = (contentWidth - 15) / 2;
  checkPageBreak(30);

  // Left Signature (Comodante)
  doc.setLineWidth(0.25);
  doc.line(margin, y, margin + sigWidth, y);
  
  // Right Signature (Comodatária)
  doc.line(margin + sigWidth + 15, y, margin + 2 * sigWidth + 15, y);
  
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  
  const comodanteLines = doc.splitTextToSize(comodato.comodante_nome.toUpperCase(), sigWidth);
  doc.text(comodanteLines, margin, y);
  
  const comodatariaLines = doc.splitTextToSize(comodato.comodataria_nome.toUpperCase(), sigWidth);
  doc.text(comodatariaLines, margin + sigWidth + 15, y);
  
  y += Math.max(comodanteLines.length, comodatariaLines.length) * 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`CNPJ: ${comodato.comodante_cnpj}`, margin, y);
  doc.text(`CNPJ: ${comodato.comodataria_cnpj}`, margin + sigWidth + 15, y);

  // Save the PDF
  const safeTitle = `Comodato_${equipamento.tag_placa || "Equipamento"}.pdf`;
  doc.save(safeTitle);
  return doc;
}
