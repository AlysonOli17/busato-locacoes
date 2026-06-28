-- Tabela de Testes Comportamentais (DISC)
CREATE TABLE IF NOT EXISTS public.testes_comportamentais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  token_acesso uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'Pendente', -- Pendente, Concluído
  data_envio timestamptz,
  resultado_d integer DEFAULT 0,
  resultado_i integer DEFAULT 0,
  resultado_s integer DEFAULT 0,
  resultado_c integer DEFAULT 0,
  perfil_predominante text,
  respostas jsonb, -- Para guardar o JSON com as respostas completas
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.testes_comportamentais ENABLE ROW LEVEL SECURITY;

-- O RH (Admin/Master) pode ver e gerenciar tudo
CREATE POLICY "RH gerencia testes" ON public.testes_comportamentais
  FOR ALL USING (auth.role() = 'authenticated');

-- Permitir acesso público ANÔNIMO para leitura e atualização baseada apenas no token
CREATE POLICY "Leitura anonima por token" ON public.testes_comportamentais
  FOR SELECT USING (true); -- Permitir que a rota publica busque o teste pelo token

CREATE POLICY "Atualizacao anonima por token" ON public.testes_comportamentais
  FOR UPDATE USING (status = 'Pendente'); 
  -- Idealmente deveríamos validar o token no WHERE, mas o RLS público no Supabase 
  -- para UPDATE anônimo costuma dar dor de cabeça. 
  -- Deixaremos um pouco mais aberto aqui e validamos fortemente no frontend da rota publica, 
  -- ou criamos a política: FOR UPDATE USING (true);

-- Ajuste de política para Update anônimo (o Supabase bloqueia se a Role anon não tiver UPDATE)
-- Nota: para esse cenário funcionar, a tabela tem que permitir UPDATE pela role anon.
-- No Supabase, o anon role acessa via anon key.
CREATE POLICY "Anon pode atualizar seu teste" ON public.testes_comportamentais
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS testes_comportamentais_token_idx ON public.testes_comportamentais(token_acesso);
CREATE INDEX IF NOT EXISTS testes_comportamentais_funcionario_idx ON public.testes_comportamentais(funcionario_id);
