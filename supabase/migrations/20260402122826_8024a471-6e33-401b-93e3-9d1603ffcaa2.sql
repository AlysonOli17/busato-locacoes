-- Create items table
CREATE TABLE public.custos_agregados_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custo_id uuid NOT NULL REFERENCES public.custos_agregados(id) ON DELETE CASCADE,
  descricao text NOT NULL DEFAULT '',
  quantidade numeric NOT NULL DEFAULT 1,
  preco_unitario numeric NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custos_agregados_itens ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Authenticated access to custos_agregados_itens"
  ON public.custos_agregados_itens
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Migrate existing data into items table
INSERT INTO public.custos_agregados_itens (custo_id, descricao, quantidade, preco_unitario, valor)
SELECT id, descricao, quantidade, preco_unitario, valor
FROM public.custos_agregados;

-- Drop old columns from parent table
ALTER TABLE public.custos_agregados DROP COLUMN descricao;
ALTER TABLE public.custos_agregados DROP COLUMN quantidade;
ALTER TABLE public.custos_agregados DROP COLUMN preco_unitario;