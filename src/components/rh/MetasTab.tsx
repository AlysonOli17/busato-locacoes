import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { TrendingUp, Plus, Pencil, Trash2, Loader2, Calendar, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Funcionario } from "@/pages/RecursosHumanos";
import { Textarea } from "@/components/ui/textarea";

export interface MetaEstrategica {
  id: string;
  titulo: string;
  descricao: string | null;
  setor: string;
  responsavel_id: string | null;
  prazo: string;
  progresso: number;
  status: 'Pendente' | 'Em Andamento' | 'Concluído' | 'Atrasado';
  criado_por: string | null;
  funcionarios?: { nome: string };
}

interface Props {
  funcionarios: Funcionario[];
}

export function MetasTab({ funcionarios }: Props) {
  const { toast } = useToast();
  const [metas, setMetas] = useState<MetaEstrategica[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState<Partial<MetaEstrategica>>({
    status: 'Pendente',
    progresso: 0
  });

  const fetchMetas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('metas_estrategicas')
        .select(`
          *,
          funcionarios:responsavel_id (nome)
        `)
        .order('prazo', { ascending: true });
      
      if (error) throw error;
      setMetas(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar metas", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetas();
  }, []);

  const handleOpenSheet = (meta?: MetaEstrategica) => {
    if (meta) {
      setFormData(meta);
      setIsEditing(true);
    } else {
      setFormData({ 
        status: 'Pendente',
        progresso: 0,
        setor: 'Geral'
      });
      setIsEditing(false);
    }
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!formData.titulo || !formData.prazo || !formData.setor) {
      toast({ title: "Campos obrigatórios", description: "Preencha título, prazo e setor.", variant: "destructive" });
      return;
    }

    try {
      if (isEditing && formData.id) {
        const { error } = await supabase
          .from('metas_estrategicas')
          .update({
            titulo: formData.titulo,
            descricao: formData.descricao,
            setor: formData.setor,
            responsavel_id: formData.responsavel_id,
            prazo: formData.prazo,
            progresso: formData.progresso,
            status: formData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.id);
        
        if (error) throw error;
        toast({ title: "Meta atualizada com sucesso" });
      } else {
        const { error } = await supabase
          .from('metas_estrategicas')
          .insert([{
            titulo: formData.titulo,
            descricao: formData.descricao,
            setor: formData.setor,
            responsavel_id: formData.responsavel_id,
            prazo: formData.prazo,
            progresso: formData.progresso,
            status: formData.status
          }]);
        
        if (error) throw error;
        toast({ title: "Meta criada com sucesso" });
      }
      
      setIsSheetOpen(false);
      fetchMetas();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta meta?")) return;
    try {
      const { error } = await supabase.from('metas_estrategicas').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Meta excluída" });
      fetchMetas();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const getStatusVariant = (status: string) => {
    switch(status) {
      case 'Pendente': return 'secondary';
      case 'Em Andamento': return 'default';
      case 'Concluído': return 'success';
      case 'Atrasado': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-background/50 p-4 rounded-lg border border-border/40">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Metas e OKRs
          </h2>
          <p className="text-muted-foreground text-sm">Acompanhe os objetivos estratégicos da empresa</p>
        </div>
        <Button onClick={() => handleOpenSheet()} className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Nova Meta
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : metas.length === 0 ? (
        <div className="text-center p-12 bg-background/50 rounded-lg border border-border/40">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Nenhuma meta estratégica cadastrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metas.map(meta => (
            <Card key={meta.id} className="glass shadow-sm border-border/40 flex flex-col transition-all hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <Badge variant="outline" className="bg-background font-medium mb-1">
                    {meta.setor}
                  </Badge>
                  <Badge variant={getStatusVariant(meta.status) as any} className="font-normal">
                    {meta.status}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-2 line-clamp-2 leading-tight">
                  {meta.titulo}
                </CardTitle>
                {meta.descricao && (
                  <CardDescription className="line-clamp-2 text-xs mt-1">
                    {meta.descricao}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end pt-0">
                <div className="mt-4">
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Progresso</span>
                    <span className="text-sm font-bold">{meta.progresso}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        meta.status === 'Atrasado' ? 'bg-destructive' : 
                        meta.status === 'Concluído' ? 'bg-success' : 'bg-primary'
                      }`}
                      style={{ width: `${meta.progresso}%` }}
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border/40">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Responsável</span>
                    <span className="text-sm font-medium line-clamp-1">{meta.funcionarios?.nome || 'Não definido'}</span>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Prazo</span>
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(new Date(meta.prazo), 'dd/MM/yyyy')}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="secondary" size="sm" className="w-full text-xs" onClick={() => handleOpenSheet(meta)}>
                    <Pencil className="h-3 w-3 mr-2" /> Editar Meta
                  </Button>
                  <Button variant="outline" size="sm" className="px-2 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(meta.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto border-l-border/40 bg-background/95 backdrop-blur-xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {isEditing ? "Editar Meta Estratégica" : "Nova Meta Estratégica"}
            </SheetTitle>
            <SheetDescription>
              Defina o objetivo, prazo e o responsável pelo projeto.
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título da Meta *</Label>
              <Input
                value={formData.titulo || ""}
                onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                placeholder="Ex: Reduzir tempo de manutenção em 15%"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição (Opcional)</Label>
              <Textarea
                value={formData.descricao || ""}
                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                placeholder="Detalhes adicionais sobre como a meta será atingida..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Setor *</Label>
                <Input
                  value={formData.setor || ""}
                  onChange={(e) => setFormData({...formData, setor: e.target.value})}
                  placeholder="Ex: Operações, Frota..."
                />
              </div>
              <div className="space-y-2">
                <Label>Prazo Limite *</Label>
                <Input
                  type="date"
                  value={formData.prazo || ""}
                  onChange={(e) => setFormData({...formData, prazo: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Funcionário Responsável (Líder)</Label>
              <Select 
                value={formData.responsavel_id || "none"} 
                onValueChange={(v) => setFormData({...formData, responsavel_id: v === "none" ? null : v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funcionário..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum / Setor inteiro</SelectItem>
                  {funcionarios.filter(f => f.status === 'Ativo').map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome} - {f.cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/40 mt-4">
              <Label className="flex justify-between">
                <span>Progresso Atual (%)</span>
                <span className="font-bold text-primary">{formData.progresso || 0}%</span>
              </Label>
              <Input
                type="range"
                min="0"
                max="100"
                step="5"
                value={formData.progresso || 0}
                onChange={(e) => setFormData({...formData, progresso: parseInt(e.target.value)})}
                className="w-full"
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
                  <SelectItem value="Pendente">Pendente (Não Iniciado)</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                  <SelectItem value="Atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <SheetFooter className="mt-8">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Meta
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
