import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, Loader2, DollarSign, Wallet, Shield, Wifi, TrendingDown, HelpCircle, FileSpreadsheet, FileText } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

interface Equipamento {
  id: string;
  tipo: string;
  modelo: string;
  tag_placa: string | null;
  numero_serie: string | null;
}

interface CustoEquipamento {
  id: string;
  equipamento_id: string;
  descricao: string;
  valor: number;
  tipo: "Financiamento" | "Seguro Fixo" | "Rastreador" | "Depreciação" | "Outros";
  periodicidade: "Único" | "Mensal" | "Anual";
  data_vencimento: string | null;
  created_at?: string;
  equipamentos?: Equipamento | null;
}

const emptyForm: Omit<CustoEquipamento, "id"> = {
  equipamento_id: "",
  descricao: "",
  valor: 0,
  tipo: "Financiamento",
  periodicidade: "Mensal",
  data_vencimento: ""
};

export const CustosEquipamentoTab = () => {
  const [custos, setCustos] = useState<CustoEquipamento[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustoEquipamento | null>(null);
  const [form, setForm] = useState<Omit<CustoEquipamento, "id">>(emptyForm);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterEquipamento, setFilterEquipamento] = useState<string>("todos");
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [custosRes, eqRes] = await Promise.all([
        supabase.from("equipamentos_custos").select("*").order("created_at", { ascending: false }),
        supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo")
      ]);

      if (eqRes.data) {
        setEquipamentos(eqRes.data as Equipamento[]);
        
        if (custosRes.data) {
          const eqMap = new Map(eqRes.data.map(e => [e.id, e]));
          const mapped = custosRes.data.map((c: any) => ({
            ...c,
            equipamentos: eqMap.get(c.equipamento_id) || null
          }));
          setCustos(mapped as CustoEquipamento[]);
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar custos de equipamentos:", err.message);
      toast({ title: "Erro", description: "Falha ao carregar custos do banco de dados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredItems = useMemo(() => {
    return custos.filter(item => {
      const query = search.toLowerCase();
      const matchSearch =
        item.descricao.toLowerCase().includes(query) ||
        (item.equipamentos?.tipo || "").toLowerCase().includes(query) ||
        (item.equipamentos?.modelo || "").toLowerCase().includes(query) ||
        (item.equipamentos?.tag_placa || "").toLowerCase().includes(query);

      const matchTipo = filterTipo === "todos" || item.tipo === filterTipo;
      const matchEquip = filterEquipamento === "todos" || item.equipamento_id === filterEquipamento;

      return matchSearch && matchTipo && matchEquip;
    });
  }, [custos, search, filterTipo, filterEquipamento]);

  // Cálculos de KPI consolidando impacto mensal
  const kpis = useMemo(() => {
    let totalMensal = 0;
    let financiamentoMensal = 0;
    let seguroMensal = 0;
    let rastreadorMensal = 0;
    let outrosMensal = 0;

    custos.forEach(c => {
      const valor = Number(c.valor || 0);
      let impactoMensal = 0;
      
      if (c.periodicidade === "Mensal") {
        impactoMensal = valor;
      } else if (c.periodicidade === "Anual") {
        impactoMensal = valor / 12;
      } else if (c.periodicidade === "Único") {
        impactoMensal = 0;
      }

      totalMensal += impactoMensal;

      if (c.tipo === "Financiamento") financiamentoMensal += impactoMensal;
      else if (c.tipo === "Seguro Fixo") seguroMensal += impactoMensal;
      else if (c.tipo === "Rastreador") rastreadorMensal += impactoMensal;
      else outrosMensal += impactoMensal;
    });

    return {
      totalMensal,
      financiamentoMensal,
      seguroMensal,
      rastreadorMensal,
      outrosMensal
    };
  }, [custos]);

  const handleOpenAdd = () => {
    setEditing(null);
    setForm({
      equipamento_id: equipamentos[0]?.id || "",
      descricao: "",
      valor: 0,
      tipo: "Financiamento",
      periodicidade: "Mensal",
      data_vencimento: ""
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: CustoEquipamento) => {
    setEditing(item);
    setForm({
      equipamento_id: item.equipamento_id,
      descricao: item.descricao,
      valor: item.valor,
      tipo: item.tipo,
      periodicidade: item.periodicidade,
      data_vencimento: item.data_vencimento || ""
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.equipamento_id) {
      toast({ title: "Campo obrigatório", description: "Selecione o equipamento.", variant: "destructive" });
      return;
    }
    if (!form.descricao.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe a descrição do custo.", variant: "destructive" });
      return;
    }
    if (Number(form.valor) <= 0) {
      toast({ title: "Campo obrigatório", description: "Informe um valor maior que zero.", variant: "destructive" });
      return;
    }

    const payload = {
      equipamento_id: form.equipamento_id,
      descricao: form.descricao,
      valor: Number(form.valor),
      tipo: form.tipo,
      periodicidade: form.periodicidade,
      data_vencimento: form.data_vencimento || null
    };

    try {
      if (editing) {
        const { error } = await supabase.from("equipamentos_custos").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Custo atualizado com sucesso." });
      } else {
        const { error } = await supabase.from("equipamentos_custos").insert(payload);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Custo cadastrado com sucesso." });
      }
      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro de custo estrutural?")) return;
    try {
      const { error } = await supabase.from("equipamentos_custos").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Custo removido com sucesso." });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const formatCurrency = (v: number) => {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const getExportData = () => {
    const headers = ["Equipamento", "Descrição", "Tipo", "Periodicidade", "Valor (R$)", "Vencimento"];
    const rows = filteredItems.map(i => [
      `${i.equipamentos?.tipo || ""} ${i.equipamentos?.modelo || ""} (${i.equipamentos?.tag_placa || "Sem Placa"})`,
      i.descricao,
      i.tipo,
      i.periodicidade,
      formatCurrency(i.valor),
      i.data_vencimento ? new Date(i.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"
    ]);
    return { title: "Custos Estruturais de Equipamentos", headers, rows, filename: "custos_equipamentos" };
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "Financiamento": return <Wallet className="h-4 w-4 text-primary" />;
      case "Seguro Fixo": return <Shield className="h-4 w-4 text-success" />;
      case "Rastreador": return <Wifi className="h-4 w-4 text-info" />;
      default: return <TrendingDown className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "Financiamento": return "bg-primary/10 text-primary border-primary/20";
      case "Seguro Fixo": return "bg-success/10 text-success border-success/20";
      case "Rastreador": return "bg-info/10 text-info border-info/20";
      case "Depreciação": return "bg-warning/10 text-warning border-warning/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/10 shadow-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Impacto Fixo Mensal Geral</CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">{formatCurrency(kpis.totalMensal)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-foreground">
            Soma mensal de obrigações físicas + provisões
          </CardContent>
          <DollarSign className="absolute right-4 bottom-4 h-12 w-12 text-primary/10 pointer-events-none" />
        </Card>

        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parcelas e Financiamentos</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">{formatCurrency(kpis.financiamentoMensal)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-foreground">
            Leasings e CDC de frotas (/mês)
          </CardContent>
          <Wallet className="absolute right-4 bottom-4 h-10 w-10 text-primary/5 pointer-events-none" />
        </Card>

        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Seguros Patrimoniais</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">{formatCurrency(kpis.seguroMensal)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-foreground">
            Apólices estruturais fixas (/mês)
          </CardContent>
          <Shield className="absolute right-4 bottom-4 h-10 w-10 text-success/5 pointer-events-none" />
        </Card>

        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rastreadores / Telecom</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">{formatCurrency(kpis.rastreadorMensal)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-foreground">
            Monitores e telemetria (/mês)
          </CardContent>
          <Wifi className="absolute right-4 bottom-4 h-10 w-10 text-info/5 pointer-events-none" />
        </Card>
      </div>

      {/* Controls: Search, Filters, Add and Export */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent p-5 rounded-2xl border border-accent/20 shadow-sm backdrop-blur-md">
        <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou máquina..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/60"
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="bg-background border-border/60 text-xs w-full sm:w-36">
                <SelectValue placeholder="Tipo de Custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="Financiamento">Financiamento</SelectItem>
                <SelectItem value="Seguro Fixo">Seguro Fixo</SelectItem>
                <SelectItem value="Rastreador">Rastreador</SelectItem>
                <SelectItem value="Depreciação">Depreciação</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterEquipamento} onValueChange={setFilterEquipamento}>
              <SelectTrigger className="bg-background border-border/60 text-xs w-full sm:w-48">
                <SelectValue placeholder="Filtrar por Máquina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Máquinas</SelectItem>
                {equipamentos.map(eq => (
                  <SelectItem key={eq.id} value={eq.id}>{eq.tipo} {eq.modelo} ({eq.tag_placa || "S/P"})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToPDF(getExportData())} className="bg-background border-border/60">
              <FileText className="h-4 w-4 mr-2 text-destructive" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(getExportData())} className="bg-background border-border/60">
              <FileSpreadsheet className="h-4 w-4 mr-2 text-success" /> Excel
            </Button>
          </div>
          <Button onClick={handleOpenAdd} className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold uppercase tracking-wider text-xs rounded-xl py-2">
            <Plus className="h-4 w-4 mr-2" /> Registrar Custo
          </Button>
        </div>
      </div>

      {/* Cost List */}
      <Card className="glass border-border/40 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground text-sm">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              Carregando lançamentos de custos...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-sm">
              Nenhum custo estrutural encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Equipamento</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Descrição do Custo</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Tipo</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Periodicidade</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Valor</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Vencimento</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => (
                    <TableRow key={item.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-bold text-xs text-foreground">
                        {item.equipamentos?.tipo || "Desconhecido"} {item.equipamentos?.modelo || ""}
                        {item.equipamentos?.tag_placa ? (
                          <Badge variant="secondary" className="ml-2 font-normal text-[9px] py-0 px-1.5 bg-accent/5 text-accent border-accent/10">
                            {item.equipamentos.tag_placa}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {item.descricao}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className={`text-[9px] font-bold uppercase py-0.5 px-2 flex items-center gap-1 w-fit ${getTipoColor(item.tipo)}`}>
                          {getTipoIcon(item.tipo)}
                          {item.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground">
                        {item.periodicidade}
                      </TableCell>
                      <TableCell className="text-right text-xs font-black text-foreground">
                        {formatCurrency(item.valor)}
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold text-muted-foreground">
                        {item.data_vencimento ? new Date(item.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right pr-6 space-x-1 whitespace-nowrap">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-accent" onClick={() => handleOpenEdit(item)} title="Editar Custo">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)} title="Remover Custo">
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

      {/* Dialog for Register/Edit Cost */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-accent" />
              {editing ? "Editar Custo Estrutural" : "Registrar Custo Estrutural"}
            </DialogTitle>
            <DialogDescription>
              Defina os custos operacionais internos de aquisição, seguro ou rastreamento da máquina.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Equipamento</Label>
              <Select value={form.equipamento_id} onValueChange={val => setForm(p => ({ ...p, equipamento_id: val }))}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione o Equipamento..." />
                </SelectTrigger>
                <SelectContent>
                  {equipamentos.map(eq => (
                    <SelectItem key={eq.id} value={eq.id}>{eq.tipo} {eq.modelo} ({eq.tag_placa || "Sem Placa"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Descrição do Gasto</Label>
              <Input placeholder="Ex: Parcela do Consórcio CAT" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} className="bg-background" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Valor do Custo (R$)</Label>
                <CurrencyInput value={form.valor} onValueChange={v => setForm(p => ({ ...p, valor: v }))} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Periodicidade</Label>
                <Select value={form.periodicidade} onValueChange={val => setForm(p => ({ ...p, periodicidade: val as any }))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Único">Único / Avulso</SelectItem>
                    <SelectItem value="Mensal">Mensal (Recorrente)</SelectItem>
                    <SelectItem value="Anual">Anual (Taxa Frequente)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Tipo de Custo</Label>
                <Select value={form.tipo} onValueChange={val => setForm(p => ({ ...p, tipo: val as any }))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Financiamento">Financiamento / Parcela</SelectItem>
                    <SelectItem value="Seguro Fixo">Seguro Fixo</SelectItem>
                    <SelectItem value="Rastreador">Aluguel Rastreador</SelectItem>
                    <SelectItem value="Depreciação">Provisão Depreciação</SelectItem>
                    <SelectItem value="Outros">Outros Encargos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Data de Vencimento</Label>
                <Input type="date" value={form.data_vencimento || ""} onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} className="bg-background text-xs" />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl font-bold">Salvar Lançamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
