
-- Create bank accounts table
CREATE TABLE public.contas_bancarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  banco TEXT NOT NULL,
  agencia TEXT NOT NULL,
  conta TEXT NOT NULL,
  tipo_conta TEXT NOT NULL DEFAULT 'Corrente',
  titular TEXT NOT NULL,
  cnpj_cpf TEXT,
  pix TEXT,
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to contas_bancarias" ON public.contas_bancarias FOR ALL USING (true) WITH CHECK (true);

-- Add conta_bancaria_id to faturamento
ALTER TABLE public.faturamento ADD COLUMN conta_bancaria_id UUID REFERENCES public.contas_bancarias(id);
