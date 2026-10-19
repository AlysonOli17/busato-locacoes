-- Migração para módulo de SLAs Internos por Setor (Controladoria)
-- Permite configurar metas por setor/processo e monitorar ocorrências e cumprimento de prazos

CREATE TABLE IF NOT EXISTS public.sla_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor text NOT NULL, -- 'Oficina', 'Compras', 'RH', 'Financeiro', 'Logística', 'Comercial'
  processo text NOT NULL, -- Ex: 'Liberação de Equipamento Parado', 'Aquisição de Peças Críticas'
  meta_tempo numeric NOT NULL, -- Tempo estipulado
  unidade_tempo text NOT NULL DEFAULT 'dias', -- 'horas', 'dias', 'dias_uteis'
  tolerancia_aviso numeric DEFAULT 0, -- Margem antes de estourar para alerta amarelo
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sla_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES public.sla_configuracoes(id) ON DELETE SET NULL,
  setor text NOT NULL,
  processo text NOT NULL,
  titulo text NOT NULL, -- Identificador ou resumo (Ex: "Caminhão Pipa QRH-8G91 Oficina", "Peça Bomba Hidráulica")
  descricao text,
  equipamento_id uuid REFERENCES public.equipamentos(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  responsavel text,
  prioridade text NOT NULL DEFAULT 'Média', -- 'Baixa', 'Média', 'Alta', 'Crítica'
  status text NOT NULL DEFAULT 'Em Andamento', -- 'Em Andamento', 'Concluído no Prazo', 'Concluído com Atraso', 'Cancelado'
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_previsao timestamptz,
  data_conclusao timestamptz,
  tempo_meta numeric, -- Meta no momento do registro
  unidade_tempo text DEFAULT 'dias',
  observacao_fechamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.sla_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_registros ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para usuários autenticados (com permissão de controladoria se disponível ou autenticado padrão)
CREATE POLICY "Permitir select sla_configuracoes" ON public.sla_configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert sla_configuracoes" ON public.sla_configuracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir update sla_configuracoes" ON public.sla_configuracoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir delete sla_configuracoes" ON public.sla_configuracoes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Permitir select sla_registros" ON public.sla_registros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert sla_registros" ON public.sla_registros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir update sla_registros" ON public.sla_registros FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir delete sla_registros" ON public.sla_registros FOR DELETE TO authenticated USING (true);

-- Índices para consultas e relatórios ágeis
CREATE INDEX IF NOT EXISTS idx_sla_registros_setor ON public.sla_registros (setor);
CREATE INDEX IF NOT EXISTS idx_sla_registros_status ON public.sla_registros (status);
CREATE INDEX IF NOT EXISTS idx_sla_registros_inicio ON public.sla_registros (data_inicio);

-- Seed de configurações padrão de SLA da Busato Locações
INSERT INTO public.sla_configuracoes (setor, processo, meta_tempo, unidade_tempo, tolerancia_aviso, descricao)
VALUES 
  ('Oficina', 'Liberação de Equipamento Parado (Manutenção)', 48, 'horas', 12, 'Tempo máximo para diagnóstico, reparo e liberação de equipamento indisponível'),
  ('Compras', 'Prazo de Compras para Peças Críticas', 3, 'dias', 1, 'Prazo de cotação, aprovação e chegada de peças prioritárias na base/obra'),
  ('RH', 'Mobilização e Integração de Operador', 5, 'dias', 1, 'Prazo do RH para recrutamento, exame admissional, EPIs e mobilização'),
  ('Financeiro', 'Medição e Faturamento Pós-Fechamento', 2, 'dias', 1, 'Prazo do financeiro para validar boletins de medição e emitir faturas e notas fiscais'),
  ('Logística', 'Transporte / Prancha até a Obra', 24, 'horas', 6, 'Prazo para envio e entrega do equipamento na frente de trabalho após liberação')
ON CONFLICT DO NOTHING;
