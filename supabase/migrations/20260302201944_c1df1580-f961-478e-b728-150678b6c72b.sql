
-- Table for contract addendums (aditivos)
CREATE TABLE public.contratos_aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  numero integer NOT NULL DEFAULT 1,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text NOT NULL DEFAULT '',
  observacoes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_aditivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to contratos_aditivos"
  ON public.contratos_aditivos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Table for equipment in each addendum
CREATE TABLE public.aditivos_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aditivo_id uuid NOT NULL REFERENCES public.contratos_aditivos(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  valor_hora numeric NOT NULL DEFAULT 0,
  horas_contratadas numeric NOT NULL DEFAULT 0,
  valor_hora_excedente numeric NOT NULL DEFAULT 0,
  hora_minima numeric NOT NULL DEFAULT 0,
  data_entrega date,
  data_devolucao date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aditivos_equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to aditivos_equipamentos"
  ON public.aditivos_equipamentos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
