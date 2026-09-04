import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CurrencyInput } from "@/components/CurrencyInput";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
}

interface ValeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresas: Empresa[];
  initialData?: any | null;
  onSave: (data: any) => void;
  isSaving: boolean;
}

export function ValeFormDialog({
  open,
  onOpenChange,
  empresas,
  initialData,
  onSave,
  isSaving
}: ValeFormDialogProps) {
  const [empresaId, setEmpresaId] = useState("");
  const [numeroRf, setNumeroRf] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (open) {
      if (initialData) {
        setEmpresaId(initialData.empresa_id || "");
        setNumeroRf(initialData.numero_rf || "");
        setValor(initialData.valor ? initialData.valor.toString() : "");
        setData(initialData.data || new Date().toISOString().split("T")[0]);
        setObservacoes(initialData.observacoes || "");
      } else {
        setEmpresaId("");
        setNumeroRf("");
        setValor("");
        setData(new Date().toISOString().split("T")[0]);
        setObservacoes("");
      }
    }
  }, [open, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId || !numeroRf || !valor || !data) return;
    onSave({
      empresa_id: empresaId,
      numero_rf: numeroRf,
      valor: parseFloat(valor),
      data: data,
      observacoes
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Vale" : "Novo Vale"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="empresa">Empresa</Label>
            <SearchableSelect
              options={empresas.map(e => ({ value: e.id, label: `${e.nome} (${e.cnpj})` }))}
              value={empresaId}
              onValueChange={setEmpresaId}
              placeholder="Selecione a empresa"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_rf">Número de RF</Label>
              <Input
                id="numero_rf"
                value={numeroRf}
                onChange={e => setNumeroRf(e.target.value)}
                placeholder="Ex: RF-12345"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$)</Label>
              <CurrencyInput
                value={valor}
                onValueChange={setValor}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (Opcional)</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !empresaId || !numeroRf || !valor || !data}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
