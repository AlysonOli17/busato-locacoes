-- Alterar a tabela gastos para suportar campos de Ordem de Serviço (Oficina)

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS data_agendada date,
ADD COLUMN IF NOT EXISTS data_conclusao date,
ADD COLUMN IF NOT EXISTS oficina text,
ADD COLUMN IF NOT EXISTS urgencia text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Concluída';

-- Garantir que os registros antigos (que já eram gastos efetivados) fiquem como 'Concluída'
UPDATE public.gastos
SET status = 'Concluída'
WHERE status IS NULL;
