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

  let y = 25;

  // 1. Header with Logo
  const logo = await loadLogo();
  if (logo) {
    doc.addImage(logo, "PNG", margin, y, 40, 10);
    y += 18;
  } else {
    // Fallback if logo fails
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("BUSATO", margin, y);
    y += 10;
  }

  // 2. Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("CONTRATO DE COMODATO DE EQUIPAMENTO", pw / 2, y, { align: "center" });
  y += 12;

  // 3. Opening Text (Comodante and Comodatária)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const text1 = `Pelo presente instrumento particular de contrato de comodato, de um lado, como COMODANTE:
${comodato.comodante_nome.toUpperCase()}, pessoa jurídica de direito privado, com sede na ${comodato.comodante_endereco}, inscrita no CNPJ/MF sob o nº ${comodato.comodante_cnpj}, doravante denominada COMODANTE.

E, de outro lado, como COMODATÁRIA:
${comodato.comodataria_nome.toUpperCase()}, pessoa jurídica de direito privado, com sede na ${comodato.comodataria_endereco}, inscrita no CNPJ/MF sob o nº ${comodato.comodataria_cnpj}, doravante denominada COMODATÁRIA.

As partes acima qualificadas, de comum acordo, celebram o presente contrato de comodato de equipamento, mediante as seguintes cláusulas e condições:`;

  const text1Lines = doc.splitTextToSize(text1, contentWidth);
  doc.text(text1Lines, margin, y, { align: "justify" });
  y += text1Lines.length * 5 + 6;

  // 4. CLÁUSULA PRIMEIRA
  doc.setFont("helvetica", "bold");
  doc.text("CLÁUSULA PRIMEIRA - DO OBJETO", margin, y);
  doc.setFont("helvetica", "normal");
  const objText = " O presente contrato tem como objeto o empréstimo gratuito dos seguintes equipamentos:";
  doc.text(objText, margin + doc.getTextWidth("CLÁUSULA PRIMEIRA - DO OBJETO"), y);
  y += 8;

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

  autoTable(doc, {
    startY: y,
    head: tableHeaders,
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [230, 230, 230],
      fontStyle: "bold"
    },
    theme: "grid"
  });

  // Get position after table
  y = (doc as any).lastAutoTable.finalY + 12;

  // 5. CLÁUSULA SEGUNDA
  doc.setFont("helvetica", "bold");
  doc.text("CLÁUSULA SEGUNDA - DO PRAZO", margin, y);
  doc.setFont("helvetica", "normal");
  const prazoText = doc.splitTextToSize(" O prazo do comodato terá início na data da assinatura deste contrato e permanecerá vigente por prazo indeterminado, podendo ser rescindido por qualquer das partes mediante notificação prévia por escrito com antecedência de 30 (trinta) dias.", contentWidth - 62);
  doc.text(prazoText, margin + 62, y);
  y += Math.max(8, prazoText.length * 5) + 6;

  // 6. CLÁUSULA TERCEIRA
  doc.setFont("helvetica", "bold");
  doc.text("CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES DA COMODATÁRIA", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const obligComodataria = "A COMODATÁRIA se compromete a: I - Utilizar o equipamento exclusivamente para os fins a que se destina; II - Zelar pela conservação e manutenção do equipamento, arcando com os custos de eventuais reparos decorrentes do uso inadequado; III - Restituir o equipamento ao COMODANTE no estado em que recebeu, salvo desgastes naturais pelo uso adequado.";
  const obligComLines = doc.splitTextToSize(obligComodataria, contentWidth);
  doc.text(obligComLines, margin, y, { align: "justify" });
  y += obligComLines.length * 5 + 6;

  // 7. CLÁUSULA QUARTA
  doc.setFont("helvetica", "bold");
  doc.text("CLÁUSULA QUARTA - DAS OBRIGAÇÕES DO COMODANTE", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const obligComodante = "A COMODANTE se compromete a: I - Entregar o equipamento em perfeitas condições de funcionamento; II - Permitir a utilização do equipamento pelo tempo de vigência do contrato, salvo rescisão antecipada nos termos da Cláusula Segunda.";
  const obligLendLines = doc.splitTextToSize(obligComodante, contentWidth);
  doc.text(obligLendLines, margin, y, { align: "justify" });
  y += obligLendLines.length * 5 + 6;

  // 8. CLÁUSULA QUINTA
  doc.setFont("helvetica", "bold");
  doc.text("CLÁUSULA QUINTA – DA AUTORIZAÇÃO PARA USO E LOCAÇÃO A TERCEIROS", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const authText = "A COMODANTE autoriza expressamente a COMODATÁRIA a utilizar o equipamento tanto para fins próprios quanto para locação a terceiros, respondendo esta integralmente pela integridade do bem e pelo cumprimento das condições deste contrato.";
  const authLines = doc.splitTextToSize(authText, contentWidth);
  doc.text(authLines, margin, y, { align: "justify" });
  
  // PAGE BREAK FOR PAGE 2
  doc.addPage();
  y = 25;

  // Logo on page 2
  if (logo) {
    doc.addImage(logo, "PNG", margin, y, 40, 10);
    y += 18;
  }

  // 9. CLÁUSULA SEXTA
  doc.setFont("helvetica", "bold");
  doc.text("CLÁUSULA SEXTA - DA RESCISÃO", margin, y);
  doc.setFont("helvetica", "normal");
  const rescisaoText = doc.splitTextToSize(" O presente contrato poderá ser rescindido: I - Por mútuo acordo entre as partes; II - Pelo descumprimento de qualquer das obrigações aqui estabelecidas; III - Por interesse unilateral de qualquer das partes, mediante notificação prévia de 30 (trinta) dias.", contentWidth - 60);
  doc.text(rescisaoText, margin + 60, y);
  y += Math.max(8, rescisaoText.length * 5) + 6;

  // 10. CLÁUSULA SÉTIMA
  doc.setFont("helvetica", "bold");
  doc.text("CLÁUSULA SÉTIMA - DO FORO", margin, y);
  doc.setFont("helvetica", "normal");
  const foroText = doc.splitTextToSize(` Para dirimir quaisquer questões oriundas deste contrato, as partes elegem o foro da Comarca de ${comodato.cidade.split("/")[0]}/ES, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
