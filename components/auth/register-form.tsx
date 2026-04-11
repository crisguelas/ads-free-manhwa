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

/**
 * Creates a user, hashes the password server-side, and opens a session.
 */
export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Registration failed.");
        return;
      }
      window.location.assign("/");
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
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Create your account</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
          Manhwa Cloud — save follows and reading history in one place.
        </p>
      </div>
      {error ? (
        <p className={alertError} role="alert">
          {error}
        </p>
      ) : null}
      <label className={fieldLabel}>
        Display name <span className="font-normal text-zinc-400">(optional)</span>
        <input
          name="displayName"
          type="text"
          autoComplete="nickname"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputField}
        />
      </label>
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
        Password <span className="font-normal text-zinc-400">(min. 8 characters)</span>
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
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className={textLink}>
          Log in
        </Link>
      </p>
    </form>
  );
}
