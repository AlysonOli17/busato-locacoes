import { addLetterhead } from "./exportUtils";

const fmt = (v: any) => {
  const val = Number(v);
  if (isNaN(val)) return "0,00";
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface DreExportData {
  dataInicio: string;
  dataFim: string;
  dreStats: any;
  rentabilidadeEquipamentos: any[];
  agingList: any;
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

  const now = new Date();
  const fileDate = now.toISOString().split("T")[0];
  doc.save(`Relatorio_Gerencial_Busato_${fileDate}.pdf`);
};
