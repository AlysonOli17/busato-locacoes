import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, Pencil, Trash2, Building2, Loader2, MapPin,
  ArrowUp, ArrowDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Empresa {
  id: string;
  cnpj: string;
  nome: string;
  razao_social: string;
  nome_fantasia: string;
  obra?: string | null;
  inscricao_estadual: string;
  inscricao_municipal: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_cep: string;
  email: string;
  atividade_principal: string;
  contato: string | null;
  telefone: string | null;
  status: string;
  created_at: string;
}

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const emptyForm = {
  cnpj: "", nome: "", razao_social: "", nome_fantasia: "", obra: "",
  inscricao_estadual: "", inscricao_municipal: "",
  endereco_logradouro: "", endereco_numero: "", endereco_complemento: "",
  endereco_bairro: "", endereco_cidade: "", endereco_uf: "", endereco_cep: "",
  email: "", atividade_principal: "",
  contato: "", telefone: "", status: "Ativa",
};

const SORT_OPTIONS = [
  { value: "razao_social", label: "Razão Social" },
  { value: "nome_fantasia", label: "Nome Fantasia" },
  { value: "cidade", label: "Cidade" },
  { value: "status", label: "Status" },
  { value: "cnpj", label: "CNPJ" },
  { value: "created_at", label: "Data de Cadastro" },
];

// ─── Formatadores ───────────────────────────────────────────────────────────
const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const formatCEP = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

// ─── Avatar helpers ──────────────────────────────────────────────────────────
/** Gera um hue HSL único e determinístico a partir do nome da empresa */
const getAvatarHue = (name: string): number => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
};

/** Extrai até 2 iniciais da razão social */
const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

// ─── Skeleton Card ───────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <Card className="overflow-hidden border-l-4 border-l-muted">
    <CardContent className="p-5">
      <div className="flex items-start gap-4 mb-4">
        <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
      </div>
      <div className="bg-muted/20 rounded-lg p-3 space-y-2 border border-border/30">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-4 pt-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ─── Componente principal ────────────────────────────────────────────────────
