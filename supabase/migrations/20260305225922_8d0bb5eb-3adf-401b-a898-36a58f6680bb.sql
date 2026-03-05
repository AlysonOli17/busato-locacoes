
-- Notifications table
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info',
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL DEFAULT '',
  lida BOOLEAN NOT NULL DEFAULT false,
  referencia_tipo TEXT,
  referencia_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notificacoes
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications" ON public.notificacoes
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Allow insert for authenticated (system creates notifications)
CREATE POLICY "Authenticated can insert notifications" ON public.notificacoes
FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow delete own notifications
CREATE POLICY "Users can delete own notifications" ON public.notificacoes
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Add created_by to propostas to track who created it
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS created_by UUID;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
