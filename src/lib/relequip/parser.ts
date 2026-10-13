import * as XLSX from "xlsx";
import type { Relequip, RelequipInsert } from "./types";
import { ufDoCentroCusto } from "./types";

/**
 * Leitura da planilha RELEQUIP.
 *
 * Abas reconhecidas (por nome, sem diferenciar acento/maiúsculas):
 *  - FROTA                   -> grupo "frota"
 *  - VENDIDOS - DEVOLVIDOS   -> grupo "baixado"
 *  - VENDA                   -> enriquece custo de recuperação / tempo parado / observação de venda
 * As demais abas (inventario, Planilha1...) são resumos calculados e são ignoradas.
 *
 * A linha de cabeçalho é localizada automaticamente (procura a coluna "TE + TAG"),
 * então linhas de título como "Atualizado em ..." não atrapalham.
 */

export interface ParseWarning {
  aba: string;
  linha: number;
  mensagem: string;
}

export interface ParseResult {
  registros: RelequipInsert[];
  abasLidas: string[];
  temAbaVenda: boolean;
  temAbaBaixados: boolean;
  totalFrota: number;
  totalBaixados: number;
  totalVenda: number;
  vendaSemCorrespondencia: string[];
  avisos: ParseWarning[];
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const clean = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};

const cleanPlaca = (v: unknown): string | null => {
  const s = clean(v);
  if (!s || /^(n\/?a|-|xx)$/i.test(s)) return null;
  return s.toUpperCase();
};

const placaKey = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const toInt = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v).replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? null : n;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Aceita serial do Excel, Date, "dd/mm/aaaa" ou "aaaa-mm-dd". Retorna ISO (aaaa-mm-dd) ou null. */
export const toISODate = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && v > 1000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  return null;
};

/** Cabeçalho normalizado da planilha -> coluna do banco. */
const HEADER_MAP: Record<string, keyof RelequipInsert> = {
  "centro de custo": "centro_custo",
  "gestor": "gestor",
  "mev": "mev",
  "situacao": "situacao",
  "observacao / inventario": "observacao",
  "placa": "placa",
  "tag": "tag",
  "te + tag": "te_tag",
  "frota": "frota",
  "situacao2": "situacao_cadastro",
  "tipo de implemento": "tipo_implemento",
  "te": "te",
  "modelo": "modelo",
  "descricao": "descricao",
  "capacidade": "capacidade",
  "peso operacional": "peso_operacional",
  "fabricante": "fabricante",
  "nota fiscal": "nota_fiscal",
  "chassi ou serie": "chassi_serie",
  "renavan": "renavam",
  "renavam": "renavam",
  "ano fab.": "ano_fabricacao",
  "ano mod.": "ano_modelo",
  "combustivel": "combustivel",
  "data de compra": "data_compra",
  "garantia de fabrica": "garantia_fabrica",
  "comprador(a)": "comprador",
  "comprado de": "comprado_de",
  "cor": "cor",
  "estado": "estado",
  "localidade": "localidade",
  "data de venda": "data_venda",
  "vendido para": "vendido_para",
  "observacao": "observacao_baixa",
};

const DATE_FIELDS = new Set<keyof RelequipInsert>(["data_compra", "garantia_fabrica", "data_venda"]);
const INT_FIELDS = new Set<keyof RelequipInsert>(["ano_fabricacao", "ano_modelo"]);

const findSheet = (wb: XLSX.WorkBook, ...names: string[]) =>
  wb.SheetNames.find((s) => names.some((n) => norm(s) === norm(n)));

const sheetRows = (wb: XLSX.WorkBook, name: string) =>
  XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null, raw: true, blankrows: true });

const findHeaderRow = (rows: unknown[][], mustContain: string) => {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if ((rows[i] || []).some((c) => norm(c) === mustContain)) return i;
  }
  return -1;
};

