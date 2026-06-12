-- Migration to add file storage capability to the apolices table
ALTER TABLE public.apolices ADD COLUMN IF NOT EXISTS arquivo_base64 TEXT;
ALTER TABLE public.apolices ADD COLUMN IF NOT EXISTS arquivo_nome TEXT;
