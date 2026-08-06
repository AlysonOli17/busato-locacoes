-- =============================================================
-- CORRECAO DEFINITIVA: Garante que TODAS as colunas da tabela
-- propostas existam, independente do estado atual do banco.
-- Seguro para re-executar (usa ADD COLUMN IF NOT EXISTS).
-- =============================================================

ALTER TABLE public.propostas
  -- Colunas basicas (podem ter sido criadas com nomes antigos)
  ADD COLUMN IF NOT EXISTS numero_sequencial integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS validade_dias integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS valor_mobilizacao numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_mobilizacao_texto text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prazo_pagamento integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid,
  ADD COLUMN IF NOT EXISTS observacoes text DEFAULT '',
  -- Colunas de consultor
  ADD COLUMN IF NOT EXISTS consultor_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_telefone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_nome_2 text DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_email_2 text DEFAULT '',
  ADD COLUMN IF NOT EXISTS consultor_telefone_2 text DEFAULT '',
  -- Colunas de texto da proposta
  ADD COLUMN IF NOT EXISTS franquia_horas_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS horas_excedentes_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS disponibilidade_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS analise_cadastral_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS seguro_texto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo_medicao text NOT NULL DEFAULT 'horas',
  -- Auditoria
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Garante a sequencia para numero_sequencial
CREATE SEQUENCE IF NOT EXISTS propostas_numero_seq START 95;
