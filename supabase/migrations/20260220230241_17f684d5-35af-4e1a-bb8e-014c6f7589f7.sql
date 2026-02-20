
-- Create junction table for contracts <-> equipment (many-to-many)
CREATE TABLE public.contratos_equipamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contrato_id, equipamento_id)
);

-- Enable RLS
ALTER TABLE public.contratos_equipamentos ENABLE ROW LEVEL SECURITY;

-- RLS policy (matching existing pattern)
CREATE POLICY "Allow all access to contratos_equipamentos"
  ON public.contratos_equipamentos
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Migrate existing data from contratos.equipamento_id
INSERT INTO public.contratos_equipamentos (contrato_id, equipamento_id)
SELECT id, equipamento_id FROM public.contratos WHERE equipamento_id IS NOT NULL
ON CONFLICT DO NOTHING;
