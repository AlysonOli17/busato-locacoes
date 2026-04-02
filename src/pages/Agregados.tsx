import { Layout } from "@/components/Layout";
import { AgregadoTab } from "@/components/AgregadoTab";
import { CustosAgregadoTab } from "@/components/CustosAgregadoTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, DollarSign } from "lucide-react";

const Agregados = () => (
  <Layout title="Agregados" subtitle="Gestão de diárias e custos de equipamentos agregados">
    <Tabs defaultValue="diarias" className="w-full">
      <TabsList>
        <TabsTrigger value="diarias" className="gap-1"><CalendarDays className="h-4 w-4" /> Diárias</TabsTrigger>
        <TabsTrigger value="custos" className="gap-1"><DollarSign className="h-4 w-4" /> Custos</TabsTrigger>
      </TabsList>
      <TabsContent value="diarias">
        <AgregadoTab />
      </TabsContent>
      <TabsContent value="custos">
        <CustosAgregadoTab />
      </TabsContent>
    </Tabs>
  </Layout>
);

export default Agregados;
