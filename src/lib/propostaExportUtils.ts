import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils";
import type { jsPDF } from "jspdf";

/**
 * Loads the Busato logo and returns it as a base64 data URL.
 */
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

function formatMobilizacaoTexto(valor: number): string {
  if (valor === 0) return "";
  const fmt = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  return `O valor de mobilização e desmobilização de R$ ${fmt} será de responsabilidade do cliente, pagos no primeiro faturamento.`;
}

export const generatePropostaPDF = async (item: any, empresas: any[], contas: any[]) => {
  const { data: eqs } = await supabase.from("propostas_equipamentos").select("*").eq("proposta_id", item.id);
  const { data: resps } = await supabase.from("propostas_responsabilidades").select("*").eq("proposta_id", item.id);
  const emp = empresas.find(e => e.id === item.empresa_id) || item.empresas;
  const conta = contas.find(c => c.id === item.conta_bancaria_id);

  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const margin = 20;
  const contentW = pw - margin * 2;

  // Brand colors
  const brandBlue: [number, number, number] = [41, 128, 185];
  const darkGray: [number, number, number] = [50, 50, 50];
  const medGray: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [160, 160, 160];

  const logo = await loadLogo();

  // Footer on every page
  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(...brandBlue);
    doc.setLineWidth(0.5);
    doc.line(margin, ph - 18, pw - margin, ph - 18);
    doc.setFontSize(7);
    doc.setTextColor(...lightGray);
    doc.text("BUSATO LOCAÇÕES E SERVIÇOS LTDA  •  CNPJ: 54.167.719/0001-40", margin, ph - 13);
    doc.text(`Página ${pageNum} de ${totalPages}`, pw - margin, ph - 13, { align: "right" });
  };

  // Header: logo + line for inner pages
  const addInnerHeader = () => {
    if (logo) doc.addImage(logo, "PNG", margin, 10, 48, 12);
    doc.setDrawColor(...brandBlue);
    doc.setLineWidth(0.6);
    doc.line(margin, 26, pw - margin, 26);
  };

  // ===================== PAGE 1 — COVER =====================
  if (logo) doc.addImage(logo, "PNG", margin, 14, 56, 14);

  doc.setFontSize(11);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "bold");
  doc.text(`Nº ${String(item.numero_sequencial).padStart(3, "0")}`, pw - margin, 22, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...medGray);
  doc.text(parseLocalDate(item.data).toLocaleDateString("pt-BR"), pw - margin, 28, { align: "right" });

  doc.setDrawColor(...brandBlue);
  doc.setLineWidth(0.8);
  doc.line(margin, 36, pw - margin, 36);

  let y = 50;
  doc.setFontSize(20);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "bold");
  doc.text("PROPOSTA COMERCIAL", margin, y);
  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(...brandBlue);
  doc.text("LOCAÇÃO DE EQUIPAMENTOS", margin, y);
  y += 14;

  doc.setDrawColor(...brandBlue);
  doc.setLineWidth(1.2);
  doc.line(margin, y, margin + 50, y);
  y += 14;

  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.setFont("helvetica", "normal");
  doc.text(`Proposta válida por ${item.validade_dias} dias a partir da data de emissão.`, margin, y);
  y += 16;

  const sectionTitle = (label: string, yPos: number) => {
    doc.setFillColor(240, 245, 250);
    doc.roundedRect(margin, yPos - 5, contentW, 8, 1, 1, "F");
    doc.setFontSize(10);
    doc.setTextColor(...brandBlue);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin + 4, yPos);
    return yPos + 10;
  };

  const infoLine = (label: string, value: string, yPos: number) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkGray);
    doc.text(label, margin + 4, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...medGray);
    doc.text(value || "—", margin + 44, yPos);
    return yPos + 5.5;
  };

  y = sectionTitle("EMPRESA LOCADORA", y);
  y = infoLine("Razão Social:", "BUSATO LOCAÇÕES E SERVIÇOS LTDA", y);
  y = infoLine("CNPJ:", "54.167.719/0001-40", y);
  y += 6;

  y = sectionTitle("CLIENTE", y);
  y = infoLine("Razão Social:", emp?.razao_social || emp?.nome || "—", y);
  y = infoLine("CNPJ:", emp?.cnpj || "—", y);
  y += 6;

  y = sectionTitle("CONSULTOR RESPONSÁVEL", y);
  if (item.consultor_nome) {
    y = infoLine("Nome:", item.consultor_nome, y);
    if (item.consultor_email) y = infoLine("E-mail:", item.consultor_email, y);
    if (item.consultor_telefone) y = infoLine("Telefone:", item.consultor_telefone, y);
  }
  if (item.consultor_nome_2) {
    y += 2;
    y = infoLine("Nome:", item.consultor_nome_2, y);
    if (item.consultor_email_2) y = infoLine("E-mail:", item.consultor_email_2, y);
    if (item.consultor_telefone_2) y = infoLine("Telefone:", item.consultor_telefone_2, y);
  }

  // ===================== PAGE 2 — CONDITIONS =====================
  doc.addPage();
  addInnerHeader();
  y = 30;

  y = sectionTitle("1. OBJETO", y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...medGray);
  doc.text("Locação dos seguintes equipamentos:", margin + 4, y);
  y += 6;
  (eqs || []).forEach(eq => {
    doc.setFillColor(...brandBlue);
    doc.circle(margin + 7, y - 1.2, 1, "F");
    doc.setTextColor(...darkGray);
    doc.text(eq.equipamento_tipo, margin + 12, y);
    y += 5;
  });
  y += 4;

  const isDiarias = (item as any).tipo_medicao === "diarias";
  const unitLabel = isDiarias ? "Diária" : "Hora";

  y = sectionTitle("2. PRAZO", y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...medGray);
  const prazoText = isDiarias
    ? "Mediante solicitação e acordo das partes."
    : "A locação será contratada por período mensal, podendo ser prorrogada mediante solicitação e acordo das partes.";
  const prazoLines = doc.splitTextToSize(prazoText, contentW - 8);
  doc.text(prazoLines, margin + 4, y);
  y += prazoLines.length * 4.5 + 6;

  y = sectionTitle("3. PREÇO E CONDIÇÕES", y);
  if (isDiarias) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Qtd.", "Equipamento", `Valor/${unitLabel}`]],
      body: (eqs || []).map(eq => [
        String(eq.quantidade).padStart(2, "0"),
        eq.equipamento_tipo,
        fmt(Number(eq.valor_hora)),
      ]),
      styles: { fontSize: 8, cellPadding: 3.5, textColor: darkGray },
      headStyles: { fillColor: brandBlue, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      theme: "striped",
    });
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Qtd.", "Equipamento", `Valor/${unitLabel}`, "Franquia (h)", "Total Mensal"]],
      body: (eqs || []).map(eq => [
        String(eq.quantidade).padStart(2, "0"),
        eq.equipamento_tipo,
        fmt(Number(eq.valor_hora)),
        String(eq.franquia_mensal),
        fmt(Number(eq.valor_hora) * Number(eq.franquia_mensal) * Number(eq.quantidade)),
      ]),
      styles: { fontSize: 8, cellPadding: 3.5, textColor: darkGray },
      headStyles: { fillColor: brandBlue, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      theme: "striped",
    });
  }
  y = (doc as any).lastAutoTable.finalY + 8;

  const bottomLimit = ph - 25;
  const checkPageBreak = (yPos: number, neededHeight: number): number => {
    if (yPos + neededHeight > bottomLimit) {
      doc.addPage();
      addInnerHeader();
      return 30;
    }
    return yPos;
  };

  const subItem = (num: string, title: string, text: string, yPos: number) => {
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(text, contentW - 8);
    const itemHeight = 5 + lines.length * 4.5 + 4;
    yPos = checkPageBreak(yPos, itemHeight);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkGray);
    doc.text(`${num} ${title}`, margin + 4, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...medGray);
    doc.text(lines, margin + 4, yPos + 5);
    return yPos + itemHeight;
  };

  if (item.valor_mobilizacao > 0 || item.valor_mobilizacao_texto) {
    y = subItem("3.1.", "Transporte do Equipamento", item.valor_mobilizacao_texto || formatMobilizacaoTexto(Number(item.valor_mobilizacao)), y);
  }
  if (!isDiarias && item.franquia_horas_texto) {
    y = subItem("3.2.", "Franquia de Horas", item.franquia_horas_texto, y);
  }
  if (!isDiarias && item.horas_excedentes_texto) {
    y = subItem("3.3.", "Horas Excedentes", item.horas_excedentes_texto, y);
  }
  if (item.disponibilidade_texto) {
    const num = isDiarias ? "3.2." : "3.4.";
    y = subItem(num, "Disponibilidade", item.disponibilidade_texto, y);
  }
  if (item.analise_cadastral_texto) {
    const num = isDiarias ? "3.3." : "3.5.";
    y = subItem(num, "Análise Cadastral", item.analise_cadastral_texto, y);
  }
  if (item.seguro_texto) {
    const num = isDiarias ? "3.4." : "3.6.";
    y = subItem(num, "Seguro", item.seguro_texto, y);
  }

  if (y > bottomLimit - 60) {
    doc.addPage();
    addInnerHeader();
    y = 30;
  }

  y = sectionTitle("4. PAGAMENTO", y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...medGray);
  const pagLines = doc.splitTextToSize(`Os pagamentos deverão ser realizados no prazo de até ${item.prazo_pagamento} (${item.prazo_pagamento === 30 ? "trinta" : String(item.prazo_pagamento)}) dias após a emissão da nota fiscal, condicionado à aprovação da medição.`, contentW - 8);
  doc.text(pagLines, margin + 4, y);
  y += pagLines.length * 4.5 + 8;

  if (conta) {
    doc.setFillColor(245, 248, 252);
    const cardH = 38 + (conta.cnpj_cpf ? 5.5 : 0);
    doc.roundedRect(margin, y - 5, contentW, cardH, 2, 2, "F");
    doc.setDrawColor(...brandBlue);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y - 5, contentW, cardH, 2, 2, "S");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...brandBlue);
    doc.text("DADOS BANCÁRIOS", margin + 6, y + 1);
    y += 8;
    
    const infoLineInner = (label: string, value: string, yPos: number) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkGray);
      doc.text(label, margin + 6, yPos);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...medGray);
      doc.text(value || "—", margin + 46, yPos);
      return yPos + 5.5;
    };
    
    y = infoLineInner("Favorecido:", conta.titular, y);
    if (conta.cnpj_cpf) y = infoLineInner("CNPJ:", conta.cnpj_cpf, y);
    y = infoLineInner("Banco:", conta.banco, y);
    y = infoLineInner("Agência:", conta.agencia, y);
    y = infoLineInner(`${conta.tipo_conta}:`, conta.conta, y);
  }

  if (resps && resps.length > 0) {
    doc.addPage();
    addInnerHeader();
    y = 30;

    y = sectionTitle("5. RESPONSABILIDADES", y);
    const clienteName = emp?.razao_social || emp?.nome || "CLIENTE";
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["ATIVIDADE / ITEM", "BUSATO", clienteName.toUpperCase()]],
      body: resps.map(r => [
        r.atividade,
        r.responsavel_busato ? "X" : "",
        r.responsavel_cliente ? "X" : "",
      ]),
      styles: { fontSize: 8, cellPadding: 3.5, textColor: darkGray },
      headStyles: { fillColor: brandBlue, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
      columnStyles: { 0: { cellWidth: contentW - 50, halign: "left" }, 1: { halign: "center", cellWidth: 25 }, 2: { halign: "center", cellWidth: 25 } },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      theme: "striped",
    });
  }

  if (item.observacoes && item.observacoes.trim()) {
    const lastTableY = resps && resps.length > 0 ? (doc as any).lastAutoTable.finalY + 10 : 30;
    let obsY = lastTableY;
    const obsLines = doc.splitTextToSize(item.observacoes, contentW - 8);
    const obsHeight = 12 + obsLines.length * 4.5 + 4;
    obsY = checkPageBreak(obsY, obsHeight);

    obsY = sectionTitle("6. OBSERVAÇÕES", obsY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...medGray);
    doc.text(obsLines, margin + 4, obsY);
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  const numStr = String(item.numero_sequencial).padStart(3, "0");
  const empName = (emp?.nome || "proposta").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  doc.save(`${numStr}_PROPOSTA_COMERCIAL_DE_LOCAÇÃO_-_${empName}.pdf`);
};
