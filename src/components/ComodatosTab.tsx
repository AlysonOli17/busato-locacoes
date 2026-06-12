import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, FileDown, Ban, Loader2, FileText } from "lucide-react";
import { exportComodatoToPDF } from "@/lib/comodatoExportUtils";

interface Equipamento {
  id: string;
  tipo: string;
  modelo: string;
  tag_placa: string | null;
  numero_serie: string | null;
}

interface Comodato {
  id: string;
  comodante_nome: string;
  comodante_cnpj: string;
  comodante_endereco: string;
  comodataria_nome: string;
  comodataria_cnpj: string;
  comodataria_endereco: string;
  equipamento_id: string;
  fabricante: string;
  ano: string;
  data_inicio: string;
  data_fim: string | null;
  cidade: string;
  status: string;
  equipamentos?: Equipamento | null;
}

const defaultComodante = {
  nome: "BUSATO TRANSPORTES E LOCAÇÕES LTDA",
  cnpj: "39.397.682/0001-53",
  endereco: "Rua Gaivota, nº 1640, Novo Horizonte, Serra/ES, CEP 29.163-322"
};

const defaultComodataria = {
  nome: "BUSATO LOCAÇÕES E SERVIÇOS LTDA",
  cnpj: "54.167.719/0001-40",
  endereco: "Avenida Nossa Senhora da Penha, nº 595, sala 510, Santa Lúcia, Vitória/ES, CEP 29.056-250"
};

const emptyForm = {
  comodante_nome: defaultComodante.nome,
  comodante_cnpj: defaultComodante.cnpj,
  comodante_endereco: defaultComodante.endereco,
  comodataria_nome: defaultComodataria.nome,
  comodataria_cnpj: defaultComodataria.cnpj,
  comodataria_endereco: defaultComodataria.endereco,
  equipamento_id: "",
  fabricante: "",
  ano: new Date().getFullYear().toString(),
  data_inicio: new Date().toISOString().slice(0, 10),
  data_fim: "",
  cidade: "Serra/ES",
  status: "Ativo"
};

