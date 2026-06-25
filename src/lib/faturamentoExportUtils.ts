import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils";

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

/**
 * Exports detailed billing information to a PDF document matching the provided template.
 */
export const exportDetailedFaturamentoPDF = async (data: any[], empresasList: any[], download: boolean = true) => {
  if (data.length === 0) return;

  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtBRL = (v: number) => `R$ ${fmt(v)}`;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 12;
  const mR = 12;
  const contentW = pageW - mL - mR;

  // Fetch Busato company data
  const { data: busatoEmp } = await supabase.from("empresas").select("*").ilike("nome", "%busato%").limit(1).single();
  const busatoNome = busatoEmp?.razao_social || busatoEmp?.nome || "BUSATO LOCACOES E SERVICOS LTDA";
  const busatoCnpj = busatoEmp?.cnpj || "54.167.719/0001-40";
  const busatoEndereco = busatoEmp ? [busatoEmp.endereco_logradouro, busatoEmp.endereco_numero, busatoEmp.endereco_complemento, busatoEmp.endereco_bairro, busatoEmp.endereco_cidade, busatoEmp.endereco_uf, busatoEmp.endereco_cep ? `CEP: ${busatoEmp.endereco_cep}` : ""].filter(Boolean).join(", ") : "AV NOSSA SENHORA DA PENHA, 595, SALA 510, SANTA LUCIA, VITORIA, ES, CEP: 29056-250";
  const busatoIE = busatoEmp?.inscricao_estadual || "";

  const logo = await loadLogo();

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

    // Fetch adjustment, contract equipments, and addendums
    const [ajustesRes, ceRes, aditivosRes] = await Promise.all([
      supabase.from("contratos_equipamentos_ajustes").select("*").eq("contrato_id", item.contrato_id).lte("data_inicio", fim).gte("data_fim", inicio),
      supabase.from("contratos_equipamentos").select("*").eq("contrato_id", item.contrato_id),
      supabase.from("contratos_aditivos").select("id, numero, data_inicio, data_fim").eq("contrato_id", item.contrato_id)
    ]);

    const activeAjustes = ajustesRes.data || [];
    const ceList = ceRes.data || [];
    const aditivos = aditivosRes.data || [];

    let aditivoEquipList: any[] = [];
    if (aditivos.length > 0) {
      const adIds = aditivos.map(a => a.id);
      const { data: aeData } = await supabase.from("aditivos_equipamentos").select("*").in("aditivo_id", adIds);
      if (aeData) aditivoEquipList = aeData;
    }

    let y = 10;

    // 1. PAGE HEADER
    if (logo) {
      doc.addImage(logo, "PNG", mL, y, 48, 12);
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    const docLabel = inicioFmt && fimFmt ? ` ${inicioFmt} - ${fimFmt}` : "";
    doc.text(`BOLETIM DE MEDIÇÃO${docLabel}`, pageW - mR, y + 8, { align: "right" });
    y += 18;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    doc.text(busatoNome.toUpperCase(), mL, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    if (busatoEndereco) {
      doc.text(busatoEndereco.toUpperCase(), mL, y);
      y += 3.5;
    }
    const cnpjLine = [busatoCnpj ? `CNPJ: ${busatoCnpj}` : "", busatoIE ? `Inscrição Estadual: ${busatoIE}` : ""].filter(Boolean).join(" - ");
    doc.text(cnpjLine.toUpperCase(), mL, y);
    y += 4.5;

    // Horizontal blue line
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.4);
    doc.line(mL, y, pageW - mR, y);
    y += 8;

    // Fetch billing equipment items
    const { data: faturamentoItens } = await supabase
      .from("faturamento_equipamentos")
      .select("*")
      .eq("faturamento_id", item.id);

    const itemsList: any[] = [];
    if (faturamentoItens && faturamentoItens.length > 0) {
      const equipIds = faturamentoItens.map(fi => fi.equipamento_id);
      const { data: equipsData } = await supabase
        .from("equipamentos")
        .select("id, tipo, modelo, tag_placa, numero_serie")
        .in("id", equipIds);

      const equipsMap = new Map((equipsData || []).map(e => [e.id, e]));
      faturamentoItens.forEach(fi => {
        itemsList.push({
          ...fi,
          equipamentos: equipsMap.get(fi.equipamento_id) || null
        });
      });
    }

    // Objeto de contrato
    const uniqueTypes = new Set<string>();
    itemsList.forEach(fi => {
      if (fi.equipamentos?.tipo) uniqueTypes.add(fi.equipamentos.tipo.toUpperCase());
    });
    const objetoContrato = Array.from(uniqueTypes).join(", ") || "LOCAÇÃO DE EQUIPAMENTOS";

    // 2. CLIENT METADATA BOX
    const metaBody = [
      ["Mês de Referência:", item.periodo || "—"],
      ["Período de Medição:", inicioFmt && fimFmt ? `${inicioFmt} a ${fimFmt}` : "—"],
      ["Empresa Contratante:", empNome],
      ["CNPJ Contratante:", empCnpj],
      ["Objeto de contrato:", objetoContrato],
    ];

    autoTable(doc, {
      startY: y,
      body: metaBody,
      styles: { fontSize: 8.5, cellPadding: 2, textColor: [40, 40, 40] },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: "bold", fillColor: [245, 245, 245] },
        1: { fillColor: [255, 255, 255] }
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    const isDiarias = ct?.tipo_medicao === "diarias";
    const unit = isDiarias ? "d" : "h";
    const rateLabel = isDiarias ? "V/d" : "V/h";
    const rateExcLabel = isDiarias ? "V/d Exc" : "V/h Exc";

    let medicaoTotal = 0;

    // Fetch faturamento_gastos links
    const { data: linkRes } = await supabase.from("faturamento_gastos").select("gasto_id").eq("faturamento_id", item.id);
    const linkIds = (linkRes || []).map(r => r.gasto_id).filter(Boolean);
    
    // Fetch gastos details manually to bypass schema cache issues
    let gastosList: any[] = [];
    if (linkIds.length > 0) {
      const { data: detailsRes } = await supabase.from("gastos").select("*").in("id", linkIds);
      if (detailsRes) {
        gastosList = detailsRes.map(g => ({
          gasto_id: g.id,
          gastos: g
        }));
      }
    }
    const gastosEquips = gastosList.filter(fg => fg.gastos && fg.gastos.tipo !== "Mobilização" && fg.gastos.tipo !== "Desmobilização");
    const gastosMobDesmob = gastosList.filter(fg => fg.gastos && (fg.gastos.tipo === "Mobilização" || fg.gastos.tipo === "Desmobilização"));

    let totalMobDesmob = 0;
    let totalCustosCobrar = 0;
    let totalCustosReembolsar = 0;

    // 3. EQUIPMENTS LOOP
    for (const fi of itemsList) {
      if (y + 40 > pageH) {
        doc.addPage();
        y = 15;
      }

      const equipId = fi.equipamento_id;
      const equip = fi.equipamentos;
      const valorUnit = Number(fi.valor_hora);
      const valorExc = Number(fi.valor_excedente_hora ?? fi.valor_hora_excedente ?? 0);
      const horasNormais = Number(fi.horas_normais ?? fi.horas_medidas ?? 0);
      const horasExcedentes = Number(fi.horas_excedentes ?? fi.horas_excedentes ?? 0);
      const displayMinima = Number(fi.valor_total_item ?? fi.hora_minima ?? 0);
      const displayMedidas = Number(fi.horas_totais ?? fi.horas_medidas ?? 0);

      const totalItem = (horasNormais * valorUnit) + (horasExcedentes * valorExc);
      medicaoTotal += totalItem;

      // Equipment Header Row
      const equipHeader = `${equip?.tipo || ""} ${equip?.modelo || ""} | Tag: ${equip?.tag_placa || "—"} | NS: ${equip?.numero_serie || "—"}`;
      doc.setFillColor(41, 128, 185);
      doc.rect(mL, y, contentW, 6, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(equipHeader.toUpperCase(), mL + 2, y + 4.2);
      y += 6;

      // Notes (Ajustes)
      const notes: string[] = [];
      const ce = ceList.find(c => c.equipamento_id === equipId);
      const ae = aditivoEquipList.find(a => a.equipamento_id === equipId);
      const dataEntrega = ae?.data_entrega || ce?.data_entrega || null;
      const dataDevolucao = ae?.data_devolucao || ce?.data_devolucao || null;
      const hasMob = dataEntrega && dataEntrega >= inicio && dataEntrega <= fim;
      const hasDesmob = dataDevolucao && dataDevolucao >= inicio && dataDevolucao <= fim;
      if (hasMob) notes.push("Mobilização (Proporcional)");
      if (hasDesmob) notes.push("Desmobilização (Proporcional)");

      const activeAjuste = activeAjustes.find(a => a.equipamento_id === equipId);
      if (activeAjuste) {
        const ajInicioFmt = parseLocalDate(activeAjuste.data_inicio).toLocaleDateString("pt-BR");
        const ajFimFmt = parseLocalDate(activeAjuste.data_fim).toLocaleDateString("pt-BR");
        const motivoText = activeAjuste.motivo ? `${activeAjuste.motivo}` : "Ajuste";
        notes.push(`Ajuste: ${motivoText} • Período: ${ajInicioFmt} a ${ajFimFmt}`);
      } else {
        const activeAd = aditivos.find(a => ae?.aditivo_id === a.id);
        if (activeAd) {
          notes.push(`Aditivo #${activeAd.numero}`);
        }
      }

      if (notes.length > 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(notes.join(" / "), mL + 2, y + 4);
        y += 5;
      } else {
        y += 1.5;
      }

      // Query indisponibilidade for this equipment in this period
      const { data: medIndisp } = await supabase
        .from("medicoes")
        .select("horas_trabalhadas")
        .eq("equipamento_id", equipId)
        .eq("tipo", "Indisponível")
        .gte("data", inicio)
        .lte("data", fim);
      const indispQty = (medIndisp || []).reduce((sum, m) => sum + Number(m.horas_trabalhadas || 0), 0);

      // Main Equipment Data Table
      const eqHeaders = [rateLabel, rateExcLabel, "Mínima", "Horas Medidas", "Indisponível", "Horas Normais", "Horas Excedentes", "Valor Medição"];
      const eqRow = [
        fmtBRL(valorUnit),
        fmtBRL(valorExc),
        `${displayMinima.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${unit}`,
        `${displayMedidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${unit}`,
        `${indispQty.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${unit}`,
        `${horasNormais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${unit}`,
        `${horasExcedentes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${unit}`,
        fmtBRL(totalItem)
      ];

      autoTable(doc, {
        startY: y,
        head: [eqHeaders],
        body: [eqRow],
        styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
        headStyles: { fillColor: [240, 240, 240], textColor: [80, 80, 80], fontStyle: "bold", halign: 'center' },
        columnStyles: {
          7: { fontStyle: "bold", textColor: [40, 40, 40] } // Valor Medição bold
        },
        theme: "grid"
      });
      y = (doc as any).lastAutoTable.finalY;

      // Equipments Costs (Gastos)
      const equipGastos = gastosEquips.filter(g => g.gastos && g.gastos.equipamento_id === equipId);
      
      let equipCusto = 0;
      let equipReembolso = 0;

      if (equipGastos.length > 0) {
        const costHeaders = ["Data", "Descrição", "Tipo", "Classificação", "Valor"];
        const costRows = equipGastos.map(fg => {
          const val = Number(fg.gastos.valor || 0);
          const classif = fg.gastos.classificacao || fg.gastos.status || "A Cobrar do Cliente";
          const isReembolso = classif === "A Reembolsar ao Cliente";
          if (isReembolso) {
             equipReembolso += val;
             totalCustosReembolsar += val;
          } else {
             equipCusto += val;
             totalCustosCobrar += val;
          }
          return [
            parseLocalDate(fg.gastos.data).toLocaleDateString("pt-BR"),
            fg.gastos.descricao || "—",
            fg.gastos.tipo || "—",
            classif,
            isReembolso ? `- ${fmtBRL(val)}` : fmtBRL(val)
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [costHeaders],
          body: costRows,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [255, 255, 255], textColor: [80, 80, 80], fontStyle: "bold" },
          columnStyles: {
            4: { align: "right" }
          },
          theme: "grid"
        });
        y = (doc as any).lastAutoTable.finalY + 2;
      } else {
        y += 2;
      }

      // Equipment Summary Subtotal
      const subtotalEquip = totalItem + equipCusto - equipReembolso;
      
      doc.setFontSize(8);
      let summaryY = y + 4;
      const alignRight = pageW - mR;
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(`Medição: ${fmtBRL(totalItem)}`, alignRight - 55, summaryY, { align: "right" });
      
      if (equipCusto > 0) {
        doc.text(`(+) Custos: ${fmtBRL(equipCusto)}`, alignRight, summaryY, { align: "right" });
        summaryY += 4;
      } else {
        summaryY += 4;
      }
      
      if (equipReembolso > 0) {
        doc.setTextColor(192, 57, 43); // Red
        doc.text(`('') Reembolso: ${fmtBRL(equipReembolso)}`, alignRight, summaryY, { align: "right" });
        summaryY += 4;
      }
      
      doc.setTextColor(41, 128, 185); // Blue
      doc.text(`Subtotal Equipamento: ${fmtBRL(subtotalEquip)}`, alignRight, summaryY, { align: "right" });
      
      y = summaryY + 8;
    }

    // 3.5. CUSTOS ADICIONAIS GERAIS (Sem equipamento vinculado)
    const gastosGerais = gastosEquips.filter(g => !g.gastos?.equipamento_id);
    let totalGeraisCobrar = 0;
    let totalGeraisReembolsar = 0;

    if (gastosGerais.length > 0) {
      if (y + 35 > pageH) {
        doc.addPage();
        y = 15;
      }

      doc.setFillColor(41, 128, 185);
      doc.rect(mL, y, contentW, 6, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text("CUSTOS ADICIONAIS", mL + 2, y + 4.2);
      y += 6;

      const geraisHeaders = ["Data", "Descrição", "Tipo", "Classificação", "Valor"];
      const geraisRows = gastosGerais.map(fg => {
        const val = Number(fg.gastos?.valor || 0);
        const classif = fg.gastos?.classificacao || fg.gastos?.status || "A Cobrar do Cliente";
        const isReembolso = classif === "A Reembolsar ao Cliente";
        if (isReembolso) {
           totalGeraisReembolsar += val;
        } else {
           totalGeraisCobrar += val;
        }
        return [
          parseLocalDate(fg.gastos?.data || "").toLocaleDateString("pt-BR"),
          fg.gastos?.descricao || "—",
          fg.gastos?.tipo || "—",
          classif,
          isReembolso ? `- ${fmtBRL(val)}` : fmtBRL(val)
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [geraisHeaders],
        body: geraisRows,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [240, 240, 240], textColor: [80, 80, 80], fontStyle: "bold" },
        columnStyles: { 4: { align: "right" } },
        theme: "grid"
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      
      const sumGerais = totalGeraisCobrar - totalGeraisReembolsar;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(41, 128, 185);
      doc.text(`Subtotal Custos Adicionais: ${fmtBRL(sumGerais)}`, pageW - mR, y, { align: "right" });
      y += 8;
    }

    // 4. MOBILIZAÇÃO / DESMOBILIZAÇÃO
    if (gastosMobDesmob.length > 0) {
      if (y + 35 > pageH) {
        doc.addPage();
        y = 15;
      }

      doc.setFillColor(41, 128, 185);
      doc.rect(mL, y, contentW, 6, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text("MOBILIZAÇÃO / DESMOBILIZAÇÃO", mL + 2, y + 4.2);
      y += 6;

      const mobHeaders = ["Data", "Equipamento", "Descrição", "Tipo", "Classificação", "Valor"];
      const mobRows = gastosMobDesmob.map(fg => {
        const val = Number(fg.gastos.valor || 0);
        const classif = fg.gastos.classificacao || fg.gastos.status || "A Cobrar do Cliente";
        totalMobDesmob += val;
        
        let equipLabel = "—";
        if (fg.gastos.equipamento_id) {
          const itemEquip = itemsList.find(fi => fi.equipamento_id === fg.gastos.equipamento_id);
          if (itemEquip?.equipamentos) {
            equipLabel = `${itemEquip.equipamentos.tipo} ${itemEquip.equipamentos.modelo} ${itemEquip.equipamentos.tag_placa ? `(${itemEquip.equipamentos.tag_placa})` : ""}`;
          }
        }
        return [
          parseLocalDate(fg.gastos.data).toLocaleDateString("pt-BR"),
          equipLabel,
          fg.gastos.descricao || "—",
          fg.gastos.tipo || "—",
          classif,
          fmtBRL(val)
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [mobHeaders],
        body: mobRows,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [240, 240, 240], textColor: [80, 80, 80], fontStyle: "bold" },
        columnStyles: {
          5: { align: "right" }
        },
        theme: "grid"
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(41, 128, 185);
      doc.text(`Total Mobilização: ${fmtBRL(totalMobDesmob)}`, pageW - mR, y, { align: "right" });
      y += 8;
    }


    // 5. SUMMARY TABLE (VALOR TOTAL DA MEDIÇÃO)
    if (y + 40 > pageH) {
      doc.addPage();
      y = 15;
    }

    const totalGeralCobrar = totalCustosCobrar + totalGeraisCobrar;
    const totalGeralReembolsar = totalCustosReembolsar + totalGeraisReembolsar;

    const summaryRows = [
      ["Medição (Equipamentos)", fmtBRL(medicaoTotal)]
    ];
    if (totalGeralCobrar > 0) {
      summaryRows.push(["(+) Custos Operacionais a Cobrar", fmtBRL(totalGeralCobrar)]);
    }
    if (totalGeralReembolsar > 0) {
      summaryRows.push(["('-') Custos Operacionais a Reembolsar", `- ${fmtBRL(totalGeralReembolsar)}`]);
    }
    if (totalMobDesmob > 0) {
      summaryRows.push(["(+) Mobilização / Desmobilização", fmtBRL(totalMobDesmob)]);
    }

    const valorTotalMedicao = medicaoTotal + totalGeralCobrar - totalGeralReembolsar + totalMobDesmob;
    summaryRows.push(["VALOR TOTAL DA MEDIÇÃO", fmtBRL(valorTotalMedicao)]);

    autoTable(doc, {
      startY: y,
      body: summaryRows,
      styles: { fontSize: 8.5, cellPadding: 3, fontStyle: "bold", textColor: [80, 80, 80] },
      columnStyles: {
        0: { cellWidth: 150 },
        1: { align: "right" }
      },
      theme: "grid",
      didParseCell: (cellData: any) => {
        if (cellData.row.index === summaryRows.length - 1) {
          cellData.cell.styles.fillColor = [41, 128, 185];
          cellData.cell.styles.textColor = [255, 255, 255];
          cellData.cell.styles.fontSize = 9.5;
        } else {
          cellData.cell.styles.fillColor = [255, 255, 255];
        }
      }
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    // 6. OBSERVAÇÕES
    const obs = item.observacoes;
    if (obs && obs.trim()) {
      const obsLines = doc.splitTextToSize(obs, contentW);
      const obsHeight = (obsLines.length * 4) + 6;

      if (y + obsHeight + 20 > pageH) {
        doc.addPage();
        y = 15;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);
      doc.text("Observações:", mL, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      obsLines.forEach((line: string) => {
        doc.text(line, mL, y);
        y += 4;
      });
      y += 8;
    }

    // 7. APPROVAL / SIGNATURES BLOCK
    if (y + 35 > pageH) {
      doc.addPage();
      y = 15;
    } else {
      y = Math.max(y + 10, pageH - 40);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("Aprovação:", mL, y);
    y += 18;

    const lineW = 80;
    const gap = contentW - (lineW * 2);

    // Left signature line
    const leftX = mL;
    doc.setDrawColor(120);
    doc.setLineWidth(0.3);
    doc.line(leftX, y, leftX + lineW, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(busatoNome.toUpperCase(), leftX + (lineW / 2), y + 4.5, { align: "center" });

    // Right signature line
    const rightX = mL + lineW + gap;
    doc.line(rightX, y, rightX + lineW, y);
    doc.text(empNome.toUpperCase(), rightX + (lineW / 2), y + 4.5, { align: "center" });
  }

  // 8. PAGE FOOTER (Post-processing page numbers)
  const totalPages = doc.internal.getNumberOfPages();
  const nowStr = new Date().toLocaleString("pt-BR");
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Documento gerado em ${nowStr} — Página ${i} de ${totalPages}`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
  }

  if (download) {
    doc.save(`boletim_medicao_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
  return doc;
};
