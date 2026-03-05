-- Drop the restrictive policy and create a permissive one
DROP POLICY IF EXISTS "Authenticated access to propostas" ON public.propostas;
CREATE POLICY "Authenticated access to propostas" ON public.propostas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access to propostas_equipamentos" ON public.propostas_equipamentos;
CREATE POLICY "Authenticated access to propostas_equipamentos" ON public.propostas_equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access to propostas_responsabilidades" ON public.propostas_responsabilidades;
CREATE POLICY "Authenticated access to propostas_responsabilidades" ON public.propostas_responsabilidades FOR ALL TO authenticated USING (true) WITH CHECK (true);