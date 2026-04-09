CREATE TABLE public.medicoes_terceiros_faturamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos_terceiros(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL DEFAULT '',
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pendente',
  detalhes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medicoes_terceiros_faturamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to medicoes_terceiros_faturamento"
ON public.medicoes_terceiros_faturamento
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);