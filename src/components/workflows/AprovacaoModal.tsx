import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitacao: any;
  novaEtapa: any;
  onSuccess: () => void;
}

export function AprovacaoModal({ isOpen, onClose, solicitacao, novaEtapa, onSuccess }: Props) {
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAprovar = async () => {
    try {
      setLoading(true);
      // Registra a aprovação
      await supabase.from('solicitacoes_aprovacoes').insert([{
        solicitacao_id: solicitacao.id,
        etapa_id: novaEtapa.id,
        aprovador_nome: 'Gestor Atual', // TODO: auth.user
        status: 'Aprovado',
        comentario
      }]);
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erro na aprovação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!solicitacao || !novaEtapa) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" /> 
            Autorização Necessária
          </DialogTitle>
          <DialogDescription>
            Você está movendo o chamado <strong>#{solicitacao.codigo}</strong> para a etapa <strong>{novaEtapa.nome}</strong>, que requer aprovação formal.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Justificativa / Parecer de Aprovação</Label>
            <Textarea 
              placeholder="Ex: Orçamento aprovado conforme limites..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleAprovar} disabled={loading} className="bg-success hover:bg-success/90">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Aprovar e Avançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
