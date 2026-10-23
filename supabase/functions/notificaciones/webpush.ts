// Web Push (RFC 8291 + VAPID RFC 8292) con WebCrypto, sin dependencias:
// cifra el mensaje para el navegador del dueño (su iPhone) y lo firma con
// la llave VAPID de la app.

export interface Suscripcion {
  endpoint: string;
  p256dh: string; // llave pública del navegador (base64url)
  auth: string; // secreto del navegador (base64url)
}

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function deB64url(t: string): Uint8Array {
  const s = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
const unir = (...partes: Uint8Array[]) => {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  partes.forEach((p) => {
    out.set(p, i);
    i += p.length;
  });
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, largo: number): Promise<Uint8Array> {
  const llave = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, llave, largo * 8));
}

// Cuerpo cifrado aes128gcm (un solo registro).
export async function cifrar(sub: Suscripcion, mensaje: string, sal = crypto.getRandomValues(new Uint8Array(16))): Promise<Uint8Array> {
  const uaPublica = deB64url(sub.p256dh);
  const secreto = deB64url(sub.auth);
  const par = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublica = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const uaLlave = await crypto.subtle.importKey("raw", uaPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaLlave }, par.privateKey, 256));
  const ikm = await hkdf(secreto, compartido, unir(enc.encode("WebPush: info\0"), uaPublica, asPublica), 32);
  const cek = await hkdf(sal, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const llave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, llave, unir(enc.encode(mensaje), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return unir(sal, rs, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

// JWT de VAPID firmado con ES256.
export async function jwtVapid(endpoint: string, privadaJwk: JsonWebKey, sub: string): Promise<string> {
  const llave = await crypto.subtle.importKey("jwk", privadaJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const cabeza = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const datos = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub })));
  const firma = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, llave, enc.encode(`${cabeza}.${datos}`)));
  return `${cabeza}.${datos}.${b64url(firma)}`;
}

// Manda un mensaje; regresa el status del servicio de push (201 = enviado;
// 404/410 = esa suscripción ya no existe).
export async function enviarPush(
  sub: Suscripcion,
  mensaje: object,
  vapid: { publica: string; privadaJwk: JsonWebKey; contacto: string }
): Promise<number> {
  const cuerpo = await cifrar(sub, JSON.stringify(mensaje));
  const jwt = await jwtVapid(sub.endpoint, vapid.privadaJwk, vapid.contacto);
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publica}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: cuerpo,
  });
  return r.status;
}
