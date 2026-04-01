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
import { DollarSign, FileDown, FileText, Plus, Pencil, Trash2, Eye, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SortableTableHead } from "@/components/SortableTableHead";
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
  const [sortCol, setSortCol] = useState("numero");
  const [sortAsc, setSortAsc] = useState(false);
  const toggleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };

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
    const baseDate = (fatura as any).data_aprovacao
      ? parseLocalDate((fatura as any).data_aprovacao)
      : parseLocalDate(fatura.emissao);
    const venc = new Date(baseDate);
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

  const sortedFaturas = useMemo(() => {
    return [...filteredFaturas].sort((a, b) => {
      let cmp = 0;
      const ctA = getContrato(a.contrato_id);
      const ctB = getContrato(b.contrato_id);
      switch (sortCol) {
        case "numero": cmp = (a.numero_nota || String(a.numero_sequencial)).localeCompare(b.numero_nota || String(b.numero_sequencial)); break;
        case "empresa": cmp = (ctA?.empresas?.nome || "").localeCompare(ctB?.empresas?.nome || ""); break;
        case "emissao": cmp = a.emissao.localeCompare(b.emissao); break;
        case "vencimento": cmp = getVencimento(a).getTime() - getVencimento(b).getTime(); break;
        case "valor": cmp = Number(a.valor_total) - Number(b.valor_total); break;
        case "status": cmp = getDisplayStatus(a).localeCompare(getDisplayStatus(b)); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredFaturas, sortCol, sortAsc]);

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
    ].filter(Boolean).join(", ");
    const busatoBairroLine = [
      busatoData?.endereco_bairro,
      busatoData?.endereco_cidade,
      busatoData?.endereco_uf,
      busatoData?.endereco_cep ? `CEP:${busatoData.endereco_cep}` : "",
    ].filter(Boolean).join(", ");
    const busatoCnpj = busatoData?.cnpj || "";
    const busatoIE = busatoData?.inscricao_estadual || "";

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const mLeft = 15;
    const mRight = 15;
    const mTop = 15;
    const contentW = pageW - mLeft - mRight;
    const lineC = [0, 0, 0] as [number, number, number];
    const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const docLabel = fatura.numero_nota || String(fatura.numero_sequencial).padStart(3, "0");

    doc.setDrawColor(...lineC);
    doc.setLineWidth(0.3);

    let y = mTop;

    // ── OUTER BORDER ──
    doc.rect(mLeft, y, contentW, pageH - mTop - 15);

    // ── HEADER ROW: logo left, info right ──
    const headerH = 28;
    const logoColW = contentW * 0.4;
    const infoColW = contentW - logoColW;

    // Vertical divider in header
    doc.line(mLeft + logoColW, y, mLeft + logoColW, y + headerH);
    // Bottom of header
    doc.line(mLeft, y + headerH, mLeft + contentW, y + headerH);

    // Logo
    if (logo) {
      doc.addImage(logo, "PNG", mLeft + 6, y + 5, 55, 18);
    }

    // Right column: company info
    const infoX = mLeft + logoColW + 2;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`FATURA DE LOCAÇÃO ${docLabel}`, infoX, y + 6);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(busatoNome.toUpperCase(), infoX, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    if (busatoEndereco) doc.text(busatoEndereco, infoX, y + 14.5);
    if (busatoBairroLine) doc.text(busatoBairroLine, infoX, y + 17.5);
    const cnpjLine = [busatoCnpj ? `CNPJ: ${busatoCnpj}` : "", busatoIE ? ` Inscrição Estadual  ${busatoIE}` : ""].filter(Boolean).join("  -");
    if (cnpjLine) doc.text(cnpjLine, infoX, y + 21);

    y += headerH;

    // ── DATA DA EMISSÃO ──
    const emissaoH = 7;
    doc.line(mLeft, y + emissaoH, mLeft + contentW, y + emissaoH);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(`DATA DA EMISSÃO: ${parseLocalDate(fatura.emissao).toLocaleDateString("pt-BR")}`, mLeft + contentW - 2, y + 5, { align: "right" });
    y += emissaoH;

    // ── VALOR DA FATURA ──
    const valorH = 8;
    doc.line(mLeft, y + valorH, mLeft + contentW, y + valorH);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("VALOR DA FATURA   R$", mLeft + contentW * 0.25, y + 6, { align: "center" });
    doc.text(fmt(Number(fatura.valor_total)), mLeft + contentW * 0.7, y + 6, { align: "center" });
    y += valorH;

    // ── Helper for form fields ──
    const drawFormField = (label: string, value: string, x: number, yPos: number, w: number, h: number = 10) => {
      doc.rect(x, yPos, w, h);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(label, x + 1.5, yPos + 3.5);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(value || "", x + 1.5, yPos + 7.5);
    };

    // ── NOME/RAZÃO SOCIAL ──
    drawFormField("NOME/RAZÃO SOCIAL", (empresa.razao_social || empresa.nome).toUpperCase(), mLeft, y, contentW);
    y += 10;

    // ── ENDEREÇO ──
    const endereco = [empresa.endereco_logradouro, empresa.endereco_numero, `Bairro ${empresa.endereco_bairro || ""}`].filter(Boolean).join(", ");
    drawFormField("ENDEREÇO", endereco, mLeft, y, contentW);
    y += 10;

    // ── MUNICÍPIO | ESTADO ──
    const halfW = contentW / 2;
    drawFormField("MUNICÍPIO", empresa.endereco_cidade || "", mLeft, y, halfW);
    drawFormField("ESTADO", (empresa.endereco_uf || "").toUpperCase(), mLeft + halfW, y, halfW);
    y += 10;

    // ── CNPJ | INSCRIÇÃO MUNICIPAL | INSCRIÇÃO ESTADUAL ──
    const thirdW = contentW / 3;
    drawFormField("CNPJ", empresa.cnpj, mLeft, y, thirdW);
    drawFormField("INSCRIÇÃO MUNICIPAL", empresa.inscricao_municipal || "", mLeft + thirdW, y, thirdW);
    drawFormField("INSCRIÇÃO ESTADUAL", empresa.inscricao_estadual || "", mLeft + thirdW * 2, y, thirdW);
    y += 10;

    // ── CONDIÇÕES PAGAMENTO | DATA DE VENCIMENTO | LOCAL DE PAGAMENTO ──
    drawFormField("CONDIÇÕES PAGAMENTO", "Crédito Bancário", mLeft, y, thirdW);
    drawFormField("DATA DE VENCIMENTO", vencimento.toLocaleDateString("pt-BR"), mLeft + thirdW, y, thirdW);
    const localPagto = conta ? [busatoData?.endereco_cidade, busatoData?.endereco_uf].filter(Boolean).join(" ") : "—";
    drawFormField("LOCAL DE PAGAMENTO", localPagto, mLeft + thirdW * 2, y, thirdW);
    y += 10;

    // ── ENDEREÇO DE COBRANÇA ──
    const cobrancaLabelH = 5;
    doc.rect(mLeft, y, contentW, cobrancaLabelH);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text("ENDEREÇO DE COBRANÇA:", mLeft + 1.5, y + 3.5);
    y += cobrancaLabelH;

    if (conta) {
      const bankLine1 = `O PAGAMENTO DEVERÁ SER EFETUADO ATRAVÉS DE DEPÓSITO BANCÁRIO PARA ${busatoNome.toUpperCase()}`;
      const bankLine2 = `BANCO ${conta.banco}, AGÊNCIA ${conta.agencia} ${busatoData?.endereco_cidade || ""} - ${busatoData?.endereco_uf || ""}.CONTA ${conta.tipo_conta.toUpperCase()} Nº${conta.conta}`;
      const bankBoxH = 12;
      doc.rect(mLeft, y, contentW, bankBoxH);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(bankLine1, mLeft + contentW / 2, y + 4.5, { align: "center" });
      doc.text(bankLine2, mLeft + contentW / 2, y + 8.5, { align: "center" });
      y += bankBoxH;
    } else {
      doc.rect(mLeft, y, contentW, 6);
      y += 6;
    }

    // ── DESCRIPTION TABLE ──
    const descColWidths = [contentW * 0.42, contentW * 0.1, contentW * 0.18, contentW * 0.18, contentW * 0.12];
    const descHeaders = ["DESCRIÇÃO", "QUANT.", "VALOR UNIT", "TOTAL", "CFOP"];

    // Header row
    const thH = 6;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    let cx = mLeft;
    descHeaders.forEach((h, i) => {
      doc.rect(cx, y, descColWidths[i], thH);
      doc.text(h, cx + descColWidths[i] / 2, y + 4, { align: "center" });
      cx += descColWidths[i];
    });
    y += thH;

    // Data row
    const rowH = 8;
    const descBody = [
      "Locação de Equipamento, sem Cessão de Mão de Obra.",
      "1,00",
      `R$     ${fmt(Number(fatura.valor_total))}`,
      `R$     ${fmt(Number(fatura.valor_total))}`,
      "",
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    cx = mLeft;
    descBody.forEach((val, i) => {
      doc.rect(cx, y, descColWidths[i], rowH);
      if (i === 0) {
        doc.text(val, cx + 2, y + 5.5);
      } else {
        doc.text(val, cx + descColWidths[i] / 2, y + 5.5, { align: "center" });
      }
      cx += descColWidths[i];
    });
    y += rowH;

    // Empty rows area (visual space like the template)
    const emptyH = 45;
    cx = mLeft;
    descColWidths.forEach(w => {
      doc.rect(cx, y, w, emptyH);
      cx += w;
    });
    y += emptyH;

    // ── VALOR TOTAL DA FATURA ──
    const totalRowH = 8;
    // Left cells merged
    const totalLabelW = descColWidths[0] + descColWidths[1] + descColWidths[2];
    const totalValW = descColWidths[3] + descColWidths[4];
    doc.rect(mLeft, y, totalLabelW, totalRowH);
    doc.rect(mLeft + totalLabelW, y, totalValW, totalRowH);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("VALOR TOTAL DA FATURA", mLeft + totalLabelW - 2, y + 5.5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`R$          ${fmt(Number(fatura.valor_total))}`, mLeft + totalLabelW + totalValW / 2, y + 5.5, { align: "center" });
    y += totalRowH;

    // ── AUTORIZADO ──
    const autoH = 6;
    doc.rect(mLeft, y, contentW, autoH);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("AUTORIZADO CONFORME LEI COMPLEMENTAR 116/03", mLeft + contentW / 2, y + 4, { align: "center" });
    y += autoH;

    // ── INFORMAÇÕES COMPLEMENTARES ──
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Informações complementares:", mLeft + 1.5, y + 5);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const lineH = 5;

    if (equips.length > 0) {
      equips.forEach(fe => {
        const eq = getEquipamento(fe.equipamento_id);
        if (eq) {
          const qtStr = `01 ${eq.tipo} ${eq.modelo}${eq.tag_placa ? ` - ${eq.tag_placa}` : ""}`;
          doc.text(qtStr, mLeft + 1.5, y);
          y += lineH;
        }
      });
    } else {
      const eq = ct?.equipamentos;
      if (eq) {
        doc.text(`01 ${eq.tipo} ${eq.modelo}${eq.tag_placa ? ` - ${eq.tag_placa}` : ""}`, mLeft + 1.5, y);
        y += lineH;
      }
    }

    if (fatura.periodo_medicao_inicio && fatura.periodo_medicao_fim) {
      doc.text(
        `Período - ${parseLocalDate(fatura.periodo_medicao_inicio).toLocaleDateString("pt-BR")} a ${parseLocalDate(fatura.periodo_medicao_fim).toLocaleDateString("pt-BR")}`,
        mLeft + 1.5, y
      );
      y += lineH;
    }

    // Additional costs
    const allGastos = faturaGastos.get(fatura.id) || [];
    if (allGastos.length > 0) {
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.text("Custos Adicionais:", mLeft + 1.5, y);
      y += lineH;
      doc.setFont("helvetica", "normal");
      allGastos.forEach(g => {
        doc.text(`• ${g.tipo} — ${g.descricao}: R$ ${fmt(g.valor)}`, mLeft + 1.5, y);
        y += lineH;
      });
    }

    // Observações
    const obs = (fatura as any).observacoes;
    if (obs && obs.trim()) {
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.text("Observações:", mLeft + 1.5, y);
      y += lineH;
      doc.setFont("helvetica", "normal");
      const obsLines = doc.splitTextToSize(obs, contentW - 4);
      obsLines.forEach((line: string) => {
        doc.text(line, mLeft + 1.5, y);
        y += lineH;
      });
    }

    // ── SIGNATURE BLOCK (positioned dynamically below content) ──
    y = Math.max(y + 10, pageH - 15 - 45);

    // Signature area

    // Signature line
    const sigLineY = y + 25;
    doc.setLineWidth(0.3);
    doc.line(mLeft + contentW / 2 - 30, sigLineY, mLeft + contentW / 2 + 30, sigLineY);

    // Company name under signature
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Busato Locações e Serviços LTDA", mLeft + contentW / 2, sigLineY + 6, { align: "center" });

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

  const exportRelatorioFinanceiro = async () => {
    const logo = await loadLogo();
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();

    // Letterhead
    let y = 12;
    if (logo) doc.addImage(logo, "PNG", 14, y, 48, 12);
    doc.setFontSize(16);
    doc.setTextColor(60, 60, 60);
    doc.text("Relatório Financeiro", pageW - 14, y + 8, { align: "right" });
    y += 18;
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.7);
    doc.line(14, y, pageW - 14, y);
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, pageW - 14, y, { align: "right" });
    y += 6;

    const data = filteredFaturas;
    const headers = ["Nº Fatura", "Empresa", "CNPJ", "Período Medição", "Emissão", "Vencimento", "Valor Total (R$)", "Status"];
    const rows = data.map(f => {
      const ct = getContrato(f.contrato_id);
      const venc = getVencimento(f);
      const status = getDisplayStatus(f);
      return [
        f.numero_nota || "—",
        ct?.empresas?.nome || "",
        ct?.empresas?.cnpj || "",
        f.periodo_medicao_inicio && f.periodo_medicao_fim
          ? `${parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR")} - ${parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR")}`
          : "—",
        parseLocalDate(f.emissao).toLocaleDateString("pt-BR"),
        venc.toLocaleDateString("pt-BR"),
        Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        status,
      ];
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: y,
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 6: { halign: "right" } },
      didParseCell: (cellData: any) => {
        if (cellData.section === "body" && cellData.column.index === 7) {
          const s = cellData.cell.raw;
          if (s === "Em Atraso") { cellData.cell.styles.textColor = [192, 57, 43]; cellData.cell.styles.fontStyle = "bold"; }
          else if (s === "Pendente") { cellData.cell.styles.textColor = [243, 156, 18]; }
          else if (s === "Pago") { cellData.cell.styles.textColor = [39, 174, 96]; }
        }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    const total = data.reduce((s, f) => s + Number(f.valor_total), 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(41, 128, 185);
    doc.text(`Total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageW - 14, finalY, { align: "right" });

    doc.save(`relatorio_financeiro_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: "Relatório exportado", description: "O relatório financeiro foi gerado com sucesso." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
          <p className="text-sm text-muted-foreground">Faturas emitidas a partir de medições aprovadas</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportRelatorioFinanceiro}>
          <FileText className="h-4 w-4 mr-1" /> Relatório Financeiro
        </Button>
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
                <SortableTableHead column="numero" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Nº Fatura</SortableTableHead>
                <SortableTableHead column="empresa" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Empresa</SortableTableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead>Período</TableHead>
                <SortableTableHead column="emissao" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Emissão</SortableTableHead>
                <SortableTableHead column="vencimento" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Vencimento</SortableTableHead>
                <SortableTableHead column="valor" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Valor</SortableTableHead>
                
                <SortableTableHead column="status" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Status</SortableTableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFaturas.map(f => {
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
              {!loading && sortedFaturas.length === 0 && (
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
        <DialogContent className="sm:max-w-2xl">
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
