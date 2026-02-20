
-- Add invoice number and measurement period fields to faturamento
ALTER TABLE public.faturamento ADD COLUMN numero_nota TEXT DEFAULT '';
ALTER TABLE public.faturamento ADD COLUMN periodo_medicao_inicio DATE;
ALTER TABLE public.faturamento ADD COLUMN periodo_medicao_fim DATE;
