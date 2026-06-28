-- Tabela unificada para Avaliação de Desempenho (Autoavaliação e 180 Graus)
CREATE TABLE IF NOT EXISTS public.avaliacoes_desempenho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  avaliador_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL, -- Null se for Autoavaliação
  tipo text NOT NULL CHECK (tipo IN ('Autoavaliacao', '180_Graus')),
  status text NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Concluído')),
  token_acesso text UNIQUE,
  
  -- Notas (1 a 5)
  nota_tecnica integer CHECK (nota_tecnica >= 1 AND nota_tecnica <= 5),
  nota_pontualidade integer CHECK (nota_pontualidade >= 1 AND nota_pontualidade <= 5),
  nota_trabalho_equipe integer CHECK (nota_trabalho_equipe >= 1 AND nota_trabalho_equipe <= 5),
  nota_proatividade integer CHECK (nota_proatividade >= 1 AND nota_proatividade <= 5),
  nota_cuidado_equipamentos integer CHECK (nota_cuidado_equipamentos >= 1 AND nota_cuidado_equipamentos <= 5),
  
  -- Campo Livre
  observacoes text,
  
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.avaliacoes_desempenho ENABLE ROW LEVEL SECURITY;

-- O RH (Admin/Master) pode ver e gerenciar tudo
CREATE POLICY "Acesso as avaliacoes desempenho RH" ON public.avaliacoes_desempenho
  FOR ALL USING (auth.role() = 'authenticated');

-- Acesso anônimo (Público) para as Autoavaliações via token
CREATE POLICY "Acesso publico para autoavaliacao via token" ON public.avaliacoes_desempenho
  FOR SELECT USING (tipo = 'Autoavaliacao' AND auth.role() = 'anon');

CREATE POLICY "Acesso publico update para autoavaliacao via token" ON public.avaliacoes_desempenho
  FOR UPDATE USING (tipo = 'Autoavaliacao' AND status = 'Pendente' AND auth.role() = 'anon');

CREATE INDEX IF NOT EXISTS avaliacoes_desempenho_func_idx ON public.avaliacoes_desempenho(funcionario_id);
CREATE INDEX IF NOT EXISTS avaliacoes_desempenho_token_idx ON public.avaliacoes_desempenho(token_acesso);
