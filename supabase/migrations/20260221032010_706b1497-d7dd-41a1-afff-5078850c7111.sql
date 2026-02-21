
ALTER TABLE public.contratos DROP COLUMN IF EXISTS periodo_medicao_inicio;
ALTER TABLE public.contratos DROP COLUMN IF EXISTS periodo_medicao_fim;
ALTER TABLE public.contratos ADD COLUMN dia_medicao_inicio integer NOT NULL DEFAULT 1;
ALTER TABLE public.contratos ADD COLUMN dia_medicao_fim integer NOT NULL DEFAULT 30;
