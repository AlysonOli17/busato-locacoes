import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { parseRelequipWorkbook, diffWithExisting, toISODate } from "./parser";
import type { Relequip } from "./types";
import { tempoParadoEmDias } from "./types";

const FROTA_HEADER = [
  "CENTRO DE CUSTO", "GESTOR ", "MEV", "SITUAÇÃO", "OBSERVAÇÃO / INVENTÁRIO", "Placa", "TAG", "TE + TAG",
  "Frota", "Situação2", "Tipo de Implemento", "TE", "Modelo", "Descrição", "Capacidade", "Peso Operacional",
  "Fabricante", "Nota Fiscal", "Chassi ou Série", "Renavan", "Ano Fab.", "Ano Mod.", "Combustível",
  "Data de Compra", "Garantia de Fábrica", "Comprador(a)", "Comprado de", "Cor", "Estado", "Data de Venda", "Vendido para",
];

function buildWorkbook() {
  const wb = XLSX.utils.book_new();
  const frota = [
    ["RELEQUIP - RELAÇÃO DE VEÍCULOS E EQUIPAMENTOS"],
    ["Atualizado em 10/09/2026"],
    FROTA_HEADER,
    ["BASE (ES)", "Diretoria ", "Não", "Venda", "Patio 2", "N/A", "105", "pc-105", "Próprio", "Ativo", "Pá Carregadeira", "PC",
      "962 H", "Pá Carregadeira", "11.808 kg", "19.043 kg", "Caterpillar", "237811", "CAT0962", null, "2008", "2008", "Diesel",
      43190, null, null, null, "Amarelo", "Disponível", null, null],
    ["EVENTUAL (ES)", "Alyson Oliveira", "Não", "Av. Venda", "Analisar Venda", "OYH8782", "148", "CBK-148", "Próprio", "Ativo",
      "Sem implemento", "CBK", "1319", "Caminhão Brook", "8 Toneladas", null, "Ford", null, "9BF", "1013406700", "2014", "2014",
      "Diesel", "7/1/2014", null, null, null, "Branco", "ES", null, null],
    [null, null, null, null, "linha sem tag"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(frota), "FROTA");

  const vendidos = [
    [],
    ["OBSERVAÇÃO / INVENTÁRIO", "Placa", "TAG", "TE + TAG", "Frota", "Situação", "Tipo de Implemento", "Estado", "Localidade", "Data de Venda", "Vendido para", "Observação", "OBSERVAÇÃO 2"],
    [null, "MRA9520", "104", "CC-104", "Próprio", "Vendido", "Carroceria", "Vendido", "Vendido", 45399, "Fulano", "pago", "Locação Centro Avante"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vendidos), "VENDIDOS - DEVOLVIDOS");

  const venda = [
    ["CENTRO DE CUSTO", "PLACA / TAG", "SITUAÇÃO", "FABRICANTE", "MODELO", "ANO", "OBSERVAÇÃO / INVENTÁRIO", " CUSTO RECUPERAÇÃO ", "DIAS PARADO"],
    ["EVENTUAL (ES)", "OYH8782", "Av. Venda", "Ford", "1319", "2014", "ANALISAR VENDA", 16000, "2 MESES"],
    ["CENTRO DE CUSTO", "PLACA / TAG", "SITUAÇÃO", "FABRICANTE", "MODELO", "ANO", "OBSERVAÇÃO", " CUSTO RECUPERAÇÃO ", "DIAS PARADO"],
    ["BASE (ES)", "PC-105", "Venda", "Caterpillar", "962H", "2008", "SUCATA", "ORÇANDO", "1 ANO (+)"],
    ["BASE (ES)", "ZZZ9999", "Venda", "X", "Y", "2000", "?", 0, "1 ANO"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(venda), "VENDA");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}

describe("toISODate", () => {
  it("converte serial do Excel, dd/mm/aaaa e ISO", () => {
    expect(toISODate(43190)).toBe("2018-03-31");
    expect(toISODate("31/03/2018")).toBe("2018-03-31");
    expect(toISODate("2018-03-31")).toBe("2018-03-31");
    expect(toISODate("Vitória - Tubarão")).toBeNull();
    expect(toISODate(null)).toBeNull();
  });
});

describe("tempoParadoEmDias", () => {
  it("interpreta os textos da aba VENDA", () => {
    expect(tempoParadoEmDias("1 ANO (+)")).toBe(365);
    expect(tempoParadoEmDias("21 MESES")).toBe(630);
    expect(tempoParadoEmDias("60 DIAS ")).toBe(60);
    expect(tempoParadoEmDias("ATUANDO")).toBe(0);
    expect(tempoParadoEmDias(null)).toBeNull();
  });
});

describe("parseRelequipWorkbook", () => {
  const res = parseRelequipWorkbook(buildWorkbook());
  const byTag = Object.fromEntries(res.registros.map((r) => [r.te_tag, r]));

  it("lê as abas e localiza cabeçalhos automaticamente", () => {
    expect(res.abasLidas).toEqual(["FROTA", "VENDIDOS - DEVOLVIDOS", "VENDA"]);
    expect(res.totalFrota).toBe(2);
    expect(res.totalBaixados).toBe(1);
    expect(Object.keys(byTag).sort()).toEqual(["CBK-148", "CC-104", "PC-105"]);
  });

  it("normaliza texto, placa, ano, datas e UF", () => {
    const pc = byTag["PC-105"];
    expect(pc.gestor).toBe("Diretoria");
    expect(pc.placa).toBeNull(); // "N/A"
    expect(pc.ano_fabricacao).toBe(2008);
    expect(pc.data_compra).toBe("2018-03-31");
    expect(pc.estado).toBe("ES"); // "Disponível" -> UF do centro de custo
    expect(pc.grupo).toBe("frota");
  });

  it("trata a aba VENDIDOS como baixados", () => {
    const cc = byTag["CC-104"];
    expect(cc.grupo).toBe("baixado");
    expect(cc.situacao_cadastro).toBe("Vendido");
    expect(cc.data_venda).toBe("2024-04-17");
    expect(cc.observacao_baixa).toBe("pago | Locação Centro Avante");
  });

  it("casa a aba VENDA por placa ou TE+TAG", () => {
    expect(byTag["CBK-148"].custo_recuperacao).toBe(16000);
    expect(byTag["CBK-148"].tempo_parado).toBe("2 MESES");
    expect(byTag["CBK-148"].observacao_venda).toBe("ANALISAR VENDA");
    expect(byTag["PC-105"].custo_recuperacao).toBeNull();
    expect(byTag["PC-105"].custo_recuperacao_obs).toBe("ORÇANDO");
    expect(res.vendaSemCorrespondencia).toEqual(["ZZZ9999"]);
  });

  it("avisa sobre linhas sem TE+TAG", () => {
    expect(res.avisos.some((a) => a.mensagem.includes("sem TE + TAG"))).toBe(true);
  });

  it("diff identifica novos, alterados, iguais e ausentes", () => {
    const existentes = [
      { ...byTag["PC-105"], id: "1" },
      { ...byTag["CBK-148"], id: "2", situacao: "Atuando" },
      { te_tag: "XX-1", id: "3" },
    ] as unknown as Relequip[];
    const d = diffWithExisting(res.registros, existentes);
    expect(d.novos.map((n) => n.registro.te_tag)).toEqual(["CC-104"]);
    expect(d.alterados).toHaveLength(1);
    expect(d.alterados[0].alteracoes).toEqual([{ campo: "situacao", de: "Atuando", para: "Av. Venda" }]);
    expect(d.semAlteracao).toBe(1);
    expect(d.ausentesNaPlanilha.map((a) => a.te_tag)).toEqual(["XX-1"]);
  });
});

// Verificação com a planilha real, quando ela estiver na pasta scratch/ (não roda no CI).
const REAL = path.resolve(__dirname, "../../../scratch/RELEQUIP_2026_RECUPERADAxx.xlsx");
describe.skipIf(!fs.existsSync(REAL))("planilha real RELEQUIP", () => {
  it("lê a frota e os vendidos sem perder linhas", () => {
    const buf = fs.readFileSync(REAL);
    const res = parseRelequipWorkbook(new Uint8Array(buf));
    const frota = res.registros.filter((r) => r.grupo === "frota");
    const baixados = res.registros.filter((r) => r.grupo === "baixado");
    console.log({
      frota: frota.length,
      baixados: baixados.length,
      venda: res.totalVenda,
      vendaSemCorrespondencia: res.vendaSemCorrespondencia,
      avisos: res.avisos.slice(0, 15),
      exemplo: frota.find((r) => r.te_tag === "PC-105"),
      exemploVenda: frota.find((r) => r.custo_recuperacao),
    });
    expect(frota.length).toBeGreaterThan(390);
    expect(baixados.length).toBeGreaterThan(250);
  });
});
