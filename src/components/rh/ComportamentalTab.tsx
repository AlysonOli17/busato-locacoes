import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Brain, Plus, Copy, Link, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Funcionario } from "@/pages/RecursosHumanos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface TesteComportamental {
  id: string;
  funcionario_id: string;
  token_acesso: string;
  status: string;
  data_envio: string | null;
  resultado_d: number;
  resultado_i: number;
  resultado_s: number;
  resultado_c: number;
  perfil_predominante: string | null;
  criado_em: string;
  funcionarios?: { nome: string };
}

interface Props {
  funcionarios: Funcionario[];
}

export function ComportamentalTab({ funcionarios }: Props) {
  const { toast } = useToast();
  const [testes, setTestes] = useState<TesteComportamental[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchTestes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('testes_comportamentais')
        .select(`
          *,
          funcionarios:funcionario_id (nome)
        `)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      setTestes(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar testes", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestes();
  }, []);

  const handleGenerateLink = async () => {
    if (!selectedFuncionarioId) {
      toast({ title: "Atenção", description: "Selecione um funcionário.", variant: "destructive" });
      return;
    }

    try {
      setIsGenerating(true);
      const { data, error } = await supabase
        .from('testes_comportamentais')
        .insert([{
          funcionario_id: selectedFuncionarioId
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      toast({ title: "Link gerado com sucesso!" });
      setIsDialogOpen(false);
      setSelectedFuncionarioId("");
      fetchTestes();
      
      // Copy to clipboard right away
      if (data?.token_acesso) {
        copyToClipboard(data.token_acesso);
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar link", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (token: string) => {
    const link = `${window.location.origin}/teste-disc/${token}`;
    navigator.clipboard.writeText(link);
    toast({ 
      title: "Link Copiado!", 
      description: "O link foi copiado para a área de transferência. Envie para o funcionário.",
      variant: "default"
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Concluído') {
      return <Badge variant="success" className="font-normal"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</Badge>;
    }
    return <Badge variant="secondary" className="font-normal"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pendente</Badge>;
  };

  return (
    <Card className="glass shadow-sm border-border/40">
      <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4">
        <div>
          <CardTitle className="text-lg">Testes Comportamentais (DISC)</CardTitle>
          <CardDescription>Gere links para mapear o perfil da sua equipe</CardDescription>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 shadow-sm">
              <Link className="h-4 w-4 mr-2" /> Gerar Novo Teste
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>Gerar Link do Teste DISC</DialogTitle>
              <DialogDescription>
                Selecione o funcionário. Um link exclusivo será gerado para que ele responda pelo celular.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label className="mb-2 block">Funcionário *</Label>
              <Select 
                value={selectedFuncionarioId} 
                onValueChange={setSelectedFuncionarioId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.filter(f => f.status === 'Ativo').map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleGenerateLink} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar Link"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border border-border/50 bg-background/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Data Criação</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Perfil Predominante</TableHead>
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
              ) : testes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum teste gerado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                testes.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>{format(new Date(t.criado_em), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{t.funcionarios?.nome || 'Desconhecido'}</TableCell>
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell>
                      {t.status === 'Concluído' ? (
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-primary">{t.perfil_predominante}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Aguardando resposta...</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.status === 'Pendente' ? (
                        <Button variant="secondary" size="sm" onClick={() => copyToClipboard(t.token_acesso)}>
                          <Copy className="h-4 w-4 mr-2" /> Copiar Link
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => toast({ title: "Em breve", description: "O gráfico completo do DISC será exibido aqui." })}>
                          Ver Detalhes
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
