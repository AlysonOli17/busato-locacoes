import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Vale {
  id: string;
  empresa_id: string;
  numero_rf: string;
  valor: number;
  data: string;
}

interface ContaBancaria {
  id: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  titular: string;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vale: Vale | null;
  onSuccess: () => void;
}

export function GerarFaturaValeDialog({ isOpen, onOpenChange, vale, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [fetchingContas, setFetchingContas] = useState(false);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  
  const [contaId, setContaId] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setPeriodoInicio("");
      setPeriodoFim("");
      setContaId("");
      
      const fetchContas = async () => {
        setFetchingContas(true);
        const { data } = await supabase.from("contas_bancarias").select("*").order("banco");
        if (data) {
          setContas(data as ContaBancaria[]);
          if (data.length > 0) {
            setContaId(data[0].id);
          }
        }
        setFetchingContas(false);
      };
      
      fetchContas();
    }
  }, [isOpen]);

  const handleGerar = async () => {
    if (!vale) return;
    
    setLoading(true);
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
        observacoes: `Fatura gerada a partir do Vale RF: ${vale.numero_rf}`,
        conta_bancaria_id: contaId || null,
        periodo_medicao_inicio: periodoInicio || null,
        periodo_medicao_fim: periodoFim || null,
      };

      const { error: fatError } = await supabase.from("faturamento").insert([novaFatura]);
      if (fatError) throw fatError;

      // Update Vale status to Faturado
      const { error: updError } = await supabase.from("vales").update({ status: "Faturado" }).eq("id", vale.id);
      if (updError) throw updError;

      toast({ title: "Fatura Gerada", description: "Fatura gerada com sucesso e vale atualizado." });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao gerar fatura", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gerar Fatura do Vale</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Conta Bancária</Label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              disabled={fetchingContas}
            >
              <option value="">Selecione a conta bancária</option>
              {contas.map(conta => (
                <option key={conta.id} value={conta.id}>
                  {conta.banco} - Ag: {conta.agencia} Cc: {conta.conta} ({conta.titular})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Período Início (Opcional)</Label>
              <Input
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Período Fim (Opcional)</Label>
              <Input
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleGerar} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar Fatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
