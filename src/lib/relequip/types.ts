import type { Database } from "@/integrations/supabase/types";

export type Relequip = Database["public"]["Tables"]["relequip"]["Row"];
export type RelequipInsert = Database["public"]["Tables"]["relequip"]["Insert"];
export type RelequipHistorico = Database["public"]["Tables"]["relequip_historico"]["Row"];

export type RelequipGrupo = "frota" | "baixado";

/** Situações operacionais usadas na planilha (coluna SITUAÇÃO da aba FROTA). */
export const SITUACOES = [
  "Atuando",
  "Disponível",
  "Locado",
  "Reserva",
  "Rep. Mecânico",
  "Av. Venda",
  "Venda",
] as const;

export const SITUACOES_VENDA = ["Av. Venda", "Venda"];

export const SITUACOES_CADASTRO = ["Ativo", "Inativo", "Sucatear", "Vendido", "Devolvido"] as const;
export const TIPOS_FROTA = ["Próprio", "Agregado", "Comodato"] as const;
export const OPCOES_MEV = ["Sim", "Não", "Em Preparação"] as const;
export const UFS = ["ES", "MG", "RJ", "SP", "BA"] as const;

/** Classes Tailwind por situação (badge). */
export const SITUACAO_STYLE: Record<string, { badge: string; dot: string; chart: string }> = {
  "Atuando":       { badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400", dot: "bg-emerald-500", chart: "#10b981" },
  "Locado":        { badge: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-400",               dot: "bg-sky-500",     chart: "#0ea5e9" },
  "Disponível":    { badge: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-400",    dot: "bg-indigo-500",  chart: "#6366f1" },
  "Reserva":       { badge: "bg-violet-500/15 text-violet-700 border-violet-500/30 dark:text-violet-400",    dot: "bg-violet-500",  chart: "#8b5cf6" },
  "Rep. Mecânico": { badge: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",        dot: "bg-amber-500",   chart: "#f59e0b" },
  "Av. Venda":     { badge: "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400",    dot: "bg-orange-500",  chart: "#f97316" },
  "Venda":         { badge: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-400",            dot: "bg-rose-500",    chart: "#f43f5e" },
  "Vendido":       { badge: "bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-300",        dot: "bg-slate-500",   chart: "#64748b" },
  "Devolvido":     { badge: "bg-teal-500/15 text-teal-700 border-teal-500/30 dark:text-teal-400",            dot: "bg-teal-500",    chart: "#14b8a6" },
};

export const DEFAULT_STYLE = { badge: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", chart: "#94a3b8" };

export const situacaoStyle = (s: string | null | undefined) => (s && SITUACAO_STYLE[s]) || DEFAULT_STYLE;

/** Rótulos amigáveis para os campos registrados no histórico. */
export const CAMPO_LABEL: Record<string, string> = {
  cadastro: "Cadastro",
  grupo: "Grupo",
  centro_custo: "Centro de custo",
  gestor: "Gestor",
  mev: "MEV",
  situacao: "Situação",
  situacao_cadastro: "Situação cadastral",
  estado: "Estado",
  observacao: "Observação",
  custo_recuperacao: "Custo de recuperação",
  tempo_parado: "Tempo parado",
  vendido_para: "Vendido para",
  data_venda: "Data de venda",
};

/**
 * Tipos de implemento considerados máquinas (linha amarela).
 * Os demais são tratados como veículos.
 */
const MAQUINA_KEYWORDS = [
  "escavadeira", "carregadeira", "retro", "empilhadeira", "trator", "motoniveladora",
  "rolo", "compactador de solo", "mini", "balança", "gerador", "caixa compac", "plataforma",
];

export const isMaquina = (r: Pick<Relequip, "tipo_implemento" | "descricao" | "placa">) => {
  const txt = `${r.tipo_implemento ?? ""} ${r.descricao ?? ""}`.toLowerCase();
  if (MAQUINA_KEYWORDS.some((k) => txt.includes(k))) return true;
  // Sem placa e sem palavra-chave de veículo => provavelmente máquina
  return !r.placa && !/caminh|ve[ií]culo|van|carreta|cavalo|reboque/.test(txt);
};

/** UF extraída do centro de custo, ex.: "BASE (ES)" -> "ES". */
export const ufDoCentroCusto = (cc: string | null | undefined) => {
  const m = cc?.match(/\(([A-Z]{2})\)/);
  return m ? m[1] : null;
};

export const formatDateBR = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export const formatCurrencyBR = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Converte "1 ANO (+)", "21 MESES", "60 DIAS" em dias aproximados (para ordenar e destacar). */
export const tempoParadoEmDias = (t: string | null | undefined): number | null => {
  if (!t) return null;
  const s = t.toUpperCase();
  if (s.includes("ATUANDO")) return 0;
  const n = parseInt(s.replace(/\D+/g, " ").trim().split(" ")[0] || "", 10);
  if (Number.isNaN(n)) return null;
  if (s.includes("ANO")) return n * 365;
  if (s.includes("MES") || s.includes("MÊS")) return n * 30;
  if (s.includes("DIA")) return n;
  return null;
};
