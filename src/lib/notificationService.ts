import { supabase } from "@/integrations/supabase/client";

export type NotificacaoPrioridade = "critico" | "alerta" | "info";

export interface CreateNotifParams {
  userId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  referenciaId?: string | null;
  referenciaTipo?: string | null;
}

/**
 * Cria uma notificação no banco de dados com deduplicação.
 * Retorna o ID da linha inserida ou null se for detectada duplicada.
 */
export async function createNotification({
  userId,
  tipo,
  titulo,
  mensagem,
  referenciaId = null,
  referenciaTipo = null,
}: CreateNotifParams) {
  try {
    const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    let query = supabase
      .from("notificacoes")
      .select("id")
      .eq("user_id", userId)
      .eq("titulo", titulo)
      .eq("lida", false)
      .gt("created_at", umDiaAtras);
      
    if (referenciaId) {
      query = query.eq("referencia_id", referenciaId);
    }
    if (referenciaTipo) {
      query = query.eq("referencia_tipo", referenciaTipo);
    }

    const { data: existing, error: checkError } = await query;
    if (checkError) {
      console.error("Erro ao verificar notificações duplicadas:", checkError);
    }

    if (existing && existing.length > 0) {
      return null;
    }

    const { data, error } = await supabase
      .from("notificacoes")
      .insert({
        user_id: userId,
        tipo,
        titulo,
        mensagem,
        referencia_id: referenciaId,
        referencia_tipo: referenciaTipo,
        lida: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Erro ao inserir notificação:", error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error("Erro inesperado no serviço de notificações:", err);
    return null;
  }
}
