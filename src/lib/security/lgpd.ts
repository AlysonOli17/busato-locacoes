import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Altere a versão sempre que a Política de Privacidade mudar: todos aceitam de novo. */
export const PRIVACY_POLICY_VERSION = "2026-10-06";
export const PRIVACY_POLICY_UPDATED_AT = "06/10/2026";

export const DPO_CONTACT = {
  nome: "Encarregado de Proteção de Dados (DPO) – Busato Locações",
  email: "privacidade@busato.com.br",
};

export const LGPD_REQUEST_TYPES: Record<string, string> = {
  acesso: "Confirmação e acesso aos meus dados",
  correcao: "Correção de dados incompletos/inexatos",
  exclusao: "Eliminação / anonimização dos meus dados",
  portabilidade: "Portabilidade dos dados",
  revogacao: "Revogação de consentimento",
  informacao: "Informação sobre compartilhamento",
};

const isMissingTable = (err: { code?: string } | null) => err?.code === "42P01" || err?.code === "PGRST205";

/** Retorna true se aceitou a versão atual (ou se a migration ainda não foi aplicada). */
export const hasAcceptedCurrentPolicy = async (userId: string): Promise<boolean> => {
  const { data, error } = await db
    .from("lgpd_consents")
    .select("id")
    .eq("user_id", userId)
    .eq("policy_version", PRIVACY_POLICY_VERSION)
    .is("revoked_at", null)
    .limit(1);
  if (error) {
    if (!isMissingTable(error)) console.warn("[lgpd] erro ao verificar consentimento:", error);
    return true; // não bloqueia o sistema caso a migration não tenha sido aplicada
  }
  return (data?.length ?? 0) > 0;
};

export const acceptCurrentPolicy = async () => {
  const { error } = await db.rpc("register_lgpd_consent", {
    _policy_version: PRIVACY_POLICY_VERSION,
    _user_agent: navigator.userAgent,
  });
  if (error) throw error;
  await logAudit("consent_accept", "lgpd", `Aceite da Política de Privacidade v${PRIVACY_POLICY_VERSION}`);
};

export const revokeConsent = async (userId: string) => {
  const { error } = await db
    .from("lgpd_consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw error;
  await logAudit("consent_revoke", "lgpd", "Consentimento revogado pelo titular");
};

export const listMyConsents = async (userId: string) => {
  const { data, error } = await db
    .from("lgpd_consents")
    .select("id, policy_version, created_at, revoked_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const exportMyData = async () => {
  const { data, error } = await db.rpc("export_my_data");
  if (error) throw error;
  await logAudit("data_export", "lgpd", "Titular exportou seus dados (portabilidade)");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meus-dados-busato-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export interface LgpdRequest {
  id: string;
  user_id: string | null;
  user_email: string | null;
  request_type: string;
  details: string | null;
  status: string;
  response: string | null;
  created_at: string;
  due_at: string;
  resolved_at: string | null;
}

export const createLgpdRequest = async (userId: string, email: string, type: string, details: string) => {
  const { error } = await db.from("lgpd_requests").insert({
    user_id: userId,
    user_email: email,
    request_type: type,
    details,
  });
  if (error) throw error;
  await logAudit("lgpd_request", "lgpd", `Solicitação do titular: ${LGPD_REQUEST_TYPES[type] ?? type}`);
};

export const listLgpdRequests = async (onlyUserId?: string): Promise<LgpdRequest[]> => {
  let q = db.from("lgpd_requests").select("*").order("created_at", { ascending: false });
  if (onlyUserId) q = q.eq("user_id", onlyUserId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const updateLgpdRequest = async (id: string, status: string, response: string, handledBy: string) => {
  const done = status === "Concluída" || status === "Recusada";
  const { error } = await db
    .from("lgpd_requests")
    .update({ status, response, handled_by: handledBy, resolved_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
  await logAudit("lgpd_request_update", "lgpd", `Solicitação ${id.slice(0, 8)} → ${status}`);
};

export const anonymizeUser = async (userId: string) => {
  const { error } = await db.rpc("anonymize_user", { _user_id: userId });
  if (error) throw error;
};

export const anonymizeInactiveEmployees = async (years: number): Promise<number> => {
  const { data, error } = await db.rpc("anonymize_inactive_funcionarios", { _years: years });
  if (error) throw error;
  await logAudit("anonymize_funcionarios", "lgpd", `Anonimização de ex-funcionários (> ${years} anos): ${data} registro(s)`);
  return data as number;
};
