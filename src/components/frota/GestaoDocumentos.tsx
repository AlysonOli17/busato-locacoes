import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, FileCheck, AlertTriangle, ShieldCheck, FileText, Download, CalendarDays, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CurrencyInput } from "@/components/CurrencyInput";

interface Equipamento {
  id: string;
  tipo: string;
  modelo: string;
  tag_placa: string | null;
}

interface Documento {
  id: string;
  equipamento_id: string;
  tipo: string;
  numero: string;
  vencimento: string;
  valor: number;
  status: string;
  equipamentos?: Equipamento;
}

const emptyForm = { equipamento_id: "", tipo: "IPVA", numero: "", vencimento: "", valor: "" };

export const GestaoDocumentos = () => {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Documento | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    const [docsRes, equipRes] = await Promise.all([
      supabase.from("documentos_legais").select("*, equipamentos(id, tipo, modelo, tag_placa)").order("vencimento", { ascending: true }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").order("modelo")
    ]);

    if (docsRes.data) setDocumentos(docsRes.data);
    if (equipRes.data) setEquipamentos(equipRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!form.equipamento_id || !form.numero || !form.vencimento) {
      toast({ title: "Erro", description: "Preencha os campos obrigatórios.", variant: "destructive" });
      return;
    }

    const payload = {
      equipamento_id: form.equipamento_id,
      tipo: form.tipo,
      numero: form.numero,
      vencimento: form.vencimento,
      valor: form.valor ? parseFloat(form.valor as any) : 0,
      // Status is automatically calculated or set to Ativo by default in DB, we'll let it just use Ativo for now or calculate it
    };

    if (editing) {
      const { error } = await supabase.from("documentos_legais").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("documentos_legais").insert({ ...payload, id: crypto.randomUUID() });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }

    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    const { error } = await supabase.from("documentos_legais").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchData();
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (doc: Documento) => {
    setEditing(doc);
    setForm({
      equipamento_id: doc.equipamento_id,
      tipo: doc.tipo,
      numero: doc.numero,
      vencimento: doc.vencimento,
      valor: doc.valor.toString()
    });
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Ativo": return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><ShieldCheck className="w-3 h-3 mr-1" /> Ativo</Badge>;
      case "Atenção": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><AlertTriangle className="w-3 h-3 mr-1" /> Vence em breve</Badge>;
      case "Vencido": return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200"><AlertTriangle className="w-3 h-3 mr-1" /> Vencido</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "Licenciamento": return <FileCheck className="w-4 h-4 text-primary" />;
      default: return <FileText className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar equipamento, documento..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Novo Documento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Documento" : "Registrar Documento"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Equipamento</Label>
                <Select value={form.equipamento_id} onValueChange={(v) => setForm({ ...form, equipamento_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                  <SelectContent>
                    {equipamentos.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.modelo} {eq.tag_placa ? `(${eq.tag_placa})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo de Documento</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IPVA">IPVA</SelectItem>
                      <SelectItem value="Licenciamento">Licenciamento</SelectItem>
                      <SelectItem value="ANTT">ANTT</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Número/Registro</Label>
                  <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Ex: 9988776655" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Data de Vencimento</Label>
                  <Input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Valor (R$)</Label>
                  <CurrencyInput value={Number(form.valor) || 0} onValueChange={(v) => setForm({ ...form, valor: String(v) })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar Documento</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Equipamento</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentos.map((doc) => (
              <TableRow key={doc.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-semibold">
                  {doc.equipamentos?.modelo} {doc.equipamentos?.tag_placa ? `(${doc.equipamentos.tag_placa})` : ""}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    {getTipoIcon(doc.tipo)}
                    {doc.tipo}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{doc.numero}</TableCell>
                <TableCell>
                  <div className="flex items-center text-sm font-medium">
                    <CalendarDays className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    {new Date(doc.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {Number(doc.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </TableCell>
                <TableCell className="text-center">{getStatusBadge(doc.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(doc)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
