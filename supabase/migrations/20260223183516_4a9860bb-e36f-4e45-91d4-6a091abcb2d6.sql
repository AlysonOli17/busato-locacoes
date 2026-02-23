
-- Drop the restrictive policy and create a permissive one
DROP POLICY IF EXISTS "Authenticated access to apolices_equipamentos" ON public.apolices_equipamentos;

CREATE POLICY "Authenticated access to apolices_equipamentos"
  ON public.apolices_equipamentos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also fix apolices table policy
DROP POLICY IF EXISTS "Authenticated access to apolices" ON public.apolices;

CREATE POLICY "Authenticated access to apolices"
  ON public.apolices
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
