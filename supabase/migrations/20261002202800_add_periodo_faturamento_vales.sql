-- Adiciona a coluna periodo_faturamento na tabela vales
ALTER TABLE public.vales 
ADD COLUMN IF NOT EXISTS periodo_faturamento text;
