-- 1. Tabela de Checklists
CREATE TABLE IF NOT EXISTS public.checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  equipamento_id UUID NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'Entrega' ou 'Devolução'
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  horimetro NUMERIC NOT NULL DEFAULT 0,
  inspector TEXT NOT NULL, -- Responsável pela vistoria
  status TEXT NOT NULL DEFAULT 'Aprovado', -- 'Aprovado', 'Com Ressalvas', 'Reprovado'
  itens JSONB NOT NULL DEFAULT '{}'::jsonb, -- Dicionário com itens verificados (ex: { 'freio': true, 'pneus': false })
  notas TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabela de Custos Internos do Equipamento
CREATE TABLE IF NOT EXISTS public.equipamentos_custos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id UUID NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL, -- Ex: "Parcela Financiamento Banco Alfa"
  valor NUMERIC NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL, -- 'Financiamento', 'Seguro Fixo', 'Rastreador', 'Depreciação', 'Outros'
  periodicidade TEXT NOT NULL DEFAULT 'Mensal', -- 'Único', 'Mensal', 'Anual'
  data_vencimento DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos_custos ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes caso rodem mais de uma vez
DROP POLICY IF EXISTS "Allow all access to checklists" ON public.checklists;
DROP POLICY IF EXISTS "Allow all access to equipamentos_custos" ON public.equipamentos_custos;

-- Criar políticas de acesso público para todas as operações
CREATE POLICY "Allow all access to checklists" ON public.checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to equipamentos_custos" ON public.equipamentos_custos FOR ALL USING (true) WITH CHECK (true);

-- Criar triggers para data de atualização
DROP TRIGGER IF EXISTS update_checklists_updated_at ON public.checklists;
CREATE TRIGGER update_checklists_updated_at BEFORE UPDATE ON public.checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_equipamentos_custos_updated_at ON public.equipamentos_custos;
CREATE TRIGGER update_equipamentos_custos_updated_at BEFORE UPDATE ON public.equipamentos_custos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
