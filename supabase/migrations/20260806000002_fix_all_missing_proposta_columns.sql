-- Correcao definitiva: adiciona TODAS as colunas que podem estar faltando na tabela propostas
-- Usa ADD COLUMN IF NOT EXISTS para ser seguro em qualquer estado do banco

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS consultor_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_telefone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_nome_2 text DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_email_2 text DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_telefone_2 text DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS franquia_horas_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS horas_excedentes_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS disponibilidade_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS analise_cadastral_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS seguro_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo_medicao text NOT NULL DEFAULT 'horas',
  ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid,
  ADD COLUMN IF NOT EXISTS valor_mobilizacao_texto text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validade_dias integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS prazo_pagamento integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS observacoes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero_sequencial integer NOT NULL DEFAULT 1;
