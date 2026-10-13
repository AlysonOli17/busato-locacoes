import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  parseRelequipWorkbook,
  diffWithExisting,
  type ParseResult,
  type ImportDiff,
} from "@/lib/relequip/parser";
import type { Relequip, RelequipInsert } from "@/lib/relequip/types";
import { CAMPO_LABEL } from "@/lib/relequip/types";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  FileCheck,
} from "lucide-react";

interface RelequipImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existentes: Relequip[];
  onConfirmarImportacao: (registros: RelequipInsert[]) => Promise<void>;
}

export const RelequipImportDialog: React.FC<RelequipImportDialogProps> = ({
  open,
  onOpenChange,
  existentes,
  onConfirmarImportacao,
}) => {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultadoParse, setResultadoParse] = useState<ParseResult | null>(null);
  const [diff, setDiff] = useState<ImportDiff | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processarArquivo(file);
  };

  const processarArquivo = async (file: File) => {
    setArquivo(file);
    setErro(null);
    setProcessando(true);
    try {
      const buffer = await file.arrayBuffer();
      const res = parseRelequipWorkbook(new Uint8Array(buffer));
      setResultadoParse(res);

      const d = diffWithExisting(res.registros, existentes);
      setDiff(d);
    } catch (err: any) {
      console.error(err);
      setErro(err?.message || "Erro ao ler o arquivo Excel. Verifique se o formato é válido.");
      setResultadoParse(null);
      setDiff(null);
    } finally {
      setProcessando(false);
    }
  };

  const handleConfirmar = async () => {
    if (!resultadoParse) return;
    setSalvando(true);
    try {
      await onConfirmarImportacao(resultadoParse.registros);
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      console.error(err);
      setErro(err?.message || "Erro ao gravar dados no sistema.");
    } finally {
      setSalvando(false);
    }
  };

  const resetState = () => {
    setArquivo(null);
    setErro(null);
    setResultadoParse(null);
    setDiff(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!salvando) {
          onOpenChange(v);
          if (!v) resetState();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2 border-b border-border/50">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            Importar Planilha RELEQUIP
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {/* Zona de Upload */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/60 transition-colors rounded-xl p-6 text-center cursor-pointer bg-muted/10 hover:bg-muted/20"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <Upload className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold text-foreground">
                {arquivo ? arquivo.name : "Clique para selecionar ou arraste o arquivo Excel"}
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                Lê as abas <span className="font-semibold text-foreground">FROTA</span>,{" "}
                <span className="font-semibold text-foreground">VENDIDOS - DEVOLVIDOS</span> e{" "}
                <span className="font-semibold text-foreground">VENDA</span>.
              </p>
            </div>
          </div>

          {processando && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              Lendo abas e comparando com o banco de dados...
            </div>
          )}

          {erro && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Resultado da Leitura e Diff */}
          {resultadoParse && diff && (
            <div className="space-y-4 text-xs">
              {/* Abas e resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="text-[11px] text-muted-foreground">Total Identificado</div>
                  <div className="text-lg font-bold text-foreground">
                    {resultadoParse.registros.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {resultadoParse.totalFrota} frota · {resultadoParse.totalBaixados} baixados
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Novos Registros</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {diff.novos.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Serão inseridos</div>
                </div>

                <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/5">
                  <div className="text-[11px] text-sky-700 dark:text-sky-400">Alterações Detectadas</div>
                  <div className="text-lg font-bold text-sky-600 dark:text-sky-400">
                    {diff.alterados.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Serão atualizados</div>
                </div>

                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="text-[11px] text-muted-foreground">Sem Alteração</div>
                  <div className="text-lg font-bold text-muted-foreground">
                    {diff.semAlteracao}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Já atualizados</div>
                </div>
              </div>

              {/* Status das abas lidas */}
              <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-emerald-500" />
                  Abas processadas com sucesso:
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {resultadoParse.abasLidas.map((aba) => (
                    <Badge key={aba} variant="outline" className="text-xs bg-background">
                      {aba}
                    </Badge>
                  ))}
                  {resultadoParse.temAbaVenda && (
                    <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400">
                      73 orçamentos/dias parados da aba VENDA vinculados
                    </Badge>
                  )}
                </div>
              </div>

              {/* Pré-visualização de Alterações */}
              {diff.alterados.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-foreground">
                    Amostra das atualizações ({diff.alterados.length} no total):
                  </div>
                  <div className="max-h-44 overflow-y-auto border border-border/60 rounded-lg p-2 space-y-1.5 bg-background">
                    {diff.alterados.slice(0, 10).map((alt) => (
                      <div
                        key={alt.registro.te_tag}
                        className="p-1.5 rounded bg-muted/30 text-[11px] flex items-center justify-between"
                      >
                        <span className="font-bold font-mono text-foreground">
                          {alt.registro.te_tag}
                        </span>
                        <div className="text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          {alt.alteracoes.map((c) => (
                            <span key={c.campo} className="inline-flex items-center gap-1">
                              <span className="font-medium text-foreground">
                                {CAMPO_LABEL[c.campo] || c.campo}:
                              </span>
                              <span className="line-through">{String(c.de ?? "—")}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="text-primary font-semibold">
                                {String(c.para ?? "—")}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {diff.alterados.length > 10 && (
                      <div className="text-[11px] text-center text-muted-foreground pt-1">
                        + {diff.alterados.length - 10} outros registros atualizados
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmar}
            disabled={!resultadoParse || salvando || processando}
          >
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Gravando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Confirmar Importação ({resultadoParse ? resultadoParse.registros.length : 0})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
