import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Activity, CalendarDays, History } from "lucide-react";

export const ControleUsoFrota = () => {
  const [leituras, setLeituras] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    // Mock data for demonstration
    setLeituras([
      { id: 1, equipamento: "Caminhão Munck (ABC-1234)", tipo: "KM", valor: 145000, data: "2026-06-29", operador: "João Silva", obs: "Viagem SP" },
      { id: 2, equipamento: "Escavadeira CAT-01", tipo: "Horímetro", valor: 10450, data: "2026-06-28", operador: "Carlos Souza", obs: "Fim do turno" },
      { id: 3, equipamento: "Trator Valtra", tipo: "Horímetro", valor: 4320, data: "2026-06-25", operador: "Ana Dias", obs: "Leitura semanal" },
      { id: 4, equipamento: "Caminhão Pipa (XYZ-9999)", tipo: "KM", valor: 89300, data: "2026-06-24", operador: "João Silva", obs: "" }
    ]);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar equipamento ou operador..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Lançar Leitura
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Leitura de Uso</DialogTitle>
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
                  <Label>Tipo de Leitura</Label>
                  <Select defaultValue="km">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">Quilometragem (KM)</SelectItem>
                      <SelectItem value="horimetro">Horímetro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Valor Atual</Label>
                  <Input type="number" placeholder="Ex: 145000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Data da Leitura</Label>
                  <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="grid gap-2">
                  <Label>Operador (Opcional)</Label>
                  <Input placeholder="Nome do motorista/operador" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => setDialogOpen(false)} className="bg-accent text-accent-foreground hover:bg-accent/90">Salvar Leitura</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Leitura</TableHead>
              <TableHead>Operador</TableHead>
              <TableHead>Observações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leituras.map((leitura) => (
              <TableRow key={leitura.id} className="hover:bg-muted/50 transition-colors">
                <TableCell>
                  <div className="flex items-center text-sm font-medium">
                    <CalendarDays className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    {new Date(leitura.data).toLocaleDateString('pt-BR')}
                  </div>
                </TableCell>
                <TableCell className="font-semibold">{leitura.equipamento}</TableCell>
                <TableCell>
                  <div className="flex items-center text-sm">
                    {leitura.tipo === "KM" ? (
                      <Activity className="w-3.5 h-3.5 mr-1 text-blue-500" />
                    ) : (
                      <History className="w-3.5 h-3.5 mr-1 text-amber-500" />
                    )}
                    {leitura.tipo}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {leitura.valor.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{leitura.operador || "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{leitura.obs || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
