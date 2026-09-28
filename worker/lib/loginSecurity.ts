// Brute-force protection for the shared-password gate. After MAX_FAILED_ATTEMPTS
// wrong passwords from the same IP, that IP is locked out of further attempts
// until a verification code (emailed to the admin) is entered.

export const MAX_FAILED_ATTEMPTS = 5;
const CODE_TTL_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 5;

export interface LockoutEnv {
  DB: D1Database;
  RESEND_API_KEY: string;
  ALERT_EMAIL: string;
}

interface LockoutRow {
  ip: string;
  failed_attempts: number;
  locked_at: string | null;
  code_hash: string | null;
  code_expires_at: string | null;
  code_sent_at: string | null;
  code_attempts: number;
}

export function getClientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

async function getRow(db: D1Database, ip: string): Promise<LockoutRow | null> {
  return db.prepare("SELECT * FROM login_lockouts WHERE ip = ?").bind(ip).first<LockoutRow>();
}

async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return (bytes[0] % 1_000_000).toString().padStart(6, "0");
}

export async function isLocked(db: D1Database, ip: string): Promise<boolean> {
  const row = await getRow(db, ip);
  return !!row && row.failed_attempts >= MAX_FAILED_ATTEMPTS;
}

export interface FailedAttemptResult {
  locked: boolean;
  remainingAttempts?: number;
}

/** Records a wrong-password attempt. Locks the IP and emails a code once the limit is hit. */
export async function recordFailedAttempt(env: LockoutEnv, ip: string): Promise<FailedAttemptResult> {
  const { DB } = env;

  // Atomic increment (SQLite serializes this at the row level) instead of a
  // read-then-write with a computed value, so concurrent requests for the
  // same IP can't stomp on each other and undercount.
  const incremented = await DB.prepare(
    `INSERT INTO login_lockouts (ip, failed_attempts, updated_at) VALUES (?, 1, datetime('now'))
     ON CONFLICT(ip) DO UPDATE SET failed_attempts = failed_attempts + 1, updated_at = datetime('now')
     RETURNING failed_attempts`,
  )
    .bind(ip)
    .first<{ failed_attempts: number }>();

  const count = incremented?.failed_attempts ?? 1;

  if (count >= MAX_FAILED_ATTEMPTS) {
    // Only the request that first crosses the threshold sends the email —
    // guards against a burst of near-simultaneous requests each re-locking
    // and re-emailing.
    if (count === MAX_FAILED_ATTEMPTS) {
      const code = generateCode();
      const codeHash = await hashCode(code);
      const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

      await DB.prepare(
        "UPDATE login_lockouts SET locked_at = datetime('now'), code_hash = ?, code_expires_at = ?, code_sent_at = datetime('now'), code_attempts = 0, updated_at = datetime('now') WHERE ip = ?",
      )
        .bind(codeHash, expiresAt, ip)
        .run();

      await sendVerificationEmail(env, code, ip);
    }
    return { locked: true };
  }

  return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - count };
}

export async function resetLockout(db: D1Database, ip: string): Promise<void> {
  await db.prepare("DELETE FROM login_lockouts WHERE ip = ?").bind(ip).run();
}

export async function verifyCode(db: D1Database, ip: string, submittedCode: string): Promise<{ ok: boolean; error?: string }> {
  const row = await getRow(db, ip);
  if (!row || row.failed_attempts < MAX_FAILED_ATTEMPTS) {
    return { ok: false, error: "This IP isn't currently locked out." };
  }
  if (!row.code_hash || !row.code_expires_at) {
    return { ok: false, error: "No verification code is pending. Request a new one." };
  }
  if (new Date(row.code_expires_at).getTime() < Date.now()) {
    return { ok: false, error: "That verification code expired. Request a new one." };
  }
  if (row.code_attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect codes. Request a new one." };
  }

  const submittedHash = await hashCode(submittedCode.trim());
  if (submittedHash !== row.code_hash) {
    await db
      .prepare("UPDATE login_lockouts SET code_attempts = code_attempts + 1, updated_at = datetime('now') WHERE ip = ?")
      .bind(ip)
      .run();
    return { ok: false, error: "Incorrect code." };
  }

  await resetLockout(db, ip);
  return { ok: true };
}

export async function resendCode(env: LockoutEnv, ip: string): Promise<{ ok: boolean; error?: string }> {
  const { DB } = env;
  const row = await getRow(DB, ip);
  if (!row || row.failed_attempts < MAX_FAILED_ATTEMPTS) {
    return { ok: false, error: "This IP isn't currently locked out." };
  }
  if (row.code_sent_at) {
    const elapsedSeconds = (Date.now() - new Date(row.code_sent_at).getTime()) / 1000;
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      return { ok: false, error: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds)}s before requesting another code.` };
    }
  }

  const code = generateCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  await DB.prepare(
    "UPDATE login_lockouts SET code_hash = ?, code_expires_at = ?, code_sent_at = datetime('now'), code_attempts = 0, updated_at = datetime('now') WHERE ip = ?",
  )
    .bind(codeHash, expiresAt, ip)
    .run();

  await sendVerificationEmail(env, code, ip);
  return { ok: true };
}

async function sendVerificationEmail(env: LockoutEnv, code: string, ip: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.ALERT_EMAIL) {
    console.error("RESEND_API_KEY / ALERT_EMAIL not configured — skipping lockout email. Code:", code);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Battalion Catalogue <onboarding@resend.dev>",
        to: [env.ALERT_EMAIL],
        subject: "Battalion Catalogue: 5 failed login attempts",
        text: `5 failed password attempts were made on the Infantry Battalion Catalogue from IP ${ip}.

Verification code: ${code}

This code expires in ${CODE_TTL_MINUTES} minutes. Enter it on the login page to allow further password attempts from that IP.

If this wasn't you, no action is needed — the IP stays locked out until this code is used.`,
      }),
    });
    if (!res.ok) {
      console.error("Resend API error", res.status, await res.text());
    }
  } catch (err) {
    console.error("Failed to send verification email", err);
  }
}
