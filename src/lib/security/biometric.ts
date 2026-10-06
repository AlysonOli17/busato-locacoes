import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { supabase } from "@/integrations/supabase/client";
import {
  isPlatformAuthenticatorAvailable,
  registerPlatformCredential,
  verifyPlatformCredential,
} from "./webauthn";
import { logAudit } from "./audit";

// Tabelas novas ainda não estão no types.ts gerado
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const deviceKey = (userId: string) => `busato.bio.${userId}`;

export const isNativeApp = () => Capacitor.isNativePlatform();

export interface BiometricDevice {
  id: string;
  credential_id: string;
  public_key: string;
  algorithm: number;
  device_name: string | null;
  platform: string;
  created_at: string;
  last_used_at: string | null;
}

const guessDeviceName = () => {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "macOS" : "Dispositivo";
  const browser = isNativeApp() ? "App Busato" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${browser} • ${os}`;
};

/** O aparelho atual tem biometria disponível? */
export const isBiometricSupported = async (): Promise<boolean> => {
  if (isNativeApp()) {
    try {
      const r = await NativeBiometric.isAvailable({ useFallback: false });
      return r.isAvailable;
    } catch {
      return false;
    }
  }
  return isPlatformAuthenticatorAvailable();
};

/** A biometria está ativada para este usuário NESTE aparelho? */
export const isBiometricEnabledOnDevice = (userId: string) => !!localStorage.getItem(deviceKey(userId));

export const listBiometricDevices = async (userId: string): Promise<BiometricDevice[]> => {
  const { data, error } = await db
    .from("user_biometric_credentials")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

/** Cadastra a biometria do aparelho atual. */
export const enrollBiometric = async (userId: string, email: string, name: string) => {
  let credentialId: string;
  let publicKey: string;
  let algorithm = -7;
  const platform = isNativeApp() ? "android" : "web";

  if (isNativeApp()) {
    await NativeBiometric.verifyIdentity({
      reason: "Ativar acesso por biometria",
      title: "Busato Locações",
      subtitle: "Confirme sua digital ou rosto",
      negativeButtonText: "Cancelar",
    });
    credentialId = `native-${crypto.randomUUID()}`;
    publicKey = "android-keystore";
  } else {
    const reg = await registerPlatformCredential(userId, email, name);
    credentialId = reg.credentialId;
    publicKey = reg.publicKey;
    algorithm = reg.algorithm;
  }

  const { error } = await db.from("user_biometric_credentials").insert({
    user_id: userId,
    credential_id: credentialId,
    public_key: publicKey,
    algorithm,
    device_name: guessDeviceName(),
    platform,
  });
  if (error) throw error;

  localStorage.setItem(deviceKey(userId), credentialId);
  await logAudit("biometric_enroll", "seguranca", `Biometria cadastrada (${guessDeviceName()})`);
};

/** Solicita a biometria. Lança erro se falhar. */
export const verifyBiometric = async (userId: string): Promise<void> => {
  const localCredId = localStorage.getItem(deviceKey(userId));
  if (!localCredId) throw new Error("Biometria não ativada neste aparelho.");

  if (isNativeApp()) {
    await NativeBiometric.verifyIdentity({
      reason: "Desbloquear o Busato Locações",
      title: "Busato Locações",
      subtitle: "Use sua digital ou rosto",
      negativeButtonText: "Usar senha",
      maxAttempts: 3,
    });
  } else {
    const { data, error } = await db
      .from("user_biometric_credentials")
      .select("credential_id, public_key, algorithm")
      .eq("user_id", userId)
      .eq("platform", "web");
    if (error) throw error;
    if (!data?.length) {
      localStorage.removeItem(deviceKey(userId));
      throw new Error("Biometria removida. Faça login com senha.");
    }
    await verifyPlatformCredential(data);
  }

  await db
    .from("user_biometric_credentials")
    .update({ last_used_at: new Date().toISOString() })
    .eq("credential_id", localCredId);
};

export const removeBiometricDevice = async (userId: string, device: BiometricDevice) => {
  const { error } = await db.from("user_biometric_credentials").delete().eq("id", device.id);
  if (error) throw error;
  if (localStorage.getItem(deviceKey(userId)) === device.credential_id) {
    localStorage.removeItem(deviceKey(userId));
  }
  await logAudit("biometric_remove", "seguranca", `Biometria removida (${device.device_name ?? "dispositivo"})`);
};

export const disableBiometricOnDevice = (userId: string) => localStorage.removeItem(deviceKey(userId));
