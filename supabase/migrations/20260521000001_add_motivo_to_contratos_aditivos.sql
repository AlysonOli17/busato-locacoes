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
