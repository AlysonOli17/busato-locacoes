-- ============================================================
-- MIGRATION: audit_logs + granular permissions
-- ============================================================

-- 1. Tabela de Log de Auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   text,
  action      text NOT NULL,
  module      text NOT NULL,
  description text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Somente admins podem ver logs
CREATE POLICY "admins_can_read_audit_logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Qualquer usuário autenticado pode inserir log (via service role na edge function)
CREATE POLICY "authenticated_can_insert_audit_logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- 2. Adicionar coluna 'actions' à role_permissions para permissões granulares
-- A coluna 'permission' continua sendo o módulo (path)
-- A nova coluna 'actions' é um array de ações permitidas
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS actions text[] NOT NULL DEFAULT '{view,create,edit,delete}'::text[];

-- 3. Mesma coisa para user_permissions (permissões individuais)
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS actions text[] NOT NULL DEFAULT '{view,create,edit,delete}'::text[];

-- 4. Índice para melhorar performance das queries de log
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_module_idx ON public.audit_logs(module);
