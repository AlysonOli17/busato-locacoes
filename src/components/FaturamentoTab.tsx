import { useState, useEffect, useMemo } from "react";
import { getEquipLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DollarSign, FileDown, Plus, Pencil, Trash2, Eye, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CurrencyInput } from "@/components/CurrencyInput";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  razao_social: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
}

interface ContaBancaria {
  id: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  titular: string;
  cnpj_cpf: string | null;
  pix: string | null;
}

interface Fatura {
  id: string;
  contrato_id: string;
  numero_sequencial: number;
  emissao: string;
  status: string;
  valor_total: number;
  horas_normais: number;
  horas_excedentes: number;
  periodo_medicao_inicio: string | null;
  periodo_medicao_fim: string | null;
  total_gastos: number;
  numero_nota: string | null;
  conta_bancaria_id: string | null;
  periodo: string;
  valor_hora: number;
  valor_excedente_hora: number;
}

interface ContratoRef {
  id: string;
  empresa_id: string;
  prazo_faturamento: number;
  empresas: { nome: string; cnpj: string };
  equipamentos: { tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null };
}

interface FaturaEquip {
  id: string;
  faturamento_id: string;
  equipamento_id: string;
  horas_normais: number;
  horas_excedentes: number;
  horas_medidas: number;
  valor_hora: number;
  valor_hora_excedente: number;
  hora_minima: number;
  primeiro_mes: boolean;
}

interface EquipamentoInfo {
  id: string;
  tipo: string;
  modelo: string;
  tag_placa: string | null;
}

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

