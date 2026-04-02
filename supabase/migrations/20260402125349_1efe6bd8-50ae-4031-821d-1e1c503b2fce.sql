
CREATE TABLE public.valores_diaria_agregado (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_equipamento text NOT NULL,
  valor_diaria numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tipo_equipamento)
);

ALTER TABLE public.valores_diaria_agregado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to valores_diaria_agregado"
  ON public.valores_diaria_agregado
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
