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
import { CurrencyInput } from "@/components/CurrencyInput";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, FileDown, Eye, Copy, X, CheckCircle, Mail, FileText, Clock, CheckSquare, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { generatePropostaPDF } from "@/lib/propostaExportUtils";
import { generateContratoPDF } from "@/lib/contratoExportUtils";

interface Empresa {
  id: string; nome: string; cnpj: string; razao_social: string | null; nome_fantasia: string | null;
  endereco_logradouro?: string | null; endereco_numero?: string | null; endereco_complemento?: string | null;
  endereco_bairro?: string | null; endereco_cidade?: string | null; endereco_uf?: string | null;
}

interface ContaBancaria {
  id: string; banco: string; agencia: string; conta: string; titular: string; cnpj_cpf: string | null; tipo_conta: string;
}

interface Equipamento {
  id: string; tipo: string; modelo: string; tag_placa: string | null; status: string; numero_serie: string | null;
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
  franquia_horas_texto: "Garantia mínima de horas",
  horas_excedentes_texto: "Serão cobradas horas excedentes conforme valor unitário por hora.",
  disponibilidade_texto: "Equipamentos sujeitos à disponibilidade no momento da contratação.",
  analise_cadastral_texto: "Sujeito a verificação cadastral conforme normas vigentes.",
  seguro_texto: "Em caso de acionamento do seguro a franquia é de responsabilidade do cliente.",
  tipo_medicao: "horas",
};

const parseLocalDate = (d: string) => new Date(d + "T00:00:00");

const numberToWords = (value: number): string => {
  if (value === 0) return "zero reais";
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  const convertGroup = (n: number): string => {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const parts: string[] = [];
    if (n >= 100) { parts.push(hundreds[Math.floor(n / 100)]); n %= 100; }
    if (n >= 20) { parts.push(tens[Math.floor(n / 10)]); n %= 10; }
    if (n >= 10) { parts.push(teens[n - 10]); n = 0; }
    if (n > 0) parts.push(units[n]);
    return parts.join(" e ");
  };

  const intPart = Math.floor(value);
  const centsPart = Math.round((value - intPart) * 100);
  const groups: string[] = [];

  if (intPart >= 1000000) {
    const m = Math.floor(intPart / 1000000);
    groups.push(convertGroup(m) + (m === 1 ? " milhão" : " milhões"));
  }
  const rem = intPart % 1000000;
  if (rem >= 1000) {
    const t = Math.floor(rem / 1000);
    groups.push(convertGroup(t) + " mil");
  }
  const u = rem % 1000;
  if (u > 0) groups.push(convertGroup(u));

  let result = groups.join(", ") + (intPart === 1 ? " real" : " reais");
  if (centsPart > 0) {
    result += " e " + convertGroup(centsPart) + (centsPart === 1 ? " centavo" : " centavos");
  }
  return result;
};

