import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://cfokxxyoivmjrxhrvinm.supabase.co', 'sb_publishable_KWMVmOKYTFviutE6CnZeNQ_wYd8roPP');

async function runMigration() {
  console.log("Iniciando migração de equipamentos_custos para gastos...");

  const { data: custos, error: fetchError } = await supabase.from('equipamentos_custos').select('*');
  if (fetchError) {
    console.error("Erro ao buscar equipamentos_custos:", fetchError);
    return;
  }

  console.log(`Encontrados ${custos?.length} custos para migrar.`);

  let successCount = 0;
  let errorCount = 0;

  for (const custo of custos || []) {
    // Check if it already exists to be safe
    const { data: existing } = await supabase.from('gastos')
      .select('id')
      .eq('equipamento_id', custo.equipamento_id)
      .eq('descricao', custo.descricao)
      .eq('valor', custo.valor)
      .eq('data', custo.vencimento);
      
    if (existing && existing.length > 0) {
      console.log(`Custo ${custo.id} já migrado, pulando...`);
      successCount++;
      continue;
    }

    const novoGasto = {
      id: crypto.randomUUID(),
      equipamento_id: custo.equipamento_id,
      descricao: custo.descricao || "Custo importado",
      tipo: custo.tipo || "Outros",
      data: custo.data_vencimento || new Date().toISOString().split('T')[0],
      valor: custo.valor,
      status: "Custo Assumido",
      created_at: custo.created_at,
      updated_at: custo.updated_at
    };

    const { error: insertError } = await supabase.from('gastos').insert([novoGasto]);

    if (insertError) {
      console.error(`Erro ao inserir custo ${custo.id}:`, insertError);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log(`Migração concluída! Sucesso/Pulados: ${successCount}. Erros: ${errorCount}.`);
}

runMigration();