let logoCache: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (logoCache) return logoCache;
  try {
    const resp = await fetch("/images/logo-busato-horizontal.png");
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => { logoCache = reader.result as string; resolve(logoCache); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export const FaturamentoTab = () => {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [contratos, setContratos] = useState<ContratoRef[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoInfo[]>([]);
  const [faturaEquips, setFaturaEquips] = useState<Map<string, FaturaEquip[]>>(new Map());
  const [faturaGastos, setFaturaGastos] = useState<Map<string, { descricao: string; valor: number; tipo: string }[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterEmpresa, setFilterEmpresa] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editDialog, setEditDialog] = useState(false);
  const [editingFatura, setEditingFatura] = useState<Fatura | null>(null);
  const [editForm, setEditForm] = useState({ status: "", numero_nota: "", conta_bancaria_id: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    const [fatRes, ctRes, empRes, contasRes, equipRes] = await Promise.all([
      supabase.from("faturamento").select("*").in("status", ["Aprovado", "Pago", "Cancelado"]).order("numero_sequencial", { ascending: false }),
      supabase.from("contratos").select("id, empresa_id, prazo_faturamento, empresas(nome, cnpj), equipamentos(tipo, modelo, tag_placa, numero_serie)"),
      supabase.from("empresas").select("id, nome, cnpj, razao_social, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, inscricao_estadual, inscricao_municipal"),
      supabase.from("contas_bancarias").select("*"),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie"),
    ]);
    if (fatRes.data) setFaturas(fatRes.data as unknown as Fatura[]);
    if (ctRes.data) setContratos(ctRes.data as unknown as ContratoRef[]);
    if (empRes.data) setEmpresas(empRes.data as unknown as Empresa[]);
    if (contasRes.data) setContas(contasRes.data as unknown as ContaBancaria[]);
    if (equipRes.data) setEquipamentos(equipRes.data as unknown as EquipamentoInfo[]);

    // Load faturamento_equipamentos for all faturas
    if (fatRes.data && fatRes.data.length > 0) {
      const ids = fatRes.data.map((f: any) => f.id);
      const [feRes, fgRes] = await Promise.all([
        supabase.from("faturamento_equipamentos").select("*").in("faturamento_id", ids),
        supabase.from("faturamento_gastos").select("*, gastos(descricao, valor, tipo)").in("faturamento_id", ids),
      ]);
      if (feRes.data) {
        const map = new Map<string, FaturaEquip[]>();
        feRes.data.forEach((fe: any) => {
          const list = map.get(fe.faturamento_id) || [];
          list.push(fe as FaturaEquip);
          map.set(fe.faturamento_id, list);
        });
        setFaturaEquips(map);
      }
      if (fgRes.data) {
        const map = new Map<string, { descricao: string; valor: number; tipo: string }[]>();
        fgRes.data.forEach((fg: any) => {
          if (!fg.gastos) return;
          const list = map.get(fg.faturamento_id) || [];
          list.push({ descricao: fg.gastos.descricao, valor: Number(fg.gastos.valor), tipo: fg.gastos.tipo });
          map.set(fg.faturamento_id, list);
        });
        setFaturaGastos(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getContrato = (contratoId: string) => contratos.find(c => c.id === contratoId);
  const getEmpresa = (empresaId: string) => empresas.find(e => e.id === empresaId);
  const getEquipamento = (equipId: string) => equipamentos.find(e => e.id === equipId);
  const getConta = (contaId: string | null) => contaId ? contas.find(c => c.id === contaId) : null;

  const getVencimento = (fatura: Fatura) => {
    const ct = getContrato(fatura.contrato_id);
    const prazo = ct?.prazo_faturamento || 30;
    const emissao = parseLocalDate(fatura.emissao);
    const venc = new Date(emissao);
    venc.setDate(venc.getDate() + prazo);
    return venc;
  };

  const getDisplayStatus = (fatura: Fatura) => {
    if (fatura.status === "Pago" || fatura.status === "Cancelado") return fatura.status;
    if (fatura.status === "Aprovado") {
      const venc = getVencimento(fatura);
      if (new Date() > venc) return "Em Atraso";
      return "Pendente";
    }
    return fatura.status;
  };

  const filteredFaturas = useMemo(() => {
    return faturas.filter(f => {
      if (filterStatus !== "all") {
        const status = getDisplayStatus(f);
        if (filterStatus !== status) return false;
      }
      if (filterEmpresa !== "all") {
        const ct = getContrato(f.contrato_id);
        if (ct?.empresa_id !== filterEmpresa) return false;
      }
      return true;
    });
  }, [faturas, filterEmpresa, filterStatus, contratos]);

  // KPIs
  const totalFaturado = faturas.filter(f => f.status === "Pago").reduce((s, f) => s + Number(f.valor_total), 0);
  const totalPendente = faturas.filter(f => getDisplayStatus(f) === "Pendente").reduce((s, f) => s + Number(f.valor_total), 0);
  const totalAtraso = faturas.filter(f => getDisplayStatus(f) === "Em Atraso").reduce((s, f) => s + Number(f.valor_total), 0);

  const openEdit = (fatura: Fatura) => {
    setEditingFatura(fatura);
    setEditForm({
      status: fatura.status,
      numero_nota: fatura.numero_nota || "",
      conta_bancaria_id: fatura.conta_bancaria_id || "",
    });
    setEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingFatura) return;
    const { error } = await supabase.from("faturamento").update({
      status: editForm.status,
      numero_nota: editForm.numero_nota || null,
      conta_bancaria_id: editForm.conta_bancaria_id || null,
    }).eq("id", editingFatura.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Fatura atualizada" });
    setEditDialog(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    // Delete related records first
    await supabase.from("faturamento_gastos").delete().eq("faturamento_id", deleteId);
    await supabase.from("faturamento_equipamentos").delete().eq("faturamento_id", deleteId);
    const { error } = await supabase.from("faturamento").delete().eq("id", deleteId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Fatura excluída" });
    setDeleteId(null);
    fetchData();
  };

   const generateInvoicePDF = async (fatura: Fatura) => {
    const ct = getContrato(fatura.contrato_id);
    if (!ct) return;
    const empresa = getEmpresa(ct.empresa_id);
    if (!empresa) return;
    const conta = getConta(fatura.conta_bancaria_id);
    const vencimento = getVencimento(fatura);
    const equips = faturaEquips.get(fatura.id) || [];
    const logo = await loadLogo();

    // Fetch Busato company data dynamically
    const { data: busatoData } = await supabase
      .from("empresas")
      .select("*")
      .ilike("nome", "%busato%")
      .limit(1)
      .single();

    const busatoNome = busatoData?.razao_social || busatoData?.nome || "BUSATO LOCAÇÕES E SERVIÇOS LTDA";
    const busatoEndereco = [
      busatoData?.endereco_logradouro,
      busatoData?.endereco_numero,
      busatoData?.endereco_complemento,
      busatoData?.endereco_bairro,
      busatoData?.endereco_cidade,
      busatoData?.endereco_uf,
      busatoData?.endereco_cep ? `CEP: ${busatoData.endereco_cep}` : ""
    ].filter(Boolean).join(", ");
    const busatoCnpj = busatoData?.cnpj || "";
    const busatoIE = busatoData?.inscricao_estadual || "";

    // ABNT NBR 14724 margins: top 30mm, bottom 20mm, left 30mm, right 20mm
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth(); // 210
    const pageH = doc.internal.pageSize.getHeight(); // 297
    const mLeft = 30;
    const mRight = 20;
    const mTop = 20;
    const mBottom = 20;
    const contentW = pageW - mLeft - mRight;
    let y = mTop;

    // === HEADER ===
    if (logo) doc.addImage(logo, "PNG", mLeft, y, 48, 12);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    const docLabel = fatura.numero_nota || String(fatura.numero_sequencial).padStart(3, "0");
    doc.text(`FATURA DE LOCAÇÃO ${docLabel}`, pageW - mRight, y + 8, { align: "right" });
    y += 18;

    // Busato info (dynamic from empresas table)
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(busatoNome.toUpperCase(), mLeft, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    if (busatoEndereco) {
      doc.text(busatoEndereco, mLeft, y);
      y += 3;
    }
    const cnpjLine = [busatoCnpj ? `CNPJ: ${busatoCnpj}` : "", busatoIE ? `Inscrição Estadual: ${busatoIE}` : ""].filter(Boolean).join(" - ");
    if (cnpjLine) {
      doc.text(cnpjLine, mLeft, y);
    }
    y += 5;

    // Date + Value header
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.line(mLeft, y, pageW - mRight, y);
    y += 5;

    const colMid = mLeft + contentW / 2;

    // Row: Data emissão | Valor da fatura
    const drawLabelValue = (label: string, value: string, x: number, yPos: number, width: number) => {
      doc.setFillColor(41, 128, 185);
      doc.rect(x, yPos, width, 5, "F");
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(label, x + 2, yPos + 3.5);
      doc.setFillColor(255, 255, 255);
      doc.rect(x, yPos + 5, width, 6, "S");
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(value, x + 2, yPos + 9.5);
    };

    drawLabelValue("DATA DA EMISSÃO", parseLocalDate(fatura.emissao).toLocaleDateString("pt-BR"), mLeft, y, contentW / 2 - 1);
    drawLabelValue("VALOR DA FATURA", `R$ ${Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colMid + 1, y, contentW / 2 - 1);
    y += 15;

    // === CLIENT INFO ===
    const drawField = (label: string, value: string, x: number, yPos: number, width: number) => {
      doc.setFillColor(230, 240, 250);
      doc.rect(x, yPos, width, 4.5, "F");
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text(label, x + 1.5, yPos + 3.2);
      doc.rect(x, yPos + 4.5, width, 6, "S");
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(value || "", x + 1.5, yPos + 9);
    };

    drawField("NOME / RAZÃO SOCIAL", empresa.razao_social || empresa.nome, mLeft, y, contentW);
    y += 12;

    const endereco = [empresa.endereco_logradouro, empresa.endereco_numero, empresa.endereco_bairro, empresa.endereco_cep ? `CEP ${empresa.endereco_cep}` : ""].filter(Boolean).join(", ");
    drawField("ENDEREÇO", endereco, mLeft, y, contentW);
    y += 12;

    const thirdW = contentW / 3 - 1;
    drawField("MUNICÍPIO", empresa.endereco_cidade || "", mLeft, y, thirdW);
    drawField("ESTADO", empresa.endereco_uf || "", mLeft + thirdW + 1.5, y, thirdW);
    drawField("CNPJ", empresa.cnpj, mLeft + (thirdW + 1.5) * 2, y, thirdW);
    y += 12;

    drawField("INSCRIÇÃO MUNICIPAL", empresa.inscricao_municipal || "", mLeft, y, contentW / 2 - 1);
    drawField("INSCRIÇÃO ESTADUAL", empresa.inscricao_estadual || "", colMid + 1, y, contentW / 2 - 1);
    y += 12;

    // Payment info
    drawField("CONDIÇÕES PAGAMENTO", "Crédito Bancário", mLeft, y, thirdW);
    drawField("DATA DE VENCIMENTO", vencimento.toLocaleDateString("pt-BR"), mLeft + thirdW + 1.5, y, thirdW);
    drawField("LOCAL DE PAGAMENTO", conta ? `${empresa.endereco_cidade || "—"} ${empresa.endereco_uf || ""}` : "—", mLeft + (thirdW + 1.5) * 2, y, thirdW);
    y += 12;

    // Bank info
    if (conta) {
      const bankText = `O PAGAMENTO DEVERÁ SER EFETUADO ATRAVÉS DE DEPÓSITO BANCÁRIO PARA BUSATO LOCAÇÕES E SERVIÇOS\nBANCO ${conta.banco}, AGÊNCIA ${conta.agencia}.\nCONTA ${conta.tipo_conta.toUpperCase()} Nº ${conta.conta}${conta.pix ? `\nPIX: ${conta.pix}` : ""}`;
      doc.setFillColor(230, 240, 250);
      doc.rect(mLeft, y, contentW, 4.5, "F");
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("ENDEREÇO DE COBRANÇA:", mLeft + 1.5, y + 3.2);
      y += 7;
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const lines = doc.splitTextToSize(bankText, contentW - 4);
      const boxH = lines.length * 4 + 3;
      doc.rect(mLeft, y, contentW, boxH, "S");
      let lineY = y + 4;
      lines.forEach((line: string) => {
        doc.text(line, mLeft + 2, lineY);
        lineY += 4;
      });
      y += boxH + 3;
    } else {
      y += 2;
    }

    // === DESCRIPTION TABLE ===
    autoTable(doc, {
      startY: y,
      head: [["DESCRIÇÃO", "QUANT.", "VALOR UNIT.", "TOTAL", "CFOP"]],
      body: [
        [
          "Locação de Equipamento, sem Cessão de Mão de Obra.",
          "1,00",
          `R$ ${Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `R$ ${Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          "",
        ],
      ],
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2.5, lineWidth: 0.2, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 6.5, lineColor: [41, 128, 185] },
      tableWidth: contentW,
      columnStyles: {
        0: { cellWidth: contentW * 0.45 },
        1: { halign: "center", cellWidth: contentW * 0.1 },
        2: { halign: "right", cellWidth: contentW * 0.18 },
        3: { halign: "right", cellWidth: contentW * 0.18 },
        4: { halign: "center", cellWidth: contentW * 0.09 },
      },
      margin: { left: mLeft, right: mRight },
    });

    y = (doc as any).lastAutoTable.finalY;

    // Total
    doc.setFillColor(41, 128, 185);
    doc.rect(mLeft, y, contentW, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("VALOR TOTAL DA FATURA", mLeft + 2, y + 4.2);
    doc.text(`R$ ${Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageW - mRight - 2, y + 4.2, { align: "right" });
    y += 8;

    // Legal note
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "italic");
    doc.text("AUTORIZADO CONFORME LEI COMPLEMENTAR 116/03", mLeft, y + 2);
    y += 8;

    // Complementary info
    doc.setFillColor(230, 240, 250);
    doc.rect(mLeft, y, contentW, 4.5, "F");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    doc.text("Informações complementares:", mLeft + 1.5, y + 3.2);
    y += 9;

    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "normal");
     doc.setFontSize(7);

    // Equipment list with hours info
    if (equips.length > 0) {
      equips.forEach(fe => {
        const eq = getEquipamento(fe.equipamento_id);
        if (eq) {
          const qtStr = `01 ${eq.tipo.toUpperCase()} ${eq.modelo.toUpperCase()}${eq.tag_placa ? ` - ${eq.tag_placa}` : ""}`;
          const wrappedLines = doc.splitTextToSize(qtStr, contentW - 4);
          wrappedLines.forEach((line: string) => {
            doc.text(line, mLeft + 2, y);
            y += 4;
          });
        }
      });
    } else {
      const eq = ct?.equipamentos;
      if (eq) {
        doc.text(`01 ${eq.tipo.toUpperCase()} ${eq.modelo.toUpperCase()}${eq.tag_placa ? ` - ${eq.tag_placa}` : ""}`, mLeft + 2, y);
        y += 6;
      }
    }

    // Additional costs
    const allGastos = faturaGastos.get(fatura.id) || [];
    if (allGastos.length > 0) {
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.text("Custos Adicionais:", mLeft + 2, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      allGastos.forEach(g => {
        const line = `• ${g.tipo} — ${g.descricao}: R$ ${g.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const wrapped = doc.splitTextToSize(line, contentW - 4);
        wrapped.forEach((l: string) => {
          doc.text(l, mLeft + 2, y);
          y += 4;
        });
      });
      const totalGastos = allGastos.reduce((s, g) => s + g.valor, 0);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Custos Adicionais: R$ ${totalGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, mLeft + 2, y);
      y += 5;
      doc.setFont("helvetica", "normal");
    }

    if (fatura.periodo_medicao_inicio && fatura.periodo_medicao_fim) {
      doc.text(
        `Período ${parseLocalDate(fatura.periodo_medicao_inicio).toLocaleDateString("pt-BR")} a ${parseLocalDate(fatura.periodo_medicao_fim).toLocaleDateString("pt-BR")}`,
        mLeft + 2, y
      );
      y += 5;
    }

    // === SIGNATURE — positioned near footer ===
    const sigY = pageH - mBottom - 30; // 30mm above bottom margin
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("ATENCIOSAMENTE", pageW / 2, sigY, { align: "center" });
    doc.setLineWidth(0.3);
    doc.setDrawColor(80, 80, 80);
    doc.line(pageW / 2 - 35, sigY + 10, pageW / 2 + 35, sigY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Edno Busato", pageW / 2, sigY + 14, { align: "center" });
    doc.text("CPF - 005.110.117-33", pageW / 2, sigY + 17.5, { align: "center" });
    doc.text("Busato Locações e Serviços LTDA", pageW / 2, sigY + 21, { align: "center" });

    const saveLabel = fatura.numero_nota || String(fatura.numero_sequencial).padStart(3, "0");
    doc.save(`fatura_locacao_${saveLabel}.pdf`);
    toast({ title: "PDF gerado", description: `Fatura ${saveLabel} exportada com sucesso.` });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Pago": return "bg-success text-success-foreground";
      case "Em Atraso": return "bg-destructive text-destructive-foreground";
      case "Cancelado": return "bg-muted text-muted-foreground";
      default: return "bg-warning text-warning-foreground";
    }
  };

  const empresasComFatura = useMemo(() => {
    const ids = new Set<string>();
    faturas.forEach(f => {
      const ct = getContrato(f.contrato_id);
      if (ct) ids.add(ct.empresa_id);
    });
    return empresas.filter(e => ids.has(e.id));
  }, [faturas, contratos, empresas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
          <p className="text-sm text-muted-foreground">Faturas emitidas a partir de medições aprovadas</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pago</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">R$ {totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Atraso</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">R$ {totalAtraso.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-64">
          <SearchableSelect
            value={filterEmpresa}
            onValueChange={setFilterEmpresa}
            placeholder="Todas as Empresas"
            searchPlaceholder="Pesquisar empresa..."
            options={[
              { value: "all", label: "Todas as Empresas" },
              ...empresasComFatura.map(e => ({ value: e.id, label: e.nome })),
            ]}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
            <SelectItem value="Pago">Pago</SelectItem>
            <SelectItem value="Em Atraso">Em Atraso</SelectItem>
            <SelectItem value="Cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Nº Nota</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFaturas.map(f => {
                const ct = getContrato(f.contrato_id);
                const status = getDisplayStatus(f);
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono font-bold text-sm">{f.numero_nota || String(f.numero_sequencial).padStart(3, "0")}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{ct?.empresas?.nome || "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{ct?.empresas?.cnpj}</p>
                    </TableCell>
                    <TableCell className="text-sm">{getEquipLabel(ct?.equipamentos)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {f.periodo_medicao_inicio && f.periodo_medicao_fim
                        ? `${parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{parseLocalDate(f.emissao).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{getVencimento(f).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-bold text-sm">R$ {Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm font-mono">{f.numero_nota || "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColor(status)}>{status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Gerar PDF" onClick={() => generateInvoicePDF(f)}>
                          <FileDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(f.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && filteredFaturas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma fatura encontrada</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-accent" />
              Editar Fatura {editingFatura ? (editingFatura.numero_nota || String(editingFatura.numero_sequencial).padStart(3, "0")) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Aprovado">Aprovado</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nº da Nota Fiscal</Label>
              <Input value={editForm.numero_nota} onChange={e => setEditForm(p => ({ ...p, numero_nota: e.target.value }))} placeholder="Ex: NF-001234" />
            </div>
            <div>
              <Label>Conta Bancária</Label>
              <Select value={editForm.conta_bancaria_id || "none"} onValueChange={v => setEditForm(p => ({ ...p, conta_bancaria_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.banco} - Ag {c.agencia} / CC {c.conta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fatura</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta fatura? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
