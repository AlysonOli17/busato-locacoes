ALTER TABLE public.medicoes_terceiros 
ADD COLUMN IF NOT EXISTS placa_equipamento TEXT,
ADD COLUMN IF NOT EXISTS origem_destino TEXT,
ADD COLUMN IF NOT EXISTS valor_servico NUMERIC;
