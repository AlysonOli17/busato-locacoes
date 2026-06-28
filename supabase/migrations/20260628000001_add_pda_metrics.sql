-- Adicionar colunas de energia e autocontrole (PDA) na tabela testes_comportamentais
ALTER TABLE public.testes_comportamentais
ADD COLUMN IF NOT EXISTS nivel_energia integer,
ADD COLUMN IF NOT EXISTS autocontrole integer;
