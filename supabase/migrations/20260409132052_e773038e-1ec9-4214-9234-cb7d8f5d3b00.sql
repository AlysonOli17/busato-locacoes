
-- Fornecedores (empresas de quem se loca)
CREATE TABLE public.fornecedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  cnpj text NOT NULL DEFAULT '',
  razao_social text DEFAULT '',
  nome_fantasia text DEFAULT '',
  contato text DEFAULT '',
  telefone text DEFAULT '',
  email text DEFAULT '',
  endereco_logradouro text DEFAULT '',
  endereco_numero text DEFAULT '',
  endereco_complemento text DEFAULT '',
  endereco_bairro text DEFAULT '',
  endereco_cidade text DEFAULT '',
  endereco_uf text DEFAULT '',
  endereco_cep text DEFAULT '',
  observacoes text DEFAULT '',
  status text NOT NULL DEFAULT 'Ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to fornecedores" ON public.fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Equipamentos de terceiros
CREATE TABLE public.equipamentos_terceiros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  modelo text NOT NULL,
  tag_placa text,
  numero_serie text,
  ano integer,
  observacoes text DEFAULT '',
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipamentos_terceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to equipamentos_terceiros" ON public.equipamentos_terceiros FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_equipamentos_terceiros_updated_at BEFORE UPDATE ON public.equipamentos_terceiros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contratos de terceiros
CREATE TABLE public.contratos_terceiros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  tipo_medicao text NOT NULL DEFAULT 'horas',
  dia_medicao_inicio integer NOT NULL DEFAULT 1,
  dia_medicao_fim integer NOT NULL DEFAULT 30,
  prazo_pagamento integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'Ativo',
  observacoes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_terceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to contratos_terceiros" ON public.contratos_terceiros FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_contratos_terceiros_updated_at BEFORE UPDATE ON public.contratos_terceiros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Equipamentos por contrato de terceiros
CREATE TABLE public.contratos_terceiros_equipamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id uuid NOT NULL REFERENCES public.contratos_terceiros(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos_terceiros(id),
  valor_hora numeric NOT NULL DEFAULT 0,
  valor_hora_excedente numeric NOT NULL DEFAULT 0,
  horas_contratadas numeric NOT NULL DEFAULT 0,
  hora_minima numeric NOT NULL DEFAULT 0,
  data_entrega date,
  data_devolucao date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_terceiros_equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to contratos_terceiros_equipamentos" ON public.contratos_terceiros_equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Aditivos de contratos terceiros
CREATE TABLE public.contratos_terceiros_aditivos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id uuid NOT NULL REFERENCES public.contratos_terceiros(id) ON DELETE CASCADE,
  numero integer NOT NULL DEFAULT 1,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text NOT NULL DEFAULT '',
  observacoes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_terceiros_aditivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to contratos_terceiros_aditivos" ON public.contratos_terceiros_aditivos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Equipamentos por aditivo terceiros
CREATE TABLE public.contratos_terceiros_aditivos_equipamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aditivo_id uuid NOT NULL REFERENCES public.contratos_terceiros_aditivos(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos_terceiros(id),
  valor_hora numeric NOT NULL DEFAULT 0,
  valor_hora_excedente numeric NOT NULL DEFAULT 0,
  horas_contratadas numeric NOT NULL DEFAULT 0,
  hora_minima numeric NOT NULL DEFAULT 0,
  data_entrega date,
  data_devolucao date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_terceiros_aditivos_equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to contratos_terceiros_aditivos_equipamentos" ON public.contratos_terceiros_aditivos_equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ajustes temporários contratos terceiros
CREATE TABLE public.contratos_terceiros_equipamentos_ajustes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id uuid NOT NULL REFERENCES public.contratos_terceiros(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos_terceiros(id),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  valor_hora numeric NOT NULL DEFAULT 0,
  valor_hora_excedente numeric NOT NULL DEFAULT 0,
  horas_contratadas numeric NOT NULL DEFAULT 0,
  hora_minima numeric NOT NULL DEFAULT 0,
  desconto_percentual numeric NOT NULL DEFAULT 0,
  motivo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_terceiros_equipamentos_ajustes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to contratos_terceiros_equipamentos_ajustes" ON public.contratos_terceiros_equipamentos_ajustes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Medições de terceiros (horímetro)
CREATE TABLE public.medicoes_terceiros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos_terceiros(id),
  data date NOT NULL DEFAULT CURRENT_DATE,
  horimetro_inicial numeric NOT NULL DEFAULT 0,
  horimetro_final numeric NOT NULL DEFAULT 0,
  horas_trabalhadas numeric DEFAULT 0,
  tipo text NOT NULL DEFAULT 'Trabalho',
  observacoes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medicoes_terceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to medicoes_terceiros" ON public.medicoes_terceiros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Custos de terceiros
CREATE TABLE public.custos_terceiros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos_terceiros(id),
  data date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric NOT NULL DEFAULT 0,
  descricao text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'Manutenção',
  classificacao text NOT NULL DEFAULT 'A Cobrar do Cliente',
  observacoes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custos_terceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to custos_terceiros" ON public.custos_terceiros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permissões de rota para locação terceiros (reusa a permissão /agregados)
