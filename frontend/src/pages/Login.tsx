import { useState } from "react";
import { auth, ApiError, type LoginError } from "../api/client";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await auth.login(password);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as LoginError | undefined;
        if (data?.locked) {
          setLocked(true);
          setError(null);
        } else {
          setError(err.message);
          setRemainingAttempts(data?.remainingAttempts ?? null);
        }
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (locked) {
    return (
      <LockedOut
        onVerified={() => {
          setLocked(false);
          setPassword("");
          setRemainingAttempts(null);
          setNotice("Verified. You can try your password again.");
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        <h1 className="text-lg font-bold text-slate-900">Infantry Battalion Armory Catalogue</h1>
        <p className="mt-1 text-sm text-slate-500">Authorized personnel only. Enter the site password to continue.</p>

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />

        {notice && <p className="mt-2 text-sm text-green-700">{notice}</p>}
        {error && (
          <p className="mt-2 text-sm text-red-600">
            {error}
            {remainingAttempts !== null && (
              <span className="block text-xs text-red-500">
                {remainingAttempts} attempt{remainingAttempts === 1 ? "" : "s"} remaining before lockout.
              </span>
            )}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}

function LockedOut({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendNotice(null);
    setSubmitting(true);
    try {
      await auth.verifyCode(code);
      onVerified();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendNotice(null);
    setResending(true);
    try {
      await auth.resendCode();
      setResendNotice("A new code has been sent.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form onSubmit={handleVerify} className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        <h1 className="text-lg font-bold text-slate-900">Too many failed attempts</h1>
        <p className="mt-1 text-sm text-slate-500">
          This address has been locked out after 5 incorrect passwords. A verification code has been emailed to the admin.
          Enter it below to keep trying.
        </p>

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="code">
          Verification code
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm tracking-widest focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {resendNotice && <p className="mt-2 text-sm text-green-700">{resendNotice}</p>}

        <button
          type="submit"
          disabled={submitting || !code}
          className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? "Verifying…" : "Verify"}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="mt-3 w-full text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </form>
    </div>
  );
}
