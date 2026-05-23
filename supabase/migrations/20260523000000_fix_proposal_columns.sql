-- Rename columns in propostas_equipamentos to match types.ts and codebase
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'propostas_equipamentos' 
      AND column_name = 'horas_contratadas'
  ) THEN
    ALTER TABLE public.propostas_equipamentos RENAME COLUMN horas_contratadas TO franquia_mensal;
  END IF;
END $$;

-- Rename columns in propostas_responsabilidades to match types.ts and codebase
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'propostas_responsabilidades' 
      AND column_name = 'descricao'
  ) THEN
    ALTER TABLE public.propostas_responsabilidades RENAME COLUMN descricao TO atividade;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'propostas_responsabilidades' 
      AND column_name = 'contratada'
  ) THEN
    ALTER TABLE public.propostas_responsabilidades RENAME COLUMN contratada TO responsavel_busato;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'propostas_responsabilidades' 
      AND column_name = 'contratante'
  ) THEN
    ALTER TABLE public.propostas_responsabilidades RENAME COLUMN contratante TO responsavel_cliente;
  END IF;
END $$;
