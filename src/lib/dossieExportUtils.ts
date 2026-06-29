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
  chartImages?: { evolucao?: string, radar?: string },
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
      // Draw both side by side
      const imgW = (availableWidth - 5) / 2;
      doc.addImage(chartImages.evolucao, "PNG", currentX, y, imgW, imgW * 0.6);
      doc.addImage(chartImages.radar, "PNG", currentX + imgW + 5, y, imgW, imgW * 0.6);
      y += (imgW * 0.6) + 12;
    } else if (chartImages.evolucao) {
      const imgW = availableWidth * 0.8;
      doc.addImage(chartImages.evolucao, "PNG", currentX + (availableWidth - imgW)/2, y, imgW, imgW * 0.5);
      y += (imgW * 0.5) + 12;
    } else if (chartImages.radar) {
      const imgW = availableWidth * 0.8;
      doc.addImage(chartImages.radar, "PNG", currentX + (availableWidth - imgW)/2, y, imgW, imgW * 0.5);
      y += (imgW * 0.5) + 12;
    }
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
