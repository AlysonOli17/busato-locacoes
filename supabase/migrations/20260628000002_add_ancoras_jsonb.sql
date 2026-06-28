-- Adicionar campo para respostas de âncoras comportamentais (perguntas complexas)
ALTER TABLE public.avaliacoes_desempenho
ADD COLUMN IF NOT EXISTS respostas_ancoras jsonb;
