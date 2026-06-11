-- Function to handle faturamento status change
CREATE OR REPLACE FUNCTION public.handle_faturamento_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_id UUID;
  v_responsavel_nome TEXT;
  v_responsavel_id UUID;
  v_cliente_nome TEXT;
BEGIN
  -- Get the client company name to make the notification and tasks rich
  SELECT emp.nome INTO v_cliente_nome
  FROM public.contratos ct
  JOIN public.empresas emp ON emp.id = ct.empresa_id
  WHERE ct.id = NEW.contrato_id;

  -- 1. Sync status to agenda if an agenda row exists linked to this faturamento
  -- We search for an agenda item where "notas" contains the faturamento id and category is 'Medição'
  SELECT id, responsavel_nome INTO v_agenda_id, v_responsavel_nome
  FROM public.agenda
  WHERE notas ILIKE '%' || NEW.id::text || '%' AND categoria = 'Medição'
  LIMIT 1;

  IF v_agenda_id IS NOT NULL THEN
    IF NEW.status = 'Aprovado' THEN
      UPDATE public.agenda
      SET status = 'Concluído', updated_at = now()
      WHERE id = v_agenda_id;
    ELSIF NEW.status = 'Aguardando Aprovação' THEN
      UPDATE public.agenda
      SET status = 'Aguardando Aprovação', updated_at = now()
      WHERE id = v_agenda_id;
    ELSIF NEW.status = 'Pendente' THEN
      UPDATE public.agenda
      SET status = 'A Fazer', updated_at = now()
      WHERE id = v_agenda_id;
    END IF;
  END IF;

  -- 2. If faturamento is 'Aprovado', automatically create the invoicing task
  IF NEW.status = 'Aprovado' AND (OLD.status IS NULL OR OLD.status <> 'Aprovado') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.agenda 
      WHERE notas ILIKE '%' || NEW.id::text || '%' AND categoria = 'Faturamento'
    ) THEN
      INSERT INTO public.agenda (id, titulo, descricao, data_inicio, status, prioridade, categoria, contrato_id, empresa_id, notas, responsavel_nome)
      VALUES (
        gen_random_uuid(),
        'Emitir Fatura - ' || COALESCE(v_cliente_nome, 'Cliente'),
        'Medição aprovada. Lançar o número da nota fiscal (FAT...) para concluir o faturamento.',
        now(),
        'A Fazer',
        'Média',
        'Faturamento',
        NEW.contrato_id,
        NEW.empresa_id,
        '[Medição ID: ' || NEW.id::text || ']',
        ''
      );
    END IF;
  END IF;

  -- 3. If invoice number (numero_nota) is filled, complete the invoicing task
  IF NEW.numero_nota IS NOT NULL AND (OLD.numero_nota IS NULL OR OLD.numero_nota <> NEW.numero_nota) THEN
    UPDATE public.agenda
    SET status = 'Concluído', updated_at = now()
    WHERE notas ILIKE '%' || NEW.id::text || '%' AND categoria = 'Faturamento';
  END IF;

  -- 4. Create notifications automatically on status changes
  IF NEW.status = 'Aguardando Aprovação' AND (OLD.status IS NULL OR OLD.status <> 'Aguardando Aprovação') THEN
    -- Try to find the user_id matching the responsavel_nome in profiles
    IF v_responsavel_nome IS NOT NULL AND v_responsavel_nome <> '' THEN
      SELECT user_id INTO v_responsavel_id
      FROM public.profiles
      WHERE nome = v_responsavel_nome
      LIMIT 1;
    END IF;

    -- If we have a specific responsible user, notify them
    IF v_responsavel_id IS NOT NULL THEN
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, lida, referencia_tipo, referencia_id)
      VALUES (
        v_responsavel_id,
        'aprovacao',
        'Medição Aguardando Aprovação',
        COALESCE('Uma nova medição da empresa ' || v_cliente_nome || ' está aguardando sua aprovação.', 'Uma nova medição está aguardando sua aprovação.'),
        FALSE,
        'medicao',
        NEW.id
      );
    ELSE
      -- Fallback: Notify all administrators
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, lida, referencia_tipo, referencia_id)
      SELECT DISTINCT user_id, 'aprovacao', 'Medição Aguardando Aprovação',
             COALESCE('Uma nova medição da empresa ' || v_cliente_nome || ' está aguardando aprovação.', 'Uma nova medição está aguardando aprovação.'),
             FALSE, 'medicao', NEW.id
      FROM public.user_roles
      WHERE role = 'admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_faturamento_status_change ON public.faturamento;
CREATE TRIGGER trg_faturamento_status_change
AFTER UPDATE ON public.faturamento
FOR EACH ROW
EXECUTE FUNCTION public.handle_faturamento_status_change();
