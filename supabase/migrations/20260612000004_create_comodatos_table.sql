-- Criar tabela de Comodatos
CREATE TABLE IF NOT EXISTS public.comodatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comodante_nome TEXT NOT NULL,
  comodante_cnpj TEXT NOT NULL,
  comodante_endereco TEXT NOT NULL,
  comodataria_nome TEXT NOT NULL,
  comodataria_cnpj TEXT NOT NULL,
  comodataria_endereco TEXT NOT NULL,
  equipamento_id UUID NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  fabricante TEXT NOT NULL,
  ano TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  cidade TEXT NOT NULL DEFAULT 'Serra/ES',
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.comodatos ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes caso rodem mais de uma vez
DROP POLICY IF EXISTS "Allow all access to comodatos" ON public.comodatos;

-- Criar política de acesso público para todas as operações
CREATE POLICY "Allow all access to comodatos" ON public.comodatos FOR ALL USING (true) WITH CHECK (true);

-- Criar trigger para atualização do updated_at
DROP TRIGGER IF EXISTS update_comodatos_updated_at ON public.comodatos;
CREATE TRIGGER update_comodatos_updated_at BEFORE UPDATE ON public.comodatos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