function parseCadastroSheet(
  wb: XLSX.WorkBook,
  sheet: string,
  grupo: "frota" | "baixado",
  avisos: ParseWarning[],
): RelequipInsert[] {
  const rows = sheetRows(wb, sheet);
  const h = findHeaderRow(rows, "te + tag");
  if (h < 0) {
    avisos.push({ aba: sheet, linha: 0, mensagem: 'Cabeçalho com a coluna "TE + TAG" não encontrado. Aba ignorada.' });
    return [];
  }

  // Mapeia índice -> campo. Na aba VENDIDOS, "Situação" é a situação cadastral (Vendido/Devolvido)
  // e a segunda coluna "OBSERVAÇÃO 2" é concatenada à observação de baixa.
  const colMap: { idx: number; field: keyof RelequipInsert }[] = [];
  const extraObsIdx: number[] = [];
  (rows[h] || []).forEach((cell, idx) => {
    const key = norm(cell);
    if (!key) return;
    if (grupo === "baixado") {
      if (key === "situacao") return colMap.push({ idx, field: "situacao_cadastro" });
      if (key === "observacao / inventario") return colMap.push({ idx, field: "observacao" });
      if (key === "observacao 2") return extraObsIdx.push(idx);
    }
    const field = HEADER_MAP[key];
    if (field && !colMap.some((c) => c.field === field)) colMap.push({ idx, field });
  });

  const out: RelequipInsert[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (!r.some((c) => clean(c))) continue;

    const rec: Record<string, unknown> = { grupo };
    for (const { idx, field } of colMap) {
      const v = r[idx];
      if (DATE_FIELDS.has(field)) {
        const iso = toISODate(v);
        if (!iso && clean(v)) {
          // Ex.: "Vitória - Tubarão" digitado na coluna de data -> guarda como localidade
          if (field === "data_venda" && !rec.localidade) rec.localidade = clean(v);
        }
        rec[field] = iso;
      } else if (INT_FIELDS.has(field)) {
        rec[field] = toInt(v);
      } else if (field === "placa") {
        rec[field] = cleanPlaca(v);
      } else {
        rec[field] = clean(v);
      }
    }

    const extra = extraObsIdx.map((idx) => clean(r[idx])).filter(Boolean).join(" | ");
    if (extra) rec.observacao_baixa = [rec.observacao_baixa, extra].filter(Boolean).join(" | ");

    const teTag = clean(rec.te_tag)?.toUpperCase();
    if (!teTag) {
      avisos.push({ aba: sheet, linha: i + 1, mensagem: "Linha sem TE + TAG — ignorada." });
      continue;
    }
    rec.te_tag = teTag;

    // A coluna "Estado" da FROTA às vezes contém "Disponível"/"Inativo": usa a UF do centro de custo.
    const est = clean(rec.estado);
    if (!est || !/^[A-Z]{2}$/.test(est)) {
      rec.estado = ufDoCentroCusto(rec.centro_custo as string | null) ?? (est && /^[A-Z]{2}$/.test(est) ? est : null);
    }

    out.push(rec as RelequipInsert);
  }
  return out;
}

interface VendaInfo {
  chave: string;
  custo_recuperacao: number | null;
  custo_recuperacao_obs: string | null;
  tempo_parado: string | null;
  observacao_venda: string | null;
}

function parseVendaSheet(wb: XLSX.WorkBook, sheet: string): VendaInfo[] {
  const rows = sheetRows(wb, sheet);
  const h = findHeaderRow(rows, "placa / tag");
  if (h < 0) return [];
  const header = (rows[h] || []).map(norm);
  const iChave = header.indexOf("placa / tag");
  const iObs = header.findIndex((c) => c.startsWith("observacao"));
  const iCusto = header.indexOf("custo recuperacao");
  const iDias = header.indexOf("dias parado");

  const out: VendaInfo[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const chave = clean(r[iChave]);
    if (!chave || norm(chave) === "placa / tag") continue; // linhas de cabeçalho repetidas
    const custoRaw = iCusto >= 0 ? r[iCusto] : null;
    const custoNum = typeof custoRaw === "number" ? custoRaw : null;
    out.push({
      chave,
      custo_recuperacao: custoNum,
      custo_recuperacao_obs: custoNum === null ? clean(custoRaw) : null,
      tempo_parado: iDias >= 0 ? clean(r[iDias]) : null,
      observacao_venda: iObs >= 0 ? clean(r[iObs]) : null,
    });
  }
  return out;
}

