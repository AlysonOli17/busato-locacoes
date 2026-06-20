import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Plus, Search, FileDown, Trash2, AlertTriangle, Loader2, UploadCloud, Camera, Check, X, Image as ImageIcon } from "lucide-react";
import { exportChecklistToPDF } from "@/lib/checklistExportUtils";

export const isAfterDec2025 = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false;
  const datePart = dateStr.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart >= "2025-12-01";
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    if (year > 2025) return true;
    if (year === 2025 && month >= 11) return true;
    return false;
  } catch {
    return false;
  }
};

interface ChecklistItem {
  id: string;
  contrato_id: string | null;
  equipamento_id: string;
  tipo: string;
  data: string;
  horimetro: number;
  inspector: string;
  status: string;
  itens: Record<string, any>;
  fotosGerais?: Record<string, any>;
  notas: string;
  equipamentos?: { tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null } | null;
  contratos?: { id: string; empresa_id: string; empresas?: { nome: string } | null } | null;
}

export const checklistItemsTemplate = [
  { id: "para_brisa", label: "Para-brisa sem avaria" },
  { id: "limpadores", label: "Limpadores para-brisa" },
  { id: "agua_para_brisa", label: "Água do reservatório do para-brisa" },
  { id: "agua_radiador", label: "Nível de água radiador" },
  { id: "oleo_motor", label: "Nível do óleo do motor" },
  { id: "farol_sinalizadores", label: "Farol e sinalizadores de direção" },
  { id: "antena", label: "Antena" },
  { id: "documento", label: "Documento atualizado" },
  { id: "difusores_ar", label: "Difusores de ar" },
  { id: "luzes_painel", label: "Luzes do painel apagadas" },
  { id: "revisao_km", label: "Revisão de Km" },
  { id: "buzina", label: "Buzina" },
  { id: "tapetes", label: "Tapetes" },
  { id: "sem_odores", label: "Sem Odores" },
  { id: "radio", label: "Funcionamento do rádio/multimídia" },
  { id: "chave_reserva", label: "Chave Reserva" },
  { id: "porta_luvas", label: "Porta Luvas Limpo" }
];

export const requiredPhotosTemplate = [
  { id: "frente", label: "Frente" },
  { id: "painel", label: "Painel" },
  { id: "interior", label: "Interior do Veículo" },
  { id: "lateral_direita", label: "Lateral direita" },
  { id: "lateral_esquerda", label: "Lateral Esquerda" },
  { id: "traseira", label: "Traseira" },
  { id: "pneu_dianteiro_dir", label: "Pneu Dianteiro Direito" },
  { id: "pneu_dianteiro_esq", label: "Pneu Dianteiro Esquerdo" },
  { id: "pneu_traseiro_dir", label: "Pneu Traseiro Direito" },
  { id: "pneu_traseiro_esq", label: "Pneu Traseiro Esquerdo" },
  { id: "outros_1", label: "Outros" },
  { id: "outros_2", label: "Outros" }
];

const getDefaultItens = () => {
  return checklistItemsTemplate.reduce((acc, item) => {
    acc[item.id] = { conforme: true, observacao: "", fotoUrl: null };
    return acc;
  }, {} as Record<string, any>);
};

const getDefaultFotosGerais = () => {
  return requiredPhotosTemplate.reduce((acc, photo) => {
    acc[photo.id] = { fotoUrl: null };
    return acc;
  }, {} as Record<string, any>);
};

const emptyForm = {
  contrato_id: "none",
  equipamento_id: "",
  tipo: "Entrega",
  data: new Date().toISOString().slice(0, 10),
  horimetro: 0,
  inspector: "",
  status: "Aprovado",
  itens: getDefaultItens(),
  fotosGerais: getDefaultFotosGerais(),
  notas: ""
};

