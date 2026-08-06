-- Adiciona colunas de consultor que podem estar faltando na tabela propostas
-- (Caso o banco tenha sido criado com schema antigo antes da migration 20260305161429)
ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS consultor_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_telefone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_nome_2 text DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_email_2 text DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_telefone_2 text DEFAULT '';
