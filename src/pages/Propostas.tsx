import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, FileDown, Eye, Copy, X, CheckCircle, Mail, FileText, Clock, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { addLetterhead } from "@/lib/exportUtils";

interface Empresa {
  id: string; nome: string; cnpj: string; razao_social: string | null; nome_fantasia: string | null;
}

interface ContaBancaria {
  id: string; banco: string; agencia: string; conta: string; titular: string; cnpj_cpf: string | null; tipo_conta: string;
}

interface Equipamento {
  id: string; tipo: string; modelo: string; tag_placa: string | null; status: string;
}

interface PropostaEquip {
  equipamento_tipo: string; quantidade: number; valor_hora: number; franquia_mensal: number;
}

interface PropostaResp {
  atividade: string; responsavel_busato: boolean; responsavel_cliente: boolean;
}

interface Proposta {
  id: string;
  numero_sequencial: number;
  empresa_id: string;
  data: string;
  validade_dias: number;
  status: string;
  valor_mobilizacao: number;
  valor_mobilizacao_texto: string;
  prazo_pagamento: number;
  conta_bancaria_id: string | null;
  consultor_nome: string;
  consultor_email: string;
  consultor_telefone: string;
  consultor_nome_2: string;
  consultor_email_2: string;
  consultor_telefone_2: string;
  observacoes: string;
  franquia_horas_texto: string;
  horas_excedentes_texto: string;
  disponibilidade_texto: string;
  analise_cadastral_texto: string;
  seguro_texto: string;
  created_at: string;
  created_by: string | null;
  empresas?: Empresa;
}

const defaultResp: PropostaResp[] = [
  { atividade: "Mão de obra qualificada para operação", responsavel_busato: false, responsavel_cliente: true },
  { atividade: "Combustível para operação", responsavel_busato: false, responsavel_cliente: true },
  { atividade: "Peças de desgaste (lâminas, dentes, pneus, cerdas)", responsavel_busato: false, responsavel_cliente: true },
  { atividade: "Lubrificação diária", responsavel_busato: false, responsavel_cliente: true },
  { atividade: "Seguro do equipamento (furto e terceiros)", responsavel_busato: false, responsavel_cliente: true },
  { atividade: "Manutenções preventivas", responsavel_busato: true, responsavel_cliente: false },
  { atividade: "Manutenções corretivas por desgaste natural", responsavel_busato: true, responsavel_cliente: false },
  { atividade: "Manutenção corretiva por imperícia ou imprudência operacional", responsavel_busato: false, responsavel_cliente: true },
];

const emptyForm = {
  empresa_id: "",
  data: new Date().toISOString().slice(0, 10),
  validade_dias: 10,
  status: "Aguardando Aprovação",
  valor_mobilizacao: 0,
  valor_mobilizacao_texto: "",
  prazo_pagamento: 30,
  conta_bancaria_id: "",
  consultor_nome: "",
  consultor_email: "",
  consultor_telefone: "",
  consultor_nome_2: "",
  consultor_email_2: "",
  consultor_telefone_2: "",
  observacoes: "",
  franquia_horas_texto: "",
  horas_excedentes_texto: "Serão cobradas horas excedentes conforme valor unitário por hora.",
  disponibilidade_texto: "Equipamentos sujeitos à disponibilidade no momento da contratação.",
  analise_cadastral_texto: "Sujeito a verificação cadastral conforme normas vigentes.",
  seguro_texto: "O seguro do equipamento é responsabilidade do cliente.",
};

const parseLocalDate = (d: string) => new Date(d + "T00:00:00");

