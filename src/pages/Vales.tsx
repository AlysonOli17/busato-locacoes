import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Receipt, Pencil, Trash2, FileText, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ValeFormDialog } from "@/components/vales/ValeFormDialog";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseLocalDate } from "@/lib/utils";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
}

interface Vale {
  id: string;
  empresa_id: string;
  numero_rf: string;
  valor: number;
  data: string;
  status: string;
  observacoes: string | null;
  empresas?: Empresa;
}

export default function Vales() {
  const [vales, setVales] = useState<Vale[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingVale, setEditingVale] = useState<Vale | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const fetchData = async () => {
    setLoading(true);
    const [valesRes, empresasRes] = await Promise.all([
      supabase.from("vales").select("*, empresas(id, nome, cnpj)").order("created_at", { ascending: false }),
      supabase.from("empresas").select("id, nome, cnpj").order("nome")
    ]);

    if (valesRes.data) {
      setVales(valesRes.data as unknown as Vale[]);
    }
    if (empresasRes.data) {
      setEmpresas(empresasRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (data: any) => {
    setIsSaving(true);
    try {
      if (editingVale) {
        const { error } = await supabase.from("vales").update(data).eq("id", editingVale.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Vale atualizado com sucesso." });
      } else {
        const { error } = await supabase.from("vales").insert([data]);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Vale criado com sucesso." });
      }
      setFormOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("vales").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Vale excluído com sucesso." });
      fetchData();
    }
  };

  const handleGerarFatura = async (vale: Vale) => {
    try {
      // Create a Faturamento record from this Vale
      const [mes, ano] = vale.data.split("-").slice(1);
      const periodo = `${mes}/${ano}`;
      
      const novaFatura = {
        id: crypto.randomUUID(),
        empresa_faturamento_id: vale.empresa_id,
        vale_id: vale.id,
        emissao: new Date().toISOString().split("T")[0],
        periodo: periodo,
        valor_total: vale.valor,
        status: "Aprovado",
        horas_normais: 0,
        horas_excedentes: 0,
        valor_hora: 0,
        valor_excedente_hora: 0,
        numero_sequencial: Date.now() % 1000000,
        observacoes: `Fatura gerada a partir do Vale RF: ${vale.numero_rf}`
      };

      const { data: inserted, error: fatError } = await supabase.from("faturamento").insert([novaFatura]).select().single();
      if (fatError) throw fatError;

      // Update Vale status to Faturado
      const { error: updError } = await supabase.from("vales").update({ status: "Faturado" }).eq("id", vale.id);
      if (updError) throw updError;

      toast({ title: "Fatura Gerada", description: "Fatura gerada com sucesso e vale atualizado." });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao gerar fatura", description: error.message, variant: "destructive" });
    }
  };

  const filteredVales = vales.filter(v => {
    const matchesSearch = v.numero_rf.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.empresas?.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Receipt className="h-6 w-6" />
            <h1 className="text-2xl font-bold tracking-tight">Vales</h1>
          </div>
          <Button onClick={() => { setEditingVale(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Vale
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por Empresa ou RF..." 
                  className="pl-9"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Faturado">Faturado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número de RF</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">Carregando...</TableCell>
                    </TableRow>
                  ) : filteredVales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Nenhum vale encontrado.</TableCell>
                    </TableRow>
                  ) : (
                    filteredVales.map((vale) => (
                      <TableRow key={vale.id}>
                        <TableCell className="font-medium">{vale.numero_rf}</TableCell>
                        <TableCell>{vale.empresas?.nome}</TableCell>
                        <TableCell>{new Date(parseLocalDate(vale.data)).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(vale.valor)}</TableCell>
                        <TableCell>
                          <Badge variant={vale.status === "Faturado" ? "default" : "secondary"}>
                            {vale.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {vale.status === "Pendente" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleGerarFatura(vale)} title="Gerar Fatura">
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setEditingVale(vale); setFormOpen(true); }}>
                                  <Pencil className="h-4 w-4 text-blue-500" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost">
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir Vale</AlertDialogTitle>
                                      <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(vale.id)}>Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                            {vale.status === "Faturado" && (
                              <>
                                <Button size="sm" variant="outline" asChild title="Ver no Faturamento">
                                  <a href="/faturamento">
                                    <ExternalLink className="h-4 w-4 text-green-600" />
                                  </a>
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost">
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir Vale Faturado</AlertDialogTitle>
                                      <AlertDialogDescription>Este vale já possui uma fatura. Ao excluí-lo, a fatura vinculada perderá o vínculo. Tem certeza?</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(vale.id)}>Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ValeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        empresas={empresas}
        initialData={editingVale}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </Layout>
  );
}
