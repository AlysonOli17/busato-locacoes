import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMedicoes } from "@/lib/supabaseUtils";
import { VisaoGeralTab } from "@/components/VisaoGeralTab";
import { RelatoriosGerenciaisTab } from "@/components/RelatoriosGerenciaisTab";
import { InadimplenciaTab } from "@/components/InadimplenciaTab";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
}

interface Contrato {
  id: string;
  empresa_id: string;
  equipamento_id: string;
  valor_hora: number;
  horas_contratadas: number;
  data_inicio: string;
  data_fim: string;
  dia_medicao_inicio: number;
  dia_medicao_fim: number;
  prazo_faturamento: number;
  status: string;
  empresas: { nome: string; cnpj: string };
  equipamentos: { tipo: string; modelo: string; tag_placa: string | null };
  contratos_equipamentos?: { equipamento_id: string }[];
}

interface Fatura {
  id: string;
  contrato_id: string;
  periodo: string;
  emissao: string;
  numero_nota: string | null;
  status: string;
  valor_total: number;
  horas_normais: number;
  horas_excedentes: number;
  periodo_medicao_inicio: string | null;
  periodo_medicao_fim: string | null;
  total_gastos: number;
  contratos: {
    id: string;
    empresas: { nome: string; cnpj: string };
    equipamentos: { tipo: string; modelo: string; tag_placa: string | null };
    horas_contratadas: number;
    valor_hora: number;
    dia_medicao_inicio?: number;
    dia_medicao_fim?: number;
    prazo_faturamento?: number;
  };
}

