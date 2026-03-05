import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, FileDown, Eye, Copy, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  status: "Rascunho",
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

  const fetchData = async () => {
    const [propRes, empRes, contasRes, eqCadRes] = await Promise.all([
      supabase.from("propostas").select("*, empresas:empresa_id(id, nome, cnpj, razao_social, nome_fantasia)").order("numero_sequencial", { ascending: false }),
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

  const filtered = items.filter(i =>
    (i.empresas?.nome || "").toLowerCase().includes(search.toLowerCase()) ||
    String(i.numero_sequencial).includes(search) ||
    i.status.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setEquipamentos([{ equipamento_tipo: "", quantidade: 1, valor_hora: 0, franquia_mensal: 0 }]);
    setResponsabilidades([...defaultResp]);
    setDialogOpen(true);
  };

  const openEdit = async (item: Proposta) => {
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
    // Load equipamentos
    const { data: eqs } = await supabase.from("propostas_equipamentos").select("*").eq("proposta_id", item.id);
    setEquipamentos((eqs || []).map(e => ({ equipamento_tipo: e.equipamento_tipo, quantidade: e.quantidade, valor_hora: Number(e.valor_hora), franquia_mensal: Number(e.franquia_mensal) })));
    // Load responsabilidades
    const { data: resps } = await supabase.from("propostas_responsabilidades").select("*").eq("proposta_id", item.id);
    if (resps && resps.length > 0) {
      setResponsabilidades(resps.map(r => ({ atividade: r.atividade, responsavel_busato: r.responsavel_busato, responsavel_cliente: r.responsavel_cliente })));
    } else {
      setResponsabilidades([...defaultResp]);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.empresa_id || equipamentos.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Selecione uma empresa e adicione equipamentos.", variant: "destructive" });
      return;
    }

    const payload: any = {
      empresa_id: form.empresa_id,
      data: form.data,
      validade_dias: form.validade_dias,
      status: form.status,
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

    let propostaId: string;
    if (editing) {
      const { error } = await supabase.from("propostas").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      propostaId = editing.id;
    } else {
      const { data, error } = await supabase.from("propostas").insert(payload).select("id").single();
      if (error || !data) { toast({ title: "Erro", description: error?.message || "Erro", variant: "destructive" }); return; }
      propostaId = data.id;
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

    setDialogOpen(false);
    toast({ title: "Sucesso", description: editing ? "Proposta atualizada." : "Proposta criada." });
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
      status: "Rascunho",
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
    const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

    // Helper to add logo header on each page
    const addPageHeader = async () => {
      const logo = await loadLogoForPdf();
      if (logo) doc.addImage(logo, "PNG", pw - 60, 8, 48, 16);
    };

    await addPageHeader();

    let y = 35;
    // Title
    doc.setFontSize(18);
    doc.setTextColor(50, 50, 50);
    doc.text("PROPOSTA COMERCIAL DE LOCAÇÃO", pw / 2, y, { align: "center" });
    y += 12;

    // Number, date, validity
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "bold");
    doc.text(`Nº:`, 14, y); doc.setFont("helvetica", "normal"); doc.text(` ${String(item.numero_sequencial).padStart(3, "0")}`, 24, y); y += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`Data:`, 14, y); doc.setFont("helvetica", "normal"); doc.text(` ${parseLocalDate(item.data).toLocaleDateString("pt-BR")}`, 28, y); y += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`Validade:`, 14, y); doc.setFont("helvetica", "normal"); doc.text(` ${item.validade_dias} dias`, 38, y); y += 10;

    // Intro text
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Prezado(a) Cliente,", 14, y); y += 5;
    const introLines = doc.splitTextToSize("Segue abaixo a nossa proposta comercial para locação do equipamento solicitado. Caso tenha dúvidas ou precise de mais informações, estamos à disposição para atendê-lo(a).", pw - 28);
    doc.text(introLines, 14, y); y += introLines.length * 5 + 8;

    // DADOS DA EMPRESA LOCADORA
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DA EMPRESA LOCADORA", 14, y); y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold"); doc.text("Razão Social: ", 14, y); doc.setFont("helvetica", "normal"); doc.text("BUSATO LOCAÇÕES E SERVIÇOS LTDA", 14 + doc.getTextWidth("Razão Social: "), y); y += 5;
    doc.setFont("helvetica", "bold"); doc.text("CNPJ: ", 14, y); doc.setFont("helvetica", "normal"); doc.text("54.167.719/0001-40", 14 + doc.getTextWidth("CNPJ: "), y); y += 10;

    // DADOS DO CLIENTE
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO CLIENTE", 14, y); y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold"); doc.text("Razão Social: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(emp?.razao_social || emp?.nome || "—", 14 + doc.getTextWidth("Razão Social: "), y); y += 5;
    doc.setFont("helvetica", "bold"); doc.text("CNPJ: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(emp?.cnpj || "—", 14 + doc.getTextWidth("CNPJ: "), y); y += 10;

    // DADOS DO CONSULTOR
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO CONSULTOR", 14, y); y += 6;
    doc.setFontSize(10);
    if (item.consultor_nome) {
      doc.setFont("helvetica", "bold"); doc.text("Nome: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(item.consultor_nome, 14 + doc.getTextWidth("Nome: "), y); y += 5;
      if (item.consultor_email) { doc.setFont("helvetica", "bold"); doc.text("Email: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(item.consultor_email, 14 + doc.getTextWidth("Email: "), y); y += 5; }
      if (item.consultor_telefone) { doc.setFont("helvetica", "bold"); doc.text("Telefone: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(item.consultor_telefone, 14 + doc.getTextWidth("Telefone: "), y); y += 8; }
    }
    if (item.consultor_nome_2) {
      doc.setFont("helvetica", "bold"); doc.text("Nome: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(item.consultor_nome_2, 14 + doc.getTextWidth("Nome: "), y); y += 5;
      if (item.consultor_email_2) { doc.setFont("helvetica", "bold"); doc.text("E-mail: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(item.consultor_email_2, 14 + doc.getTextWidth("E-mail: "), y); y += 5; }
      if (item.consultor_telefone_2) { doc.setFont("helvetica", "bold"); doc.text("Telefone: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(item.consultor_telefone_2, 14 + doc.getTextWidth("Telefone: "), y); y += 5; }
    }

    // --- PAGE 2 ---
    doc.addPage();
    await addPageHeader();
    y = 30;

    // 1. OBJETO
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("1. OBJETO", 14, y); y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("O objeto do presente é a proposta comercial dos seguintes equipamentos:", 14, y); y += 6;
    (eqs || []).forEach(eq => {
      doc.text(`•  ${eq.equipamento_tipo}`, 20, y); y += 5;
    });
    y += 4;

    // 2. PRAZO
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("2. PRAZO", 14, y); y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const prazoLines = doc.splitTextToSize("A locação será contratada por período mensal, podendo ser prorrogada mediante solicitação e acordo das partes.", pw - 28);
    doc.text(prazoLines, 14, y); y += prazoLines.length * 5 + 6;

    // 3. PREÇO E CONDIÇÕES
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("3. PREÇO E CONDIÇÕES", 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Qtd.", "Tipo de Equipamento", "Valor/Hora (R$)", "Franquia Mensal (Horas)", "Valor Unitário (R$)"]],
      body: (eqs || []).map(eq => [
        String(eq.quantidade).padStart(2, "0"),
        eq.equipamento_tipo,
        fmt(Number(eq.valor_hora)),
        `${eq.franquia_mensal} horas`,
        fmt(Number(eq.valor_hora) * Number(eq.franquia_mensal)),
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [200, 200, 200], textColor: [40, 40, 40], fontStyle: "bold" },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // 3.1 Mobilização
    if (item.valor_mobilizacao > 0 || item.valor_mobilizacao_texto) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("3.1. Mobilização / Desmobilização: ", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(item.valor_mobilizacao_texto || fmt(Number(item.valor_mobilizacao)) + " transporte do equipamento.", 14 + doc.getTextWidth("3.1. Mobilização / Desmobilização: "), y);
      y += 6;
    }

    // 3.2 Franquia
    if (item.franquia_horas_texto) {
      doc.setFont("helvetica", "bold"); doc.text("3.2 Franquia de Horas: ", 14, y);
      doc.setFont("helvetica", "normal");
      const fLines = doc.splitTextToSize(item.franquia_horas_texto, pw - 28 - doc.getTextWidth("3.2 Franquia de Horas: "));
      doc.text(fLines, 14 + doc.getTextWidth("3.2 Franquia de Horas: "), y);
      y += fLines.length * 5 + 2;
    }

    // 3.3 Horas Excedentes
    if (item.horas_excedentes_texto) {
      doc.setFont("helvetica", "bold"); doc.text("3.3. Horas Excedentes: ", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(item.horas_excedentes_texto, 14 + doc.getTextWidth("3.3. Horas Excedentes: "), y);
      y += 6;
    }

    // 3.4 Disponibilidade
    if (item.disponibilidade_texto) {
      doc.setFont("helvetica", "bold"); doc.text("3.4. Disponibilidade: ", 14, y);
      doc.setFont("helvetica", "normal");
      const dLines = doc.splitTextToSize(item.disponibilidade_texto, pw - 28 - doc.getTextWidth("3.4. Disponibilidade: "));
      doc.text(dLines, 14 + doc.getTextWidth("3.4. Disponibilidade: "), y);
      y += dLines.length * 5 + 2;
    }

    // 3.5 Análise
    if (item.analise_cadastral_texto) {
      doc.setFont("helvetica", "bold"); doc.text("3.5. Análise Cadastral: ", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(item.analise_cadastral_texto, 14 + doc.getTextWidth("3.5. Análise Cadastral: "), y);
      y += 6;
    }

    // 3.6 Seguro
    if (item.seguro_texto) {
      doc.setFont("helvetica", "bold"); doc.text("3.6. Seguro: ", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(item.seguro_texto, 14 + doc.getTextWidth("3.6. Seguro: "), y);
      y += 10;
    }

    // 4. PAGAMENTO
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("4. PAGAMENTO", 14, y); y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const pagLines = doc.splitTextToSize(`Os pagamentos deverão ser realizados no prazo de até ${item.prazo_pagamento} (${item.prazo_pagamento === 30 ? "trinta" : String(item.prazo_pagamento)}) dias após a emissão da nota fiscal, condicionado à aprovação da medição.`, pw - 28);
    doc.text(pagLines, 14, y);
    y += pagLines.length * 5 + 6;

    // Dados bancários
    if (conta) {
      doc.setFont("helvetica", "bold");
      doc.text("Dados Bancários para Depósito:", 14, y); y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold"); doc.text("Favorecido: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(conta.titular, 14 + doc.getTextWidth("Favorecido: "), y); y += 5;
      if (conta.cnpj_cpf) { doc.setFont("helvetica", "bold"); doc.text("CNPJ: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(conta.cnpj_cpf, 14 + doc.getTextWidth("CNPJ: "), y); y += 5; }
      doc.setFont("helvetica", "bold"); doc.text("Banco: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(conta.banco, 14 + doc.getTextWidth("Banco: "), y); y += 5;
      doc.setFont("helvetica", "bold"); doc.text("Agência: ", 14, y); doc.setFont("helvetica", "normal"); doc.text(conta.agencia, 14 + doc.getTextWidth("Agência: "), y); y += 5;
      doc.setFont("helvetica", "bold"); doc.text(`${conta.tipo_conta}: `, 14, y); doc.setFont("helvetica", "normal"); doc.text(conta.conta, 14 + doc.getTextWidth(`${conta.tipo_conta}: `), y); y += 5;
    }

    // --- PAGE 3: RESPONSABILIDADES ---
    if (resps && resps.length > 0) {
      doc.addPage();
      await addPageHeader();
      y = 30;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50, 50, 50);
      doc.text("5. RESPONSABILIDADE", 14, y); y += 4;

      const clienteName = emp?.razao_social || emp?.nome || "CLIENTE";
      autoTable(doc, {
        startY: y,
        head: [["ATIVIDADE/ITEM", "BUSATO", clienteName.toUpperCase()]],
        body: resps.map(r => [
          r.atividade,
          r.responsavel_busato ? "X" : "",
          r.responsavel_cliente ? "X" : "",
        ]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [200, 200, 200], textColor: [40, 40, 40], fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "center" }, 2: { halign: "center" } },
        theme: "grid",
      });
    }

    const numStr = String(item.numero_sequencial).padStart(3, "0");
    const empName = (emp?.nome || "proposta").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
    doc.save(`${numStr}_PROPOSTA_COMERCIAL_DE_LOCAÇÃO_-_${empName}.pdf`);
    
    // Update status to Enviada if Rascunho
    if (item.status === "Rascunho") {
      await supabase.from("propostas").update({ status: "Enviada" }).eq("id", item.id);
      fetchData();
    }
  };

  const statusColor = (s: string) => {
    if (s === "Aprovada") return "bg-success text-success-foreground";
    if (s === "Enviada") return "bg-accent text-accent-foreground";
    if (s === "Recusada") return "bg-destructive text-destructive-foreground";
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
                {filtered.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-bold">{String(item.numero_sequencial).padStart(3, "0")}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{item.empresas?.nome}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.empresas?.cnpj}</p>
                    </TableCell>
                    <TableCell className="text-sm">{parseLocalDate(item.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    <TableCell><Badge className={statusColor(item.status)}>{item.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
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
                ))}
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
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                    <SelectItem value="Enviada">Enviada</SelectItem>
                    <SelectItem value="Aprovada">Aprovada</SelectItem>
                    <SelectItem value="Recusada">Recusada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div><Label>Nome (2º)</Label><Input value={form.consultor_nome_2} onChange={e => setForm(f => ({ ...f, consultor_nome_2: e.target.value }))} /></div>
                <div><Label>Email (2º)</Label><Input value={form.consultor_email_2} onChange={e => setForm(f => ({ ...f, consultor_email_2: e.target.value }))} /></div>
                <div><Label>Telefone (2º)</Label><Input value={form.consultor_telefone_2} onChange={e => setForm(f => ({ ...f, consultor_telefone_2: e.target.value }))} /></div>
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
                      options={[
                        ...equipamentosCadastro.map(e => ({
                          value: e.tipo,
                          label: `${e.tipo} - ${e.modelo}${e.tag_placa ? ` (${e.tag_placa})` : ''}`,
                        })),
                      ]}
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