const Propostas = () => {
  const [items, setItems] = useState<Proposta[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [equipamentosCadastro, setEquipamentosCadastro] = useState<Equipamento[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Proposta | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [equipamentos, setEquipamentos] = useState<PropostaEquip[]>([]);
  const [responsabilidades, setResponsabilidades] = useState<PropostaResp[]>(defaultResp);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { role, user } = useAuth();

  const fetchData = async () => {
    const [propRes, empRes, contasRes, eqCadRes] = await Promise.all([
      supabase.from("propostas").select("*").order("numero_sequencial", { ascending: false }),
      supabase.from("empresas").select("id, nome, cnpj, razao_social, nome_fantasia").eq("status", "Ativa").order("nome"),
      supabase.from("contas_bancarias").select("*").order("banco"),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, status").eq("status", "Ativo").order("tipo"),
    ]);
    if (propRes.data) setItems(propRes.data as unknown as Proposta[]);
    if (empRes.data) setEmpresas(empRes.data as Empresa[]);
    if (contasRes.data) setContas(contasRes.data as ContaBancaria[]);
    if (eqCadRes.data) setEquipamentosCadastro(eqCadRes.data as Equipamento[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter(i => {
    const empresa = empresas.find(e => e.id === i.empresa_id);
    return (
      (empresa?.nome || "").toLowerCase().includes(search.toLowerCase()) ||
      String(i.numero_sequencial).includes(search) ||
      i.status.toLowerCase().includes(search.toLowerCase())
    );
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setEquipamentos([{ equipamento_tipo: "", quantidade: 1, valor_hora: 0, franquia_mensal: 0 }]);
    setResponsabilidades([...defaultResp]);
    setDialogOpen(true);
  };

  const openEdit = async (item: Proposta) => {
    // Reset state first to prevent showing stale data
    setEquipamentos([]);
    setResponsabilidades([]);
    setEditing(item);
    setForm({
      empresa_id: item.empresa_id,
      data: item.data,
      validade_dias: item.validade_dias,
      status: item.status,
      valor_mobilizacao: Number(item.valor_mobilizacao),
      valor_mobilizacao_texto: item.valor_mobilizacao_texto || "",
      prazo_pagamento: item.prazo_pagamento,
      conta_bancaria_id: item.conta_bancaria_id || "",
      consultor_nome: item.consultor_nome || "",
      consultor_email: item.consultor_email || "",
      consultor_telefone: item.consultor_telefone || "",
      consultor_nome_2: item.consultor_nome_2 || "",
      consultor_email_2: item.consultor_email_2 || "",
      consultor_telefone_2: item.consultor_telefone_2 || "",
      observacoes: item.observacoes || "",
      franquia_horas_texto: item.franquia_horas_texto || "",
      horas_excedentes_texto: item.horas_excedentes_texto || "",
      disponibilidade_texto: item.disponibilidade_texto || "",
      analise_cadastral_texto: item.analise_cadastral_texto || "",
      seguro_texto: item.seguro_texto || "",
    });

    // Load related data from database
    const [eqRes, respRes] = await Promise.all([
      supabase.from("propostas_equipamentos").select("*").eq("proposta_id", item.id),
      supabase.from("propostas_responsabilidades").select("*").eq("proposta_id", item.id),
    ]);

    const loadedEqs = (eqRes.data || []).map(e => ({
      equipamento_tipo: e.equipamento_tipo,
      quantidade: e.quantidade,
      valor_hora: Number(e.valor_hora),
      franquia_mensal: Number(e.franquia_mensal),
    }));
    setEquipamentos(loadedEqs.length > 0 ? loadedEqs : [{ equipamento_tipo: "", quantidade: 1, valor_hora: 0, franquia_mensal: 0 }]);

    const loadedResps = (respRes.data || []).map(r => ({
      atividade: r.atividade,
      responsavel_busato: r.responsavel_busato,
      responsavel_cliente: r.responsavel_cliente,
    }));
    setResponsabilidades(loadedResps.length > 0 ? loadedResps : [...defaultResp]);

    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.empresa_id || equipamentos.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Selecione uma empresa e adicione equipamentos.", variant: "destructive" });
      return;
    }

    // Determine status based on role
    let statusToSave = form.status;
    const isNew = !editing;
    if (role === "operador") {
      statusToSave = "Aguardando Aprovação";
    }

    const payload: any = {
      empresa_id: form.empresa_id,
      data: form.data,
      validade_dias: form.validade_dias,
      status: statusToSave,
      valor_mobilizacao: form.valor_mobilizacao,
      valor_mobilizacao_texto: form.valor_mobilizacao_texto,
      prazo_pagamento: form.prazo_pagamento,
      conta_bancaria_id: form.conta_bancaria_id || null,
      consultor_nome: form.consultor_nome,
      consultor_email: form.consultor_email,
      consultor_telefone: form.consultor_telefone,
      consultor_nome_2: form.consultor_nome_2,
      consultor_email_2: form.consultor_email_2,
      consultor_telefone_2: form.consultor_telefone_2,
      observacoes: form.observacoes,
      franquia_horas_texto: form.franquia_horas_texto,
      horas_excedentes_texto: form.horas_excedentes_texto,
      disponibilidade_texto: form.disponibilidade_texto,
      analise_cadastral_texto: form.analise_cadastral_texto,
      seguro_texto: form.seguro_texto,
    };

    if (isNew && user) {
      payload.created_by = user.id;
    }

    let propostaId: string;
    let numSeq: number | undefined;
    if (editing) {
      const { error } = await supabase.from("propostas").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      propostaId = editing.id;
      numSeq = editing.numero_sequencial;
    } else {
      const { data, error } = await supabase.from("propostas").insert(payload).select("id, numero_sequencial").single();
      if (error || !data) { toast({ title: "Erro", description: error?.message || "Erro", variant: "destructive" }); return; }
      propostaId = data.id;
      numSeq = data.numero_sequencial;
    }

    // Save equipamentos
    await supabase.from("propostas_equipamentos").delete().eq("proposta_id", propostaId);
    if (equipamentos.length > 0) {
      await supabase.from("propostas_equipamentos").insert(
        equipamentos.map(e => ({ proposta_id: propostaId, equipamento_tipo: e.equipamento_tipo, quantidade: e.quantidade, valor_hora: e.valor_hora, franquia_mensal: e.franquia_mensal }))
      );
    }

    // Save responsabilidades
    await supabase.from("propostas_responsabilidades").delete().eq("proposta_id", propostaId);
    if (responsabilidades.length > 0) {
      await supabase.from("propostas_responsabilidades").insert(
        responsabilidades.map(r => ({ proposta_id: propostaId, atividade: r.atividade, responsavel_busato: r.responsavel_busato, responsavel_cliente: r.responsavel_cliente }))
      );
    }

    // Notify admins if operator created a proposal
    if (isNew && role === "operador") {
      const emp = empresas.find(e => e.id === form.empresa_id);
      const numStr = String(numSeq).padStart(3, "0");
      // Get all admin user_ids via security definer function
      const { data: adminIds } = await supabase.rpc("get_admin_user_ids");
      const adminRoles = adminIds ? adminIds.map((id: string) => ({ user_id: id })) : [];
      if (adminRoles && adminRoles.length > 0) {
        await supabase.from("notificacoes").insert(
          adminRoles.map(ar => ({
            user_id: ar.user_id,
            tipo: "aprovacao",
            titulo: `Proposta Nº ${numStr} aguardando aprovação`,
            mensagem: `O operador criou a proposta ${numStr} para ${emp?.nome || "empresa"}. Acesse Propostas para aprovar.`,
            referencia_tipo: "proposta",
            referencia_id: propostaId,
          }))
        );
      }
    }

    setDialogOpen(false);
    toast({ title: "Sucesso", description: editing ? "Proposta atualizada." : (role === "operador" ? "Proposta criada e enviada para aprovação." : "Proposta criada.") });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("propostas").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Excluída" });
    fetchData();
  };

  const handleDuplicate = async (item: Proposta) => {
    const { data: eqs } = await supabase.from("propostas_equipamentos").select("*").eq("proposta_id", item.id);
    const { data: resps } = await supabase.from("propostas_responsabilidades").select("*").eq("proposta_id", item.id);

    const payload: any = {
      empresa_id: item.empresa_id,
      data: new Date().toISOString().slice(0, 10),
      validade_dias: item.validade_dias,
      status: "Aguardando Aprovação",
      valor_mobilizacao: item.valor_mobilizacao,
      valor_mobilizacao_texto: item.valor_mobilizacao_texto,
      prazo_pagamento: item.prazo_pagamento,
      conta_bancaria_id: item.conta_bancaria_id,
      consultor_nome: item.consultor_nome,
      consultor_email: item.consultor_email,
      consultor_telefone: item.consultor_telefone,
      consultor_nome_2: item.consultor_nome_2,
      consultor_email_2: item.consultor_email_2,
      consultor_telefone_2: item.consultor_telefone_2,
      observacoes: item.observacoes,
      franquia_horas_texto: item.franquia_horas_texto,
      horas_excedentes_texto: item.horas_excedentes_texto,
      disponibilidade_texto: item.disponibilidade_texto,
      analise_cadastral_texto: item.analise_cadastral_texto,
      seguro_texto: item.seguro_texto,
    };

    const { data: newProp, error } = await supabase.from("propostas").insert(payload).select("id").single();
    if (error || !newProp) { toast({ title: "Erro", description: error?.message, variant: "destructive" }); return; }

    if (eqs && eqs.length > 0) {
      await supabase.from("propostas_equipamentos").insert(eqs.map(e => ({ proposta_id: newProp.id, equipamento_tipo: e.equipamento_tipo, quantidade: e.quantidade, valor_hora: e.valor_hora, franquia_mensal: e.franquia_mensal })));
    }
    if (resps && resps.length > 0) {
      await supabase.from("propostas_responsabilidades").insert(resps.map(r => ({ proposta_id: newProp.id, atividade: r.atividade, responsavel_busato: r.responsavel_busato, responsavel_cliente: r.responsavel_cliente })));
    }

    toast({ title: "Proposta duplicada" });
    fetchData();
  };

  const generatePDF = async (item: Proposta) => {
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

    const logo = await loadLogoForPdf();

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
    // Clean formal header: logo left, number right, thin line below
    if (logo) doc.addImage(logo, "PNG", margin, 14, 56, 14);

    doc.setFontSize(11);
    doc.setTextColor(...darkGray);
    doc.setFont("helvetica", "bold");
    doc.text(`Nº ${String(item.numero_sequencial).padStart(3, "0")}`, pw - margin, 22, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...medGray);
    doc.text(parseLocalDate(item.data).toLocaleDateString("pt-BR"), pw - margin, 28, { align: "right" });

    // Separator line
    doc.setDrawColor(...brandBlue);
    doc.setLineWidth(0.8);
    doc.line(margin, 36, pw - margin, 36);

    // Main title
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

    // Thin accent line
    doc.setDrawColor(...brandBlue);
    doc.setLineWidth(1.2);
    doc.line(margin, y, margin + 50, y);
    y += 14;

    // Validity
    doc.setFontSize(9);
    doc.setTextColor(...lightGray);
    doc.setFont("helvetica", "normal");
    doc.text(`Proposta válida por ${item.validade_dias} dias a partir da data de emissão.`, margin, y);
    y += 16;

    // Section helper
    const sectionTitle = (label: string, yPos: number) => {
      doc.setFillColor(240, 245, 250);
      doc.roundedRect(margin, yPos - 5, contentW, 8, 1, 1, "F");
      doc.setFontSize(10);
      doc.setTextColor(...brandBlue);
      doc.setFont("helvetica", "bold");
      doc.text(label, margin + 4, yPos);
      return yPos + 10;
    };

    // Info card helper
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

    // LOCADORA
    y = sectionTitle("EMPRESA LOCADORA", y);
    y = infoLine("Razão Social:", "BUSATO LOCAÇÕES E SERVIÇOS LTDA", y);
    y = infoLine("CNPJ:", "54.167.719/0001-40", y);
    y += 6;

    // CLIENTE
    y = sectionTitle("CLIENTE", y);
    y = infoLine("Razão Social:", emp?.razao_social || emp?.nome || "—", y);
    y = infoLine("CNPJ:", emp?.cnpj || "—", y);
    y += 6;

    // CONSULTOR
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

    // 1. OBJETO
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

    // 2. PRAZO
    y = sectionTitle("2. PRAZO", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...medGray);
    const prazoLines = doc.splitTextToSize("A locação será contratada por período mensal, podendo ser prorrogada mediante solicitação e acordo das partes.", contentW - 8);
    doc.text(prazoLines, margin + 4, y);
    y += prazoLines.length * 4.5 + 6;

    // 3. PREÇO E CONDIÇÕES
    y = sectionTitle("3. PREÇO E CONDIÇÕES", y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Qtd.", "Equipamento", "Valor/Hora", "Franquia (h)", "Total Mensal"]],
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
    y = (doc as any).lastAutoTable.finalY + 8;

    // Bottom margin – content must not go below this Y to avoid overlapping the footer
    const bottomLimit = ph - 25;

    // Helper: check page break before rendering content of a given height
    const checkPageBreak = (yPos: number, neededHeight: number): number => {
      if (yPos + neededHeight > bottomLimit) {
        doc.addPage();
        addInnerHeader();
        return 30;
      }
      return yPos;
    };

    // Sub-items
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
      y = subItem("3.1.", "Mobilização / Desmobilização", item.valor_mobilizacao_texto || fmt(Number(item.valor_mobilizacao)) + " para transporte do equipamento.", y);
    }
    if (item.franquia_horas_texto) {
      y = subItem("3.2.", "Franquia de Horas", item.franquia_horas_texto, y);
    }
    if (item.horas_excedentes_texto) {
      y = subItem("3.3.", "Horas Excedentes", item.horas_excedentes_texto, y);
    }
    if (item.disponibilidade_texto) {
      y = subItem("3.4.", "Disponibilidade", item.disponibilidade_texto, y);
    }
    if (item.analise_cadastral_texto) {
      y = subItem("3.5.", "Análise Cadastral", item.analise_cadastral_texto, y);
    }
    if (item.seguro_texto) {
      y = subItem("3.6.", "Seguro", item.seguro_texto, y);
    }

    // Check if we need a new page for payment section
    if (y > bottomLimit - 60) {
      doc.addPage();
      addInnerHeader();
      y = 30;
    }

    // 4. PAGAMENTO
    y = sectionTitle("4. PAGAMENTO", y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...medGray);
    const pagLines = doc.splitTextToSize(`Os pagamentos deverão ser realizados no prazo de até ${item.prazo_pagamento} (${item.prazo_pagamento === 30 ? "trinta" : String(item.prazo_pagamento)}) dias após a emissão da nota fiscal, condicionado à aprovação da medição.`, contentW - 8);
    doc.text(pagLines, margin + 4, y);
    y += pagLines.length * 4.5 + 8;

    // Bank details card
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
      y = infoLine("Favorecido:", conta.titular, y);
      if (conta.cnpj_cpf) y = infoLine("CNPJ:", conta.cnpj_cpf, y);
      y = infoLine("Banco:", conta.banco, y);
      y = infoLine("Agência:", conta.agencia, y);
      y = infoLine(`${conta.tipo_conta}:`, conta.conta, y);
    }

    // ===================== PAGE 3 — RESPONSIBILITIES =====================
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

    // Add footers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i, totalPages);
    }

    const numStr = String(item.numero_sequencial).padStart(3, "0");
    const empName = (emp?.nome || "proposta").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
    doc.save(`${numStr}_PROPOSTA_COMERCIAL_DE_LOCAÇÃO_-_${empName}.pdf`);
    
  };

  const handleSendEmail = async (item: Proposta) => {
    const emp = empresas.find(e => e.id === item.empresa_id);
    const numStr = String(item.numero_sequencial).padStart(3, "0");
    const subject = encodeURIComponent(`Proposta Comercial Nº ${numStr} - BUSATO LOCAÇÕES`);
    const body = encodeURIComponent(
      `Prezado(a),\n\nSegue em anexo a Proposta Comercial Nº ${numStr} para ${emp?.nome || "sua empresa"}.\n\nFicamos à disposição para esclarecimentos.\n\nAtenciosamente,\nBUSATO LOCAÇÕES E SERVIÇOS LTDA`
    );
    // Generate PDF first
    await generatePDF(item);
    // Open mailto
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
    toast({ title: "PDF gerado", description: "Anexe o PDF baixado ao e-mail que será aberto." });
  };

  const handleApprove = async (item: Proposta) => {
    const { error } = await supabase.from("propostas").update({ status: "Proposta Aprovada" }).eq("id", item.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }

    // Notify the creator that the proposal was approved
    if (item.created_by) {
      const numStr = String(item.numero_sequencial).padStart(3, "0");
      const emp = empresas.find(e => e.id === item.empresa_id);
      await supabase.from("notificacoes").insert({
        user_id: item.created_by,
        tipo: "aprovacao",
        titulo: `Proposta Nº ${numStr} aprovada!`,
        mensagem: `A proposta ${numStr} para ${emp?.nome || "empresa"} foi aprovada pelo administrador e já pode ser enviada ao cliente.`,
        referencia_tipo: "proposta",
        referencia_id: item.id,
      });
    }

    toast({ title: "Proposta aprovada", description: "O operador foi notificado." });
    fetchData();
  };

  const statusColor = (s: string) => {
    if (s === "Proposta Aprovada") return "bg-success text-success-foreground";
    if (s === "Aguardando Aprovação") return "bg-warning text-warning-foreground";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Propostas Comerciais</h1>
            <p className="text-sm text-muted-foreground">{items.length} propostas cadastradas</p>
          </div>
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Proposta
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar propostas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Cards Gerenciais */}
        {(() => {
          const total = items.length;
          const aguardando = items.filter(i => i.status === "Aguardando Aprovação").length;
          const aprovadas = items.filter(i => i.status === "Proposta Aprovada").length;
          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Propostas</p>
                    <p className="text-2xl font-bold text-foreground">{total}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-warning/10 p-3">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Aguardando Aprovação</p>
                    <p className="text-2xl font-bold text-foreground">{aguardando}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-success/10 p-3">
                    <CheckSquare className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Propostas Aprovadas</p>
                    <p className="text-2xl font-bold text-foreground">{aprovadas}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Equipamentos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => {
                  const empresa = empresas.find(e => e.id === item.empresa_id);
                  return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-bold">{String(item.numero_sequencial).padStart(3, "0")}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{empresa?.nome || "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{empresa?.cnpj || "—"}</p>
                    </TableCell>
                    <TableCell className="text-sm">{parseLocalDate(item.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    <TableCell><Badge className={statusColor(item.status)}>{item.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {role === "admin" && item.status === "Aguardando Aprovação" && (
                          <Button variant="ghost" size="icon" onClick={() => handleApprove(item)} title="Aprovar proposta" className="text-success hover:text-success">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {item.status === "Proposta Aprovada" && (
                          <Button variant="ghost" size="icon" onClick={() => handleSendEmail(item)} title="Enviar por e-mail" className="text-primary hover:text-primary">
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => generatePDF(item)} title="Gerar PDF">
                          <FileDown className="h-4 w-4 text-accent" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(item)} title="Duplicar">
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir proposta?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma proposta encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Proposta" : "Nova Proposta Comercial"}</DialogTitle>
            <DialogDescription>Preencha os dados da proposta</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Dados gerais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label>Empresa *</Label>
                <SearchableSelect
                  options={empresas.map(e => ({ value: e.id, label: `${e.nome} (${e.cnpj})` }))}
                  value={form.empresa_id}
                  onValueChange={v => setForm(f => ({ ...f, empresa_id: v }))}
                  placeholder="Selecione a empresa"
                />
              </div>
              {role === "admin" ? (
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aguardando Aprovação">Aguardando Aprovação</SelectItem>
                    <SelectItem value="Proposta Aprovada">Proposta Aprovada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              ) : (
              <div>
                <Label>Status</Label>
                <Input value="Aguardando Aprovação" disabled className="bg-muted" />
              </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div>
                <Label>Validade (dias)</Label>
                <Input type="number" value={form.validade_dias} onChange={e => setForm(f => ({ ...f, validade_dias: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Prazo Pagamento (dias)</Label>
                <Input type="number" value={form.prazo_pagamento} onChange={e => setForm(f => ({ ...f, prazo_pagamento: Number(e.target.value) }))} />
              </div>
            </div>

            {/* Consultor */}
            <div>
              <h3 className="font-semibold text-sm mb-2">Dados do Consultor</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Nome</Label><Input value={form.consultor_nome} onChange={e => setForm(f => ({ ...f, consultor_nome: e.target.value }))} /></div>
                <div><Label>Email</Label><Input value={form.consultor_email} onChange={e => setForm(f => ({ ...f, consultor_email: e.target.value }))} /></div>
                <div><Label>Telefone</Label><Input value={form.consultor_telefone} onChange={e => setForm(f => ({ ...f, consultor_telefone: e.target.value }))} /></div>
              </div>
            </div>

            {/* Equipamentos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Equipamentos</h3>
                <Button variant="outline" size="sm" onClick={() => setEquipamentos(prev => [...prev, { equipamento_tipo: "", quantidade: 1, valor_hora: 0, franquia_mensal: 0 }])}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              {equipamentos.map((eq, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_100px_40px] gap-2 mb-2 items-end">
                  <div>
                    {idx === 0 && <Label className="text-xs">Equipamento</Label>}
                    <SearchableSelect
                      options={(() => {
                        const seen = new Set<string>();
                        return equipamentosCadastro
                          .map(e => ({ value: e.tipo, label: e.tipo }))
                          .filter(o => {
                            if (seen.has(o.value)) return false;
                            seen.add(o.value);
                            return true;
                          });
                      })()}
                      value={eq.equipamento_tipo}
                      onValueChange={v => { const n = [...equipamentos]; n[idx].equipamento_tipo = v; setEquipamentos(n); }}
                      placeholder="Selecione o equipamento"
                      searchPlaceholder="Buscar equipamento..."
                      emptyMessage="Nenhum equipamento encontrado"
                    />
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs">Qtd.</Label>}
                    <Input type="number" value={eq.quantidade} onChange={e => { const n = [...equipamentos]; n[idx].quantidade = Number(e.target.value); setEquipamentos(n); }} />
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs">Valor/Hora</Label>}
                    <Input type="number" step="0.01" value={eq.valor_hora} onChange={e => { const n = [...equipamentos]; n[idx].valor_hora = Number(e.target.value); setEquipamentos(n); }} />
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs">Franquia (h)</Label>}
                    <Input type="number" value={eq.franquia_mensal} onChange={e => { const n = [...equipamentos]; n[idx].franquia_mensal = Number(e.target.value); setEquipamentos(n); }} />
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEquipamentos(prev => prev.filter((_, i) => i !== idx))}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Mobilização e condições */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Valor Mobilização (R$)</Label>
                <Input type="number" step="0.01" value={form.valor_mobilizacao} onChange={e => setForm(f => ({ ...f, valor_mobilizacao: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Texto Mobilização</Label>
                <Input value={form.valor_mobilizacao_texto} onChange={e => setForm(f => ({ ...f, valor_mobilizacao_texto: e.target.value }))} placeholder="Ex: R$1000,00 (mil reais) transporte do equipamento." />
              </div>
            </div>

            <div className="space-y-3">
              <div><Label>Franquia de Horas (texto)</Label><Textarea value={form.franquia_horas_texto} onChange={e => setForm(f => ({ ...f, franquia_horas_texto: e.target.value }))} rows={2} /></div>
              <div><Label>Horas Excedentes (texto)</Label><Textarea value={form.horas_excedentes_texto} onChange={e => setForm(f => ({ ...f, horas_excedentes_texto: e.target.value }))} rows={2} /></div>
              <div><Label>Disponibilidade (texto)</Label><Textarea value={form.disponibilidade_texto} onChange={e => setForm(f => ({ ...f, disponibilidade_texto: e.target.value }))} rows={2} /></div>
              <div><Label>Análise Cadastral (texto)</Label><Textarea value={form.analise_cadastral_texto} onChange={e => setForm(f => ({ ...f, analise_cadastral_texto: e.target.value }))} rows={2} /></div>
              <div><Label>Seguro (texto)</Label><Textarea value={form.seguro_texto} onChange={e => setForm(f => ({ ...f, seguro_texto: e.target.value }))} rows={2} /></div>
            </div>

            {/* Conta Bancária */}
            <div>
              <Label>Conta Bancária</Label>
              <Select value={form.conta_bancaria_id} onValueChange={v => setForm(f => ({ ...f, conta_bancaria_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.banco} - Ag: {c.agencia} / {c.conta} ({c.titular})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Responsabilidades */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Responsabilidades</h3>
                <Button variant="outline" size="sm" onClick={() => setResponsabilidades(prev => [...prev, { atividade: "", responsavel_busato: false, responsavel_cliente: false }])}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              {responsabilidades.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_80px_40px] gap-2 mb-2 items-center">
                  <Input value={r.atividade} onChange={e => { const n = [...responsabilidades]; n[idx].atividade = e.target.value; setResponsabilidades(n); }} placeholder="Atividade" />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={r.responsavel_busato} onChange={e => { const n = [...responsabilidades]; n[idx].responsavel_busato = e.target.checked; setResponsabilidades(n); }} />
                    Busato
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={r.responsavel_cliente} onChange={e => { const n = [...responsabilidades]; n[idx].responsavel_cliente = e.target.checked; setResponsabilidades(n); }} />
                    Cliente
                  </label>
                  <Button variant="ghost" size="icon" onClick={() => setResponsabilidades(prev => prev.filter((_, i) => i !== idx))}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground">{editing ? "Salvar" : "Criar Proposta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

// Logo loader for PDF
let pdfLogoCache: string | null = null;
async function loadLogoForPdf(): Promise<string | null> {
  if (pdfLogoCache) return pdfLogoCache;
  try {
    const resp = await fetch("/images/logo-busato-horizontal.png");
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => { pdfLogoCache = reader.result as string; resolve(pdfLogoCache); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export default Propostas;
