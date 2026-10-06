import { useState } from "react";
import { ShieldCheck, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrivacyPolicyContent, TermsContent } from "./PrivacyPolicyContent";
import { acceptCurrentPolicy } from "@/lib/security/lgpd";

interface Props {
  onAccepted: () => void;
  onDecline: () => void;
}

export const ConsentDialog = ({ onAccepted, onDecline }: Props) => {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      await acceptCurrentPolicy();
      onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar aceite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-6 py-5 bg-gradient-to-r from-primary/10 via-accent/10 to-transparent border-b border-border flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Privacidade e Proteção de Dados</h2>
            <p className="text-xs text-muted-foreground">Leia e confirme para continuar usando o sistema (LGPD).</p>
          </div>
        </div>

        <Tabs defaultValue="politica" className="px-6 pt-4">
          <TabsList>
            <TabsTrigger value="politica">Política de Privacidade</TabsTrigger>
            <TabsTrigger value="termos">Termos de Uso</TabsTrigger>
          </TabsList>
          <TabsContent value="politica">
            <ScrollArea className="h-[45vh] pr-4"><PrivacyPolicyContent /></ScrollArea>
          </TabsContent>
          <TabsContent value="termos">
            <ScrollArea className="h-[45vh] pr-4"><TermsContent /></ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="px-6 py-4 border-t border-border space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <Checkbox id="consent-checkbox" checked={checked} onCheckedChange={(v) => setChecked(!!v)} className="mt-0.5" />
            <span className="text-sm">
              Li e estou ciente da Política de Privacidade e concordo com os Termos de Uso, incluindo o tratamento dos
              meus dados conforme descrito.
            </span>
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button id="consent-decline-btn" variant="ghost" onClick={onDecline} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-2" /> Não concordo (sair)
            </Button>
            <Button id="consent-accept-btn" onClick={accept} disabled={!checked || busy} className="bg-primary">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Aceitar e continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
