CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_update_password(target_user_id UUID, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  caller_name TEXT;
BEGIN
  -- Verificar o role do usuario atual (quem esta chamando a funcao)
  SELECT role INTO caller_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  
  -- Se o usuario tiver "Master" ou "admin", ele pode.
  -- Vamos aceitar tambem se o texto for exatamente Master ou admin case-insensitive
  IF lower(caller_role) NOT IN ('admin', 'master') THEN
    RAISE EXCEPTION 'Not authorized. Acesso Negado: Apenas administradores e Masters podem alterar senhas.';
  END IF;

  -- Pegar nome de quem esta alterando
  SELECT nome INTO caller_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  -- Atualizar a senha na tabela oculta do auth (precisa pgcrypto)
  UPDATE auth.users
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = target_user_id;

  -- Registrar no log de auditoria
  INSERT INTO public.audit_logs (user_id, user_name, action, module, description)
  VALUES (auth.uid(), COALESCE(caller_name, 'Sistema'), 'reset_password', 'Usuários', 'Redefiniu a senha de um usuário via RPC Master');

END;
$$;