const Controladoria = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "visao-geral";
  });

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab") || "visao-geral";
    setActiveTab(tab);
  }, [location.search]);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [apolices, setApolices] = useState<any[]>([]);
  const [apolicesEquipamentos, setApolicesEquipamentos] = useState<any[]>([]);
  const [contratosAditivos, setContratosAditivos] = useState<any[]>([]);
  const [aditivosEquipamentos, setAditivosEquipamentos] = useState<any[]>([]);
  const [sinistros, setSinistros] = useState<any[]>([]);
  const [faturamentoGastos, setFaturamentoGastos] = useState<any[]>([]);
  const [contratosEquipamentos, setContratosEquipamentos] = useState<any[]>([]);
  const [despesasAdministrativas, setDespesasAdministrativas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros Globais
  const [globalDataInicio, setGlobalDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [globalDataFim, setGlobalDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [globalEmpresaId, setGlobalEmpresaId] = useState<string>("all");
  const [globalEquipamentoId, setGlobalEquipamentoId] = useState<string>("all");

  useEffect(() => {
    const fetchAll = async () => {
      const [
        empRes, 
        ctRes, 
        ceRes, 
        fatRes, 
        eqRes, 
        gastRes, 
        medRes,
        apolRes,
        apolEqRes,
        aditivosRes,
        aditivosEqRes,
        sinistrosRes,
        fatGastosRes,
        despAdminRes
      ] = await Promise.all([
        supabase.from("empresas").select("*").order("nome"),
        supabase.from("contratos").select("*").order("created_at", { ascending: false }),
        supabase.from("contratos_equipamentos").select("*"),
        supabase.from("faturamento").select("*").order("emissao", { ascending: false }),
        supabase.from("equipamentos").select("*").order("tipo"),
        supabase.from("gastos").select("*").order("data", { ascending: false }),
        fetchAllMedicoes(),
        supabase.from("apolices").select("*"),
        supabase.from("apolices_equipamentos").select("*"),
        supabase.from("contratos_aditivos").select("*"),
        supabase.from("aditivos_equipamentos").select("*"),
        supabase.from("sinistros").select("*"),
        supabase.from("faturamento_gastos").select("*"),
        supabase.from("despesas_administrativas").select("*")
      ]);
      
      if (empRes.data) setEmpresas(empRes.data as Empresa[]);
      if (eqRes.data) setEquipamentos(eqRes.data);
      if (gastRes.data) setGastos(gastRes.data);
      if (medRes.data) setMedicoes(medRes.data);
      if (apolRes.data) setApolices(apolRes.data);
      if (apolEqRes.data) setApolicesEquipamentos(apolEqRes.data);
      if (aditivosRes.data) setContratosAditivos(aditivosRes.data);
      if (aditivosEqRes.data) setAditivosEquipamentos(aditivosEqRes.data);
      if (sinistrosRes.data) setSinistros(sinistrosRes.data);
      if (fatGastosRes.data) setFaturamentoGastos(fatGastosRes.data);
      if (ceRes.data) setContratosEquipamentos(ceRes.data);
      if (despAdminRes.data) setDespesasAdministrativas(despAdminRes.data);

      if (empRes.data && eqRes.data && ctRes.data) {
        const empMap = new Map(empRes.data.map((e: any) => [e.id, e]));
        const eqMap = new Map(eqRes.data.map((e: any) => [e.id, e]));
        
        const ceMap = new Map<string, any[]>();
        if (ceRes.data) {
          ceRes.data.forEach((ce: any) => {
            const list = ceMap.get(ce.contrato_id) || [];
            list.push(ce);
            ceMap.set(ce.contrato_id, list);
          });
        }

        const mappedContratos = ctRes.data.map((c: any) => ({
          ...c,
          empresas: empMap.get(c.empresa_id) || null,
          equipamentos: eqMap.get(c.equipamento_id) || null,
          contratos_equipamentos: ceMap.get(c.id) || []
        }));
        setContratos(mappedContratos as unknown as Contrato[]);

        if (fatRes.data) {
          const ctMap = new Map(mappedContratos.map(c => [c.id, c]));
          const mappedFaturas = fatRes.data.map((f: any) => ({
            ...f,
            contratos: ctMap.get(f.contrato_id) || null
          }));
          setFaturas(mappedFaturas as unknown as Fatura[]);
        }
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  return (
    <Layout title="Controladoria & B.I." subtitle={activeTab === "relatorios" ? "Relatórios Gerenciais e DRE" : activeTab === "dre" ? "Painel Gerencial de Inadimplência e Aging" : "Cockpit executivo e indicadores de performance"}>
      <div className="space-y-6">
        
        {/* ── Global Filters Bar ────────────────────────────────────────────── */}
        <div className="bg-card/60 backdrop-blur-sm p-4 rounded-2xl border border-border/60 shadow-sm flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">Cliente</label>
            <SearchableSelect
              value={globalEmpresaId}
              onValueChange={setGlobalEmpresaId}
              placeholder="Todos os Clientes"
              searchPlaceholder="Buscar cliente..."
              options={[
                { value: "all", label: "Todos os Clientes" },
                ...empresas.map((e: any) => ({ value: e.id, label: e.nome }))
              ]}
            />
          </div>
          <div className="flex-1 w-full">
            <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">Equipamento</label>
            <SearchableSelect
              value={globalEquipamentoId}
              onValueChange={setGlobalEquipamentoId}
              placeholder="Todos os Equipamentos"
              searchPlaceholder="Buscar equipamento..."
              options={[
                { value: "all", label: "Todos os Equipamentos" },
                ...equipamentos.map((e: any) => ({ value: e.id, label: `${e.tipo} ${e.modelo} ${e.tag_placa ? `(${e.tag_placa})` : ''}`.trim() }))
              ]}
            />
          </div>
          <div className="w-full md:w-48">
            <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">Data Início</label>
            <Input 
              type="date" 
              value={globalDataInicio} 
              onChange={(e) => setGlobalDataInicio(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="w-full md:w-48">
            <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">Data Fim</label>
            <Input 
              type="date" 
              value={globalDataFim} 
              onChange={(e) => setGlobalDataFim(e.target.value)}
              className="bg-background"
            />
          </div>
          {(globalEmpresaId !== "all" || globalEquipamentoId !== "all") && (
            <Button 
              variant="outline" 
              onClick={() => { setGlobalEmpresaId("all"); setGlobalEquipamentoId("all"); }}
              className="gap-2"
            >
              <X className="h-4 w-4" /> Limpar
            </Button>
          )}
        </div>

        {!loading && (
          activeTab === "relatorios" ? (
            <RelatoriosGerenciaisTab
              empresas={empresas}
              contratos={contratos}
              faturas={faturas}
              equipamentos={equipamentos}
              gastos={gastos}
              medicoes={medicoes}
              contratosEquipamentos={contratosEquipamentos}
              faturamentoGastos={faturamentoGastos}
              despesasAdministrativas={despesasAdministrativas}
              globalEmpresaId={globalEmpresaId}
              globalEquipamentoId={globalEquipamentoId}
              globalDataInicio={globalDataInicio}
              globalDataFim={globalDataFim}
            />
          ) : activeTab === "dre" ? (
            <InadimplenciaTab 
              globalEmpresaId={globalEmpresaId}
              globalEquipamentoId={globalEquipamentoId}
              globalDataInicio={globalDataInicio}
              globalDataFim={globalDataFim}
            />
          ) : (
            <VisaoGeralTab
              empresas={empresas}
              contratos={contratos}
              faturas={faturas}
              equipamentos={equipamentos}
              gastos={gastos}
              medicoes={medicoes}
              apolices={apolices}
              apolicesEquipamentos={apolicesEquipamentos}
              contratosAditivos={contratosAditivos}
              aditivosEquipamentos={aditivosEquipamentos}
              sinistros={sinistros}
              faturamentoGastos={faturamentoGastos}
              contratosEquipamentos={contratosEquipamentos}
              globalEmpresaId={globalEmpresaId}
              globalEquipamentoId={globalEquipamentoId}
              globalDataInicio={globalDataInicio}
              globalDataFim={globalDataFim}
            />
          )
        )}
      </div>
    </Layout>
  );
};

export default Controladoria;
