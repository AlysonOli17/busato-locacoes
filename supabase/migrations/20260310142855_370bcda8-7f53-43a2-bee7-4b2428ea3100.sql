CREATE TABLE public.sinistros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  apolice_id UUID NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  equipamento_id UUID NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  tipo_sinistro TEXT NOT NULL DEFAULT '',
  franquia NUMERIC NOT NULL DEFAULT 0,
  data_sinistro DATE NOT NULL DEFAULT CURRENT_DATE,
  data_previsao_retorno DATE,
  data_retorno DATE,
  observacoes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Aberto',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sinistros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to sinistros"
  ON public.sinistros
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_sinistros_updated_at
  BEFORE UPDATE ON public.sinistros
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();