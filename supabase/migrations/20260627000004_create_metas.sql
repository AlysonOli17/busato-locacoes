-- Tabela de Metas Estratégicas (OKRs)
CREATE TABLE IF NOT EXISTS public.metas_estrategicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  setor text NOT NULL,
  responsavel_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  prazo date NOT NULL,
  progresso integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pendente', -- Pendente, Em Andamento, Concluído, Atrasado
  criado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.metas_estrategicas ENABLE ROW LEVEL SECURITY;

-- O RH (Admin/Master) pode ver e gerenciar tudo
CREATE POLICY "Acesso as metas estrategicas" ON public.metas_estrategicas
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS metas_estrategicas_responsavel_idx ON public.metas_estrategicas(responsavel_id);
CREATE INDEX IF NOT EXISTS metas_estrategicas_setor_idx ON public.metas_estrategicas(setor);
