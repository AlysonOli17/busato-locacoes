import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ArrowDownRight, Building, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const DreTab = () => {
  const [despesas, setDespesas] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [receitaTotal, setReceitaTotal] = useState(0);
  const [custosFrota, setCustosFrota] = useState(0);
  
  const [dialogDespesaOpen, setDialogDespesaOpen] = useState(false);
  const [dialogCentroOpen, setDialogCentroOpen] = useState(false);
  const [editDespesaId, setEditDespesaId] = useState<string | null>(null);
  const [editCentroId, setEditCentroId] = useState<string | null>(null);
  
  const [formDespesa, setFormDespesa] = useState({
    centro_custos_id: "", descricao: "", categoria: "Administrativo", valor: "0", data_vencimento: "", status: "Pendente"
  });
  
  const [formCentro, setFormCentro] = useState({
    codigo: "", nome: "", tipo: "Administrativo"
  });

  const { toast } = useToast();

  const fetchData = async () => {
    const [despRes, centrosRes, fatRes, gastosRes] = await Promise.all([
      supabase.from("despesas_administrativas").select("*, centro_custos(*)").order("data_vencimento", { ascending: false }),
      supabase.from("centro_custos").select("*").order("nome"),
      supabase.from("faturamento").select("valor_total").eq("status", "Emitida"),
      supabase.from("gastos").select("valor")
    ]);

    if (despRes.data) setDespesas(despRes.data);
    if (centrosRes.data) setCentros(centrosRes.data);
    
    if (fatRes.data) {
      const rt = fatRes.data.reduce((acc, curr) => acc + Number(curr.valor_total), 0);
      setReceitaTotal(rt);
    }
    
    if (gastosRes.data) {
      const cf = gastosRes.data.reduce((acc, curr) => acc + Number(curr.valor), 0);
      setCustosFrota(cf);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor), 0);
  const resultadoLiquido = receitaTotal - custosFrota - totalDespesas;

  const handleDeleteCentro = async (id: string) => {
    const { error } = await supabase.from("centro_custos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: "Não é possível excluir um centro de custo que possui despesas vinculadas.", variant: "destructive" }); return; }
    toast({ title: "Sucesso", description: "Centro de custos excluído." });
    fetchData();
  };

  const handleSaveCentro = async () => {
    if (!formCentro.codigo || !formCentro.nome) {
      toast({ title: "Atenção", description: "Por favor, preencha o Código e o Nome do Centro de Custo.", variant: "destructive" });
      return;
    }
    if (editCentroId) {
      const { error } = await supabase.from("centro_custos").update({
        codigo: formCentro.codigo,
        nome: formCentro.nome,
        tipo: formCentro.tipo
      }).eq("id", editCentroId);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Sucesso", description: "Centro de custos atualizado." });
    } else {
      const { error } = await supabase.from("centro_custos").insert({
        id: crypto.randomUUID(),
        ...formCentro
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Sucesso", description: "Centro de custos salvo." });
    }
    setFormCentro({ codigo: "", nome: "", tipo: "Administrativo" });
    setEditCentroId(null);
    fetchData();
  };

  const handleEditCentro = (c: any) => {
    setFormCentro({ codigo: c.codigo, nome: c.nome, tipo: c.tipo });
    setEditCentroId(c.id);
  };

  const handleSaveDespesa = async () => {
    if (!formDespesa.centro_custos_id || !formDespesa.descricao || !formDespesa.data_vencimento) {
      toast({ title: "Atenção", description: "Por favor, preencha o Centro de Custo, a Descrição e o Vencimento.", variant: "destructive" });
      return;
    }
    
    const payload = {
      centro_custos_id: formDespesa.centro_custos_id,
      descricao: formDespesa.descricao,
      categoria: formDespesa.categoria,
      valor: parseFloat(formDespesa.valor as string),
      data_vencimento: formDespesa.data_vencimento,
      status: formDespesa.status
    };

    if (editDespesaId) {
      const { error } = await supabase.from("despesas_administrativas").update(payload).eq("id", editDespesaId);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Sucesso", description: "Despesa atualizada." });
    } else {
      const { error } = await supabase.from("despesas_administrativas").insert({ id: crypto.randomUUID(), ...payload });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Sucesso", description: "Despesa lançada." });
    }
    
    setFormDespesa({ centro_custos_id: "", descricao: "", categoria: "Administrativo", valor: "0", data_vencimento: "", status: "Pendente" });
    setEditDespesaId(null);
    setDialogDespesaOpen(false);
    fetchData();
  };

  const handleEditDespesa = (d: any) => {
    setFormDespesa({
      centro_custos_id: d.centro_custos_id,
      descricao: d.descricao,
      categoria: d.categoria,
      valor: String(d.valor),
      data_vencimento: d.data_vencimento,
      status: d.status
    });
    setEditDespesaId(d.id);
    setDialogDespesaOpen(true);
  };

  const handleDeleteDespesa = async (id: string) => {
    const { error } = await supabase.from("despesas_administrativas").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sucesso", description: "Despesa excluída." });
    fetchData();
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Pago" ? "Pendente" : "Pago";
    const { error } = await supabase.from("despesas_administrativas").update({ status: newStatus }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sucesso", description: `Despesa marcada como ${newStatus}.` });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-4">
        <Dialog open={dialogDespesaOpen} onOpenChange={(open) => {
          if (!open) {
            setFormDespesa({ centro_custos_id: "", descricao: "", categoria: "Administrativo", valor: "0", data_vencimento: "", status: "Pendente" });
            setEditDespesaId(null);
          }
          setDialogDespesaOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => {
              setFormDespesa({ centro_custos_id: "", descricao: "", categoria: "Administrativo", valor: "0", data_vencimento: "", status: "Pendente" });
              setEditDespesaId(null);
            }}>
              <ArrowDownRight className="w-4 h-4 mr-2" /> Lançar Despesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editDespesaId ? "Editar Despesa" : "Lançar Despesa (Controladoria)"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Centro de Custo</Label>
                <Select value={formDespesa.centro_custos_id} onValueChange={(v) => setFormDespesa({...formDespesa, centro_custos_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {centros.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Descrição da Despesa</Label>
                <Input placeholder="Ex: Conta de Luz Filial Matriz" value={formDespesa.descricao} onChange={e => setFormDespesa({...formDespesa, descricao: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Valor (R$)</Label>
                  <CurrencyInput value={Number(formDespesa.valor) || 0} onValueChange={(v) => setFormDespesa({...formDespesa, valor: String(v)})} />
                </div>
                <div className="grid gap-2">
                  <Label>Vencimento</Label>
                  <Input type="date" value={formDespesa.data_vencimento} onChange={e => setFormDespesa({...formDespesa, data_vencimento: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Status do Pagamento</Label>
                <Select value={formDespesa.status} onValueChange={(v) => setFormDespesa({...formDespesa, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogDespesaOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveDespesa}>Salvar Despesa</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogCentroOpen} onOpenChange={(open) => {
          if (!open) {
            setFormCentro({ codigo: "", nome: "", tipo: "Administrativo" });
            setEditCentroId(null);
          }
          setDialogCentroOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={() => {
              setFormCentro({ codigo: "", nome: "", tipo: "Administrativo" });
              setEditCentroId(null);
            }}>
              <Building className="w-4 h-4 mr-2" /> Gerenciar Centros de Custo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Gestão de Centros de Custos</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="border rounded-md p-4 bg-muted/20">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-sm">{editCentroId ? "Editar Centro" : "Cadastrar Novo"}</h4>
                  {editCentroId && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditCentroId(null); setFormCentro({ codigo: "", nome: "", tipo: "Administrativo" }); }}>Cancelar Edição</Button>
                  )}
                </div>
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-3 grid gap-2">
                    <Label className="text-xs">Código</Label>
                    <Input className="h-8 text-sm" placeholder="Ex: ADM-01" value={formCentro.codigo} onChange={e => setFormCentro({...formCentro, codigo: e.target.value})} />
                  </div>
                  <div className="col-span-3 grid gap-2">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={formCentro.tipo} onValueChange={(v) => setFormCentro({...formCentro, tipo: v})}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Administrativo">Admin</SelectItem>
                        <SelectItem value="Operacional">Opera</SelectItem>
                        <SelectItem value="Comercial">Comerc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 grid gap-2">
                    <Label className="text-xs">Nome</Label>
                    <Input className="h-8 text-sm" placeholder="Ex: Sede" value={formCentro.nome} onChange={e => setFormCentro({...formCentro, nome: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <Button className="h-8 w-full text-xs" onClick={handleSaveCentro}>Salvar</Button>
                  </div>
                </div>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {centros.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-xs">{c.codigo}</TableCell>
                        <TableCell className="text-xs">{c.nome}</TableCell>
                        <TableCell className="text-xs"><Badge variant="secondary">{c.tipo}</Badge></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditCentro(c)} className="h-6 w-6 text-muted-foreground hover:text-primary">
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCentro(c.id)} className="h-6 w-6 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {centros.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">Nenhum centro cadastrado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Receita Bruta (Locação)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{receitaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Custos (Manutenção Frota)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">-{custosFrota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Despesas Administrativas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-rose-600">-{totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}</div></CardContent>
        </Card>
        <Card className={`border-l-4 ${resultadoLiquido >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">EBITDA / Resultado Líquido</CardTitle></CardHeader>
          <CardContent><div className={`text-2xl font-bold ${resultadoLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{resultadoLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Lançamentos de Controladoria</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Centro de Custo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {despesas.map(d => (
                <TableRow key={d.id}>
                  <TableCell>{new Date(d.data_vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</TableCell>
                  <TableCell className="font-medium">{d.centro_custos?.codigo}</TableCell>
                  <TableCell>{d.descricao}</TableCell>
                  <TableCell><Badge variant="outline">{d.categoria}</Badge></TableCell>
                  <TableCell className="text-right text-rose-600 font-mono font-medium">-{Number(d.valor).toLocaleString('pt-BR', {style: 'currency', currency:'BRL'})}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`cursor-pointer transition-colors ${d.status === 'Pago' ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800' : 'bg-amber-100 hover:bg-amber-200 text-amber-800'}`} onClick={() => handleToggleStatus(d.id, d.status)}>
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditDespesa(d)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDespesa(d.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {despesas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum lançamento encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};