E, por estarem justas e contratadas, assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença de 02 (duas) testemunhas.`, contentWidth - 52);
  doc.text(foroText, margin + 52, y);
  y += Math.max(8, foroText.length * 5) + 16;

  // 11. Location and Date
  const dateObj = parseLocalDate(comodato.data_inicio);
  const dia = dateObj.getDate();
  const mes = getMesNome(dateObj.getMonth());
  const ano = dateObj.getFullYear();
  const locationText = `${comodato.cidade}, ${String(dia).padStart(2, "0")} de ${mes} de ${ano}.`;
  doc.setFont("helvetica", "normal");
  doc.text(locationText, margin, y);
  y += 25;

  // 12. Signatures side by side
  const sigWidth = (contentWidth - 10) / 2;
  
  // Comodante Signature Line
  doc.setFont("helvetica", "normal");
  doc.line(margin, y, margin + sigWidth, y, "F");
  y += 4;
  doc.setFont("helvetica", "bold");
  const cNameLines = doc.splitTextToSize(comodato.comodante_nome.toUpperCase(), sigWidth);
  doc.text(cNameLines, margin, y);
  y += cNameLines.length * 4;
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ: ${comodato.comodante_cnpj}`, margin, y);

  // Restore Y to draw Comodatária Signature Line
  let yComod = y - (cNameLines.length * 4) - 4;
  doc.line(margin + sigWidth + 10, yComod, margin + 2 * sigWidth + 10, yComod, "F");
  yComod += 4;
  doc.setFont("helvetica", "bold");
  const targetNameLines = doc.splitTextToSize(comodato.comodataria_nome.toUpperCase(), sigWidth);
  doc.text(targetNameLines, margin + sigWidth + 10, yComod);
  yComod += targetNameLines.length * 4;
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ: ${comodato.comodataria_cnpj}`, margin + sigWidth + 10, yComod);

  // Page Numbers
  const totalPages = 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("1", pw - margin - 2, ph - 10);
  doc.setPage(1);
  doc.text("1", pw - margin - 2, ph - 10);

  // Save the PDF
  const safeTitle = `Comodato_${equipamento.tag_placa || "Equipamento"}.pdf`;
  doc.save(safeTitle);
}
