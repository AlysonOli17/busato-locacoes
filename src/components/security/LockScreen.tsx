import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, LogOut, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp, verifyBiometric } from "@/lib/security/biometric";
import logoBusato from "@/assets/logo-busato.png";

interface Props {
  userId: string;
  email: string;
  name?: string;
  biometricEnabled: boolean;
  reason: "idle" | "startup";
  onUnlock: () => void;
  onSignOut: () => void;
}

export const LockScreen = ({ userId, email, name, biometricEnabled, reason, onUnlock, onSignOut }: Props) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(!biometricEnabled);
  const [password, setPassword] = useState("");

  const tryBiometric = async () => {
    setBusy(true);
    setError("");
    try {
      await verifyBiometric(userId);
      onUnlock();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível verificar a biometria.");
      setShowPassword(true);
    } finally {
      setBusy(false);
    }
  };

  const tryPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError("Senha incorreta.");
      return;
    }
    onUnlock();
  };

  // No app nativo o prompt pode abrir automaticamente
  useEffect(() => {
    if (biometricEnabled && isNativeApp()) tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_hsl(220_60%_18%),_hsl(222_47%_6%))]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-pulse [animation-delay:1s]" />
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-8 text-center animate-fade-in">
        <img src={logoBusato} alt="Busato" className="h-10 mx-auto mb-6 brightness-0 invert opacity-90" />

        <div className="relative mx-auto mb-5 h-24 w-24">
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
          <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/40">
            {biometricEnabled ? <Fingerprint className="h-12 w-12 text-white" /> : <ShieldCheck className="h-12 w-12 text-white" />}
          </div>
        </div>

        <h1 className="text-xl font-bold text-white">Sessão protegida</h1>
        <p className="text-sm text-white/60 mt-1">
          {name ? `Olá, ${name.split(" ")[0]}. ` : ""}
          {reason === "idle" ? "Bloqueado por inatividade." : "Confirme sua identidade para continuar."}
        </p>

        {biometricEnabled && (
          <Button
            id="lock-biometric-btn"
            onClick={tryBiometric}
            disabled={busy}
            className="w-full mt-6 h-11 bg-gradient-to-r from-primary to-accent text-white font-semibold hover:opacity-90 transition-all hover:scale-[1.02]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Fingerprint className="h-4 w-4 mr-2" />}
            Desbloquear com biometria
          </Button>
        )}

        {showPassword ? (
          <form onSubmit={tryPassword} className="mt-4 space-y-3 text-left">
            <Input
              id="lock-password-input"
              type="password"
              autoFocus={!biometricEnabled}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              required
            />
            <Button id="lock-password-btn" type="submit" variant="secondary" disabled={busy} className="w-full">
              <KeyRound className="h-4 w-4 mr-2" /> Desbloquear com senha
            </Button>
          </form>
        ) : (
          <button onClick={() => setShowPassword(true)} className="mt-4 text-xs text-white/50 hover:text-white underline-offset-4 hover:underline">
            Usar senha
          </button>
        )}

        {error && <p className="mt-3 text-xs text-red-300 bg-red-500/10 rounded-md p-2">{error}</p>}

        <button
          id="lock-signout-btn"
          onClick={onSignOut}
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-red-300 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair da conta
        </button>
      </div>
    </div>
  );
};
