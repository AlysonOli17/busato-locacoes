import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { createNotification } from "@/lib/notificationService";
import { getDisplayStatus } from "@/lib/utils";

const parseLocalDate = (dateStr: any): Date => {
  if (!dateStr) return new Date(NaN);
  const str = String(dateStr).trim();
  const d = str.includes("T") ? new Date(str) : new Date(str + "T00:00:00");
  return d;
};

const calcPeriodForMonth = (ct: any, year: number, month: number) => {
  const diaInicio = ct.dia_medicao_inicio || 1;
  const diaFim = ct.dia_medicao_fim || 30;
  let mesInicio = month;
  let anoInicio = year;
  let mesFim = month;
  let anoFim = year;
  if (diaFim < diaInicio) {
    mesFim = month;
    anoFim = year;
    mesInicio = month - 1;
    if (mesInicio < 0) { mesInicio = 11; anoInicio--; }
  }
  const lastDayInicio = new Date(anoInicio, mesInicio + 1, 0).getDate();
  const lastDayFim = new Date(anoFim, mesFim + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const inicio = `${anoInicio}-${pad(mesInicio + 1)}-${pad(Math.min(diaInicio, lastDayInicio))}`;
  const fim = `${anoFim}-${pad(mesFim + 1)}-${pad(Math.min(diaFim, lastDayFim))}`;
  return { inicio, fim };
};

const parsePeriodoKey = (periodo?: string | null) => {
  if (!periodo) return null;
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const normalized = periodo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const monthIndex = meses.findIndex(m => normalized.includes(m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
  const year = periodo.match(/\b(20\d{2}|19\d{2})\b/)?.[1];
  if (monthIndex < 0 || !year) return null;
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
};

export function useAlertasEngine() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const runEngine = async () => {
      const lastCheck = sessionStorage.getItem("last_alert_check");
      const now = Date.now();
      if (lastCheck && now - Number(lastCheck) < 60 * 60 * 1000) {
        return;
      }
      sessionStorage.setItem("last_alert_check", String(now));

      try {
        const hoje = new Date();
        const hojeStr = hoje.toISOString().slice(0, 10);
        const trintaDiasFrente = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const seteDiasFrente = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const [
          contratosRes,
          apolicesRes,
          apolicesEqRes,
          equipamentosRes,
          checklistsRes,
          ceRes,
          faturasRes,
          medicoesRes,
          comodatosRes,
          custosRes,
          empresasRes
        ] = await Promise.all([
          supabase.from("contratos").select("*"),
          supabase.from("apolices").select("*"),
          supabase.from("apolices_equipamentos").select("*"),
          supabase.from("equipamentos").select("*"),
          supabase.from("checklists").select("*"),
          supabase.from("contratos_equipamentos").select("*"),
          supabase.from("faturamento").select("*"),
          supabase.from("medicoes").select("*"),
          supabase.from("comodatos").select("*"),
          supabase.from("equipamentos_custos").select("*"),
          supabase.from("empresas").select("id, nome")
        ]);

        const empresasMap = new Map((empresasRes.data || []).map(e => [e.id, e.nome]));
        const equipamentosMap = new Map((equipamentosRes.data || []).map(e => [e.id, e]));

        // 1. Contratos
        if (contratosRes.data) {
          for (const c of contratosRes.data) {
            if (c.status === "Ativo" && c.data_fim) {
              const empNome = empresasMap.get(c.empresa_id) || "Cliente";
              if (c.data_fim < hojeStr) {
                await createNotification({
                  userId: user.id,
                  tipo: "critico",
                  titulo: `Contrato Vencido Ativo`,
                  mensagem: `O contrato com a empresa ${empNome} está vencido desde ${c.data_fim} mas continua Ativo.`,
                  referenciaId: c.id,
                  referenciaTipo: "contratos"
                });
              } else if (c.data_fim <= trintaDiasFrente) {
                await createNotification({
                  userId: user.id,
                  tipo: "alerta",
                  titulo: `Contrato Vencendo`,
                  mensagem: `O contrato com a empresa ${empNome} vencerá em ${c.data_fim} (menos de 30 dias).`,
                  referenciaId: c.id,
                  referenciaTipo: "contratos"
                });
              }
            }
          }
        }

        // 2. Apólices
        if (apolicesRes.data) {
          for (const a of apolicesRes.data) {
            if (a.vigencia_fim) {
              if (a.vigencia_fim < hojeStr) {
                await createNotification({
                  userId: user.id,
                  tipo: "critico",
                  titulo: `Apólice Vencida`,
                  mensagem: `A apólice da seguradora ${a.seguradora} está vencida desde ${a.vigencia_fim}.`,
                  referenciaId: a.id,
                  referenciaTipo: "apolices"
                });
              } else if (a.vigencia_fim <= trintaDiasFrente) {
                await createNotification({
                  userId: user.id,
                  tipo: "alerta",
                  titulo: `Apólice Vencendo`,
                  mensagem: `A apólice da seguradora ${a.seguradora} vencerá em ${a.vigencia_fim} (menos de 30 dias).`,
                  referenciaId: a.id,
                  referenciaTipo: "apolices"
                });
              }
            }
          }
        }

        // 3. Equipamento locado sem apólice ativa
        if (contratosRes.data && apolicesRes.data && apolicesEqRes.data && ceRes.data) {
          const activeContracts = contratosRes.data.filter(c => c.status === "Ativo");
          const activeApolices = apolicesRes.data.filter(a => a.vigencia_fim >= hojeStr);
          const activeApoliceEqs = new Set(
            (apolicesEqRes.data || [])
              .filter(ae => activeApolices.some(a => a.id === ae.apolice_id))
              .map(ae => ae.equipamento_id)
          );

          for (const c of activeContracts) {
            const contractEqs = ceRes.data.filter(ce => ce.contrato_id === c.id && !ce.data_devolucao);
            const eqIds = contractEqs.map(ce => ce.equipamento_id);
            if (c.equipamento_id) eqIds.push(c.equipamento_id);

            for (const eqId of eqIds) {
              if (!activeApoliceEqs.has(eqId)) {
                const eq = equipamentosMap.get(eqId);
                const eqLabel = eq ? `${eq.tipo} ${eq.modelo} (${eq.tag_placa || "Sem placa"})` : "Equipamento";
                const empNome = empresasMap.get(c.empresa_id) || "Cliente";
                await createNotification({
                  userId: user.id,
                  tipo: "critico",
                  titulo: `Máquina Locada Sem Seguro Ativo`,
                  mensagem: `O equipamento ${eqLabel} está locado para ${empNome} mas não possui apólice de seguro ativa vinculada.`,
                  referenciaId: eqId,
                  referenciaTipo: "equipamentos"
                });
              }
            }
          }
        }

        // 4. Checklists de devolução pendentes
        if (ceRes.data && checklistsRes.data) {
          const devChecklists = new Set(
            (checklistsRes.data || [])
              .filter(c => c.tipo === "Devolução")
              .map(c => `${c.contrato_id}::${c.equipamento_id}`)
          );

          for (const ce of ceRes.data) {
            if (ce.data_devolucao) {
              const key = `${ce.contrato_id}::${ce.equipamento_id}`;
              if (!devChecklists.has(key)) {
                const eq = equipamentosMap.get(ce.equipamento_id);
                const eqLabel = eq ? `${eq.tipo} ${eq.modelo} (${eq.tag_placa || "Sem Placa"})` : "Equipamento";
                await createNotification({
                  userId: user.id,
                  tipo: "alerta",
                  titulo: `Checklist de Devolução Pendente`,
                  mensagem: `O equipamento ${eqLabel} foi desmobilizado em ${ce.data_devolucao} mas ainda não possui vistoria de devolução.`,
                  referenciaId: ce.id,
                  referenciaTipo: "contratos_equipamentos"
                });
              }
            }
          }
        }

        // 5. Comodatos Vencidos/Vencendo
        if (comodatosRes.data) {
          for (const com of comodatosRes.data) {
            if (com.status === "Ativo" && com.data_fim) {
              if (com.data_fim < hojeStr) {
                await createNotification({
                  userId: user.id,
                  tipo: "critico",
                  titulo: `Comodato Vencido Ativo`,
                  mensagem: `O comodato do equipamento id ${com.equipamento_id} está vencido desde ${com.data_fim} mas está com status Ativo.`,
                  referenciaId: com.id,
                  referenciaTipo: "comodatos"
                });
              } else if (com.data_fim <= trintaDiasFrente) {
                await createNotification({
                  userId: user.id,
                  tipo: "alerta",
                  titulo: `Comodato Vencendo`,
                  mensagem: `O comodato do equipamento id ${com.equipamento_id} vencerá em ${com.data_fim} (menos de 30 dias).`,
                  referenciaId: com.id,
                  referenciaTipo: "comodatos"
                });
              }
            }
          }
        }

        // 6. Custos com vencimento próximo (vencendo em <= 7 dias)
        if (custosRes.data) {
          for (const custo of custosRes.data) {
            if (custo.data_vencimento && custo.data_vencimento >= hojeStr && custo.data_vencimento <= seteDiasFrente) {
              await createNotification({
                userId: user.id,
                tipo: "alerta",
                titulo: `Custo Próximo ao Vencimento`,
                mensagem: `O custo "${custo.descricao}" (${custo.tipo}) vence em ${custo.data_vencimento}.`,
                referenciaId: custo.id,
                referenciaTipo: "equipamentos_custos"
              });
            }
          }
        }

        // 7. Faturas em atraso
        if (faturasRes.data) {
          for (const f of faturasRes.data) {
            const status = getDisplayStatus(f, null, "faturamento");
            if (status === "Em Atraso") {
              await createNotification({
                userId: user.id,
                tipo: "critico",
                titulo: `Fatura Em Atraso`,
                mensagem: `A fatura no valor de R$ ${Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} está vencida.`,
                referenciaId: f.id,
                referenciaTipo: "faturamento"
              });
            }
          }
        }

        // 8. Faturas Pendentes de Faturamento (A Faturar) e Medições pendentes
        if (contratosRes.data && faturasRes.data && medicoesRes.data && ceRes.data) {
          const contratosAtivos = contratosRes.data.filter(c => c.status === "Ativo");
          
          for (const ct of contratosAtivos) {
            const dataInicio = parseLocalDate(ct.data_inicio);
            if (isNaN(dataInicio.getTime()) || hoje < dataInicio) continue;

            const faturasContrato = faturasRes.data.filter(f => f.contrato_id === ct.id);
            if (faturasContrato.length === 0) continue;

            const primeiraMedicao = faturasContrato
              .map(f => f.periodo_medicao_inicio || (() => {
                const periodoKey = parsePeriodoKey(f.periodo);
                return periodoKey ? `${periodoKey}-01` : null;
              })())
              .filter((p): p is string => !!p)
              .sort()[0];
            if (!primeiraMedicao) continue;

            for (let offset = 0; offset <= 3; offset++) {
              const d = new Date(hoje.getFullYear(), hoje.getMonth() - offset, 1);
              const period = calcPeriodForMonth(ct, d.getFullYear(), d.getMonth());

              if (period.inicio < ct.data_inicio) continue;
              if (period.inicio < primeiraMedicao) continue;
              const periodEnd = parseLocalDate(period.fim);
              if (hoje <= periodEnd) continue;

              const ces = ceRes.data.filter(x => x.contrato_id === ct.id) || [];
              const globalDev: Record<string, string> = {};
              for (const ce of ces) {
                if (ce.data_devolucao && (!globalDev[ce.equipamento_id] || ce.data_devolucao > globalDev[ce.equipamento_id])) {
                  globalDev[ce.equipamento_id] = ce.data_devolucao;
                }
              }

              const allEquipIds = new Set<string>();
              for (const ce of ces) {
                allEquipIds.add(ce.equipamento_id);
              }
              if (allEquipIds.size === 0 && ct.equipamento_id) {
                allEquipIds.add(ct.equipamento_id);
              }

              if (allEquipIds.size > 0) {
                const allReturnedBeforePeriod = Array.from(allEquipIds).every(eqId => {
                  const devDate = globalDev[eqId];
                  return devDate && devDate <= period.inicio;
                });
                if (allReturnedBeforePeriod) continue;
              }

              const competencias = new Set([period.inicio.slice(0, 7), period.fim.slice(0, 7)]);
              const faturado = faturasContrato.some(f => {
                const periodoKey = parsePeriodoKey(f.periodo);
                if (f.periodo_medicao_inicio && f.periodo_medicao_fim) {
                  return f.periodo_medicao_inicio <= period.fim && f.periodo_medicao_fim >= period.inicio;
                }
                if (f.periodo_medicao_inicio) return f.periodo_medicao_inicio >= period.inicio && f.periodo_medicao_inicio <= period.fim;
                if (f.periodo_medicao_fim) return f.periodo_medicao_fim >= period.inicio && f.periodo_medicao_fim <= period.fim;
                return !!periodoKey && competencias.has(periodoKey);
              });
              if (faturado) continue;

              const contratoEquipIds = new Set([ct.equipamento_id, ...ces.map(e => e.equipamento_id)]);
              const temMedicao = medicoesRes.data.some(m => {
                if (!contratoEquipIds.has(m.equipamento_id)) return false;
                return m.data >= period.inicio && m.data <= period.fim;
              });

              const empNome = empresasMap.get(ct.empresa_id) || "Cliente";

              if (!temMedicao) {
                await createNotification({
                  userId: user.id,
                  tipo: "alerta",
                  titulo: `Pendente de Medição`,
                  mensagem: `O contrato com a empresa ${empNome} possui período de medição pendente: ${period.inicio} a ${period.fim}.`,
                  referenciaId: `${ct.id}::${period.inicio}`,
                  referenciaTipo: "medicoes_pendentes"
                });
              } else {
                await createNotification({
                  userId: user.id,
                  tipo: "alerta",
                  titulo: `Pendente de Faturamento`,
                  mensagem: `O contrato com a empresa ${empNome} tem medições prontas. Período a faturar: ${period.inicio} a ${period.fim}.`,
                  referenciaId: `${ct.id}::${period.inicio}`,
                  referenciaTipo: "faturamento_pendente"
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Erro no motor de alertas inteligentes:", error);
      }
    };

    runEngine();
  }, [user]);
}
