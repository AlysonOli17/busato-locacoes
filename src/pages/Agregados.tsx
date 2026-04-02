import { Layout } from "@/components/Layout";
import { AgregadoTab } from "@/components/AgregadoTab";
import { CustosAgregadoTab } from "@/components/CustosAgregadoTab";
import { MedicaoAgregadoTab } from "@/components/MedicaoAgregadoTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, DollarSign, Receipt } from "lucide-react";

const Agregados = () => (
  <Layout title="Agregados" subtitle="Gestão de diárias, custos e medição de equipamentos agregados">
    <Tabs defaultValue="diarias" className="w-full">
      <TabsList>
        <TabsTrigger value="diarias" className="gap-1"><CalendarDays className="h-4 w-4" /> Diárias</TabsTrigger>
        <TabsTrigger value="custos" className="gap-1"><DollarSign className="h-4 w-4" /> Custos</TabsTrigger>
        <TabsTrigger value="medicao" className="gap-1"><Receipt className="h-4 w-4" /> Medição</TabsTrigger>
      </TabsList>
      <TabsContent value="diarias">
        <AgregadoTab />
      </TabsContent>
      <TabsContent value="custos">
        <CustosAgregadoTab />
      </TabsContent>
      <TabsContent value="medicao">
        <MedicaoAgregadoTab />
      </TabsContent>
    </Tabs>
  </Layout>
);

export default Agregados;
