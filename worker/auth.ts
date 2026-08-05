// Simple shared-password gate. On successful login we issue a signed,
// expiring session cookie (HMAC-SHA256 over "expiry" using SESSION_SECRET) so
// the password itself never has to be re-sent or stored client-side.

export interface AuthEnv {
  SITE_PASSWORD: string;
  SESSION_SECRET: string;
}

const COOKIE_NAME = "armory_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createSessionCookie(env: AuthEnv): Promise<string> {
  const expiry = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${expiry}`;
  const signature = await hmac(env.SESSION_SECRET, payload);
  const value = `${payload}.${signature}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

export async function isAuthenticated(request: Request, env: AuthEnv): Promise<boolean> {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const value = cookies[COOKIE_NAME];
  if (!value) return false;

  const dotIndex = value.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const payload = value.slice(0, dotIndex);
  const signature = value.slice(dotIndex + 1);

  const expected = await hmac(env.SESSION_SECRET, payload);
  if (expected !== signature) return false;

  const expiry = Number(payload);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  return true;
}
