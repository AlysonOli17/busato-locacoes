import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { getEquipLabel, calcularHorasInterpoladas } from "@/lib/utils";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Clock, PenTool, Trash2, TrendingUp, AlertTriangle, CheckCircle2, ChevronDown, Filter, CalendarCheck2, HardHat, Cog, ShieldCheck, CheckSquare, Search, FileSpreadsheet, Plus, FileBarChart, FileDown, Pencil, Receipt, DollarSign, Activity } from "lucide-react";
import { SortableTableHead } from "@/components/SortableTableHead";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { exportToPDF } from "@/lib/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { withCache, clearCache } from "@/lib/cache";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FaturamentoContent } from "./Faturamento";
import { FaturamentoTab } from "@/components/FaturamentoTab";
import { PendenteMedicaoView, HistoricoFaturamentoView, ResumoEmpresaView } from "@/components/FinanceiroViews";


import { useLocation } from "react-router-dom";


interface Equipamento {id: string;tipo: string;modelo: string;tag_placa: string | null;numero_serie: string | null;}
interface Medicao {
  id: string;
  equipamento_id: string;
  data: string;
  horimetro_inicial: number;
  horimetro_final: number;
  horas_trabalhadas: number;
  tipo: string;
  observacoes: string | null;
  equipamentos: Equipamento;
}

const parseLocalDate = (dateStr: string) => new Date(dateStr + "T00:00:00");

