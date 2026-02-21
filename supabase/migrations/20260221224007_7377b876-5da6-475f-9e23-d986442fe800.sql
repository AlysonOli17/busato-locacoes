
-- Add hora_minima and data_entrega per equipment in contract
ALTER TABLE public.contratos_equipamentos
  ADD COLUMN hora_minima numeric NOT NULL DEFAULT 0,
  ADD COLUMN data_entrega date;

-- Junction table to track which gastos are included in each fatura
CREATE TABLE public.faturamento_gastos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  faturamento_id uuid NOT NULL REFERENCES public.faturamento(id) ON DELETE CASCADE,
  gasto_id uuid NOT NULL REFERENCES public.gastos(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(faturamento_id, gasto_id)
);

ALTER TABLE public.faturamento_gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to faturamento_gastos"
  ON public.faturamento_gastos
  FOR ALL
  USING (true)
  WITH CHECK (true);
