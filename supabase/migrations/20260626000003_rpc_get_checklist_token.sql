CREATE OR REPLACE FUNCTION get_checklist_token(token_str text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', t.id,
    'token', t.token,
    'tipo', t.tipo,
    'expires_at', t.expires_at,
    'used', t.used,
    'contrato_id', t.contrato_id,
    'equipamento_id', t.equipamento_id,
    'equipamento', (
      SELECT json_build_object(
        'tipo', e.tipo,
        'modelo', e.modelo,
        'tag_placa', e.tag_placa,
        'numero_serie', e.numero_serie
      ) FROM public.equipamentos e WHERE e.id = t.equipamento_id
    ),
    'contrato', (
      SELECT json_build_object(
        'empresas', (
          SELECT json_build_object('nome', emp.nome)
          FROM public.empresas emp WHERE emp.id = c.empresa_id
        )
      ) FROM public.contratos c WHERE c.id = t.contrato_id
    )
  )
  INTO result
  FROM public.checklist_tokens t
  WHERE t.token = token_str;

  RETURN result;
END;
$$;
