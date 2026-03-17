import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Building2, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Empresa {
  id: string;
  cnpj: string;
  nome: string;
  razao_social: string;
  nome_fantasia: string;
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
  cnpj: "", nome: "", razao_social: "", nome_fantasia: "",
  inscricao_estadual: "", inscricao_municipal: "",
  endereco_logradouro: "", endereco_numero: "", endereco_complemento: "",
  endereco_bairro: "", endereco_cidade: "", endereco_uf: "", endereco_cep: "",
  email: "", atividade_principal: "",
  contato: "", telefone: "", status: "Ativa",
};

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

const Empresas = () => {
  const [items, setItems] = useState<Empresa[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    const { data, error } = await supabase.from("empresas").select("*").order("created_at", { ascending: false });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setItems((data || []) as unknown as Empresa[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter(
    (i) => i.nome.toLowerCase().includes(search.toLowerCase()) || i.cnpj.includes(search) || (i.razao_social || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleImportCNPJ = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast({
        title: "Arquivo inválido",
        description: "Use uma imagem (PNG, JPG, WEBP) ou PDF do Cartão CNPJ.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setImporting(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const [prefix, base64] = dataUrl.split(",");
      const mimeMatch = prefix?.match(/^data:(.*);base64$/);
      const mimeType = mimeMatch?.[1] || file.type || "image/png";

      if (!base64) {
        throw new Error("Não foi possível ler a imagem selecionada.");
      }

      const { data, error } = await supabase.functions.invoke("extract-cnpj", {
        body: {
          image_base64: base64,
          image_mime_type: mimeType,
          image_data_url: dataUrl,
        },
      });

      if (error) {
        let detail = error.message;
        const context = (error as any)?.context;

        if (context) {
          try {
            const payload = await context.json();
            if (payload?.error) detail = payload.error;
          } catch {
            // fallback para error.message
          }
        }

        throw new Error(detail || "Não foi possível extrair os dados.");
      }

      setForm((prev) => ({
        ...prev,
        cnpj: data.cnpj ? formatCNPJ(data.cnpj) : prev.cnpj,
        razao_social: data.razao_social || prev.razao_social,
        nome_fantasia: data.nome_fantasia || prev.nome_fantasia,
        atividade_principal: data.atividade_principal || prev.atividade_principal,
        inscricao_estadual: data.inscricao_estadual || prev.inscricao_estadual,
        inscricao_municipal: data.inscricao_municipal || prev.inscricao_municipal,
        endereco_logradouro: data.endereco_logradouro || prev.endereco_logradouro,
        endereco_numero: data.endereco_numero || prev.endereco_numero,
        endereco_complemento: data.endereco_complemento || prev.endereco_complemento,
        endereco_bairro: data.endereco_bairro || prev.endereco_bairro,
        endereco_cidade: data.endereco_cidade || prev.endereco_cidade,
        endereco_uf: data.endereco_uf || prev.endereco_uf,
        endereco_cep: data.endereco_cep ? formatCEP(data.endereco_cep) : prev.endereco_cep,
        email: data.email || prev.email,
        telefone: data.telefone ? formatPhone(data.telefone) : prev.telefone,
      }));

      toast({ title: "Importado!", description: "Dados do Cartão CNPJ extraídos com sucesso. Revise os campos." });
    } catch (err: any) {
      toast({
        title: "Erro na importação",
        description: err?.message || "Não foi possível extrair os dados.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: Empresa) => {
    setEditing(item);
    setForm({
      cnpj: item.cnpj, nome: item.nome,
      razao_social: item.razao_social || "", nome_fantasia: item.nome_fantasia || "",
      inscricao_estadual: item.inscricao_estadual || "", inscricao_municipal: item.inscricao_municipal || "",
      endereco_logradouro: item.endereco_logradouro || "", endereco_numero: item.endereco_numero || "",
      endereco_complemento: item.endereco_complemento || "", endereco_bairro: item.endereco_bairro || "",
      endereco_cidade: item.endereco_cidade || "", endereco_uf: item.endereco_uf || "",
      endereco_cep: item.endereco_cep || "", email: item.email || "",
      atividade_principal: item.atividade_principal || "",
      contato: item.contato || "", telefone: item.telefone || "", status: item.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.cnpj || !form.razao_social) {
      toast({ title: "Campos obrigatórios", description: "CNPJ e Razão Social são obrigatórios.", variant: "destructive" });
      return;
    }
    const payload = { ...form, nome: form.razao_social };
    if (editing) {
      const { error } = await supabase.from("empresas").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("empresas").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("empresas").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchData();
  };

  return (
    <Layout title="Empresas" subtitle={`${items.length} empresas cadastradas`}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Empresa
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, razão social ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.cnpj}</TableCell>
                    <TableCell className="font-medium text-sm">{item.razao_social || item.nome}</TableCell>
                    <TableCell className="text-sm">{item.nome_fantasia || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.endereco_cidade && item.endereco_uf ? `${item.endereco_cidade}/${item.endereco_uf}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.telefone || "—"}</TableCell>
                    <TableCell>
                      <Badge className={item.status === "Ativa" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-accent" />
              {editing ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            {/* Dados Principais */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-accent">Dados Principais (Cartão CNPJ)</p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleImportCNPJ}
                    disabled={importing}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={importing}
                    asChild
                  >
                    <span>
                      {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {importing ? "Importando..." : "Importar Cartão CNPJ"}
                    </span>
                  </Button>
                </label>
              </div>
              <div className="h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>CNPJ <span className="text-destructive">*</span></Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0001-00" maxLength={18} />
              </div>
              <div>
                <Label>Razão Social <span className="text-destructive">*</span></Label>
                <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} placeholder="Razão Social da empresa" />
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Empresas;