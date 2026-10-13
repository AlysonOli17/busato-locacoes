import React from "react";
import type { Relequip } from "@/lib/relequip/types";
import { formatDateBR, formatCurrencyBR, situacaoStyle } from "@/lib/relequip/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Truck, Calendar, DollarSign, FileText, CheckCircle2 } from "lucide-react";

interface RelequipDetalhesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro: Relequip | null;
}

export const RelequipDetalhesDialog: React.FC<RelequipDetalhesDialogProps> = ({
  open,
  onOpenChange,
  registro,
}) => {
  if (!registro) return null;

  const style = situacaoStyle(registro.situacao);

  const Campo = ({ label, valor }: { label: string; valor: any }) => (
    <div>
      <span className="text-[11px] font-medium text-muted-foreground block">{label}</span>
      <span className="text-xs font-semibold text-foreground">{valor || "—"}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              {registro.te_tag} {registro.placa ? `(${registro.placa})` : ""}
            </DialogTitle>
            <Badge variant="outline" className={`text-xs border ${style.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${style.dot}`} />
              {registro.situacao || registro.situacao_cadastro || "—"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2 text-xs">
          {/* Seção 1: Operação e Gestão */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2.5">
              Operação & Gestão
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg border border-border/60 bg-muted/20">
              <Campo label="Centro de Custo" valor={registro.centro_custo} />
              <Campo label="Gestor Responsável" valor={registro.gestor} />
              <Campo label="MEV" valor={registro.mev} />
              <Campo label="Tipo da Frota" valor={registro.frota} />
              <Campo label="Estado (UF)" valor={registro.estado} />
              <Campo label="Situação Cadastral" valor={registro.situacao_cadastro} />
              <Campo label="Localidade" valor={registro.localidade} />
              <Campo label="Origem dos Dados" valor={registro.ultima_origem === "importacao" ? "Planilha Excel" : "Manual"} />
            </div>
          </div>

          {/* Seção 2: Identificação do Veículo / Equipamento */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2.5">
              Identificação & Especificações
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg border border-border/60 bg-muted/20">
              <Campo label="Fabricante" valor={registro.fabricante} />
              <Campo label="Modelo" valor={registro.modelo} />
              <Campo label="Tipo de Implemento" valor={registro.tipo_implemento} />
              <Campo label="Descrição" valor={registro.descricao} />
              <Campo label="Ano Fabricação/Mod." valor={`${registro.ano_fabricacao || "—"}/${registro.ano_modelo || "—"}`} />
              <Campo label="Combustível" valor={registro.combustivel} />
              <Campo label="Capacidade" valor={registro.capacidade} />
              <Campo label="Peso Operacional" valor={registro.peso_operacional} />
              <Campo label="Cor" valor={registro.cor} />
              <Campo label="Chassi ou Série" valor={registro.chassi_serie} />
              <Campo label="Renavam" valor={registro.renavam} />
              <Campo label="Nota Fiscal" valor={registro.nota_fiscal} />
            </div>
          </div>

          {/* Seção 3: Aquisição & Baixa */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2.5">
              Aquisição & Baixa
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg border border-border/60 bg-muted/20">
              <Campo label="Data de Compra" valor={formatDateBR(registro.data_compra)} />
              <Campo label="Garantia de Fábrica" valor={formatDateBR(registro.garantia_fabrica)} />
              <Campo label="Comprador" valor={registro.comprador} />
              <Campo label="Comprado de" valor={registro.comprado_de} />
              <Campo label="Data da Venda/Baixa" valor={formatDateBR(registro.data_venda)} />
              <Campo label="Vendido para" valor={registro.vendido_para} />
            </div>
          </div>

          {/* Seção 4: Acompanhamento de Venda (caso aplicável) */}
          {(registro.tempo_parado || registro.custo_recuperacao !== null || registro.observacao_venda) && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2.5">
                Acompanhamento de Venda & Recuperação
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <Campo label="Tempo Parado" valor={registro.tempo_parado} />
                <Campo
                  label="Custo de Recuperação"
                  valor={
                    typeof registro.custo_recuperacao === "number" && registro.custo_recuperacao > 0
                      ? formatCurrencyBR(registro.custo_recuperacao)
                      : registro.custo_recuperacao_obs || "—"
                  }
                />
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    Observação Técnica da Venda
                  </span>
                  <p className="text-xs font-semibold text-foreground mt-0.5">
                    {registro.observacao_venda || "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Observações Gerais */}
          {(registro.observacao || registro.observacao_baixa) && (
            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 space-y-2">
              {registro.observacao && (
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    Observação / Inventário:
                  </span>
                  <p className="text-xs text-foreground mt-0.5">{registro.observacao}</p>
                </div>
              )}
              {registro.observacao_baixa && (
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    Observação de Baixa:
                  </span>
                  <p className="text-xs text-foreground mt-0.5">{registro.observacao_baixa}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
