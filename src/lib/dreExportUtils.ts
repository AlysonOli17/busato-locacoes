import { jsPDF } from "jspdf";
import "jspdf-autotable";

let logoCache: string | null = null;
const loadLogo = async (): Promise<string | null> => {
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
};

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
  const doc = new jsPDF("p", "pt", "a4");
  const margin = 40;
  let currentY = margin;

  const logoData = await loadLogo();

  // Função auxiliar para desenhar o cabeçalho em todas as páginas se necessário
  const drawHeader = (title: string) => {
    if (logoData) {
      doc.addImage(logoData, "PNG", margin, currentY, 120, 40);
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, margin + 140, currentY + 15);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    const periodoStr = `Período: ${data.dataInicio ? new Date(data.dataInicio + "T00:00:00").toLocaleDateString("pt-BR") : "Início"} a ${data.dataFim ? new Date(data.dataFim + "T00:00:00").toLocaleDateString("pt-BR") : "Hoje"}`;
    const emissaoStr = `Emissão: ${new Date().toLocaleString("pt-BR")}`;
    
    doc.text(periodoStr, margin + 140, currentY + 30);
    doc.text(emissaoStr, margin + 140, currentY + 42);
    
    currentY += 60;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, currentY, doc.internal.pageSize.width - margin, currentY);
    currentY += 20;
  };

  drawHeader("RELATÓRIO GERENCIAL E DRE (EBITDA)");

  // 1. DRE Operacional
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("1. Demonstrativo de Resultados (DRE)", margin, currentY);
  currentY += 10;

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

  (doc as any).autoTable({
    startY: currentY,
    head: [["Categoria", "Valor", "Margem"]],
    body: dreTableBody,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 300 },
      1: { cellWidth: 100, halign: 'right' },
      2: { cellWidth: 80, halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY + 30;

  // 2. AGING LIST (Resumo)
  if (currentY > doc.internal.pageSize.height - 100) {
    doc.addPage();
    currentY = margin;
    drawHeader("AGING LIST - CONTAS A RECEBER");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("2. Resumo de Contas a Receber (Aging List)", margin, currentY);
    currentY += 10;
  }

  const al = data.agingList;
  const agingBody = [
    ["A Vencer (Em Dia)", `R$ ${fmt(al.aVencer)}`],
    ["Atrasado 1 a 30 dias (Cobrança N1)", `R$ ${fmt(al.atrasado1_30)}`],
    ["Atrasado 31 a 60 dias (Cobrança N2)", `R$ ${fmt(al.atrasado31_60)}`],
    ["Atrasado 60+ dias (Crítico)", `R$ ${fmt(al.atrasado60Plus)}`]
  ];

  (doc as any).autoTable({
    startY: currentY,
    head: [["Status", "Valor"]],
    body: agingBody,
    theme: 'grid',
    headStyles: { fillColor: [52, 73, 94], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 300 },
      1: { cellWidth: 180, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin }
  });

  // 3. RENTABILIDADE POR EQUIPAMENTO
  doc.addPage();
  currentY = margin;
  drawHeader("RENTABILIDADE DE EQUIPAMENTOS");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("3. Faturamento e Custos por Equipamento", margin, currentY);
  currentY += 10;

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

  (doc as any).autoTable({
    startY: currentY,
    head: [["Equipamento", "Tag/Placa", "Receita (R$)", "Custo Oper. (R$)", "Margem (R$)", "Rentabilidade"]],
    body: rentabilidadeBody,
    theme: 'striped',
    headStyles: { fillColor: [44, 62, 80], textColor: 255 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right', textColor: [220, 53, 69] },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right', fontStyle: 'bold' }
    },
    styles: { fontSize: 8 },
    margin: { left: margin, right: margin },
    didParseCell: function(data: any) {
      if (data.section === 'body' && data.column.index === 4) {
        // Pinta de verde se positivo, vermelho se negativo
        const rawText = data.cell.raw;
        if (rawText.includes("-")) {
          data.cell.styles.textColor = [220, 53, 69]; // Vermelho
        } else {
          data.cell.styles.textColor = [40, 167, 69]; // Verde
        }
      }
      if (data.section === 'body' && data.column.index === 5) {
         const rawVal = parseFloat(data.cell.raw.replace('%', ''));
         if (rawVal < 0) {
           data.cell.styles.textColor = [220, 53, 69]; // Vermelho
         } else if (rawVal >= 30) {
           data.cell.styles.textColor = [40, 167, 69]; // Verde
         }
      }
    }
  });

  const now = new Date();
  const fileDate = now.toISOString().split("T")[0];
  doc.save(`Relatorio_Gerencial_Busato_${fileDate}.pdf`);
};
