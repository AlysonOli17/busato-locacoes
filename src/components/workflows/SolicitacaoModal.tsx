import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateAprovacoesPdf } from "@/lib/workflowPdfUtils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitacao: any | null; // se nulo, criacao
  workflowId: string;
  etapaInicial?: any;
  onSaved: () => void;
}

export function SolicitacaoModal({ isOpen, onClose, solicitacao, workflowId, etapaInicial, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    prioridade: "Média"
  });

  useEffect(() => {
    if (solicitacao) {
      setFormData({
        titulo: solicitacao.titulo,
        descricao: solicitacao.descricao || "",
        prioridade: solicitacao.prioridade || "Média"
      });
    } else {
      setFormData({ titulo: "", descricao: "", prioridade: "Média" });
    }
  }, [solicitacao]);

  const handleSave = async () => {
    if (!formData.titulo) {
      toast({ title: "Campo obrigatório", description: "O título não pode estar vazio.", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      if (solicitacao) {
        // Atualiza
        const { error } = await supabase
          .from('solicitacoes')
          .update(formData)
          .eq('id', solicitacao.id);
        if (error) throw error;
        toast({ title: "Solicitação atualizada!" });
      } else {
        // Cria
        if (!etapaInicial) throw new Error("Etapa inicial não definida.");
        const { data: newSol, error } = await supabase
          .from('solicitacoes')
          .insert([{
            workflow_id: workflowId,
            etapa_id: etapaInicial.id,
            ...formData,
            solicitante_nome: 'Gestor Logado' // TODO: Pegar do auth
          }]).select().single();
        if (error) throw error;

        // Historico de criacao
        await supabase.from('solicitacoes_historico').insert([{
          solicitacao_id: newSol.id,
          etapa_nova_id: etapaInicial.id,
          acao: 'Criado',
          usuario_nome: 'Gestor Logado'
        }]);

        toast({ title: "Solicitação criada!" });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {solicitacao ? `Solicitação #${solicitacao.codigo}` : "Nova Solicitação"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Título / Assunto</Label>
            <Input 
              placeholder="Ex: Quebra do motor da Escavadeira X"
              value={formData.titulo}
              onChange={(e) => setFormData({...formData, titulo: e.target.value})}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={formData.prioridade} onValueChange={(v) => setFormData({...formData, prioridade: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Baixa">Baixa</SelectItem>
                <SelectItem value="Média">Média</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Urgente">Urgente (Emergência)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição Detalhada</Label>
            <Textarea 
              placeholder="Descreva o problema, equipamento e informações relevantes..."
              className="h-32"
              value={formData.descricao}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <div>
            {solicitacao && (
              <Button variant="outline" type="button" onClick={async () => {
                try {
                  const doc = await generateAprovacoesPdf(solicitacao.id);
                  doc.save(`Dossie_Aprovacao_${solicitacao.codigo}.pdf`);
                } catch(e:any) {
                  toast({title: "Erro ao gerar PDF", description: e.message, variant: "destructive"});
                }
              }}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Dossiê
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
