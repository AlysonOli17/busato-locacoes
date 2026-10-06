-- ============================================================
-- MIGRATION: Segurança + LGPD
--  1. Endurecimento de RLS (bloqueia acesso anônimo)
--  2. Criptografia de campos sensíveis (pgcrypto + Supabase Vault)
--  3. Credenciais biométricas (WebAuthn / Passkeys)
--  4. LGPD: consentimentos, solicitações do titular, anonimização
--  5. Auditoria imutável
-- ============================================================

-- ------------------------------------------------------------
-- 1. ENDURECIMENTO DE RLS
-- Políticas antigas criadas sem "TO authenticated" valem também para
-- o papel "anon" (qualquer pessoa com a URL + anon key). Aqui elas
-- passam a valer apenas para usuários autenticados.
-- Tabelas usadas pelas páginas públicas por token ficam de fora.
-- ------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles @> ARRAY['public']::name[]
      AND tablename NOT IN (
        'checklists', 'checklist_tokens',            -- /vistoria/:token
        'testes_comportamentais',                    -- /teste-disc/:token
        'avaliacoes_desempenho'                      -- /autoavaliacao/:token
      )
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated',
                   pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Remove grants desnecessários do papel anônimo em tabelas internas
REVOKE ALL ON TABLE public.vales FROM anon;
REVOKE ALL ON TABLE public.contas_bancarias FROM anon;

-- ------------------------------------------------------------
-- 2. CRIPTOGRAFIA DE CAMPOS SENSÍVEIS
-- A chave fica no Supabase Vault (criptografado, fora das tabelas).
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'pii_encryption_key') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'pii_encryption_key',
      'Chave AES-256 para criptografia de dados pessoais (LGPD)'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._pii_key()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pii_encryption_key' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public._pii_key() FROM PUBLIC, anon, authenticated;

-- Criptografa um texto (AES-256 via PGP simétrico). Retorna base64.
CREATE OR REPLACE FUNCTION public.encrypt_pii(plain text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF plain IS NULL OR plain = '' THEN RETURN plain; END IF;
  RETURN encode(extensions.pgp_sym_encrypt(plain, public._pii_key(), 'cipher-algo=aes256'), 'base64');
END;
$$;

-- Descriptografa. Somente admin/master (ou service_role) conseguem.
CREATE OR REPLACE FUNCTION public.decrypt_pii(cipher text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF cipher IS NULL OR cipher = '' THEN RETURN cipher; END IF;
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'master')
  ) THEN
    RAISE EXCEPTION 'Acesso negado a dados sensíveis';
  END IF;
  RETURN extensions.pgp_sym_decrypt(decode(cipher, 'base64'), public._pii_key());
END;
$$;
REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decrypt_pii(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encrypt_pii(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_pii(text) TO authenticated;

-- ------------------------------------------------------------
-- 3. CREDENCIAIS BIOMÉTRICAS (WebAuthn)
-- A biometria nunca sai do aparelho: guardamos apenas o ID da
-- credencial e a chave PÚBLICA.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_biometric_credentials (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id  text NOT NULL UNIQUE,
  public_key     text NOT NULL,          -- SPKI base64url
  algorithm      integer NOT NULL DEFAULT -7,
  device_name    text,
  platform       text NOT NULL DEFAULT 'web',  -- web | android
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz
);
ALTER TABLE public.user_biometric_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_biometric_credentials" ON public.user_biometric_credentials;
CREATE POLICY "own_biometric_credentials" ON public.user_biometric_credentials
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS user_biometric_credentials_user_idx ON public.user_biometric_credentials(user_id);

-- ------------------------------------------------------------
-- 4. LGPD
-- ------------------------------------------------------------

-- 4.1 Registro de consentimento (Art. 8º)
CREATE TABLE IF NOT EXISTS public.lgpd_consents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_version text NOT NULL,
  accepted       boolean NOT NULL DEFAULT true,
  user_agent     text,
  ip_encrypted   text,                   -- IP criptografado (encrypt_pii)
  created_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz
);
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_consents_select" ON public.lgpd_consents;
CREATE POLICY "own_consents_select" ON public.lgpd_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'master')));

DROP POLICY IF EXISTS "own_consents_insert" ON public.lgpd_consents;
CREATE POLICY "own_consents_insert" ON public.lgpd_consents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_consents_revoke" ON public.lgpd_consents;
CREATE POLICY "own_consents_revoke" ON public.lgpd_consents
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS lgpd_consents_user_idx ON public.lgpd_consents(user_id, created_at DESC);

-- Registra consentimento capturando o IP no servidor (criptografado)
CREATE OR REPLACE FUNCTION public.register_lgpd_consent(_policy_version text, _user_agent text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _ip text;
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  BEGIN
    _ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  EXCEPTION WHEN others THEN _ip := NULL;
  END;
  INSERT INTO public.lgpd_consents (user_id, policy_version, user_agent, ip_encrypted)
  VALUES (auth.uid(), _policy_version, left(_user_agent, 500), public.encrypt_pii(nullif(trim(_ip), '')))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_lgpd_consent(text, text) TO authenticated;

-- 4.2 Solicitações do titular (Art. 18)
CREATE TABLE IF NOT EXISTS public.lgpd_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text,
  request_type  text NOT NULL CHECK (request_type IN ('acesso','correcao','exclusao','portabilidade','revogacao','informacao')),
  details       text,
  status        text NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente','Em andamento','Concluída','Recusada')),
  response      text,
  handled_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  due_at        timestamptz NOT NULL DEFAULT (now() + interval '15 days'),  -- prazo Art. 19, II
  resolved_at   timestamptz
);
ALTER TABLE public.lgpd_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lgpd_requests_select" ON public.lgpd_requests;
CREATE POLICY "lgpd_requests_select" ON public.lgpd_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'master')));

