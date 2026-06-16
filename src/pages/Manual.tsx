import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, BookOpen, Truck, Handshake, Calendar, Shield, DollarSign, BarChart3 } from "lucide-react";

const ManualPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("frota-propria");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const setTab = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Layout title="Manual do Sistema" subtitle="Guia passo a passo para utilização">
      <style>{`
        @media print {
          @page { margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Ensure tabs content prints gracefully */
          .print\\:block { display: block !important; }
        }
      `}</style>

      {/* Cabeçalho de Impressão (Estilo Busato) */}
      <div className="hidden print:block mb-6">
        <div className="flex justify-between items-center">
          <img src="/images/logo-busato-horizontal.png" alt="Busato Locações" className="h-10" />
          <h1 className="text-xl font-bold text-gray-700 uppercase tracking-widest" style={{ fontFamily: "'Oswald', sans-serif" }}>Manual do Sistema</h1>
        </div>
        <div className="h-[2px] bg-[#2980B9] mt-3 w-full" />
        <div className="text-right text-[10px] text-gray-500 mt-1">
          Gerado em: {new Date().toLocaleDateString("pt-BR")} {new Date().toLocaleTimeString("pt-BR")}
        </div>
      </div>

      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="text-primary" /> Central de Ajuda
        </h1>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Imprimir Seção Atual
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-2 sm:p-6 print:p-0 print:shadow-none print:border-none">
        
        <Tabs value={activeTab} onValueChange={setTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-2 mb-8 bg-transparent print:hidden">
            <TabsTrigger value="frota-propria" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Truck className="h-4 w-4 mr-2" /> Frota Própria
            </TabsTrigger>
            <TabsTrigger value="terceiros" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Handshake className="h-4 w-4 mr-2" /> Terceiros
            </TabsTrigger>
            <TabsTrigger value="agenda" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="h-4 w-4 mr-2" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="seguros" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Shield className="h-4 w-4 mr-2" /> Seguros
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <DollarSign className="h-4 w-4 mr-2" /> Financeiro
            </TabsTrigger>
            <TabsTrigger value="controladoria" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-4 w-4 mr-2" /> B.I.
            </TabsTrigger>
          </TabsList>

          <div className="print:block print:w-full">
            {/* 1. LOCAÇÃO DE FROTA PRÓPRIA */}
            <TabsContent value="frota-propria" className="mt-0 outline-none">
              <section className="space-y-8">
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                  <Truck className="h-8 w-8 text-primary" />
                  <h2 className="text-3xl font-semibold">Locação de Frota Própria</h2>
                </div>
                
                <div className="space-y-8 pl-4 border-l-2 border-muted">
                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">1. Cadastros Básicos</h3>
                    <p className="text-muted-foreground mb-3 mt-1">Para locar nossa frota, o cliente e o equipamento precisam existir no sistema.</p>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li><strong className="text-foreground">Cadastro de Clientes:</strong> Acesse o menu <strong className="text-foreground">Empresas &gt; Cadastro</strong>. Clique em Novo e preencha Razão Social, CNPJ (com busca automática ativada) e os dados de contato do cliente. Ao salvar, a empresa já ficará disponível para firmar contratos.</li>
                      <li><strong className="text-foreground">Cadastro da Frota:</strong> Acesse o menu <strong className="text-foreground">Equipamentos &gt; Cadastro</strong>. Cadastre sua máquina própria (seja um Caminhão, Prancha ou Escavadeira) informando o Tipo, Modelo, Ano e a Placa/Tag de identificação que será usada nos relatórios.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">2. Propostas e Contratos (Clientes)</h3>
                    <p className="text-muted-foreground mb-3 mt-1">Como firmar a negociação com o cliente no sistema.</p>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li><strong className="text-foreground">Fazer uma Proposta:</strong> Acesse <strong className="text-foreground">Empresas &gt; Propostas</strong> e clique em Nova Proposta. Selecione o Cliente, defina uma data de validade, adicione os equipamentos desejados e defina a forma de cobrança (Por Horas, Diárias, Viagens ou Fixo/Mês). Você pode exportar a proposta em PDF para enviar ao cliente.</li>
                      <li><strong className="text-foreground">Efetivar Contrato a partir de Proposta:</strong> Quando o cliente aprovar o orçamento, mude o status da proposta para "Aprovada". O sistema automaticamente perguntará se você deseja "Gerar Contrato" com aquelas mesmas condições.</li>
                      <li><strong className="text-foreground">Criar Contrato Direto:</strong> Caso prefira criar sem proposta prévia, acesse <strong className="text-foreground">Empresas &gt; Contratos</strong> e clique em Novo. Um campo vital é o <strong>"Ciclo de Medição" (Ex: Dia 1 ao 30)</strong>. Isso define as datas de corte exatas que o sistema usará na hora do faturamento.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">3. Lançamento da Operação Diária</h3>
                    <p className="text-muted-foreground mb-3 mt-1">A rotina de apontamento de tudo que trabalhou, viajou ou quebrou.</p>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li><strong className="text-foreground">Lançar Horímetro Diário:</strong> Acesse <strong className="text-foreground">Medições &gt; Horímetro</strong>. Selecione o Equipamento, a Data, e lance o <strong>Horímetro Final</strong> que estava no painel no fim do turno. O sistema busca o valor do dia anterior e calcula quantas horas foram trabalhadas automaticamente.</li>
                      <li><strong className="text-foreground">Lançar Viagens:</strong> Na mesma tela de Novo Lançamento, troque a opção superior de "Trabalho" para "Viagem". Aparecerão novos campos. Informe o Local de Origem/Destino, a Quantidade de viagens no dia, o Valor negociado por trecho e, se aplicável, o Nº da O.S.</li>
                      <li><strong className="text-foreground">Lançar Manutenção/Indisponibilidade:</strong> Se a máquina quebrar, selecione a opção "Indisponível". Informe a hora exata da quebra e a hora do conserto. O sistema usará esses lançamentos para dar descontos justos na fatura do cliente no fim do mês!</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">4. Faturamento e Faturas</h3>
                    <p className="text-muted-foreground mb-3 mt-1">O fluxo para transformar as medições aprovadas em boletos.</p>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li><strong className="text-foreground">Gerar Medição (Fim do mês):</strong> Acesse <strong className="text-foreground">Medições &gt; Emitir Medição</strong>. Defina o período correto e clique em Calcular. O sistema irá varrer todos os horímetros lançados, cruzar com o valor das franquias estipuladas no contrato e gerar a tabela completa com Horas Normais, Excedentes e Subtotais.</li>
                      <li><strong className="text-foreground">Exportar Relatório:</strong> Salve a medição. Depois, na aba Histórico, clique no botão roxo de "PDF" para gerar um relatório bonito com a logomarca da empresa e enviar ao cliente para aprovação.</li>
                      <li><strong className="text-foreground">Emitir a Fatura:</strong> Com o PDF aprovado, acesse <strong className="text-foreground">Financeiro &gt; Emissão de faturas</strong>. Clique em Gerar Fatura, relacione-a àquela medição e insira a data de vencimento. Depois de gerada, você pode anexar a NF-e e o arquivo do Boleto direto na plataforma.</li>
                    </ul>
                  </div>
                </div>
              </section>
            </TabsContent>

            {/* 2. LOCAÇÃO DE TERCEIROS */}
            <TabsContent value="terceiros" className="mt-0 outline-none">
              <section className="space-y-8">
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                  <Handshake className="h-8 w-8 text-primary" />
                  <h2 className="text-3xl font-semibold">Locação de Terceiros (Fornecedores)</h2>
                </div>
                
                <div className="space-y-8 pl-4 border-l-2 border-muted">
                  <p className="text-muted-foreground text-lg mb-4">
                    Para manter as contas separadas, a gestão de equipamentos pertencentes a parceiros ou subcontratados fica isolada no módulo de <strong>Locação Terceiros</strong>. As regras são espelhadas, mas a relação de pagamento é inversa.
                  </p>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">1. Cadastros de Agregados</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li><strong className="text-foreground">Cadastro do Fornecedor:</strong> Acesse <strong className="text-foreground">Locação Terceiros &gt; Fornecedores</strong>. Cadastre a empresa parceira.</li>
                      <li><strong className="text-foreground">Equipamentos Terceirizados:</strong> Acesse <strong className="text-foreground">Locação Terceiros &gt; Equipamentos</strong>. Ao cadastrar uma máquina aqui, você obrigatoriamente vincula ela ao fornecedor responsável.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">2. Contratos com Terceiros</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li>Acesse <strong className="text-foreground">Locação Terceiros &gt; Contratos</strong>.</li>
                      <li>Diferente do contrato de locação da frota (onde você cobra), aqui você cadastra as condições financeiras que <strong>VOCÊ combinou de pagar</strong> ao fornecedor pelo uso do equipamento dele. Defina o valor hora de custo e a franquia acordada.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">3. Apontamento e Faturamento Inverso</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li><strong className="text-foreground">Lançamento de Trabalho/Viagem:</strong> Feito na tela <strong className="text-foreground">Locação Terceiros &gt; Lançamento (Horímetro)</strong>. O procedimento é exatamente igual ao da frota própria, porém os apontamentos feitos aqui geram custo ao invés de receita.</li>
                      <li><strong className="text-foreground">Gerar Medição para Pagamento:</strong> No final do ciclo, acesse <strong className="text-foreground">Locação Terceiros &gt; Medição</strong>. Calcule e gere o relatório final das horas trabalhadas pelo parceiro. O PDF gerado daqui pode ser entregue ao seu fornecedor como comprovante oficial do valor que ele tem a receber de você!</li>
                    </ul>
                  </div>
                </div>
              </section>
            </TabsContent>

            {/* 3. AGENDA */}
            <TabsContent value="agenda" className="mt-0 outline-none">
              <section className="space-y-8">
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                  <Calendar className="h-8 w-8 text-primary" />
                  <h2 className="text-3xl font-semibold">Agenda & Kanban</h2>
                </div>
                
                <div className="space-y-8 pl-4 border-l-2 border-muted">
                  <p className="text-muted-foreground text-lg mb-4">
                    O painel visual de toda a sua frota e ativos rodando.
                  </p>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">Visualização de Pátio</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li>Acesse o menu <strong className="text-foreground">Agenda & Kanban</strong>. Você verá a tela dividida em colunas que representam o status atual (No Pátio, Locado, Manutenção, e Terceiros).</li>
                      <li>Os filtros no topo permitem pesquisar rapidamente por placa ou tipo de equipamento para achá-lo nas colunas.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">Movimentação Dinâmica (Drag and Drop)</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li>Para atualizar o status de uma máquina (Ex: Caminhão voltou de locação pro pátio), basta <strong>clicar no card, segurar e arrastar</strong> para a coluna desejada. O status é atualizado imediatamente em todo o banco de dados do sistema!</li>
                    </ul>
                  </div>
                </div>
              </section>
            </TabsContent>

            {/* 4. SEGUROS */}
            <TabsContent value="seguros" className="mt-0 outline-none">
              <section className="space-y-8">
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                  <Shield className="h-8 w-8 text-primary" />
                  <h2 className="text-3xl font-semibold">Seguros de Frota</h2>
                </div>
                
                <div className="space-y-8 pl-4 border-l-2 border-muted">
                  <p className="text-muted-foreground text-lg mb-4">
                    Gerencie os contratos de seguro, controle vencimentos e sinistros ativos de todas as máquinas.
                  </p>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">Cadastro da Apólice e Vinculação</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li>Acesse <strong className="text-foreground">Seguros &gt; Cadastro</strong> para registrar os corretores e companhias seguradoras.</li>
                      <li>Em <strong className="text-foreground">Seguros &gt; Apólices</strong>, cadastre a nova apólice recebida. Informe o período de vigência para o sistema poder alertar sobre renovações.</li>
                      <li>Dentro do cadastro da apólice, você pode vincular todas as máquinas e caminhões que estão cobertos por ela.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">Gestão de Sinistros (Acidentes)</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li>Se ocorrer algum acidente com um equipamento segurado, registre em <strong className="text-foreground">Seguros &gt; Sinistros</strong>.</li>
                      <li>Anexe cópias dos Boletins de Ocorrência (B.O.), orçamentos e relatórios periciais na plataforma para ter todo o dossiê centralizado.</li>
                      <li>Registre os custos pagos com franquia para que eles também pesem no financeiro.</li>
                    </ul>
                  </div>
                </div>
              </section>
            </TabsContent>

            {/* 5. FINANCEIRO E CUSTOS */}
            <TabsContent value="financeiro" className="mt-0 outline-none">
              <section className="space-y-8">
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                  <DollarSign className="h-8 w-8 text-primary" />
                  <h2 className="text-3xl font-semibold">Financeiro e Custos</h2>
                </div>
                
                <div className="space-y-8 pl-4 border-l-2 border-muted">
                  <p className="text-muted-foreground text-lg mb-4">
                    A parte financeira do sistema trata os recebimentos das faturas de clientes e os lançamentos de gastos operacionais gerais ou veiculares.
                  </p>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">Custos Individuais (Manutenção e Peças)</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li>Para lançar a compra de um pneu, conserto ou revisão, acesse o cadastro daquele equipamento (<strong className="text-foreground">Equipamentos &gt; Cadastro</strong>), e acesse a aba lateral <strong className="text-foreground">Custos do Equipamento</strong>.</li>
                      <li>Os custos vinculados diretamente às placas são extremamente importantes para que o relatório de Controladoria consiga apurar se a locação daquele bem está dando lucro ou prejuízo no fim do mês!</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">Custos Gerais da Empresa</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li>Acesse o menu <strong className="text-foreground">Financeiro & Custos &gt; Custos</strong>.</li>
                      <li>Lance despesas da operação geral que não pertencem a um equipamento específico, como: aluguel do pátio, água, luz, salários da administração e impostos. Eles comporão a linha base de dedução do B.I.</li>
                    </ul>
                  </div>
                </div>
              </section>
            </TabsContent>

            {/* 6. CONTROLADORIA */}
            <TabsContent value="controladoria" className="mt-0 outline-none">
              <section className="space-y-8">
                <div className="flex items-center gap-2 mb-6 border-b pb-4">
                  <BarChart3 className="h-8 w-8 text-primary" />
                  <h2 className="text-3xl font-semibold">Controladoria (B.I.)</h2>
                </div>
                
                <div className="space-y-8 pl-4 border-l-2 border-muted">
                  <p className="text-muted-foreground text-lg mb-4">
                    O cérebro estratégico da diretoria. Não é necessário preencher nada manualmente aqui; o sistema monta os relatórios cruzando os dados de todos os outros módulos de forma inteligente e em tempo real.
                  </p>

                  <div>
                    <h3 className="text-xl font-bold text-foreground/90">Visão Geral & B.I.</h3>
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      <li>Acesse <strong className="text-foreground">Controladoria &gt; Visão Geral & B.I.</strong>.</li>
                      <li>O painel exibe cartões com o <strong>Faturamento Bruto</strong> do mês, os <strong>Custos Operacionais Totais</strong> e a <strong>Margem Bruta (Lucro Livre)</strong> em valores percentuais e absolutos.</li>
                      <li>Os gráficos comparativos permitem bater o olho e ver rapidamente se a locação está saudável ou sangrando financeiramente no período avaliado.</li>
                    </ul>
                  </div>
                </div>
              </section>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ManualPage;
