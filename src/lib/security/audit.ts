import { supabase } from "@/integrations/supabase/client";

/**
 * Registro de auditoria (LGPD Art. 37 – registro das operações de tratamento).
 * Falhas de log nunca interrompem o fluxo do usuário.
 */
export const logAudit = async (
  action: string,
  module: string,
  description?: string,
  metadata?: Record<string, unknown>
) => {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("audit_logs").insert({
      user_id: user.id,
      user_name: (user.user_metadata?.nome as string) || user.email || null,
      action,
      module,
      description: description ?? null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.warn("[audit] falha ao registrar log:", err);
  }
};
