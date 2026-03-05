
-- Propostas comerciais
CREATE TABLE public.propostas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_sequencial integer NOT NULL DEFAULT 1,
  empresa_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  validade_dias integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'Rascunho',
  valor_mobilizacao numeric NOT NULL DEFAULT 0,
  valor_mobilizacao_texto text NOT NULL DEFAULT '',
  prazo_pagamento integer NOT NULL DEFAULT 30,
  conta_bancaria_id uuid,
  consultor_nome text NOT NULL DEFAULT '',
  consultor_email text NOT NULL DEFAULT '',
  consultor_telefone text NOT NULL DEFAULT '',
  consultor_nome_2 text DEFAULT '',
  consultor_email_2 text DEFAULT '',
  consultor_telefone_2 text DEFAULT '',
  observacoes text DEFAULT '',
  franquia_horas_texto text DEFAULT '',
  horas_excedentes_texto text DEFAULT '',
  disponibilidade_texto text DEFAULT '',
  analise_cadastral_texto text DEFAULT '',
  seguro_texto text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Equipamentos da proposta
CREATE TABLE public.propostas_equipamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposta_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  equipamento_tipo text NOT NULL DEFAULT '',
  quantidade integer NOT NULL DEFAULT 1,
  valor_hora numeric NOT NULL DEFAULT 0,
  franquia_mensal numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Responsabilidades da proposta
CREATE TABLE public.propostas_responsabilidades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposta_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  atividade text NOT NULL,
  responsavel_busato boolean NOT NULL DEFAULT false,
  responsavel_cliente boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Sequence for proposal numbers
CREATE SEQUENCE IF NOT EXISTS propostas_numero_seq START 95;
ALTER TABLE public.propostas ALTER COLUMN numero_sequencial SET DEFAULT nextval('propostas_numero_seq');

-- RLS
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propostas_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propostas_responsabilidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to propostas" ON public.propostas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access to propostas_equipamentos" ON public.propostas_equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access to propostas_responsabilidades" ON public.propostas_responsabilidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER update_propostas_updated_at BEFORE UPDATE ON public.propostas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
