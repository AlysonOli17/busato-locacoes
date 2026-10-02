-- Cria a tabela de permissões individuais se não existir
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission TEXT NOT NULL,
  actions text[] NOT NULL DEFAULT '{view,create,edit,delete}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

-- Habilitar RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Permitir que usuários autenticados vejam permissões
CREATE POLICY "Authenticated can view user permissions" ON public.user_permissions
  FOR SELECT TO authenticated USING (true);

-- Permitir que administradores gerenciem permissões de usuários
CREATE POLICY "Admins can manage user permissions" ON public.user_permissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
