import { Layout } from "@/components/Layout";
import { FornecedoresTab } from "@/components/terceiros/FornecedoresTab";
import { EquipamentosTerceirosTab } from "@/components/terceiros/EquipamentosTerceirosTab";
import { ContratosTerceirosTab } from "@/components/terceiros/ContratosTerceirosTab";
import { MedicoesTerceirosTab } from "@/components/terceiros/MedicoesTerceirosTab";
import { CustosTerceirosTab } from "@/components/terceiros/CustosTerceirosTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Wrench, FileText, Clock, DollarSign } from "lucide-react";

const LocacaoTerceiros = () => (
  <Layout title="Locação Terceiros" subtitle="Gestão de equipamentos locados de fornecedores">
    <Tabs defaultValue="fornecedores" className="w-full">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="fornecedores" className="gap-1"><Building2 className="h-4 w-4" /> Fornecedores</TabsTrigger>
        <TabsTrigger value="equipamentos" className="gap-1"><Wrench className="h-4 w-4" /> Equipamentos</TabsTrigger>
        <TabsTrigger value="contratos" className="gap-1"><FileText className="h-4 w-4" /> Contratos</TabsTrigger>
        <TabsTrigger value="medicoes" className="gap-1"><Clock className="h-4 w-4" /> Horímetro</TabsTrigger>
        <TabsTrigger value="custos" className="gap-1"><DollarSign className="h-4 w-4" /> Custos</TabsTrigger>
      </TabsList>
      <TabsContent value="fornecedores"><FornecedoresTab /></TabsContent>
      <TabsContent value="equipamentos"><EquipamentosTerceirosTab /></TabsContent>
      <TabsContent value="contratos"><ContratosTerceirosTab /></TabsContent>
      <TabsContent value="medicoes"><MedicoesTerceirosTab /></TabsContent>
      <TabsContent value="custos"><CustosTerceirosTab /></TabsContent>
    </Tabs>
  </Layout>
);

export default LocacaoTerceiros;
