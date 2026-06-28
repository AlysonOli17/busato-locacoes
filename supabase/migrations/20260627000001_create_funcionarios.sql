-- Tabela de funcionários (Recursos Humanos)
CREATE TABLE IF NOT EXISTS public.funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cargo text NOT NULL,
  setor text,
  departamento text,
  data_admissao date,
  email text,
  telefone text,
  status text NOT NULL DEFAULT 'Ativo', -- Ativo | Inativo
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

-- Acesso total para administradores e masters (ajustar conforme política global)
CREATE POLICY "Admin and Master full access to funcionarios" ON public.funcionarios
  FOR ALL USING (
    auth.role() = 'authenticated'
  );

-- Trigger de updated_at padrão (se existir a function no banco da Busato, senão isso precisaria ser adaptado, mas o Supabase costuma ter automação no frontend)
-- Se não existir trigger para updated_at, ele pode ser atualizado via app.

CREATE INDEX IF NOT EXISTS funcionarios_status_idx ON public.funcionarios(status);
CREATE INDEX IF NOT EXISTS funcionarios_setor_idx ON public.funcionarios(setor);
