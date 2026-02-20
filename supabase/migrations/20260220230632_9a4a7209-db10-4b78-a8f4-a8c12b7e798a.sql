
ALTER TABLE public.contratos_equipamentos
  ADD COLUMN valor_hora numeric NOT NULL DEFAULT 0,
  ADD COLUMN horas_contratadas numeric NOT NULL DEFAULT 0;

-- Migrate existing data from contratos to junction table
UPDATE public.contratos_equipamentos ce
SET valor_hora = c.valor_hora, horas_contratadas = c.horas_contratadas
FROM public.contratos c
WHERE ce.contrato_id = c.id;
