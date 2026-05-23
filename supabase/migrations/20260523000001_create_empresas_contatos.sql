-- Create table for multiple company contacts
CREATE TABLE IF NOT EXISTS public.empresas_contatos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text,
  telefone text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.empresas_contatos ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to manage contacts
DROP POLICY IF EXISTS "Authenticated access to empresas_contatos" ON public.empresas_contatos;
CREATE POLICY "Authenticated access to empresas_contatos" ON public.empresas_contatos FOR ALL TO authenticated USING (true) WITH CHECK (true);
