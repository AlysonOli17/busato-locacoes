import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Bot, Cog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const defaultAlertConfig = {
  enableApolices: true,
  enableContratos: true,
  enableManutencao: true,
  daysAntecedencia: 15,
};

export default function Configuracoes() {
  const { toast } = useToast();
  const [config, setConfig] = useState(defaultAlertConfig);
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "robo";
  });

  useEffect(() => {
    const saved = localStorage.getItem("smart-alerts-config");
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse config", e);
      }
    }
  }, []);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", val);
    window.history.pushState({}, "", url.pathname + url.search);
  };

  const handleSave = () => {
    localStorage.setItem("smart-alerts-config", JSON.stringify(config));
    toast({
      title: "Configurações salvas!",
      description: "As preferências do Robô de Alertas foram atualizadas com sucesso.",
    });
  };

  return (
    <Layout title="Configurações" subtitle="Gerenciamento do sistema e automações">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cog className="text-primary" /> Configurações Gerais
        </h1>
        <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
          <Save className="h-4 w-4 mr-2" /> Salvar Alterações
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-2 mb-8 bg-transparent">
            <TabsTrigger value="robo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bot className="h-4 w-4 mr-2" /> Alerta Robô
            </TabsTrigger>
          </TabsList>

          <TabsContent value="robo" className="animate-fade-in space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Regras Gerais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Regras de Antecedência</CardTitle>
                  <CardDescription>Defina com quantos dias de aviso o robô deve começar a alertar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dias">Dias de Antecedência (Contratos e Seguros)</Label>
                    <div className="flex items-center gap-2 max-w-[200px]">
                      <Input 
                        id="dias" 
                        type="number" 
                        min="1" 
                        max="90" 
                        value={config.daysAntecedencia} 
                        onChange={(e) => setConfig({ ...config, daysAntecedencia: parseInt(e.target.value) || 15 })} 
                      />
                      <span className="text-sm text-muted-foreground">dias</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Botões Liga/Desliga */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ativar/Desativar Alertas</CardTitle>
                  <CardDescription>Escolha quais notificações você deseja receber ao entrar no sistema.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Vencimento de Apólices</Label>
                      <p className="text-xs text-muted-foreground">Notifica seguros próximos de expirar.</p>
                    </div>
                    <Switch 
                      checked={config.enableApolices} 
                      onCheckedChange={(c) => setConfig({ ...config, enableApolices: c })} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Vencimento de Contratos</Label>
                      <p className="text-xs text-muted-foreground">Notifica contratos de locação expirando.</p>
                    </div>
                    <Switch 
                      checked={config.enableContratos} 
                      onCheckedChange={(c) => setConfig({ ...config, enableContratos: c })} 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Máquinas em Manutenção</Label>
                      <p className="text-xs text-muted-foreground">Lembra de equipamentos que continuam na oficina.</p>
                    </div>
                    <Switch 
                      checked={config.enableManutencao} 
                      onCheckedChange={(c) => setConfig({ ...config, enableManutencao: c })} 
                    />
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
