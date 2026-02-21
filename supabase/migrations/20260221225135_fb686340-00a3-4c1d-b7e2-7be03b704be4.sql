
-- Temporary adjustments for equipment values within a contract
CREATE TABLE public.contratos_equipamentos_ajustes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  valor_hora numeric NOT NULL DEFAULT 0,
  valor_hora_excedente numeric NOT NULL DEFAULT 0,
  hora_minima numeric NOT NULL DEFAULT 0,
  horas_contratadas numeric NOT NULL DEFAULT 0,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_equipamentos_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to contratos_equipamentos_ajustes"
  ON public.contratos_equipamentos_ajustes
  FOR ALL
  USING (true)
  WITH CHECK (true);
