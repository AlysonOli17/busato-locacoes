-- Adicionar coluna tipo_teste na tabela testes_comportamentais
ALTER TABLE public.testes_comportamentais
ADD COLUMN IF NOT EXISTS tipo_teste text NOT NULL DEFAULT 'Rápido';
