import React from "react";
import type { RelequipHistorico } from "@/lib/relequip/types";
import { CAMPO_LABEL } from "@/lib/relequip/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { History, ArrowRight, User, Calendar } from "lucide-react";

interface RelequipHistoricoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teTag?: string;
  historico: RelequipHistorico[];
  loading?: boolean;
}

export const RelequipHistoricoDialog: React.FC<RelequipHistoricoDialogProps> = ({
  open,
  onOpenChange,
  teTag,
  historico,
  loading,
}) => {
  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-3 border-b border-border/50">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Alterações {teTag ? `— ${teTag}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Carregando histórico...
            </div>
          ) : historico.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma alteração registrada ainda para este equipamento.
            </div>
          ) : (
            historico.map((item) => {
              const labelCampo = CAMPO_LABEL[item.campo] || item.campo;
              const isCadastro = item.campo === "cadastro";

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-semibold text-[11px] bg-background">
                        {labelCampo}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {item.origem === "importacao" ? "Planilha Excel" : "Edição Manual"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                      {item.user_name && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.user_name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>
                  </div>

                  {isCadastro ? (
                    <div className="text-muted-foreground">
                      Registro inicial cadastrado com situação:{" "}
                      <span className="font-semibold text-foreground">{item.valor_novo || "Ativo"}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap pt-1">
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground line-through">
                        {item.valor_anterior || "(vazio)"}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                        {item.valor_novo || "(vazio)"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
