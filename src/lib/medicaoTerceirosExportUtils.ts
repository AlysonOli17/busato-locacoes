import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils";
import type { jsPDF } from "jspdf";

export const exportMedicaoTerceirosPDF = async (item: any) => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtBRL = (v: number) => `R$ ${fmt(v)}`;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 14;
  const mR = 14;
  const contentW = pageW - mL - mR;

  const { data: busatoEmp } = await supabase.from("empresas").select("*").ilike("nome", "%busato%").limit(1).single();

  const fornecedor = item.contratos_terceiros?.fornecedores;
  const tipoMedicao = item.contratos_terceiros?.tipo_medicao || "horas";
  const isDiarias = tipoMedicao === "diarias";
  const inicio = item.periodo_inicio;
  const fim = item.periodo_fim;
  const inicioFmt = inicio ? parseLocalDate(inicio).toLocaleDateString("pt-BR") : "";
  const fimFmt = fim ? parseLocalDate(fim).toLocaleDateString("pt-BR") : "";

  // Fetch costs in period for this contract's equipment
  const detalhes: any[] = Array.isArray(item.detalhes) ? item.detalhes : [];
  const equipIds = detalhes.map(d => d.equipamento_id).filter(Boolean);
  let custosPeriodo: any[] = [];
  if (equipIds.length > 0 && inicio && fim) {
    const { data } = await supabase.from("custos_terceiros")
      .select("id, descricao, tipo, valor, data, equipamento_id, classificacao")
      .in("equipamento_id", equipIds).gte("data", inicio).lte("data", fim);
    custosPeriodo = data || [];
  }

  const logo = await (async () => {
    try {
      const resp = await fetch("/images/logo-busato-horizontal.png");
      const blob = await resp.blob();
      return new Promise<string | null>((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    } catch { return null; }
  })();

  let y = 10;
  const busatoNome = busatoEmp?.razao_social || busatoEmp?.nome || "BUSATO LOCAÇÕES E SERVIÇOS LTDA";
  const busatoCnpj = busatoEmp?.cnpj || "";
  const busatoEndereco = busatoEmp ? [busatoEmp.endereco_logradouro, busatoEmp.endereco_numero, busatoEmp.endereco_complemento, busatoEmp.endereco_bairro, busatoEmp.endereco_cidade, busatoEmp.endereco_uf, busatoEmp.endereco_cep ? `CEP: ${busatoEmp.endereco_cep}` : ""].filter(Boolean).join(", ") : "";
  const busatoIE = busatoEmp?.inscricao_estadual || "";

  if (logo) doc.addImage(logo, "PNG", mL, y, 48, 12);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185);
  const docLabel = inicioFmt && fimFmt ? `${inicioFmt} - ${fimFmt}` : "";
  doc.text(`MEDIÇÃO LOCAÇÃO TERCEIROS ${docLabel}`, pageW - mR, y + 8, { align: "right" });
  y += 18;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text(busatoNome.toUpperCase(), mL, y);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  if (busatoEndereco) { doc.text(busatoEndereco, mL, y); y += 3; }
  const cnpjLine = [busatoCnpj ? `CNPJ: ${busatoCnpj}` : "", busatoIE ? `Inscrição Estadual: ${busatoIE}` : ""].filter(Boolean).join(" - ");
  if (cnpjLine) doc.text(cnpjLine, mL, y);
  y += 5;

  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.5);
  doc.line(mL, y, pageW - mR, y);
  y += 5;

  // Info block
  const equipTypes = [...new Set(detalhes.map((d: any) => d.tipo).filter(Boolean))].join(", ") || "—";
  const medInfoRows = [
    { label: "Período de Medição:", value: `${inicioFmt} a ${fimFmt}` },
    { label: "Fornecedor:", value: fornecedor?.nome || "—" },
    { label: "CNPJ Fornecedor:", value: fornecedor?.cnpj || "—" },
    { label: "Tipo de Medição:", value: isDiarias ? "Por Diárias" : "Por Horas" },
    { label: "Equipamentos:", value: equipTypes },
  ];

  for (const info of medInfoRows) {
    doc.setFillColor(235, 235, 235);
    doc.rect(mL, y - 3, 48, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(info.label, mL + 1, y);
    doc.setFont("helvetica", "normal");
    doc.text(info.value, mL + 50, y);
    y += 5.5;
  }
  y += 4;

  const tableMargin = { left: mL, right: mR };
  let totalMedicao = 0;

  for (const det of detalhes) {
    if (y > pageH - 80) { doc.addPage(); y = 15; }

    const itemDesc = `${(det.tipo || "").toUpperCase()} ${(det.modelo || "").toUpperCase()}`;
    const tagPlaca = det.tag_placa || "—";
    const hn = Number(det.horas_normais || 0);
    const he = Number(det.horas_excedentes || 0);
    const vh = Number(det.valor_hora || 0);
    const vhe = Number(det.valor_hora_excedente || 0);
    const valorEq = hn * vh + he * vhe;
    totalMedicao += valorEq;

    doc.setFillColor(41, 128, 185);
    doc.rect(mL, y - 3, contentW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`${itemDesc}  |  Tag: ${tagPlaca}`, mL + 2, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 7;

    const unidade = isDiarias ? "diárias" : "horas";
    const labelMedidas = isDiarias ? "Diárias Medidas" : "Horas Medidas";
    const labelNormais = isDiarias ? "Diárias Normais" : "Horas Normais";
    const labelExcedentes = isDiarias ? "Diárias Excedentes" : "Horas Excedentes";
    const labelValor = isDiarias ? "Valor/Diária" : "Valor/Hora";

    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      head: [[labelValor, "Val. Excedente", labelMedidas, labelNormais, labelExcedentes, "Valor Medição"]],
      body: [[
        fmtBRL(vh),
        fmtBRL(vhe),
        `${fmt(Number(det.horas_medidas || 0))} ${unidade}`,
        `${fmt(hn)} ${unidade}`,
        `${fmt(he)} ${unidade}`,
        fmtBRL(valorEq),
      ]],
      styles: { fontSize: 8, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
      headStyles: { fillColor: [235, 235, 235], textColor: [60, 60, 60], fontStyle: "bold", halign: "center", fontSize: 7.5 },
      columnStyles: {
        0: { halign: "right" }, 1: { halign: "right" },
        2: { halign: "center" }, 3: { halign: "center" },
        4: { halign: "center" }, 5: { halign: "right", fontStyle: "bold" },
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    autoTable(doc, {
      startY: y,
      margin: { left: pageW - mR - 90, right: mR },
      body: [["Subtotal:", fmtBRL(valorEq)]],
      styles: { fontSize: 9, cellPadding: 1.5, lineWidth: 0 },
      columnStyles: {
        0: { halign: "right", fontStyle: "bold", cellWidth: 45, textColor: [41, 128, 185] },
        1: { halign: "right", fontStyle: "bold", cellWidth: 45, textColor: [41, 128, 185] },
      },
      theme: "plain",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Custos block
  const totalCustos = custosPeriodo.reduce((s, c) => s + Number(c.valor || 0), 0);
  if (custosPeriodo.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 15; }
    doc.setFillColor(41, 128, 185);
    doc.rect(mL, y - 3, contentW, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("CUSTOS NO PERÍODO", mL + 2, y);
    doc.setTextColor(0, 0, 0);
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      head: [["Data", "Descrição", "Tipo", "Valor"]],
      body: custosPeriodo.map((c: any) => [
        parseLocalDate(c.data).toLocaleDateString("pt-BR"),
        c.descricao || "—",
        c.tipo || "—",
        fmtBRL(Number(c.valor)),
      ]),
      styles: { fontSize: 7, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
      headStyles: { fillColor: [235, 235, 235], textColor: [60, 60, 60], fontStyle: "bold" },
      columnStyles: { 0: { halign: "center" }, 3: { halign: "right" } },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Resumo
  if (y > pageH - 50) { doc.addPage(); y = 15; }
  const resumoBody: string[][] = [
    [isDiarias ? "Medição (Diárias)" : "Medição (Horas)", fmtBRL(totalMedicao)],
  ];
  if (totalCustos > 0) resumoBody.push(["(-) Custos no Período", fmtBRL(totalCustos)]);
  const grandTotal = totalMedicao - totalCustos;
  resumoBody.push(["VALOR TOTAL DA MEDIÇÃO", fmtBRL(grandTotal)]);
  const lastIdx = resumoBody.length - 1;

  autoTable(doc, {
    startY: y,
    margin: tableMargin,
    head: [["Descrição", "Valor"]],
    body: resumoBody,
    styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 246, 252] },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index === lastIdx) {
        data.cell.styles.fillColor = [41, 128, 185];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 10;
      }
    },
    theme: "grid",
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Signatures
  if (y + 40 > pageH - 25) { doc.addPage(); y = 20; }
  const sigY = Math.max(y + 14, pageH - 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Aprovação:", mL, sigY);
  const sigLineY = sigY + 20;
  const halfW = (contentW - 30) / 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(mL, sigLineY, mL + halfW, sigLineY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(busatoNome, mL + halfW / 2, sigLineY + 5, { align: "center" });
  const rightX = mL + halfW + 30;
  doc.line(rightX, sigLineY, rightX + halfW, sigLineY);
  doc.text(fornecedor?.nome || "FORNECEDOR", rightX + halfW / 2, sigLineY + 5, { align: "center" });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(6);
    doc.setTextColor(130, 130, 130);
    doc.text(`Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}  —  Página ${p} de ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
  }

  doc.save(`medicao_terceiros_${(fornecedor?.nome || "fornecedor").replace(/\s+/g, "_")}_${inicio || ""}.pdf`);
};
