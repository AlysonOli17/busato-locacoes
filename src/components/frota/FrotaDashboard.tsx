import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Wrench, AlertTriangle, FileCheck, ShieldAlert, CheckCircle2, TrendingUp, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const dataDisponibilidade = [
  { name: "Seg", disp: 95 },
  { name: "Ter", disp: 92 },
  { name: "Qua", disp: 89 },
  { name: "Qui", disp: 96 },
  { name: "Sex", disp: 98 },
  { name: "Sáb", disp: 99 },
  { name: "Dom", disp: 100 },
];

const dataFrotaStatus = [
  { name: "Operando", value: 45, color: "#10b981" }, // emerald-500
  { name: "Manutenção", value: 8, color: "#f59e0b" }, // amber-500
  { name: "Pátio", value: 12, color: "#64748b" }, // slate-500
];

export const FrotaDashboard = () => {
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
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1 text-emerald-500" />
              <span className="text-emerald-500 font-medium">+2</span> desde o último mês
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Manutenção</CardTitle>
            <Wrench className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <Activity className="h-3 w-3 mr-1 text-amber-500" />
              3 preventivas, 5 corretivas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alertas Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground mt-1 text-rose-500 font-medium">
              Ação imediata requerida
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Doc. Regulares</CardTitle>
            <FileCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <span className="text-blue-500 font-medium mr-1">5</span> veículos com IPVA a vencer
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
                  <span className="text-2xl font-bold">65</span>
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
                Radar de Atenção
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                <div className="p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors">
                  <div className="mt-0.5 bg-rose-100 p-1 rounded">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Seguro Vencendo</p>
                    <p className="text-xs text-muted-foreground">Placa ABC-1234 vence amanhã.</p>
                  </div>
                </div>
                <div className="p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors">
                  <div className="mt-0.5 bg-amber-100 p-1 rounded">
                    <Wrench className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Revisão Atrasada</p>
                    <p className="text-xs text-muted-foreground">Escavadeira CAT-01 (10.500 hrs).</p>
                  </div>
                </div>
                <div className="p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors">
                  <div className="mt-0.5 bg-emerald-100 p-1 rounded">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">OS Concluída</p>
                    <p className="text-xs text-muted-foreground">Caminhão Munck liberado hoje.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
