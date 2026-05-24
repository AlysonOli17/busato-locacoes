// jspdf is now imported dynamically to reduce bundle size
import type { jsPDF } from "jspdf";

import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils";

/**
 * Exports detailed billing information to a PDF document.
 * This logic was extracted from Faturamento.tsx to reduce bundle size and memory usage during build.
 */
export const exportDetailedFaturamentoPDF = async (data: any[], empresasList: any[]) => {
  if (data.length === 0) return;

  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtBRL = (v: number) => `R$ ${fmt(v)}`;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 14; 
  const mR = 14; 
  const contentW = pageW - mL - mR;

  // Fetch Busato company data
  const { data: busatoEmp } = await supabase.from("empresas").select("*").ilike("nome", "%busato%").limit(1).single();

  for (let idx = 0; idx < data.length; idx++) {
    const item = data[idx];
    if (idx > 0) doc.addPage();

    const ct = item.contratos;
    const emp = ct?.empresas;
    const empresaFat = item.empresa_faturamento_id ? empresasList.find(e => e.id === item.empresa_faturamento_id) : null;
    const empNome = empresaFat ? empresaFat.nome : (emp?.nome || "—");
    const empCnpj = empresaFat ? empresaFat.cnpj : (emp?.cnpj || "—");
    const inicio = item.periodo_medicao_inicio || "";
    const fim = item.periodo_medicao_fim || "";
    const inicioFmt = inicio ? parseLocalDate(inicio).toLocaleDateString("pt-BR") : "";
    const fimFmt = fim ? parseLocalDate(fim).toLocaleDateString("pt-BR") : "";

    let y = 10;

    const busatoNome = busatoEmp?.razao_social || busatoEmp?.nome || "BUSATO LOCAÇÕES E SERVIÇOS LTDA";
    const busatoCnpj = busatoEmp?.cnpj || "";
    const busatoEndereco = busatoEmp ? [busatoEmp.endereco_logradouro, busatoEmp.endereco_numero, busatoEmp.endereco_complemento, busatoEmp.endereco_bairro, busatoEmp.endereco_cidade, busatoEmp.endereco_uf, busatoEmp.endereco_cep ? `CEP: ${busatoEmp.endereco_cep}` : ""].filter(Boolean).join(", ") : "";
    const busatoIE = busatoEmp?.inscricao_estadual || "";

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    const docLabel = inicioFmt && fimFmt ? `${inicioFmt} - ${fimFmt}` : String(item.numero_sequencial).padStart(3, "0");
    doc.text(`BOLETIM DE MEDIÇÃO ${docLabel}`, pageW - mR, y + 8, { align: "right" });
    y += 18;

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(busatoNome.toUpperCase(), mL, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    if (busatoEndereco) {
      doc.text(busatoEndereco, mL, y);
      y += 3;
    }
    const cnpjLine = [busatoCnpj ? `CNPJ: ${busatoCnpj}` : "", busatoIE ? `Inscrição Estadual: ${busatoIE}` : ""].filter(Boolean).join(" - ");
    doc.text(cnpjLine, mL, y);
    y += 8;

    const empObra = empresaFat ? empresaFat.obra : (emp?.obra || "");
    const clientRows = [
      ["Cliente:", empNome],
      ["CNPJ:", empCnpj],
    ];
    if (empObra) {
      clientRows.push(["Obra/Unidade:", empObra]);
    }
    clientRows.push(["Contato:", emp?.contato || "—"]);

    // Client Info Card
    autoTable(doc, {
      startY: y,
      head: [["DADOS DO CLIENTE", ""]],
      body: clientRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255 },
      columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" } },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Billing items
    const { data: faturamentoItens } = await supabase.from("faturamento_equipamentos").select("*, equipamentos(tipo, modelo, tag_placa)").eq("faturamento_id", item.id);
    if (faturamentoItens && faturamentoItens.length > 0) {
      const isDiarias = ct?.tipo_medicao === "diarias";
      const unit = isDiarias ? "d" : "h";
      autoTable(doc, {
        startY: y,
        head: [[
          "Equipamento",
          "Tag",
          isDiarias ? "Diárias Normais" : "Horas Normais",
          isDiarias ? "Vlr Diária" : "Vlr Hora",
          isDiarias ? "Diárias Exc." : "Horas Exc.",
          isDiarias ? "Vlr Exc. Diária" : "Vlr Exc. Hora",
          "Subtotal"
        ]],
        body: faturamentoItens.map(fi => [
          `${fi.equipamentos?.tipo || ""} ${fi.equipamentos?.modelo || ""}`,
          fi.equipamentos?.tag_placa || "—",
          `${fi.horas_normais}${unit}`,
          fmtBRL(Number(fi.valor_hora)),
          `${fi.horas_excedentes}${unit}`,
          fmtBRL(Number(fi.valor_excedente_hora ?? fi.valor_hora_excedente ?? 0)),
          fmtBRL(Number(fi.valor_total_item ?? fi.valor_total ?? (Number(fi.horas_normais) * Number(fi.valor_hora) + Number(fi.horas_excedentes) * Number(fi.valor_excedente_hora ?? fi.valor_hora_excedente ?? 0)))),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        theme: "striped",
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Additional Costs
    const { data: fatGastos } = await supabase.from("faturamento_gastos").select("*, gastos(*)").eq("faturamento_id", item.id);
    if (fatGastos && fatGastos.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Custos Adicionais / Reembolsos", mL, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Data", "Descrição", "Classificação", "Valor"]],
        body: fatGastos.map(fg => [
          parseLocalDate(fg.gastos.data).toLocaleDateString("pt-BR"),
          fg.gastos.descricao,
          fg.gastos.classificacao || "Custo",
          fmtBRL(Number(fg.gastos.valor)),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [230, 126, 34], textColor: 255 },
        theme: "striped",
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Totals Table
    autoTable(doc, {
      startY: y,
      body: [
        ["TOTAL DOS EQUIPAMENTOS", fmtBRL(Number(item.valor_total) - Number(item.total_gastos || 0))],
        ["TOTAL DE CUSTOS ADICIONAIS", fmtBRL(Number(item.total_gastos || 0))],
        ["VALOR TOTAL DA MEDIÇÃO", fmtBRL(Number(item.valor_total))],
      ],
      styles: { fontSize: 10, cellPadding: 3, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 150 }, 1: { align: "right" } },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Observações
    const obs = item.observacoes;
    if (obs && obs.trim()) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const obsLines = doc.splitTextToSize(obs, contentW);
      const obsHeight = (obsLines.length * 4) + 6;

      if (y + obsHeight + 40 > pageH) {
        doc.addPage();
        y = 40;
      }

      doc.text("Observações:", mL, y);
      y += 4.5;
      doc.setFont("helvetica", "normal");
      obsLines.forEach((line: string) => {
        doc.text(line, mL, y);
        y += 4;
      });
      y += 2;
    }

    // Signature line
    if (y + 40 > pageH) { doc.addPage(); y = 40; } else { y = pageH - 40; }
    doc.setDrawColor(180);
    doc.line(mL, y, mL + 60, y);
    doc.line(pageW - mR - 60, y, pageW - mR, y);
    doc.setFontSize(8);
    doc.text("Responsável Busato", mL + 30, y + 4, { align: "center" });
    doc.text("Responsável Cliente", pageW - mR - 30, y + 4, { align: "center" });
  }

  doc.save(`boletim_medicao_${new Date().toISOString().slice(0, 10)}.pdf`);
};
