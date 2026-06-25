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

export async function exportChecklistToPDF(checklist: any, equipamento: any, contrato: any, download: boolean = true) {
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
  const itemsBody = Object.entries(checklist.itens || {}).map(([key, val]: [string, any]) => {
    let sit = "N/A";
    if (val && typeof val === 'object' && 'conforme' in val) {
      sit = val.conforme ? "CONFORME (OK)" : "NÃO CONFORME (NOK)";
      if (!val.conforme && val.observacao) sit += `\nObs: ${val.observacao}`;
    } else if (val === true) {
      sit = "CONFORME (OK)";
    } else if (val === false) {
      sit = "NÃO CONFORME (NOK)";
    }
    return [
      key.replace(/_/g, " ").toUpperCase(),
      sit
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

  // Anexos Fotográficos
  const photosToDraw: { label: string, b64: string }[] = [];
  
  if (checklist.itens) {
    Object.entries(checklist.itens).forEach(([key, val]: [string, any]) => {
      if (key !== "__fotos_gerais" && val && val.fotoBase64) {
        photosToDraw.push({
          label: key.replace(/_/g, " ").toUpperCase(),
          b64: val.fotoBase64
        });
      }
    });
    
    if (checklist.itens["__fotos_gerais"]) {
      Object.entries(checklist.itens["__fotos_gerais"]).forEach(([key, val]: [string, any]) => {
        if (val && val.fotoBase64) {
          photosToDraw.push({
            label: `GERAL: ${key.replace(/_/g, " ").toUpperCase()}`,
            b64: val.fotoBase64
          });
        }
      });
    }
  }

  if (photosToDraw.length > 0) {
    doc.addPage();
    y = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ANEXOS FOTOGRÁFICOS", pw / 2, y, { align: "center" });
    y += 15;

    const cols = 2;
    const colWidth = contentWidth / cols;
    const maxDrawW = 75;
    const maxDrawH = 65;
    let currentMaxH = 0;

    for (let i = 0; i < photosToDraw.length; i++) {
      const p = photosToDraw[i];
      const imgProps = await new Promise<{w: number, h: number}>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.width, h: img.height });
        img.onerror = () => resolve({ w: 0, h: 0 });
        img.src = p.b64;
      });
      
      if (imgProps.w === 0) continue;
      
      const colIndex = i % cols;
      if (colIndex === 0 && i !== 0) {
        y += currentMaxH + 15;
        currentMaxH = 0;
      }
      
      let actualDrawW = maxDrawW;
      let actualDrawH = (imgProps.h / imgProps.w) * actualDrawW;
      if (actualDrawH > maxDrawH) {
        actualDrawH = maxDrawH;
        actualDrawW = (imgProps.w / imgProps.h) * actualDrawH;
      }
      
      if (colIndex === 0 && y + maxDrawH + 15 > ph - 20) {
        doc.addPage();
        y = 20;
      }
      
      currentMaxH = Math.max(currentMaxH, actualDrawH);
      
      const centerX = margin + colIndex * colWidth + colWidth / 2;
      const imgX = centerX - actualDrawW / 2;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const labelStr = p.label.length > 40 ? p.label.slice(0, 37) + "..." : p.label;
      doc.text(labelStr, centerX, y, { align: "center" });
      
      doc.addImage(p.b64, "JPEG", imgX, y + 3, actualDrawW, actualDrawH);
    }
    
    y += currentMaxH + 20;
  } else {
    y += 10;
  }

  // Signatures side by side at the very end
  if (checklist.tipo !== "Visita Técnica") {
    y += 15;
    if (y + 40 > ph) {
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
  }

  // Save PDF conditionally
  if (download) {
    const filename = `Checklist_${checklist.tipo}_${equipamento.tag_placa || "Equipamento"}.pdf`;
    doc.save(filename);
  }
  return doc;
}
