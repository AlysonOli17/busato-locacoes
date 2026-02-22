
-- Add auto-increment sequential number to faturamento
CREATE SEQUENCE IF NOT EXISTS public.faturamento_numero_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE public.faturamento 
ADD COLUMN numero_sequencial integer NOT NULL DEFAULT nextval('public.faturamento_numero_seq');

-- Set existing rows' sequential numbers based on creation order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.faturamento
)
UPDATE public.faturamento f
SET numero_sequencial = n.rn
FROM numbered n
WHERE f.id = n.id;

-- Set the sequence to continue from the max
SELECT setval('public.faturamento_numero_seq', COALESCE((SELECT MAX(numero_sequencial) FROM public.faturamento), 0) + 1, false);

-- Create unique index
CREATE UNIQUE INDEX idx_faturamento_numero_sequencial ON public.faturamento(numero_sequencial);

-- Also create a table to store per-equipment details in each invoice
CREATE TABLE public.faturamento_equipamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  faturamento_id uuid NOT NULL REFERENCES public.faturamento(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id),
  horas_normais numeric NOT NULL DEFAULT 0,
  horas_excedentes numeric NOT NULL DEFAULT 0,
  valor_hora numeric NOT NULL DEFAULT 0,
  valor_hora_excedente numeric NOT NULL DEFAULT 0,
  hora_minima numeric NOT NULL DEFAULT 0,
  primeiro_mes boolean NOT NULL DEFAULT false,
  horas_medidas numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.faturamento_equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to faturamento_equipamentos"
ON public.faturamento_equipamentos
FOR ALL
USING (true)
WITH CHECK (true);
