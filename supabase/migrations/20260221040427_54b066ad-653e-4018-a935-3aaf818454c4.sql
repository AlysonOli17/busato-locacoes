-- Drop the generated column and recreate as regular column
ALTER TABLE public.medicoes DROP COLUMN horas_trabalhadas;
ALTER TABLE public.medicoes ADD COLUMN horas_trabalhadas numeric DEFAULT 0;