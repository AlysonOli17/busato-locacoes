ALTER TABLE public.contratos_equipamentos_ajustes ADD COLUMN IF NOT EXISTS motivo text DEFAULT '';

-- Copy existing 'observacoes' column values to 'motivo' if 'observacoes' exists
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='contratos_equipamentos_ajustes' AND column_name='observacoes'
    ) THEN
        UPDATE public.contratos_equipamentos_ajustes SET motivo = observacoes WHERE motivo = '';
    END IF;
END $$;
