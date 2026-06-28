-- Tabelas para 9 Box e PDI

CREATE TABLE IF NOT EXISTS public.avaliacoes_9box (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data_avaliacao date NOT NULL DEFAULT CURRENT_DATE,
  desempenho text NOT NULL, -- Baixo, Médio, Alto
  potencial text NOT NULL, -- Baixo, Médio, Alto
  classificacao text NOT NULL, -- O resultado na matriz 9 Box
  avaliador text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pdis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data_criacao date NOT NULL DEFAULT CURRENT_DATE,
  meta text NOT NULL,
  prazo date,
  o_que_fazer text,
  status text NOT NULL DEFAULT 'Aberto', -- Aberto, Em Andamento, Concluído
  criado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.avaliacoes_9box ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdis ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso total para Admin/Master (perfis autenticados no contexto do app)
CREATE POLICY "Acesso as avaliacoes 9box" ON public.avaliacoes_9box
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Acesso aos pdis" ON public.pdis
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS avaliacoes_9box_funcionario_idx ON public.avaliacoes_9box(funcionario_id);
CREATE INDEX IF NOT EXISTS pdis_funcionario_idx ON public.pdis(funcionario_id);
