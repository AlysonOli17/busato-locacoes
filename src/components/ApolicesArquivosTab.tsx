import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, FileText, Upload, Download, Trash2, Shield, Calendar, AlertCircle, UploadCloud } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Equipamento {
  id: string;
  tipo: string;
  modelo: string;
  tag_placa: string | null;
  numero_serie: string | null;
}

interface ApoliceEquipamento {
  id: string;
  equipamento_id: string;
  equipamentos: Equipamento;
}

interface Apolice {
  id: string;
  seguradora: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  valor: number;
  status: string;
  arquivo_base64: string | null;
  arquivo_nome: string | null;
  apolices_equipamentos: ApoliceEquipamento[];
}

export const ApolicesArquivosTab = () => {
  const [apolices, setApolices] = useState<Apolice[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  
  // Upload form state
  const [selectedApoliceId, setSelectedApoliceId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [apolicesRes, equipRes, apolicesEqRes] = await Promise.all([
        supabase.from("apolices").select("*").order("created_at", { ascending: false }),
        supabase.from("equipamentos").select("id, tipo, modelo, tag_placa, numero_serie").order("tipo"),
        supabase.from("apolices_equipamentos").select("*")
      ]);

      if (equipRes.data) {
        setEquipamentos(equipRes.data as Equipamento[]);
        const equipMap = new Map(equipRes.data.map(e => [e.id, e]));

        if (apolicesRes.data) {
          const apolicesEqMap = new Map<string, any[]>();
          (apolicesEqRes.data || []).forEach((ae: any) => {
            const list = apolicesEqMap.get(ae.apolice_id) || [];
            list.push({ ...ae, equipamentos: equipMap.get(ae.equipamento_id) || null });
            apolicesEqMap.set(ae.apolice_id, list);
          });

          const mapped = apolicesRes.data.map((a: any) => ({
            ...a,
            apolices_equipamentos: apolicesEqMap.get(a.id) || []
          }));
          setApolices(mapped as Apolice[]);
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar arquivos de apólices:", err.message);
      toast({ title: "Erro", description: "Falha ao carregar dados do banco.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Filter policies that have files attached
  const apolicesComArquivos = useMemo(() => {
    return apolices.filter(a => a.arquivo_base64 && a.arquivo_nome);
  }, [apolices]);

  // List of policies eligible for upload (either don't have file or we want to update)
  const apolicesDropdownList = useMemo(() => {
    return apolices.map(a => {
      const equipLabels = a.apolices_equipamentos?.map(ae => `${ae.equipamentos?.tipo || ""} ${ae.equipamentos?.modelo || ""}`).join(", ") || "Sem máquina";
      return {
        id: a.id,
        label: `${a.seguradora} - Vigência até ${new Date(a.vigencia_fim + "T00:00:00").toLocaleDateString("pt-BR")} (${equipLabels})`,
        hasFile: !!(a.arquivo_base64 && a.arquivo_nome)
      };
    });
  }, [apolices]);

  const filteredItems = useMemo(() => {
    return apolicesComArquivos.filter(item => {
      const query = search.toLowerCase();
      const seguradora = item.seguradora.toLowerCase();
      const fileName = (item.arquivo_nome || "").toLowerCase();
      const equips = item.apolices_equipamentos?.map(ae => 
        `${ae.equipamentos?.tipo || ""} ${ae.equipamentos?.modelo || ""} ${ae.equipamentos?.tag_placa || ""}`.toLowerCase()
      ).join(" ") || "";

      return seguradora.includes(query) || fileName.includes(query) || equips.includes(query);
    });
  }, [apolicesComArquivos, search]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({ title: "Arquivo muito grande", description: "O limite de tamanho de arquivo é de 10MB.", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedApoliceId) {
      toast({ title: "Campo obrigatório", description: "Selecione uma apólice para associar o documento.", variant: "destructive" });
      return;
    }
    if (!selectedFile || !fileBase64) {
      toast({ title: "Arquivo obrigatório", description: "Selecione um arquivo de apólice assinada.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("apolices")
        .update({
          arquivo_base64: fileBase64,
          arquivo_nome: selectedFile.name
        })
        .eq("id", selectedApoliceId);

      if (error) throw error;

      toast({ title: "Documento Importado", description: `A apólice assinada "${selectedFile.name}" foi importada com sucesso.` });
      
      // Auto GDrive sync if token is active
      const cachedToken = localStorage.getItem("gdrive_access_token");
      const expiresAtStr = localStorage.getItem("gdrive_token_expires_at");
      const isTokenValid = cachedToken && expiresAtStr && parseInt(expiresAtStr) > Date.now();
      if (isTokenValid) {
        const getSavedRecord = async () => {
          const { data } = await supabase.from("apolices").select("*").eq("id", selectedApoliceId).single();
          if (data) {
            toast({ title: "Google Drive", description: "Enviando apólice automaticamente para o Dossiê..." });
            handleUploadToGDrive(data as Apolice);
          }
        };
        getSavedRecord();
      }

      // Reset upload state
      setSelectedApoliceId("");
      setSelectedFile(null);
      setFileBase64("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      fetchAll();
    } catch (err: any) {
      console.error("Erro ao subir apólice:", err.message);
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFile = async (apoliceId: string, filename: string) => {
    if (!confirm(`Tem certeza que deseja remover o arquivo assinado "${filename}"?`)) return;
    try {
      const { error } = await supabase
        .from("apolices")
        .update({
          arquivo_base64: null,
          arquivo_nome: null
        })
        .eq("id", apoliceId);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Arquivo removido da apólice." });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleUploadToGDrive = async (item: Apolice) => {
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

    if (!item.arquivo_base64 || !item.arquivo_nome) return;

    setSyncingId(item.id);
    try {
      // 1. Fetch active contracts associated with the equipments covered by this policy
      const equipIds = item.apolices_equipamentos.map(ae => ae.equipamento_id);
      if (equipIds.length === 0) {
        throw new Error("Esta apólice não possui nenhuma máquina vinculada.");
      }

      const { data: ceData, error: ceErr } = await supabase
        .from("contratos_equipamentos")
        .select(`
          contrato_id,
          contratos:contrato_id (
            id,
            gdrive_folder_id,
            status,
            empresa_id
          )
        `)
        .in("equipamento_id", equipIds);

      if (ceErr) throw ceErr;

      // Filter active contracts with active GDrive folders
      const activeContracts = (ceData || [])
        .map((x: any) => x.contratos)
        .filter((c: any) => c && c.status === "Ativo" && c.gdrive_folder_id);

      if (activeContracts.length === 0) {
        throw new Error("Nenhum contrato ativo e com Dossiê inicializado foi encontrado para as máquinas desta apólice.");
      }

      // 2. Decode base64 to Blob
      const base64Content = item.arquivo_base64.split(",")[1] || item.arquivo_base64;
      const byteCharacters = atob(base64Content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      // Guess mime type from filename
      let mimeType = "application/pdf";
      if (item.arquivo_nome.endsWith(".png")) mimeType = "image/png";
      else if (item.arquivo_nome.endsWith(".jpg") || item.arquivo_nome.endsWith(".jpeg")) mimeType = "image/jpeg";
      
      const blob = new Blob([byteArray], { type: mimeType });

      // 3. Upload to each associated contract folder under "4. Seguros"
      const { gdriveListFiles, gdriveCreateFolder, gdriveUploadFile } = await import("@/lib/gdrive");
      
      let successCount = 0;
      for (const contract of activeContracts) {
        const folderId = contract.gdrive_folder_id;
        const subfolders = await gdriveListFiles(folderId, accessToken);
        let segFolder = subfolders.find(f => f.name === "4. Seguros" && f.mimeType === "application/vnd.google-apps.folder");
        
        let segFolderId = "";
        if (segFolder) {
          segFolderId = segFolder.id;
        } else {
          const newFolder = await gdriveCreateFolder("4. Seguros", folderId, accessToken);
          segFolderId = newFolder.id;
        }

        await gdriveUploadFile(blob, item.arquivo_nome, segFolderId, accessToken);
        successCount++;
      }

      toast({
        title: "Sucesso!",
        description: `Apólice salva em ${successCount} Dossiê(s) de Contratos na pasta "4. Seguros".`
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
      {/* Upload Panel */}
      <Card className="glass border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-muted/20 border-b border-border/40">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Upload className="h-4 w-4 text-accent" />
            Importar Apólice Assinada
          </CardTitle>
          <CardDescription className="text-xs">
            Associe o arquivo PDF ou imagem digitalizada da apólice ao cadastro do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Selecionar Cadastro da Apólice</Label>
              <Select value={selectedApoliceId} onValueChange={setSelectedApoliceId}>
                <SelectTrigger className="bg-background border-border/60">
                  <SelectValue placeholder="Escolha a apólice..." />
                </SelectTrigger>
                <SelectContent>
                  {apolicesDropdownList.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label} {item.hasFile && " (Já possui arquivo)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Arquivo da Apólice (PDF/Imagem)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="bg-background border-border/60 text-xs py-1 cursor-pointer"
                />
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={saving || !selectedApoliceId || !selectedFile}
              className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl font-bold uppercase tracking-wider text-xs py-2 w-full md:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Anexar à Apólice
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por seguradora, máquina ou arquivo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/60 rounded-xl"
          />
        </div>
      </div>

      {/* Attached Documents Table */}
      <Card className="glass border-border/40 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground text-sm">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              Carregando documentos de seguros...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-sm gap-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
              Nenhum documento de apólice assinado importado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Seguradora</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Máquinas Cobertas</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Vigência</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Nome do Arquivo</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => (
                    <TableRow key={item.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-bold text-xs text-foreground">
                        {item.seguradora}
                      </TableCell>
                      <TableCell className="text-xs max-w-[250px] truncate">
                        <div className="flex flex-wrap gap-1">
                          {item.apolices_equipamentos?.map(ae => (
                            <Badge key={ae.id} variant="secondary" className="text-[9px] font-normal py-0 px-1 bg-accent/5 text-accent border border-accent/10">
                              {ae.equipamentos?.tipo} {ae.equipamentos?.modelo}
                            </Badge>
                          )) || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground">
                        De {new Date(item.vigencia_inicio + "T00:00:00").toLocaleDateString("pt-BR")} a {new Date(item.vigencia_fim + "T00:00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-accent shrink-0" />
                          <span className="truncate max-w-[200px]" title={item.arquivo_nome || ""}>{item.arquivo_nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[9px] font-bold uppercase py-0.5 px-2 border-0 text-white ${
                          item.status === "Vigente" ? "bg-success" : "bg-destructive"
                        }`}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 space-x-1 whitespace-nowrap">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleDownload(item)} title="Baixar Documento">
                          <Download className="h-4 w-4" />
                        </Button>
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
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteFile(item.id, item.arquivo_nome || "")} title="Remover Arquivo">
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
    </div>
  );
};
