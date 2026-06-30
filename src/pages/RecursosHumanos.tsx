import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Users, Plus, Pencil, Trash2, Search, Target, Grid, Brain, Loader2, TrendingUp, ClipboardList, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { NineBoxTab } from "@/components/rh/NineBoxTab";
import { PDITab } from "@/components/rh/PDITab";
import { ComportamentalTab } from "@/components/rh/ComportamentalTab";
import { MetasTab } from "@/components/rh/MetasTab";
import { FitCulturalTab } from "@/components/rh/FitCulturalTab";
import { ExperienciaTab } from "@/components/rh/ExperienciaTab";

export interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  setor: string | null;
  departamento: string | null;
  data_admissao: string | null;
  email: string | null;
  telefone: string | null;
  status: string;
}

export default function RecursosHumanos() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Funcionario>>({
    status: 'Ativo'
  });

  const fetchFuncionarios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('funcionarios')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      setFuncionarios(data || []);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao carregar funcionários",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFuncionarios();
  }, []);

  const handleOpenSheet = (funcionario?: Funcionario) => {
    if (funcionario) {
      setFormData(funcionario);
      setIsEditing(true);
    } else {
      setFormData({ status: 'Ativo' });
      setIsEditing(false);
    }
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.cargo) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e cargo são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (isEditing && formData.id) {
        const { error } = await supabase
          .from('funcionarios')
          .update({
            nome: formData.nome,
            cargo: formData.cargo,
            setor: formData.setor,
            departamento: formData.departamento,
            data_admissao: formData.data_admissao,
            email: formData.email,
            telefone: formData.telefone,
            status: formData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.id);
        
        if (error) throw error;
        toast({ title: "Funcionário atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from('funcionarios')
          .insert([{
            nome: formData.nome,
            cargo: formData.cargo,
            setor: formData.setor,
            departamento: formData.departamento,
            data_admissao: formData.data_admissao,
            email: formData.email,
            telefone: formData.telefone,
            status: formData.status || 'Ativo'
          }]);
        
        if (error) throw error;
        toast({ title: "Funcionário cadastrado com sucesso" });
      }
      
      setIsSheetOpen(false);
      fetchFuncionarios();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este funcionário?")) return;
    try {
      const { error } = await supabase.from('funcionarios').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Funcionário excluído" });
      fetchFuncionarios();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const filteredFuncionarios = funcionarios.filter(f => 
    f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.cargo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.setor && f.setor.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-1 p-6 lg:p-8 pt-6 pb-20 md:pb-8 lg:pb-8 h-screen overflow-y-auto w-full bg-background/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Recursos Humanos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão de Equipe, DHO e Avaliações de Desempenho
          </p>
        </div>
      </div>

      <Tabs defaultValue="cadastro" className="w-full">
        <TabsList className="mb-4 bg-card border border-border/40 w-full justify-start h-auto p-1 flex-wrap">
          <TabsTrigger value="cadastro" className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Users className="h-4 w-4" /> Cadastro de Equipe
          </TabsTrigger>
          <TabsTrigger value="9box" className="flex items-center gap-2">
            <Grid className="h-4 w-4" /> Avaliação 9 Box
          </TabsTrigger>
          <TabsTrigger value="pdi" className="flex items-center gap-2">
            <Target className="h-4 w-4" /> PDI
          </TabsTrigger>
          <TabsTrigger value="experiencia" className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Experiência
          </TabsTrigger>
          <TabsTrigger value="comportamental" className="flex items-center gap-2">
            <Brain className="h-4 w-4" /> Comportamental
          </TabsTrigger>
          <TabsTrigger value="metas" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Estratégia e Metas
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Fit Cultural
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cadastro" className="space-y-4">
          <Card className="glass shadow-sm border-border/40">
            <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4">
              <div>
                <CardTitle className="text-lg">Gestão de Funcionários</CardTitle>
                <CardDescription>Cadastre e gerencie os dados da sua equipe</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nome, cargo ou setor..."
                    className="pl-8 bg-background/50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button onClick={() => handleOpenSheet()} className="shrink-0 shadow-sm">
                  <Plus className="h-4 w-4 mr-2" /> Novo Funcionário
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border/50 bg-background/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Admissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground mt-2 text-sm">Carregando equipe...</p>
                        </TableCell>
                      </TableRow>
                    ) : filteredFuncionarios.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum funcionário encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFuncionarios.map((f) => (
                        <TableRow key={f.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium">{f.nome}</TableCell>
                          <TableCell>{f.cargo}</TableCell>
                          <TableCell>{f.setor || '-'}</TableCell>
                          <TableCell>{f.data_admissao ? format(new Date(f.data_admissao), 'dd/MM/yyyy') : '-'}</TableCell>
                          <TableCell>
                            <Badge variant={f.status === 'Ativo' ? "success" : "destructive"} className="font-normal">
                              {f.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => navigate(`/rh/dossie/${f.id}`)}>
                                <Search className="h-4 w-4 mr-2" /> Dossiê
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleOpenSheet(f)}>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
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
          </Card>
        </TabsContent>

        <TabsContent value="9box">
          <NineBoxTab funcionarios={funcionarios} />
        </TabsContent>

        <TabsContent value="pdi">
          <PDITab funcionarios={funcionarios} />
        </TabsContent>

        <TabsContent value="experiencia">
          <ExperienciaTab funcionarios={funcionarios} />
        </TabsContent>

        <TabsContent value="comportamental">
          <ComportamentalTab funcionarios={funcionarios} />
        </TabsContent>

        <TabsContent value="metas">
          <MetasTab funcionarios={funcionarios} />
        </TabsContent>
        
        <TabsContent value="avaliacoes">
          <FitCulturalTab funcionarios={funcionarios} />
        </TabsContent>
      </Tabs>

      {/* Sheet Cadastrar/Editar Funcionario */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto border-l-border/40 bg-background/95 backdrop-blur-xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {isEditing ? "Editar Funcionário" : "Novo Funcionário"}
            </SheetTitle>
            <SheetDescription>
              {isEditing ? "Atualize os dados cadastrais do funcionário." : "Preencha os dados abaixo para cadastrar um novo funcionário."}
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={formData.nome || ""}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                placeholder="Ex: João Silva"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo *</Label>
                <Input
                  id="cargo"
                  value={formData.cargo || ""}
                  onChange={(e) => setFormData({...formData, cargo: e.target.value})}
                  placeholder="Ex: Operador"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setor">Setor</Label>
                <Input
                  id="setor"
                  value={formData.setor || ""}
                  onChange={(e) => setFormData({...formData, setor: e.target.value})}
                  placeholder="Ex: Manutenção"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departamento">Departamento</Label>
                <Input
                  id="departamento"
                  value={formData.departamento || ""}
                  onChange={(e) => setFormData({...formData, departamento: e.target.value})}
                  placeholder="Ex: Operações"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admissao">Data de Admissão</Label>
                <Input
                  id="admissao"
                  type="date"
                  value={formData.data_admissao || ""}
                  onChange={(e) => setFormData({...formData, data_admissao: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="Ex: email@busato.com.br"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone || ""}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                  placeholder="Ex: (00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({...formData, status: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <SheetFooter className="mt-8">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
