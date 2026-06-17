import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Bot, Cog, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

export const defaultAlertConfig = {
  enableApolices: true,
  enableContratos: true,
  enableManutencao: true,
  enableMedicaoAtrasada: true,
  enableFaturamentoPendente: true,
  enableChecklistPendente: true,
  daysAntecedencia: 15,
};

export default function Configuracoes() {
  const { toast } = useToast();
  const [config, setConfig] = useState(defaultAlertConfig);
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "robo";
  });

  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from("profiles").select("id, nome").order("nome");
      if (data) {
        setUsers(data);
        if (data.length > 0 && !selectedUserId) {
          setSelectedUserId(user?.id || data[0].id);
        }
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    
    const fetchConfig = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("alertas_configuracoes")
        .select("*")
        .eq("user_id", selectedUserId)
        .maybeSingle();
        
      if (data) {
        setConfig({
          enableApolices: data.enable_apolices,
          enableContratos: data.enable_contratos,
          enableManutencao: data.enable_manutencao,
          enableMedicaoAtrasada: data.enable_medicao_atrasada,
          enableFaturamentoPendente: data.enable_faturamento_pendente,
          enableChecklistPendente: data.enable_checklist_pendente,
          daysAntecedencia: data.days_antecedencia || 15
        });
      } else {
        setConfig(defaultAlertConfig);
      }
      setLoading(false);
    };
    
    fetchConfig();
  }, [selectedUserId]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", val);
    window.history.pushState({}, "", url.pathname + url.search);
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    
    const payload = {
      user_id: selectedUserId,
      enable_apolices: config.enableApolices,
      enable_contratos: config.enableContratos,
      enable_manutencao: config.enableManutencao,
      enable_medicao_atrasada: config.enableMedicaoAtrasada,
      enable_faturamento_pendente: config.enableFaturamentoPendente,
      enable_checklist_pendente: config.enableChecklistPendente,
      days_antecedencia: config.daysAntecedencia
    };

    const { error } = await supabase
      .from("alertas_configuracoes")
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: "A tabela alertas_configuracoes pode não ter sido criada no Supabase ainda. " + error.message,
        variant: "destructive"
      });
      // Fallback to localstorage temporarily if db fails
      localStorage.setItem("smart-alerts-config", JSON.stringify(config));
    } else {
      toast({
        title: "Configurações salvas!",
        description: "As preferências do Robô de Alertas foram atualizadas no banco de dados.",
      });
    }
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
            <div className="mb-6 p-4 border rounded-lg bg-muted/30 max-w-md">
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" /> Selecione o Usuário
              </Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Carregando usuários..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {user?.id === u.id ? "(Você)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                As alterações feitas abaixo serão aplicadas apenas à conta do usuário selecionado acima.
              </p>
            </div>
            
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              
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

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Medição Atrasada</Label>
                      <p className="text-xs text-muted-foreground">Avisa quando o ciclo de medição de um contrato passou da data de corte e não foi feito.</p>
                    </div>
                    <Switch 
                      checked={config.enableMedicaoAtrasada} 
                      onCheckedChange={(c) => setConfig({ ...config, enableMedicaoAtrasada: c })} 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Faturamento Pendente</Label>
                      <p className="text-xs text-muted-foreground">Notifica faturas com status Pendente aguardando emissão.</p>
                    </div>
                    <Switch 
                      checked={config.enableFaturamentoPendente} 
                      onCheckedChange={(c) => setConfig({ ...config, enableFaturamentoPendente: c })} 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Checklist Pendente</Label>
                      <p className="text-xs text-muted-foreground">Lembra de gerar checklists de equipamentos com data de entrega/devolução próximas.</p>
                    </div>
                    <Switch 
                      checked={config.enableChecklistPendente} 
                      onCheckedChange={(c) => setConfig({ ...config, enableChecklistPendente: c })} 
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
