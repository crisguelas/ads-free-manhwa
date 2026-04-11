"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  alertError,
  btnPrimary,
  cardElevated,
  fieldLabel,
  inputField,
  textLink,
} from "@/lib/ui-styles";

type LoginFormProps = {
  /** Post-login navigation target (already sanitized server-side). */
  redirectTo: string;
};

/**
 * Email/password login that sets the HttpOnly session cookie via the login API.
 */
export function LoginForm({ redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Login failed.");
        return;
      }
      window.location.assign(redirectTo);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className={`${cardElevated} mx-auto flex w-full max-w-sm flex-col gap-5`}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Welcome back</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
          Sign in to access your library and continue where you left off.
        </p>
      </div>
      {error ? (
        <p className={alertError} role="alert">
          {error}
        </p>
      ) : null}
      <label className={fieldLabel}>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputField}
        />
      </label>
      <label className={fieldLabel}>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputField}
        />
      </label>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className={textLink}>
          Forgot password?
        </Link>
      </p>
      <p className="text-center text-sm text-zinc-500">
        No account?{" "}
        <Link href="/register" className={textLink}>
          Register
        </Link>
      </p>
    </form>
  );
}
