-- Tabela de tokens para preenchimento público de checklists
CREATE TABLE IF NOT EXISTS public.checklist_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  contrato_id   uuid REFERENCES public.contratos(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  tipo          text NOT NULL DEFAULT 'Entrega', -- Entrega | Devolução | Periódica
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '72 hours',
  used          boolean NOT NULL DEFAULT false,
  used_at       timestamptz,
  checklist_id  uuid REFERENCES public.checklists(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_tokens ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem criar e ver tokens
CREATE POLICY "auth_users_manage_tokens" ON public.checklist_tokens
  FOR ALL USING (auth.role() = 'authenticated');

-- Acesso público para leitura de token específico (para a página pública)
CREATE POLICY "public_can_read_token_by_id" ON public.checklist_tokens
  FOR SELECT USING (true);

-- Acesso público para marcar como usado (quando o form é enviado)
CREATE POLICY "public_can_update_token" ON public.checklist_tokens
  FOR UPDATE USING (true);

-- Índice para busca rápida por token
CREATE INDEX IF NOT EXISTS checklist_tokens_token_idx ON public.checklist_tokens(token);
CREATE INDEX IF NOT EXISTS checklist_tokens_expires_idx ON public.checklist_tokens(expires_at);
