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
 
 export const generateDetailedPDFDoc = async (data: any[], equipamentos: any[]) => {
   const { default: jsPDF } = await import("jspdf");
   const { default: autoTable } = await import("jspdf-autotable");

   const doc = new jsPDF({ orientation: "portrait" });
   const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
   
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

   return doc;
 };

 export const exportDetailedPDF = async (data: any[], equipamentos: any[]) => {
   const doc = await generateDetailedPDFDoc(data, equipamentos);
   doc.save(`contrato_detalhado_${new Date().toISOString().slice(0, 10)}.pdf`);
 };

export const exportContractDocument = async (
  contrato: any,
  clausulas: { numero: number; titulo: string; texto: string }[],
  isModeloPreview: boolean = false
) => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { supabase } = await import("@/integrations/supabase/client");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const darkGray: [number, number, number] = [30, 30, 30];
  
  let y = await addLetterhead(doc, isModeloPreview ? "Modelo de Contrato - Preview" : "Contrato de Locação");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > 280) {
      doc.addPage();
      y = 20;
    }
  };

  const printParagraph = (text: string, isTitle = false, spacing = 5, alignment: "left" | "justify" | "center" = "justify") => {
    doc.setFont("helvetica", isTitle ? "bold" : "normal");
    doc.setFontSize(isTitle ? 10 : 9.5);
    doc.setTextColor(...(isTitle ? darkGray : [60, 60, 60]));
    
    const lines = doc.splitTextToSize(text, contentWidth);
    const needed = lines.length * 4.5 + spacing;
    checkPageBreak(needed);
    
    if (alignment === "justify" && !isTitle) {
      doc.text(text, margin, y, { align: "justify", maxWidth: contentWidth });
    } else if (alignment === "center") {
      doc.text(text, pageWidth / 2, y, { align: "center" });
    } else {
      doc.text(lines, margin, y);
    }
    y += lines.length * 4.5 + spacing;
  };

  let equipamentosData: any[] = [];

  if (!isModeloPreview && contrato && contrato.empresas) {
    const emp = contrato.empresas;
    const qualifLocadora = `De um lado, como Locadora,\nBUSATO LOCAÇÕES E SERVIÇOS LTDA, empresa estabelecida Av. Coronel Manoel Nunes, 145, Planalto de Carapina, Serra/ES, CEP 29.162-715, inscrita no CNPJ sob o nº 54.167.719/0001-40, neste ato denominada simplesmente Locadora.`;
    
    const qualifLocataria = `De outro lado, como Locatária,\n${emp.razao_social || emp.nome}, empresa estabelecida à ${emp.endereco_logradouro || "—"}, nº ${emp.endereco_numero || "—"}${emp.endereco_complemento ? ` - ${emp.endereco_complemento}` : ""}, ${emp.endereco_bairro || "—"}, ${emp.endereco_cidade || "—"} - ${emp.endereco_uf || "—"}, inscrita no CNPJ sob o nº ${emp.cnpj || "—"}, neste ato denominada simplesmente Locatária.`;
    
    printParagraph(qualifLocadora, false, 8, "left");
    printParagraph(qualifLocataria, false, 8, "left");

    printParagraph(`Resolvem celebrar o presente Contrato de Locação de Veículo / Equipamento, doravante denominado “Contrato”, mediante as seguintes cláusulas e condições:`, false, 8);

    if (contrato.contratos_equipamentos && contrato.contratos_equipamentos.length > 0) {
      equipamentosData = contrato.contratos_equipamentos;
    } else {
      // Fallback: Buscar todos os equipamentos do contrato caso não tenha vindo no objeto
      const { data } = await supabase
        .from("contratos_equipamentos")
        .select("*, equipamentos(tipo, tag_placa, modelo, numero_serie)")
        .eq("contrato_id", contrato.id);
        
      if (data) {
        equipamentosData = data;
      }
    }
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

    // If it's the "OBJETO" clause, render the equipment table immediately after its text
    if (clausula.titulo.toUpperCase().includes("OBJETO") && !isModeloPreview && equipamentosData.length > 0) {
      const isDiaria = contrato?.tipo_medicao === "diarias";
      const tableHeaders = [[
        "ITEM", 
        "EQUIPAMENTO", 
        "CHASSIS / SERIE", 
        isDiaria ? "FRANQUIA\nMENSAL\nDIÁRIA" : "FRANQUIA\nMENSAL\nHORA", 
        isDiaria ? "VALOR\nDIÁRIA" : "VALOR\nHORA", 
        "VALOR TOTAL\nEQUIPAMENTO"
      ]];
      
      const tableBody = equipamentosData.map((ae: any, idx: number) => {
        const eq = ae.equipamentos;
        const franquia = ae.horas_contratadas || 0;
        const valorUnit = Number(ae.valor_hora || 0);
        const valorTotal = franquia > 0 ? franquia * valorUnit : 0;
        
        return [
          (idx + 1).toString().padStart(2, '0'),
          (eq?.tipo || "") + (eq?.modelo ? ` ${eq.modelo}` : ""),
          eq?.numero_serie || "—",
          franquia > 0 ? `${franquia} ${isDiaria ? "DIÁRIAS" : "HORAS"}` : "—",
          `R$ ${valorUnit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          valorTotal > 0 ? `R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"
        ];
      });

      checkPageBreak(tableBody.length * 10 + 20);

      autoTable(doc, {
        startY: y,
        head: tableHeaders,
        body: tableBody,
        margin: { left: margin, right: margin },
        styles: { 
          fontSize: 8, 
          cellPadding: 4, 
          textColor: [0, 0, 0], 
          halign: "center", 
          valign: "middle",
          lineColor: [0, 0, 0],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [14, 42, 71], 
          textColor: [255, 255, 255], 
          fontStyle: "bold", 
          fontSize: 8 
        },
        theme: "grid",
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }
  });

  if (!isModeloPreview) {
    if (y > 180) { doc.addPage(); y = 20; }
    y += 15;

    const hoje = new Date();
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const dataFormatada = `Serra/ES, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(dataFormatada, pageWidth - margin, y, { align: "right" });
    
    y += 40; 
    
    // LOCADORA
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 100, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text("BUSATO LOCAÇÕES E SERVIÇOS LTDA.", margin, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("LOCADORA", margin, y);

    y += 40; 
    
    // LOCATÁRIA
    const emp = contrato?.empresas;
    const nomeLocataria = emp?.razao_social || emp?.nome || "LOCATÁRIA";
    
    doc.line(margin, y, margin + 100, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(nomeLocataria, margin, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("LOCATÁRIA", margin, y);
  }

  doc.save(isModeloPreview ? "modelo_contrato_preview.pdf" : `contrato_locacao_${contrato?.id?.slice(0,6) || "doc"}.pdf`);
};
