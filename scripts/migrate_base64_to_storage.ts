import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configuração: Insira suas chaves aqui ou use variáveis de ambiente (.env)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'COLOQUE_A_URL_AQUI';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'COLOQUE_A_CHAVE_AQUI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function migrateApolices() {
  console.log("Iniciando migração de Base64 para Storage (Tabela: apolices)...");

  // Busca apólices que ainda possuem base64
  const { data: apolices, error: fetchError } = await supabase
    .from('apolices')
    .select('id, arquivo_nome, arquivo_base64')
    .not('arquivo_base64', 'is', null);

  if (fetchError) {
    console.error("Erro ao buscar apólices:", fetchError);
    return;
  }

  if (!apolices || apolices.length === 0) {
    console.log("Nenhuma apólice pendente de migração encontrada.");
    return;
  }

  console.log(`Encontradas ${apolices.length} apólices para migrar.`);

  let successCount = 0;
  let errorCount = 0;

  for (const apolice of apolices) {
    try {
      if (!apolice.arquivo_base64 || !apolice.arquivo_nome) continue;

      console.log(`Processando apólice ID: ${apolice.id} (${apolice.arquivo_nome})...`);

      // 1. Extrair o binário do base64
      // O formato geralmente é: data:application/pdf;base64,JVBERi0...
      const base64Data = apolice.arquivo_base64.split(',')[1] || apolice.arquivo_base64;
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Inferir mimetype básico
      let mimeType = 'application/pdf';
      if (apolice.arquivo_nome.toLowerCase().endsWith('.png')) mimeType = 'image/png';
      else if (apolice.arquivo_nome.toLowerCase().match(/\.jpe?g$/)) mimeType = 'image/jpeg';

      // 2. Definir caminho no bucket
      // Ex: apolices/uuid-da-apolice/nome-do-arquivo.pdf
      const storagePath = `apolices/${apolice.id}/${apolice.arquivo_nome}`;

      // 3. Fazer o Upload para o Storage
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Erro no upload do Storage: ${uploadError.message}`);
      }

      // 4. Atualizar o banco de dados
      // Vamos assumir que criaremos uma coluna 'arquivo_url' depois, 
      // mas por enquanto podemos limpar o base64 e deixar o app refatorado buscar via storage.
      const { error: updateError } = await supabase
        .from('apolices')
        .update({ 
          arquivo_base64: null // Limpa o dado pesado
          // se você criar a coluna arquivo_path, adicione aqui: arquivo_path: storagePath
        })
        .eq('id', apolice.id);

      if (updateError) {
        throw new Error(`Erro ao atualizar registro no banco: ${updateError.message}`);
      }

      console.log(`✅ Apólice ${apolice.id} migrada com sucesso.`);
      successCount++;
    } catch (err: any) {
      console.error(`❌ Falha ao migrar apólice ${apolice.id}:`, err.message);
      errorCount++;
    }
  }

  console.log("-----------------------------------------");
  console.log("Resumo da Migração:");
  console.log(`Sucessos: ${successCount}`);
  console.log(`Erros: ${errorCount}`);
  console.log("-----------------------------------------");
}

migrateApolices().catch(console.error);
