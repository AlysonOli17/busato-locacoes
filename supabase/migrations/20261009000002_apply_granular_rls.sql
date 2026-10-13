-- Migração: Aplicação de RLS Granular nas tabelas críticas (Fase 1)
-- Substitui o acesso "FOR ALL TO authenticated USING (true)" pelo uso da função has_permission()

-- 1. Tabela: empresas
DROP POLICY IF EXISTS "Authenticated access to empresas" ON public.empresas;
CREATE POLICY "Permitir select empresas" ON public.empresas FOR SELECT TO authenticated USING (public.has_permission('/empresas', 'view'));
CREATE POLICY "Permitir insert empresas" ON public.empresas FOR INSERT TO authenticated WITH CHECK (public.has_permission('/empresas', 'create'));
CREATE POLICY "Permitir update empresas" ON public.empresas FOR UPDATE TO authenticated USING (public.has_permission('/empresas', 'edit'));
CREATE POLICY "Permitir delete empresas" ON public.empresas FOR DELETE TO authenticated USING (public.has_permission('/empresas', 'delete'));

-- 2. Tabela: contratos
DROP POLICY IF EXISTS "Authenticated access to contratos" ON public.contratos;
CREATE POLICY "Permitir select contratos" ON public.contratos FOR SELECT TO authenticated USING (public.has_permission('/contratos', 'view'));
CREATE POLICY "Permitir insert contratos" ON public.contratos FOR INSERT TO authenticated WITH CHECK (public.has_permission('/contratos', 'create'));
CREATE POLICY "Permitir update contratos" ON public.contratos FOR UPDATE TO authenticated USING (public.has_permission('/contratos', 'edit'));
CREATE POLICY "Permitir delete contratos" ON public.contratos FOR DELETE TO authenticated USING (public.has_permission('/contratos', 'delete'));

-- 3. Tabela: faturamento
DROP POLICY IF EXISTS "Authenticated access to faturamento" ON public.faturamento;
CREATE POLICY "Permitir select faturamento" ON public.faturamento FOR SELECT TO authenticated USING (public.has_permission('/faturamento', 'view'));
CREATE POLICY "Permitir insert faturamento" ON public.faturamento FOR INSERT TO authenticated WITH CHECK (public.has_permission('/faturamento', 'create'));
CREATE POLICY "Permitir update faturamento" ON public.faturamento FOR UPDATE TO authenticated USING (public.has_permission('/faturamento', 'edit'));
CREATE POLICY "Permitir delete faturamento" ON public.faturamento FOR DELETE TO authenticated USING (public.has_permission('/faturamento', 'delete'));

-- 4. Tabela: medicoes
DROP POLICY IF EXISTS "Authenticated access to medicoes" ON public.medicoes;
CREATE POLICY "Permitir select medicoes" ON public.medicoes FOR SELECT TO authenticated USING (public.has_permission('/medicoes', 'view'));
CREATE POLICY "Permitir insert medicoes" ON public.medicoes FOR INSERT TO authenticated WITH CHECK (public.has_permission('/medicoes', 'create'));
CREATE POLICY "Permitir update medicoes" ON public.medicoes FOR UPDATE TO authenticated USING (public.has_permission('/medicoes', 'edit'));
CREATE POLICY "Permitir delete medicoes" ON public.medicoes FOR DELETE TO authenticated USING (public.has_permission('/medicoes', 'delete'));

-- 5. Tabela: equipamentos
DROP POLICY IF EXISTS "Authenticated access to equipamentos" ON public.equipamentos;
CREATE POLICY "Permitir select equipamentos" ON public.equipamentos FOR SELECT TO authenticated USING (public.has_permission('/equipamentos', 'view'));
CREATE POLICY "Permitir insert equipamentos" ON public.equipamentos FOR INSERT TO authenticated WITH CHECK (public.has_permission('/equipamentos', 'create'));
CREATE POLICY "Permitir update equipamentos" ON public.equipamentos FOR UPDATE TO authenticated USING (public.has_permission('/equipamentos', 'edit'));
CREATE POLICY "Permitir delete equipamentos" ON public.equipamentos FOR DELETE TO authenticated USING (public.has_permission('/equipamentos', 'delete'));

