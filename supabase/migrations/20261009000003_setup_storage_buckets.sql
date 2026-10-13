-- Migração: Criação de Bucket de Storage Privado para migração de Base64 (Fase 1)

-- Cria o bucket "documentos" caso não exista
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos', 'documentos', false, 52428800, '{application/pdf,image/png,image/jpeg,image/webp}')
ON CONFLICT (id) DO UPDATE SET public = false;

-- Habilita RLS no bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Permite que usuários logados façam upload
CREATE POLICY "Permitir upload para usuarios autenticados" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos');

-- Permite que usuários logados leiam os arquivos (desde que saibam o caminho ou tenham URL assinada)
CREATE POLICY "Permitir leitura para usuarios autenticados" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documentos');

-- Permite deleção (apenas admin/master podem apagar fisicamente)
CREATE POLICY "Permitir delecao para admins" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documentos' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master')));
