import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Clock, AlertTriangle, CheckCircle2, DollarSign, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Fatura {
  id: string;
  contrato_id: string;
  numero_sequencial: number;
  periodo: string;
  valor_total: number;
  status: string;
  emissao: string;
  periodo_medicao_inicio: string | null;
  periodo_medicao_fim: string | null;
}

interface Contrato {
  id: string;
  empresa_id: string;
  equipamento_id: string | null;
  empresas: { nome: string; cnpj: string; obra: string | null } | null;
  equipamentos: { tipo: string; modelo: string; tag_placa: string | null } | null;
}

const parseLocalDate = (d: string) => new Date(d + "T00:00:00");

export function AprovarMedicoesView() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "aprovar" | "rejeitar" | "enviar";
    ids: string[];
  }>({ open: false, type: "enviar", ids: [] });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Sem cache — esta view precisa sempre de dados frescos após cada ação
  const fetchData = async () => {
    setLoading(true);
    try {
      const [fatRes, ctRes, empRes, eqRes] = await Promise.all([
        supabase
          .from("faturamento")
          .select("id, contrato_id, numero_sequencial, periodo, valor_total, status, emissao, periodo_medicao_inicio, periodo_medicao_fim")
          .in("status", ["Aguardando Aprovação", "Pendente"])
          .order("emissao", { ascending: false }),
        supabase.from("contratos").select("id, empresa_id, equipamento_id"),
        supabase.from("empresas").select("id, nome, cnpj, obra"),
        supabase.from("equipamentos").select("id, tipo, modelo, tag_placa"),
      ]);

      if (fatRes.data) setFaturas(fatRes.data as Fatura[]);

      if (ctRes.data && empRes.data && eqRes.data) {
        const empMap = new Map((empRes.data as any[]).map(e => [e.id, e]));
        const eqMap = new Map((eqRes.data as any[]).map(e => [e.id, e]));
        const mapped: Contrato[] = (ctRes.data as any[]).map(c => ({
          ...c,
          empresas: empMap.get(c.empresa_id) || null,
          equipamentos: c.equipamento_id ? eqMap.get(c.equipamento_id) || null : null,
        }));
        setContratos(mapped);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getContrato = (id: string) => contratos.find(c => c.id === id);

  // "Aguardando Aprovação" no banco = enviada ao cliente, aguardando resposta
  const aguardandoCliente = useMemo(() =>
    faturas.filter(f => f.status === "Aguardando Aprovação"), [faturas]);

  // "Pendente" = criada mas ainda não enviada ao cliente
  const naoEnviadas = useMemo(() =>
    faturas.filter(f => f.status === "Pendente"), [faturas]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (list: Fatura[]) => {
    const allSelected = list.length > 0 && list.every(f => selectedIds.has(f.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) { list.forEach(f => next.delete(f.id)); }
      else { list.forEach(f => next.add(f.id)); }
      return next;
    });
  };

  const handleAction = async (type: "aprovar" | "rejeitar" | "enviar", ids: string[]) => {
    setIsSaving(true);
    try {
      if (type === "enviar") {
        // Marca como enviada ao cliente (Aguardando Aprovação no banco)
        await Promise.all(ids.map(id =>
          supabase.from("faturamento").update({ status: "Aguardando Aprovação" } as any).eq("id", id)
        ));
        toast({ title: "Enviado ao cliente", description: `${ids.length} medição(ões) marcada(s) como enviada(s) ao cliente.` });
      } else if (type === "aprovar") {
        // Cliente confirmou → Aprovado → libera para faturar
        await Promise.all(ids.map(id =>
          supabase.from("faturamento").update({
            status: "Aprovado",
            data_aprovacao: new Date().toISOString(),
          } as any).eq("id", id)
        ));
        toast({ title: "Medições aprovadas!", description: `${ids.length} medição(ões) aprovada(s) pelo cliente. Prontas para faturar.` });
      } else {
        // Devolver para revisão → Pendente
        await Promise.all(ids.map(id =>
          supabase.from("faturamento").update({ status: "Pendente" } as any).eq("id", id)
        ));
        toast({ title: "Devolvidas para revisão", description: `${ids.length} medição(ões) devolvida(s).`, variant: "destructive" });
      }
      setSelectedIds(new Set());
      await fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Erro ao processar", variant: "destructive" });
    } finally {
      setIsSaving(false);
      setConfirmDialog(p => ({ ...p, open: false }));
    }
  };

  const FaturaRow = ({ f, section }: { f: Fatura; section: "aguardando" | "naoEnviada" }) => {
    const ct = getContrato(f.contrato_id);
    return (
      <TableRow className={cn("hover:bg-muted/30 transition-colors", selectedIds.has(f.id) && "bg-accent/5")}>
        <TableCell>
          <input
            type="checkbox"
            checked={selectedIds.has(f.id)}
            onChange={() => toggleSelect(f.id)}
            className="accent-accent h-4 w-4 rounded"
          />
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">{ct?.empresas?.nome || "—"}</span>
            {ct?.empresas?.obra && <span className="text-xs text-muted-foreground">{ct.empresas.obra}</span>}
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {ct?.equipamentos
            ? `${ct.equipamentos.tipo} ${ct.equipamentos.modelo}${ct.equipamentos.tag_placa ? ` (${ct.equipamentos.tag_placa})` : ""}`
            : "—"}
        </TableCell>
        <TableCell className="text-sm">{f.periodo}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {f.periodo_medicao_inicio && f.periodo_medicao_fim
            ? `${parseLocalDate(f.periodo_medicao_inicio).toLocaleDateString("pt-BR")} — ${parseLocalDate(f.periodo_medicao_fim).toLocaleDateString("pt-BR")}`
            : "—"}
        </TableCell>
        <TableCell className="text-sm font-semibold text-right">
          {Number(f.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </TableCell>
        <TableCell>
          {section === "aguardando" ? (
            <Badge className="bg-warning/10 text-warning border border-warning/30 text-xs gap-1">
              <Clock className="h-3 w-3" /> Aguard. Cliente
            </Badge>
          ) : (
            <Badge className="bg-muted text-muted-foreground border text-xs gap-1">
              <AlertTriangle className="h-3 w-3" /> Não enviada
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-1.5 flex-wrap">
            {section === "aguardando" && (
              <>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-success/10 text-success border border-success/30 hover:bg-success/20"
                  onClick={() => setConfirmDialog({ open: true, type: "aprovar", ids: [f.id] })}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Cliente Aprovou
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDialog({ open: true, type: "rejeitar", ids: [f.id] })}
                >
                  Devolver
                </Button>
              </>
            )}
            {section === "naoEnviada" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-accent/40 text-accent hover:bg-accent/10"
                onClick={() => setConfirmDialog({ open: true, type: "enviar", ids: [f.id] })}
              >
                <Send className="h-3 w-3 mr-1" /> Enviar ao Cliente
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const selectedAguardando = aguardandoCliente.filter(f => selectedIds.has(f.id));
  const selectedNaoEnviadas = naoEnviadas.filter(f => selectedIds.has(f.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Clock className="h-5 w-5 animate-spin text-accent" />
        <span>Carregando medições...</span>
      </div>
    );
  }

  const tableHeaders = (
    <TableHeader>
      <TableRow>
        <TableHead className="w-10" />
        <TableHead>Empresa</TableHead>
        <TableHead>Equipamento</TableHead>
        <TableHead>Referência</TableHead>
        <TableHead>Período de Medição</TableHead>
        <TableHead className="text-right">Valor</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Ações</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="bg-warning/5 border-warning/30">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center text-warning shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Aguard. Cliente</p>
              <h3 className="text-xl font-bold text-warning">{aguardandoCliente.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Não Enviadas</p>
              <h3 className="text-xl font-bold text-foreground">{naoEnviadas.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-accent/5 border-accent/20 col-span-2 lg:col-span-1">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Valor Total em Análise</p>
              <h3 className="text-lg font-bold text-accent truncate">
                {[...aguardandoCliente, ...naoEnviadas]
                  .reduce((s, f) => s + Number(f.valor_total || 0), 0)
                  .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch action bar */}
      {(selectedAguardando.length > 0 || selectedNaoEnviadas.length > 0) && (
        <div className="flex items-center gap-3 p-3 bg-accent/5 border border-accent/20 rounded-lg flex-wrap">
          <span className="text-sm font-medium">
            {selectedAguardando.length + selectedNaoEnviadas.length} selecionada(s)
          </span>
          <div className="flex gap-2 ml-auto flex-wrap">
            {selectedNaoEnviadas.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-accent/40 text-accent hover:bg-accent/10"
                onClick={() => setConfirmDialog({ open: true, type: "enviar", ids: selectedNaoEnviadas.map(f => f.id) })}
                disabled={isSaving}
              >
                <Send className="h-3.5 w-3.5 mr-1" /> Enviar Selecionadas ao Cliente
              </Button>
            )}
            {selectedAguardando.length > 0 && (
              <Button
                size="sm"
                className="h-8 text-xs bg-success text-success-foreground hover:bg-success/90"
                onClick={() => setConfirmDialog({ open: true, type: "aprovar", ids: selectedAguardando.map(f => f.id) })}
                disabled={isSaving}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Clientes Aprovaram ({selectedAguardando.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* SEÇÃO 1: Enviadas ao cliente, aguardando confirmação */}
      {aguardandoCliente.length > 0 && (
        <Card className="border-warning/30 shadow-sm">
          <CardHeader className="pb-3 border-b border-warning/20 bg-warning/5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="h-5 w-5 text-warning" />
              Enviadas ao Cliente — Aguardando Confirmação
              <Badge className="bg-warning text-warning-foreground ml-1">{aguardandoCliente.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Quando o cliente confirmar os valores, clique em <strong>"Cliente Aprovou"</strong> para liberar o faturamento.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="accent-accent h-4 w-4 rounded"
                      checked={aguardandoCliente.length > 0 && aguardandoCliente.every(f => selectedIds.has(f.id))}
                      onChange={() => toggleSelectAll(aguardandoCliente)}
                    />
                  </TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Período de Medição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aguardandoCliente.map(f => <FaturaRow key={f.id} f={f} section="aguardando" />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* SEÇÃO 2: Criadas mas ainda não enviadas ao cliente */}
      {naoEnviadas.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-border bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              Medições Criadas — Ainda Não Enviadas ao Cliente
              <Badge variant="outline" className="ml-1">{naoEnviadas.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Revise os valores e clique em <strong>"Enviar ao Cliente"</strong> quando estiver pronto.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="accent-accent h-4 w-4 rounded"
                      checked={naoEnviadas.length > 0 && naoEnviadas.every(f => selectedIds.has(f.id))}
                      onChange={() => toggleSelectAll(naoEnviadas)}
                    />
                  </TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Período de Medição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {naoEnviadas.map(f => <FaturaRow key={f.id} f={f} section="naoEnviada" />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {aguardandoCliente.length === 0 && naoEnviadas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-xl bg-card text-muted-foreground gap-3">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <div className="text-center">
            <p className="font-semibold text-foreground">Tudo em dia!</p>
            <p className="text-sm mt-1">Não há medições aguardando confirmação do cliente.</p>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={o => !o && setConfirmDialog(p => ({ ...p, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === "aprovar" && "Confirmar Aprovação do Cliente"}
              {confirmDialog.type === "enviar" && "Enviar Medição ao Cliente"}
              {confirmDialog.type === "rejeitar" && "Devolver para Revisão"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === "aprovar" &&
                `O cliente confirmou os valores de ${confirmDialog.ids.length} medição(ões)? Elas serão liberadas para faturamento.`}
              {confirmDialog.type === "enviar" &&
                `Confirma o envio de ${confirmDialog.ids.length} medição(ões) ao cliente? O status mudará para "Aguardando Cliente".`}
              {confirmDialog.type === "rejeitar" &&
                `${confirmDialog.ids.length} medição(ões) serão devolvidas para revisão (status Pendente).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                confirmDialog.type === "aprovar" && "bg-success text-success-foreground hover:bg-success/90",
                confirmDialog.type === "enviar" && "bg-accent text-accent-foreground hover:bg-accent/90",
                confirmDialog.type === "rejeitar" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
              onClick={() => handleAction(confirmDialog.type, confirmDialog.ids)}
            >
              {confirmDialog.type === "aprovar" && "Confirmar Aprovação"}
              {confirmDialog.type === "enviar" && "Confirmar Envio"}
              {confirmDialog.type === "rejeitar" && "Devolver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
