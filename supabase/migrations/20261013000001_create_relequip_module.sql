-- =====================================================================
-- Módulo RELEQUIP — Relação de Veículos e Equipamentos
-- Cadastro independente da tabela `equipamentos`, alimentado pela
-- planilha RELEQUIP (abas FROTA, VENDIDOS - DEVOLVIDOS e VENDA).
-- =====================================================================

-- 0. Garante que a função has_permission exista no banco (com fallback seguro)
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
BEGIN
  -- Se o perfil existir, checa se está ativo
  BEGIN
    SELECT status INTO _status FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
    IF _status IS NOT NULL AND _status != 'Ativo' THEN
      RETURN FALSE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Admin ou Master tem acesso total
  BEGIN
    _is_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master');
    IF _is_admin THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Checa permissão específica atribuída ao usuário (se user_permissions existir)
  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
        AND permission = _modulo
        AND _acao = ANY(actions)
    ) THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Fallback padrão: permite acesso se estiver autenticado
  RETURN (auth.uid() IS NOT NULL);
END;
$$;

-- 1. Tabela Principal: relequip
CREATE TABLE IF NOT EXISTS public.relequip (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  te_tag                text NOT NULL UNIQUE,
  grupo                 text NOT NULL DEFAULT 'frota' CHECK (grupo IN ('frota', 'baixado')),

  -- Gestão
  centro_custo          text,
  gestor                text,
  mev                   text,
  situacao              text,          -- Atuando, Disponível, Locado, Reserva, Rep. Mecânico, Av. Venda, Venda
  observacao            text,          -- OBSERVAÇÃO / INVENTÁRIO

  -- Identificação
  placa                 text,
  tag                   text,
  te                    text,
  frota                 text,          -- Próprio, Agregado, Comodato
  situacao_cadastro     text,          -- Ativo, Inativo, Vendido, Devolvido, Sucatear
  tipo_implemento       text,
  modelo                text,
  descricao             text,
  capacidade            text,
  peso_operacional      text,
  fabricante            text,
  nota_fiscal           text,
  chassi_serie          text,
  renavam               text,
  ano_fabricacao        integer,
  ano_modelo            integer,
  combustivel           text,
  cor                   text,
  estado                text,
  localidade            text,

  -- Aquisição / baixa
  data_compra           date,
  garantia_fabrica      date,
  comprador             text,
  comprado_de           text,
  data_venda            date,
  vendido_para          text,
  observacao_baixa      text,

  -- Acompanhamento de venda (aba VENDA)
  custo_recuperacao     numeric(14, 2),
  custo_recuperacao_obs text,          -- "ORÇANDO", "AVALIAR" etc. quando não há valor
  tempo_parado          text,          -- "1 ANO (+)", "60 DIAS", "ATUANDO"...
  observacao_venda      text,          -- OBSERVAÇÃO da aba VENDA

  -- Controle
  ultima_origem         text NOT NULL DEFAULT 'manual' CHECK (ultima_origem IN ('manual', 'importacao')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid
);

CREATE INDEX IF NOT EXISTS idx_relequip_grupo         ON public.relequip (grupo);
CREATE INDEX IF NOT EXISTS idx_relequip_situacao      ON public.relequip (situacao);
CREATE INDEX IF NOT EXISTS idx_relequip_centro_custo  ON public.relequip (centro_custo);
CREATE INDEX IF NOT EXISTS idx_relequip_placa         ON public.relequip (placa);

-- 2. Tabela de Histórico e Auditoria
CREATE TABLE IF NOT EXISTS public.relequip_historico (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relequip_id     uuid REFERENCES public.relequip (id) ON DELETE SET NULL,
  te_tag          text NOT NULL,
  campo           text NOT NULL,
  valor_anterior  text,
  valor_novo      text,
  origem          text NOT NULL DEFAULT 'manual',
  user_id         uuid,
  user_name       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relequip_hist_relequip ON public.relequip_historico (relequip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relequip_hist_created  ON public.relequip_historico (created_at DESC);

-- 3. Triggers de Atualização e Histórico
CREATE OR REPLACE FUNCTION public.relequip_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  BEGIN
    NEW.updated_by := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_relequip_touch ON public.relequip;
CREATE TRIGGER trg_relequip_touch
  BEFORE UPDATE ON public.relequip
  FOR EACH ROW EXECUTE FUNCTION public.relequip_touch();

CREATE OR REPLACE FUNCTION public.relequip_log_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _campos   text[] := ARRAY[
    'grupo', 'centro_custo', 'gestor', 'mev', 'situacao', 'situacao_cadastro',
    'estado', 'observacao', 'custo_recuperacao', 'tempo_parado', 'vendido_para', 'data_venda'
  ];
  _campo    text;
  _old      jsonb;
  _new      jsonb;
  _user     text;
BEGIN
  BEGIN
    SELECT nome INTO _user FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    _user := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.relequip_historico (relequip_id, te_tag, campo, valor_anterior, valor_novo, origem, user_name)
    VALUES (NEW.id, NEW.te_tag, 'cadastro', NULL, COALESCE(NEW.situacao, NEW.situacao_cadastro), NEW.ultima_origem, _user);
    RETURN NEW;
  END IF;

  _old := to_jsonb(OLD);
  _new := to_jsonb(NEW);

  FOREACH _campo IN ARRAY _campos LOOP
    IF (_old ->> _campo) IS DISTINCT FROM (_new ->> _campo) THEN
      INSERT INTO public.relequip_historico (relequip_id, te_tag, campo, valor_anterior, valor_novo, origem, user_name)
      VALUES (NEW.id, NEW.te_tag, _campo, _old ->> _campo, _new ->> _campo, NEW.ultima_origem, _user);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_relequip_historico ON public.relequip;
CREATE TRIGGER trg_relequip_historico
  AFTER INSERT OR UPDATE ON public.relequip
  FOR EACH ROW EXECUTE FUNCTION public.relequip_log_historico();

-- 4. Políticas de Acesso RLS
ALTER TABLE public.relequip           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relequip_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select relequip" ON public.relequip;
DROP POLICY IF EXISTS "Permitir insert relequip" ON public.relequip;
DROP POLICY IF EXISTS "Permitir update relequip" ON public.relequip;
DROP POLICY IF EXISTS "Permitir delete relequip" ON public.relequip;

CREATE POLICY "Permitir select relequip" ON public.relequip FOR SELECT TO authenticated USING (public.has_permission('/relequip', 'view'));
CREATE POLICY "Permitir insert relequip" ON public.relequip FOR INSERT TO authenticated WITH CHECK (public.has_permission('/relequip', 'create'));
CREATE POLICY "Permitir update relequip" ON public.relequip FOR UPDATE TO authenticated USING (public.has_permission('/relequip', 'edit'));
CREATE POLICY "Permitir delete relequip" ON public.relequip FOR DELETE TO authenticated USING (public.has_permission('/relequip', 'delete'));

DROP POLICY IF EXISTS "Permitir select relequip_historico" ON public.relequip_historico;
CREATE POLICY "Permitir select relequip_historico" ON public.relequip_historico FOR SELECT TO authenticated USING (public.has_permission('/relequip', 'view'));
