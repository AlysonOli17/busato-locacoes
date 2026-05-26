-- Adiciona campos de Criador, Etapas e Histórico à tabela public.agenda
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS criador_nome TEXT DEFAULT '';
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS etapas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS historico JSONB DEFAULT '[]'::jsonb;
