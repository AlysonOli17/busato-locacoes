-- Adiciona colunas de texto que podem estar faltando na tabela propostas
ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS analise_cadastral_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS franquia_horas_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS horas_excedentes_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS disponibilidade_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS seguro_texto text DEFAULT '';
