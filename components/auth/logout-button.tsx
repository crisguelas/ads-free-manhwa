"use client";

/**
 * Ends the session and returns the visitor to the home page.
 */
export function LogoutButton() {
  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 sm:text-sm"
    >
      Log out
    </button>
  );
}
