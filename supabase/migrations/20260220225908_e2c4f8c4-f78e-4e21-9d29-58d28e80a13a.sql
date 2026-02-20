
-- Add CNPJ card fields to empresas table
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS razao_social text DEFAULT '',
  ADD COLUMN IF NOT EXISTS nome_fantasia text DEFAULT '',
  ADD COLUMN IF NOT EXISTS inscricao_estadual text DEFAULT '',
  ADD COLUMN IF NOT EXISTS inscricao_municipal text DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_logradouro text DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_numero text DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_complemento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_bairro text DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_cidade text DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_uf text DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_cep text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS atividade_principal text DEFAULT '';
