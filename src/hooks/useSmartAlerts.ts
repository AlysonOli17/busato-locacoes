import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pushToastNotification } from "@/components/NotificationsDropdown";
import { defaultAlertConfig } from "@/pages/Configuracoes";

export function useSmartAlerts() {
  const hasRun = useRef(false);

  useEffect(() => {
    // Only run once per session to avoid spamming the user on every render/navigation
    if (hasRun.current) return;
    hasRun.current = true;

    const checkAlerts = async () => {
      try {
        let config = defaultAlertConfig;
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data, error } = await supabase
            .from("alertas_configuracoes")
            .select("*")
            .eq("user_id", session.user.id)
            .maybeSingle();
            
          if (data) {
            config = {
              enableApolices: data.enable_apolices,
              enableContratos: data.enable_contratos,
              enableManutencao: data.enable_manutencao,
              enableMedicaoAtrasada: data.enable_medicao_atrasada,
              enableFaturamentoPendente: data.enable_faturamento_pendente,
              enableChecklistPendente: data.enable_checklist_pendente,
              daysAntecedencia: data.days_antecedencia || 15
            };
          }
        }

        const today = new Date();
        const limitDate = new Date();
        limitDate.setDate(today.getDate() + config.daysAntecedencia);
        const limitDateStr = limitDate.toISOString().split("T")[0];
        const todayStr = today.toISOString().split("T")[0];

        // 1. Apólices Vencendo
        if (config.enableApolices) {
          const { data: apolices } = await supabase
          .from("apolices")
          .select("id, seguradora, vigencia_fim")
          .eq("status", "Vigente")
          .lte("vigencia_fim", limitDateStr)
          .gte("vigencia_fim", todayStr);

        if (apolices && apolices.length > 0) {
          apolices.forEach(apolice => {
            const dataFimFmt = new Date(apolice.vigencia_fim).toLocaleDateString("pt-BR", { timeZone: "UTC" });
            setTimeout(() => {
              pushToastNotification({
                id: `apolice-${apolice.id}`,
                titulo: "Seguro Próximo do Vencimento",
                mensagem: `A apólice da seguradora ${apolice.seguradora} vai vencer no dia ${dataFimFmt}.`,
              });
            }, 1000); // Small delay to avoid playing sound at the exact same millisecond
          });
        } 
        } // End of config.enableApolices

        // 2. Contratos Vencendo
        if (config.enableContratos) {
          const { data: contratos } = await supabase
          .from("contratos")
          .select("id, data_fim, empresas(nome, razao_social)")
          .eq("status", "Ativo")
          .lte("data_fim", limitDateStr)
          .gte("data_fim", todayStr);

        if (contratos && contratos.length > 0) {
          contratos.forEach((contrato, idx) => {
            const nomeCliente = contrato.empresas?.nome || contrato.empresas?.razao_social || "Cliente Desconhecido";
            const dataFimFmt = new Date(contrato.data_fim).toLocaleDateString("pt-BR", { timeZone: "UTC" });
            setTimeout(() => {
              pushToastNotification({
                id: `contrato-${contrato.id}`,
                titulo: "Contrato Expirando",
                mensagem: `O contrato ativo de ${nomeCliente} encerra no dia ${dataFimFmt}.`,
              });
            }, 2000 + (idx * 500)); 
          });
        } 
        } // End of config.enableContratos

        // 3. Equipamentos em Manutenção
        if (config.enableManutencao) {
          const { data: equipamentos } = await supabase
          .from("equipamentos")
          .select("id, tipo, modelo, tag_placa")
          .eq("status", "Manutenção");

        if (equipamentos && equipamentos.length > 0) {
          equipamentos.forEach((eq, idx) => {
            setTimeout(() => {
              pushToastNotification({
                id: `eq-manutencao-${eq.id}`,
                titulo: "Máquina Parada",
                mensagem: `${eq.tipo} ${eq.modelo} (${eq.tag_placa || "Sem placa"}) continua registrada em Manutenção no sistema.`,
              });
            }, 3500 + (idx * 500));
          });
        } // End of Equipamentos if
        } // End of config.enableManutencao

        // 4. Medição Atrasada
        if (config.enableMedicaoAtrasada) {
          const diaAtual = today.getDate();
          
          const { data: contratosMedicao } = await supabase
            .from("contratos")
            .select("id, dia_medicao_fim, empresas(nome, razao_social)")
            .eq("status", "Ativo")
            .not("dia_medicao_fim", "is", null);
            
          if (contratosMedicao && contratosMedicao.length > 0) {
            contratosMedicao.forEach((c, idx) => {
              if (c.dia_medicao_fim && diaAtual > c.dia_medicao_fim) {
                // Em um cenário real, aqui checaríamos se já existe faturamento para o mês atual.
                // Como não temos a data exata do último faturamento no objeto contrato, 
                // vamos alertar se passou até 5 dias do dia de corte (para não alertar o mês todo).
                if (diaAtual <= c.dia_medicao_fim + 5) {
                  const nomeCliente = c.empresas?.nome || c.empresas?.razao_social || "Cliente Desconhecido";
                  setTimeout(() => {
                    pushToastNotification({
                      id: `medicao-atrasada-${c.id}`,
                      titulo: "Medição Atrasada",
                      mensagem: `O ciclo do contrato de ${nomeCliente} fechou dia ${c.dia_medicao_fim}. Verifique as medições.`,
                    });
                  }, 4000 + (idx * 500));
                }
              }
            });
          }
        } // End of enableMedicaoAtrasada
        
        // 5. Faturamento Pendente
        if (config.enableFaturamentoPendente) {
          const { data: faturamentosPendente } = await supabase
            .from("faturamento")
            .select("id, contrato_id, periodo")
            .eq("status", "Pendente");
            
          if (faturamentosPendente && faturamentosPendente.length > 0) {
            faturamentosPendente.forEach((fat, idx) => {
              setTimeout(() => {
                pushToastNotification({
                  id: `fat-pendente-${fat.id}`,
                  titulo: "Faturamento Pendente",
                  mensagem: `Existem faturas aprovadas aguardando emissão para o período ${fat.periodo}.`,
                });
              }, 5000 + (idx * 500));
            });
          }
        } // End of enableFaturamentoPendente

        // 6. Checklist Pendente
        if (config.enableChecklistPendente) {
          const { data: eqContratos } = await supabase
            .from("contratos_equipamentos")
            .select("id, data_entrega, data_devolucao, equipamentos(tipo, modelo, tag_placa)")
            .or(`data_entrega.lte.${limitDateStr},data_devolucao.lte.${limitDateStr}`);
            
          if (eqContratos && eqContratos.length > 0) {
            eqContratos.forEach((eqc, idx) => {
              const eq = eqc.equipamentos;
              if (eq) {
                let motivo = "";
                let data = "";
                if (eqc.data_entrega && eqc.data_entrega <= limitDateStr && eqc.data_entrega >= todayStr) {
                  motivo = "Mobilização (Entrega)";
                  data = new Date(eqc.data_entrega).toLocaleDateString("pt-BR", { timeZone: "UTC" });
                } else if (eqc.data_devolucao && eqc.data_devolucao <= limitDateStr && eqc.data_devolucao >= todayStr) {
                  motivo = "Desmobilização (Devolução)";
                  data = new Date(eqc.data_devolucao).toLocaleDateString("pt-BR", { timeZone: "UTC" });
                }
                
                if (motivo) {
                  setTimeout(() => {
                    pushToastNotification({
                      id: `checklist-pendente-${eqc.id}`,
                      titulo: "Checklist Pendente",
                      mensagem: `Lembrete de checklist de ${motivo} do equipamento ${eq.tag_placa || eq.tipo} previsto para ${data}.`,
                    });
                  }, 6000 + (idx * 500));
                }
              }
            });
          }
        } // End of enableChecklistPendente
        
      } catch (error) {
        console.error("Erro ao rodar o Robô de Alertas:", error);
      }
    };

    checkAlerts();
  }, []);
}
