import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ContaBancaria {
  id: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  titular: string;
  cnpj_cpf: string | null;
  pix: string | null;
  observacoes: string | null;
}

const emptyForm = { banco: "", agencia: "", conta: "", tipo_conta: "Corrente", titular: "", cnpj_cpf: "", pix: "", observacoes: "" };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contas: ContaBancaria[];
  onRefresh: () => void;
}

export const ContasBancariasDialog = ({ open, onOpenChange, contas, onRefresh }: Props) => {
  const [editing, setEditing] = useState<ContaBancaria | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  const openNew = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (c: ContaBancaria) => {
    setEditing(c);
    setForm({ banco: c.banco, agencia: c.agencia, conta: c.conta, tipo_conta: c.tipo_conta, titular: c.titular, cnpj_cpf: c.cnpj_cpf || "", pix: c.pix || "", observacoes: c.observacoes || "" });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.banco || !form.agencia || !form.conta || !form.titular) return;
    const payload = { ...form, cnpj_cpf: form.cnpj_cpf || null, pix: form.pix || null, observacoes: form.observacoes || null };
    if (editing) {
      const { error } = await supabase.from("contas_bancarias").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("contas_bancarias").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    setFormOpen(false);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contas_bancarias").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    onRefresh();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-accent" /> Contas Bancárias
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button onClick={openNew} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-1" /> Nova Conta
            </Button>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banco</TableHead>
                    <TableHead>Agência</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead>PIX</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contas.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm font-medium">{c.banco}</TableCell>
                      <TableCell className="text-sm font-mono">{c.agencia}</TableCell>
                      <TableCell className="text-sm font-mono">{c.conta}</TableCell>
                      <TableCell className="text-sm">{c.tipo_conta}</TableCell>
                      <TableCell className="text-sm">{c.titular}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.pix || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {contas.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhuma conta cadastrada</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Banco</Label><Input value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} placeholder="Ex: Banco do Brasil" /></div>
              <div><Label>Tipo</Label>
                <Select value={form.tipo_conta} onValueChange={v => setForm({ ...form, tipo_conta: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corrente">Corrente</SelectItem>
                    <SelectItem value="Poupança">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Agência</Label><Input value={form.agencia} onChange={e => setForm({ ...form, agencia: e.target.value })} placeholder="0001" /></div>
              <div><Label>Conta</Label><Input value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })} placeholder="12345-6" /></div>
            </div>
            <div><Label>Titular</Label><Input value={form.titular} onChange={e => setForm({ ...form, titular: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CNPJ/CPF</Label><Input value={form.cnpj_cpf} onChange={e => setForm({ ...form, cnpj_cpf: e.target.value })} /></div>
              <div><Label>Chave PIX</Label><Input value={form.pix} onChange={e => setForm({ ...form, pix: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
