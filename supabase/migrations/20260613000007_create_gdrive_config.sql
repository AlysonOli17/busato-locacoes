-- SQL Migration to support Google Drive Dossier integration

-- 1. Create gdrive_config table
CREATE TABLE IF NOT EXISTS public.gdrive_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  root_folder_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gdrive_config ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow read for authenticated" ON public.gdrive_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gdrive_config FOR ALL TO authenticated USING (true);

-- 2. Add gdrive_folder_id column to public.contratos
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS gdrive_folder_id TEXT;
