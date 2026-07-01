import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Wrench, AlertTriangle, FileCheck, ShieldAlert, CheckCircle2, TrendingUp, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const dataDisponibilidade = [
  { name: "Seg", disp: 95 },
  { name: "Ter", disp: 92 },
  { name: "Qua", disp: 89 },
  { name: "Qui", disp: 96 },
  { name: "Sex", disp: 98 },
  { name: "Sáb", disp: 99 },
  { name: "Dom", disp: 100 },
];

export const FrotaDashboard = () => {
  const [stats, setStats] = useState({
    operando: 0,
    manutencao: 0,
    patio: 0,
    total: 0,
    docsVencendo: 0,
    docsTotal: 0
  });

  const [documentosAlertas, setDocumentosAlertas] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Busca equipamentos e agrupa por status (Locado, Manutenção, etc)
      const { data: equipData } = await supabase.from("equipamentos").select("status");
      
      let op = 0; let man = 0; let pat = 0; let tot = 0;
      if (equipData) {
        tot = equipData.length;
        equipData.forEach(eq => {
          if (eq.status === 'Locado' || eq.status === 'Ativo') op++;
          else if (eq.status === 'Manutenção') man++;
          else pat++;
        });
      }

      // Busca documentos
      const { data: docsData } = await supabase.from("documentos_legais").select("*, equipamentos(tag_placa, modelo)");
      let docsVenc = 0;
      let alertas = [];
      const hoje = new Date();
      const em30Dias = new Date();
      em30Dias.setDate(hoje.getDate() + 30);

      if (docsData) {
        docsData.forEach(doc => {
          const v = new Date(doc.vencimento);
          if (v <= em30Dias) {
            docsVenc++;
            alertas.push(doc);
          }
        });
      }

      setDocumentosAlertas(alertas);
      setStats({ operando: op, manutencao: man, patio: pat, total: tot, docsVencendo: docsVenc, docsTotal: docsData?.length || 0 });
    };

    fetchDashboardData();
  }, []);

  const dataFrotaStatus = [
    { name: "Operando", value: stats.operando, color: "#10b981" },
    { name: "Manutenção", value: stats.manutencao, color: "#f59e0b" },
    { name: "Pátio", value: stats.patio, color: "#64748b" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Frota Ativa</CardTitle>
            <Truck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.operando}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <span className="font-medium">Total de frota ativa/locada</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Manutenção</CardTitle>
            <Wrench className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.manutencao}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <span className="font-medium">Equipamentos parados</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alertas Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.docsVencendo}</div>
            <p className="text-xs text-muted-foreground mt-1 text-rose-500 font-medium">
              Documentos a vencer em 30 dias
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Doc. Regulares</CardTitle>
            <FileCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.docsTotal > 0 ? Math.round(((stats.docsTotal - stats.docsVencendo)/stats.docsTotal)*100) : 100}%</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <span className="text-blue-500 font-medium mr-1">{stats.docsVencendo}</span> documentos vencem em breve
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Disponibilidade */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Taxa de Disponibilidade (Últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataDisponibilidade} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="disp" name="Disponibilidade %" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status da Frota Pie Chart e Alertas */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Distribuição de Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[140px] w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataFrotaStatus}
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {dataFrotaStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold">{stats.total}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {dataFrotaStatus.map(status => (
                  <div key={status.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-xs font-medium">{status.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-100">
            <CardHeader className="bg-rose-50/50 pb-2 border-b border-rose-100 rounded-t-xl">
              <CardTitle className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Radar de Atenção (Vencimentos)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {documentosAlertas.length === 0 ? (
                  <div className="p-4 text-sm text-center text-muted-foreground">Nenhum alerta crítico no momento.</div>
                ) : documentosAlertas.slice(0, 3).map((alerta: any) => (
                  <div key={alerta.id} className="p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors">
                    <div className="mt-0.5 bg-rose-100 p-1 rounded">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{alerta.tipo} Vencendo</p>
                      <p className="text-xs text-muted-foreground">{alerta.equipamentos?.modelo} - Vence em: {new Date(alerta.vencimento).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
