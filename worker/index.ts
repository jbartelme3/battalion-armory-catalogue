import { Hono } from "hono";
import type { Env } from "./types";
import { clearSessionCookie, createSessionCookie, isAuthenticated } from "./auth";
import { getClientIp, isLocked, recordFailedAttempt, resendCode, resetLockout, verifyCode } from "./lib/loginSecurity";
import { cadets } from "./routes/cadets";
import { equipment } from "./routes/equipment";

const app = new Hono<{ Bindings: Env }>();

app.post("/api/login", async (c) => {
  const ip = getClientIp(c.req.raw);

  if (await isLocked(c.env.DB, ip)) {
    return c.json({ error: "Too many failed attempts. Check the admin's email for a verification code.", locked: true }, 423);
  }

  const body = await c.req.json<{ password?: string }>().catch(() => ({ password: undefined }));

  if (!body.password || body.password !== c.env.SITE_PASSWORD) {
    const result = await recordFailedAttempt(c.env, ip);
    if (result.locked) {
      return c.json(
        { error: "Too many failed attempts. We've sent a verification code to the admin's email.", locked: true },
        423,
      );
    }
    return c.json({ error: "Incorrect password", remainingAttempts: result.remainingAttempts }, 401);
  }

  await resetLockout(c.env.DB, ip);
  c.header("Set-Cookie", await createSessionCookie(c.env));
  return c.json({ ok: true });
});

app.post("/api/login/verify", async (c) => {
  const ip = getClientIp(c.req.raw);
  const body = await c.req.json<{ code?: string }>().catch(() => ({ code: undefined }));
  if (!body.code) return c.json({ error: "Code is required" }, 400);

  const result = await verifyCode(c.env.DB, ip, body.code);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ ok: true });
});

app.post("/api/login/resend-code", async (c) => {
  const ip = getClientIp(c.req.raw);
  const result = await resendCode(c.env, ip);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ ok: true });
});

app.post("/api/logout", (c) => {
  c.header("Set-Cookie", clearSessionCookie());
  return c.json({ ok: true });
});

app.get("/api/me", async (c) => {
  const authed = await isAuthenticated(c.req.raw, c.env);
  if (!authed) return c.json({ authenticated: false }, 401);
  return c.json({ authenticated: true });
});

// Everything else under /api requires a valid session.
app.use("/api/*", async (c, next) => {
  const authed = await isAuthenticated(c.req.raw, c.env);
  if (!authed) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

app.route("/api/cadets", cadets);
app.route("/api/equipment", equipment);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
