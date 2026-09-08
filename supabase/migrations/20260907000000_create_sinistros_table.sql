CREATE TABLE IF NOT EXISTS public.sinistros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    apolice_id UUID NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
    equipamento_id UUID NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
    tipo_sinistro TEXT NOT NULL,
    franquia NUMERIC(10, 2) NOT NULL DEFAULT 0,
    data_sinistro DATE NOT NULL,
    data_previsao_retorno DATE,
    data_retorno DATE,
    observacoes TEXT,
    status TEXT NOT NULL DEFAULT 'Aberto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.sinistros ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso genérica para autenticados
CREATE POLICY "Permitir acesso total a sinistros para usuários autenticados" 
ON public.sinistros
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
