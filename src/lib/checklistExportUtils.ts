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

export async function exportChecklistToPDF(checklist: any, equipamento: any, contrato: any) {
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

  // Pre-load logo to cache
  await loadLogo();

  // Header Logo
  if (logoCache) {
    doc.addImage(logoCache, "PNG", margin, y, 36, 9);
    y += 15;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("BUSATO", margin, y);
    y += 10;
  }

  // Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`RELATÓRIO DE VISTORIA - CHECKLIST DE ${checklist.tipo.toUpperCase()}`, pw / 2, y, { align: "center" });
  y += 10;

  // Info Block Table
  const clientName = contrato?.empresas?.nome || "Cliente avulso / Não alocado";
  const infoHeaders = [["INFORMAÇÕES DA VISTORIA", ""]];
  const infoBody = [
    ["Equipamento:", `${equipamento.tipo} ${equipamento.modelo} (${equipamento.tag_placa || "Sem Placa"})`],
    ["Nº de Série / Chassi:", equipamento.numero_serie || "—"],
    ["Cliente / Obra:", clientName],
    ["Tipo de Inspeção:", `Checklist de ${checklist.tipo}`],
    ["Data da Vistoria:", new Date(checklist.data + "T00:00:00").toLocaleDateString("pt-BR")],
    ["Horímetro Registrado:", `${Number(checklist.horimetro || 0).toLocaleString("pt-BR")} h`],
    ["Responsável (Inspetor):", checklist.inspector],
    ["Situação Geral:", checklist.status.toUpperCase()]
  ];

  autoTable(doc, {
    startY: y,
    head: infoHeaders,
    body: infoBody,
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: [0, 0, 0],
      lineColor: [220, 220, 220],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold"
    },
    columnStyles: {
      0: { fontStyle: "bold", width: 50 }
    },
    theme: "striped"
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Checklist Items Table
  const itemsHeaders = [["ITEM VERIFICADO", "SITUAÇÃO"]];
  const itemsBody = Object.entries(checklist.itens || {}).map(([key, val]) => {
    return [
      key.replace(/_/g, " ").toUpperCase(),
      val === true ? "CONFORME (OK)" : val === false ? "NÃO CONFORME (NOK)" : "NÃO APLICÁVEL (N/A)"
    ];
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ITENS VERIFICADOS", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: itemsHeaders,
    body: itemsBody.length > 0 ? itemsBody : [["Sem itens de checklist registrados.", ""]],
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 8,
      lineColor: [220, 220, 220],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold"
    },
    columnStyles: {
      1: { halign: "center", fontStyle: "bold" }
    },
    theme: "grid"
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Notes
  if (checklist.notes || checklist.notas) {
    const notas = checklist.notes || checklist.notas;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("OBSERVAÇÕES E NOTAS:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const splitNotes = doc.splitTextToSize(notas, contentWidth);
    doc.text(splitNotes, margin, y);
    y += splitNotes.length * 4.5 + 10;
  }

  // Signatures side by side
  if (y + 30 > ph) {
    doc.addPage();
    y = 35;
  }

  const sigWidth = (contentWidth - 15) / 2;
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + sigWidth, y);
  doc.line(margin + sigWidth + 15, y, margin + 2 * sigWidth + 15, y);

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("RESPONSÁVEL PELA VISTORIA (INSPETOR)", margin + sigWidth / 2, y, { align: "center" });
  doc.text("REPRESENTANTE DO CLIENTE", margin + sigWidth + 15 + sigWidth / 2, y, { align: "center" });

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(checklist.inspector, margin + sigWidth / 2, y, { align: "center" });
  doc.text(clientName.length > 30 ? clientName.slice(0, 30) + "..." : clientName, margin + sigWidth + 15 + sigWidth / 2, y, { align: "center" });

  // Save PDF
  const filename = `Checklist_${checklist.tipo}_${equipamento.tag_placa || "Equipamento"}.pdf`;
  doc.save(filename);
  return doc;
}
