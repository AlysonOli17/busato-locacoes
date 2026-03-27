
-- Add approval date to faturamento for vencimento calculation
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS data_aprovacao date;

-- Add measurement type to contratos (horas or diarias)
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS tipo_medicao text NOT NULL DEFAULT 'horas';

-- Add discount percentage to temporary adjustments
ALTER TABLE public.contratos_equipamentos_ajustes ADD COLUMN IF NOT EXISTS desconto_percentual numeric NOT NULL DEFAULT 0;
