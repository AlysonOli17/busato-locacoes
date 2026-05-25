-- Create agenda table
CREATE TABLE public.agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fim TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'A Fazer', -- 'A Fazer', 'Em Andamento', 'Concluído'
  prioridade TEXT NOT NULL DEFAULT 'Média', -- 'Baixa', 'Média', 'Alta'
  categoria TEXT NOT NULL DEFAULT 'Geral', -- 'Geral', 'Manutenção', 'Faturamento', 'Reunião', 'Outros'
  equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated access
CREATE POLICY "Authenticated access to agenda" ON public.agenda FOR ALL TO authenticated USING (true) WITH CHECK (true);
