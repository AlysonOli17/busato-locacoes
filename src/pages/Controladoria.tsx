import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { VisaoGeralTab } from "@/components/VisaoGeralTab";

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
  const [loading, setLoading] = useState(true);

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
        fatGastosRes
      ] = await Promise.all([
        supabase.from("empresas").select("*").order("nome"),
        supabase.from("contratos").select("*").order("created_at", { ascending: false }),
        supabase.from("contratos_equipamentos").select("*"),
        supabase.from("faturamento").select("*").order("emissao", { ascending: false }),
        supabase.from("equipamentos").select("*").order("tipo"),
        supabase.from("gastos").select("*").order("data", { ascending: false }),
        supabase.from("medicoes").select("*").order("data", { ascending: false }),
        supabase.from("apolices").select("*"),
        supabase.from("apolices_equipamentos").select("*"),
        supabase.from("contratos_aditivos").select("*"),
        supabase.from("aditivos_equipamentos").select("*"),
        supabase.from("sinistros").select("*"),
        supabase.from("faturamento_gastos").select("*")
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
    <Layout title="Controladoria & B.I." subtitle="Cockpit executivo e indicadores de performance">
      <div className="space-y-6">
        {!loading && (
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
          />
        )}
      </div>
    </Layout>
  );
};

export default Controladoria;
