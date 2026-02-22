
-- Fix permissive RLS policies on all business tables: restrict to authenticated users only

DROP POLICY IF EXISTS "Allow all access to equipamentos" ON public.equipamentos;
CREATE POLICY "Authenticated access to equipamentos" ON public.equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to empresas" ON public.empresas;
CREATE POLICY "Authenticated access to empresas" ON public.empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to contratos" ON public.contratos;
CREATE POLICY "Authenticated access to contratos" ON public.contratos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to apolices" ON public.apolices;
CREATE POLICY "Authenticated access to apolices" ON public.apolices FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to gastos" ON public.gastos;
CREATE POLICY "Authenticated access to gastos" ON public.gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to medicoes" ON public.medicoes;
CREATE POLICY "Authenticated access to medicoes" ON public.medicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to faturamento" ON public.faturamento;
CREATE POLICY "Authenticated access to faturamento" ON public.faturamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to contratos_equipamentos" ON public.contratos_equipamentos;
CREATE POLICY "Authenticated access to contratos_equipamentos" ON public.contratos_equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to faturamento_gastos" ON public.faturamento_gastos;
CREATE POLICY "Authenticated access to faturamento_gastos" ON public.faturamento_gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to contratos_equipamentos_ajustes" ON public.contratos_equipamentos_ajustes;
CREATE POLICY "Authenticated access to contratos_equipamentos_ajustes" ON public.contratos_equipamentos_ajustes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to faturamento_equipamentos" ON public.faturamento_equipamentos;
CREATE POLICY "Authenticated access to faturamento_equipamentos" ON public.faturamento_equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
