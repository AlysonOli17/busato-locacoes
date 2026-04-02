
CREATE TABLE public.custos_agregados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id UUID NOT NULL REFERENCES public.equipamentos(id),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao TEXT NOT NULL DEFAULT '',
  quantidade NUMERIC NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  valor NUMERIC NOT NULL DEFAULT 0,
  os_numero_compra TEXT NOT NULL DEFAULT '',
  observacoes TEXT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custos_agregados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to custos_agregados"
ON public.custos_agregados
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
