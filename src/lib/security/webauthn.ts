/**
 * WebAuthn (Passkeys) – biometria no navegador.
 * Windows Hello, Touch ID, Face ID ou digital do celular.
 *
 * A biometria NUNCA sai do aparelho: o autenticador assina um desafio
 * aleatório com uma chave privada guardada no hardware seguro, e nós
 * verificamos a assinatura com a chave pública registrada.
 */

const enc = new TextEncoder();

export const b64urlEncode = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const b64urlDecode = (str: string): Uint8Array => {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const randomChallenge = () => crypto.getRandomValues(new Uint8Array(32));

export const isWebAuthnSupported = (): boolean =>
  typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials && window.isSecureContext;

export const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

export interface RegisteredCredential {
  credentialId: string;
  publicKey: string; // SPKI base64url
  algorithm: number;
}

/** Cadastra a biometria deste aparelho para o usuário. */
export const registerPlatformCredential = async (
  userId: string,
  userName: string,
  displayName: string
): Promise<RegisteredCredential> => {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: "Busato Locações", id: window.location.hostname },
      user: { id: enc.encode(userId), name: userName, displayName },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256 (Windows Hello)
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Cadastro biométrico cancelado.");
  const response = cred.response as AuthenticatorAttestationResponse;
  const spki = response.getPublicKey?.();
  const alg = response.getPublicKeyAlgorithm?.() ?? -7;
  if (!spki) throw new Error("Este navegador não suporta exportação de chave pública (atualize o navegador).");

  return { credentialId: b64urlEncode(cred.rawId), publicKey: b64urlEncode(spki), algorithm: alg };
};

/** Converte assinatura ECDSA DER -> formato raw (r||s) exigido pelo WebCrypto. */
const derToRaw = (der: Uint8Array): Uint8Array => {
  let offset = 2;
  if (der[1] & 0x80) offset += der[1] & 0x7f;
  const readInt = () => {
    if (der[offset] !== 0x02) throw new Error("Assinatura inválida");
    const len = der[offset + 1];
    let int = der.slice(offset + 2, offset + 2 + len);
    offset += 2 + len;
    while (int.length > 32 && int[0] === 0) int = int.slice(1);
    const out = new Uint8Array(32);
    out.set(int, 32 - int.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
};

const verifySignature = async (
  publicKeyB64: string,
  alg: number,
  data: Uint8Array,
  signature: Uint8Array
): Promise<boolean> => {
  const spki = b64urlDecode(publicKeyB64);
  if (alg === -7) {
    const key = await crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, derToRaw(signature), data);
  }
  if (alg === -257) {
    const key = await crypto.subtle.importKey("spki", spki, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
  }
  throw new Error(`Algoritmo não suportado: ${alg}`);
};

/**
 * Solicita a biometria e valida criptograficamente:
 *  - desafio aleatório (anti-replay)
 *  - origem correta (anti-phishing)
 *  - flag "User Verified" (biometria/PIN realmente confirmados)
 *  - assinatura com a chave pública cadastrada
 */
export const verifyPlatformCredential = async (
  credentials: { credential_id: string; public_key: string; algorithm: number }[]
): Promise<string> => {
  if (credentials.length === 0) throw new Error("Nenhuma biometria cadastrada neste aparelho.");
  const challenge = randomChallenge();

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: credentials.map((c) => ({ type: "public-key" as const, id: b64urlDecode(c.credential_id) })),
      userVerification: "required",
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Verificação cancelada.");
  const response = assertion.response as AuthenticatorAssertionResponse;
  const credId = b64urlEncode(assertion.rawId);
  const stored = credentials.find((c) => c.credential_id === credId);
  if (!stored) throw new Error("Credencial desconhecida.");

  const clientData = JSON.parse(new TextDecoder().decode(response.clientDataJSON));
  if (clientData.type !== "webauthn.get") throw new Error("Tipo de resposta inválido.");
  if (clientData.challenge !== b64urlEncode(challenge)) throw new Error("Desafio inválido.");
  if (clientData.origin !== window.location.origin) throw new Error("Origem inválida.");

  const authData = new Uint8Array(response.authenticatorData);
  const flags = authData[32];
  if (!(flags & 0x01)) throw new Error("Presença do usuário não confirmada.");
  if (!(flags & 0x04)) throw new Error("Biometria não confirmada.");

  const clientHash = new Uint8Array(await crypto.subtle.digest("SHA-256", response.clientDataJSON));
  const signed = new Uint8Array(authData.length + clientHash.length);
  signed.set(authData, 0);
  signed.set(clientHash, authData.length);

  const ok = await verifySignature(stored.public_key, stored.algorithm, signed, new Uint8Array(response.signature));
  if (!ok) throw new Error("Assinatura biométrica inválida.");
  return credId;
};
