ALTER TABLE IF EXISTS public.gastos
ADD COLUMN IF NOT EXISTS natureza_custo VARCHAR(50) DEFAULT 'Operacional';

COMMENT ON COLUMN public.gastos.natureza_custo IS 'Fixo ou Operacional';
