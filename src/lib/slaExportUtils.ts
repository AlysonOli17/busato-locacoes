import { addLetterhead } from "./exportUtils";
import type { SlaRegistro } from "@/components/SlaTab";

interface SlaExportData {
  dataInicio?: string;
  dataFim?: string;
  selectedSetor: string;
  statusFilter: string;
  kpis: {
    total: number;
    emAndamento: number;
    dentroPrazo: number;
    atrasados: number;
    concluidos: number;
    taxaSucesso: string;
  };
  registrosFiltrados: SlaRegistro[];
  empresas: any[];
  equipamentos: any[];
  getStatusSla: (r: SlaRegistro) => { label: string; variant: string; color: string; bg: string };
  formatDiffTime: (r: SlaRegistro) => string;
}

export const generateSlaPdf = async (data: SlaExportData) => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait" });
  let currentY = await addLetterhead(doc, "RELATÓRIO DE SLAs E PRAZOS OPERACIONAIS");
  const margin = 14;

  // Subtítulo com período e filtros aplicados
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);

  const periodoStr = `Período Analisado: ${
    data.dataInicio ? new Date(data.dataInicio + "T00:00:00").toLocaleDateString("pt-BR") : "Início"
  } a ${
    data.dataFim ? new Date(data.dataFim + "T00:00:00").toLocaleDateString("pt-BR") : "Hoje"
  }`;

  const setorStr = data.selectedSetor === "all" ? "Todos os Setores" : data.selectedSetor;
  const statusMap: Record<string, string> = {
    all: "Todos os Status",
    em_aberto: "Em Aberto",
    atrasados: "Atrasados / Críticos",
    concluidos: "Concluídos",
  };
  const filtroStr = `Setor: ${setorStr}  |  Filtro de Status: ${statusMap[data.statusFilter] || "Todos"}`;

  doc.text(`${periodoStr}   •   ${filtroStr}`, margin, currentY);
  currentY += 8;

  // 1. Indicadores Gerais de SLA (KPIs)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("1. Indicadores Gerais de Cumprimento (KPIs)", margin, currentY);
  currentY += 4;

  const { kpis } = data;
  const kpiBody: any[] = [
    [
      { content: "Cumprimento Global de SLA", styles: { fontStyle: "bold" } },
      { content: `${kpis.taxaSucesso}%`, styles: { fontStyle: "bold" } },
      `${kpis.dentroPrazo} atendimento(s) no prazo estipulado`,
    ],
    [
      "Demandas Ativas (Em Andamento)",
      `${kpis.emAndamento}`,
      "Processos correndo tempo de SLA",
    ],
    [
      { content: "Estouradas / Críticas", styles: { fontStyle: "bold" } },
      { content: `${kpis.atrasados}`, styles: { fontStyle: "bold" } },
      kpis.atrasados > 0 ? "Requer intervenção imediata da gestão" : "Nenhum atraso registrado",
    ],
    [
      "Histórico Finalizado",
      `${kpis.concluidos}`,
      "Total de demandas fechadas no período",
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [["Indicador", "Resultado", "Detalhamento Operacional"]],
    body: kpiBody,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 65 },
      1: { cellWidth: 35, halign: "right", fontStyle: "bold" },
      2: { cellWidth: 82 },
    },
    margin: { left: margin, right: margin },
    didParseCell: function (cellData: any) {
      if (cellData.section === "body") {
        if (cellData.row.index === 0 && cellData.column.index === 1) {
          const taxa = parseFloat(kpis.taxaSucesso);
          cellData.cell.styles.textColor = taxa >= 80 ? [40, 167, 69] : taxa >= 50 ? [200, 150, 0] : [220, 53, 69];
        }
        if (cellData.row.index === 1 && cellData.column.index === 1) {
          cellData.cell.styles.textColor = [41, 128, 185];
        }
        if (cellData.row.index === 2) {
          if (kpis.atrasados > 0) {
            if (cellData.column.index === 1 || cellData.column.index === 2) {
              cellData.cell.styles.textColor = [220, 53, 69];
            }
          } else if (cellData.column.index === 1) {
            cellData.cell.styles.textColor = [40, 167, 69];
          }
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 2. Resumo por Setor
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("2. Desempenho por Setor Operacional", margin, currentY);
  currentY += 4;

  const setoresList = ["Oficina", "Compras", "RH", "Financeiro", "Logística"];
  const setorBody: any[] = setoresList.map((setor) => {
    const regs = data.registrosFiltrados.filter((r) => r.setor === setor);
    const total = regs.length;
    let ativas = 0;
    let noPrazo = 0;
    let atrasadas = 0;

    regs.forEach((r) => {
      const st = data.getStatusSla(r);
      if (r.status === "Em Andamento") {
        ativas++;
        if (st.label.includes("Atrasado")) atrasadas++;
        else noPrazo++;
      } else if (r.status.startsWith("Concluído")) {
        if (r.status === "Concluído no Prazo") noPrazo++;
        else atrasadas++;
      }
    });

    const avaliados = noPrazo + atrasadas;
    const cumprimento = avaliados > 0 ? `${((noPrazo / avaliados) * 100).toFixed(1)}%` : "100.0%";

    return [setor, `${total}`, `${ativas}`, `${noPrazo}`, `${atrasadas}`, cumprimento];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["Setor", "Total Demandas", "Em Andamento", "Dentro do Prazo", "Estouradas / Atraso", "Cumprimento"]],
    body: setorBody,
    theme: "striped",
    headStyles: { fillColor: [52, 73, 94], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 28, halign: "center", textColor: [40, 167, 69] },
      4: { cellWidth: 30, halign: "center" },
      5: { cellWidth: 26, halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
    didParseCell: function (cellData: any) {
      if (cellData.section === "body") {
        if (cellData.column.index === 4) {
          const val = parseInt(String(cellData.cell.raw), 10);
          if (val > 0) {
            cellData.cell.styles.textColor = [220, 53, 69];
            cellData.cell.styles.fontStyle = "bold";
          } else {
            cellData.cell.styles.textColor = [120, 120, 120];
          }
        }
        if (cellData.column.index === 5) {
          const pct = parseFloat(String(cellData.cell.raw).replace("%", ""));
          cellData.cell.styles.textColor = pct >= 80 ? [40, 167, 69] : pct >= 50 ? [200, 150, 0] : [220, 53, 69];
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 3. Acompanhamento em Tempo Real (Listagem Detalhada)
  if (currentY > doc.internal.pageSize.height - 50) {
    doc.addPage();
    currentY = await addLetterhead(doc, "RELATÓRIO DE SLAs E PRAZOS OPERACIONAIS");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`${periodoStr}   •   ${filtroStr}`, margin, currentY);
    currentY += 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`3. Acompanhamento em Tempo Real (${data.registrosFiltrados.length} ocorrências)`, margin, currentY);
  currentY += 4;

  const detalhesBody = data.registrosFiltrados.map((r) => {
    const st = data.getStatusSla(r);
    const equip = data.equipamentos.find((e) => e.id === r.equipamento_id);
    const emp = data.empresas.find((e) => e.id === r.empresa_id);

    const equipStr = equip
      ? `${equip.tipo} ${equip.modelo} (${equip.tag_placa || "S/ Placa"})`
      : "-";
    const equipClienteStr = emp ? `${equipStr}\n${emp.nome}` : equipStr;

    const demandaStr = `${r.titulo}${r.prioridade === "Crítica" ? " [URGENTE]" : ""}\n${r.processo}${
      r.descricao ? ` • ${r.descricao}` : ""
    }`;

    const inicioFmt = new Date(r.data_inicio).toLocaleDateString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const metaStr = `${r.tempo_meta} ${r.unidade_tempo}\nInício: ${inicioFmt}`;

    const limiteFmt = r.data_previsao
      ? new Date(r.data_previsao).toLocaleDateString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";
    const tempoRestanteStr = `${data.formatDiffTime(r)}\nLimite: ${limiteFmt}`;

    return [
      r.setor,
      demandaStr,
      equipClienteStr,
      r.responsavel || "Não atribuído",
      metaStr,
      tempoRestanteStr,
      st.label,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        "Setor",
        "Processo & Demanda",
        "Equipamento / Cliente",
        "Responsável",
        "Meta SLA",
        "Tempo Restante / Conclusão",
        "Status",
      ],
    ],
    body:
      detalhesBody.length > 0
        ? detalhesBody
        : [["-", "Nenhuma ocorrência encontrada para os filtros selecionados", "-", "-", "-", "-", "-"]],
    theme: "striped",
    headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 6.5, cellPadding: 2.5, valign: "middle" },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: "bold" },
      1: { cellWidth: 44 },
      2: { cellWidth: 36 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 18, halign: "center", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
    didParseCell: function (cellData: any) {
      if (cellData.section === "body" && cellData.column.index === 6) {
        const raw = String(cellData.cell.raw || "");
        if (raw.includes("Atrasado") || raw.includes("Atraso")) {
          cellData.cell.styles.textColor = [220, 53, 69];
          cellData.cell.styles.fillColor = [254, 242, 242];
        } else if (raw.includes("Risco")) {
          cellData.cell.styles.textColor = [200, 150, 0];
          cellData.cell.styles.fillColor = [255, 251, 235];
        } else if (raw.includes("Concluído no Prazo")) {
          cellData.cell.styles.textColor = [40, 167, 69];
          cellData.cell.styles.fillColor = [240, 253, 244];
        } else if (raw.includes("Dentro do Prazo")) {
          cellData.cell.styles.textColor = [41, 128, 185];
        }
      }
      if (cellData.section === "body" && cellData.column.index === 5) {
        const raw = String(cellData.cell.raw || "");
        if (raw.includes("atrasado") || raw.includes("após o limite")) {
          cellData.cell.styles.textColor = [220, 53, 69];
          cellData.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const now = new Date();
  const fileDate = now.toISOString().split("T")[0];
  doc.save(`Relatorio_SLA_Busato_${fileDate}.pdf`);
};

