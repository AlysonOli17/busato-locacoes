-- Cria a tabela de Vales
CREATE TABLE IF NOT EXISTS vales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_rf TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ativa RLS
ALTER TABLE vales ENABLE ROW LEVEL SECURITY;

-- Garante as permissões básicas para as roles da API
GRANT ALL ON TABLE public.vales TO anon, authenticated, service_role;

-- Políticas de acesso para a tabela vales
DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON vales;
CREATE POLICY "Permitir leitura para usuários autenticados" ON vales FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON vales;
CREATE POLICY "Permitir inserção para usuários autenticados" ON vales FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados" ON vales;
CREATE POLICY "Permitir atualização para usuários autenticados" ON vales FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir deleção para usuários autenticados" ON vales;
CREATE POLICY "Permitir deleção para usuários autenticados" ON vales FOR DELETE TO authenticated USING (true);

-- Altera a tabela faturamento para permitir faturas oriundas de vales e sem contratos
ALTER TABLE faturamento ALTER COLUMN contrato_id DROP NOT NULL;
ALTER TABLE faturamento ADD COLUMN IF NOT EXISTS vale_id UUID REFERENCES vales(id) ON DELETE SET NULL;

-- Recarrega o cache de schema da API do Supabase (PostgREST)
NOTIFY pgrst, 'reload schema';
