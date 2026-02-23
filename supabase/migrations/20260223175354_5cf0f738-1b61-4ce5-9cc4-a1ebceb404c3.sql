
-- Create junction table for multiple equipment per apolice
CREATE TABLE public.apolices_equipamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  apolice_id UUID NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  equipamento_id UUID NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.apolices_equipamentos ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Authenticated access to apolices_equipamentos" ON public.apolices_equipamentos
  AS RESTRICTIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Migrate existing data
INSERT INTO public.apolices_equipamentos (apolice_id, equipamento_id)
SELECT id, equipamento_id FROM public.apolices WHERE equipamento_id IS NOT NULL;

-- Drop old columns
ALTER TABLE public.apolices DROP COLUMN IF EXISTS numero_apolice;
ALTER TABLE public.apolices DROP COLUMN IF EXISTS equipamento_id;
