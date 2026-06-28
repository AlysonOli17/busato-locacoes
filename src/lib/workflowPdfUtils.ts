import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

export const generateAprovacoesPdf = async (solicitacaoId: string) => {
  // 1. Fetch solicitacao
  const { data: solicitacao, error: solErr } = await supabase
    .from('solicitacoes')
    .select(`
      *,
      workflow:workflows(*),
      etapa:workflow_etapas(*)
    `)
    .eq('id', solicitacaoId)
    .single();

  if (solErr || !solicitacao) throw new Error("Erro ao buscar solicitação");

  // 2. Fetch aprovacoes
  const { data: aprovacoes, error: aprErr } = await supabase
    .from('solicitacoes_aprovacoes')
    .select(`
      *,
      etapa:workflow_etapas(*)
    `)
    .eq('solicitacao_id', solicitacaoId)
    .order('created_at', { ascending: true });

  if (aprErr) throw new Error("Erro ao buscar aprovações");

  // Generate PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175); // primary blue
  doc.text("Dossiê de Aprovação - Workflow", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth / 2, 26, { align: "center" });

  // Informações Gerais
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Dados da Solicitação", 14, 40);

  autoTable(doc, {
    startY: 45,
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    body: [
      ['Nº Solicitação', `#${solicitacao.codigo}`],
      ['Processo (Workflow)', solicitacao.workflow?.nome || '-'],
      ['Título', solicitacao.titulo],
      ['Prioridade', solicitacao.prioridade],
      ['Etapa Atual', solicitacao.etapa?.nome || '-'],
      ['Data de Abertura', format(new Date(solicitacao.created_at), "dd/MM/yyyy HH:mm")],
    ],
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' }
    }
  });

  // Descrição
  let currentY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text("Descrição do Pedido", 14, currentY);
  
  currentY += 5;
  doc.setFontSize(10);
  const splitDesc = doc.splitTextToSize(solicitacao.descricao || "Nenhuma descrição informada.", pageWidth - 28);
  doc.text(splitDesc, 14, currentY);
  
  currentY += splitDesc.length * 5 + 10;

  // Histórico de Aprovações (O core da necessidade)
  doc.setFontSize(12);
  doc.text("Registro de Aprovações (Auditoria)", 14, currentY);

  if (aprovacoes && aprovacoes.length > 0) {
    const tableData = aprovacoes.map(apr => [
      apr.etapa?.nome || 'Etapa Excluída',
      apr.aprovador_nome,
      format(new Date(apr.created_at), "dd/MM/yyyy HH:mm"),
      apr.status,
      apr.comentario || '-'
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      head: [['Etapa / Assinatura', 'Responsável', 'Data/Hora', 'Status', 'Parecer / Justificativa']],
      body: tableData,
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 'auto' }
      }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;
  } else {
    currentY += 5;
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Nenhuma aprovação registrada para esta solicitação ainda.", 14, currentY);
    currentY += 15;
  }

  // Footer / Autenticação
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Documento gerado pelo sistema ERP Busato Locações. Autenticação ID: ${solicitacao.id}`, 14, doc.internal.pageSize.height - 10);

  // Return logic
  return doc;
};
