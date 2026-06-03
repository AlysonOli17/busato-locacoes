import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { FornecedoresTab } from "@/components/terceiros/FornecedoresTab";
import { EquipamentosTerceirosTab } from "@/components/terceiros/EquipamentosTerceirosTab";
import { ContratosTerceirosTab } from "@/components/terceiros/ContratosTerceirosTab";
import { MedicoesTerceirosTab } from "@/components/terceiros/MedicoesTerceirosTab";
import { MedicaoTerceirosTab } from "@/components/terceiros/MedicaoTerceirosTab";
import { CustosTerceirosTab } from "@/components/terceiros/CustosTerceirosTab";
import { Tabs, TabsContent } from "@/components/ui/tabs";

const LocacaoTerceiros = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "fornecedores";
  });

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab") || "fornecedores";
    setActiveTab(tab);
  }, [location.search]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", val);
    window.history.pushState({}, "", url.pathname + url.search);
  };

  return (
    <Layout title="Locação Terceiros" subtitle="Gestão de equipamentos locados de fornecedores">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsContent value="fornecedores"><FornecedoresTab /></TabsContent>
        <TabsContent value="equipamentos"><EquipamentosTerceirosTab /></TabsContent>
        <TabsContent value="contratos"><ContratosTerceirosTab /></TabsContent>
        <TabsContent value="horimetro"><MedicoesTerceirosTab /></TabsContent>
        <TabsContent value="medicao"><MedicaoTerceirosTab /></TabsContent>
        <TabsContent value="custos"><CustosTerceirosTab /></TabsContent>
      </Tabs>
    </Layout>
  );
};

export default LocacaoTerceiros;
