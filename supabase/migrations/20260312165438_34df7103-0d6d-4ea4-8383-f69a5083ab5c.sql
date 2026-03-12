ALTER TABLE public.medicoes ADD COLUMN tipo text NOT NULL DEFAULT 'Trabalho';
ALTER TABLE public.medicoes ADD COLUMN observacoes text NULL DEFAULT '';