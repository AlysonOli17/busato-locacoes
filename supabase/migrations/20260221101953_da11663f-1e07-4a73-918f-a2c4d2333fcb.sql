
ALTER TABLE public.apolices
  ADD COLUMN tem_adesao boolean NOT NULL DEFAULT false,
  ADD COLUMN valor_adesao numeric NOT NULL DEFAULT 0,
  ADD COLUMN tem_parcelamento boolean NOT NULL DEFAULT false,
  ADD COLUMN numero_parcelas integer NOT NULL DEFAULT 1;
