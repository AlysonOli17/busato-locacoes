import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import ExcelJS from "exceljs";

interface ImportFaturasDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  empresasMap: Map<string, any>; // Map of empresa names to IDs
  contratos: any[]; // Active contracts
}

interface PreviewRow {
  empresaStr: string;
  dataEmissao: string;
  periodo: string;
  valorTotal: number;
  notaFiscal: string;
  empresaEncontrada?: any;
  contratoEncontrado?: any;
  status: "Pronto" | "Empresa não encontrada" | "Contrato não encontrado" | "Erro nos dados";
}

export const ImportFaturasDialog = ({ isOpen, onClose, onSuccess, empresasMap, contratos }: ImportFaturasDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    await parseExcel(selectedFile);
  };

  const cleanString = (str: any) => {
    if (!str) return "";
    return String(str).trim().toLowerCase();
  };

  const parseDate = (val: any): string => {
    if (!val) return "";
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    // Try to parse string DD/MM/YYYY
    const str = String(val).trim();
    if (str.includes("/")) {
      const parts = str.split("/");
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return str;
  };

  const parseExcel = async (file: File) => {
    setLoading(true);
    setPreview([]);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];

      const rows: PreviewRow[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const empresaStr = row.getCell(1).text || "";
        const dataEmissaoRaw = row.getCell(2).value;
        const periodo = row.getCell(3).text || "";
        const valorTotalRaw = row.getCell(4).value;
        const notaFiscal = row.getCell(5).text || "";

        if (!empresaStr && !valorTotalRaw) return; // Skip empty rows

        const dataEmissao = parseDate(dataEmissaoRaw);
        const valorTotal = Number(valorTotalRaw) || 0;

        // Try to match Empresa by CNPJ only
        const cleanEmpresaStr = String(empresaStr).replace(/\D/g, '');
        let empresaEncontrada = null;
        let contratoEncontrado = null;
        let status: PreviewRow["status"] = "Erro nos dados";

        if (cleanEmpresaStr) {
          // Exact Match
          for (const [id, emp] of Array.from(empresasMap.entries())) {
            if (cleanString(emp.cnpj).replace(/\D/g, '') === cleanEmpresaStr) {
              empresaEncontrada = emp;
              break;
            }
          }

          // Fallback: Match Root CNPJ (first 8 digits) Se a filial for diferente
          if (!empresaEncontrada && cleanEmpresaStr.length >= 8) {
            const rootCnpj = cleanEmpresaStr.substring(0, 8);
            for (const [id, emp] of Array.from(empresasMap.entries())) {
              const empCnpj = cleanString(emp.cnpj).replace(/\D/g, '');
              if (empCnpj.length >= 8 && empCnpj.substring(0, 8) === rootCnpj) {
                empresaEncontrada = emp;
                break;
              }
            }
          }

          if (empresaEncontrada) {
            // Find active contract for this company
            const activeContracts = contratos.filter(c => c.empresa_id === empresaEncontrada.id);
            if (activeContracts.length > 0) {
              // Just pick the first active one for simplicity
              contratoEncontrado = activeContracts[0];
              status = "Pronto";
            } else {
              status = "Contrato não encontrado";
            }
          } else {
            status = "Empresa não encontrada";
          }
        }

        if (status === "Pronto" && (!dataEmissao || valorTotal <= 0)) {
          status = "Erro nos dados";
        }

        rows.push({
          empresaStr,
          dataEmissao,
          periodo,
          valorTotal,
          notaFiscal,
          empresaEncontrada,
          contratoEncontrado,
          status
        });
      });

      setPreview(rows);
    } catch (error: any) {
      toast({
        title: "Erro ao ler arquivo",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const validRows = preview.filter(r => r.status === "Pronto");
    if (validRows.length === 0) {
      toast({ title: "Nenhuma fatura válida", description: "Verifique os erros antes de importar.", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      // Get the current max numero_sequencial
      const { data: maxSeqData } = await supabase
        .from('faturamento')
        .select('numero_sequencial')
        .order('numero_sequencial', { ascending: false })
        .limit(1);
        
      let nextSeq = (maxSeqData?.[0]?.numero_sequencial || 0) + 1;

      const faturasToInsert = validRows.map(row => {
        const seq = nextSeq++;
        return {
          id: crypto.randomUUID(),
          contrato_id: row.contratoEncontrado.id,
          numero_sequencial: seq,
          periodo: row.periodo || "Histórico Importado",
          horas_normais: 0,
          horas_excedentes: 0,
          valor_hora: 0,
          valor_excedente_hora: 0,
          valor_total: row.valorTotal,
          status: "Aprovado",
          emissao: row.dataEmissao || new Date().toISOString().slice(0, 10),
          data_aprovacao: row.dataEmissao || new Date().toISOString().slice(0, 10),
          numero_nota: row.notaFiscal || null,
        };
      });

      const { error } = await supabase.from('faturamento').insert(faturasToInsert);

      if (error) throw error;

      toast({
        title: "Importação concluída!",
        description: `${validRows.length} faturas foram importadas com sucesso.`,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Importação Faturas");
    
    worksheet.columns = [
      { header: "CNPJ da Empresa", key: "empresa", width: 25 },
      { header: "Data Emissão (DD/MM/AAAA)", key: "emissao", width: 25 },
      { header: "Período (Ex: 01/01 a 31/01)", key: "periodo", width: 25 },
      { header: "Valor Total", key: "valor", width: 15 },
      { header: "Nota Fiscal", key: "nf", width: 20 },
    ];

    // Add a sample row
    worksheet.addRow({
      empresa: "54.167.719/0001-40",
      emissao: "10/05/2026",
      periodo: "01/04 a 30/04",
      valor: 5000.00,
      nf: "NF-1234"
    });

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Modelo_Importacao_Faturas.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Histórico de Faturas
          </DialogTitle>
          <DialogDescription>
            Faça o upload de uma planilha Excel (.xlsx) com o histórico de faturamentos para vinculá-los automaticamente aos contratos ativos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {!file ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-12 text-center space-y-4 bg-muted/20">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <Upload className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Selecione a Planilha</h3>
                <p className="text-sm text-muted-foreground mt-1">Formatos suportados: .xlsx</p>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <Button variant="outline" onClick={() => document.getElementById("excel-upload")?.click()} disabled={loading}>
                  Procurar Arquivo
                </Button>
                <input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button variant="ghost" onClick={downloadTemplate} className="text-primary hover:text-primary/80">
                  Baixar Modelo
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
                  <div>
                    <p className="font-bold text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{preview.length} linhas encontradas</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setFile(null); setPreview([]); }}>
                  Trocar Arquivo
                </Button>
              </div>

              {preview.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted sticky top-0 z-10">
                        <TableRow>
                          <TableHead>CNPJ (Planilha)</TableHead>
                          <TableHead>Contrato Vinculado</TableHead>
                          <TableHead>Emissão</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium text-xs">{row.empresaStr}</TableCell>
                            <TableCell className="text-xs">
                              {row.empresaEncontrada ? (
                                <span className="font-semibold text-primary">{row.empresaEncontrada.nome}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{row.dataEmissao}</TableCell>
                            <TableCell className="text-xs">{row.periodo}</TableCell>
                            <TableCell className="text-xs text-right font-black">
                              R$ {row.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {row.status === "Pronto" ? (
                                <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                  <CheckCircle2 className="h-3 w-3" /> Pronto
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-500 text-xs font-bold">
                                  <AlertCircle className="h-3 w-3" /> {row.status}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={onClose} disabled={importing}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || importing || loading || preview.filter(r => r.status === "Pronto").length === 0}
          >
            {importing ? "Importando..." : `Importar ${preview.filter(r => r.status === "Pronto").length} Faturas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
