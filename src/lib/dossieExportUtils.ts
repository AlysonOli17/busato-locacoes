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

export async function exportDossieToPDF(
  funcionario: any, 
  avaliacoes: any[], 
  testes: any[], 
  pdis: any[], 
  download: boolean = true,
  chartImages?: { evolucao?: string, radar?: string, disc?: string, comparativo?: string },
  insights?: any[]
) {
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

  await loadLogo();

  if (logoCache) {
    doc.addImage(logoCache, "PNG", margin, y, 36, 9);
    y += 15;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("BUSATO", margin, y);
    y += 10;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`DOSSIÊ ANALÍTICO DE FUNCIONÁRIO`, pw / 2, y, { align: "center" });
  y += 12;

  // Informações do Funcionário
  const infoHeaders = [["INFORMAÇÕES GERAIS", ""]];
  const dataAdmissao = funcionario.data_admissao ? new Date(funcionario.data_admissao + "T00:00:00").toLocaleDateString("pt-BR") : "N/A";
  
  const infoBody = [
    ["Nome:", funcionario.nome],
    ["Cargo:", funcionario.cargo || "—"],
    ["Setor:", funcionario.setor || "—"],
    ["Status:", funcionario.status || "Ativo"],
    ["Data de Admissão:", dataAdmissao]
  ];

  autoTable(doc, {
    startY: y,
    head: infoHeaders,
    body: infoBody,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, textColor: [0, 0, 0], lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: { 0: { fontStyle: "bold", width: 40 } },
    theme: "striped"
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Avaliações de Desempenho
  if (avaliacoes && avaliacoes.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("HISTÓRICO DE AVALIAÇÕES", margin, y);
    y += 5;

    const avHeaders = [["Data", "Tipo", "Técnica", "Equipe", "Média"]];
    const avBody = avaliacoes.map(a => {
      const dataStr = a.criado_em ? new Date(a.criado_em).toLocaleDateString("pt-BR") : "—";
      const media = ((a.nota_tecnica || 0) + (a.nota_pontualidade || 0) + (a.nota_trabalho_equipe || 0) + (a.nota_proatividade || 0) + (a.nota_cuidado_equipamentos || 0)) / 5;
      return [
        dataStr,
        a.tipo === 'Autoavaliacao' ? 'Autoavaliação' : '180 Graus',
        (a.nota_tecnica || 0).toString(),
        (a.nota_trabalho_equipe || 0).toString(),
        media.toFixed(1)
      ];
    });

    autoTable(doc, {
      startY: y,
      head: avHeaders,
      body: avBody,
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 9, textColor: [0, 0, 0], lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
      theme: "grid"
    });
    
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Testes Comportamentais (DISC / PDA)
  if (testes && testes.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ÚLTIMO TESTE COMPORTAMENTAL", margin, y);
    y += 5;

    const ultimoTeste = testes[0];
    const testeHeaders = [["Fator DISC", "Nota", "PDA (Energia Vital)"]];
    const testeBody = [
      ["Executor (D)", (ultimoTeste.resultado_d || 0).toString(), `${ultimoTeste.nivel_energia || 0}%`],
      ["Comunicador (I)", (ultimoTeste.resultado_i || 0).toString(), ""],
      ["Planejador (S)", (ultimoTeste.resultado_s || 0).toString(), ""],
      ["Analista (C)", (ultimoTeste.resultado_c || 0).toString(), ""]
    ];

    autoTable(doc, {
      startY: y,
      head: testeHeaders,
      body: testeBody,
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 9, textColor: [0, 0, 0], lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
      theme: "grid"
    });
    
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Gráficos (Evolução e Radar)
  if (chartImages?.evolucao || chartImages?.radar) {
    if (y > ph - 100) { doc.addPage(); y = 20; }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("GRÁFICOS DE ANÁLISE", margin, y);
    y += 10;

    const availableWidth = contentWidth;
    let currentX = margin;

    if (chartImages.evolucao && chartImages.radar) {
      const propsEvo = doc.getImageProperties(chartImages.evolucao);
      const propsRad = doc.getImageProperties(chartImages.radar);
      const imgW = (availableWidth - 5) / 2;
      const hEvo = imgW * (propsEvo.height / propsEvo.width);
      const hRad = imgW * (propsRad.height / propsRad.width);
      
      doc.addImage(chartImages.evolucao, "PNG", currentX, y, imgW, hEvo);
      doc.addImage(chartImages.radar, "PNG", currentX + imgW + 5, y, imgW, hRad);
      y += Math.max(hEvo, hRad) + 12;
    } else if (chartImages.evolucao) {
      const propsEvo = doc.getImageProperties(chartImages.evolucao);
      const imgW = availableWidth * 0.8;
      const hEvo = imgW * (propsEvo.height / propsEvo.width);
      doc.addImage(chartImages.evolucao, "PNG", currentX + (availableWidth - imgW)/2, y, imgW, hEvo);
      y += hEvo + 12;
    } else if (chartImages.radar) {
      const propsRad = doc.getImageProperties(chartImages.radar);
      const imgW = availableWidth * 0.8;
      const hRad = imgW * (propsRad.height / propsRad.width);
      doc.addImage(chartImages.radar, "PNG", currentX + (availableWidth - imgW)/2, y, imgW, hRad);
      y += hRad + 12;
    }
  }

  // Detalhamento Comportamental (DISC)
  const ultimoTeste = testes.length > 0 ? testes[0] : null;
  if (ultimoTeste) {
    if (y > ph - 60) { doc.addPage(); y = 20; }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("DETALHAMENTO COMPORTAMENTAL (DISC)", margin, y);
    y += 5;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Perfil Predominante: ${ultimoTeste.perfil_predominante || 'N/A'}`, margin, y);
    y += 8;

    const barWidth = contentWidth;
    const barHeight = 4;
    const maxScore = 20; // safe max for visual scaling
    
    const drawBar = (label: string, score: number, rgb: [number, number, number]) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(label, margin, y);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const scoreText = `${score} pts`;
      doc.text(scoreText, margin + barWidth - doc.getTextWidth(scoreText), y);
      
      y += 2;
      
      doc.setFillColor(230, 230, 230);
      doc.rect(margin, y, barWidth, barHeight, 'F');
      
      const fillW = barWidth * (Math.min(score, maxScore) / maxScore);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(margin, y, fillW, barHeight, 'F');
      
      y += 8;
    };

    drawBar("D - Dominância (Executor)", ultimoTeste.resultado_d || 0, [239, 68, 68]);
    drawBar("I - Influência (Comunicador)", ultimoTeste.resultado_i || 0, [234, 179, 8]);
    drawBar("S - Estabilidade (Planejador)", ultimoTeste.resultado_s || 0, [34, 197, 94]);
    drawBar("C - Conformidade (Analista)", ultimoTeste.resultado_c || 0, [59, 130, 246]);

    if (ultimoTeste.nivel_energia !== undefined && ultimoTeste.nivel_energia !== null) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Nível de Energia Vital (PDA)", margin, y);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const eText = `${ultimoTeste.nivel_energia}%`;
      doc.text(eText, margin + barWidth - doc.getTextWidth(eText), y);
      
      y += 2;
      doc.setFillColor(230, 230, 230);
      doc.rect(margin, y, barWidth, barHeight, 'F');
      
      const eFillW = barWidth * (ultimoTeste.nivel_energia / 100);
      const eColor = ultimoTeste.nivel_energia < 30 ? [239, 68, 68] : ultimoTeste.nivel_energia < 70 ? [59, 130, 246] : [34, 197, 94];
      doc.setFillColor(eColor[0], eColor[1], eColor[2]);
      doc.rect(margin, y, eFillW, barHeight, 'F');
      y += 12;
    }
    
    doc.setTextColor(0, 0, 0);

    // NOVO: Renderizar a Análise Qualitativa Detalhada Premium
    y = renderDiscPremium(doc, y, margin, contentWidth, ph, ultimoTeste);
  }

  // Comparativo de Avaliação
  const autoAvaliacao = avaliacoes.find(a => a.tipo === 'Autoavaliacao');
  const liderAvaliacao = avaliacoes.find(a => a.tipo === '180_Graus');
  if (autoAvaliacao || liderAvaliacao) {
    if (y > ph - 80) { doc.addPage(); y = 20; }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("COMPARATIVO DE AVALIAÇÃO RECENTE", margin, y);
    y += 5;

    const compHeaders = [["Competência", "Autoavaliação (1-5)", "Visão do Líder (1-5)", "Gap"]];
    const compBody = [
      ["Qualidade Técnica", autoAvaliacao?.nota_tecnica || "—", liderAvaliacao?.nota_tecnica || "—", (autoAvaliacao?.nota_tecnica || 0) - (liderAvaliacao?.nota_tecnica || 0)],
      ["Pontualidade/Assiduidade", autoAvaliacao?.nota_pontualidade || "—", liderAvaliacao?.nota_pontualidade || "—", (autoAvaliacao?.nota_pontualidade || 0) - (liderAvaliacao?.nota_pontualidade || 0)],
      ["Trabalho em Equipe", autoAvaliacao?.nota_trabalho_equipe || "—", liderAvaliacao?.nota_trabalho_equipe || "—", (autoAvaliacao?.nota_trabalho_equipe || 0) - (liderAvaliacao?.nota_trabalho_equipe || 0)],
      ["Proatividade", autoAvaliacao?.nota_proatividade || "—", liderAvaliacao?.nota_proatividade || "—", (autoAvaliacao?.nota_proatividade || 0) - (liderAvaliacao?.nota_proatividade || 0)],
      ["Cuidado c/ Equipamentos", autoAvaliacao?.nota_cuidado_equipamentos || "—", liderAvaliacao?.nota_cuidado_equipamentos || "—", (autoAvaliacao?.nota_cuidado_equipamentos || 0) - (liderAvaliacao?.nota_cuidado_equipamentos || 0)]
    ];

    autoTable(doc, {
      startY: y,
      head: compHeaders,
      body: compBody.map(row => {
         const gap = row[3] as number;
         const gapStr = gap > 0 ? `+${gap}` : gap.toString();
         return [row[0], row[1], row[2], gap === 0 ? "0" : gapStr];
      }),
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 9, textColor: [0, 0, 0], lineColor: [220, 220, 220], lineWidth: 0.1, halign: 'center' },
      columnStyles: { 0: { halign: 'left' } },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
      theme: "grid"
    });
    
    y = (doc as any).lastAutoTable.finalY + 8;
    
    // Comentários
    const commentsData = [
      ["Comentários da Autoavaliação:", "Comentários do Líder (180º):"],
      [autoAvaliacao?.observacoes || "Nenhuma observação.", liderAvaliacao?.observacoes || "Nenhuma observação."]
    ];
    
    autoTable(doc, {
      startY: y,
      body: commentsData,
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 9, textColor: [100, 100, 100], cellPadding: 4, lineColor: [220, 220, 220], lineWidth: 0.1 },
      columnStyles: { 0: { cellWidth: contentWidth / 2 }, 1: { cellWidth: contentWidth / 2 } },
      didParseCell: function(data) {
        if (data.row.index === 0) {
           data.cell.styles.fontStyle = 'bold';
           data.cell.styles.textColor = [0, 0, 0];
           data.cell.styles.fillColor = [250, 250, 250];
        }
      },
      theme: "plain"
    });
    
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Insights Cruzados
  if (insights && insights.length > 0) {
    if (y > ph - 40) { doc.addPage(); y = 20; }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("INSIGHTS CRUZADOS (PEOPLE ANALYTICS IA)", margin, y);
    y += 5;

    const insightBody = insights.map(i => [i.texto]);
    
    autoTable(doc, {
      startY: y,
      body: insightBody,
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 9, textColor: [0, 0, 0], lineColor: [220, 220, 220], lineWidth: 0.1 },
      theme: "grid"
    });
    
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Planos de Desenvolvimento Individual (PDI)
  if (pdis && pdis.length > 0) {
    if (y > ph - 40) { doc.addPage(); y = 20; }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PLANOS DE DESENVOLVIMENTO INDIVIDUAL (PDI)", margin, y);
    y += 5;

    const pdiHeaders = [["Tema / Objetivo", "Data Limite", "Status"]];
    const pdiBody = pdis.map(p => [
      p.tema,
      p.data_limite ? new Date(p.data_limite + "T00:00:00").toLocaleDateString("pt-BR") : "—",
      p.status
    ]);

    autoTable(doc, {
      startY: y,
      head: pdiHeaders,
      body: pdiBody,
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 9, textColor: [0, 0, 0], lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
      theme: "grid"
    });
  }

  if (download) {
    doc.save(`Dossie_${funcionario.nome.replace(/\s+/g, "_")}.pdf`);
  }
  
  return doc;
}
