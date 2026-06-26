import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, Clock, Camera, Loader2, ChevronRight, ChevronLeft, ClipboardCheck } from "lucide-react";
import { checklistItemsTemplate, requiredPhotosTemplate } from "@/components/ChecklistsTab";

// Reuse compression from ChecklistsTab
const compressImage = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 900;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

interface TokenData {
  id: string;
  token: string;
  tipo: string;
  expires_at: string;
  used: boolean;
  contrato_id: string | null;
  equipamento_id: string;
  equipamento?: { tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null };
  contrato?: { empresas?: { nome: string } | null } | null;
}

type Step = "info" | "itens" | "fotos" | "review" | "done" | "invalid";

const getDefaultItens = () =>
  checklistItemsTemplate.reduce((acc, item) => {
    acc[item.id] = { conforme: true, observacao: "", fotoBase64: null };
    return acc;
  }, {} as Record<string, any>);

const getDefaultFotos = () =>
  requiredPhotosTemplate.reduce((acc, photo) => {
    acc[photo.id] = { fotoBase64: null };
    return acc;
  }, {} as Record<string, any>);

export default function VistoriaPublica() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("info");
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [inspector, setInspector] = useState("");
  const [horimetro, setHorimetro] = useState(0);
  const [status, setStatus] = useState("Aprovado");
  const [notas, setNotas] = useState("");
  const [itens, setItens] = useState<Record<string, any>>(getDefaultItens());
  const [fotos, setFotos] = useState<Record<string, any>>(getDefaultFotos());
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const fetchToken = async () => {
      if (!token) { setStep("invalid"); setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from("checklist_tokens")
          .select(`
            *,
            equipamento:equipamentos(tipo, modelo, tag_placa, numero_serie),
            contrato:contratos(empresas(nome))
          `)
          .eq("token", token)
          .single();

        if (error || !data) { setStep("invalid"); setLoading(false); return; }

        if (data.used) { setStep("done"); setLoading(false); return; }

        if (new Date(data.expires_at) < new Date()) {
          setStep("invalid"); setLoading(false); return;
        }

        setTokenData(data as TokenData);
        setStep("info");
      } catch {
        setStep("invalid");
      }
      setLoading(false);
    };
    fetchToken();
  }, [token]);

  const handlePhotoCapture = useCallback(async (
    file: File,
    section: "itens" | "fotos",
    key: string
  ) => {
    setUploadingPhoto(true);
    try {
      const b64 = await compressImage(file);
      if (section === "itens") {
        setItens(prev => ({ ...prev, [key]: { ...prev[key], fotoBase64: b64 } }));
      } else {
        setFotos(prev => ({ ...prev, [key]: { fotoBase64: b64 } }));
      }
    } finally {
      setUploadingPhoto(false);
    }
  }, []);

  const handleSubmit = async () => {
    if (!tokenData) return;
    if (!inspector.trim()) {
      alert("Por favor, informe seu nome completo.");
      return;
    }
    setSubmitting(true);
    try {
      const payloadItens = { ...itens, __fotos_gerais: fotos };

      const payload = {
        contrato_id: tokenData.contrato_id,
        equipamento_id: tokenData.equipamento_id,
        tipo: tokenData.tipo,
        data: new Date().toISOString().slice(0, 10),
        horimetro: Number(horimetro || 0),
        inspector,
        status,
        itens: payloadItens,
        notas,
      };

      const { data: inserted, error } = await supabase
        .from("checklists")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // Mark token as used
      await supabase
        .from("checklist_tokens")
        .update({ used: true, used_at: new Date().toISOString(), checklist_id: inserted.id })
        .eq("token", token!);

      setStep("done");
    } catch (e: any) {
      alert("Erro ao enviar: " + e.message);
    }
    setSubmitting(false);
  };

  // ---- RENDER STATES ----
  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
    </div>
  );

  if (step === "invalid") return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-16 w-16 text-red-400" />
      <h1 className="text-2xl font-bold text-white">Link Inválido ou Expirado</h1>
      <p className="text-slate-400 max-w-sm">Este link de vistoria não é mais válido. Ele pode ter expirado ou já ter sido utilizado. Entre em contato com o responsável para obter um novo link.</p>
    </div>
  );

  if (step === "done") return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="h-24 w-24 rounded-full bg-green-500/20 flex items-center justify-center">
        <CheckCircle2 className="h-12 w-12 text-green-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">Vistoria Enviada!</h1>
      <p className="text-slate-400 max-w-sm">O laudo de vistoria foi registrado com sucesso no sistema. Você pode fechar esta aba.</p>
      <div className="mt-4 p-4 rounded-xl bg-slate-800 text-left text-sm text-slate-300">
        <p>📋 Tipo: <strong className="text-white">{tokenData?.tipo}</strong></p>
        <p className="mt-1">🚧 Equipamento: <strong className="text-white">{tokenData?.equipamento?.tipo} {tokenData?.equipamento?.tag_placa ? `(${tokenData.equipamento.tag_placa})` : ""}</strong></p>
        {tokenData?.contrato?.empresas?.nome && <p className="mt-1">🏢 Cliente: <strong className="text-white">{tokenData.contrato.empresas.nome}</strong></p>}
      </div>
    </div>
  );

  const eq = tokenData?.equipamento;
  const empresa = tokenData?.contrato?.empresas?.nome;
  const expiresDate = tokenData ? new Date(tokenData.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

  const nonConformes = Object.entries(itens).filter(([, v]) => !v.conforme).length;

  return (
    <div className="min-h-screen bg-slate-900 pb-10">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <ClipboardCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-white text-sm leading-tight">Laudo de Vistoria – {tokenData?.tipo}</h1>
          <p className="text-xs text-slate-400">{eq?.tipo} {eq?.tag_placa ? `• ${eq.tag_placa}` : ""} {empresa ? `• ${empresa}` : ""}</p>
        </div>
        <div className="ml-auto text-right">
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px]">
            <Clock className="h-3 w-3 mr-1" /> Expira {expiresDate}
          </Badge>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 px-4 pt-4">
        {(["info", "itens", "fotos", "review"] as Step[]).map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${step === s || (["done"].includes(step) && i < 4) ? "bg-blue-500" : i < ["info","itens","fotos","review"].indexOf(step) ? "bg-green-500" : "bg-slate-700"}`} />
        ))}
      </div>

      <div className="px-4 pt-5 max-w-lg mx-auto space-y-4">

        {/* STEP 1: Informações básicas */}
        {step === "info" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Suas Informações</h2>
              <p className="text-sm text-slate-400">Informe quem está realizando a vistoria.</p>
            </div>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-slate-300 text-sm">Nome completo do inspetor *</Label>
                  <Input
                    value={inspector}
                    onChange={e => setInspector(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="mt-1.5 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">Horímetro atual (horas)</Label>
                  <Input
                    type="number"
                    value={horimetro || ""}
                    onChange={e => setHorimetro(Number(e.target.value))}
                    placeholder="0"
                    className="mt-1.5 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">Status geral da máquina</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="mt-1.5 bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aprovado">✅ Aprovado (Operacional)</SelectItem>
                      <SelectItem value="Com Ressalvas">⚠️ Aprovado com Ressalvas</SelectItem>
                      <SelectItem value="Reprovado">❌ Reprovado (Em Manutenção)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => { if (!inspector.trim()) { alert("Informe seu nome."); return; } setStep("itens"); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP 2: Itens de inspeção */}
        {step === "itens" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Itens de Inspeção</h2>
              <p className="text-sm text-slate-400">Marque os itens não conformes. Conforme = ✅ por padrão.</p>
            </div>

            <div className="space-y-2">
              {checklistItemsTemplate.map(item => {
                const val = itens[item.id] || { conforme: true, observacao: "" };
                return (
                  <Card key={item.id} className={`border transition-colors ${val.conforme ? "bg-slate-800 border-slate-700" : "bg-red-950/40 border-red-700/40"}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={val.conforme}
                          onCheckedChange={(checked) => setItens(prev => ({ ...prev, [item.id]: { ...prev[item.id], conforme: !!checked } }))}
                          className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 border-slate-500 h-5 w-5"
                        />
                        <span className={`text-sm flex-1 ${val.conforme ? "text-slate-200" : "text-red-300 font-medium"}`}>{item.label}</span>
                        {!val.conforme && <Badge variant="outline" className="border-red-500/40 text-red-400 text-[10px]">Não conforme</Badge>}
                      </div>
                      {!val.conforme && (
                        <div className="mt-2 pl-8">
                          <Input
                            placeholder="Descreva o problema..."
                            value={val.observacao || ""}
                            onChange={e => setItens(prev => ({ ...prev, [item.id]: { ...prev[item.id], observacao: e.target.value } }))}
                            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 text-sm h-8"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {nonConformes > 0 && (
              <div className="p-3 rounded-xl bg-amber-900/30 border border-amber-700/40 text-amber-300 text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {nonConformes} item(ns) não conforme(s) registrado(s).
              </div>
            )}

            <div>
              <Label className="text-slate-300 text-sm">Observações gerais (opcional)</Label>
              <Textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Alguma observação adicional sobre a vistoria..."
                className="mt-1.5 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 min-h-[80px]"
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep("info")} variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700">
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep("fotos")} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
                Fotos <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Fotos */}
        {step === "fotos" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Registro Fotográfico</h2>
              <p className="text-sm text-slate-400">Fotografe cada ângulo da máquina. Toque em cada cartão para abrir a câmera.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {requiredPhotosTemplate.map(photo => {
                const val = fotos[photo.id] || {};
                return (
                  <label key={photo.id} className="cursor-pointer">
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoCapture(f, "fotos", photo.id); }} />
                    <div className={`aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all overflow-hidden relative ${val.fotoBase64 ? "border-green-500/50" : "border-slate-600 hover:border-blue-500/60 bg-slate-800"}`}>
                      {val.fotoBase64 ? (
                        <>
                          <img src={val.fotoBase64} className="absolute inset-0 w-full h-full object-cover rounded-xl" alt={photo.label} />
                          <div className="absolute top-1.5 right-1.5 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 text-center text-[10px] text-white font-medium">{photo.label}</div>
                        </>
                      ) : (
                        <>
                          <Camera className="h-6 w-6 text-slate-500" />
                          <span className="text-[11px] text-slate-400 text-center px-2">{photo.label}</span>
                        </>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {uploadingPhoto && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Processando foto...
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setStep("itens")} variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700">
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep("review")} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
                Revisar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Revisão final */}
        {step === "review" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Revisão Final</h2>
              <p className="text-sm text-slate-400">Confirme os dados antes de enviar.</p>
            </div>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Inspetor</span>
                  <span className="text-white font-medium">{inspector}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Tipo de Vistoria</span>
                  <span className="text-white font-medium">{tokenData?.tipo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Equipamento</span>
                  <span className="text-white font-medium">{eq?.tipo} {eq?.tag_placa ? `(${eq.tag_placa})` : ""}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Horímetro</span>
                  <span className="text-white font-medium">{Number(horimetro).toLocaleString("pt-BR")} h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Status</span>
                  <Badge className={`text-[10px] ${status === "Aprovado" ? "bg-green-600" : status === "Com Ressalvas" ? "bg-amber-600" : "bg-red-600"}`}>
                    {status}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Itens não conformes</span>
                  <span className={`font-bold ${nonConformes > 0 ? "text-red-400" : "text-green-400"}`}>{nonConformes}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Fotos tiradas</span>
                  <span className="text-white font-medium">{Object.values(fotos).filter((v: any) => v.fotoBase64).length} / {requiredPhotosTemplate.length}</span>
                </div>
                {notas && (
                  <div className="pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-400">Observações:</p>
                    <p className="text-sm text-slate-200 mt-1">{notas}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={() => setStep("fotos")} variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700">
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl py-3"
              >
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "✅ Enviar Vistoria"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
