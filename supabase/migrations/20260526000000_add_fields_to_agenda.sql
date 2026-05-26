-- Add fields to public.agenda table to support Monday.com spreadsheet view
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS orcamento NUMERIC DEFAULT 0;
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT '';
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS responsavel_nome TEXT DEFAULT '';
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS arquivos TEXT[] DEFAULT '{}';
