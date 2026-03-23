import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wrench, Building2, FileText, Receipt, Clock, AlertTriangle, CalendarClock, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VencimentoItem {
  tipo: "Contrato" | "Aditivo" | "Ajuste Temporário";
  descricao: string;
  data_fim: string;
  dias_restantes: number;
  status: "vencido" | "critico" | "alerta";
}

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const Index = () => {
  const [stats, setStats] = useState({ equipamentos: 0, contratosAtivos: 0, empresas: 0, pendente: 0, atrasadas: 0 });
  const [recentContratos, setRecentContratos] = useState<any[]>([]);
  const [recentMedicoes, setRecentMedicoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vencimentos, setVencimentos] = useState<VencimentoItem[]>([]);
  const [vencimentosDialogOpen, setVencimentosDialogOpen] = useState(false);
  const { toast } = useToast();

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

      setStats({ equipamentos: eqRes.count || 0, contratosAtivos, empresas: empRes.count || 0, pendente, atrasadas });
      setRecentContratos((ctRes.data || []).slice(0, 4));
      setRecentMedicoes(medRes.data || []);
      setLoading(false);
    };

    const fetchVencimentos = async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const alertaDias = 30; // alert for items expiring within 30 days
      const items: VencimentoItem[] = [];

      // 1. Contratos ativos
      const { data: contratos } = await supabase
        .from("contratos")
        .select("id, data_fim, empresas(nome)")
        .eq("status", "Ativo");

      (contratos || []).forEach((c: any) => {
        const fim = parseLocalDate(c.data_fim);
        const diff = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= alertaDias) {
          items.push({
            tipo: "Contrato",
            descricao: `${c.empresas?.nome || "—"} (venc. ${fim.toLocaleDateString("pt-BR")})`,
            data_fim: c.data_fim,
            dias_restantes: diff,
            status: diff < 0 ? "vencido" : diff <= 7 ? "critico" : "alerta",
          });
        }
      });

      // 2. Aditivos
      const { data: aditivos } = await supabase
        .from("contratos_aditivos")
        .select("id, numero, data_fim, contratos(status, empresas(nome))")
        .order("data_fim", { ascending: true });

      (aditivos || []).forEach((a: any) => {
        if (a.contratos?.status !== "Ativo") return;
        const fim = parseLocalDate(a.data_fim);
        const diff = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= alertaDias) {
          items.push({
            tipo: "Aditivo",
            descricao: `Aditivo #${a.numero} - ${a.contratos?.empresas?.nome || "—"} (venc. ${fim.toLocaleDateString("pt-BR")})`,
            data_fim: a.data_fim,
            dias_restantes: diff,
            status: diff < 0 ? "vencido" : diff <= 7 ? "critico" : "alerta",
          });
        }
      });

      // 3. Ajustes temporários
      const { data: ajustes } = await supabase
        .from("contratos_equipamentos_ajustes")
        .select("id, data_fim, motivo, contratos(status, empresas(nome)), equipamentos(tipo, modelo)")
        .order("data_fim", { ascending: true });

      (ajustes || []).forEach((aj: any) => {
        if (aj.contratos?.status !== "Ativo") return;
        const fim = parseLocalDate(aj.data_fim);
        const diff = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= alertaDias) {
          items.push({
            tipo: "Ajuste Temporário",
            descricao: `${aj.equipamentos?.tipo || ""} ${aj.equipamentos?.modelo || ""} - ${aj.contratos?.empresas?.nome || "—"} (venc. ${fim.toLocaleDateString("pt-BR")})`,
            data_fim: aj.data_fim,
            dias_restantes: diff,
            status: diff < 0 ? "vencido" : diff <= 7 ? "critico" : "alerta",
          });
        }
      });

      // Sort: vencidos first, then by dias_restantes
      items.sort((a, b) => a.dias_restantes - b.dias_restantes);
      setVencimentos(items);

      // Show toast popup if there are alerts
      if (items.length > 0) {
        const vencidos = items.filter(i => i.status === "vencido").length;
        const criticos = items.filter(i => i.status === "critico").length;
        const alertas = items.filter(i => i.status === "alerta").length;

        const parts: string[] = [];
        if (vencidos > 0) parts.push(`${vencidos} vencido(s)`);
        if (criticos > 0) parts.push(`${criticos} crítico(s)`);
        if (alertas > 0) parts.push(`${alertas} próximo(s) do vencimento`);

        toast({
          title: `⚠️ Atenção: ${items.length} vencimento(s)`,
          description: parts.join(", "),
          variant: "destructive",
        });
      }
    };

    fetchDash();
    fetchVencimentos();
  }, []);

  const statusBadge = (item: VencimentoItem) => {
    if (item.status === "vencido") return <Badge className="bg-destructive text-destructive-foreground">Vencido</Badge>;
    if (item.status === "critico") return <Badge className="bg-warning text-warning-foreground">{item.dias_restantes}d restantes</Badge>;
    return <Badge variant="outline" className="border-warning text-warning">{item.dias_restantes}d restantes</Badge>;
  };

  const tipoBadge = (tipo: string) => {
    if (tipo === "Contrato") return <Badge variant="outline" className="text-xs">Contrato</Badge>;
    if (tipo === "Aditivo") return <Badge variant="outline" className="text-xs border-accent text-accent">Aditivo</Badge>;
    return <Badge variant="outline" className="text-xs border-muted-foreground">Ajuste</Badge>;
  };

  return (
    <Layout title="Dashboard" subtitle="Visão geral do sistema de locações">
      <div className="space-y-6">

        {/* Alerta de vencimentos */}
        {vencimentos.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-warning">
                <ShieldAlert className="h-4 w-4" />
                Vencimentos Próximos ({vencimentos.length})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setVencimentosDialogOpen(true)}>
                Ver todos
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {vencimentos.slice(0, 5).map((v, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {tipoBadge(v.tipo)}
                      <span className="truncate">{v.descricao}</span>
                    </div>
                    {statusBadge(v)}
                  </div>
                ))}
                {vencimentos.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    e mais {vencimentos.length - 5} item(ns)...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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

      {/* Dialog com todos os vencimentos */}
      <Dialog open={vencimentosDialogOpen} onOpenChange={setVencimentosDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-warning" />
              Vencimentos Próximos ({vencimentos.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vencimentos.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell>{tipoBadge(v.tipo)}</TableCell>
                    <TableCell className="text-sm">{v.descricao}</TableCell>
                    <TableCell className="text-sm">{parseLocalDate(v.data_fim).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{statusBadge(v)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Index;
