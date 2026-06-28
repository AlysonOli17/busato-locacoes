-- Módulo de Workflows Dinâmicos

CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  icone text DEFAULT 'git-merge',
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL,
  cor text DEFAULT 'bg-gray-500',
  requer_aprovacao boolean DEFAULT false,
  qtd_aprovacoes_necessarias integer DEFAULT 1,
  permite_retorno boolean DEFAULT true,
  notificar_whatsapp boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo serial NOT NULL,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.workflow_etapas(id),
  titulo text NOT NULL,
  descricao text,
  solicitante_id uuid REFERENCES auth.users(id),
  solicitante_nome text, -- caso queiram gravar sem UUID
  prioridade text DEFAULT 'Média', -- Baixa, Média, Alta, Urgente
  status text DEFAULT 'Aberta', -- Aberta, Concluida, Cancelada
  dados_adicionais jsonb DEFAULT '{}'::jsonb, -- Campos customizados
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.solicitacoes_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.workflow_etapas(id) ON DELETE CASCADE,
  aprovador_id uuid REFERENCES auth.users(id),
  aprovador_nome text NOT NULL,
  status text NOT NULL, -- Aprovado, Rejeitado
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.solicitacoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
  etapa_anterior_id uuid REFERENCES public.workflow_etapas(id) ON DELETE SET NULL,
  etapa_nova_id uuid REFERENCES public.workflow_etapas(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES auth.users(id),
  usuario_nome text NOT NULL,
  acao text NOT NULL, -- Criado, Movido, Comentou, Cancelado
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS e Políticas
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_historico ENABLE ROW LEVEL SECURITY;

-- Por enquanto, liberando acesso para todos os usuários autenticados da empresa
CREATE POLICY "Acesso total workflows" ON public.workflows FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acesso total workflow_etapas" ON public.workflow_etapas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acesso total solicitacoes" ON public.solicitacoes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acesso total aprovacoes" ON public.solicitacoes_aprovacoes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acesso total historico" ON public.solicitacoes_historico FOR ALL USING (auth.role() = 'authenticated');

-- Triggers de update (Opcional, mas util se tiver a funcao gerenica)
-- CREATE TRIGGER handle_updated_at_workflows BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.moddatetime();

-- Index para performance
CREATE INDEX solicitacoes_workflow_idx ON public.solicitacoes(workflow_id);
CREATE INDEX solicitacoes_etapa_idx ON public.solicitacoes(etapa_id);
