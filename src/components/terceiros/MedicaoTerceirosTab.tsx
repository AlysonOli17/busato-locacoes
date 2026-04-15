import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useToast } from "@/hooks/use-toast";
import { Plus, Receipt, Pencil, Trash2, AlertTriangle, Clock, TrendingDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { calcularHorasInterpoladas, getEquipLabel } from "@/lib/utils";

interface Fornecedor { id: string; nome: string; cnpj: string; }
interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
interface ContratoEquip {
  equipamento_id: string; valor_hora: number; valor_hora_excedente: number;
  horas_contratadas: number; hora_minima: number;
  data_entrega: string | null; data_devolucao: string | null;
}
interface Contrato {
  id: string; fornecedor_id: string; data_inicio: string; data_fim: string;
  dia_medicao_inicio: number; dia_medicao_fim: number; tipo_medicao: string;
  prazo_pagamento: number; status: string; observacoes: string | null;
  fornecedores: Fornecedor;
  contratos_terceiros_equipamentos: ContratoEquip[];
}
interface CustoTerceiro {
  id: string; equipamento_id: string; descricao: string; tipo: string;
  valor: number; data: string; classificacao: string;
}
interface EquipFormItem {
  equipamento_id: string; tipo: string; modelo: string; tag_placa: string | null;
  horas_medidas: number; horas_normais: number; horas_excedentes: number;
  valor_hora: number; valor_hora_excedente: number; hora_minima: number;
  horas_contratadas: number; primeiro_mes: boolean;
  data_entrega: string | null; data_devolucao: string | null;
  cobranca_parcial: "horas_trabalhadas" | "proporcional_minimo";
}

// Saved measurement record
interface MedicaoSalva {
  id: string; contrato_id: string; periodo: string; periodo_inicio: string; periodo_fim: string;
  valor_total: number; status: string; created_at: string;
  contratos_terceiros: { fornecedores: Fornecedor };
}

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MedicaoTerceirosTab = () => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formContratoId, setFormContratoId] = useState("");
  const [formMedicaoInicio, setFormMedicaoInicio] = useState("");
  const [formMedicaoFim, setFormMedicaoFim] = useState("");
  const [equipForms, setEquipForms] = useState<EquipFormItem[]>([]);
  const [custos, setCustos] = useState<CustoTerceiro[]>([]);
  const [loadingMedicoes, setLoadingMedicoes] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Saved records
  const [savedItems, setSavedItems] = useState<MedicaoSalva[]>([]);
  const [filterFornecedor, setFilterFornecedor] = useState("all");

  const { toast } = useToast();

  const fetchData = async () => {
    const [ctRes, savedRes] = await Promise.all([
      supabase.from("contratos_terceiros")
        .select("*, fornecedores(id, nome, cnpj), contratos_terceiros_equipamentos(equipamento_id, valor_hora, valor_hora_excedente, horas_contratadas, hora_minima, data_entrega, data_devolucao)")
        .eq("status", "Ativo").order("created_at", { ascending: false }),
      (supabase.from as any)("medicoes_terceiros_faturamento")
        .select("*, contratos_terceiros(fornecedores(id, nome, cnpj))")
        .order("created_at", { ascending: false }),
    ]);
    if (ctRes.data) setContratos(ctRes.data as unknown as Contrato[]);
    if (savedRes.data) setSavedItems(savedRes.data as unknown as MedicaoSalva[]);
    // If error on savedRes (table may not exist yet), just set empty
    if (savedRes.error) setSavedItems([]);
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-fill period dates from contract
  const onContratoChange = (contratoId: string) => {
    setFormContratoId(contratoId);
    const ct = contratos.find(c => c.id === contratoId);
    if (ct) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed
      const inicio = new Date(year, month, ct.dia_medicao_inicio);
      const fim = new Date(year, month, Math.min(ct.dia_medicao_fim, new Date(year, month + 1, 0).getDate()));
      setFormMedicaoInicio(inicio.toISOString().slice(0, 10));
      setFormMedicaoFim(fim.toISOString().slice(0, 10));
    }
    setEquipForms([]);
  };

  const fetchMedicoes = useCallback(async () => {
    const ct = contratos.find(c => c.id === formContratoId);
    if (!ct || !formMedicaoInicio || !formMedicaoFim) { setEquipForms([]); return; }
    setLoadingMedicoes(true);

    const ceList = ct.contratos_terceiros_equipamentos || [];
    const equipIds = ceList
      .filter(ce => !(ce.data_devolucao && ce.data_devolucao <= formMedicaoInicio))
      .filter(ce => !(ce.data_entrega && ce.data_entrega > formMedicaoFim))
      .map(ce => ce.equipamento_id);

    if (equipIds.length === 0) { setEquipForms([]); setLoadingMedicoes(false); return; }

    const [equipRes, custosRes] = await Promise.all([
      supabase.from("equipamentos_terceiros").select("id, tipo, modelo, tag_placa, numero_serie").in("id", equipIds),
      supabase.from("custos_terceiros").select("id, descricao, tipo, valor, data, equipamento_id, classificacao")
        .in("equipamento_id", equipIds).gte("data", formMedicaoInicio).lte("data", formMedicaoFim),
    ]);

    const equipMap = new Map((equipRes.data || []).map(e => [e.id, e]));
    setCustos((custosRes.data || []) as CustoTerceiro[]);

    // Fetch measurements per equipment
    const medPromises = equipIds.map(eqId => Promise.all([
      supabase.from("medicoes_terceiros").select("equipamento_id, horimetro_final, data")
        .eq("equipamento_id", eqId).eq("tipo", "Trabalho")
        .lt("data", formMedicaoInicio).order("data", { ascending: false }).limit(1),
      supabase.from("medicoes_terceiros").select("equipamento_id, horas_trabalhadas, tipo, horimetro_final, data")
        .eq("equipamento_id", eqId).gte("data", formMedicaoInicio).lte("data", formMedicaoFim),
    ]));
    const medResults = await Promise.all(medPromises);

    const newEquipForms: EquipFormItem[] = equipIds.map((eqId, idx) => {
      const ce = ceList.find(c => c.equipamento_id === eqId)!;
      const eq = equipMap.get(eqId);
      const [baselineRes, periodRes] = medResults[idx];
      const dataEntrega = ce.data_entrega;
      const dataDevolucao = ce.data_devolucao;

      let horasMedidas = 0;
      if (ct.tipo_medicao === "diarias") {
        const trabalho = (periodRes.data || []).filter((m: any) => m.tipo === "Trabalho");
        horasMedidas = new Set(trabalho.map((m: any) => String(m.data))).size;
      } else {
        const allReadings: { data: string; horimetro_final: number }[] = [];
        if (baselineRes.data && baselineRes.data.length > 0) {
          allReadings.push({ data: baselineRes.data[0].data, horimetro_final: Number(baselineRes.data[0].horimetro_final) });
        }
        const trabalho = (periodRes.data || []).filter((m: any) => m.tipo === "Trabalho");
        for (const m of trabalho) {
          allReadings.push({ data: String(m.data), horimetro_final: Number(m.horimetro_final) });
        }
        const inicioEfetivo = dataEntrega && dataEntrega > formMedicaoInicio && dataEntrega <= formMedicaoFim ? dataEntrega : formMedicaoInicio;
        const fimEfetivo = dataDevolucao && dataDevolucao >= formMedicaoInicio && dataDevolucao < formMedicaoFim ? dataDevolucao : formMedicaoFim;
        const result = calcularHorasInterpoladas(allReadings, inicioEfetivo, fimEfetivo);
        horasMedidas = result.totalHoras;
      }

      let horasContratadas = Number(ce.horas_contratadas);
      let horaMinima = Number(ce.hora_minima);

      // Check if proportional (delivery or return within the cycle)
      const temEntregaNoPeriodo = dataEntrega && dataEntrega > formMedicaoInicio && dataEntrega <= formMedicaoFim;
      const temDevolucaoNoPeriodo = dataDevolucao && dataDevolucao >= formMedicaoInicio && dataDevolucao < formMedicaoFim;
      const isProporcional = !!(temEntregaNoPeriodo || temDevolucaoNoPeriodo);

      let horasEfetivas: number;
      if (isProporcional) {
        // Proportional period: charge exclusively based on actual hours worked, no minimum
        horasEfetivas = horasMedidas;
      } else {
        // Full period: apply hora minima
        horasEfetivas = horaMinima > 0 && horasMedidas < horaMinima ? horaMinima : horasMedidas;
      }

      const horasNormais = Number(Math.min(horasEfetivas, horasContratadas).toFixed(1));
      const horasExcedentes = Number(Math.max(0, horasEfetivas - horasContratadas).toFixed(1));

      return {
        equipamento_id: eqId,
        tipo: eq?.tipo || "", modelo: eq?.modelo || "", tag_placa: eq?.tag_placa || null,
        horas_medidas: horasMedidas, horas_normais: horasNormais, horas_excedentes: horasExcedentes,
        valor_hora: Number(ce.valor_hora), valor_hora_excedente: Number(ce.valor_hora_excedente),
        hora_minima: horaMinima, horas_contratadas: horasContratadas,
        primeiro_mes: isProporcional, data_entrega: dataEntrega, data_devolucao: dataDevolucao,
        cobranca_parcial: "horas_trabalhadas" as const,
      };
    });

    setEquipForms(newEquipForms);
    setLoadingMedicoes(false);
  }, [contratos, formContratoId, formMedicaoInicio, formMedicaoFim]);

  // Change cobrança parcial mode
  const changeCobrancaParcial = (idx: number, mode: "horas_trabalhadas" | "proporcional_minimo") => {
    setEquipForms(prev => {
      const updated = [...prev];
      const ef = { ...updated[idx] };
      ef.cobranca_parcial = mode;
      if (mode === "proporcional_minimo" && formMedicaoInicio && formMedicaoFim) {
        const totalDiasCiclo = Math.max(1, Math.round((parseLocalDate(formMedicaoFim).getTime() - parseLocalDate(formMedicaoInicio).getTime()) / 86400000) + 1);
        const inicioEf = ef.data_entrega && ef.data_entrega > formMedicaoInicio && ef.data_entrega <= formMedicaoFim ? ef.data_entrega : formMedicaoInicio;
        const fimEf = ef.data_devolucao && ef.data_devolucao >= formMedicaoInicio && ef.data_devolucao < formMedicaoFim ? ef.data_devolucao : formMedicaoFim;
        const diasProp = Math.max(1, Math.round((parseLocalDate(fimEf).getTime() - parseLocalDate(inicioEf).getTime()) / 86400000) + 1);
        const propMinimo = Number(((ef.horas_contratadas / totalDiasCiclo) * diasProp).toFixed(1));
        const horasEfetivas = Math.max(propMinimo, ef.horas_medidas);
        ef.horas_normais = Number(Math.min(horasEfetivas, ef.horas_contratadas).toFixed(1));
        ef.horas_excedentes = Number(Math.max(0, horasEfetivas - ef.horas_contratadas).toFixed(1));
      } else {
        ef.horas_normais = Number(Math.min(ef.horas_medidas, ef.horas_contratadas).toFixed(1));
        ef.horas_excedentes = Number(Math.max(0, ef.horas_medidas - ef.horas_contratadas).toFixed(1));
      }
      updated[idx] = ef;
      return updated;
    });
  };

  // Total calculations
  const totalNormais = equipForms.reduce((s, ef) => s + ef.horas_normais * ef.valor_hora, 0);
  const totalExcedentes = equipForms.reduce((s, ef) => s + ef.horas_excedentes * ef.valor_hora_excedente, 0);
  const totalCustos = custos.reduce((s, c) => s + Number(c.valor), 0);
  const valorTotal = totalNormais + totalExcedentes + totalCustos;

  const openNew = () => {
    setEditing(null);
    setFormContratoId("");
    setFormMedicaoInicio("");
    setFormMedicaoFim("");
    setEquipForms([]);
    setCustos([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formContratoId || !formMedicaoInicio || !formMedicaoFim) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const ct = contratos.find(c => c.id === formContratoId);
    const periodo = `${new Date(formMedicaoInicio + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(formMedicaoFim + "T00:00:00").toLocaleDateString("pt-BR")}`;

    const payload = {
      contrato_id: formContratoId,
      periodo,
      periodo_inicio: formMedicaoInicio,
      periodo_fim: formMedicaoFim,
      valor_total: valorTotal,
      status: "Pendente",
      detalhes: equipForms.map(ef => ({
        equipamento_id: ef.equipamento_id,
        tipo: ef.tipo, modelo: ef.modelo, tag_placa: ef.tag_placa,
        horas_medidas: ef.horas_medidas, horas_normais: ef.horas_normais,
        horas_excedentes: ef.horas_excedentes, valor_hora: ef.valor_hora,
        valor_hora_excedente: ef.valor_hora_excedente,
      })),
    };

    if (editing) {
      const { error } = await (supabase.from as any)("medicoes_terceiros_faturamento").update(payload).eq("id", editing);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Medição atualizada" });
    } else {
      const { error } = await (supabase.from as any)("medicoes_terceiros_faturamento").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Medição registrada" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await (supabase.from as any)("medicoes_terceiros_faturamento").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Medição excluída" });
    fetchData();
  };

  const filteredSaved = savedItems.filter(item => {
    if (filterFornecedor !== "all" && item.contratos_terceiros?.fornecedores?.id !== filterFornecedor) return false;
    return true;
  });

  const uniqueFornecedores = Array.from(new Map(
    contratos.map(c => [c.fornecedores.id, c.fornecedores])
  ).values());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Medição</Button>
        <div className="flex-1" />
        <SearchableSelect
          value={filterFornecedor}
          onValueChange={setFilterFornecedor}
          placeholder="Todos fornecedores"
          options={[{ value: "all", label: "Todos" }, ...uniqueFornecedores.map(f => ({ value: f.id, label: f.nome }))]}
        />
      </div>

      {/* Saved measurements list */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSaved.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.contratos_terceiros?.fornecedores?.nome || "—"}</TableCell>
                <TableCell>{item.periodo}</TableCell>
                <TableCell className="font-bold">R$ {fmt(Number(item.valor_total))}</TableCell>
                <TableCell>
                  <Badge variant={item.status === "Aprovado" ? "default" : "secondary"}>{item.status}</Badge>
                </TableCell>
                <TableCell>{new Date(item.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredSaved.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma medição registrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* New/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              {editing ? "Editar Medição" : "Nova Medição"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Contract + period selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Contrato / Fornecedor *</Label>
                <SearchableSelect
                  value={formContratoId}
                  onValueChange={onContratoChange}
                  placeholder="Selecione..."
                  options={contratos.map(c => ({
                    value: c.id,
                    label: `${c.fornecedores.nome} (${c.contratos_terceiros_equipamentos?.length || 0} equip.)`,
                  }))}
                />
              </div>
              <div>
                <Label>Período Início</Label>
                <Input type="date" value={formMedicaoInicio} onChange={e => setFormMedicaoInicio(e.target.value)} />
              </div>
              <div>
                <Label>Período Fim</Label>
                <Input type="date" value={formMedicaoFim} onChange={e => setFormMedicaoFim(e.target.value)} />
              </div>
            </div>

            {formContratoId && formMedicaoInicio && formMedicaoFim && (
              <Button variant="outline" size="sm" onClick={fetchMedicoes} disabled={loadingMedicoes}>
                {loadingMedicoes ? "Calculando..." : "Calcular Medição"}
              </Button>
            )}

            {/* Equipment measurement results */}
            {equipForms.length > 0 && (
              <>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipamento</TableHead>
                        <TableHead className="text-right">Horas Medidas</TableHead>
                        <TableHead className="text-right">H. Normais</TableHead>
                        <TableHead className="text-right">H. Excedentes</TableHead>
                        <TableHead className="text-right">Valor/Hora</TableHead>
                        <TableHead className="text-right">Val. Excedente</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipForms.map((ef, idx) => {
                        const sub = ef.horas_normais * ef.valor_hora + ef.horas_excedentes * ef.valor_hora_excedente;
                        return (
                          <TableRow key={ef.equipamento_id}>
                            <TableCell className="font-medium">
                              <div>{ef.tipo} {ef.modelo}</div>
                              {ef.tag_placa && <span className="text-xs font-mono text-muted-foreground">{ef.tag_placa}</span>}
                              {ef.primeiro_mes && <Badge variant="outline" className="ml-1 text-[10px]">Proporcional</Badge>}
                              {ef.primeiro_mes && (
                                <div className="mt-1">
                                  <Select value={ef.cobranca_parcial} onValueChange={(v) => changeCobrancaParcial(idx, v as "horas_trabalhadas" | "proporcional_minimo")}>
                                    <SelectTrigger className="h-6 text-[10px] w-48">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="horas_trabalhadas">Horas Trabalhadas</SelectItem>
                                      <SelectItem value="proporcional_minimo">Proporcional Mínimo</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{ef.horas_medidas.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{ef.horas_normais.toFixed(1)}</TableCell>
                            <TableCell className="text-right">
                              {ef.horas_excedentes > 0 ? (
                                <Badge variant="destructive" className="text-xs">{ef.horas_excedentes.toFixed(1)}</Badge>
                              ) : "0.0"}
                            </TableCell>
                            <TableCell className="text-right">R$ {fmt(ef.valor_hora)}</TableCell>
                            <TableCell className="text-right">R$ {fmt(ef.valor_hora_excedente)}</TableCell>
                            <TableCell className="text-right font-bold">R$ {fmt(sub)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Custos */}
                {custos.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm">Custos no Período</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {custos.map(c => (
                            <TableRow key={c.id}>
                              <TableCell>{c.descricao}</TableCell>
                              <TableCell><Badge variant="outline">{c.tipo}</Badge></TableCell>
                              <TableCell className="text-right font-medium">R$ {fmt(Number(c.valor))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Totals */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Horas Normais</p>
                      <p className="text-lg font-bold">R$ {fmt(totalNormais)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Horas Excedentes</p>
                      <p className="text-lg font-bold text-destructive">R$ {fmt(totalExcedentes)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Custos</p>
                      <p className="text-lg font-bold">R$ {fmt(totalCustos)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-accent/30 bg-accent/5">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground font-medium">Valor Total</p>
                      <p className="text-xl font-bold text-accent">R$ {fmt(valorTotal)}</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={equipForms.length === 0}>Salvar Medição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir medição?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
