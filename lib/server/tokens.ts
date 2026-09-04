import { isDemoMode, setting } from "./settings";

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

async function key() {
  const configured = setting("TOKEN_ENCRYPTION_KEY")?.trim();
  const source = configured || (isDemoMode() ? "ruta-clara-demo-encryption-key-change-me" : "");
  if (!source) throw new Error("La clave de cifrado no está configurada.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(source));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function newPublicToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
}

export async function hashToken(token: string) {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}

export async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), encoder.encode(token));
  return { ciphertext: toBase64Url(new Uint8Array(ciphertext)), iv: toBase64Url(iv) };
}

export async function decryptToken(ciphertext: string, iv: string) {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, await key(), fromBase64Url(ciphertext));
  return new TextDecoder().decode(plaintext);
}