export const ChecklistsTab = () => {
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [contratosEquipamentos, setContratosEquipamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [chkRes, eqRes, ctRes, ceRes, empRes] = await Promise.all([
        supabase.from("checklists").select("*").order("created_at", { ascending: false }),
        supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie"),
        supabase.from("contratos").select("id, empresa_id, status"),
        supabase.from("contratos_equipamentos").select("id, contrato_id, equipamento_id, data_devolucao"),
        supabase.from("empresas").select("id, nome")
      ]);

      const eqMap = new Map((eqRes.data || []).map(e => [e.id, e]));
      const empMap = new Map((empRes.data || []).map(e => [e.id, e]));
      const ctMap = new Map((ctRes.data || []).map(c => [
        c.id, 
        { ...c, empresas: empMap.get(c.empresa_id) || null }
      ]));

      if (chkRes.data) {
        const mapped = chkRes.data.map((c: any) => ({
          ...c,
          equipamentos: eqMap.get(c.equipamento_id) || null,
          contratos: ctMap.get(c.contrato_id) || null
        }));
        setChecklists(mapped as ChecklistItem[]);
      }

      if (eqRes.data) setEquipamentos(eqRes.data);
      if (ctRes.data) setContratos(ctRes.data.map((c: any) => ({ ...c, empresas: empMap.get(c.empresa_id) })));
      if (ceRes.data) setContratosEquipamentos(ceRes.data);
    } catch (err: any) {
      console.error("Erro ao carregar dados do checklist:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // 1. Lógica de Pendências de Desmobilização
  // Retorna todos os equipamentos em contratos com data_devolucao (desmobilizados) mas sem checklist de devolução correspondente
  const pendencias = useMemo(() => {
    const devChecklists = new Set(
      checklists.filter(c => c.tipo === "Devolução").map(c => `${c.contrato_id}::${c.equipamento_id}`)
    );

    const list: any[] = [];
    contratosEquipamentos.forEach(ce => {
      if (ce.data_devolucao) {
        const key = `${ce.contrato_id}::${ce.equipamento_id}`;
        if (!devChecklists.has(key)) {
          const eq = equipamentos.find(e => e.id === ce.equipamento_id);
          const ct = contratos.find(c => c.id === ce.contrato_id);
          list.push({
            id: ce.id,
            contrato_id: ce.contrato_id,
            equipamento_id: ce.equipamento_id,
            data_devolucao: ce.data_devolucao,
            equipamento: eq ? `${eq.tipo} ${eq.modelo} (${eq.tag_placa || "Sem Placa"})` : "Equipamento Desconhecido",
            cliente: ct?.empresas?.nome || "Cliente Desconhecido"
          });
        }
      }
    });
    return list;
  }, [contratosEquipamentos, checklists, equipamentos, contratos]);

  const filteredItems = useMemo(() => {
    return checklists.filter(c => {
      const q = search.toLowerCase();
      const tipo = c.equipamentos?.tipo?.toLowerCase() || "";
      const modelo = c.equipamentos?.modelo?.toLowerCase() || "";
      const tag = c.equipamentos?.tag_placa?.toLowerCase() || "";
      const insp = c.inspector.toLowerCase();
      const client = c.contratos?.empresas?.nome?.toLowerCase() || "";

      return tipo.includes(q) || modelo.includes(q) || tag.includes(q) || insp.includes(q) || client.includes(q);
    });
  }, [checklists, search]);

  const handleOpenAdd = (contratoId?: string, equipId?: string, tipo?: string) => {
    setForm({
      contrato_id: contratoId || "none",
      equipamento_id: equipId || "",
      tipo: tipo || "Entrega",
      data: new Date().toISOString().slice(0, 10),
      horimetro: 0,
      inspector: "",
      status: "Aprovado",
      itens: getDefaultItens(),
      fotosGerais: getDefaultFotosGerais(),
      notas: ""
    });
    setDialogOpen(true);
  };

  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    if (!form.equipamento_id) {
      toast({ title: "Campo obrigatório", description: "Selecione o equipamento.", variant: "destructive" });
      return;
    }
    if (!form.inspector.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o nome do inspetor responsável.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      let payloadItens = { ...form.itens };
      let payloadFotosGerais = { ...(form.fotosGerais || {}) };
      
      const accessToken = localStorage.getItem("gdrive_access_token");
      const expiresAtStr = localStorage.getItem("gdrive_token_expires_at");
      const isTokenValid = accessToken && expiresAtStr && parseInt(expiresAtStr) > Date.now();

      // Upload photos to Google Drive if connected and linked to contract
      if (isTokenValid && form.contrato_id && form.contrato_id !== "none") {
        const ct = contratos.find(c => c.id === form.contrato_id);
        if (ct?.gdrive_folder_id) {
          const { gdriveListFiles, gdriveCreateFolder, gdriveUploadFile } = await import("@/lib/gdrive");
          const subfolders = await gdriveListFiles(ct.gdrive_folder_id, accessToken);
          let opFolder = subfolders.find(f => f.name === "2. Operacional" && f.mimeType === "application/vnd.google-apps.folder");
          let opFolderId = opFolder ? opFolder.id : (await gdriveCreateFolder("2. Operacional", ct.gdrive_folder_id, accessToken)).id;

          const opSub = await gdriveListFiles(opFolderId, accessToken);
          let chkFolder = opSub.find(f => f.name === "Checklists" && f.mimeType === "application/vnd.google-apps.folder");
          let chkFolderId = chkFolder ? chkFolder.id : (await gdriveCreateFolder("Checklists", opFolderId, accessToken)).id;

          const uploadPhoto = async (file: File, prefix: string) => {
            toast({ description: `Enviando foto: ${prefix}...` });
            const filename = `${form.tipo}_${prefix}_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
            const uploaded = await gdriveUploadFile(file, filename, chkFolderId, accessToken);
            return uploaded.webViewLink;
          };

          for (const key of Object.keys(payloadItens)) {
            if (payloadItens[key].fotoFile) {
              const url = await uploadPhoto(payloadItens[key].fotoFile, key);
              payloadItens[key] = { ...payloadItens[key], fotoUrl: url };
              delete payloadItens[key].fotoFile;
            }
          }

          for (const key of Object.keys(payloadFotosGerais)) {
            if (payloadFotosGerais[key].fotoFile) {
              const url = await uploadPhoto(payloadFotosGerais[key].fotoFile, `Geral_${key}`);
              payloadFotosGerais[key] = { ...payloadFotosGerais[key], fotoUrl: url };
              delete payloadFotosGerais[key].fotoFile;
            }
          }
        }
      }

      // Cleanup local File objects if drive upload failed or was skipped
      for (const key of Object.keys(payloadItens)) {
        if (payloadItens[key].fotoFile) delete payloadItens[key].fotoFile;
      }
      for (const key of Object.keys(payloadFotosGerais)) {
        if (payloadFotosGerais[key].fotoFile) delete payloadFotosGerais[key].fotoFile;
      }

      // Salva as fotos gerais dentro do JSON de itens para evitar a necessidade de criar nova coluna
      payloadItens["__fotos_gerais"] = payloadFotosGerais;

      const payload = {
        contrato_id: form.contrato_id === "none" ? null : form.contrato_id,
        equipamento_id: form.equipamento_id,
        tipo: form.tipo,
        data: form.data,
        horimetro: Number(form.horimetro || 0),
        inspector: form.inspector,
        status: form.status,
        itens: payloadItens,
        notas: form.notas
      };

      const { data, error } = await supabase.from("checklists").insert(payload).select().single();
      if (error) throw error;
      
      toast({ title: "Sucesso", description: "Checklist registrado com sucesso." });
      setDialogOpen(false);
      fetchAll();

      // Auto-insert horimetro in medicoes if valid
      if (payload.horimetro > 0 && payload.equipamento_id) {
        try {
          const { data: lastMed } = await supabase.from("medicoes")
            .select("horimetro_final, data")
            .eq("equipamento_id", payload.equipamento_id)
            .order("data", { ascending: false })
            .limit(1);
          
          let hInicial = 0;
          if (lastMed && lastMed.length > 0) {
            hInicial = Number(lastMed[0].horimetro_final);
          }
          
          // Only insert if it progresses from the last known reading
          if (payload.horimetro >= hInicial) {
            const horasTrabalhadas = payload.horimetro - hInicial;
            await supabase.from("medicoes").insert({
              id: crypto.randomUUID(),
              equipamento_id: payload.equipamento_id,
              data: payload.data,
              horimetro_inicial: hInicial,
              horimetro_final: payload.horimetro,
              horas_trabalhadas: horasTrabalhadas,
              tipo: "Trabalho",
              observacoes: `Lançamento automático via Vistoria (${payload.tipo})`
            });
          }
        } catch (e) {
          console.error("Falha ao atualizar horímetro nas medições:", e);
        }
      }

      // Auto PDF sync
      if (isTokenValid && payload.contrato_id && isAfterDec2025(payload.data)) {
        toast({ title: "Google Drive", description: "Enviando laudo PDF..." });
        handleUploadToGDrive(data as ChecklistItem);
      }
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este checklist?")) return;
    try {
      const { error } = await supabase.from("checklists").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Checklist removido." });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadPDF = async (item: ChecklistItem) => {
    try {
      const eq = item.equipamentos || equipamentos.find(e => e.id === item.equipamento_id);
      const ct = item.contratos || contratos.find(c => c.id === item.contrato_id);
      if (!eq) throw new Error("Equipamento não encontrado.");
      await exportChecklistToPDF(item, eq, ct);
      toast({ title: "PDF Gerado", description: "Checklist exportado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    }
  };

  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleUploadToGDrive = async (item: ChecklistItem) => {
    const accessToken = localStorage.getItem("gdrive_access_token");
    const expiresAtStr = localStorage.getItem("gdrive_token_expires_at");
    
    if (!accessToken || !expiresAtStr || parseInt(expiresAtStr) <= Date.now()) {
      toast({
        title: "Google Drive Desconectado",
        description: "Acesse a aba Dossiê em Empresas -> Contratos e conecte seu Google Drive primeiro.",
        variant: "destructive"
      });
      return;
    }

    if (!item.contrato_id) {
      toast({
        title: "Contrato não vinculado",
        description: "Esta vistoria é avulsa e não está associada a nenhum contrato comercial.",
        variant: "destructive"
      });
      return;
    }

    if (!isAfterDec2025(item.data)) {
      toast({
        title: "Sincronização Ignorada",
        description: "Este checklist é anterior a dezembro de 2025 e não será enviado ao Google Drive.",
      });
      return;
    }

    setSyncingId(item.id);
    try {
      const eq = item.equipamentos || equipamentos.find(e => e.id === item.equipamento_id);
      const ct = item.contratos || contratos.find(c => c.id === item.contrato_id);
      if (!eq) throw new Error("Equipamento não encontrado.");
      if (!ct) throw new Error("Contrato não encontrado.");

      // 1. Check if contract has gdrive_folder_id mapped
      let folderId = ct.gdrive_folder_id;
      if (!folderId) {
        throw new Error("O dossiê deste contrato ainda não foi inicializado. Crie o dossiê na aba 'Dossiê' primeiro.");
      }

      // 2. Export/Generate PDF
      const doc = await exportChecklistToPDF(item, eq, ct);
      const blob = doc.output("blob");

      // 3. Find or Create "2. Operacional" subfolder under contract folder
      const { gdriveListFiles, gdriveCreateFolder, gdriveUploadFile } = await import("@/lib/gdrive");
      const subfolders = await gdriveListFiles(folderId, accessToken);
      let opFolder = subfolders.find(f => f.name === "2. Operacional" && f.mimeType === "application/vnd.google-apps.folder");
      
      let opFolderId = "";
      if (opFolder) {
        opFolderId = opFolder.id;
      } else {
        const newFolder = await gdriveCreateFolder("2. Operacional", folderId, accessToken);
        opFolderId = newFolder.id;
      }

      // 4. Upload file
      const filename = `Checklist_${item.tipo}_${eq.tag_placa || "Equipamento"}_${item.id.slice(0, 5)}.pdf`;
      const existingFiles = await gdriveListFiles(opFolderId, accessToken);
      if (existingFiles.some(f => f.name === filename)) {
        toast({
          title: "Documento já existe",
          description: `O checklist "${filename}" já está salvo no Dossiê (Operacional). Upload evitado para não gerar duplicidade.`
        });
        return;
      }

      await gdriveUploadFile(blob, filename, opFolderId, accessToken);

      toast({
        title: "Enviado ao Google Drive",
        description: `Checklist salvo em Dossiê -> 2. Operacional com sucesso.`
      });
    } catch (err: any) {
      toast({
        title: "Erro ao enviar ao Drive",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Pendências de Vistoria de Retorno */}
      {pendencias.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5 overflow-hidden animate-in fade-in duration-300">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h4 className="text-sm font-bold text-destructive uppercase tracking-wider">
                Existem {pendencias.length} pendências de Checklist de Devolução!
              </h4>
              <p className="text-xs text-muted-foreground">
                Equipamentos foram marcados como desmobilizados em contratos ativos, mas ainda não possuem laudo de inspeção de devolução preenchido.
              </p>
              <div className="divide-y divide-destructive/10 max-h-[150px] overflow-y-auto scrollbar-thin pt-1">
                {pendencias.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-semibold text-foreground">
                      {p.equipamento} — <span className="text-muted-foreground">Cliente: {p.cliente} (Devolvido em {new Date(p.data_devolucao + "T00:00:00").toLocaleDateString("pt-BR")})</span>
                    </span>
                    <Button size="sm" variant="destructive" onClick={() => handleOpenAdd(p.contrato_id, p.equipamento_id, "Devolução")} className="h-7 text-[10px] font-bold uppercase tracking-wider">
                      Fazer Checklist
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros e Cadastro */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por máquina, placa ou inspetor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/60 rounded-xl"
          />
        </div>
        <Button onClick={() => handleOpenAdd()} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl gap-2 w-full sm:w-auto font-bold uppercase tracking-wider text-xs py-2">
          <Plus className="h-4 w-4" />
          Fazer Vistoria
        </Button>
      </div>

      {/* Listagem de Checklists */}
      <Card className="glass border-border/40 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground text-sm">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              Carregando histórico de vistorias...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-sm">
              Nenhum checklist de vistoria registrado no período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Equipamento</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Tipo</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Data Vistoria</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Inspetor</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Cliente/Contrato</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Horímetro</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => (
                    <TableRow key={item.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-bold text-xs text-foreground">
                        {item.equipamentos?.tipo || "Desconhecido"} {item.equipamentos?.tag_placa ? `(${item.equipamentos.tag_placa})` : ""}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className={`text-[9px] font-bold uppercase py-0.5 px-2 border-0 text-white ${
                          item.tipo === "Entrega" ? "bg-info" : "bg-warning"
                        }`}>
                          {item.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {item.inspector}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground truncate max-w-[200px]" title={item.contratos?.empresas?.nome || "Venda Avulsa / Sem Contrato"}>
                        {item.contratos?.empresas?.nome || "Venda Avulsa / Sem Contrato"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-foreground">
                        {Number(item.horimetro || 0).toLocaleString("pt-BR")} h
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[9px] font-bold uppercase py-0.5 px-2 border-0 text-white ${
                          item.status === "Aprovado" ? "bg-success" :
                          item.status === "Com Ressalvas" ? "bg-warning" : "bg-destructive"
                        }`}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 space-x-1 whitespace-nowrap">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleDownloadPDF(item)} title="Baixar Laudo / PDF">
                          <FileDown className="h-4 w-4" />
                        </Button>
                        {item.contrato_id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-accent"
                            onClick={() => handleUploadToGDrive(item)}
                            disabled={syncingId === item.id}
                            title="Salvar no Google Drive"
                          >
                            {syncingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UploadCloud className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)} title="Excluir Registro">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Formulário Checklist */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-accent" />
              Preenchimento de Laudo de Vistoria
            </DialogTitle>
            <DialogDescription>
              Preencha os testes físicos e fotografe o estado geral da máquina.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Equipamento</Label>
                <Select value={form.equipamento_id} onValueChange={val => setForm(p => ({ ...p, equipamento_id: val }))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {equipamentos.map(eq => (
                      <SelectItem key={eq.id} value={eq.id}>{eq.tipo} {eq.modelo} ({eq.tag_placa || "Sem Placa"})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Contrato Vinculado</Label>
                <Select value={form.contrato_id} onValueChange={val => setForm(p => ({ ...p, contrato_id: val }))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum Contrato (Venda/Vistoria Avulsa)</SelectItem>
                    {contratos.filter(c => c.status === "Ativo").map(c => (
                      <SelectItem key={c.id} value={c.id}>Contrato com {c.empresas?.nome || "Desconhecido"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Tipo de Vistoria</Label>
                <Select value={form.tipo} onValueChange={val => setForm(p => ({ ...p, tipo: val }))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entrega">Checklist de Entrega (Mobilização)</SelectItem>
                    <SelectItem value="Devolução">Checklist de Devolução (Desmobilização)</SelectItem>
                    <SelectItem value="Visita Técnica">Visita Técnica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Inspetor Responsável</Label>
                <Input placeholder="Nome completo do vistoriador" value={form.inspector} onChange={e => setForm(p => ({ ...p, inspector: e.target.value }))} className="bg-background" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} className="bg-background" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Horímetro Atual (h)</Label>
                <Input type="number" value={form.horimetro || ""} onChange={e => setForm(p => ({ ...p, horimetro: Number(e.target.value || 0) }))} className="bg-background" />
              </div>
            </div>

            {/* Checklist de Itens */}
            <div className="p-4 bg-muted/20 border border-border/40 rounded-xl space-y-4">
              <p className="text-xs font-bold text-accent uppercase tracking-wider">Itens de Verificação Técnica</p>
              <div className="space-y-4">
                {checklistItemsTemplate.map(item => {
                  const val = form.itens[item.id] || { conforme: true, observacao: "", fotoUrl: null };
                  return (
                    <Card key={item.id} className={`border p-3 transition-colors ${!val.conforme ? 'bg-destructive/5 border-destructive/30' : 'bg-background'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-sm font-semibold text-foreground flex-1">{item.label}</Label>
                        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg shrink-0">
                          <Button
                            size="sm"
                            variant={val.conforme ? "default" : "ghost"}
                            className={`h-7 px-3 text-xs ${val.conforme ? 'bg-success hover:bg-success/90 text-white' : 'text-muted-foreground'}`}
                            onClick={() => setForm(p => ({ ...p, itens: { ...p.itens, [item.id]: { ...val, conforme: true } } }))}
                          >
                            <Check className="h-3 w-3 mr-1" /> Sim
                          </Button>
                          <Button
                            size="sm"
                            variant={!val.conforme ? "default" : "ghost"}
                            className={`h-7 px-3 text-xs ${!val.conforme ? 'bg-destructive hover:bg-destructive/90 text-white' : 'text-muted-foreground'}`}
                            onClick={() => setForm(p => ({ ...p, itens: { ...p.itens, [item.id]: { ...val, conforme: false } } }))}
                          >
                            <X className="h-3 w-3 mr-1" /> Não
                          </Button>
                        </div>
                      </div>
                      
                      {!val.conforme && (
                        <div className="mt-3 space-y-3 pt-3 border-t border-destructive/10 animate-in slide-in-from-top-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-destructive uppercase">Observação da Avaria</Label>
                            <Input 
                              placeholder="Descreva o problema encontrado..." 
                              value={val.observacao || ""} 
                              onChange={e => setForm(p => ({ ...p, itens: { ...p.itens, [item.id]: { ...val, observacao: e.target.value } } }))}
                              className="bg-background border-destructive/20 focus-visible:ring-destructive"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-destructive uppercase">Foto da Avaria</Label>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                className="w-full relative border-dashed border-destructive/30 hover:bg-destructive/5 text-destructive"
                              >
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="environment" 
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                  onChange={e => {
                                    const file = e.target.files?.[0] || null;
                                    setForm(p => ({ ...p, itens: { ...p.itens, [item.id]: { ...val, fotoFile: file } } }));
                                  }}
                                />
                                <Camera className="h-4 w-4 mr-2" />
                                {val.fotoFile ? 'Trocar Foto' : 'Tirar Foto'}
                              </Button>
                              {val.fotoFile && (
                                <Badge variant="outline" className="bg-success/10 text-success border-success/20 shrink-0">
                                  <Check className="h-3 w-3 mr-1" /> Anexada
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Fotos Obrigatórias */}
            <div className="p-4 bg-muted/20 border border-border/40 rounded-xl space-y-4">
              <p className="text-xs font-bold text-accent uppercase tracking-wider">Fotos Obrigatórias Gerais</p>
              <div className="grid grid-cols-2 gap-3">
                {requiredPhotosTemplate.map(photo => {
                  const pVal = form.fotosGerais?.[photo.id] || { fotoUrl: null };
                  return (
                    <div key={photo.id} className="space-y-1.5 p-3 border rounded-lg bg-background text-center">
                      <Label className="text-xs font-bold text-muted-foreground uppercase truncate w-full block" title={photo.label}>{photo.label}</Label>
                      <Button 
                        variant={pVal.fotoFile ? "default" : "outline"} 
                        className={`w-full relative h-12 border-dashed ${pVal.fotoFile ? 'bg-success hover:bg-success/90 border-success/50 text-white' : 'border-border/50 text-muted-foreground'}`}
                      >
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment" 
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          onChange={e => {
                            const file = e.target.files?.[0] || null;
                            setForm(p => ({ ...p, fotosGerais: { ...(p.fotosGerais || {}), [photo.id]: { ...pVal, fotoFile: file } } }));
                          }}
                        />
                        {pVal.fotoFile ? (
                          <><Check className="h-4 w-4 shrink-0 mr-1" /> <span className="truncate">Capturada</span></>
                        ) : (
                          <><ImageIcon className="h-4 w-4 shrink-0 mr-1" /> <span className="truncate">Adicionar</span></>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Notas e Observações</Label>
                <Textarea placeholder="Indique avarias, peças em falta ou ressalvas da vistoria..." value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} className="bg-background" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Situação Final da Máquina</Label>
                <Select value={form.status} onValueChange={val => setForm(p => ({ ...p, status: val }))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aprovado">Aprovado (Operacional)</SelectItem>
                    <SelectItem value="Com Ressalvas">Aprovado com Ressalvas</SelectItem>
                    <SelectItem value="Reprovado">Reprovado (Em Manutenção)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl" disabled={uploading}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl" disabled={uploading}>
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando & Enviando Fotos...</>
              ) : (
                "Salvar Vistoria"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