export const ComodatosTab = () => {
  const [comodatos, setComodatos] = useState<Comodato[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Comodato | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [comRes, eqRes] = await Promise.all([
        supabase.from("comodatos").select("*").order("created_at", { ascending: false }),
        supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo")
      ]);

      if (eqRes.data) {
        setEquipamentos(eqRes.data as Equipamento[]);
        
        if (comRes.data) {
          const eqMap = new Map(eqRes.data.map(e => [e.id, e]));
          const mapped = comRes.data.map((c: any) => ({
            ...c,
            equipamentos: eqMap.get(c.equipamento_id) || null
          }));
          setComodatos(mapped as Comodato[]);
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar comodatos:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredItems = useMemo(() => {
    return comodatos.filter(item => {
      const query = search.toLowerCase();
      const tipo = item.equipamentos?.tipo?.toLowerCase() || "";
      const modelo = item.equipamentos?.modelo?.toLowerCase() || "";
      const tag = item.equipamentos?.tag_placa?.toLowerCase() || "";
      const cNome = item.comodante_nome.toLowerCase();
      const tNome = item.comodataria_nome.toLowerCase();

      return tipo.includes(query) || modelo.includes(query) || tag.includes(query) || cNome.includes(query) || tNome.includes(query);
    });
  }, [comodatos, search]);

  const handleOpenAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: Comodato) => {
    setEditing(item);
    setForm({
      comodante_nome: item.comodante_nome,
      comodante_cnpj: item.comodante_cnpj,
      comodante_endereco: item.comodante_endereco,
      comodataria_nome: item.comodataria_nome,
      comodataria_cnpj: item.comodataria_cnpj,
      comodataria_endereco: item.comodataria_endereco,
      equipamento_id: item.equipamento_id,
      fabricante: item.fabricante,
      ano: item.ano,
      data_inicio: item.data_inicio,
      data_fim: item.data_fim || "",
      cidade: item.cidade,
      status: item.status
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipamento_id) {
      toast({ title: "Campo obrigatório", description: "Selecione o equipamento.", variant: "destructive" });
      return;
    }
    if (!form.fabricante || !form.ano) {
      toast({ title: "Campos obrigatórios", description: "Informe o fabricante e o ano do equipamento.", variant: "destructive" });
      return;
    }

    const payload = {
      comodante_nome: form.comodante_nome,
      comodante_cnpj: form.comodante_cnpj,
      comodante_endereco: form.comodante_endereco,
      comodataria_nome: form.comodataria_nome,
      comodataria_cnpj: form.comodataria_cnpj,
      comodataria_endereco: form.comodataria_endereco,
      equipamento_id: form.equipamento_id,
      fabricante: form.fabricante,
      ano: form.ano,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      cidade: form.cidade,
      status: form.status
    };

    try {
      if (editing) {
        const { error } = await supabase.from("comodatos").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Contrato de Comodato atualizado." });
      } else {
        const { error } = await supabase.from("comodatos").insert(payload);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Contrato de Comodato registrado." });
      }
      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este contrato de comodato?")) return;
    try {
      const { error } = await supabase.from("comodatos").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Contrato de Comodato removido." });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadPDF = async (item: Comodato) => {
    try {
      const eq = item.equipamentos || equipamentos.find(e => e.id === item.equipamento_id);
      if (!eq) throw new Error("Equipamento não encontrado.");
      await exportComodatoToPDF(item, eq);
      toast({ title: "PDF Gerado", description: "O contrato de comodato foi gerado e baixado." });
    } catch (err: any) {
      toast({ title: "Erro ao exportar PDF", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por equipamento, placa ou empresas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/60 rounded-xl"
          />
        </div>
        <Button onClick={handleOpenAdd} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl gap-2 w-full sm:w-auto font-bold uppercase tracking-wider text-xs py-2">
          <Plus className="h-4 w-4" />
          Registrar Comodato
        </Button>
      </div>

      {/* Comodatos Table */}
      <Card className="glass border-border/40 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground text-sm">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              Carregando contratos de comodato...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-sm">
              Nenhum contrato de comodato registrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Equipamento</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Fabricante/Modelo/Ano</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Comodante</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Comodatária</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Vigência</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => (
                    <TableRow key={item.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-bold text-xs text-foreground">
                        {item.equipamentos?.tipo || "Equipamento Desconhecido"} {item.equipamentos?.tag_placa ? `(${item.equipamentos.tag_placa})` : ""}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-semibold">
                        {item.fabricante} / {item.equipamentos?.modelo} / {item.ano}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground truncate max-w-[200px]" title={item.comodante_nome}>
                        {item.comodante_nome}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground truncate max-w-[200px]" title={item.comodataria_nome}>
                        {item.comodataria_nome}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        De {new Date(item.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")} 
                        {item.data_fim ? ` até ${new Date(item.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}` : " (Indeterminado)"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase py-0.5 px-2 border-0 text-white ${item.status === "Ativo" ? "bg-success" : "bg-destructive"}`}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 space-x-1 whitespace-nowrap">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleDownloadPDF(item)} title="Baixar Contrato de Comodato">
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-accent" onClick={() => handleOpenEdit(item)} title="Editar Comodato">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)} title="Excluir Comodato">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Register/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              {editing ? "Editar Contrato de Comodato" : "Registrar Contrato de Comodato"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados de empréstimo do equipamento e gere o documento legal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Seção Comodante */}
            <div className="p-3 bg-muted/20 border border-border/40 rounded-xl space-y-3">
              <p className="text-xs font-bold text-accent uppercase tracking-wider">Dados do Comodante (Lender / Proprietário)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Razão Social</Label>
                  <Input value={form.comodante_nome} onChange={e => setForm(p => ({ ...p, comodante_nome: e.target.value }))} className="bg-background text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">CNPJ</Label>
                  <Input value={form.comodante_cnpj} onChange={e => setForm(p => ({ ...p, comodante_cnpj: e.target.value }))} className="bg-background text-xs" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Endereço Completo</Label>
                  <Input value={form.comodante_endereco} onChange={e => setForm(p => ({ ...p, comodante_endereco: e.target.value }))} className="bg-background text-xs" />
                </div>
              </div>
            </div>

            {/* Seção Comodatária */}
            <div className="p-3 bg-muted/20 border border-border/40 rounded-xl space-y-3">
              <p className="text-xs font-bold text-accent uppercase tracking-wider">Dados do Comodatário (Borrower / Locadora)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Razão Social</Label>
                  <Input value={form.comodataria_nome} onChange={e => setForm(p => ({ ...p, comodataria_nome: e.target.value }))} className="bg-background text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">CNPJ</Label>
                  <Input value={form.comodataria_cnpj} onChange={e => setForm(p => ({ ...p, comodataria_cnpj: e.target.value }))} className="bg-background text-xs" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Endereço Completo</Label>
                  <Input value={form.comodataria_endereco} onChange={e => setForm(p => ({ ...p, comodataria_endereco: e.target.value }))} className="bg-background text-xs" />
                </div>
              </div>
            </div>

            {/* Seção Equipamento e Datas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Equipamento</Label>
                <Select value={form.equipamento_id} onValueChange={val => setForm(p => ({ ...p, equipamento_id: val }))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {equipamentos.map(eq => (
                      <SelectItem key={eq.id} value={eq.id}>{eq.tipo} {eq.modelo} ({eq.tag_placa || "S/P"})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Fabricante</Label>
                  <Input placeholder="Ex: John Deere" value={form.fabricante} onChange={e => setForm(p => ({ ...p, fabricante: e.target.value }))} className="bg-background" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Ano</Label>
                  <Input placeholder="Ex: 2021/2021" value={form.ano} onChange={e => setForm(p => ({ ...p, ano: e.target.value }))} className="bg-background" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Data de Início</Label>
                <Input type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} className="bg-background" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Data de Fim (Opcional)</Label>
                <Input type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} className="bg-background" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Cidade de Assinatura</Label>
                <Input value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} className="bg-background" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Status</Label>
                <Select value={form.status} onValueChange={val => setForm(p => ({ ...p, status: val }))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl">Salvar Comodato</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
