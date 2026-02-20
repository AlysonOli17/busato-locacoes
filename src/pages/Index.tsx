import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, Building2, FileText, Receipt, TrendingUp, Clock } from "lucide-react";

const stats = [
  { label: "Equipamentos", value: "24", icon: Wrench, sub: "+2 este mês" },
  { label: "Contratos Ativos", value: "18", icon: FileText, sub: "3 vencem em breve" },
  { label: "Empresas", value: "12", icon: Building2, sub: "+1 esta semana" },
  { label: "Faturamento Pendente", value: "R$ 45.200", icon: Receipt, sub: "5 faturas" },
];

const recentContracts = [
  { id: "1", empresa: "Construtora Alpha", equipamento: "Escavadeira CAT 320", inicio: "01/02/2026", status: "Ativo" },
  { id: "2", empresa: "Terraplenagem Beta", equipamento: "Retroescavadeira JCB 3CX", inicio: "15/01/2026", status: "Ativo" },
  { id: "3", empresa: "Engenharia Gamma", equipamento: "Rolo Compactador BOMAG", inicio: "10/01/2026", status: "Vencido" },
  { id: "4", empresa: "Pavimentação Delta", equipamento: "Pá Carregadeira 950H", inicio: "20/12/2025", status: "Ativo" },
];

const recentMedicoes = [
  { equipamento: "Escavadeira CAT 320", data: "20/02/2026", horasHoje: "8.5h", totalMes: "142h" },
  { equipamento: "Retroescavadeira JCB 3CX", data: "20/02/2026", horasHoje: "6.2h", totalMes: "98h" },
  { equipamento: "Pá Carregadeira 950H", data: "20/02/2026", horasHoje: "9.1h", totalMes: "156h" },
];

const Index = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do sistema de locações</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-accent" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  {s.sub}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                Contratos Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentContracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-sm">{c.empresa}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.equipamento}</TableCell>
                      <TableCell>
                        <Badge className={c.status === "Ativo" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                Medições de Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Horas Hoje</TableHead>
                    <TableHead>Total Mês</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMedicoes.map((m) => (
                    <TableRow key={m.equipamento}>
                      <TableCell className="font-medium text-sm">{m.equipamento}</TableCell>
                      <TableCell className="text-sm">{m.horasHoje}</TableCell>
                      <TableCell className="text-sm font-semibold text-accent">{m.totalMes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
