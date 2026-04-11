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

type ResetPasswordFormProps = {
  /** Raw token from the query string (already validated as present on the server page). */
  token: string;
};

/**
 * Sets a new password using the one-time token from the reset link.
 */
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Reset failed.");
        return;
      }
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className={`${cardElevated} mx-auto w-full max-w-sm text-center`}>
        <p className="text-sm font-semibold text-emerald-800">Password updated</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          You can sign in with your new password now.
        </p>
        <Link href="/login" className={`${textLink} mt-6 inline-block`}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className={`${cardElevated} mx-auto flex w-full max-w-sm flex-col gap-5`}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Choose a new password</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
          Use at least 8 characters. This link expires after a short time.
        </p>
      </div>
      {error ? (
        <p className={alertError} role="alert">
          {error}
        </p>
      ) : null}
      <label className={fieldLabel}>
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputField}
        />
      </label>
      <label className={fieldLabel}>
        Confirm password
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputField}
        />
      </label>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : "Update password"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        <Link href="/login" className={textLink}>
          Back to log in
        </Link>
      </p>
    </form>
  );
}
