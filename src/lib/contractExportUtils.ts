import { supabase } from "@/integrations/supabase/client";
import { addLetterhead } from "@/lib/exportUtils";
import { parseLocalDate } from "@/lib/utils";

export const exportSimplePDF = async (data: any[], equipamentos: any[]) => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });
  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const hoje = new Date().toISOString().slice(0, 10);

  let y = await addLetterhead(doc, "Relatório de Contratos");

  const globalDevolucaoByContrato: Record<string, Record<string, string | null>> = {};

  for (const item of data) {
    const globalDev: Record<string, string | null> = {};
    const ces = item.contratos_equipamentos || [];
    for (const ce of ces) {
      if (ce.data_devolucao) {
        const existing = globalDev[ce.equipamento_id];
        if (!existing || ce.data_devolucao > existing) globalDev[ce.equipamento_id] = ce.data_devolucao;
      }
    }
    const { data: adData } = await supabase.from("contratos_aditivos").select("id").eq("contrato_id", item.id);
    if (adData && adData.length > 0) {
      const { data: aeData } = await supabase.from("aditivos_equipamentos").select("equipamento_id, data_devolucao").in("aditivo_id", adData.map(a => a.id));
      for (const ae of (aeData || [])) {
        if (ae.data_devolucao) {
          const existing = globalDev[ae.equipamento_id];
          if (!existing || ae.data_devolucao > existing) globalDev[ae.equipamento_id] = ae.data_devolucao;
        }
      }
    }
    globalDevolucaoByContrato[item.id] = globalDev;
  }

  const mainRows: string[][] = [];
  data.forEach(i => {
    const ces = i.contratos_equipamentos || [];
    const globalDev = globalDevolucaoByContrato[i.id] || {};
    ces.forEach((ce: any) => {
      const devDate = globalDev[ce.equipamento_id] || null;
      if (devDate && devDate < hoje) return;
      const empObra = i.empresas?.obra ? ` (Obra: ${i.empresas.obra})` : "";
      mainRows.push([
        `${i.empresas?.nome || ""}${empObra}`,
        i.empresas?.cnpj || "",
        `${ce.equipamentos.tipo} ${ce.equipamentos.modelo}`,
        ce.equipamentos.tag_placa || "—",
        fmt(Number(ce.valor_hora)),
        String(ce.horas_contratadas),
        ce.data_entrega ? parseLocalDate(ce.data_entrega).toLocaleDateString("pt-BR") : "—",
        devDate ? parseLocalDate(devDate).toLocaleDateString("pt-BR") : "—",
        parseLocalDate(i.data_inicio).toLocaleDateString("pt-BR"),
        parseLocalDate(i.data_fim).toLocaleDateString("pt-BR"),
        i.status,
      ]);
    });
  });

  autoTable(doc, {
    startY: y,
    head: [["Empresa", "CNPJ", "Equipamento", "Tag", "Valor/Hora", "Horas", "Entrega", "Devolução", "Início", "Fim", "Status"]],
    body: mainRows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  
  doc.save(`contratos_${new Date().toISOString().slice(0, 10)}.pdf`);
 };
 
 export const exportDetailedPDF = async (data: any[], equipamentos: any[]) => {
   const { default: jsPDF } = await import("jspdf");
   const { default: autoTable } = await import("jspdf-autotable");
 
   const doc = new jsPDF({ orientation: "portrait" });
   const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
   const hoje = new Date().toISOString().slice(0, 10);
   
   for (let idx = 0; idx < data.length; idx++) {
     const item = data[idx];
     if (idx > 0) doc.addPage();
     const emp = item.empresas;
     const startY = await addLetterhead(doc, "Contrato Detalhado");
     let y = startY;
 
     doc.setFontSize(12);
     doc.setTextColor(41, 128, 185);
     doc.text("Dados da Empresa", 14, y);
     y += 2;
     
     autoTable(doc, {
       startY: y,
       head: [["Campo", "Valor"]],
       body: [
         ["Razão Social", `${emp?.razao_social || emp?.nome || "—"}${emp?.obra ? ` (Obra: ${emp.obra})` : ""}`],
        ["CNPJ", emp?.cnpj || "—"],
        ["Endereço", [emp?.endereco_logradouro, emp?.endereco_numero].filter(Boolean).join(", ") || "—"],
        ["Cidade / UF", [emp?.endereco_cidade, emp?.endereco_uf].filter(Boolean).join(" / ") || "—"],
        ["Contato", emp?.contato || "—"],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
      theme: "grid",
    });
    
    y = (doc as any).lastAutoTable.finalY + 10;
    doc.text("Equipamentos do Contrato", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Modelo", "Tag", "Valor/Hora", "Horas"]],
      body: (item.contratos_equipamentos || []).map((ce: any) => [
        ce.equipamentos.tipo,
        ce.equipamentos.modelo,
        ce.equipamentos.tag_placa || "—",
        fmt(Number(ce.valor_hora)),
        `${ce.horas_contratadas}h`
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96], textColor: 255 },
    });
  }

  doc.save(`contrato_detalhado_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportContractDocument = async (
  contrato: any,
  clausulas: { numero: number; titulo: string; texto: string }[],
  isModeloPreview: boolean = false
) => {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = await addLetterhead(doc, isModeloPreview ? "Modelo de Contrato - Preview" : "Contrato de Locação");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);

  if (!isModeloPreview && contrato && contrato.empresas) {
    const emp = contrato.empresas;
    const headerText = `CONTRATANTE: ${emp.razao_social || emp.nome}, CNPJ: ${emp.cnpj || "—"}\nEndereço: ${emp.endereco_logradouro || "—"}, ${emp.endereco_numero || "—"} - ${emp.endereco_cidade || "—"}/${emp.endereco_uf || "—"}\n\nCONTRATADA: BUSATO LOCAÇÕES E SERVIÇOS LTDA, CNPJ: 54.167.719/0001-40`;
    
    const splitHeader = doc.splitTextToSize(headerText, contentWidth);
    doc.text(splitHeader, margin, y);
    y += splitHeader.length * 5 + 10;
  } else if (isModeloPreview) {
    doc.text("Este é um documento de visualização do modelo padrão de cláusulas.", margin, y);
    y += 15;
  }

  clausulas.forEach((clausula) => {
    // Check page break
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(clausula.titulo, margin, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(clausula.texto, contentWidth);
    
    // Quick page break logic for text blocks
    for (let i = 0; i < splitText.length; i++) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(splitText[i], margin, y);
      y += 5;
    }
    y += 5; // space between clauses
  });

  if (!isModeloPreview) {
    if (y > 240) { doc.addPage(); y = 20; }
    y += 20;
    doc.line(margin, y, margin + 70, y);
    doc.text("CONTRATANTE", margin, y + 5);
    
    doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
    doc.text("CONTRATADA", pageWidth - margin - 70, y + 5);
  }

  doc.save(isModeloPreview ? "modelo_contrato_preview.pdf" : `contrato_locacao_${contrato?.id?.slice(0,6) || "doc"}.pdf`);
};