const formatMobilizacaoTexto = (valor: number): string => {
  if (valor <= 0) return "";
  const formatted = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R$ ${formatted} (${numberToWords(valor)}) para transporte do equipamento.`;
};

const Propostas = ({ embedded = false }: { embedded?: boolean }) => {
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
  const [showObservacoes, setShowObservacoes] = useState(false);
  const { toast } = useToast();
  const { role, user } = useAuth();

  // Contract Modal State
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractProposal, setContractProposal] = useState<Proposta | null>(null);
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractEquipments, setContractEquipments] = useState<any[]>([]);
  const [testemunha1Nome, setTestemunha1Nome] = useState("");
  const [testemunha1Cpf, setTestemunha1Cpf] = useState("");
  const [testemunha2Nome, setTestemunha2Nome] = useState("");
  const [testemunha2Cpf, setTestemunha2Cpf] = useState("");

  // Custom clause parameters
  const [contractEmpresaId, setContractEmpresaId] = useState("");
  const [diaInicioMedicao, setDiaInicioMedicao] = useState("01");
  const [diaFimMedicao, setDiaFimMedicao] = useState("30");
  const [prazoPagamentoDias, setPrazoPagamentoDias] = useState<number>(30);
  const [multaAtrasoPercent, setMultaAtrasoPercent] = useState<number>(2.00);
  const [jurosAtrasoPercent, setJurosAtrasoPercent] = useState<number>(2.00);

  const openContractDialog = (item: Proposta) => {
    setContractProposal(item);
    setContractEmpresaId(item.empresa_id || "");
    setDiaInicioMedicao("01");
    setDiaFimMedicao("30");
    setPrazoPagamentoDias(item.prazo_pagamento || 30);
    setMultaAtrasoPercent(2.00);
    setJurosAtrasoPercent(2.00);
    
    const today = new Date().toISOString().slice(0, 10);
    const threeMonthsLater = new Date();
    threeMonthsLater.setDate(threeMonthsLater.getDate() + 90);
    const end = threeMonthsLater.toISOString().slice(0, 10);
    
    setContractStartDate(today);
    setContractEndDate(end);
    
    // Duplicate based on quantity
    const peList = (item as any).propostas_equipamentos || [];
    const eqSelects: any[] = [];
    peList.forEach((pe: any) => {
      for (let i = 0; i < pe.quantidade; i++) {
        eqSelects.push({
          equipamento_tipo: pe.equipamento_tipo,
          equipamento_id: "", // selected physical equipment ID
          numero_serie: "", // custom serial/chassis number
          valor_hora: pe.valor_hora,
          franquia_mensal: pe.franquia_mensal || 0,
          valor_mensal: pe.valor_hora * (pe.franquia_mensal || 0)
        });
      }
    });
    setContractEquipments(eqSelects);
    setTestemunha1Nome("");
    setTestemunha1Cpf("");
    setTestemunha2Nome("");
    setTestemunha2Cpf("");
    setContractDialogOpen(true);
  };

  const handleExportContract = async () => {
    if (!contractProposal) return;
    
    // Check if all equipments have a model
    const invalid = contractEquipments.some(ce => !ce.equipamento_tipo);
    if (invalid || contractEquipments.length === 0) {
      toast({ title: "Erro", description: "Todos os equipamentos do contrato precisam ter um modelo/descrição informado.", variant: "destructive" });
      return;
    }

    const client = empresas.find(e => e.id === contractEmpresaId);
    if (!client) {
      toast({ title: "Erro", description: "Selecione uma empresa cliente válida.", variant: "destructive" });
      return;
    }

    // Map equipments with details
    const equipsWithDetails = contractEquipments.map(ce => {
      return {
        equipamento_tipo: ce.equipamento_tipo,
        quantidade: 1,
        valor_hora: ce.valor_hora,
        franquia_mensal: ce.franquia_mensal,
        numero_serie: ce.numero_serie || "—",
        valor_mensal: ce.valor_mensal
      };
    });

    try {
      await generateContratoPDF({
        empresa: client,
        equipamentos: equipsWithDetails,
        data_inicio: contractStartDate,
        data_fim: contractEndDate,
        testemunhas: {
          nome1: testemunha1Nome,
          cpf1: testemunha1Cpf,
          nome2: testemunha2Nome,
          cpf2: testemunha2Cpf
        },
        numero_proposta: String(contractProposal.numero_sequencial).padStart(3, "0"),
        dia_inicio_medicao: diaInicioMedicao,
        dia_fim_medicao: diaFimMedicao,
        prazo_pagamento_dias: prazoPagamentoDias,
        multa_atraso_percent: multaAtrasoPercent,
        juros_atraso_percent: jurosAtrasoPercent,
        tipo_medicao: contractProposal.tipo_medicao
      });
      toast({ title: "Contrato gerado", description: "Contrato formal exportado com sucesso." });
      setContractDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    }
  };

  const fetchData = async () => {
    const [propRes, empRes, contasRes, eqCadRes, peRes] = await Promise.all([
      (supabase.from("propostas") as any).select("*").order("numero", { ascending: false }),
      supabase.from("empresas").select("id, nome, cnpj, razao_social, nome_fantasia, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf").eq("status", "Ativa").order("nome"),
      supabase.from("contas_bancarias").select("*").order("banco"),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, status, numero_serie").eq("status", "Ativo").order("tipo"),
      supabase.from("propostas_equipamentos").select("*")
    ]);

    if (propRes.data) {
      const peList = peRes.data || [];
      const propostasData = propRes.data.map((p: any) => {
        const mapped: Proposta = {
          id: p.id,
          numero_sequencial: p.numero,
          empresa_id: p.empresa_id,
          data: p.data,
          validade_dias: p.validade_dias,
          status: p.status,
          valor_mobilizacao: Number(p.desconto) || 0,
          valor_mobilizacao_texto: p.condicoes_pagamento || "",
          prazo_pagamento: p.prazo_entrega || 0,
          conta_bancaria_id: p.conta_bancaria_id,
          consultor_nome: p.responsavel_nome || "",
          consultor_email: p.responsavel_email || "",
          consultor_telefone: p.responsavel_telefone || "",
          consultor_nome_2: p.campo_extra_1 || "",
          consultor_email_2: p.campo_extra_2 || "",
          consultor_telefone_2: p.campo_extra_3 || "",
          observacoes: p.campo_extra_4 || "",
          franquia_horas_texto: p.garantia_minima || "",
          horas_excedentes_texto: p.observacao_1 || "",
          disponibilidade_texto: p.observacao_2 || "",
          analise_cadastral_texto: p.observacao_3 || "",
          seguro_texto: p.observacao_4 || "",
          tipo_medicao: p.tipo_unidade || "horas",
          created_at: p.created_at,
          created_by: p.user_id || null,
        };
        return {
          ...mapped,
          propostas_equipamentos: peList.filter(pe => pe.proposta_id === p.id)
        };
      });
      setItems(propostasData);
    }
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
    setShowObservacoes(false);
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
      tipo_medicao: (item as any).tipo_medicao || "horas",
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
    setShowObservacoes(!!(item.observacoes && item.observacoes.trim()));

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

    const dbPayload: any = {
      empresa_id: form.empresa_id,
      data: form.data,
      validade_dias: form.validade_dias,
      status: statusToSave,
      desconto: form.valor_mobilizacao,
      condicoes_pagamento: form.valor_mobilizacao_texto,
      prazo_entrega: form.prazo_pagamento,
      conta_bancaria_id: form.conta_bancaria_id || null,
      responsavel_nome: form.consultor_nome,
      responsavel_email: form.consultor_email,
      responsavel_telefone: form.consultor_telefone,
      campo_extra_1: form.consultor_nome_2,
      campo_extra_2: form.consultor_email_2,
      campo_extra_3: form.consultor_telefone_2,
      campo_extra_4: form.observacoes,
      garantia_minima: form.franquia_horas_texto,
      observacao_1: form.horas_excedentes_texto,
      observacao_2: form.disponibilidade_texto,
      observacao_3: form.analise_cadastral_texto,
      observacao_4: form.seguro_texto,
      tipo_unidade: form.tipo_medicao,
    };

    if (isNew && user) {
      dbPayload.user_id = user.id;
    }

    let propostaId: string;
    let numSeq: number | undefined;
    if (editing) {
      const { error } = await (supabase.from("propostas") as any).update(dbPayload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      propostaId = editing.id;
      numSeq = editing.numero_sequencial;
    } else {
      const newId = crypto.randomUUID();
      const { data, error } = await (supabase.from("propostas") as any).insert({ ...dbPayload, id: newId }).select("id, numero").single();
      if (error || (!data && !newId)) { toast({ title: "Erro", description: error?.message || "Erro", variant: "destructive" }); return; }
      propostaId = data?.id || newId;
      numSeq = data?.numero || 0;
    }

    // Save equipamentos
    await supabase.from("propostas_equipamentos").delete().eq("proposta_id", propostaId);
    if (equipamentos.length > 0) {
      await supabase.from("propostas_equipamentos").insert(
        equipamentos.map(e => ({ id: crypto.randomUUID(), proposta_id: propostaId, equipamento_tipo: e.equipamento_tipo, quantidade: e.quantidade, valor_hora: e.valor_hora, franquia_mensal: e.franquia_mensal }))
      );
    }

    // Save responsabilidades
    await supabase.from("propostas_responsabilidades").delete().eq("proposta_id", propostaId);
    if (responsabilidades.length > 0) {
      await supabase.from("propostas_responsabilidades").insert(
        responsabilidades.map(r => ({ id: crypto.randomUUID(), proposta_id: propostaId, atividade: r.atividade, responsavel_busato: r.responsavel_busato, responsavel_cliente: r.responsavel_cliente }))
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

    const dbPayload: any = {
      empresa_id: item.empresa_id,
      data: new Date().toISOString().slice(0, 10),
      validade_dias: item.validade_dias,
      status: "Aguardando Aprovação",
      desconto: item.valor_mobilizacao,
      condicoes_pagamento: item.valor_mobilizacao_texto,
      prazo_entrega: item.prazo_pagamento,
      conta_bancaria_id: item.conta_bancaria_id,
      responsavel_nome: item.consultor_nome,
      responsavel_email: item.consultor_email,
      responsavel_telefone: item.consultor_telefone,
      campo_extra_1: item.consultor_nome_2,
      campo_extra_2: item.consultor_email_2,
      campo_extra_3: item.consultor_telefone_2,
      campo_extra_4: item.observacoes,
      garantia_minima: item.franquia_horas_texto,
      observacao_1: item.horas_excedentes_texto,
      observacao_2: item.disponibilidade_texto,
      observacao_3: item.analise_cadastral_texto,
      observacao_4: item.seguro_texto,
      tipo_unidade: (item as any).tipo_medicao || "horas",
    };

    const newId = crypto.randomUUID();
    const { data: newProp, error } = await (supabase.from("propostas") as any).insert({ ...dbPayload, id: newId }).select("id").single();
    if (error || (!newProp && !newId)) { toast({ title: "Erro", description: error?.message, variant: "destructive" }); return; }

    const finalId = newProp?.id || newId;

    if (eqs && eqs.length > 0) {
      await supabase.from("propostas_equipamentos").insert(eqs.map(e => ({ id: crypto.randomUUID(), proposta_id: finalId, equipamento_tipo: e.equipamento_tipo, quantidade: e.quantidade, valor_hora: e.valor_hora, franquia_mensal: e.franquia_mensal })));
    }
    if (resps && resps.length > 0) {
      await supabase.from("propostas_responsabilidades").insert(resps.map(r => ({ id: crypto.randomUUID(), proposta_id: finalId, atividade: r.atividade, responsavel_busato: r.responsavel_busato, responsavel_cliente: r.responsavel_cliente })));
    }

    toast({ title: "Proposta duplicada" });
    fetchData();
  };

  const generatePDF = async (item: Proposta) => {
    const { toast } = useToast();
    await generatePropostaPDF(item, empresas, contas);
    toast({ title: "PDF gerado", description: "Proposta exportada com sucesso." });
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

  const content = (
    <>
      <div className="space-y-6">
        {/* Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar propostas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-background" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex gap-2"></div>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Nova Proposta
            </Button>
          </div>
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
                    <TableCell className="text-sm text-muted-foreground">
                      {(item as any).propostas_equipamentos?.reduce((sum: number, e: any) => sum + (e.quantidade || 0), 0) || "—"}
                    </TableCell>
                    <TableCell><Badge className={statusColor(item.status)}>{item.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {role === "admin" && item.status === "Aguardando Aprovação" && (
                          <Button variant="ghost" size="icon" onClick={() => handleApprove(item)} title="Aprovar proposta" className="text-success hover:text-success">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {item.status === "Proposta Aprovada" && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleSendEmail(item)} title="Enviar por e-mail" className="text-primary hover:text-primary">
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openContractDialog(item)} title="Emitir Contrato" className="text-success hover:text-success">
                              <FileSignature className="h-4 w-4" />
                            </Button>
                          </>
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
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
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
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Tipo Medição:</Label>
                    <Select value={form.tipo_medicao} onValueChange={v => setForm(f => ({ ...f, tipo_medicao: v }))}>
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="horas">Por Horas</SelectItem>
                        <SelectItem value="diarias">Por Diárias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEquipamentos(prev => [...prev, { equipamento_tipo: "", quantidade: 1, valor_hora: 0, franquia_mensal: 0 }])}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
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
                    {idx === 0 && <Label className="text-xs">{form.tipo_medicao === "diarias" ? "Valor/Diária" : "Valor/Hora"}</Label>}
                    <CurrencyInput value={eq.valor_hora} onValueChange={v => { const n = [...equipamentos]; n[idx].valor_hora = v; setEquipamentos(n); }} />
                  </div>
                  {form.tipo_medicao !== "diarias" && (
                    <div>
                      {idx === 0 && <Label className="text-xs">Franquia (h)</Label>}
                      <Input type="number" value={eq.franquia_mensal} onChange={e => { const n = [...equipamentos]; n[idx].franquia_mensal = Number(e.target.value); setEquipamentos(n); }} />
                    </div>
                  )}
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEquipamentos(prev => prev.filter((_, i) => i !== idx))}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Mobilização e condições */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Valor Mobilização (R$)</Label>
                  <CurrencyInput value={form.valor_mobilizacao} onValueChange={v => {
                    const texto = formatMobilizacaoTexto(v);
                    setForm(f => ({ ...f, valor_mobilizacao: v, valor_mobilizacao_texto: texto }));
                  }} />
                </div>
              </div>
              {form.valor_mobilizacao > 0 && (
                <p className="text-sm text-muted-foreground italic px-1">{form.valor_mobilizacao_texto}</p>
              )}
            </div>

            {form.tipo_medicao !== "diarias" && (
              <div className="space-y-3">
                <div><Label>Franquia de Horas (texto)</Label><Textarea value={form.franquia_horas_texto} onChange={e => setForm(f => ({ ...f, franquia_horas_texto: e.target.value }))} rows={2} /></div>
                <div><Label>Horas Excedentes (texto)</Label><Textarea value={form.horas_excedentes_texto} onChange={e => setForm(f => ({ ...f, horas_excedentes_texto: e.target.value }))} rows={2} /></div>
              </div>
            )}
            <div className="space-y-3">
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

            {/* Observações toggle */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Button
                  type="button"
                  variant={showObservacoes ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setShowObservacoes(prev => {
                      if (prev) setForm(f => ({ ...f, observacoes: "" }));
                      return !prev;
                    });
                  }}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  {showObservacoes ? "Remover Observações" : "Adicionar Observações"}
                </Button>
              </div>
              {showObservacoes && (
                <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} placeholder="Digite as observações da proposta..." />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground">{editing ? "Salvar" : "Criar Proposta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de emissão de contrato */}
      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Emitir Contrato Formal de Locação</DialogTitle>
            <DialogDescription>
              Preencha e revise os dados do contrato formal em PDF. Todos os campos são editáveis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Empresa e Vigência */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Empresa Locatária</Label>
                <SearchableSelect
                  options={empresas.map(e => ({ value: e.id, label: `${e.nome} (${e.cnpj})` }))}
                  value={contractEmpresaId}
                  onValueChange={v => setContractEmpresaId(v)}
                  placeholder="Selecione a empresa"
                  disabled={true}
                />
              </div>
              <div>
                <Label>Data de Início da Locação</Label>
                <Input type="date" value={contractStartDate} onChange={e => setContractStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Data de Término Estimada</Label>
                <Input type="date" value={contractEndDate} onChange={e => setContractEndDate(e.target.value)} />
              </div>
            </div>

            {/* Cláusulas Customizáveis */}
            <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Parâmetros das Cláusulas Contratuais</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">Início Medição (Dia)</Label>
                  <Input type="text" value={diaInicioMedicao} onChange={e => setDiaInicioMedicao(e.target.value)} placeholder="01" />
                </div>
                <div>
                  <Label className="text-xs">Fim Medição (Dia)</Label>
                  <Input type="text" value={diaFimMedicao} onChange={e => setDiaFimMedicao(e.target.value)} placeholder="30" />
                </div>
                <div>
                  <Label className="text-xs">Prazo Faturamento (Dias)</Label>
                  <Input type="number" value={prazoPagamentoDias} onChange={e => setPrazoPagamentoDias(Number(e.target.value))} placeholder="30" disabled />
                </div>
                <div>
                  <Label className="text-xs">Multa por Atraso (%)</Label>
                  <Input type="number" step="0.01" value={multaAtrasoPercent} onChange={e => setMultaAtrasoPercent(Number(e.target.value))} placeholder="2.00" />
                </div>
                <div>
                  <Label className="text-xs">Juros por Atraso (%)</Label>
                  <Input type="number" step="0.01" value={jurosAtrasoPercent} onChange={e => setJurosAtrasoPercent(Number(e.target.value))} placeholder="2.00" />
                </div>
              </div>
            </div>

            {/* Equipamentos do Contrato */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Equipamentos do Contrato</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setContractEquipments(prev => [
                      ...prev,
                      {
                        equipamento_tipo: "",
                        equipamento_id: "",
                        numero_serie: "",
                        valor_hora: 0,
                        franquia_mensal: 0,
                        valor_mensal: 0
                      }
                    ]);
                  }}
                  className="h-8 text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Equipamento
                </Button>
              </div>
              <div className="space-y-4">
                {contractEquipments.map((ce, idx) => (
                  <div key={idx} className="border border-border rounded-lg p-4 bg-muted/40 space-y-3 relative">
                    <div className="flex items-center justify-between border-b pb-2 mb-2">
                      <span className="text-xs font-bold uppercase text-primary">Item {String(idx + 1).padStart(2, "0")}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 animate-fade-in"
                        onClick={() => {
                          setContractEquipments(prev => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Vincular Equipamento Cadastrado</Label>
                        <SearchableSelect
                          options={equipamentosCadastro.map(e => ({
                            value: e.id,
                            label: `${e.modelo} (Placa: ${e.tag_placa || "—"} | Série: ${e.numero_serie || "—"} | ${e.tipo})`
                          }))}
                          value={ce.equipamento_id}
                          onValueChange={v => {
                            const selectedEq = equipamentosCadastro.find(e => e.id === v);
                            if (selectedEq) {
                              const newEqs = [...contractEquipments];
                              newEqs[idx].equipamento_id = v;
                              newEqs[idx].equipamento_tipo = `${selectedEq.tipo} - ${selectedEq.modelo}`;
                              newEqs[idx].numero_serie = selectedEq.numero_serie || selectedEq.tag_placa || "—";
                              setContractEquipments(newEqs);
                            }
                          }}
                          placeholder="Selecione o equipamento..."
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">Nome/Modelo no Contrato *</Label>
                        <Input
                          value={ce.equipamento_tipo}
                          onChange={e => {
                            const newEqs = [...contractEquipments];
                            newEqs[idx].equipamento_tipo = e.target.value;
                            setContractEquipments(newEqs);
                          }}
                          placeholder="Ex: Escavadeira Cat 320"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Chassis / Série</Label>
                        <Input
                          value={ce.numero_serie}
                          onChange={e => {
                            const newEqs = [...contractEquipments];
                            newEqs[idx].numero_serie = e.target.value;
                            setContractEquipments(newEqs);
                          }}
                          placeholder="Ex: Série 123456 / Placa ABC"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">
                          {contractProposal?.tipo_medicao === "diarias" ? "Franquia Mensal (Dias)" : "Franquia Mensal (Horas)"}
                        </Label>
                        <Input
                          type="number"
                          value={ce.franquia_mensal}
                          onChange={e => {
                            const val = Number(e.target.value);
                            const newEqs = [...contractEquipments];
                            newEqs[idx].franquia_mensal = val;
                            newEqs[idx].valor_mensal = newEqs[idx].valor_hora * val;
                            setContractEquipments(newEqs);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          {contractProposal?.tipo_medicao === "diarias" ? "Valor da Diária (R$)" : "Valor da Hora (R$)"}
                        </Label>
                        <CurrencyInput
                          value={ce.valor_hora}
                          onValueChange={v => {
                            const newEqs = [...contractEquipments];
                            newEqs[idx].valor_hora = v;
                            newEqs[idx].valor_mensal = v * (newEqs[idx].franquia_mensal || 0);
                            setContractEquipments(newEqs);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Valor Mensal Estimado (R$)</Label>
                        <CurrencyInput
                          value={ce.valor_mensal}
                          onValueChange={v => {
                            const newEqs = [...contractEquipments];
                            newEqs[idx].valor_mensal = v;
                            setContractEquipments(newEqs);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testemunhas */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Dados das Testemunhas (Opcional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 border border-border rounded-lg p-3">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Testemunha 1</span>
                  <div>
                    <Label className="text-xs">Nome Completo</Label>
                    <Input value={testemunha1Nome} onChange={e => setTestemunha1Nome(e.target.value)} placeholder="Nome" />
                  </div>
                  <div>
                    <Label className="text-xs">CPF</Label>
                    <Input value={testemunha1Cpf} onChange={e => setTestemunha1Cpf(e.target.value)} placeholder="000.000.000-00" />
                  </div>
                </div>

                <div className="space-y-2 border border-border rounded-lg p-3">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Testemunha 2</span>
                  <div>
                    <Label className="text-xs">Nome Completo</Label>
                    <Input value={testemunha2Nome} onChange={e => setTestemunha2Nome(e.target.value)} placeholder="Nome" />
                  </div>
                  <div>
                    <Label className="text-xs">CPF</Label>
                    <Input value={testemunha2Cpf} onChange={e => setTestemunha2Cpf(e.target.value)} placeholder="000.000.000-00" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setContractDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleExportContract} className="bg-accent text-accent-foreground">
              <FileSignature className="h-4 w-4 mr-2" /> Gerar Contrato (PDF)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return embedded ? content : <Layout title="Propostas Comerciais" subtitle={`${items.length} propostas cadastradas`}>{content}</Layout>;
};

export const PropostasContent = () => <Propostas embedded />;


export default Propostas;
