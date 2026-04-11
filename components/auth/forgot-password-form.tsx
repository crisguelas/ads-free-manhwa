"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  alertError,
  alertSuccess,
  btnPrimary,
  cardElevated,
  fieldLabel,
  inputField,
  textLink,
} from "@/lib/ui-styles";

/**
 * Submits email to the forgot-password API (generic success message either way).
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed.");
        return;
      }
      setMessage(
        typeof data.message === "string"
          ? data.message
          : "If an account exists for that email, you’ll receive password reset instructions shortly.",
      );
      setEmail("");
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
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Forgot password</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
          Enter the email address for your Manhwa Cloud account. If it matches an account
          on file, we’ll send you a link to choose a new password.
        </p>
      </div>
      {error ? (
        <p className={alertError} role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className={alertSuccess} role="status">
          {message}
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
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        <Link href="/login" className={textLink}>
          Back to log in
        </Link>
      </p>
    </form>
  );
}
