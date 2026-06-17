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
        const saved = localStorage.getItem("smart-alerts-config");
        if (saved) {
          try { config = JSON.parse(saved); } catch (e) {}
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
        } 
        } // End of config.enableManutencao

      } catch (error) {
        console.error("Erro ao rodar o Robô de Alertas:", error);
      }
    };

    checkAlerts();
  }, []);
}