export function parseRelequipWorkbook(data: ArrayBuffer | Uint8Array): ParseResult {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const wb = XLSX.read(bytes, { type: "array" });
  const avisos: ParseWarning[] = [];
  const abasLidas: string[] = [];

  const abaFrota = findSheet(wb, "FROTA");
  const abaBaixados = findSheet(wb, "VENDIDOS - DEVOLVIDOS", "VENDIDOS-DEVOLVIDOS", "VENDIDOS");
  const abaVenda = findSheet(wb, "VENDA");

  if (!abaFrota && !abaBaixados) {
    throw new Error(`Não encontrei as abas "FROTA" ou "VENDIDOS - DEVOLVIDOS". Abas encontradas: [${wb.SheetNames.join(", ")}].`);
  }

  const frota = abaFrota ? parseCadastroSheet(wb, abaFrota, "frota", avisos) : [];
  if (abaFrota) abasLidas.push(abaFrota);
  const baixados = abaBaixados ? parseCadastroSheet(wb, abaBaixados, "baixado", avisos) : [];
  if (abaBaixados) abasLidas.push(abaBaixados);

  // Consolida por TE+TAG. Duplicidade dentro da mesma aba: vale a última linha.
  // Se o item estiver nas duas abas, prevalece VENDIDOS - DEVOLVIDOS (estado mais recente).
  const porTag = new Map<string, RelequipInsert>();
  for (const r of [...frota, ...baixados]) {
    const anterior = porTag.get(r.te_tag);
    if (anterior) {
      avisos.push({
        aba: r.grupo === "baixado" ? abaBaixados! : abaFrota!,
        linha: 0,
        mensagem: `${r.te_tag} aparece mais de uma vez${anterior.grupo !== r.grupo ? " (FROTA e VENDIDOS) — mantido como baixado" : " — mantida a última linha"}.`,
      });
    }
    porTag.set(r.te_tag, r);
  }

  // Aba VENDA: casa por TE+TAG ou placa
  const vendaSemCorrespondencia: string[] = [];
  let totalVenda = 0;
  if (abaVenda) {
    abasLidas.push(abaVenda);
    const porPlaca = new Map<string, RelequipInsert>();
    porTag.forEach((r) => r.placa && porPlaca.set(placaKey(r.placa), r));

    // Quando a aba VENDA existe ela é a fonte desses campos: zera quem não está nela.
    porTag.forEach((r) => {
      r.custo_recuperacao = null;
      r.custo_recuperacao_obs = null;
      r.tempo_parado = null;
      r.observacao_venda = null;
    });

    for (const v of parseVendaSheet(wb, abaVenda)) {
      totalVenda++;
      const alvo = porTag.get(v.chave.toUpperCase()) ?? porPlaca.get(placaKey(v.chave));
      if (!alvo) {
        vendaSemCorrespondencia.push(v.chave);
        continue;
      }
      alvo.custo_recuperacao = v.custo_recuperacao;
      alvo.custo_recuperacao_obs = v.custo_recuperacao_obs;
      alvo.tempo_parado = v.tempo_parado;
      alvo.observacao_venda = v.observacao_venda;
    }
  }

  return {
    registros: [...porTag.values()],
    abasLidas,
    temAbaVenda: !!abaVenda,
    temAbaBaixados: !!abaBaixados,
    totalFrota: frota.length,
    totalBaixados: baixados.length,
    totalVenda,
    vendaSemCorrespondencia,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// Comparação com o que já está no banco
// ---------------------------------------------------------------------------

export interface DiffItem {
  registro: RelequipInsert;
  existente?: Relequip;
  alteracoes: { campo: string; de: unknown; para: unknown }[];
}

export interface ImportDiff {
  novos: DiffItem[];
  alterados: DiffItem[];
  semAlteracao: number;
  ausentesNaPlanilha: Relequip[];
}

const same = (a: unknown, b: unknown) => {
  const na = a === undefined || a === "" ? null : a;
  const nb = b === undefined || b === "" ? null : b;
  if (typeof na === "number" || typeof nb === "number") return Number(na) === Number(nb) || (na === null && nb === null);
  return String(na ?? "") === String(nb ?? "");
};

export function diffWithExisting(registros: RelequipInsert[], existentes: Relequip[]): ImportDiff {
  const porTag = new Map(existentes.map((e) => [e.te_tag.toUpperCase(), e]));
  const vistos = new Set<string>();
  const novos: DiffItem[] = [];
  const alterados: DiffItem[] = [];
  let semAlteracao = 0;

  for (const reg of registros) {
    vistos.add(reg.te_tag);
    const ex = porTag.get(reg.te_tag);
    if (!ex) {
      novos.push({ registro: reg, alteracoes: [] });
      continue;
    }
    const alteracoes = Object.entries(reg)
      .filter(([k]) => k !== "te_tag")
      .filter(([k, v]) => !same((ex as Record<string, unknown>)[k], v))
      .map(([campo, para]) => ({ campo, de: (ex as Record<string, unknown>)[campo], para }));
    if (alteracoes.length) alterados.push({ registro: reg, existente: ex, alteracoes });
    else semAlteracao++;
  }

  return {
    novos,
    alterados,
    semAlteracao,
    ausentesNaPlanilha: existentes.filter((e) => !vistos.has(e.te_tag.toUpperCase())),
  };
}
