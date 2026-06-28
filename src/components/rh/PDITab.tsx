import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Target, Plus, Pencil, Trash2, Loader2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Funcionario } from "@/pages/RecursosHumanos";
import { Textarea } from "@/components/ui/textarea";

export interface PDI {
  id: string;
  funcionario_id: string;
  data_criacao: string;
  meta: string;
  prazo: string | null;
  o_que_fazer: string | null;
  status: 'Aberto' | 'Em Andamento' | 'Concluído';
  criado_por: string | null;
  funcionarios?: { nome: string };
}

interface Props {
  funcionarios: Funcionario[];
}

export function PDITab({ funcionarios }: Props) {
  const { toast } = useToast();
  const [pdis, setPdis] = useState<PDI[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState<Partial<PDI>>({
    status: 'Aberto',
    data_criacao: new Date().toISOString().split('T')[0]
  });

  const fetchPdis = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pdis')
        .select(`
          *,
          funcionarios:funcionario_id (nome)
        `)
        .order('data_criacao', { ascending: false });
      
      if (error) throw error;
      setPdis(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar PDIs", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdis();
  }, []);

  const handleOpenSheet = (pdi?: PDI) => {
    if (pdi) {
      setFormData(pdi);
      setIsEditing(true);
    } else {
      setFormData({ 
        status: 'Aberto',
        data_criacao: new Date().toISOString().split('T')[0]
      });
      setIsEditing(false);
    }
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!formData.funcionario_id || !formData.meta) {
      toast({ title: "Campos obrigatórios", description: "Selecione o funcionário e preencha a meta.", variant: "destructive" });
      return;
    }

    try {
      if (isEditing && formData.id) {
        const { error } = await supabase
          .from('pdis')
          .update({
            funcionario_id: formData.funcionario_id,
            data_criacao: formData.data_criacao,
            meta: formData.meta,
            prazo: formData.prazo,
            o_que_fazer: formData.o_que_fazer,
            status: formData.status,
            criado_por: formData.criado_por,
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.id);
        
        if (error) throw error;
        toast({ title: "PDI atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from('pdis')
          .insert([{
            funcionario_id: formData.funcionario_id,
            data_criacao: formData.data_criacao,
            meta: formData.meta,
            prazo: formData.prazo,
            o_que_fazer: formData.o_que_fazer,
            status: formData.status,
            criado_por: formData.criado_por
          }]);
        
        if (error) throw error;
        toast({ title: "PDI criado com sucesso" });
      }
      
      setIsSheetOpen(false);
      fetchPdis();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este PDI?")) return;
    try {
      const { error } = await supabase.from('pdis').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "PDI excluído" });
      fetchPdis();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const getStatusVariant = (status: string) => {
    switch(status) {
      case 'Aberto': return 'secondary';
      case 'Em Andamento': return 'default';
      case 'Concluído': return 'success';
      default: return 'outline';
    }
  };

  return (
    <Card className="glass shadow-sm border-border/40">
      <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4">
        <div>
          <CardTitle className="text-lg">Plano de Desenvolvimento Individual (PDI)</CardTitle>
          <CardDescription>Acompanhamento de metas e evolução da equipe</CardDescription>
        </div>
        <Button onClick={() => handleOpenSheet()} className="shrink-0 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Novo PDI
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border/50 bg-background/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Funcionário</TableHead>
                <TableHead>Meta / Foco</TableHead>
                <TableHead>Prazo Final</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : pdis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum PDI cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                pdis.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{p.funcionarios?.nome || 'Desconhecido'}</TableCell>
                    <TableCell>
                      <span className="line-clamp-1 max-w-[300px]">{p.meta}</span>
                    </TableCell>
                    <TableCell>
                      {p.prazo ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(new Date(p.prazo), 'dd/MM/yyyy')}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(p.status) as any} className="font-normal">
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenSheet(p)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto border-l-border/40 bg-background/95 backdrop-blur-xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {isEditing ? "Editar PDI" : "Novo Plano de Desenvolvimento"}
            </SheetTitle>
            <SheetDescription>
              Defina o objetivo e as ações necessárias para o desenvolvimento.
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Funcionário *</Label>
              <Select 
                value={formData.funcionario_id} 
                onValueChange={(v) => setFormData({...formData, funcionario_id: v})}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funcionário..." />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.filter(f => f.status === 'Ativo').map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome} - {f.cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Criação</Label>
                <Input
                  type="date"
                  value={formData.data_criacao || ""}
                  onChange={(e) => setFormData({...formData, data_criacao: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Prazo Final Previsto</Label>
                <Input
                  type="date"
                  value={formData.prazo || ""}
                  onChange={(e) => setFormData({...formData, prazo: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Meta ou Foco de Desenvolvimento *</Label>
              <Input
                value={formData.meta || ""}
                onChange={(e) => setFormData({...formData, meta: e.target.value})}
                placeholder="Ex: Melhorar habilidade em liderança técnica"
              />
            </div>

            <div className="space-y-2">
              <Label>O que fazer? (Plano de Ação)</Label>
              <Textarea
                value={formData.o_que_fazer || ""}
                onChange={(e) => setFormData({...formData, o_que_fazer: e.target.value})}
                placeholder="Ex: Fazer o curso X, liderar o projeto Y, ler o livro Z..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v: any) => setFormData({...formData, status: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aberto">Aberto</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Criado por (Mentor/Gestor)</Label>
              <Input
                value={formData.criado_por || ""}
                onChange={(e) => setFormData({...formData, criado_por: e.target.value})}
                placeholder="Quem está conduzindo este PDI"
              />
            </div>
          </div>
          
          <SheetFooter className="mt-8">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar PDI
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