const getDaysDifference = (dateStr1: string, dateStr2: string) => {
  const d1 = new Date(dateStr1 + "T00:00:00");
  const d2 = new Date(dateStr2 + "T00:00:00");
  const diffTime = Math.abs(d1.getTime() - d2.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

const Medicoes = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get("tab") || "medicoes";
  });

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab") || "medicoes";
    setActiveTab(tab);
  }, [location.search]);

  useEffect(() => {
    if (activeTab === "lancamento-lote" && bulkGridItems.length === 0 && !loadingBulkGrid) {
      fetchActiveEquipmentsForDate(bulkDate);
    }
  }, [activeTab]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", val);
    window.history.pushState({}, "", url.pathname + url.search);
  };

  const [items, setItems] = useState<Medicao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [contratosEquipamentos, setContratosEquipamentos] = useState<any[]>([]);
  const [contratosAditivos, setContratosAditivos] = useState<any[]>([]);
  const [aditivosEquipamentos, setAditivosEquipamentos] = useState<any[]>([]);
  const [faturamentos, setFaturamentos] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ equipamento_id: "", data: new Date().toISOString().split("T")[0], horimetro: 0, tipo: "Trabalho", observacoes: "", horimetro_inicial_indisp: 0, horas_indisp: 0, horas_trab: 1, horimetro_inicial: 0 });
  const [sortCol, setSortCol] = useState<"equipamento" | "tag" | "data" | "tipo" | "horimetro" | "horas_indisp">("data");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterEquip, setFilterEquip] = useState("Todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [horimetroAnterior, setHorimetroAnterior] = useState<number>(0);
  const [dataAnterior, setDataAnterior] = useState<string | null>(null);
  const [baselines, setBaselines] = useState<Map<string, { horim: number; data: string }>>(new Map());
  const [equipMedicaoTypes, setEquipMedicaoTypes] = useState<Map<string, "horas" | "diarias">>(new Map());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [bulkGridItems, setBulkGridItems] = useState<any[]>([]);
  const [loadingBulkGrid, setLoadingBulkGrid] = useState(false);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const { toast } = useToast();

  const isMedicaoLocked = useCallback((equipamentoId: string, dataStr: string) => {
    const linkedContractIds = new Set<string>();

    contratos.forEach(c => {
      if (c.equipamento_id === equipamentoId) {
        linkedContractIds.add(c.id);
      }
    });

    contratosEquipamentos.forEach(ce => {
      if (ce.equipamento_id === equipamentoId) {
        linkedContractIds.add(ce.contrato_id);
      }
    });

    const aditivoToContract = new Map<string, string>();
    contratosAditivos.forEach(ca => {
      aditivoToContract.set(ca.id, ca.contrato_id);
    });

    aditivosEquipamentos.forEach(ae => {
      if (ae.equipamento_id === equipamentoId) {
        const contratoId = aditivoToContract.get(ae.aditivo_id);
        if (contratoId) {
          linkedContractIds.add(contratoId);
        }
      }
    });

    if (linkedContractIds.size === 0) return false;

    const entryDate = new Date(dataStr + "T00:00:00").getTime();
    
    return faturamentos.some(f => {
      if (f.status !== "Aprovado" && f.status !== "Pago") return false;
      if (!linkedContractIds.has(f.contrato_id)) return false;
      if (!f.periodo_medicao_inicio || !f.periodo_medicao_fim) return false;
      
      const start = new Date(f.periodo_medicao_inicio + "T00:00:00").getTime();
      const end = new Date(f.periodo_medicao_fim + "T00:00:00").getTime();
      
      return entryDate >= start && entryDate <= end;
    });
  }, [contratos, contratosEquipamentos, contratosAditivos, aditivosEquipamentos, faturamentos]);

  const fetchData = async (force = false) => {
    if (force) clearCache();
    const [medRes, equipRes, contractsRes, ceRes, aditivosRes, aeRes, fatRes] = await withCache("medicoes_main", 5 * 60 * 1000, async () => Promise.all([
      supabase.from("medicoes").select("*").order("data", { ascending: false }),
      supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
      supabase.from("contratos").select("id, status, tipo_medicao, equipamento_id"),
      supabase.from("contratos_equipamentos").select("contrato_id, equipamento_id"),
      supabase.from("contratos_aditivos").select("id, contrato_id"),
      supabase.from("aditivos_equipamentos").select("aditivo_id, equipamento_id"),
      supabase.from("faturamento").select("id, status, contrato_id, periodo_medicao_inicio, periodo_medicao_fim")
    ]));
    
    if (equipRes.data) setEquipamentos(equipRes.data);
    if (contractsRes.data) setContratos(contractsRes.data);
    if (ceRes.data) setContratosEquipamentos(ceRes.data);
    if (aditivosRes.data) setContratosAditivos(aditivosRes.data);
    if (aeRes.data) setAditivosEquipamentos(aeRes.data);
    if (fatRes.data) setFaturamentos(fatRes.data);

    if (contractsRes.data) {
      const map = new Map<string, "horas" | "diarias">();
      const contractMedicaoTypes = new Map<string, "horas" | "diarias">();
      const aditivoToContract = new Map<string, string>();
      
      contractsRes.data.forEach((c: any) => {
        const tipo = (c.tipo_medicao || "horas") as "horas" | "diarias";
        contractMedicaoTypes.set(c.id, tipo);
        if (c.equipamento_id) {
          map.set(c.equipamento_id, tipo);
        }
      });

      if (ceRes.data) {
        ceRes.data.forEach((ce: any) => {
          const tipo = contractMedicaoTypes.get(ce.contrato_id);
          if (tipo) {
            map.set(ce.equipamento_id, tipo);
          }
        });
      }

      if (aditivosRes.data) {
        aditivosRes.data.forEach((a: any) => {
          aditivoToContract.set(a.id, a.contrato_id);
        });
      }

      if (aeRes.data) {
        aeRes.data.forEach((ae: any) => {
          const contratoId = aditivoToContract.get(ae.aditivo_id);
          if (contratoId) {
            const tipo = contractMedicaoTypes.get(contratoId);
            if (tipo) {
              map.set(ae.equipamento_id, tipo);
            }
          }
        });
      }

      setEquipMedicaoTypes(map);
    }
    
    if (medRes.data && equipRes.data) {
      const equipMap = new Map(equipRes.data.map((e: any) => [e.id, e]));
      const mapped = medRes.data.map((m: any) => ({
        ...m,
        equipamentos: equipMap.get(m.equipamento_id) || null
      }));
      setItems(mapped as unknown as Medicao[]);
    } else if (medRes.data) {
      setItems(medRes.data as unknown as Medicao[]);
    }
    
    setLoading(false);
  };

  useEffect(() => {fetchData();}, []);

  const fetchHorimetroPorData = async (equipId: string, data: string, excludeId?: string, updateForm = true) => {
    let query = supabase.
      from("medicoes").
      select("horimetro_final, data").
      eq("equipamento_id", equipId).
      lt("data", data);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    query = query.order("data", { ascending: false }).limit(1);

    const { data: result } = await query;
    if (result && result.length > 0) {
      const prevVal = Number(result[0].horimetro_final);
      setHorimetroAnterior(prevVal);
      setDataAnterior(result[0].data);
      if (updateForm) {
        setForm(prev => ({ ...prev, horimetro_inicial: prevVal }));
      }
    } else {
      setHorimetroAnterior(0);
      setDataAnterior(null);
      if (updateForm) {
        setForm(prev => ({ ...prev, horimetro_inicial: 0 }));
      }
    }
  };

  const lastEntryDate = items
    .filter(i => filterEquip === "Todos" || i.equipamento_id === filterEquip)
    .reduce((max, i) => (i.data > max ? i.data : max), "");

  const validDataFim = (() => {
    if (!dataFim) return undefined;
    if (lastEntryDate && format(dataFim, "yyyy-MM-dd") > lastEntryDate) {
      return parseLocalDate(lastEntryDate);
    }
    return dataFim;
  })();

  const filtered = items.filter((i) => {
    if (filterEquip !== "Todos" && i.equipamento_id !== filterEquip) return false;
    const itemDate = parseLocalDate(i.data);
    if (dataInicio) {if (itemDate < dataInicio) return false;}
    if (validDataFim) {const fim = new Date(validDataFim);fim.setHours(23, 59, 59, 999);if (itemDate > fim) return false;}
    return true;
  });

  const fetchBaselines = useCallback(async () => {
    if (!dataInicio) {
      setBaselines(new Map());
      return;
    }
    const inicioStr = dataInicio.toISOString().split("T")[0];
    const uniqueEquipIds = [...new Set(filtered.map(m => m.equipamento_id))];
    if (uniqueEquipIds.length === 0) {
      setBaselines(new Map());
      return;
    }
    const promises = uniqueEquipIds.map(eqId =>
      supabase.from("medicoes").select("equipamento_id, horimetro_final, data")
        .eq("equipamento_id", eqId).eq("tipo", "Trabalho").lt("data", inicioStr)
        .order("data", { ascending: false }).limit(1)
    );
    const results = await Promise.all(promises);
    const map = new Map<string, { horim: number; data: string }>();
    results.forEach(r => {
      if (r.data && r.data.length > 0) {
        map.set(r.data[0].equipamento_id, { horim: Number(r.data[0].horimetro_final), data: r.data[0].data });
      }
    });
    setBaselines(map);
  }, [filtered.length, dataInicio, filterEquip]);

  useEffect(() => { fetchBaselines(); }, [fetchBaselines]);

  const fetchActiveEquipmentsForDate = async (targetDate: string) => {
    setLoadingBulkGrid(true);
    try {
      const [contractsRes, ceRes, aditivosRes, aeRes, equipRes, empresasRes] = await Promise.all([
        supabase.from("contratos").select("id, status, tipo_medicao, empresa_id").neq("status", "Cancelado"),
        supabase.from("contratos_equipamentos").select("contrato_id, equipamento_id, data_entrega, data_devolucao"),
        supabase.from("contratos_aditivos").select("id, contrato_id, data_inicio, data_fim"),
        supabase.from("aditivos_equipamentos").select("aditivo_id, equipamento_id, data_entrega, data_devolucao"),
        supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie"),
        supabase.from("empresas").select("id, nome, obra")
      ]);

      const contratosDataRaw = contractsRes.data || [];
      const ceList = ceRes.data || [];
      const aditivosList = aditivosRes.data || [];
      const aeList = aeRes.data || [];
      const equipsList = equipRes.data || [];
      const empresasList = empresasRes.data || [];

      const empresasMap = new Map(empresasList.map(e => [e.id, e]));
      const contratosData = contratosDataRaw.map(c => ({
        ...c,
        empresas: empresasMap.get(c.empresa_id) || null
      }));

      const equipsMap = new Map(equipsList.map(e => [e.id, e]));
      const activeEquipIds = new Set<string>();
      const equipContracts = new Map<string, { contratoId: string; tipoMedicao: "horas" | "diarias"; label: string }>();

      contratosData.forEach(c => {
        const baseCes = ceList.filter(ce => ce.contrato_id === c.id);
        baseCes.forEach(ce => {
          const delivered = !ce.data_entrega || ce.data_entrega <= targetDate;
          const returned = ce.data_devolucao && ce.data_devolucao <= targetDate;
          if (delivered && !returned) {
            activeEquipIds.add(ce.equipamento_id);
            const eq = equipsMap.get(ce.equipamento_id);
            const eqLabel = eq ? `${eq.tipo} ${eq.modelo} ${eq.tag_placa ? `(${eq.tag_placa})` : ""}` : "Equipamento";
            equipContracts.set(ce.equipamento_id, {
              contratoId: c.id,
              tipoMedicao: (c.tipo_medicao as "horas" | "diarias") || "horas",
              label: `${c.empresas?.nome || "Cliente"}${c.empresas?.obra ? ` (Obra: ${c.empresas.obra})` : ""} — ${eqLabel}`
            });
          }
        });
      });

      const activeAditivos = aditivosList.filter(a => a.data_inicio <= targetDate && a.data_fim >= targetDate);
      const activeAditivoIds = activeAditivos.map(a => a.id);
      const activeAes = aeList.filter(ae => activeAditivoIds.includes(ae.aditivo_id));
      activeAes.forEach(ae => {
        const ad = activeAditivos.find(a => a.id === ae.aditivo_id);
        const c = contratosData.find(con => con.id === ad?.contrato_id);
        if (c) {
          const delivered = !ae.data_entrega || ae.data_entrega <= targetDate;
          const returned = ae.data_devolucao && ae.data_devolucao <= targetDate;
          if (delivered && !returned) {
            activeEquipIds.add(ae.equipamento_id);
            const eq = equipsMap.get(ae.equipamento_id);
            const eqLabel = eq ? `${eq.tipo} ${eq.modelo} ${eq.tag_placa ? `(${eq.tag_placa})` : ""}` : "Equipamento";
            equipContracts.set(ae.equipamento_id, {
              contratoId: c.id,
              tipoMedicao: (c.tipo_medicao as "horas" | "diarias") || "horas",
              label: `${c.empresas?.nome || "Cliente"}${c.empresas?.obra ? ` (Obra: ${c.empresas.obra})` : ""} — ${eqLabel} (Aditivo)`
            });
          }
        }
      });

      const activeEquipIdsArr = Array.from(activeEquipIds);

      const [baselinesRes, currentMedicoesRes] = await Promise.all([
        Promise.all(activeEquipIdsArr.map(async (eqId) => {
          const { data } = await supabase.from("medicoes").select("horimetro_final, data")
            .eq("equipamento_id", eqId).eq("tipo", "Trabalho").lt("data", targetDate)
            .order("data", { ascending: false }).limit(1);
          return { 
            eqId, 
            horim: data && data.length > 0 ? Number(data[0].horimetro_final) : 0,
            dataAnterior: data && data.length > 0 ? data[0].data : null
          };
        })),
        supabase.from("medicoes").select("*").eq("data", targetDate)
      ]);

      const currentMedicoesList = currentMedicoesRes.data || [];

      const gridItems = activeEquipIdsArr.map(eqId => {
        const baselineData = baselinesRes.find(b => b.eqId === eqId);
        const baseline = baselineData?.horim || 0;
        const dataAnterior = baselineData?.dataAnterior || null;
        const current = currentMedicoesList.find(m => m.equipamento_id === eqId);
        const conData = equipContracts.get(eqId);
        const isDiaria = conData?.tipoMedicao === "diarias";

        let horimetroFinalVal = 0;
        if (current) {
          horimetroFinalVal = Number(current.horimetro_final);
        }

        return {
          equipamento_id: eqId,
          contrato_id: conData?.contratoId || "",
          tipo_medicao: conData?.tipoMedicao || "horas",
          label: conData?.label || "Equipamento",
          horimetro_inicial: baseline,
          horimetro_final: horimetroFinalVal,
          horas_trabalhadas: current ? Number(current.horas_trabalhadas) : (isDiaria ? 1 : 0),
          horas_indisponiveis: current && current.tipo === "Indisponível" ? Number(current.horas_trabalhadas) : 0,
          tipo: current?.tipo || "Trabalho",
          observacoes: current?.observacoes || "",
          alreadyExists: !!current,
          id: current?.id || null,
          dataAnterior: dataAnterior
        };
      });

      setBulkGridItems(gridItems);
    } catch (error) {
      console.error("Erro ao carregar grid de lançamento rápido:", error);
      toast({ title: "Erro ao carregar", description: "Não foi possível carregar as máquinas ativas.", variant: "destructive" });
    } finally {
      setLoadingBulkGrid(false);
    }
  };

  const handleSaveBulk = async () => {
    setIsSavingBulk(true);
    try {
      const toInsert: any[] = [];
      const toUpdate: any[] = [];

      for (const item of bulkGridItems) {
        const isDiaria = item.tipo_medicao === "diarias";
        const isIndisp = item.tipo === "Indisponível";

        if (!isDiaria && item.horimetro_final <= 0 && !isIndisp) {
          continue;
        }

        if (!isDiaria && !isIndisp && item.horimetro_final < item.horimetro_inicial) {
          toast({
            title: "Erro de Validação",
            description: `O horímetro final (${item.horimetro_final}) da máquina "${item.label}" não pode ser menor que o inicial (${item.horimetro_inicial}).`,
            variant: "destructive"
          });
          setIsSavingBulk(false);
          return;
        }

        const horasTrab = isDiaria ? item.horas_trabalhadas : (item.horimetro_final - item.horimetro_inicial);
        const horasIndisp = item.horas_indisponiveis;
        const totalDia = isIndisp ? horasIndisp : horasTrab;
        
        let maxHoras = 24;
        let dias = 1;
        if (!isDiaria && item.dataAnterior) {
          dias = getDaysDifference(bulkDate, item.dataAnterior);
          maxHoras = Math.max(24, dias * 24);
        }

        if (!isDiaria && totalDia > maxHoras) {
          toast({
            title: "Erro de Validação",
            description: `As horas trabalhadas da máquina "${item.label}" excedem o limite de ${maxHoras} horas para o período (${totalDia.toFixed(1)}h). Verifique o lançamento.`,
            variant: "destructive"
          });
          setIsSavingBulk(false);
          return;
        }

        const payload = {
          equipamento_id: item.equipamento_id,
          data: bulkDate,
          horimetro_inicial: isDiaria ? 0 : (isIndisp ? item.horimetro_inicial : item.horimetro_inicial),
          horimetro_final: isDiaria ? 0 : (isIndisp ? item.horimetro_inicial : item.horimetro_final),
          horas_trabalhadas: isIndisp ? item.horas_indisponiveis : (isDiaria ? item.horas_trabalhadas : (item.horimetro_final - item.horimetro_inicial)),
          tipo: item.tipo,
          observacoes: item.observacoes || null
        };

        if (item.alreadyExists && item.id) {
          toUpdate.push({ id: item.id, ...payload });
        } else {
          if (!isDiaria && !isIndisp && dias > 1) {
            const avgHours = totalDia / dias;
            const startDate = new Date(item.dataAnterior + "T00:00:00");
            for (let i = 1; i <= dias; i++) {
              const currentDate = new Date(startDate.getTime());
              currentDate.setDate(startDate.getDate() + i);
              const dateStr = currentDate.toISOString().split("T")[0];
              
              const hStart = item.horimetro_inicial + (i - 1) * avgHours;
              const hFinalRow = item.horimetro_inicial + i * avgHours;
              
              toInsert.push({
                id: crypto.randomUUID(),
                equipamento_id: item.equipamento_id,
                data: dateStr,
                horimetro_inicial: Number(hStart.toFixed(4)),
                horimetro_final: Number(hFinalRow.toFixed(4)),
                horas_trabalhadas: Number(avgHours.toFixed(4)),
                tipo: item.tipo,
                observacoes: item.observacoes || null
              });
            }
          } else {
            toInsert.push({ id: crypto.randomUUID(), ...payload });
          }
        }
      }

      const promises = [];
      if (toInsert.length > 0) {
        promises.push(supabase.from("medicoes").insert(toInsert));
      }
      if (toUpdate.length > 0) {
        toUpdate.forEach(u => {
          promises.push(supabase.from("medicoes").update(u).eq("id", u.id));
        });
      }

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(errors.map(r => r.error?.message).join(", "));
      }

      toast({ title: "Medições salvas", description: "Todos os lançamentos foram salvos com sucesso." });
      fetchData(true);
    } catch (error: any) {
      console.error("Erro ao salvar lançamentos em lote:", error);
      toast({ title: "Erro ao salvar", description: error.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setIsSavingBulk(false);
    }
  };

  const summaryMap = new Map<string, {totalHoras: number;entries: number;label: string;tag: string;mediaHorasDia: number;}>();
  const equipEntries = new Map<string, Medicao[]>();
  filtered.forEach((m) => {
    const arr = equipEntries.get(m.equipamento_id) || [];
    arr.push(m);
    equipEntries.set(m.equipamento_id, arr);
  });
  equipEntries.forEach((entries, eqId) => {
    const sorted = [...entries].sort((a, b) => a.data.localeCompare(b.data));
    const first = sorted[0];
    const label = `${first.equipamentos?.tipo} ${first.equipamentos?.modelo}`;
    const tag = first.equipamentos?.tag_placa || "";
    const trabalhoEntries = sorted.filter(e => (e.tipo || "Trabalho") === "Trabalho");

    const isDiaria = equipMedicaoTypes.get(eqId) === "diarias";
    let totalHoras = 0;
    let mediaHorasDia = 0;

    if (isDiaria) {
      totalHoras = trabalhoEntries.reduce((sum, e) => sum + Number(e.horas_trabalhadas || 0), 0);
      mediaHorasDia = 0;
    } else if (dataInicio && validDataFim) {
      const inicioStr = format(dataInicio, "yyyy-MM-dd");
      const fimStr = format(validDataFim, "yyyy-MM-dd");
      const allReadings: { data: string; horimetro_final: number }[] = [];
      const baseline = baselines.get(eqId);
      if (baseline) {
        allReadings.push({ data: baseline.data, horimetro_final: baseline.horim });
      }
      for (const e of trabalhoEntries) {
        allReadings.push({ data: e.data, horimetro_final: Number(e.horimetro_final) });
      }
      const result = calcularHorasInterpoladas(allReadings, inicioStr, fimStr);
      totalHoras = result.totalHoras;
      mediaHorasDia = result.mediaHorasDia;
    } else {
      const byDay = new Map<string, number>();
      for (const e of trabalhoEntries) {
        const d = String(e.data);
        const v = Number(e.horimetro_final);
        if (!byDay.has(d) || v > byDay.get(d)!) byDay.set(d, v);
      }
      const dayValues = Array.from(byDay.values());
      if (dayValues.length > 0) {
        const maior = Math.max(...dayValues);
        const menor = dayValues.length >= 2 ? Math.min(...dayValues) : maior;
        totalHoras = Math.max(0, maior - menor);
      }
    }
    summaryMap.set(eqId, { totalHoras, entries: entries.length, label, tag, mediaHorasDia });
  });

  const totalHorasGeral = Array.from(summaryMap.values()).reduce((acc, s) => acc + s.totalHoras, 0);

  const isDiaria = form.equipamento_id ? equipMedicaoTypes.get(form.equipamento_id) === "diarias" : false;
  const horasCalculadas = isDiaria 
    ? (form.tipo === "Indisponível" ? form.horas_indisp : form.horas_trab)
    : (form.tipo === "Indisponível"
      ? form.horas_indisp
      : Math.max(0, form.horimetro - (form.horimetro_inicial_indisp || form.horimetro_inicial)));

  const openNew = () => {
    const defaultEquip = equipamentos.length > 0 ? equipamentos[0].id : "";
    setEditingId(null);
    setForm({
      equipamento_id: defaultEquip,
      data: new Date().toISOString().split("T")[0],
      horimetro: 0,
      tipo: "Trabalho",
      observacoes: "",
      horimetro_inicial_indisp: 0,
      horas_indisp: 0,
      horas_trab: 1,
      horimetro_inicial: 0,
    });
    setHorimetroAnterior(0);
    setDataAnterior(null);
    if (defaultEquip) fetchHorimetroPorData(defaultEquip, new Date().toISOString().split("T")[0]);
    setDialogOpen(true);
  };

  const openEdit = (m: Medicao) => {
    setEditingId(m.id);
    const isIndisp = m.tipo === "Indisponível";
    const isDiaria = equipMedicaoTypes.get(m.equipamento_id) === "diarias";
    setForm({ 
      equipamento_id: m.equipamento_id, 
      data: m.data, 
      horimetro: isDiaria ? 0 : Number(m.horimetro_final), 
      tipo: m.tipo || "Trabalho", 
      observacoes: m.observacoes || "", 
      horimetro_inicial_indisp: isIndisp ? Number(m.horimetro_inicial) : 0, 
      horas_indisp: isIndisp ? Number(m.horas_trabalhadas) : 0,
      horas_trab: !isIndisp && isDiaria ? Number(m.horas_trabalhadas) : 1,
      horimetro_inicial: Number(m.horimetro_inicial)
    });
    setHorimetroAnterior(Number(m.horimetro_inicial));
    setDataAnterior(null);
    setDialogOpen(true);
    fetchHorimetroPorData(m.equipamento_id, m.data, m.id, false);
  };

  const handleSave = async () => {
    if (!form.equipamento_id) {
      toast({ title: "Campos obrigatórios", description: "Selecione um equipamento.", variant: "destructive" });
      return;
    }

    if (editingId) {
      const existing = items.find(i => i.id === editingId);
      if (existing && isMedicaoLocked(existing.equipamento_id, existing.data)) {
        toast({ title: "Erro", description: "Esta medição pertence a um período de faturamento já aprovado e não pode ser editada.", variant: "destructive" });
        return;
      }
    }
    if (isMedicaoLocked(form.equipamento_id, form.data)) {
      toast({
        title: "Erro ao registrar",
        description: "A data selecionada pertence a um período de faturamento já aprovado para este equipamento.",
        variant: "destructive"
      });
      return;
    }

    const isDiaria = equipMedicaoTypes.get(form.equipamento_id) === "diarias";

    if (!isDiaria && form.horimetro <= 0 && form.tipo !== "Indisponível") {
      toast({ title: "Campos obrigatórios", description: "Informe o horímetro.", variant: "destructive" });
      return;
    }

    const isIndisp = form.tipo === "Indisponível";
    let hInicial = 0;
    let hFinal = 0;
    let horasTrabalhadas = 0;

    if (isDiaria) {
      hInicial = 0;
      hFinal = 0;
      horasTrabalhadas = isIndisp ? form.horas_indisp : form.horas_trab;
    } else {
      hInicial = isIndisp 
        ? form.horimetro_inicial_indisp 
        : (!dataAnterior ? form.horimetro : form.horimetro_inicial);
      hFinal = form.horimetro;
      horasTrabalhadas = isIndisp ? form.horas_indisp : Math.max(0, form.horimetro - hInicial);

      if (!isIndisp) {
        if (form.horimetro < hInicial) {
          toast({
            title: "Erro de Validação",
            description: `O horímetro final (${form.horimetro}) não pode ser menor que o inicial (${hInicial}).`,
            variant: "destructive"
          });
          return;
        }
        let maxHoras = 24;
        let dias = 1;
        if (dataAnterior) {
          dias = getDaysDifference(form.data, dataAnterior);
          maxHoras = Math.max(24, dias * 24);
        }

        if (form.horimetro - hInicial > maxHoras) {
          toast({
            title: "Erro de Validação",
            description: `As horas trabalhadas (${(form.horimetro - hInicial).toFixed(1)}h) não podem exceder o limite de ${maxHoras} horas para o período.`,
            variant: "destructive"
          });
          return;
        }

        // Se for uma nova medição e abranger mais de 1 dia, distribui/interpola as horas e insere diariamente
        if (!editingId && dataAnterior && dias > 1) {
          const avgHours = horasTrabalhadas / dias;
          const toInsert = [];
          
          const startDate = new Date(dataAnterior + "T00:00:00");
          for (let i = 1; i <= dias; i++) {
            const currentDate = new Date(startDate.getTime());
            currentDate.setDate(startDate.getDate() + i);
            const dateStr = currentDate.toISOString().split("T")[0];
            
            const hStart = form.horimetro_inicial + (i - 1) * avgHours;
            const hFinalRow = form.horimetro_inicial + i * avgHours;
            
            toInsert.push({
              id: crypto.randomUUID(),
              equipamento_id: form.equipamento_id,
              data: dateStr,
              horimetro_inicial: Number(hStart.toFixed(4)),
              horimetro_final: Number(hFinalRow.toFixed(4)),
              horas_trabalhadas: Number(avgHours.toFixed(4)),
              tipo: form.tipo,
              observacoes: form.observacoes || null,
            });
          }
          
          const { error } = await supabase.from("medicoes").insert(toInsert);
          if (error) {
            toast({ title: "Erro", description: "Não foi possível gerar os lançamentos diários: " + error.message, variant: "destructive" });
            return;
          }
          
          toast({ title: "Lançamentos distribuídos", description: `${dias} registros diários foram gerados de ${parseLocalDate(dataAnterior).toLocaleDateString("pt-BR")} a ${parseLocalDate(form.data).toLocaleDateString("pt-BR")}.` });
          setDialogOpen(false);
          fetchData();
          return;
        }
      }
    }

    if (editingId) {
      const { error } = await supabase.from("medicoes").update({
        equipamento_id: form.equipamento_id,
        data: form.data,
        horimetro_inicial: hInicial,
        horimetro_final: hFinal,
        horas_trabalhadas: horasTrabalhadas,
        tipo: form.tipo,
        observacoes: form.observacoes || null,
      }).eq("id", editingId);
      if (error) {toast({ title: "Erro", description: error.message, variant: "destructive" });return;}
    } else {
      const { error } = await supabase.from("medicoes").insert({
        id: crypto.randomUUID(),
        equipamento_id: form.equipamento_id,
        data: form.data,
        horimetro_inicial: hInicial,
        horimetro_final: hFinal,
        horas_trabalhadas: horasTrabalhadas,
        tipo: form.tipo,
        observacoes: form.observacoes || null,
      });
      if (error) {toast({ title: "Erro", description: error.message, variant: "destructive" });return;}
    }
    setDialogOpen(false);
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const existing = items.find(i => i.id === deleteId);
    if (existing && isMedicaoLocked(existing.equipamento_id, existing.data)) {
      toast({ title: "Erro", description: "Esta medição pertence a um período de faturamento já aprovado e não pode ser excluída.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("medicoes").delete().eq("id", deleteId);
    if (error) {toast({ title: "Erro", description: error.message, variant: "destructive" });return;}
    toast({ title: "Horímetro excluído" });
    setDeleteId(null);
    fetchData(true);
  };

  const onEquipChange = (v: string) => {
    const isDiaria = equipMedicaoTypes.get(v) === "diarias";
    setForm((prev) => ({ 
      ...prev, 
      equipamento_id: v,
      horas_indisp: isDiaria ? 1 : prev.horas_indisp
    }));
    if (form.data) fetchHorimetroPorData(v, form.data, editingId || undefined);
  };

  const onDataChange = (v: string) => {
    setForm((prev) => ({ ...prev, data: v }));
    if (form.equipamento_id) fetchHorimetroPorData(form.equipamento_id, v, editingId || undefined);
  };

  const clearFilters = () => {setFilterEquip("Todos");setDataInicio(undefined);setDataFim(undefined);};
  const hasFilters = filterEquip !== "Todos" || dataInicio || dataFim;

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case "equipamento": cmp = `${a.equipamentos?.tipo} ${a.equipamentos?.modelo}`.localeCompare(`${b.equipamentos?.tipo} ${b.equipamentos?.modelo}`); break;
      case "tag": cmp = (a.equipamentos?.tag_placa || "").localeCompare(b.equipamentos?.tag_placa || ""); break;
      case "data": cmp = a.data.localeCompare(b.data); break;
      case "tipo": cmp = (a.tipo || "Trabalho").localeCompare(b.tipo || "Trabalho"); break;
      case "horimetro": cmp = Number(a.horimetro_final) - Number(b.horimetro_final); break;
      case "horas_indisp": cmp = Number(a.horas_trabalhadas) - Number(b.horas_trabalhadas); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const getLayoutHeader = () => {
    switch (activeTab) {
      case "faturamento":
        return { title: "Emitir Medição", subtitle: "Controle de medições de locações" };
      case "faturamento-novo":
        return { title: "Emissão de Faturas", subtitle: "Lançamento e controle de faturamentos" };
      case "pendentes-medicao":
        return { title: "Pendente de Medição", subtitle: "Alertas de medições e faturamentos pendentes" };
      case "historico-faturamento":
        return { title: "Histórico Financeiro", subtitle: "Consolidado de contratos, resumos e histórico de faturamentos" };
      default:
        return { title: "Horímetro", subtitle: "Controle de horímetros e diárias" };
    }
  };

  const header = getLayoutHeader();

  return (
    <Layout title={header.title} subtitle={header.subtitle}>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsContent value="medicoes" forceMount className="data-[state=inactive]:hidden">
      <div className="space-y-6">
        {/* KPI Cards */}
        {hasFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-accent/30 bg-accent/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Geral</p>
                  <h3 className="text-2xl font-bold mt-1 text-sidebar">
                    {totalHorasGeral.toFixed(1)}
                    {filterEquip !== "Todos" && equipMedicaoTypes.get(filterEquip) === "diarias" ? "d" : "h"}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">{filtered.length} registros (filtrado)</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <Clock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            {Array.from(summaryMap.entries()).map(([id, data]) => {
              const isDiaria = equipMedicaoTypes.get(id) === "diarias";
              return (
                <Card key={id} className="hover:shadow-md transition-shadow bg-card shadow-sm border-border">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground line-clamp-1" title={data.label}>{data.label}</p>
                        <h3 className="text-xl font-bold mt-1 text-accent">
                          {data.totalHoras.toFixed(1)}
                          {isDiaria ? "d" : "h"}
                        </h3>
                        {data.tag && <p className="text-[10px] font-mono text-muted-foreground mt-1">{data.tag}</p>}
                      </div>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Activity className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-[10px] text-muted-foreground">{data.entries} registros</p>
                      {data.mediaHorasDia > 0 && (
                        <p className="text-[10px] text-accent/70 font-medium">Média: {data.mediaHorasDia.toFixed(2)} h/dia</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
            <div className="flex items-center gap-2">
              <FileBarChart className="h-4 w-4 text-accent hidden sm:block" />
              <SearchableSelect
                value={filterEquip}
                onValueChange={setFilterEquip}
                placeholder="Todos os Equipamentos"
                searchPlaceholder="Pesquisar equipamento..."
                className="w-full sm:w-64 bg-background"
                options={[
                  { value: "Todos", label: "Todos os Equipamentos" },
                  ...equipamentos.map((e) => ({ value: e.id, label: getEquipLabel(e) })),
                ]}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="date"
                className="w-full sm:w-40 bg-background"
                value={dataInicio ? format(dataInicio, "yyyy-MM-dd") : ""}
                onChange={(e) => setDataInicio(e.target.value ? parseLocalDate(e.target.value) : undefined)}
              />
              <span className="text-muted-foreground text-sm">até</span>
              <Input
                type="date"
                className="w-full sm:w-40 bg-background"
                value={dataFim ? format(dataFim, "yyyy-MM-dd") : ""}
                onChange={(e) => setDataFim(e.target.value ? parseLocalDate(e.target.value) : undefined)}
              />
            </div>
            {hasFilters &&
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground whitespace-nowrap">Limpar filtros</Button>
            }
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const headers = ["Equipamento", "Tag/Placa", "Data", "Tipo", "Horímetro/Diária", "Indisponibilidade"];
                const rows = filtered.map((m) => {
                  const isDiaria = equipMedicaoTypes.get(m.equipamento_id) === "diarias";
                  return [
                    `${m.equipamentos?.tipo} ${m.equipamentos?.modelo}`,
                    m.equipamentos?.tag_placa || "—",
                    parseLocalDate(m.data).toLocaleDateString("pt-BR"),
                    m.tipo || "Trabalho",
                    isDiaria ? "Diária (Trabalho)" : Number(m.horimetro_final).toFixed(1),
                    (m.tipo || "Trabalho") === "Indisponível" ? `${Number(m.horas_trabalhadas).toFixed(1)}${isDiaria ? "d" : "h"}` : "—"
                  ];
                });
                const periodo = dataInicio && dataFim ? ` - ${format(dataInicio, "dd/MM/yyyy")} a ${format(dataFim, "dd/MM/yyyy")}` : "";
                exportToPDF({ title: `Relatório de Horímetro Mensal${periodo}`, headers, rows, filename: `horimetro_mensal_${new Date().toISOString().slice(0, 10)}` });
              }} className="bg-background">
                <FileDown className="h-4 w-4 mr-1 text-primary" /> PDF
              </Button>
            </div>
            <Button onClick={() => { setBulkDialogOpen(true); fetchActiveEquipmentsForDate(bulkDate); }} variant="outline" className="border-accent text-accent hover:bg-accent/10 shadow-sm">
              <CheckSquare className="h-4 w-4 mr-2" /> Lançamento Rápido
            </Button>
            <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Novo
            </Button>
          </div>
        </div>

        <Card className="shadow-sm border-border overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                 <TableRow>
                   <SortableTableHead column="equipamento" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Equipamento</SortableTableHead>
                   <SortableTableHead column="tag" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Tag/Placa</SortableTableHead>
                   <SortableTableHead column="data" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Data</SortableTableHead>
                   <SortableTableHead column="tipo" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Tipo</SortableTableHead>
                   <SortableTableHead column="horimetro" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Horímetro / Lançamento</SortableTableHead>
                   <SortableTableHead column="horas_indisp" sortCol={sortCol} sortAsc={sortAsc} onSort={toggleSort}>Horas / Diárias Indisp.</SortableTableHead>
                   <TableHead className="w-20">Ações</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((item) =>
                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <PenTool className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm leading-none">{item.equipamentos?.tipo} {item.equipamentos?.modelo}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.equipamentos?.tag_placa || "—"}</TableCell>
                     <TableCell className="text-sm">{parseLocalDate(item.data).toLocaleDateString("pt-BR")}</TableCell>
                     <TableCell>
                       {(item.tipo || "Trabalho") === "Indisponível" ? (
                         <Badge variant="destructive" className="text-xs gap-1">
                           <AlertTriangle className="h-3 w-3" /> Indisponível
                         </Badge>
                       ) : (
                         <Badge className="bg-accent/10 text-accent border-0 text-xs">Trabalho</Badge>
                       )}
                     </TableCell>
                     <TableCell className="text-sm font-medium">
                       {equipMedicaoTypes.get(item.equipamento_id) === "diarias" 
                          ? (item.tipo === "Trabalho" ? `${Number(item.horas_trabalhadas).toFixed(1)}d` : "—") 
                          : Number(item.horimetro_final).toFixed(1)}
                     </TableCell>
                     <TableCell>
                        {(item.tipo || "Trabalho") === "Indisponível" ? (
                          <Badge className="font-semibold border-0 bg-destructive/10 text-destructive">
                            <Clock className="h-3 w-3 mr-1" />
                            {Number(item.horas_trabalhadas).toFixed(1)}
                            {equipMedicaoTypes.get(item.equipamento_id) === "diarias" ? "d" : "h"}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!isMedicaoLocked(item.equipamento_id, item.data) ? (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => openEdit(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir" onClick={() => setDeleteId(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="h-7 border-success/30 text-success bg-success/5 text-[10px] py-0.5 px-2 flex items-center gap-1 shrink-0 font-medium">
                            <ShieldCheck className="h-3 w-3" />
                            Aprovado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && sorted.length === 0 &&
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum horímetro encontrado</TableCell></TableRow>
                }
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
        </TabsContent>
        <TabsContent value="faturamento" forceMount className="data-[state=inactive]:hidden">
          <FaturamentoContent />
        </TabsContent>
        <TabsContent value="faturamento-novo" forceMount className="data-[state=inactive]:hidden">
          <FaturamentoTab />
        </TabsContent>
        <TabsContent value="pendentes-medicao" forceMount className="data-[state=inactive]:hidden">
          <PendenteMedicaoView />
        </TabsContent>
        <TabsContent value="historico-faturamento" forceMount className="data-[state=inactive]:hidden">
          <HistoricoFaturamentoView />
        </TabsContent>

        <TabsContent value="lancamento-lote" forceMount className="data-[state=inactive]:hidden">
          <Card className="border-border shadow-sm flex flex-col min-h-[60vh]">
            <CardHeader className="border-b border-border bg-muted/20 pb-4 shrink-0 flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <CheckSquare className="h-6 w-6 text-accent" />
                  Boletim de Apontamento Rápido
                </CardTitle>
                <div className="mt-3 p-3 bg-accent/10 border border-accent/20 rounded-lg max-w-2xl">
                  <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                    <strong className="text-accent">💡 Piloto Automático:</strong> Não se preocupe em preencher os horímetros dia a dia se o equipamento não quebrou! Basta lançar a leitura do <strong>último dia da semana ou do mês</strong>. O sistema calculará a diferença e dividirá as horas automaticamente pelos dias vazios, mantendo seu faturamento contínuo.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Data da Leitura Final:</Label>
                <Input
                  type="date"
                  className="w-48 h-10 text-sm font-medium shadow-sm"
                  value={bulkDate}
                  onChange={(e) => {
                    setBulkDate(e.target.value);
                    if (e.target.value) fetchActiveEquipmentsForDate(e.target.value);
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col bg-muted/5">
              <div className="flex-1 overflow-x-auto p-4">
                {loadingBulkGrid ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2 h-full">
                    <Clock className="h-6 w-6 text-accent animate-spin" />
                    <span>Buscando equipamentos ativos e cruzando leituras anteriores...</span>
                  </div>
                ) : bulkGridItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm border border-dashed rounded-lg bg-background h-full">
                    <AlertTriangle className="h-6 w-6 text-warning mb-2" />
                    <span>Nenhum equipamento com contrato ativo cobrindo a data selecionada.</span>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm min-w-[800px]">
                    <Table>
                      <TableHeader className="bg-muted">
                        <TableRow>
                          <TableHead className="w-[30%] font-bold">Cliente / Equipamento</TableHead>
                          <TableHead className="w-[12%] text-center font-bold">Tipo Contrato</TableHead>
                          <TableHead className="w-[12%] text-center font-bold">Leitura Anterior</TableHead>
                          <TableHead className="w-[12%] text-center font-bold">Ocorrência</TableHead>
                          <TableHead className="w-[14%] text-center font-bold">Novo Lançamento</TableHead>
                          <TableHead className="w-[20%] font-bold">Observações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkGridItems.map((item) => {
                          const isDiaria = item.tipo_medicao === "diarias";
                          const isIndisp = item.tipo === "Indisponível";

                          const updateField = (field: string, val: any) => {
                            setBulkGridItems(prev => prev.map(row => {
                              if (row.equipamento_id === item.equipamento_id) {
                                const updated = { ...row, [field]: val };
                                if (field === "tipo" && val === "Indisponível") {
                                  updated.horas_indisponiveis = isDiaria ? 1 : 0;
                                  updated.horas_trabalhadas = 0;
                                  updated.horimetro_final = row.horimetro_inicial;
                                } else if (field === "tipo" && val === "Trabalho") {
                                  updated.horas_indisponiveis = 0;
                                  updated.horas_trabalhadas = isDiaria ? 1 : 0;
                                }
                                return updated;
                              }
                              return row;
                            }));
                          };

                          return (
                            <TableRow key={item.equipamento_id} className={cn(
                              item.alreadyExists ? "bg-success/5 hover:bg-success/10" : "hover:bg-muted/30",
                              isIndisp && "bg-destructive/5 hover:bg-destructive/10"
                            )}>
                              <TableCell className="align-middle">
                                <div>
                                  <p className="font-semibold text-xs text-foreground line-clamp-1">{item.label}</p>
                                  {item.alreadyExists && (
                                    <Badge variant="secondary" className="text-[9px] py-0 px-1 mt-1 bg-success/20 text-success border-success/30 font-normal w-fit">
                                      Leitura já registrada
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center align-middle">
                                <Badge variant="outline" className="text-[10px] uppercase font-normal font-sans bg-background">
                                  {isDiaria ? "Diárias" : "Horímetro"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center align-middle font-mono font-semibold text-xs text-muted-foreground">
                                {isDiaria ? "—" : `${item.horimetro_inicial.toFixed(1)}h`}
                              </TableCell>
                              <TableCell className="align-middle">
                                <Select value={item.tipo} onValueChange={(v) => updateField("tipo", v)}>
                                  <SelectTrigger className="h-8 text-xs bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Trabalho">Trabalho Normal</SelectItem>
                                    <SelectItem value="Indisponível">Quebra / Parada</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="align-middle text-center">
                                {isIndisp ? (
                                  <div className="flex flex-col gap-1 items-center">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Desconto ({isDiaria ? "Dias" : "Hrs"})</span>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      className="h-8 text-xs font-semibold text-center border-destructive/50 focus-visible:ring-destructive w-24 bg-background"
                                      placeholder={isDiaria ? "Diárias" : "Horas"}
                                      value={item.horas_indisponiveis || ""}
                                      onChange={(e) => updateField("horas_indisponiveis", Number(e.target.value))}
                                    />
                                  </div>
                                ) : isDiaria ? (
                                  <div className="flex flex-col gap-1 items-center">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Diárias Trab.</span>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      className="h-8 text-xs font-semibold text-center w-24 bg-background"
                                      value={item.horas_trabalhadas || ""}
                                      onChange={(e) => updateField("horas_trabalhadas", Number(e.target.value))}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1 items-center relative group">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Leitura Final</span>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      className={cn(
                                        "h-8 text-xs font-mono font-bold text-center w-24 bg-background",
                                        item.horimetro_final < item.horimetro_inicial ? "border-destructive focus-visible:ring-destructive text-destructive" : ""
                                      )}
                                      placeholder={`${item.horimetro_inicial.toFixed(1)}h`}
                                      value={item.horimetro_final || ""}
                                      onChange={(e) => updateField("horimetro_final", Number(e.target.value))}
                                    />
                                    {item.horimetro_final > item.horimetro_inicial ? (
                                      <span className="text-[10px] font-semibold text-success mt-0.5 whitespace-nowrap">
                                        +{Math.max(0, item.horimetro_final - item.horimetro_inicial).toFixed(1)}h rodadas
                                      </span>
                                    ) : item.horimetro_final < item.horimetro_inicial && item.horimetro_final !== 0 ? (
                                      <span className="text-[10px] font-semibold text-destructive mt-0.5 whitespace-nowrap">
                                        Inválido! (Menor que anterior)
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="align-middle">
                                <Input
                                  type="text"
                                  className="h-8 text-xs bg-background"
                                  placeholder={isIndisp ? "Descreva o problema ocorrido..." : "Observações extras..."}
                                  value={item.observacoes || ""}
                                  onChange={(e) => updateField("observacoes", e.target.value)}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-border bg-muted/10 flex justify-end shrink-0">
                <Button onClick={handleSaveBulk} disabled={isSavingBulk || bulkGridItems.length === 0} className="bg-accent text-accent-foreground hover:bg-accent/90 px-8">
                  {isSavingBulk ? "Salvando..." : "Confirmar e Salvar Lote"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          {(() => {
            const isDiaria = equipMedicaoTypes.get(form.equipamento_id) === "diarias";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-accent" />
                    {editingId ? (isDiaria ? "Editar Lançamento de Diária" : "Editar Horímetro") : (isDiaria ? "Novo Lançamento de Diária" : "Novo Horímetro")}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label>Equipamento</Label>
                    <SearchableSelect
                      value={form.equipamento_id}
                      onValueChange={onEquipChange}
                      placeholder="Selecione o equipamento"
                      searchPlaceholder="Pesquisar equipamento..."
                      options={equipamentos.map((e) => ({ value: e.id, label: getEquipLabel(e) }))}
                    />
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={form.data} onChange={(e) => onDataChange(e.target.value)} />
                  </div>
                  <div>
                    <Label>Tipo de Lançamento</Label>
                    <RadioGroup 
                      value={form.tipo} 
                      onValueChange={(v) => setForm({ 
                        ...form, 
                        tipo: v,
                        horas_indisp: v === "Indisponível" && isDiaria ? 1 : form.horas_indisp
                      })} 
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Trabalho" id="tipo-trabalho" />
                        <Label htmlFor="tipo-trabalho" className="cursor-pointer">Trabalho</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Indisponível" id="tipo-indisponivel" />
                        <Label htmlFor="tipo-indisponivel" className="cursor-pointer">Indisponível</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  {form.tipo === "Indisponível" && (
                    <>
                      <div>
                        <Label>Observação (motivo da indisponibilidade)</Label>
                        <Textarea
                          value={form.observacoes}
                          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                          placeholder="Ex: Manutenção preventiva, quebra mecânica..."
                          rows={3}
                        />
                      </div>
                      {!isDiaria && (
                        <div className="space-y-3">
                          <div>
                            <Label>Leitura Atual do Horímetro (Opcional)</Label>
                            <Input type="number" step="0.1" value={form.horimetro || ""} onChange={(e) => {
                              setForm({ ...form, horimetro: Number(e.target.value) });
                            }} placeholder="Ex: 10350.5" />
                          </div>
                        </div>
                      )}
                      <div>
                        <Label>{isDiaria ? "Diárias Indisponíveis (editável)" : "Horas Indisponíveis (editável)"}</Label>
                        <Input type="number" step="0.1" value={form.horas_indisp || ""} onChange={(e) => setForm({ ...form, horas_indisp: Number(e.target.value) })} placeholder={isDiaria ? "Ex: 1.0" : "Ex: 9.5"} />
                        {!isDiaria && <p className="text-xs text-muted-foreground mt-1">Pré-calculado pela diferença do horímetro. Edite se necessário.</p>}
                      </div>
                    </>
                  )}
                  {form.tipo === "Trabalho" && (
                    <div>
                      {isDiaria ? (
                        <div className="space-y-4">
                          <div className="p-3 bg-accent/10 rounded-md border border-accent/20">
                            <p className="text-xs text-muted-foreground leading-normal">
                              <strong>Lançamento por Diárias:</strong> Este equipamento possui contrato por diárias. Ao registrar, insira a quantidade de diárias de trabalho realizadas.
                            </p>
                          </div>
                          <div>
                            <Label>Diárias Trabalhadas (editável)</Label>
                            <Input 
                              type="number" 
                              step="0.1" 
                              value={form.horas_trab || ""} 
                              onChange={(e) => setForm({ ...form, horas_trab: Number(e.target.value) })} 
                              placeholder="Ex: 1.0" 
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <Label>Leitura Final do Horímetro</Label>
                            <Input 
                              type="number" 
                              step="0.1" 
                              value={form.horimetro || ""} 
                              onChange={(e) => setForm({ ...form, horimetro: Number(e.target.value) })} 
                              placeholder="Ex: 10350.5" 
                            />
                            {dataAnterior ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Último registro: <strong>{horimetroAnterior.toFixed(1)}</strong>
                                {form.horimetro > 0 && ` → Trabalhadas: ${Math.max(0, form.horimetro - horimetroAnterior).toFixed(1)}h`}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1">
                                <strong>Primeiro registro desta máquina.</strong> As horas trabalhadas serão contabilizadas a partir do próximo lançamento.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {!isDiaria && horasCalculadas > 0 && (
                    <div className={cn("p-3 rounded-lg text-center", form.tipo === "Indisponível" ? "bg-destructive/10" : "bg-accent/10")}>
                      <p className="text-sm text-muted-foreground">
                        {form.tipo === "Indisponível" ? "Horas indisponíveis (serão descontadas)" : "Horas trabalhadas (diferença)"}
                      </p>
                      <p className={cn("text-2xl font-bold", form.tipo === "Indisponível" ? "text-destructive" : "text-accent")}>{horasCalculadas.toFixed(1)}h</p>
                      <p className="text-xs text-muted-foreground">
                        {form.tipo === "Indisponível" 
                          ? form.horimetro_inicial_indisp.toFixed(1) 
                          : form.horimetro_inicial.toFixed(1)} → {form.horimetro.toFixed(1)}
                      </p>
                    </div>
                  )}
                  {isDiaria && form.tipo === "Indisponível" && form.horas_indisp > 0 && (
                    <div className="p-3 rounded-lg text-center bg-destructive/10">
                      <p className="text-sm text-muted-foreground">Diárias indisponíveis (serão descontadas)</p>
                      <p className="text-2xl font-bold text-destructive">{form.horas_indisp.toFixed(1)}d</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">
                    {editingId ? "Salvar" : "Registrar"}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Horímetro</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este registro de horímetro? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </Layout>);

};

import React from "react";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-xl mx-auto bg-destructive/10 text-destructive rounded-lg border border-destructive/20 mt-10">
          <h2 className="text-lg font-bold mb-2">Ops! Algo deu errado ao carregar a página.</h2>
          <p className="text-sm font-semibold mb-4">{this.state.error?.toString()}</p>
          <pre className="text-xs bg-card p-3 rounded border overflow-auto max-h-60 text-foreground">
            {this.state.error?.stack}
          </pre>
          <Button onClick={() => window.location.reload()} className="mt-4 bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Recarregar Página
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MedicoesWithErrorBoundary = () => (
  <ErrorBoundary>
    <Medicoes />
  </ErrorBoundary>
);

export default MedicoesWithErrorBoundary;