ALTER TABLE public.contratos_aditivos ADD COLUMN IF NOT EXISTS motivo text DEFAULT '';

-- Copy existing 'tipo' column values to 'motivo' if 'tipo' exists
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='contratos_aditivos' AND column_name='tipo'
    ) THEN
        UPDATE public.contratos_aditivos SET motivo = tipo WHERE motivo = '';
    END IF;
END $$;

-- Ensure foreign key constraint between aditivos_equipamentos and contratos_aditivos exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'aditivos_equipamentos_aditivo_id_fkey' 
          AND table_name = 'aditivos_equipamentos'
    ) THEN
        ALTER TABLE public.aditivos_equipamentos 
          ADD CONSTRAINT aditivos_equipamentos_aditivo_id_fkey 
          FOREIGN KEY (aditivo_id) 
          REFERENCES public.contratos_aditivos(id) 
          ON DELETE CASCADE;
    END IF;
END $$;
