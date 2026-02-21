
ALTER TABLE public.contratos
  ADD COLUMN periodo_medicao_inicio date,
  ADD COLUMN periodo_medicao_fim date,
  ADD COLUMN prazo_faturamento integer NOT NULL DEFAULT 30;