const Empresas = () => {
  const [items, setItems] = useState<Empresa[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [contatosAdicionais, setContatosAdicionais] = useState<{ id?: string; nome: string; email: string; telefone: string }[]>([]);
  const [novoContato, setNovoContato] = useState({ nome: "", email: "", telefone: "" });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();
  const [sortCol, setSortCol] = useState("razao_social");
  const [sortAsc, setSortAsc] = useState(true);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("empresas").select("*").order("created_at", { ascending: false });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setItems((data || []) as unknown as Empresa[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total: items.length,
    ativas: items.filter((i) => i.status === "Ativa").length,
    inativas: items.filter((i) => i.status === "Inativa").length,
    ufs: new Set(items.map((i) => i.endereco_uf).filter(Boolean)).size,
  }), [items]);

  // ── Busca expandida ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter((i) =>
      (i.razao_social || i.nome).toLowerCase().includes(q) ||
      i.cnpj.includes(q) ||
      (i.nome_fantasia || "").toLowerCase().includes(q) ||
      (i.endereco_cidade || "").toLowerCase().includes(q) ||
      (i.endereco_uf || "").toLowerCase().includes(q) ||
      (i.atividade_principal || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  // ── Ordenação ──────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "cnpj":         cmp = a.cnpj.localeCompare(b.cnpj); break;
        case "razao_social": cmp = (a.razao_social || a.nome).localeCompare(b.razao_social || b.nome); break;
        case "nome_fantasia":cmp = (a.nome_fantasia || "").localeCompare(b.nome_fantasia || ""); break;
        case "cidade":       cmp = (a.endereco_cidade || "").localeCompare(b.endereco_cidade || ""); break;
        case "status":       cmp = a.status.localeCompare(b.status); break;
        case "created_at":   cmp = a.created_at.localeCompare(b.created_at); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortAsc]);

  // ── Consulta CNPJ ──────────────────────────────────────────────────────────
  const handleFetchCNPJ = async () => {
    const cleanCNPJ = form.cnpj.replace(/\D/g, "");
    if (cleanCNPJ.length !== 14) {
      toast({ title: "CNPJ inválido", description: "Digite os 14 dígitos do CNPJ para consultar.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      if (!response.ok) throw new Error("Não foi possível encontrar este CNPJ. Verifique se o número está correto.");
      const data = await response.json();
      setForm((prev) => ({
        ...prev,
        razao_social:        data.razao_social          || prev.razao_social,
        nome_fantasia:       data.nome_fantasia          || prev.nome_fantasia,
        atividade_principal: data.cnae_fiscal_descricao  || prev.atividade_principal,
        endereco_logradouro: data.logradouro             || prev.endereco_logradouro,
        endereco_numero:     data.numero                 || prev.endereco_numero,
        endereco_complemento:data.complemento            || prev.endereco_complemento,
        endereco_bairro:     data.bairro                 || prev.endereco_bairro,
        endereco_cidade:     data.municipio              || prev.endereco_cidade,
        endereco_uf:         data.uf                     || prev.endereco_uf,
        endereco_cep:        data.cep ? formatCEP(data.cep) : prev.endereco_cep,
        email:               data.email                  || prev.email,
        telefone:            data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : prev.telefone,
      }));
      toast({ title: "Dados encontrados!", description: "Os campos foram preenchidos automaticamente." });
    } catch (err: any) {
      toast({ title: "Erro na consulta", description: err?.message || "Erro ao buscar dados do CNPJ.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // ── CRUD helpers ───────────────────────────────────────────────────────────
  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setContatosAdicionais([]);
    setNovoContato({ nome: "", email: "", telefone: "" });
    setDialogOpen(true);
  };

  const openEdit = async (item: Empresa) => {
    setEditing(item);
    setForm({
      cnpj: item.cnpj, nome: item.nome,
      razao_social: item.razao_social || "", nome_fantasia: item.nome_fantasia || "",
      obra: item.obra || "",
      inscricao_estadual: item.inscricao_estadual || "", inscricao_municipal: item.inscricao_municipal || "",
      endereco_logradouro: item.endereco_logradouro || "", endereco_numero: item.endereco_numero || "",
      endereco_complemento: item.endereco_complemento || "", endereco_bairro: item.endereco_bairro || "",
      endereco_cidade: item.endereco_cidade || "", endereco_uf: item.endereco_uf || "",
      endereco_cep: item.endereco_cep || "", email: item.email || "",
      atividade_principal: item.atividade_principal || "",
      contato: item.contato || "", telefone: item.telefone || "", status: item.status,
    });
    setContatosAdicionais([]);
    setNovoContato({ nome: "", email: "", telefone: "" });
    setDialogOpen(true);

    const { data: contactsData } = await supabase
      .from("empresas_contatos")
      .select("*")
      .eq("empresa_id", item.id);

    if (contactsData) {
      setContatosAdicionais(
        contactsData.map((c: any) => ({
          id: c.id,
          nome: c.nome,
          email: c.email || "",
          telefone: c.telefone || "",
        }))
      );
    }
  };

  const handleSave = async () => {
    if (!form.cnpj || !form.razao_social) {
      toast({ title: "Campos obrigatórios", description: "CNPJ e Razão Social são obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, nome: form.razao_social };
      let empresaId = editing?.id;

      if (editing) {
        const { error } = await supabase.from("empresas").update(payload).eq("id", editing.id);
        if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      } else {
        const newId = crypto.randomUUID();
        const { error } = await supabase.from("empresas").insert({ ...payload, id: newId });
        if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
        empresaId = newId;
      }

      if (empresaId) {
        const { error: deleteError } = await supabase.from("empresas_contatos").delete().eq("empresa_id", empresaId);
        if (deleteError) {
          toast({ title: "Erro ao salvar contatos", description: deleteError.message, variant: "destructive" });
          return;
        }
        const validContacts = contatosAdicionais.filter((c) => c.nome.trim() !== "");
        if (validContacts.length > 0) {
          const { error: insertError } = await supabase.from("empresas_contatos").insert(
            validContacts.map((c) => ({
              id: crypto.randomUUID(),
              empresa_id: empresaId,
              nome: c.nome,
              email: c.email || null,
              telefone: c.telefone || null,
            }))
          );
          if (insertError) {
            toast({ title: "Erro ao salvar contatos", description: insertError.message, variant: "destructive" });
            return;
          }
        }
      }

      toast({
        title: "Salvo com sucesso!",
        description: editing ? "Empresa atualizada." : "Nova empresa cadastrada.",
      });
      setDialogOpen(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  /** Chamado apenas após confirmação no AlertDialog */
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("empresas").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Empresa excluída", description: "Registro removido com sucesso." });
    setDeleteTarget(null);
    fetchData();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout title="Empresas" subtitle="Gestão de clientes e fornecedores">
      <div className="space-y-5">

        {/* ── KPI Bar ── */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total",       value: kpis.total,    color: "text-primary bg-primary/10" },
              { label: "Ativas",      value: kpis.ativas,   color: "text-success bg-success/10" },
              { label: "Inativas",    value: kpis.inativas, color: "text-destructive bg-destructive/10" },
              { label: "Estados (UF)",value: kpis.ufs,      color: "text-amber-500 bg-amber-500/10" },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-panel rounded-xl p-3 flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", color)}>
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Action Bar ── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 bg-card p-4 rounded-lg border border-border shadow-sm">
          {/* Busca */}
          <div className="relative w-full lg:w-80 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ, cidade, UF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          {/* Ordenação + Botão */}
          <div className="flex items-center gap-2 flex-wrap lg:ml-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Ordenar por:</span>
            <Select value={sortCol} onValueChange={(v) => setSortCol(v)}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setSortAsc((prev) => !prev)}
              title={sortAsc ? "Crescente" : "Decrescente"}
            >
              {sortAsc ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>

            <Button
              onClick={openNew}
              className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm ml-1"
            >
              <Plus className="h-4 w-4 mr-2" /> Nova Empresa
            </Button>
          </div>
        </div>

        {/* Contador de resultados ao buscar */}
        {!loading && search.trim() && (
          <p className="text-xs text-muted-foreground px-1">
            {sorted.length} resultado{sorted.length !== 1 ? "s" : ""} para{" "}
            <strong>"{search}"</strong>
          </p>
        )}

        {/* ── Grid de Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : sorted.length === 0 ? (
            <div className="col-span-full py-16 text-center text-muted-foreground glass-panel rounded-xl">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium">Nenhuma empresa encontrada</p>
              <p className="text-sm opacity-70">Tente ajustar seus filtros ou busca.</p>
            </div>
          ) : (
            sorted.map((item) => {
              const hue = getAvatarHue(item.razao_social || item.nome);
              const initials = getInitials(item.razao_social || item.nome);
              const borderColor =
                item.status === "Ativa" ? "var(--success)" :
                item.status === "Inativa" ? "var(--destructive)" :
                "var(--primary)";

              return (
                <Card
                  key={item.id}
                  className="group hover:shadow-md transition-all glass-panel overflow-hidden relative border-l-4"
                  style={{ borderLeftColor: `hsl(${borderColor})` }}
                >
                  {/* Hover actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-lg shadow-sm border border-border p-1 flex gap-1 z-10">
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 hover:bg-primary/20 hover:text-primary"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
                      onClick={() => setDeleteTarget(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <CardContent className="p-5">
                    <div className="flex items-start gap-4 mb-4">
                      {/* Avatar com iniciais e cor única */}
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-inner select-none"
                        style={{ backgroundColor: `hsl(${hue}, 55%, 40%)` }}
                      >
                        {initials || <Building2 className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg leading-none truncate">
                          {item.razao_social || item.nome}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {item.nome_fantasia || "Sem nome fantasia"}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-mono bg-background/50">
                            {item.cnpj}
                          </Badge>
                          <Badge className={cn(
                            "text-[10px]",
                            item.status === "Ativa"
                              ? "bg-success text-success-foreground"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm bg-muted/20 rounded-lg p-3 border border-border/30">
                      <div className="col-span-2">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Localização
                        </p>
                        <p className="font-medium truncate">
                          {item.endereco_cidade && item.endereco_uf
                            ? `${item.endereco_cidade} / ${item.endereco_uf}`
                            : "Não informada"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Telefone</p>
                        <p className="font-medium">{item.telefone || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Obras</p>
                        <p className="font-medium truncate">{item.obra || "—"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* ── Dialog de Cadastro / Edição ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-accent" />
              {editing ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">

            {/* Dados da Empresa */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-accent">Dados da Empresa</p>
                <Button
                  type="button" variant="outline" size="sm"
                  className="gap-2 text-accent border-accent hover:bg-accent/10"
                  onClick={handleFetchCNPJ}
                  disabled={importing || form.cnpj.length < 18}
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {importing ? "Consultando..." : "Consultar CNPJ (Grátis)"}
                </Button>
              </div>
              <div className="h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>CNPJ <span className="text-destructive">*</span></Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0001-00" maxLength={18} />
              </div>
              <div>
                <Label>Razão Social <span className="text-destructive">*</span></Label>
                <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} placeholder="Razão Social da empresa" />
              </div>
              <div>
                <Label>Obra / Identificação</Label>
                <Input value={form.obra} onChange={(e) => setForm({ ...form, obra: e.target.value })} placeholder="Ex: Obra 5223, Unidade ES..." />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome Fantasia</Label>
                <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} placeholder="Nome Fantasia" />
              </div>
              <div>
                <Label>Atividade Principal</Label>
                <Input value={form.atividade_principal} onChange={(e) => setForm({ ...form, atividade_principal: e.target.value })} placeholder="Ex: Locação de equipamentos" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Inscrição Estadual</Label>
                <Input value={form.inscricao_estadual} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} placeholder="Inscrição Estadual" />
              </div>
              <div>
                <Label>Inscrição Municipal</Label>
                <Input value={form.inscricao_municipal} onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })} placeholder="Inscrição Municipal" />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-1 pt-2">
              <p className="text-sm font-semibold text-accent">Endereço</p>
              <div className="h-px bg-border" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2">
                <Label>CEP</Label>
                <Input value={form.endereco_cep} onChange={(e) => setForm({ ...form, endereco_cep: formatCEP(e.target.value) })} placeholder="00000-000" maxLength={9} />
              </div>
              <div className="col-span-2">
                <Label>UF</Label>
                <Select value={form.endereco_uf} onValueChange={(v) => setForm({ ...form, endereco_uf: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>Logradouro</Label>
                <Input value={form.endereco_logradouro} onChange={(e) => setForm({ ...form, endereco_logradouro: e.target.value })} placeholder="Rua, Av, etc." />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={form.endereco_numero} onChange={(e) => setForm({ ...form, endereco_numero: e.target.value })} placeholder="Nº" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Complemento</Label>
                <Input value={form.endereco_complemento} onChange={(e) => setForm({ ...form, endereco_complemento: e.target.value })} placeholder="Sala, Andar..." />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.endereco_bairro} onChange={(e) => setForm({ ...form, endereco_bairro: e.target.value })} placeholder="Bairro" />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.endereco_cidade} onChange={(e) => setForm({ ...form, endereco_cidade: e.target.value })} placeholder="Cidade" />
              </div>
            </div>

            {/* Contato */}
            <div className="space-y-1 pt-2">
              <p className="text-sm font-semibold text-accent">Contato</p>
              <div className="h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Responsável</Label>
                <Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="Nome do contato" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })} placeholder="(00) 00000-0000" maxLength={15} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" />
              </div>
            </div>

            {/* Contatos Adicionais */}
            <div className="space-y-1 pt-2">
              <p className="text-sm font-semibold text-accent">Contatos Adicionais</p>
              <div className="h-px bg-border" />
            </div>

            {contatosAdicionais.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
                {contatosAdicionais.map((contato, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium text-foreground">{contato.nome}</p>
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {contato.email && <span>{contato.email}</span>}
                        {contato.telefone && <span>{contato.telefone}</span>}
                      </div>
                    </div>
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setContatosAdicionais(contatosAdicionais.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-muted/20 p-4 rounded-lg border border-border/60">
              <div>
                <Label>Nome do Contato</Label>
                <Input value={novoContato.nome} onChange={(e) => setNovoContato({ ...novoContato, nome: e.target.value })} placeholder="Nome" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={novoContato.email} onChange={(e) => setNovoContato({ ...novoContato, email: e.target.value })} placeholder="email@empresa.com" />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Telefone</Label>
                  <Input
                    value={novoContato.telefone}
                    onChange={(e) => setNovoContato({ ...novoContato, telefone: formatPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
                <Button
                  type="button" variant="outline"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => {
                    if (!novoContato.nome.trim()) {
                      toast({ title: "Erro ao adicionar contato", description: "O nome do contato é obrigatório.", variant: "destructive" });
                      return;
                    }
                    setContatosAdicionais([...contatosAdicionais, { ...novoContato }]);
                    setNovoContato({ nome: "", email: "", telefone: "" });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            </div>

            {/* Status */}
            <div className="pt-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
              ) : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog de Confirmação de Exclusão ── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. A empresa e todos os seus
              contatos adicionais serão permanentemente removidos do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Empresas;