
CREATE TABLE public.agregados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  os text NOT NULL DEFAULT '',
  complementar text NOT NULL DEFAULT '',
  pde text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  matricula text NOT NULL DEFAULT '',
  observacoes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agregados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to agregados"
  ON public.agregados
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
