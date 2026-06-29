import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { generateDiscAnalysis } from "./discAnalysisEngine";

export function renderDiscPremium(
  doc: jsPDF, 
  y: number, 
  margin: number, 
  contentWidth: number, 
  pageHeight: number, 
  ultimoTeste: any
) {
  const analysis = generateDiscAnalysis(
    ultimoTeste.resultado_d || 0,
    ultimoTeste.resultado_i || 0,
    ultimoTeste.resultado_s || 0,
    ultimoTeste.resultado_c || 0,
    ultimoTeste.perfil_predominante || 'Desconhecido'
  );

  const checkPage = (heightNeeded: number) => {
    if (y + heightNeeded > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawSectionTitle = (title: string, icon: string = "") => {
    checkPage(15);
    doc.setFillColor(240, 245, 255); // Light blue bg
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 60, 150);
    doc.text(`${icon} ${title}`.trim(), margin + 3, y + 5.5);
    y += 12;
  };

  // 1. SUMÁRIO EXECUTIVO
  drawSectionTitle("SUMÁRIO EXECUTIVO E RELACIONAMENTO");

  // Forças e Desafios (2 columns using autoTable)
  const forcesText = "• " + analysis.sumario.forcas.join("\n• ");
  const challengesText = "• " + analysis.sumario.desafios.join("\n• ");
  
  autoTable(doc, {
    startY: y,
    head: [["Principais Forças", "Potenciais Desafios"]],
    body: [[forcesText, challengesText]],
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [248, 250, 252], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: contentWidth / 2, textColor: [34, 139, 34] }, // Greenish
      1: { cellWidth: contentWidth / 2, textColor: [180, 80, 0] } // Orangey
    },
    theme: "grid"
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Comunicação e Ambiente Ideal
  autoTable(doc, {
    startY: y,
    body: [
      ["Estilo de Comunicação", analysis.sumario.comunicacao],
      ["Ambiente Ideal", analysis.sumario.ambiente_ideal],
      ["Dicas p/ Gestão", "• " + analysis.sumario.dicas_gestao.join("\n• ")]
    ],
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, lineColor: [220, 220, 220], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: "bold", textColor: [60, 60, 60], fillColor: [248, 250, 252] },
      1: { cellWidth: contentWidth - 40 }
    },
    theme: "grid"
  });
  y = (doc as any).lastAutoTable.finalY + 12;


  // 2. INFLUÊNCIA SECUNDÁRIA
  drawSectionTitle("A FORÇA DA INFLUÊNCIA SECUNDÁRIA");
  autoTable(doc, {
    startY: y,
    body: [
      [analysis.influencia_secundaria.perfil],
      [analysis.influencia_secundaria.descricao]
    ],
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, lineColor: [200, 200, 240], lineWidth: 0.1 },
    didParseCell: (data) => {
      if (data.row.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [90, 40, 160];
        data.cell.styles.fillColor = [245, 240, 255];
      }
    },
    theme: "grid"
  });
  y = (doc as any).lastAutoTable.finalY + 12;


  // 3. ANÁLISE PROFISSIONAL COMPLETA
  drawSectionTitle("ANÁLISE PROFISSIONAL COMPLETA");
  
  const p = analysis.analise_profissional;
  const cards = [
    ["Concentração e Objetivos", p.concentracao],
    ["Planejamento e Estratégia", p.planejamento],
    ["Tomada de Decisão", p.tomada_decisao],
    ["Perspectiva e Especialização", p.perspectiva],
    ["Dinâmica de Interação", p.interacao],
    ["Organização", p.organizacao],
    ["Ritmo de Trabalho", p.ritmo],
    ["Inovação e Criatividade", p.inovacao]
  ];

  const cardBody = [];
  for (let i = 0; i < cards.length; i += 2) {
    cardBody.push([
      cards[i][0] + "\n\n" + cards[i][1],
      cards[i+1][0] + "\n\n" + cards[i+1][1]
    ]);
  }

  autoTable(doc, {
    startY: y,
    body: cardBody,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, lineColor: [230, 230, 230], lineWidth: 0.1, valign: 'top' },
    columnStyles: {
      0: { cellWidth: contentWidth / 2 },
      1: { cellWidth: contentWidth / 2 }
    },
    theme: "grid"
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // PDI Box
  autoTable(doc, {
    startY: y,
    head: [["Áreas de Desenvolvimento Profissional (PDI Recomendado)"]],
    body: [["• " + p.pdi.join("\n• ")]],
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, lineColor: [200, 220, 255], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 245, 255], textColor: [40, 80, 180], fontStyle: "bold" },
    theme: "grid"
  });
  y = (doc as any).lastAutoTable.finalY + 12;


  // 4. TENDÊNCIAS COMPORTAMENTAIS (SLIDERS)
  drawSectionTitle("TENDÊNCIAS COMPORTAMENTAIS (Sliders)");
  
  const drawSliderRow = (
    labelLeft: string,
    labelRight: string,
    value: number,
    yPos: number
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    
    // Left label
    doc.text(labelLeft, margin + 25, yPos, { align: 'right' });
    
    // Right label
    doc.text(labelRight, margin + contentWidth - 25, yPos, { align: 'left' });

    // Slider Bar
    const barX = margin + 30;
    const barW = contentWidth - 60;
    const barY = yPos - 3;
    const barH = 3;
    
    doc.setFillColor(230, 235, 240);
    doc.rect(barX, barY, barW, barH, 'F');
    
    // Middle tick
    doc.setFillColor(200, 200, 200);
    doc.rect(barX + (barW/2) - 0.5, barY - 1, 1, barH + 2, 'F');

    // Dot
    const mappedX = barX + ((value + 100) / 200) * barW;
    
    let dotColor = [60, 100, 200];
    if (value < -33) dotColor = [220, 100, 50]; 
    else if (value > 33) dotColor = [40, 160, 80]; 

    doc.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
    doc.circle(mappedX, barY + (barH/2), 3, 'F');
  };

  const sl = analysis.sliders;
  const sliderRows = [
    { l: "Pessoas & Relacionamentos", r: "Tarefas & Resultados", v: sl.foco, title: "Foco Principal" },
    { l: "Calmo & Consistente", r: "Rápido & Intenso", v: sl.ritmo, title: "Ritmo de Trabalho" },
    { l: "Colaborativa & Ponderada", r: "Autônoma & Direta", v: sl.decisao, title: "Tomada de Decisão" },
    { l: "Expressiva / Persuasiva", r: "Direta / Objetiva", v: sl.comunicacao, title: "Estilo de Comunicação" },
    { l: "Busca Estabilidade", r: "Busca Flexibilidade/Ação", v: sl.mudancas, title: "Abordagem a Mudanças" },
    { l: "Adaptável / Espontânea", r: "Estruturada / Metódica", v: sl.organizacao, title: "Organização e Planej." },
    { l: "Reservada / Formal", r: "Expansiva / Informal", v: sl.interacao, title: "Interação Social" },
    { l: "Cautelosa / Segura", r: "Ousada / Experimental", v: sl.riscos, title: "Abordagem a Riscos" }
  ];

  checkPage(sliderRows.length * 15 + 10);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const cx = margin + (contentWidth/2);
  doc.text("EXTREMO ESQUERDO", margin + 35, y, { align: 'center' });
  doc.text("CENTRO (EQUILÍBRIO)", cx, y, { align: 'center' });
  doc.text("EXTREMO DIREITO", margin + contentWidth - 35, y, { align: 'center' });
  y += 10;

  for (const row of sliderRows) {
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(row.title, margin + 25, y - 4, { align: 'right' });
    
    drawSliderRow(row.l, row.r, row.v, y);
    y += 14;
  }
  
  y += 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Este diagrama ilustra suas tendências situacionais. O marcador indica a polarização (ou equilíbrio) da sua energia.", cx, y, { align: 'center' });
  y += 12;


  // 5. FORMAÇÃO & CARREIRA
  drawSectionTitle("FORMAÇÃO E SUGESTÕES DE CARREIRA");
  
  autoTable(doc, {
    startY: y,
    body: [
      ["Cursos Técnicos/Tecnólogos", analysis.carreira.tecnicos],
      ["Graduações", analysis.carreira.graduacao],
      ["Cursos Livres", analysis.carreira.livres],
      ["Pós-Graduação", analysis.carreira.pos]
    ],
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, lineColor: [240, 220, 180], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: "bold", textColor: [180, 100, 0], fillColor: [255, 250, 240] },
      1: { cellWidth: contentWidth - 45 }
    },
    theme: "grid"
  });
  
  y = (doc as any).lastAutoTable.finalY + 4;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Nota Importante: O DISC oferece insights valiosos sobre tendências, mas não define capacidades intelectuais.", margin, y);
  
  y += 12;
  
  return y;
}
