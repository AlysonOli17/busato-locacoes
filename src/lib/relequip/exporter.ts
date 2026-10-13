import * as XLSX from "xlsx";
import type { Relequip } from "./types";
import { SITUACOES_VENDA, formatDateBR } from "./types";

/**
 * Exporta no mesmo layout da planilha RELEQUIP (abas FROTA, VENDIDOS - DEVOLVIDOS e VENDA),
 * permitindo editar no Excel e reimportar sem perder o padrão.
 */

const FROTA_COLS: [string, keyof Relequip][] = [
  ["CENTRO DE CUSTO", "centro_custo"],
  ["GESTOR", "gestor"],
  ["MEV", "mev"],
  ["SITUAÇÃO", "situacao"],
  ["OBSERVAÇÃO / INVENTÁRIO", "observacao"],
  ["Placa", "placa"],
  ["TAG", "tag"],
  ["TE + TAG", "te_tag"],
  ["Frota", "frota"],
  ["Situação2", "situacao_cadastro"],
  ["Tipo de Implemento", "tipo_implemento"],
  ["TE", "te"],
  ["Modelo", "modelo"],
  ["Descrição", "descricao"],
  ["Capacidade", "capacidade"],
  ["Peso Operacional", "peso_operacional"],
  ["Fabricante", "fabricante"],
  ["Nota Fiscal", "nota_fiscal"],
  ["Chassi ou Série", "chassi_serie"],
  ["Renavan", "renavam"],
  ["Ano Fab.", "ano_fabricacao"],
  ["Ano Mod.", "ano_modelo"],
  ["Combustível", "combustivel"],
  ["Data de Compra", "data_compra"],
  ["Garantia de Fábrica", "garantia_fabrica"],
  ["Comprador(a)", "comprador"],
  ["Comprado de", "comprado_de"],
  ["Cor", "cor"],
  ["Estado", "estado"],
  ["Data de Venda", "data_venda"],
  ["Vendido para", "vendido_para"],
];

const BAIXADOS_COLS: [string, keyof Relequip][] = [
  ["OBSERVAÇÃO / INVENTÁRIO", "observacao"],
  ["Placa", "placa"],
  ["TAG", "tag"],
  ["TE + TAG", "te_tag"],
  ["Frota", "frota"],
  ["Situação", "situacao_cadastro"],
  ["Tipo de Implemento", "tipo_implemento"],
  ["TE", "te"],
  ["Modelo", "modelo"],
  ["Descrição", "descricao"],
  ["Capacidade", "capacidade"],
  ["Peso Operacional", "peso_operacional"],
  ["Fabricante", "fabricante"],
  ["Nota Fiscal", "nota_fiscal"],
  ["Chassi ou Série", "chassi_serie"],
  ["Renavan", "renavam"],
  ["Ano Fab.", "ano_fabricacao"],
  ["Ano Mod.", "ano_modelo"],
  ["Combustível", "combustivel"],
  ["Data de Compra", "data_compra"],
  ["Garantia de Fábrica", "garantia_fabrica"],
  ["Comprador(a)", "comprador"],
  ["Comprado de", "comprado_de"],
  ["Cor", "cor"],
  ["Estado", "estado"],
  ["Localidade", "localidade"],
  ["Data de Venda", "data_venda"],
  ["Vendido para", "vendido_para"],
  ["Observação", "observacao_baixa"],
];

const DATE_KEYS = new Set<keyof Relequip>(["data_compra", "garantia_fabrica", "data_venda"]);

const cell = (r: Relequip, k: keyof Relequip) => {
  const v = r[k];
  if (v === null || v === undefined) return null;
  if (DATE_KEYS.has(k)) return formatDateBR(String(v));
  if (k === "placa" && !v) return "N/A";
  return v;
};

const widths = (cols: [string, keyof Relequip][]) =>
  cols.map(([h, k]) => ({ wch: Math.max(h.length + 2, ["observacao", "vendido_para", "comprador", "comprado_de", "observacao_baixa"].includes(k) ? 36 : 14) }));

export function exportRelequipXlsx(registros: Relequip[], nomeArquivo?: string) {
  const wb = XLSX.utils.book_new();
  const hoje = new Date().toLocaleDateString("pt-BR");

  const frota = registros.filter((r) => r.grupo === "frota").sort((a, b) => (Number(a.tag) || 0) - (Number(b.tag) || 0));
  const baixados = registros.filter((r) => r.grupo === "baixado").sort((a, b) => (Number(a.tag) || 0) - (Number(b.tag) || 0));
  const venda = frota
    .filter((r) => SITUACOES_VENDA.includes(r.situacao ?? ""))
    .sort((a, b) => (a.situacao === b.situacao ? 0 : a.situacao === "Av. Venda" ? -1 : 1));

  // FROTA (com as duas linhas de título como na planilha original)
  const wsFrota = XLSX.utils.aoa_to_sheet([
    ["RELEQUIP - RELAÇÃO DE VEÍCULOS E EQUIPAMENTOS"],
    [`Atualizado em ${hoje}`],
    FROTA_COLS.map(([h]) => h),
    ...frota.map((r) => FROTA_COLS.map(([, k]) => cell(r, k))),
  ]);
  wsFrota["!cols"] = widths(FROTA_COLS);
  wsFrota["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: 2 + frota.length, c: FROTA_COLS.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, wsFrota, "FROTA");

  // VENDIDOS - DEVOLVIDOS
  const wsBaix = XLSX.utils.aoa_to_sheet([
    BAIXADOS_COLS.map(([h]) => h),
    ...baixados.map((r) => BAIXADOS_COLS.map(([, k]) => cell(r, k))),
  ]);
  wsBaix["!cols"] = widths(BAIXADOS_COLS);
  XLSX.utils.book_append_sheet(wb, wsBaix, "VENDIDOS - DEVOLVIDOS");

  // VENDA
  const wsVenda = XLSX.utils.aoa_to_sheet([
    ["CENTRO DE CUSTO", "PLACA / TAG", "SITUAÇÃO", "FABRICANTE", "MODELO", "ANO", "OBSERVAÇÃO / INVENTÁRIO", "CUSTO RECUPERAÇÃO", "DIAS PARADO"],
    ...venda.map((r) => [
      r.centro_custo,
      r.placa || r.te_tag,
      r.situacao,
      r.fabricante,
      r.modelo,
      r.ano_fabricacao,
      r.observacao_venda ?? r.observacao,
      r.custo_recuperacao ?? r.custo_recuperacao_obs,
      r.tempo_parado,
    ]),
  ]);
  wsVenda["!cols"] = [18, 14, 12, 16, 20, 8, 60, 20, 14].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsVenda, "VENDA");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, nomeArquivo ?? `RELEQUIP_${stamp}.xlsx`);
}
