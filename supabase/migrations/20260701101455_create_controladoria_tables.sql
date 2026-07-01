CREATE TABLE public.centro_custos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- Ex: Operacional, Administrativo, Comercial
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.despesas_administrativas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  centro_custos_id UUID NOT NULL REFERENCES public.centro_custos(id) ON DELETE RESTRICT,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL, -- Ex: Salários, Impostos, Energia
  valor NUMERIC NOT NULL DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'Pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

