/**
 * Login FIDO2/WebAuthn — validação Mailcow PHP, sessão portal Nive Mail.
 */

import type { User } from "@/lib/api";
import { api } from "@/lib/api";

const MAILCOW_LOGIN_URL = "/";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return window.btoa(binary);
}

function recursiveBase64StrToArrayBuffer(obj: unknown): void {
  const prefix = "=?BINARY?B?";
  const suffix = "?=";

  if (typeof obj !== "object" || obj === null) return;

  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "string") {
      if (value.startsWith(prefix) && value.endsWith(suffix)) {
        const str = value.slice(prefix.length, -suffix.length);
        const binary = window.atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        (obj as Record<string, unknown>)[key] = bytes.buffer;
      }
    } else {
      recursiveBase64StrToArrayBuffer(value);
    }
  }
}

function supportsWebAuthn(): boolean {
  return typeof window.fetch === "function" && typeof navigator.credentials?.get === "function";
}

/** Extrai username da resposta Mailcow ou cookie após FIDO2. */
async function resolveFido2Subject(): Promise<string> {
  const meRes = await fetch("/api/v1/get/me", { credentials: "include", cache: "no-cache" });
  if (meRes.ok) {
    const me = (await meRes.json()) as { username?: string; email?: string };
    if (me.username) return me.username;
    if (me.email) return me.email;
  }
  return "user@local";
}

export async function loginWithFido2(): Promise<User> {
  if (!supportsWebAuthn()) {
    throw new Error("Seu navegador não suporta FIDO2/WebAuthn.");
  }

  const argsRes = await fetch("/api/v1/get/fido2-get-args", {
    method: "GET",
    cache: "no-cache",
    credentials: "include",
  });
  const argsJson = (await argsRes.json()) as { success?: boolean };
  if (argsJson.success === false) {
    throw new Error("Nenhuma chave FIDO2 registrada ou serviço indisponível.");
  }

  recursiveBase64StrToArrayBuffer(argsJson);
  const cred = (await navigator.credentials.get(argsJson as CredentialRequestOptions)) as PublicKeyCredential | null;
  if (!cred) {
    throw new Error("Autenticação cancelada.");
  }

  const response = cred.response as AuthenticatorAssertionResponse;
  const token = JSON.stringify({
    id: cred.rawId ? arrayBufferToBase64(cred.rawId) : null,
    clientDataJSON: response.clientDataJSON ? arrayBufferToBase64(response.clientDataJSON) : null,
    authenticatorData: response.authenticatorData ? arrayBufferToBase64(response.authenticatorData) : null,
    signature: response.signature ? arrayBufferToBase64(response.signature) : null,
  });

  const formData = new FormData();
  formData.append("token", token);
  formData.append("verify_fido2_login", "true");

  const verifyRes = await fetch(MAILCOW_LOGIN_URL, {
    method: "POST",
    body: formData,
    cache: "no-cache",
    credentials: "include",
  });

  if (!verifyRes.ok && verifyRes.status !== 302) {
    throw new Error("Verificação FIDO2 falhou.");
  }

  const subject = await resolveFido2Subject();
  return api.fido2Session(subject, subject === "admin" ? "admin" : "user");
}
