import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, Building2, FileText, Receipt, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [stats, setStats] = useState({ equipamentos: 0, contratosAtivos: 0, empresas: 0, pendente: 0, atrasadas: 0 });
  const [recentContratos, setRecentContratos] = useState<any[]>([]);
  const [recentMedicoes, setRecentMedicoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDash = async () => {
      const [eqRes, empRes, ctRes, fatRes, medRes] = await Promise.all([
        supabase.from("equipamentos").select("id", { count: "exact", head: true }),
        supabase.from("empresas").select("id", { count: "exact", head: true }),
        supabase.from("contratos").select("*, empresas(nome), equipamentos(tipo, modelo, tag_placa)").order("created_at", { ascending: false }).limit(5),
        supabase.from("faturamento").select("id, status, valor_total, emissao, contrato_id, contratos(prazo_faturamento)").in("status", ["Pendente"]),
        supabase.from("medicoes").select("*, equipamentos(tipo, modelo, tag_placa)").order("data", { ascending: false }).limit(5),
      ]);

      const contratosAtivos = (ctRes.data || []).filter((c: any) => c.status === "Ativo").length;

      // Calculate overdue
      let pendente = 0;
      let atrasadas = 0;
      (fatRes.data || []).forEach((f: any) => {
        const prazo = f.contratos?.prazo_faturamento || 30;
        const venc = new Date(f.emissao);
        venc.setDate(venc.getDate() + prazo);
        if (new Date() > venc) {
          atrasadas++;
        } else {
          pendente += Number(f.valor_total);
        }
      });

      setStats({
        equipamentos: eqRes.count || 0,
        contratosAtivos,
        empresas: empRes.count || 0,
        pendente,
        atrasadas,
      });

      setRecentContratos((ctRes.data || []).slice(0, 4));
      setRecentMedicoes(medRes.data || []);
      setLoading(false);
    };
    fetchDash();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do sistema de locações</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Equipamentos</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Wrench className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.equipamentos}</div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contratos Ativos</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.contratosAtivos}</div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Empresas</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.empresas}</div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Pendente</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">R$ {stats.pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
              {stats.atrasadas > 0 && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.atrasadas} fatura(s) em atraso
                </p>
              )}
            </CardContent>
          </Card>
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
                  {recentContratos.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-sm">{c.empresas?.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.equipamentos?.tipo} {c.equipamentos?.modelo}</TableCell>
                      <TableCell>
                        <Badge className={c.status === "Ativo" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && recentContratos.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Nenhum contrato</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                Últimas Medições
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMedicoes.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-sm">{m.equipamentos?.tipo} {m.equipamentos?.modelo}</TableCell>
                      <TableCell className="text-sm">{new Date(m.data).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-sm font-semibold text-accent">{m.horas_trabalhadas}h</TableCell>
                    </TableRow>
                  ))}
                  {!loading && recentMedicoes.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Nenhuma medição</TableCell></TableRow>
                  )}
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
