-- Adicionar coluna aprovador_id na tabela workflow_etapas
ALTER TABLE public.workflow_etapas 
ADD COLUMN IF NOT EXISTS aprovador_id uuid REFERENCES public.profiles(id);