DROP POLICY IF EXISTS "lgpd_requests_insert" ON public.lgpd_requests;
CREATE POLICY "lgpd_requests_insert" ON public.lgpd_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "lgpd_requests_admin_update" ON public.lgpd_requests;
CREATE POLICY "lgpd_requests_admin_update" ON public.lgpd_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'master')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'master')));

-- 4.3 Exportação dos dados do próprio titular (portabilidade - Art. 18, V)
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  RETURN jsonb_build_object(
    'gerado_em', now(),
    'conta', (SELECT jsonb_build_object('id', u.id, 'email', u.email, 'criado_em', u.created_at, 'ultimo_login', u.last_sign_in_at)
              FROM auth.users u WHERE u.id = _uid),
    'perfil', (SELECT to_jsonb(p) - 'user_id' FROM public.profiles p WHERE p.user_id = _uid),
    'papeis', (SELECT coalesce(jsonb_agg(r.role), '[]'::jsonb) FROM public.user_roles r WHERE r.user_id = _uid),
    'consentimentos', (SELECT coalesce(jsonb_agg(jsonb_build_object('versao', c.policy_version, 'data', c.created_at, 'revogado_em', c.revoked_at) ORDER BY c.created_at), '[]'::jsonb)
                       FROM public.lgpd_consents c WHERE c.user_id = _uid),
    'dispositivos_biometricos', (SELECT coalesce(jsonb_agg(jsonb_build_object('dispositivo', b.device_name, 'plataforma', b.platform, 'cadastrado_em', b.created_at, 'ultimo_uso', b.last_used_at)), '[]'::jsonb)
                                 FROM public.user_biometric_credentials b WHERE b.user_id = _uid),
    'solicitacoes_lgpd', (SELECT coalesce(jsonb_agg(jsonb_build_object('tipo', s.request_type, 'status', s.status, 'data', s.created_at)), '[]'::jsonb)
                          FROM public.lgpd_requests s WHERE s.user_id = _uid),
    'registros_de_atividade', (SELECT coalesce(jsonb_agg(jsonb_build_object('acao', a.action, 'modulo', a.module, 'data', a.created_at) ORDER BY a.created_at DESC), '[]'::jsonb)
                               FROM (SELECT * FROM public.audit_logs WHERE user_id = _uid ORDER BY created_at DESC LIMIT 500) a)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;

-- 4.4 Anonimização de usuário (Art. 16 / Art. 18, IV e VI)
-- Mantém registros financeiros/fiscais (obrigação legal - Art. 16, I),
-- mas remove a identificação da pessoa.
CREATE OR REPLACE FUNCTION public.anonymize_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _alias text := 'Titular anonimizado ' || left(md5(_user_id::text), 8);
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'master')) THEN
    RAISE EXCEPTION 'Apenas administradores podem anonimizar titulares';
  END IF;

  UPDATE public.profiles
     SET nome = _alias,
         email = 'anon-' || left(md5(_user_id::text), 12) || '@anonimizado.local',
         status = 'Bloqueado'
   WHERE user_id = _user_id;

  UPDATE public.audit_logs SET user_name = _alias WHERE user_id = _user_id;
  DELETE FROM public.user_biometric_credentials WHERE user_id = _user_id;
  UPDATE public.lgpd_consents SET ip_encrypted = NULL, user_agent = NULL WHERE user_id = _user_id;

  UPDATE auth.users
     SET email = 'anon-' || left(md5(_user_id::text), 12) || '@anonimizado.local',
         raw_user_meta_data = '{}'::jsonb,
         phone = NULL,
         banned_until = 'infinity'
   WHERE id = _user_id;

  INSERT INTO public.audit_logs (user_id, user_name, action, module, description)
  VALUES (auth.uid(), 'Sistema LGPD', 'anonymize', 'lgpd', 'Titular anonimizado: ' || _alias);
END;
$$;
REVOKE ALL ON FUNCTION public.anonymize_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anonymize_user(uuid) TO authenticated;

-- 4.5 Anonimização de funcionários desligados há mais de N anos
CREATE OR REPLACE FUNCTION public.anonymize_inactive_funcionarios(_years integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _count integer;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'master')) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  UPDATE public.funcionarios
     SET nome = 'Ex-funcionário ' || left(md5(id::text), 8),
         email = NULL,
         telefone = NULL
   WHERE status = 'Inativo'
     AND updated_at < now() - make_interval(years => _years)
     AND nome NOT LIKE 'Ex-funcionário %';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.anonymize_inactive_funcionarios(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anonymize_inactive_funcionarios(integer) TO authenticated;

-- ------------------------------------------------------------
-- 5. AUDITORIA IMUTÁVEL
-- Usuário só registra log em seu próprio nome; ninguém altera/apaga.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_can_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "authenticated_can_insert_audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION public._audit_logs_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Permite apenas a anonimização feita pela função anonymize_user
  IF TG_OP = 'UPDATE' AND NEW.user_name LIKE 'Titular anonimizado %'
     AND NEW.action = OLD.action AND NEW.module = OLD.module THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs é imutável';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public._audit_logs_immutable();

NOTIFY pgrst, 'reload schema';
