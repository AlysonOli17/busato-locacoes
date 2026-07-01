ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS local TEXT;
ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS cliente_atual_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;
