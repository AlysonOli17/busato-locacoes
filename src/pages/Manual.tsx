import React from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, BookOpen, Wrench, FileText, Clock, Receipt, Handshake } from "lucide-react";

const ManualPage = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Layout title="Manual do Sistema" subtitle="Guia passo a passo para utilização">
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Gerar PDF / Imprimir
        </Button>
      </div>

      <div className="space-y-8 print:space-y-4 max-w-5xl mx-auto bg-card p-8 rounded-xl border border-border shadow-sm print:shadow-none print:border-none print:p-0">
        
        <div className="text-center mb-10 print:mb-6">
          <BookOpen className="h-12 w-12 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold">Manual de Operação do Sistema</h1>
          <p className="text-muted-foreground mt-2">Locações e Controle de Frota</p>
        </div>

        <section className="print:break-inside-avoid">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">1. Cadastros Básicos</h2>
          </div>
          
          <div className="space-y-4 pl-8">
            <div>
              <h3 className="text-lg font-bold">Cadastro de Empresas (Clientes / Fornecedores)</h3>
              <p className="text-muted-foreground mb-2">Antes de alugar qualquer equipamento, a empresa cliente ou fornecedora precisa estar cadastrada.</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Acesse o menu lateral <strong className="text-foreground">Empresas &gt; Cadastro</strong> (para clientes) ou <strong className="text-foreground">Locação Terceiros &gt; Fornecedores</strong> (para fornecedores).</li>
                <li>Clique no botão <strong className="text-foreground">Novo</strong>.</li>
                <li>Preencha a Razão Social, CNPJ (o sistema busca automaticamente os dados da Receita se você digitar o CNPJ), contatos e endereço.</li>
                <li>Clique em <strong className="text-foreground">Salvar</strong>.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold">Cadastro de Equipamentos</h3>
              <p className="text-muted-foreground mb-2">Toda máquina, caminhão ou equipamento da sua frota ou de terceiros precisa ser registrado.</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Acesse <strong className="text-foreground">Equipamentos &gt; Cadastro</strong> (frota própria) ou <strong className="text-foreground">Locação Terceiros &gt; Equipamentos</strong> (frota terceirizada).</li>
                <li>Clique em <strong className="text-foreground">Novo</strong>.</li>
                <li>Informe o Tipo (Ex: Escavadeira, Prancha), Modelo, Placa ou Tag de identificação.</li>
                <li>Se for de terceiro, selecione a qual fornecedor o equipamento pertence.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="print:break-inside-avoid print:mt-8">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Handshake className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">2. Propostas e Contratos</h2>
          </div>
          
          <div className="space-y-4 pl-8">
            <div>
              <h3 className="text-lg font-bold">Como fazer uma Proposta</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Acesse <strong className="text-foreground">Empresas &gt; Propostas</strong> e clique em <strong className="text-foreground">Nova Proposta</strong>.</li>
                <li>Selecione o Cliente, a data de validade e adicione os equipamentos que o cliente deseja alugar, definindo se a cobrança será por <strong className="text-foreground">Horas</strong>, <strong className="text-foreground">Diárias</strong> ou <strong className="text-foreground">Mês</strong>.</li>
                <li>Você pode exportar a proposta em PDF para enviar ao cliente.</li>
                <li>Quando o cliente aprovar, mude o status para <strong className="text-foreground">Aprovada</strong>. Ao fazer isso, o sistema perguntará se você deseja <strong className="text-foreground">Gerar Contrato</strong> automaticamente a partir dessa proposta.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold">Como Efetivar um Contrato</h3>
              <p className="text-muted-foreground mb-2">Se você não gerou o contrato a partir da proposta, pode criar um do zero:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Acesse <strong className="text-foreground">Empresas &gt; Contratos</strong> e clique em <strong className="text-foreground">Novo Contrato</strong>.</li>
                <li>Selecione a empresa e o "Tipo de Medição" (Por Horas, Diárias ou Viagem).</li>
                <li>Em <strong className="text-foreground">Dia Medição Início e Fim</strong>, coloque o ciclo de fechamento (Ex: 1 a 30). Isso é vital para que o faturamento saiba quais datas puxar no final do mês.</li>
                <li>Adicione os equipamentos que farão parte do contrato, estipulando os valores negociados (Valor Base, Valor Hora Excedente, Franquia Mínima, etc).</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="print:break-inside-avoid print:mt-8">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Clock className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">3. Lançamento de Operações (Diário)</h2>
          </div>
          
          <div className="space-y-4 pl-8">
            <p className="mb-2 text-muted-foreground">Toda a operação do dia a dia deve ser registrada para que o faturamento do mês seja calculado corretamente.</p>
            
            <div>
              <h3 className="text-lg font-bold">Lançar Horímetro / Trabalhos</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Acesse <strong className="text-foreground">Medições &gt; Horímetro</strong>.</li>
                <li>Clique em <strong className="text-foreground">Novo Lançamento</strong>.</li>
                <li>Selecione o Equipamento, a Data e informe o <strong className="text-foreground">Horímetro Final</strong> do dia. O sistema calcula a diferença em relação ao dia anterior sozinho!</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold">Lançar Viagens (Pranchas e Carretas)</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>No mesmo botão de Novo Lançamento, altere a bolinha superior de "Trabalho" para <strong className="text-foreground">Viagem</strong>.</li>
                <li>Preencha a Origem/Destino, a Quantidade de viagens e o Valor negociado para aquele trecho.</li>
                <li>Você pode informar o Número da O.S (Ordem de Serviço) como comprovante.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold">Equipamento Indisponível (Manutenção)</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Se a máquina quebrou, lance como <strong className="text-foreground">Indisponível</strong>.</li>
                <li>Informe o Horímetro Inicial (hora que quebrou) e o Horímetro Final (hora que consertou).</li>
                <li>O sistema descontará essas horas paradas da cobrança do cliente no final do mês.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="print:break-inside-avoid print:mt-8">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Receipt className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">4. Faturamento e Medição (Fim do Mês)</h2>
          </div>
          
          <div className="space-y-4 pl-8">
            <p className="mb-2 text-muted-foreground">Chegou o fim do ciclo (geralmente dia 30), é hora de gerar o espelho de medição para cobrar o cliente ou pagar o fornecedor.</p>
            
            <div>
              <h3 className="text-lg font-bold">Como Gerar a Medição</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Acesse <strong className="text-foreground">Medições &gt; Emitir Medição</strong>.</li>
                <li>Selecione o Período (Ex: 01/06/2026 a 30/06/2026) e o Contrato.</li>
                <li>Clique em <strong className="text-foreground">Calcular</strong>. O sistema varrerá todos os lançamentos diários, verificará as franquias mínimas do contrato, descontará horas indisponíveis e gerará a tabela final com os totais.</li>
                <li>Confira se os valores batem e clique em <strong className="text-foreground">Salvar Medição</strong>.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold">Emitir o PDF da Medição</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Após salvar, o registro aparecerá na aba "Histórico de Medições".</li>
                <li>Clique no botão roxo de <strong className="text-foreground">PDF</strong>. Isso gera o relatório espelho (com logo da empresa) para você enviar ao cliente pedindo a aprovação.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold">Emitir a Fatura</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Com a medição aprovada pelo cliente, acesse <strong className="text-foreground">Financeiro &gt; Emissão de Faturas</strong>.</li>
                <li>Clique em <strong className="text-foreground">Gerar Fatura</strong> e vincule-a à Medição aprovada.</li>
                <li>Você pode anexar os boletos, notas fiscais e comprovantes diretamente dentro do registro da fatura.</li>
                <li>O status ficará como "Pendente". Quando o cliente pagar, mude para "Pago".</li>
              </ul>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
};

export default ManualPage;
