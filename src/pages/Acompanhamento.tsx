import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Clock, Receipt, Building2, FileDown, FileSpreadsheet, TrendingUp, TrendingDown, CalendarClock, LayoutDashboard, Link2, LayoutGrid, BarChart3 } from "lucide-react";
import { SortableTableHead } from "@/components/SortableTableHead";
import { supabase } from "@/integrations/supabase/client";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { VisaoGeralTab } from "@/components/VisaoGeralTab";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

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

const parseLocalDate = (dateStr: any): Date => {
  const mkFallback = () => {
    const d = new Date(NaN);
    (d as any).toLocaleDateString = () => "—";
    return d;
  };
  if (!dateStr) return mkFallback();
  const str = String(dateStr).trim();
  if (!str || str === "null" || str === "undefined") return mkFallback();
  const d = str.includes("T") ? new Date(str) : new Date(str + "T00:00:00");
  if (isNaN(d.getTime())) return mkFallback();
  return d;
};
const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthKey = (dateStr: string) => dateStr.slice(0, 7);
const competenciaFromPeriod = (period: { inicio: string; fim: string }) => monthKey(period.inicio);
const formatCompetencia = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return `${meses[(month || 1) - 1]}/${year}`;
};
const parsePeriodoKey = (periodo?: string | null) => {
  if (!periodo) return null;
  const normalized = periodo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const monthIndex = meses.findIndex(m => normalized.includes(m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
  const year = periodo.match(/\b(20\d{2}|19\d{2})\b/)?.[1];
  if (monthIndex < 0 || !year) return null;
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
};

const Acompanhamento = () => {
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
    <Layout title="Acompanhamento Geral" subtitle="Visão completa de faturamento, vencimentos e alertas">
      <div className="space-y-6">

        <Tabs defaultValue="acompanhamento" className="w-full">
          <TabsList>
            <TabsTrigger value="acompanhamento" className="flex items-center gap-1">
              <LayoutDashboard className="h-4 w-4" /> Acompanhamento
            </TabsTrigger>
            <TabsTrigger value="modulos" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" /> Controladoria & BI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="acompanhamento" className="mt-6">
            <VisaoGeralTab
              mode="dashboard"
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
          </TabsContent>

          <TabsContent value="modulos" className="mt-6">
            <VisaoGeralTab
              mode="modules"
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
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Acompanhamento;
