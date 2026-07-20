"use client";

import { useState } from "react";
import { login, register, type AuthUser } from "@/lib/api";

/**
 * Glass sign-in / sign-up panel, matching the night-sky aesthetic.
 * Guests can skip — episodes just won't be saved to a library.
 */
export default function AuthPanel({
  onDone,
  onSkip,
}: {
  onDone: (user: AuthUser) => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Email and password, please.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(email.trim(), password);
      onDone(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fadeUp glass-strong w-full max-w-sm rounded-[28px] p-8">
      <h2 className="text-center text-xl font-semibold text-white/95">
        {mode === "login" ? "Welcome back" : "Join Nous"}
      </h2>
      <p className="mt-1.5 text-center text-sm text-white/50">
        {mode === "login"
          ? "Your episodes and memory are waiting."
          : "Keep every episode, and let the hosts remember you."}
      </p>

      <div className="mt-6 space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="email"
          autoComplete="email"
          className="w-full rounded-2xl border border-hairline bg-white/[0.04] px-4 py-3.5 text-[15px] text-white placeholder-white/30 outline-none transition focus:border-violet/60 focus:bg-white/[0.06]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="w-full rounded-2xl border border-hairline bg-white/[0.04] px-4 py-3.5 text-[15px] text-white placeholder-white/30 outline-none transition focus:border-violet/60 focus:bg-white/[0.06]"
        />
      </div>

      {error && <p className="mt-3 text-sm text-rose-300/80">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="mt-5 w-full rounded-2xl bg-gradient-to-r from-indigo via-violet to-indigo bg-[length:200%_100%] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[position:100%_0] active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
      </button>

      <div className="mt-5 flex items-center justify-between text-xs text-white/45">
        <button
          className="transition hover:text-white/80"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
        <button className="transition hover:text-white/80" onClick={onSkip}>
          Continue as guest →
        </button>
      </div>
    </div>
  );
}
