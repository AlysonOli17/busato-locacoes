
-- Reset the sequence to start at 1
ALTER SEQUENCE propostas_numero_seq RESTART WITH 1;

-- Update existing proposals to have sequential numbers starting from 1
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_num
  FROM public.propostas
)
UPDATE public.propostas p
SET numero_sequencial = n.new_num
FROM numbered n
WHERE p.id = n.id;

-- Set the sequence to the next value after the max
SELECT setval('propostas_numero_seq', COALESCE((SELECT MAX(numero_sequencial) FROM public.propostas), 0));

-- Create function to renumber proposals after delete
CREATE OR REPLACE FUNCTION public.renumber_propostas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_num
    FROM public.propostas
  )
  UPDATE public.propostas p
  SET numero_sequencial = n.new_num
  FROM numbered n
  WHERE p.id = n.id;
  
  PERFORM setval('propostas_numero_seq', COALESCE((SELECT MAX(numero_sequencial) FROM public.propostas), 0));
  
  RETURN NULL;
END;
$$;

-- Create trigger to renumber after delete
DROP TRIGGER IF EXISTS trg_renumber_propostas ON public.propostas;
CREATE TRIGGER trg_renumber_propostas
AFTER DELETE ON public.propostas
FOR EACH STATEMENT
EXECUTE FUNCTION public.renumber_propostas();
