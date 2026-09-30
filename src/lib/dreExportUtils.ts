import { addLetterhead } from "./exportUtils";

const fmt = (v: any) => {
  const val = Number(v);
  if (isNaN(val)) return "0,00";
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtH = (v: number) => v.toFixed(1);

interface DreExportData {
  dataInicio: string;
  dataFim: string;
  dreStats: any;
  rentabilidadeEquipamentos: any[];
  agingList: any;
  horasContratuaisStats?: any;
  equipamentos?: any[];
}

export const generateDrePdf = async (data: DreExportData) => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait" });
  let currentY = await addLetterhead(doc, "RELATÓRIO GERENCIAL E DRE (EBITDA)");
  const margin = 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  const periodoStr = `Período Analisado: ${data.dataInicio ? new Date(data.dataInicio + "T00:00:00").toLocaleDateString("pt-BR") : "Início"} a ${data.dataFim ? new Date(data.dataFim + "T00:00:00").toLocaleDateString("pt-BR") : "Hoje"}`;
  doc.text(periodoStr, margin, currentY);
  currentY += 8;

  // 1. DRE Operacional
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("1. Demonstrativo de Resultados (DRE)", margin, currentY);
  currentY += 4;

  const r = data.dreStats;
  const dreTableBody = [
    ["Receita Bruta Operacional", `R$ ${fmt(r.receitaBruta)}`, "100.0%"],
    ["(-) Custos de Manutenção", `R$ ${fmt(r.custoManutencao)}`, `${r.receitaBruta > 0 ? ((r.custoManutencao / r.receitaBruta)*100).toFixed(1) : "0.0"}%`],
    ["(-) Custos de Mobilização", `R$ ${fmt(r.custoMobilizacao)}`, `${r.receitaBruta > 0 ? ((r.custoMobilizacao / r.receitaBruta)*100).toFixed(1) : "0.0"}%`],
    ["(-) Encargos Fixos (Seguros, Parcelas)", `R$ ${fmt(r.custoFixo)}`, `${r.receitaBruta > 0 ? ((r.custoFixo / r.receitaBruta)*100).toFixed(1) : "0.0"}%`],
    ["(-) Outros Custos Diretos", `R$ ${fmt(r.custoOutros)}`, `${r.receitaBruta > 0 ? ((r.custoOutros / r.receitaBruta)*100).toFixed(1) : "0.0"}%`],
    [{ content: "Total de Custos Operacionais", styles: { fontStyle: 'bold' } }, { content: `R$ ${fmt(r.totalCustos)}`, styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, ""],
    [{ content: "LUCRO BRUTO (GROSS PROFIT)", styles: { fontStyle: 'bold' } }, { content: `R$ ${fmt(r.lucroBruto)}`, styles: { fontStyle: 'bold', textColor: r.lucroBruto >= 0 ? [40, 167, 69] : [220, 53, 69] } }, `${r.receitaBruta > 0 ? ((r.lucroBruto / r.receitaBruta)*100).toFixed(1) : "0.0"}%`],
    ["(-) Despesas Fixas (Controladoria)", `R$ ${fmt(r.totalDespesasAdmin)}`, `${r.receitaBruta > 0 ? ((r.totalDespesasAdmin / r.receitaBruta)*100).toFixed(1) : "0.0"}%`],
    [{ content: "EBITDA REAL DA EMPRESA", styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: `R$ ${fmt(r.resultadoEbitda)}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: r.resultadoEbitda >= 0 ? [40, 167, 69] : [220, 53, 69] } }, { content: `${r.margemEbitda.toFixed(1)}%`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]
  ];

  autoTable(doc, {
    startY: currentY,
    head: [["Categoria", "Valor", "Margem"]],
    body: dreTableBody,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 2. AGING LIST (Resumo)
  if (currentY > doc.internal.pageSize.height - 50) {
    doc.addPage();
    currentY = await addLetterhead(doc, "RELATÓRIO GERENCIAL E DRE (EBITDA)");
    doc.text(periodoStr, margin, currentY);
    currentY += 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("2. Resumo de Contas a Receber (Aging List)", margin, currentY);
  currentY += 4;

  const al = data.agingList;
  const agingBody = [
    ["A Vencer (Em Dia)", `R$ ${fmt(al.aVencer)}`],
    ["Atrasado 1 a 30 dias (Cobrança N1)", `R$ ${fmt(al.atrasado1_30)}`],
    ["Atrasado 31 a 60 dias (Cobrança N2)", `R$ ${fmt(al.atrasado31_60)}`],
    ["Atrasado 60+ dias (Crítico)", `R$ ${fmt(al.atrasado60Plus)}`]
  ];

  autoTable(doc, {
    startY: currentY,
    head: [["Status", "Valor"]],
    body: agingBody,
    theme: 'grid',
    headStyles: { fillColor: [52, 73, 94], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin }
  });

  // 3. RENTABILIDADE POR EQUIPAMENTO
  doc.addPage();
  currentY = await addLetterhead(doc, "RENTABILIDADE DE EQUIPAMENTOS");
  doc.text(periodoStr, margin, currentY);
  currentY += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("3. Faturamento e Custos por Equipamento", margin, currentY);
  currentY += 4;

  const rentabilidadeBody = data.rentabilidadeEquipamentos.map(eq => {
    return [
      `${eq.tipo} ${eq.modelo}`,
      eq.tag,
      `R$ ${fmt(eq.receita)}`,
      `R$ ${fmt(eq.despesa)}`,
      `R$ ${fmt(eq.margem)}`,
      `${eq.margemPct.toFixed(1)}%`
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["Equipamento", "Tag/Placa", "Receita (R$)", "Custo Oper. (R$)", "Margem (R$)", "Rentabilidade"]],
    body: rentabilidadeBody,
    theme: 'striped',
    headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right', textColor: [220, 53, 69] },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin },
    didParseCell: function(data: any) {
      if (data.section === 'body' && data.column.index === 4) {
        const rawText = data.cell.raw;
        if (rawText.includes("-")) {
          data.cell.styles.textColor = [220, 53, 69];
        } else {
          data.cell.styles.textColor = [40, 167, 69];
        }
      }
      if (data.section === 'body' && data.column.index === 5) {
         const rawVal = parseFloat(data.cell.raw.replace('%', ''));
         if (rawVal < 0) {
           data.cell.styles.textColor = [220, 53, 69];
         } else if (rawVal >= 30) {
           data.cell.styles.textColor = [40, 167, 69];
         }
      }
    }
  });

  // 4. GESTÃO DE HORAS CONTRATUAIS
  if (data.horasContratuaisStats && data.horasContratuaisStats.list.length > 0) {
    const h = data.horasContratuaisStats;
    const eqs = data.equipamentos || [];

    doc.addPage();
    currentY = await addLetterhead(doc, "GESTÃO DE HORAS CONTRATUAIS");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(periodoStr, margin, currentY);
    currentY += 8;

    // 4.1 KPI Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text("4. Indicadores de Gestão de Horas", margin, currentY);
    currentY += 4;

    const kpiBody = [
      ["Total de Horas Contratadas", `${fmtH(h.totalContratadas)}h`, `${h.totalEquipamentos} equipamento(s)`],
      ["Total de Horas Trabalhadas", `${fmtH(h.totalTrabalhadas)}h`, `${h.taxaUtilizacao.toFixed(1)}% utilização`],
      ["Total de Horas em Corretivas", `${fmtH(h.totalCorretivas)}h`, `${h.taxaCorretiva.toFixed(1)}% das contratadas`],
      [
        { content: "Horas Real Utilizadas", styles: { fontStyle: 'bold' } },
        { content: `${fmtH(h.totalRealUtilizadas)}h`, styles: { fontStyle: 'bold' } },
        { content: `${h.taxaDisponibilidade.toFixed(1)}% disponibilidade`, styles: { fontStyle: 'bold' } }
      ],
      [
        { content: "Taxa de Ociosidade", styles: { fontStyle: 'bold', fillColor: [255, 248, 225] } },
        { content: `${fmtH(Math.max(0, h.totalContratadas - h.totalTrabalhadas))}h`, styles: { fontStyle: 'bold', fillColor: [255, 248, 225] } },
        { content: `${h.taxaOciosidade.toFixed(1)}% ociosidade`, styles: { fontStyle: 'bold', fillColor: [255, 248, 225], textColor: h.taxaOciosidade > 25 ? [220, 53, 69] : h.taxaOciosidade > 10 ? [200, 150, 0] : [40, 167, 69] } }
      ]
    ];

    autoTable(doc, {
      startY: currentY,
      head: [["Indicador", "Valor", "Performance"]],
      body: kpiBody,
      theme: 'grid',
      headStyles: { fillColor: [103, 58, 183], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 50, halign: 'right' }
      },
      margin: { left: margin, right: margin },
      didParseCell: function(cellData: any) {
        if (cellData.section === 'body') {
          // Color code the values
          if (cellData.row.index === 0) {
            cellData.cell.styles.textColor = cellData.column.index === 1 ? [41, 128, 185] : [100, 100, 100];
          }
          if (cellData.row.index === 1 && cellData.column.index === 1) {
            cellData.cell.styles.textColor = [40, 167, 69];
          }
          if (cellData.row.index === 2 && cellData.column.index === 1) {
            cellData.cell.styles.textColor = [220, 53, 69];
          }
          if (cellData.row.index === 3 && cellData.column.index === 1) {
            cellData.cell.styles.textColor = [103, 58, 183];
          }
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // 4.2 Detalhamento por Equipamento
    if (currentY > doc.internal.pageSize.height - 50) {
      doc.addPage();
      currentY = await addLetterhead(doc, "GESTÃO DE HORAS CONTRATUAIS");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(periodoStr, margin, currentY);
      currentY += 8;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text("4.1 Detalhamento por Equipamento", margin, currentY);
    currentY += 4;

    const horasEquipBody = h.list.map((entry: any) => {
      const eq = eqs.find((e: any) => e.id === entry.equipamento_id);
      const utilizacao = entry.horasContratadas > 0 ? (entry.horasTrabalhadas / entry.horasContratadas * 100) : 0;
      const disponibilidade = entry.horasTrabalhadas > 0 ? ((entry.horasTrabalhadas - entry.horasCorretivas) / entry.horasTrabalhadas * 100) : 100;
      const status = utilizacao >= 85 ? "Otimizado" : utilizacao >= 60 ? "Moderado" : utilizacao > 0 ? "Subutilizado" : "Sem Dados";

      return [
        eq ? `${eq.tipo} ${eq.modelo}` : "Desconhecido",
        eq?.tag_placa || "S/P",
        `${fmtH(entry.horasContratadas)}h`,
        `${fmtH(entry.horasTrabalhadas)}h`,
        `${fmtH(entry.horasCorretivas)}h`,
        `${fmtH(entry.horasRealUtilizadas)}h`,
        `${utilizacao.toFixed(1)}%`,
        `${disponibilidade.toFixed(1)}%`,
        status
      ];
    });

    // Add totals row
    horasEquipBody.push([
      { content: "TOTAIS", styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: "", styles: { fillColor: [240, 240, 240] } },
      { content: `${fmtH(h.totalContratadas)}h`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: `${fmtH(h.totalTrabalhadas)}h`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: `${fmtH(h.totalCorretivas)}h`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: `${fmtH(h.totalRealUtilizadas)}h`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: `${h.taxaUtilizacao.toFixed(1)}%`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: `${h.taxaDisponibilidade.toFixed(1)}%`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: "", styles: { fillColor: [240, 240, 240] } },
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Equipamento", "Tag", "Contratadas", "Trabalhadas", "Corretivas", "Real Utiliz.", "Utiliz. %", "Disp. %", "Status"]],
      body: horasEquipBody,
      theme: 'striped',
      headStyles: { fillColor: [103, 58, 183], textColor: 255, fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 16 },
        2: { cellWidth: 20, halign: 'right', textColor: [41, 128, 185] },
        3: { cellWidth: 20, halign: 'right', textColor: [40, 167, 69] },
        4: { cellWidth: 18, halign: 'right', textColor: [220, 53, 69] },
        5: { cellWidth: 20, halign: 'right', textColor: [103, 58, 183] },
        6: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 22, halign: 'center' }
      },
      margin: { left: margin, right: margin },
      didParseCell: function(cellData: any) {
        if (cellData.section === 'body' && cellData.column.index === 6) {
          const rawVal = parseFloat(String(cellData.cell.raw).replace('%', ''));
          if (rawVal >= 85) {
            cellData.cell.styles.textColor = [40, 167, 69];
          } else if (rawVal >= 60) {
            cellData.cell.styles.textColor = [200, 150, 0];
          } else {
            cellData.cell.styles.textColor = [220, 53, 69];
          }
        }
        if (cellData.section === 'body' && cellData.column.index === 7) {
          const rawVal = parseFloat(String(cellData.cell.raw).replace('%', ''));
          if (rawVal >= 95) {
            cellData.cell.styles.textColor = [40, 167, 69];
          } else if (rawVal >= 85) {
            cellData.cell.styles.textColor = [200, 150, 0];
          } else {
            cellData.cell.styles.textColor = [220, 53, 69];
          }
        }
        if (cellData.section === 'body' && cellData.column.index === 8) {
          const val = String(cellData.cell.raw);
          if (val === "Otimizado") {
            cellData.cell.styles.textColor = [40, 167, 69];
            cellData.cell.styles.fontStyle = 'bold';
          } else if (val === "Moderado") {
            cellData.cell.styles.textColor = [200, 150, 0];
            cellData.cell.styles.fontStyle = 'bold';
          } else if (val === "Subutilizado") {
            cellData.cell.styles.textColor = [220, 53, 69];
            cellData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
  }

  const now = new Date();
  const fileDate = now.toISOString().split("T")[0];
  doc.save(`Relatorio_Gerencial_Busato_${fileDate}.pdf`);
};
