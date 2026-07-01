import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Filter, AlertCircle, Wrench, CheckCircle2, Clock, CalendarDays } from "lucide-react";

export const ManutencaoSmartTable = () => {
  const [ordens, setOrdens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    // Mock data based on the plan
    setOrdens([
      { id: 1, equipamento: "Caminhão Munck (ABC-1234)", tipo: "Manutenção Preventiva", descricao: "Troca de óleo e filtros", status: "Agendada", data_agendada: "2026-07-05", oficina: "Oficina Interna", urgencia: "Baixa" },
      { id: 2, equipamento: "Escavadeira CAT-01", tipo: "Manutenção Corretiva", descricao: "Vazamento cilindro hidráulico", status: "Em Execução", data_agendada: "2026-06-29", oficina: "Torno Mecânico", urgencia: "Alta" },
      { id: 3, equipamento: "Trator Valtra", tipo: "Logística / Mobilização", descricao: "Frete para Obra XPTO", status: "Agendada", data_agendada: "2026-06-25", oficina: "Transportadora Express", urgencia: "Alta" },
      { id: 4, equipamento: "Caminhão Pipa (XYZ-9999)", tipo: "Abastecimento", descricao: "200 Litros Diesel S10", status: "Concluída", data_agendada: "2026-06-20", data_conclusao: "2026-06-22", oficina: "Posto Ipiranga", urgencia: "Baixa" }
    ]);
    setLoading(false);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Agendada": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CalendarDays className="w-3 h-3 mr-1" /> Agendada</Badge>;
      case "Em Execução": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Wrench className="w-3 h-3 mr-1" /> Em Execução</Badge>;
      case "Atrasada": return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200"><AlertCircle className="w-3 h-3 mr-1" /> Atrasada</Badge>;
      case "Concluída": return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Concluída</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getUrgenciaBadge = (urgencia: string) => {
    switch (urgencia) {
      case "Crítica": return <Badge variant="destructive" className="text-[10px]">Crítica</Badge>;
      case "Alta": return <Badge className="bg-amber-500 text-[10px]">Alta</Badge>;
      case "Baixa": return <Badge variant="secondary" className="text-[10px]">Baixa</Badge>;
      default: return <Badge variant="outline">{urgencia}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar OS ou equipamento..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" /> Nova OS
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Abrir Ordem de Serviço</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Equipamento</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Selecione o equipamento que receberá manutenção" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Caminhão Munck (ABC-1234)</SelectItem>
                    <SelectItem value="2">Escavadeira CAT-01</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo de Custo / Serviço</Label>
                  <Select defaultValue="preventiva">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preventiva">Manutenção Preventiva</SelectItem>
                      <SelectItem value="corretiva">Manutenção Corretiva</SelectItem>
                      <SelectItem value="mobilizacao">Logística / Mobilização</SelectItem>
                      <SelectItem value="combustivel">Abastecimento / Combustível</SelectItem>
                      <SelectItem value="outros">Outros Custos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Data Agendada</Label>
                  <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Oficina / Prestador</Label>
                  <Input placeholder="Nome da oficina" />
                </div>
                <div className="grid gap-2">
                  <Label>Urgência</Label>
                  <Select defaultValue="baixa">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica (Máquina Parada)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Descrição do Problema / Serviço</Label>
                <Textarea placeholder="Descreva os sintomas ou os serviços que precisam ser executados..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => setDialogOpen(false)} className="bg-accent text-accent-foreground hover:bg-accent/90">Gerar OS</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[80px]">OS</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Tipo / Descrição</TableHead>
              <TableHead>Oficina</TableHead>
              <TableHead>Agendamento</TableHead>
              <TableHead>Urgência</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordens.map((os) => (
              <TableRow key={os.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium text-muted-foreground">#{os.id.toString().padStart(4, '0')}</TableCell>
                <TableCell className="font-semibold">{os.equipamento}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{os.tipo}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{os.descricao}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{os.oficina}</TableCell>
                <TableCell>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    {os.data_agendada}
                  </div>
                </TableCell>
                <TableCell>{getUrgenciaBadge(os.urgencia)}</TableCell>
                <TableCell className="text-right">{getStatusBadge(os.status)}</TableCell>
              </TableRow>
            ))}
            {ordens.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhuma ordem de serviço encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
