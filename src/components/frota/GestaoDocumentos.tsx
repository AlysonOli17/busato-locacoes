import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, FileCheck, AlertTriangle, ShieldCheck, FileText, Download, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const GestaoDocumentos = () => {
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    // Mock data for demonstration
    setDocumentos([
      { id: 1, equipamento: "Caminhão Munck (ABC-1234)", tipo: "Licenciamento", numero: "9988776655", vencimento: "2026-10-15", valor: 145.90, status: "Ativo" },
      { id: 2, equipamento: "Caminhão Pipa (XYZ-9999)", tipo: "IPVA", numero: "-", vencimento: "2026-07-05", valor: 2300.00, status: "Atenção" },
      { id: 4, equipamento: "Trator Valtra", tipo: "ANTT", numero: "REG-987654", vencimento: "2027-02-10", valor: 400.00, status: "Ativo" }
    ]);
  }, []);

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
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Novo Documento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Documento</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Equipamento</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Caminhão Munck (ABC-1234)</SelectItem>
                    <SelectItem value="2">Escavadeira CAT-01</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo de Documento</Label>
                  <Select defaultValue="ipva">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ipva">IPVA</SelectItem>
                      <SelectItem value="licenciamento">Licenciamento</SelectItem>
                      <SelectItem value="antt">ANTT</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Número/Registro</Label>
                  <Input placeholder="Ex: 9988776655" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Data de Vencimento</Label>
                  <Input type="date" />
                </div>
                <div className="grid gap-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" placeholder="0,00" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Anexo (PDF/Imagem)</Label>
                <Input type="file" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => setDialogOpen(false)} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar Documento</Button>
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
                <TableCell className="font-semibold">{doc.equipamento}</TableCell>
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
                    {new Date(doc.vencimento).toLocaleDateString('pt-BR')}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {doc.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </TableCell>
                <TableCell className="text-center">{getStatusBadge(doc.status)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
