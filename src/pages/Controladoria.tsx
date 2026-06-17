import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658'];

export default function Controladoria() {
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [faturamentos, setFaturamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    setLoading(true);
    
    const [
      { data: eqs },
      { data: gsts },
      { data: fats }
    ] = await Promise.all([
      supabase.from("equipamentos").select("*"),
      supabase.from("gastos").select("*"),
      supabase.from("faturamento_equipamentos").select("*, faturamento(status)")
    ]);

    if (eqs) setEquipamentos(eqs);
    if (gsts) setGastos(gsts);
    if (fats) setFaturamentos(fats);
    
    setLoading(false);
  };

  // 1. DRE por Equipamento
  const dreData = equipamentos.map(eq => {
    // Somar Gastos (Despesas)
    const eqGastos = gastos.filter(g => g.equipamento_id === eq.id);
    const totalGastos = eqGastos.reduce((acc, curr) => acc + (curr.valor || 0), 0);

    // Somar Receitas (Faturamentos não cancelados)
    const eqFats = faturamentos.filter(f => f.equipamento_id === eq.id && f.faturamento?.status !== "Cancelado");
    const totalReceita = eqFats.reduce((acc, curr) => {
      const valorHorasNormais = (curr.horas_medidas || 0) * (curr.valor_hora || 0);
      const valorHorasExcedentes = (curr.horas_excedentes || 0) * (curr.valor_hora_excedente || 0);
      return acc + valorHorasNormais + valorHorasExcedentes;
    }, 0);

    const saldo = totalReceita - totalGastos;
    const margem = totalReceita > 0 ? (saldo / totalReceita) * 100 : (totalGastos > 0 ? -100 : 0);

    return {
      ...eq,
      totalGastos,
      totalReceita,
      saldo,
      margem,
      nomeExibicao: `${eq.tag_placa || ''} - ${eq.modelo || eq.tipo}`,
    };
  }).sort((a, b) => b.saldo - a.saldo);

  // 2. Agrupamento de Gastos por Classificação para Gráfico de Pizza
  const gastosPorClassificacao = gastos.reduce((acc, curr) => {
    const classif = curr.classificacao || "Outros";
    acc[classif] = (acc[classif] || 0) + (curr.valor || 0);
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(gastosPorClassificacao).map(([name, value]) => ({
    name, value
  })).sort((a, b) => b.value - a.value);

  // 3. Totais Globais
  const receitaTotal = dreData.reduce((acc, curr) => acc + curr.totalReceita, 0);
  const despesaTotal = dreData.reduce((acc, curr) => acc + curr.totalGastos, 0);
  const lucroTotal = receitaTotal - despesaTotal;
  const margemTotal = receitaTotal > 0 ? (lucroTotal / receitaTotal) * 100 : 0;

  return (
    <Layout title="Controladoria" subtitle="Inteligência de frota e DRE por equipamento">
      
      {loading ? (
        <div className="flex justify-center items-center h-64">Carregando inteligência de dados...</div>
      ) : (
        <div className="space-y-6">
          
          {/* Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-6">
                <p className="text-sm font-medium opacity-80">Receita Total Bruta</p>
                <h3 className="text-3xl font-bold mt-2">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitaTotal)}
                </h3>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
              <CardContent className="p-6">
                <p className="text-sm font-medium opacity-80">Despesas Totais (Custos Internos)</p>
                <h3 className="text-3xl font-bold mt-2">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesaTotal)}
                </h3>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <CardContent className="p-6">
                <p className="text-sm font-medium opacity-80">Lucro Operacional</p>
                <h3 className="text-3xl font-bold mt-2">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lucroTotal)}
                </h3>
              </CardContent>
            </Card>

            <Card className="bg-white border-blue-200">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-500">Margem Geral</p>
                <h3 className={`text-3xl font-bold mt-2 ${margemTotal >= 20 ? 'text-emerald-600' : margemTotal > 0 ? 'text-amber-500' : 'text-red-600'}`}>
                  {margemTotal.toFixed(1)}%
                </h3>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Pizza: Gastos */}
            <Card className="col-span-1 border-t-4 border-t-red-500 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Distribuição de Custos Internos</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Nenhum gasto registrado</div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de Barras: Top 10 Receitas */}
            <Card className="col-span-1 lg:col-span-2 border-t-4 border-t-emerald-500 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Equipamentos Mais Lucrativos (Top 10)</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dreData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="tag_placa" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                    <Legend />
                    <Bar dataKey="totalReceita" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="totalGastos" name="Despesa (Custo Interno)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* DRE Detalhado */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>DRE por Equipamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Equipamento</TableHead>
                      <TableHead className="text-right">Receita Total</TableHead>
                      <TableHead className="text-right">Despesas Internas</TableHead>
                      <TableHead className="text-right">Saldo Líquido</TableHead>
                      <TableHead className="text-center">Margem</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dreData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.nomeExibicao}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.totalReceita)}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.totalGastos)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${row.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.saldo)}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.margem.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          {row.margem >= 30 ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">Alta Lucratividade</Badge>
                          ) : row.margem > 0 ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Margem Apertada</Badge>
                          ) : row.totalGastos === 0 && row.totalReceita === 0 ? (
                            <Badge variant="outline" className="text-slate-500">Sem Movimentação</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Prejuízo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </Layout>
  );
}