-- 6. Tabela: apolices
DROP POLICY IF EXISTS "Authenticated access to apolices" ON public.apolices;
CREATE POLICY "Permitir select apolices" ON public.apolices FOR SELECT TO authenticated USING (public.has_permission('/apolices', 'view'));
CREATE POLICY "Permitir insert apolices" ON public.apolices FOR INSERT TO authenticated WITH CHECK (public.has_permission('/apolices', 'create'));
CREATE POLICY "Permitir update apolices" ON public.apolices FOR UPDATE TO authenticated USING (public.has_permission('/apolices', 'edit'));
CREATE POLICY "Permitir delete apolices" ON public.apolices FOR DELETE TO authenticated USING (public.has_permission('/apolices', 'delete'));

-- 7. Tabela: contas_bancarias
DROP POLICY IF EXISTS "Authenticated access to contas_bancarias" ON public.contas_bancarias;
CREATE POLICY "Permitir select contas_bancarias" ON public.contas_bancarias FOR SELECT TO authenticated USING (public.has_permission('/faturamento', 'view') OR public.has_permission('/contratos', 'view'));
CREATE POLICY "Permitir insert contas_bancarias" ON public.contas_bancarias FOR INSERT TO authenticated WITH CHECK (public.has_permission('/faturamento', 'create') OR public.has_permission('/contratos', 'create'));
CREATE POLICY "Permitir update contas_bancarias" ON public.contas_bancarias FOR UPDATE TO authenticated USING (public.has_permission('/faturamento', 'edit') OR public.has_permission('/contratos', 'edit'));
CREATE POLICY "Permitir delete contas_bancarias" ON public.contas_bancarias FOR DELETE TO authenticated USING (public.has_permission('/faturamento', 'delete') OR public.has_permission('/contratos', 'delete'));

-- 8. Tabela: propostas
DROP POLICY IF EXISTS "Authenticated access to propostas" ON public.propostas;
CREATE POLICY "Permitir select propostas" ON public.propostas FOR SELECT TO authenticated USING (public.has_permission('/contratos', 'view'));
CREATE POLICY "Permitir insert propostas" ON public.propostas FOR INSERT TO authenticated WITH CHECK (public.has_permission('/contratos', 'create'));
CREATE POLICY "Permitir update propostas" ON public.propostas FOR UPDATE TO authenticated USING (public.has_permission('/contratos', 'edit'));
CREATE POLICY "Permitir delete propostas" ON public.propostas FOR DELETE TO authenticated USING (public.has_permission('/contratos', 'delete'));

-- 9. Tabela: gastos (Lançamentos financeiros de oficina/agregados)
DROP POLICY IF EXISTS "Authenticated access to gastos" ON public.gastos;
-- Custos vêm de /equipamentos (Oficina) ou /agregados (Custos)
CREATE POLICY "Permitir select gastos" ON public.gastos FOR SELECT TO authenticated USING (public.has_permission('/equipamentos', 'view') OR public.has_permission('/agregados', 'view'));
CREATE POLICY "Permitir insert gastos" ON public.gastos FOR INSERT TO authenticated WITH CHECK (public.has_permission('/equipamentos', 'create') OR public.has_permission('/agregados', 'create'));
CREATE POLICY "Permitir update gastos" ON public.gastos FOR UPDATE TO authenticated USING (public.has_permission('/equipamentos', 'edit') OR public.has_permission('/agregados', 'edit'));
CREATE POLICY "Permitir delete gastos" ON public.gastos FOR DELETE TO authenticated USING (public.has_permission('/equipamentos', 'delete') OR public.has_permission('/agregados', 'delete'));
