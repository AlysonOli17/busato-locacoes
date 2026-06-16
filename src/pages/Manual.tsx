import React, { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Printer, BookOpen, Truck, Wrench, Handshake, Calendar, Shield, DollarSign, BarChart3, Camera } from "lucide-react";

// Componente para exibir a imagem ou o placeholder se ela não existir
const ManualImage = ({ src, alt, filename }: { src: string, alt: string, filename: string }) => {
  const [error, setError] = useState(false);

  return (
    <div className="my-4 break-inside-avoid print:break-inside-avoid">
      {!error ? (
        <img 
          src={src} 
          alt={alt} 
          onError={() => setError(true)} 
          className="w-full max-w-3xl rounded-lg border border-border shadow-md"
        />
      ) : (
        <div className="w-full max-w-3xl h-64 bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-center p-6">
          <Camera className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h4 className="font-medium text-muted-foreground">Imagem não encontrada</h4>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Para exibir o print real aqui, salve a captura de tela na pasta:
          </p>
          <code className="mt-2 bg-background px-2 py-1 rounded text-xs text-primary font-mono border">
            public/manual-images/{filename}
          </code>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2 italic text-center w-full max-w-3xl">Figura: {alt}</p>
    </div>
  );
};

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

      <div className="space-y-12 print:space-y-6 max-w-5xl mx-auto bg-card p-8 rounded-xl border border-border shadow-sm print:shadow-none print:border-none print:p-0">
        
        <div className="text-center mb-12 print:mb-8">
          <BookOpen className="h-14 w-14 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold">Manual de Operação do Sistema</h1>
          <p className="text-muted-foreground mt-2">Guia completo: Locações, Terceiros, B.I e Módulos Auxiliares</p>
        </div>

        {/* INSTRUÇÕES DAS IMAGENS */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg mb-8 print:hidden">
          <h3 className="font-semibold text-amber-700 flex items-center gap-2">
            <Camera className="h-4 w-4" /> Sobre as imagens deste manual
          </h3>
          <p className="text-sm text-amber-700/90 mt-1">
            Você notará quadros cinzas espalhados pelo manual. Eles são espaços reservados. Para que os prints reais do seu sistema apareçam, você deve tirar as capturas de tela e salvá-las na pasta <code className="bg-white/50 px-1 rounded">busato-locacoes/public/manual-images/</code> com os nomes exatos indicados dentro de cada quadro. Ao recarregar a página, a imagem aparecerá magicamente!
          </p>
        </div>

        {/* 1. LOCAÇÃO DE FROTA PRÓPRIA */}
        <section className="print:break-inside-avoid">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Truck className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">1. Locação de Frota Própria</h2>
          </div>
          
          <div className="space-y-6 pl-4 border-l-2 border-muted ml-2">
            <div>
              <h3 className="text-xl font-bold">1.1 Cadastros Básicos</h3>
              <p className="text-muted-foreground mb-2 mt-1">Para locar nossa frota, o cliente e o equipamento precisam existir no sistema.</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong className="text-foreground">Cadastro de Clientes:</strong> Acesse <strong className="text-foreground">Empresas &gt; Cadastro</strong>. Clique em Novo e preencha Razão Social, CNPJ (com busca automática) e dados de contato.</li>
                <li><strong className="text-foreground">Cadastro da Frota:</strong> Acesse <strong className="text-foreground">Equipamentos &gt; Cadastro</strong>. Cadastre a máquina própria (Caminhão, Prancha, Retroescavadeira) informando Modelo e Placa/Tag.</li>
              </ul>
              <ManualImage src="/manual-images/cadastro-equipamento-proprio.png" filename="cadastro-equipamento-proprio.png" alt="Tela de cadastro de equipamento da frota" />
            </div>

            <div>
              <h3 className="text-xl font-bold">1.2 Propostas e Contratos (Clientes)</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong className="text-foreground">Propostas:</strong> Em <strong className="text-foreground">Empresas &gt; Propostas</strong>, crie uma proposta detalhando se a cobrança é por Horas, Diárias ou Viagem. Exporte o PDF e envie ao cliente.</li>
                <li><strong className="text-foreground">Efetivar Contrato:</strong> Após o cliente aprovar, mude o status para Aprovada e clique em <em>"Gerar Contrato"</em>. Ou crie um do zero em <strong className="text-foreground">Empresas &gt; Contratos</strong>.</li>
                <li><strong className="text-foreground">Atenção:</strong> No contrato, o <strong>Ciclo de Medição</strong> (Ex: Dia 1 ao 30) dita como o faturamento agrupará os dias.</li>
              </ul>
              <ManualImage src="/manual-images/contrato-cliente.png" filename="contrato-cliente.png" alt="Tela de edição de contrato de cliente" />
            </div>

            <div>
              <h3 className="text-xl font-bold">1.3 Lançamento de Medições e Viagens</h3>
              <p className="text-muted-foreground mb-2">Toda operação diária deve ser registrada em <strong className="text-foreground">Medições &gt; Horímetro</strong>.</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong>Trabalho:</strong> Lance o horímetro final da máquina. O sistema calcula a diferença sozinho.</li>
                <li><strong>Viagens:</strong> Altere a chave para "Viagem". Preencha Origem/Destino, Nº da O.S, e Valor do trecho.</li>
                <li><strong>Indisponível:</strong> Máquinas quebradas devem ser lançadas aqui para que o sistema não cobre do cliente essas horas paradas.</li>
              </ul>
              <ManualImage src="/manual-images/lancamento-diario.png" filename="lancamento-diario.png" alt="Formulário de lançamento de horímetro ou viagem" />
            </div>

            <div>
              <h3 className="text-xl font-bold">1.4 Faturamento e Emissão de Faturas</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong className="text-foreground">Emitir Medição:</strong> No fim do mês, acesse <strong className="text-foreground">Medições &gt; Emitir Medição</strong>. Escolha o período e o sistema cruzará os laçamentos com o contrato (franquias, horas extras, descontos). Salve a medição.</li>
                <li>Gere o <strong>PDF Espelho</strong> na aba de Histórico e envie ao cliente.</li>
                <li><strong className="text-foreground">Fatura Final:</strong> Acesse <strong className="text-foreground">Financeiro &gt; Emissão de faturas</strong>, clique em "Gerar Fatura", vincule à medição e anexe a NF-e e o Boleto para acompanhamento.</li>
              </ul>
              <ManualImage src="/manual-images/faturamento-medicao.png" filename="faturamento-medicao.png" alt="Tela de cálculo e resumo da medição no fim do mês" />
            </div>
          </div>
        </section>

        {/* 2. LOCAÇÃO DE TERCEIROS */}
        <section className="print:break-inside-avoid print:mt-12">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Handshake className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">2. Locação de Terceiros (Agregados e Fornecedores)</h2>
          </div>
          
          <div className="space-y-6 pl-4 border-l-2 border-muted ml-2">
            <p className="text-muted-foreground">Toda a gestão de máquinas de terceiros fica isolada no módulo <strong>Locação Terceiros</strong> para não misturar com a frota própria.</p>

            <div>
              <h3 className="text-xl font-bold">2.1 Fornecedores e Equipamentos Terceirizados</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Em <strong className="text-foreground">Locação Terceiros &gt; Fornecedores</strong>, cadastre a empresa dona da máquina.</li>
                <li>Em <strong className="text-foreground">Equipamentos</strong> (dentro de Locação Terceiros), cadastre a máquina vinculando-a ao fornecedor que você acabou de criar.</li>
              </ul>
              <ManualImage src="/manual-images/fornecedores-terceiros.png" filename="fornecedores-terceiros.png" alt="Tela de cadastro de equipamentos de terceiros" />
            </div>

            <div>
              <h3 className="text-xl font-bold">2.2 Contrato e Lançamentos do Terceiro</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong>Contrato:</strong> Acesse a aba Contratos (em Terceiros) e defina quanto VOCÊ vai pagar ao fornecedor pela máquina (Valor Base, Tipo de Medição).</li>
                <li><strong>Lançamentos Diários:</strong> Funcionam idênticos ao da frota própria, mas são feitos na aba <strong>Lançamento</strong> dentro do módulo de Terceiros.</li>
                <li><strong>Medição de Pagamento:</strong> No final do mês, a aba <strong>Medição</strong> (em Terceiros) calcula automaticamente quanto você deve transferir para o Fornecedor, gerando um PDF de conferência idêntico ao do faturamento de clientes!</li>
              </ul>
              <ManualImage src="/manual-images/medicao-terceiros.png" filename="medicao-terceiros.png" alt="PDF ou tela de medição gerada para um fornecedor" />
            </div>
          </div>
        </section>

        {/* 3. AGENDA */}
        <section className="print:break-inside-avoid print:mt-12">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">3. Agenda & Kanban</h2>
          </div>
          
          <div className="space-y-4 pl-4 border-l-2 border-muted ml-2">
            <p className="text-muted-foreground">Visão visual de onde está cada máquina.</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Acesse <strong className="text-foreground">Agenda & Kanban</strong>. O sistema mostrará colunas (Pátio, Locado, Manutenção, etc).</li>
              <li>Você pode <strong className="text-foreground">arrastar e soltar (drag & drop)</strong> os cards das máquinas de uma coluna para outra. O status do equipamento é atualizado na mesma hora.</li>
              <li>Utilize o filtro no topo para buscar uma placa específica ou visualizar apenas máquinas de terceiros.</li>
            </ul>
            <ManualImage src="/manual-images/agenda-kanban.png" filename="agenda-kanban.png" alt="Tela do painel Kanban de equipamentos" />
          </div>
        </section>

        {/* 4. SEGUROS */}
        <section className="print:break-inside-avoid print:mt-12">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">4. Seguros de Frota</h2>
          </div>
          
          <div className="space-y-4 pl-4 border-l-2 border-muted ml-2">
            <p className="text-muted-foreground">Gerencie o vencimento e os sinistros das suas apólices.</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Acesse <strong className="text-foreground">Seguros &gt; Cadastro</strong> para registrar a Seguradora.</li>
              <li>Em <strong className="text-foreground">Apólices</strong>, cadastre a vigência, anexe o PDF do contrato e vincule os equipamentos cobertos por ela.</li>
              <li><strong className="text-foreground">Sinistros:</strong> Caso bata um veículo, abra um sinistro na aba Sinistros, vincule à apólice e documente o Boletim de Ocorrência, custos de franquia e status do conserto.</li>
            </ul>
            <ManualImage src="/manual-images/seguros-sinistros.png" filename="seguros-sinistros.png" alt="Lista de apólices e status de vencimento" />
          </div>
        </section>

        {/* 5. FINANCEIRO E CUSTOS */}
        <section className="print:break-inside-avoid print:mt-12">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <DollarSign className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">5. Financeiro e Custos Diários</h2>
          </div>
          
          <div className="space-y-4 pl-4 border-l-2 border-muted ml-2">
            <p className="text-muted-foreground">O sistema não faz só o faturamento, mas também as despesas operacionais (DRE).</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">Custos Gerais:</strong> Em <strong className="text-foreground">Financeiro &gt; Custos</strong>, lance despesas fixas (água, luz, folha de pagamento).</li>
              <li><strong className="text-foreground">Custos por Equipamento:</strong> Ao comprar peça ou combustível para uma máquina específica, abra o cadastro dela em <strong className="text-foreground">Equipamentos</strong> e vá na aba <strong className="text-foreground">Custos do Equipamento</strong>. Lançando o custo lá, o sistema saberá exatamente qual foi a margem de lucro de cada máquina individualmente!</li>
            </ul>
            <ManualImage src="/manual-images/custos-equipamento.png" filename="custos-equipamento.png" alt="Lançamento de custos vinculados a uma placa" />
          </div>
        </section>

        {/* 6. CONTROLADORIA */}
        <section className="print:break-inside-avoid print:mt-12">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">6. Controladoria (B.I. e Inteligência)</h2>
          </div>
          
          <div className="space-y-4 pl-4 border-l-2 border-muted ml-2">
            <p className="text-muted-foreground">O cérebro financeiro da diretoria.</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Acesse <strong className="text-foreground">Controladoria &gt; Visão Geral & B.I.</strong>.</li>
              <li>Este painel cruza o faturamento total com os custos operacionais, mostrando a <strong>Margem Bruta (Rentabilidade)</strong> da empresa no mês.</li>
              <li>O gráfico de <em>Receitas vs Despesas</em> é montado automaticamente baseado nos contratos faturados e nos gastos inseridos no sistema. Sem planilhas externas!</li>
            </ul>
            <ManualImage src="/manual-images/controladoria-bi.png" filename="controladoria-bi.png" alt="Gráficos do painel de Business Intelligence" />
          </div>
        </section>

      </div>
    </Layout>
  );
};

export default ManualPage;
