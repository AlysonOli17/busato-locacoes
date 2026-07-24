-- Adiciona campo finalidade para separar equipamentos de locacao de equipamentos de controle administrativo
ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS finalidade text NOT NULL DEFAULT 'Locacao';

