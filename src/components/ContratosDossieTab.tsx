import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Folder, FolderOpen, FileText, Upload, Download, Trash2, Shield,
  RefreshCw, AlertTriangle, ExternalLink, Key, HelpCircle, Check, Loader2, ChevronRight
} from "lucide-react";
import {
  gdriveLoadClient, gdriveCreateFolder, gdriveUploadFile, gdriveListFiles, gdriveDeleteFile, GDriveFile
} from "@/lib/gdrive";
import { isAfterDec2025 } from "@/lib/utils";


interface Empresa {
  id: string;
  nome: string;
}

interface Contrato {
  id: string;
  empresa_id: string;
  gdrive_folder_id: string | null;
  status: string;
  empresas?: Empresa | null;
  created_at: string;
}

interface GDriveConfig {
  id?: string;
  client_id: string;
  root_folder_id: string | null;
}

export const ContratosDossieTab = () => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [selectedContratoId, setSelectedContratoId] = useState<string>("");
  const [gdriveConfig, setGDriveConfig] = useState<GDriveConfig | null>(null);
  
  // Settings editing state
  const [clientIdInput, setClientIdInput] = useState("");
  const [rootFolderIdInput, setRootFolderIdInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  
  // Connection and files state
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Dossier files state
  const [activeSubfolder, setActiveSubfolder] = useState<"comercial" | "operacional" | "financeiro" | "seguros">("comercial");
  const [subfolderIds, setSubfolderIds] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const selectedContrato = useMemo(() => {
    return contratos.find(c => c.id === selectedContratoId) || null;
  }, [contratos, selectedContratoId]);

  // Load configs and contracts
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [configRes, contractsRes, empresasRes] = await Promise.all([
        supabase.from("gdrive_config").select("*").order("created_at", { ascending: false }),
        supabase.from("contratos").select("*").order("created_at", { ascending: false }),
        supabase.from("empresas").select("id, nome")
      ]);

      const configData = configRes.data && configRes.data.length > 0 ? configRes.data[0] : null;
      if (configData) {
        setGDriveConfig(configData as GDriveConfig);
        setClientIdInput(configData.client_id);
        setRootFolderIdInput(configData.root_folder_id || "");
      } else {
        setShowSettings(true);
      }

      if (contractsRes.data && empresasRes.data) {
        const empMap = new Map(empresasRes.data.map(e => [e.id, e]));
        const mapped = contractsRes.data.map((c: any) => ({
          ...c,
          empresas: empMap.get(c.empresa_id) || null
        }));
        setContratos(mapped as Contrato[]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar dados iniciais:", err.message);
      toast({ title: "Erro", description: "Falha ao ler configurações do banco.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
    // Load google client SDK
    gdriveLoadClient().then(loaded => {
      if (!loaded) {
        console.warn("SDK do Google Identity Services não pôde ser carregado.");
      }
    });

    // Check if token exists and is valid
    const cachedToken = localStorage.getItem("gdrive_access_token");
    const expiresAtStr = localStorage.getItem("gdrive_token_expires_at");
    if (cachedToken && expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr);
      if (expiresAt > Date.now()) {
        setAccessToken(cachedToken);
      } else {
        localStorage.removeItem("gdrive_access_token");
        localStorage.removeItem("gdrive_token_expires_at");
      }
    }
  }, []);

  // Fetch dossier folders and files when contract or subfolder changes
  const fetchDossierFiles = async () => {
    if (!accessToken || !selectedContrato || !selectedContrato.gdrive_folder_id) {
      setFiles([]);
      return;
    }

    setFilesLoading(true);
    try {
      // 1. Get or create subfolder IDs dynamically
      const parentId = selectedContrato.gdrive_folder_id;
      const subfolderNames = {
        comercial: "1. Comercial",
        operacional: "2. Operacional",
        financeiro: "3. Financeiro",
        seguros: "4. Seguros"
      };

      // To avoid listing all subfolders every time, let's list contents of contract parent folder first
      const allSubfolders = await gdriveListFiles(parentId, accessToken);
      
      const ids: Record<string, string> = {};
      const promises = Object.entries(subfolderNames).map(async ([key, name]) => {
        const match = allSubfolders.find(f => f.name === name && f.mimeType === "application/vnd.google-apps.folder");
        if (match) {
          ids[key] = match.id;
        } else {
          // Dynamically create folder if missing
          const newFolder = await gdriveCreateFolder(name, parentId, accessToken);
          ids[key] = newFolder.id;
        }
      });

      await Promise.all(promises);
      setSubfolderIds(ids);

      // 2. Fetch files inside the active subfolder
      const activeFolderId = ids[activeSubfolder];
      if (activeFolderId) {
        const folderFiles = await gdriveListFiles(activeFolderId, accessToken);
        setFiles(folderFiles);
      }
    } catch (err: any) {
      console.error("Erro ao ler arquivos do dossiê:", err);
      toast({ title: "Erro ao ler arquivos", description: err.message, variant: "destructive" });
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    fetchDossierFiles();
  }, [selectedContratoId, activeSubfolder, accessToken]);

  const handleConnect = () => {
    if (!gdriveConfig || !gdriveConfig.client_id) {
      toast({ title: "Configuração pendente", description: "Informe o Client ID primeiro.", variant: "destructive" });
      return;
    }

    try {
      const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: gdriveConfig.client_id,
        scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive",
        callback: (response: any) => {
          if (response?.access_token) {
            setAccessToken(response.access_token);
            localStorage.setItem("gdrive_access_token", response.access_token);
            const expiresAt = Date.now() + response.expires_in * 1000;
            localStorage.setItem("gdrive_token_expires_at", expiresAt.toString());
            toast({ title: "Conectado!", description: "Google Drive conectado com sucesso." });
          } else {
            toast({ title: "Falha na conexão", description: "Permissão negada pelo usuário.", variant: "destructive" });
          }
        },
      });

      if (client) {
        client.requestAccessToken();
      } else {
        toast({ title: "Erro", description: "Google Identity Client não inicializado.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro na autenticação", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveConfig = async () => {
    if (!clientIdInput.trim()) {
      toast({ title: "Erro", description: "O ID do Cliente (Client ID) é obrigatório.", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        client_id: clientIdInput.trim(),
        root_folder_id: rootFolderIdInput.trim() || null
      };

      if (gdriveConfig?.id) {
        const { error } = await supabase.from("gdrive_config").update(payload).eq("id", gdriveConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("gdrive_config").insert(payload);
        if (error) throw error;
      }

      toast({ title: "Configurações salvas", description: "Integração do Google Drive atualizada." });
      fetchInitialData();
      setShowSettings(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const [syncingBulk, setSyncingBulk] = useState(false);

  const handleBulkSync = async () => {
    if (!accessToken || !selectedContrato) return;
    setSyncingBulk(true);
    toast({ title: "Sincronização em Lote", description: "Iniciando verificação de arquivos no banco..." });

    try {
      let uploadCount = 0;
      const folderId = selectedContrato.gdrive_folder_id;
      if (!folderId) throw new Error("Pasta do Dossiê não configurada.");

      // Fetch all subfolders first
      const { gdriveListFiles, gdriveCreateFolder, gdriveUploadFile } = await import("@/lib/gdrive");
      const subfolders = await gdriveListFiles(folderId, accessToken);
      
      const getFolderId = async (name: string) => {
        let matched = subfolders.find(f => f.name === name && f.mimeType === "application/vnd.google-apps.folder");
        if (matched) return matched.id;
        const newFolder = await gdriveCreateFolder(name, folderId, accessToken);
        return newFolder.id;
      };

      const [comFolderId, opFolderId, finFolderId, segFolderId] = await Promise.all([
        getFolderId("1. Contratos"),
        getFolderId("2. Operacional"),
        getFolderId("3. Financeiro"),
        getFolderId("4. Seguros")
      ]);

      // 1. SYNC CHECKLISTS
      const { data: chkData } = await supabase
        .from("checklists")
        .select("*")
        .eq("contrato_id", selectedContrato.id);
      
      if (chkData && chkData.length > 0) {
        // Fetch equipment list
        const { data: eqData } = await supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie");
        const eqMap = new Map((eqData || []).map(e => [e.id, e]));

        const { exportChecklistToPDF } = await import("@/lib/checklistExportUtils");
        const existingOps = await gdriveListFiles(opFolderId, accessToken);
        for (const item of chkData) {
          if (!isAfterDec2025(item.data_checklist)) continue;
          const eq = eqMap.get(item.equipamento_id);
          if (eq) {
            const filename = `Checklist_${item.tipo}_${eq.tag_placa || "Equipamento"}_${item.id.slice(0, 5)}.pdf`;
            if (existingOps.some(f => f.name === filename)) continue;
            const doc = await exportChecklistToPDF(item, eq, selectedContrato);
            const blob = doc.output("blob");
            await gdriveUploadFile(blob, filename, opFolderId, accessToken);
            uploadCount++;
          }
        }
      }

      // 2. SYNC COMODATOS
      // Get all equipments in this contract
      const { data: ceData } = await supabase
        .from("contratos_equipamentos")
        .select("equipamento_id")
        .eq("contrato_id", selectedContrato.id);
      
      const equipIds = (ceData || []).map(ce => ce.equipamento_id);
      if (equipIds.length > 0) {
        // Fetch comodatos for these equipments
        const { data: comoData } = await supabase
          .from("comodatos")
          .select("*")
          .in("equipamento_id", equipIds);
        
        if (comoData && comoData.length > 0) {
          const { data: eqData } = await supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie");
          const eqMap = new Map((eqData || []).map(e => [e.id, e]));

          const { exportComodatoToPDF } = await import("@/lib/comodatoExportUtils");
          const existingComs = await gdriveListFiles(comFolderId, accessToken);
          for (const item of comoData) {
            if (!isAfterDec2025(item.data_emissao)) continue;
            const eq = eqMap.get(item.equipamento_id);
            if (eq) {
              const filename = `Comodato_${eq.tag_placa || "Equipamento"}_${item.id.slice(0, 5)}.pdf`;
              if (existingComs.some(f => f.name === filename)) continue;
              const doc = await exportComodatoToPDF(item, eq);
              const blob = doc.output("blob");
              await gdriveUploadFile(blob, filename, comFolderId, accessToken);
              uploadCount++;
            }
          }
        }

        // 3. SYNC POLICIES (APÓLICES)
        const { data: apolicesData } = await supabase
          .from("apolices_equipamentos")
          .select(`
            apolice_id,
            apolices:apolice_id (*)
          `)
          .in("equipamento_id", equipIds);
        
        const uniqueApolices = Array.from(new Map((apolicesData || []).map((x: any) => [x.apolice_id, x.apolices])).values())
          .filter((a: any) => a && a.arquivo_base64 && a.arquivo_nome);
        
        const existingSegs = await gdriveListFiles(segFolderId, accessToken);
        for (const item of uniqueApolices) {
          if (!isAfterDec2025(item.vigencia_inicio)) continue;
          if (existingSegs.some(f => f.name === item.arquivo_nome)) continue;
          const base64Content = item.arquivo_base64.split(",")[1] || item.arquivo_base64;
          const byteCharacters = atob(base64Content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          let mimeType = "application/pdf";
          if (item.arquivo_nome.endsWith(".png")) mimeType = "image/png";
          else if (item.arquivo_nome.endsWith(".jpg") || item.arquivo_nome.endsWith(".jpeg")) mimeType = "image/jpeg";
          const blob = new Blob([byteArray], { type: mimeType });

          await gdriveUploadFile(blob, item.arquivo_nome, segFolderId, accessToken);
          uploadCount++;
        }
      }

      // 4. SYNC FATURAS (MEASUREMENTS / BILLINGS)
      const { data: faturaData } = await supabase
        .from("faturamento")
        .select("*")
        .eq("contrato_id", selectedContrato.id);
      
      if (faturaData && faturaData.length > 0) {
        // Fetch companies list for invoice layout
        const { data: empData } = await supabase.from("empresas").select("*");
        const { exportDetailedFaturamentoPDF } = await import("@/lib/faturamentoExportUtils");
        const existingFins = await gdriveListFiles(finFolderId, accessToken);

        for (const item of faturaData) {
          if (!isAfterDec2025(item.emissao || item.periodo_inicio)) continue;
          const filename = `Boletim_Medicao_${item.id.slice(0, 5)}_${new Date().toISOString().slice(0, 10)}.pdf`;
          if (existingFins.some(f => f.name === filename)) continue;
          const fullRecord = { ...item, contratos: selectedContrato };
          const doc = await exportDetailedFaturamentoPDF([fullRecord], empData || []);
          const blob = doc.output("blob");
          await gdriveUploadFile(blob, filename, finFolderId, accessToken);
          uploadCount++;
        }
      }

      toast({
        title: "Sincronização concluída",
        description: `Sucesso! ${uploadCount} arquivos existentes foram copiados para o Google Drive.`
      });
      fetchDossierFiles();
    } catch (err: any) {
      console.error("Erro na sincronização em lote:", err);
      toast({
        title: "Erro na sincronização",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSyncingBulk(false);
    }
  };

  // Automated creation of dossier folders hierarchy
  const handleCreateDossierFolder = async () => {
    if (!accessToken || !selectedContrato) return;
    
    setCreatingFolder(true);


    try {
      let rootId = gdriveConfig?.root_folder_id;
      
      // 1. Create root folder if not specified
      if (!rootId) {
        toast({ title: "Criando pasta raiz...", description: "Gerando pasta 'Dossiê Busato Locações' no seu Drive." });
        const rootFolder = await gdriveCreateFolder("Dossiê Busato Locações", null, accessToken);
        rootId = rootFolder.id;
        
        // Save to DB
        if (gdriveConfig?.id) {
          await supabase.from("gdrive_config").update({ root_folder_id: rootId }).eq("id", gdriveConfig.id);
        } else {
          await supabase.from("gdrive_config").insert({ client_id: clientIdInput, root_folder_id: rootId });
        }
        
        setGDriveConfig(prev => prev ? { ...prev, root_folder_id: rootId } : { client_id: clientIdInput, root_folder_id: rootId });
        setRootFolderIdInput(rootId);
      }

      const clientName = selectedContrato.empresas?.nome || "Cliente Avulso";
      const contractLabel = `Contrato - ID ${selectedContrato.id.slice(0, 8)}`;

      // 2. Search or Create Client Folder
      const rootFiles = await gdriveListFiles(rootId, accessToken);
      const clientFolderName = `Cliente - ${clientName}`;
      let clientFolder = rootFiles.find(f => f.name === clientFolderName && f.mimeType === "application/vnd.google-apps.folder");
      
      let clientFolderId = "";
      if (clientFolder) {
        clientFolderId = clientFolder.id;
      } else {
        const newClientFolder = await gdriveCreateFolder(clientFolderName, rootId, accessToken);
        clientFolderId = newClientFolder.id;
      }

      // 3. Create Contract Folder
      const contractFolderName = `${contractLabel}`;
      const contractFolder = await gdriveCreateFolder(contractFolderName, clientFolderId, accessToken);

      // 4. Create subfolders
      const subfolders = ["1. Comercial", "2. Operacional", "3. Financeiro", "4. Seguros"];
      const folderIds: Record<string, string> = {};
      const subpromises = subfolders.map(async (name) => {
        const sf = await gdriveCreateFolder(name, contractFolder.id, accessToken);
        const key = name.split(". ")[1].toLowerCase();
        folderIds[key] = sf.id;
      });
      await Promise.all(subpromises);

      // 5. Update Contract Folder ID in Database
      const { error } = await supabase
        .from("contratos")
        .update({ gdrive_folder_id: contractFolder.id })
        .eq("id", selectedContrato.id);

      if (error) throw error;

      selectedContrato.gdrive_folder_id = contractFolder.id;
      setSubfolderIds(folderIds);
      toast({ title: "Dossiê Iniciado!", description: "Pastas de estrutura criadas no Google Drive com sucesso." });
      
      fetchDossierFiles();
    } catch (err: any) {
      console.error("Erro ao criar dossiê:", err);
      toast({ title: "Erro na criação", description: err.message, variant: "destructive" });
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const folderId = subfolderIds[activeSubfolder];
    
    if (!file || !folderId || !accessToken) return;
    setUploading(true);

    try {
      await gdriveUploadFile(file, file.name, folderId, accessToken);
      toast({ title: "Sucesso!", description: `Arquivo "${file.name}" importado no Dossiê.` });
      fetchDossierFiles();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string, filename: string) => {
    if (!accessToken) return;
    if (!confirm(`Deseja remover o arquivo "${filename}" do Dossiê no Google Drive?`)) return;

    try {
      await gdriveDeleteFile(fileId, accessToken);
      toast({ title: "Sucesso", description: "Arquivo removido do Google Drive." });
      fetchDossierFiles();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const formatSize = (mime: string) => {
    if (mime === "application/vnd.google-apps.folder") return "Pasta";
    if (mime.includes("pdf")) return "Documento PDF";
    if (mime.includes("image")) return "Imagem";
    return "Arquivo";
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="glass border-border/40 shadow-sm relative overflow-hidden">
        <CardHeader className="pb-3 bg-muted/20 border-b border-border/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Folder className="h-4 w-4 text-accent" />
              Gestão de Dossiê no Google Drive
            </CardTitle>
            <CardDescription className="text-xs">
              Mapeie e envie a documentação jurídica, laudos, medições e apólices direto para seu Drive de 5TB.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowSettings(!showSettings)} title="Configurações do Drive">
              <Key className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowSetupGuide(!showSetupGuide)} title="Ajuda / Tutorial">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Integration Config Panel */}
          {showSettings && (
            <div className="p-4 bg-muted/30 border border-border/60 rounded-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Credenciais da API do Google</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Google Client ID</Label>
                  <Input
                    placeholder="Ex: 12345-abcde.apps.googleusercontent.com"
                    value={clientIdInput}
                    onChange={e => setClientIdInput(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">ID da Pasta Raiz (Opcional)</Label>
                  <Input
                    placeholder="Se vazio, criaremos a pasta raiz no seu Drive"
                    value={rootFolderIdInput}
                    onChange={e => setRootFolderIdInput(e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleSaveConfig} className="bg-accent text-accent-foreground font-bold">Salvar Configurações</Button>
              </div>
            </div>
          )}

          {/* Setup Guide */}
          {showSetupGuide && (
            <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Como Configurar o Google Cloud Console:
              </h4>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" className="text-primary hover:underline flex-inline items-center">Google Cloud Console <ExternalLink className="h-3 w-3 inline" /></a>.</li>
                <li>Crie um projeto e ative a **Google Drive API**.</li>
                <li>Na tela de consentimento OAuth, adicione o escopo `.../auth/drive` e `.../auth/drive.file`.</li>
                <li>Em **Credenciais**, crie um **ID do cliente OAuth (Aplicativo Web)**.</li>
                <li>Nas origens JavaScript autorizadas, adicione `http://localhost:8080` (e a URL de produção).</li>
                <li>Copie o ID do cliente gerado e salve nas configurações (ícone de chave).</li>
              </ol>
            </div>
          )}

          {/* Connection Status Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border/40 bg-background/50">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${accessToken ? "bg-success animate-pulse" : "bg-warning"}`} />
              <div>
                <p className="text-xs font-bold text-foreground">
                  {accessToken ? "Google Drive Conectado" : "Conexão com Google Drive Pendente"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {accessToken ? "Sua sessão OAuth2 está ativa e autenticada." : "Clique no botão para autorizar o acesso aos arquivos."}
                </p>
              </div>
            </div>
            <Button
              onClick={handleConnect}
              variant={accessToken ? "outline" : "default"}
              className={accessToken ? "border-border/60" : "bg-accent text-accent-foreground hover:bg-accent/90 font-bold"}
            >
              {accessToken ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" /> Reconectar Conta
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" /> Conectar Google Drive
                </>
              )}
            </Button>
          </div>

          {/* Contract Selector */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-muted-foreground uppercase">Contrato Ativo</Label>
            <Select value={selectedContratoId} onValueChange={setSelectedContratoId}>
              <SelectTrigger className="bg-background border-border/60">
                <SelectValue placeholder="Selecione um contrato comercial para abrir o Dossiê..." />
              </SelectTrigger>
              <SelectContent>
                {contratos.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    Contrato com {c.empresas?.nome || "Desconhecido"} (ID: {c.id.slice(0, 8)}) {c.gdrive_folder_id ? "✓ Dossie Ativo" : "— Sem Dossie"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Dossier File Manager */}
      {selectedContrato && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Subfolders Navigation Panel */}
          <Card className="lg:col-span-1 border-border/40 shadow-sm glass">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Pastas do Dossiê</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1">
              {!selectedContrato.gdrive_folder_id ? (
                <div className="p-4 text-center space-y-3">
                  <p className="text-xs text-muted-foreground">Nenhuma pasta foi criada no Drive para este contrato ainda.</p>
                  <Button
                    onClick={handleCreateDossierFolder}
                    disabled={creatingFolder || !accessToken}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 w-full font-bold text-xs uppercase"
                  >
                    {creatingFolder ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Criando Pastas...
                      </>
                    ) : (
                      <>
                        <Folder className="h-4 w-4 mr-2" />
                        Inicializar Dossiê
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setActiveSubfolder("comercial")}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs font-bold transition-colors ${
                      activeSubfolder === "comercial" ? "bg-accent/10 text-accent" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {activeSubfolder === "comercial" ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                      <span>1. Comercial</span>
                    </div>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setActiveSubfolder("operacional")}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs font-bold transition-colors ${
                      activeSubfolder === "operacional" ? "bg-accent/10 text-accent" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {activeSubfolder === "operacional" ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                      <span>2. Operacional</span>
                    </div>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setActiveSubfolder("financeiro")}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs font-bold transition-colors ${
                      activeSubfolder === "financeiro" ? "bg-accent/10 text-accent" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {activeSubfolder === "financeiro" ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                      <span>3. Financeiro</span>
                    </div>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setActiveSubfolder("seguros")}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs font-bold transition-colors ${
                      activeSubfolder === "seguros" ? "bg-accent/10 text-accent" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {activeSubfolder === "seguros" ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                      <span>4. Seguros</span>
                    </div>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  <div className="pt-4 border-t border-border/40 mt-3 px-1">
                    <Button
                      onClick={handleBulkSync}
                      disabled={syncingBulk || !accessToken}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs font-bold uppercase py-2 border-dashed border-accent/40 text-accent hover:bg-accent/5 flex items-center justify-center gap-1.5"
                    >
                      {syncingBulk ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sincronizar Arquivos do Banco
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Files Explorer Panel */}
          {selectedContrato.gdrive_folder_id && (
            <Card className="lg:col-span-3 border-border/40 shadow-sm glass">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                    <FolderOpen className="h-4 w-4 text-accent" />
                    Arquivos em: {activeSubfolder === "comercial" ? "1. Comercial" : activeSubfolder === "operacional" ? "2. Operacional" : activeSubfolder === "financeiro" ? "3. Financeiro" : "4. Seguros"}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    className="hidden"
                    id="dossie-file-upload"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || !accessToken}
                    size="sm"
                    className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-xs uppercase"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Subir Documento
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filesLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground text-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    Lendo pasta no Google Drive...
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-sm gap-2">
                    <Folder className="h-8 w-8 text-muted-foreground/30" />
                    Nenhum arquivo nesta pasta do Dossiê.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="text-xs font-bold uppercase tracking-wider">Nome do Arquivo</TableHead>
                          <TableHead className="text-xs font-bold uppercase tracking-wider">Formato</TableHead>
                          <TableHead className="text-xs font-bold uppercase tracking-wider">Data de Envio</TableHead>
                          <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {files.map(file => (
                          <TableRow key={file.id} className="hover:bg-muted/10 transition-colors">
                            <TableCell className="font-bold text-xs text-foreground flex items-center gap-2">
                              <FileText className="h-4 w-4 text-accent shrink-0" />
                              <span className="truncate max-w-[300px]" title={file.name}>{file.name}</span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-semibold">
                              {formatSize(file.mimeType)}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-muted-foreground">
                              {new Date(file.createdTime).toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right pr-6 space-x-1 whitespace-nowrap">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => window.open(file.webViewLink, "_blank")}
                                title="Visualizar no Google Drive"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteFile(file.id, file.name)}
                                title="Remover do Dossiê"
                              >
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
          )}
        </div>
      )}
    </div>
  );
};
