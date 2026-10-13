-- Migração: Correção de Vulnerabilidades de Segurança (Fase 1)

-- 1. Remoção do acesso anônimo perigoso (Exposição de Dados de RH e Checklists)
-- Tabela testes_comportamentais
DROP POLICY IF EXISTS "Permitir leitura de todos os testes" ON public.testes_comportamentais;
DROP POLICY IF EXISTS "Permitir atualizacao do teste" ON public.testes_comportamentais;
DROP POLICY IF EXISTS "Permitir insercao anonima" ON public.testes_comportamentais;
DROP POLICY IF EXISTS "Permitir acesso anonimo" ON public.testes_comportamentais;

-- Tabela avaliacoes_desempenho
DROP POLICY IF EXISTS "Permitir acesso anonimo" ON public.avaliacoes_desempenho;
DROP POLICY IF EXISTS "Permitir leitura anonima" ON public.avaliacoes_desempenho;

-- Tabela checklists e checklist_tokens (se houver políticas anônimas ativas)
DROP POLICY IF EXISTS "Anon can view checklists" ON public.checklists;
DROP POLICY IF EXISTS "Anon can update checklists" ON public.checklists;

-- Criar políticas restritivas para essas tabelas (apenas admin/master podem ler tudo diretamente)
CREATE POLICY "Apenas admin e master acessam testes via query direta" 
ON public.testes_comportamentais 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

CREATE POLICY "Apenas admin e master acessam avaliacoes via query direta" 
ON public.avaliacoes_desempenho 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

-- (O acesso externo para o funcionário preencher se dará EXCLUSIVAMENTE via funções RPC Security Definer, que não dependem do RLS da tabela)


-- 2. Nova função de controle granular de acesso (Verifica Status, Módulo e Ação)
CREATE OR REPLACE FUNCTION public.has_permission(_modulo text, _acao text DEFAULT 'view')
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _status text;
  _is_visualizador boolean;
BEGIN
  -- Bloqueio 1: Usuário precisa estar ativo no perfil
  SELECT status INTO _status FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF _status != 'Ativo' THEN
    RETURN FALSE;
  END IF;

  -- Liberação 1: Admin ou Master tem acesso total a qualquer módulo e ação
  _is_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master');
  IF _is_admin THEN
    RETURN TRUE;
  END IF;

  -- Liberação 2: Permissão específica atribuída ao usuário (user_permissions)
  IF EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid()
      AND permission = _modulo
      AND _acao = ANY(actions)
  ) THEN
    RETURN TRUE;
  END IF;

  -- Liberação 3: Permissão via cargo/role (role_permissions)
  -- Nota: Para usuários não-admin, precisamos ter cuidado com escrita se forem visualizadores.
  SELECT public.has_role(auth.uid(), 'visualizador') INTO _is_visualizador;
  
  IF EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON rp.role = ur.role
    WHERE ur.user_id = auth.uid()
      AND rp.permission = _modulo
  ) THEN
    -- Se for um visualizador e a ação for de escrita (edit, create, delete), bloqueia.
    IF _is_visualizador AND _acao != 'view' THEN
      RETURN FALSE;
    END IF;
    -- Operadores com acesso ao módulo podem visualizar, mas a rigor precisam da flag no 'actions' para editar.
    -- Para não quebrar a aplicação atual, se ele tem a rota na role, liberamos a ação caso não seja visualizador.
    RETURN TRUE; 
  END IF;

  RETURN FALSE;
END;
$$;


-- 3. Correções Menores (Quick Wins)

-- Restringir leitura global do user_permissions
DROP POLICY IF EXISTS "Authenticated can view user permissions" ON public.user_permissions;
CREATE POLICY "Usuario ve as proprias permissoes ou admin" 
ON public.user_permissions 
FOR SELECT TO authenticated 
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

-- Restringir tabela gdrive_config (impedir que qualquer autenticado leia credenciais do Drive)
DROP POLICY IF EXISTS "Authenticated users can view gdrive config" ON public.gdrive_config;
CREATE POLICY "Somente admin e master acessam gdrive_config" 
ON public.gdrive_config 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

-- Adicionar explicitamente o search_path na get_checklist_token para evitar bypass
CREATE OR REPLACE FUNCTION public.get_checklist_token(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT token INTO v_token
  FROM public.checklist_tokens
  WHERE checklist_id = p_id;
  RETURN v_token;
END;
$$;
