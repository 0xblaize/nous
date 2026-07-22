import { useState } from "react";
import { login, register, type AuthUser } from "@/lib/api";

/** White sign-in / sign-up card in the landing's design language. */
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
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Email and password, please.");
      return;
    }
    setBusy(true);
    setError(null);
    setWaking(false);
    const call = () =>
      mode === "login" ? login(email.trim(), password) : register(email.trim(), password);
    try {
      let user: AuthUser;
      try {
        user = await call();
      } catch (first) {
        // Free-tier backends (Render, etc.) sleep when idle and miss the
        // first request while waking up. Retry once before giving up.
        const msg = first instanceof Error ? first.message : "";
        if (msg.includes("waking up")) {
          setWaking(true);
          await new Promise((r) => setTimeout(r, 4000));
          user = await call();
        } else {
          throw first;
        }
      }
      onDone(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setWaking(false);
    }
  };

  const input =
    "w-full rounded-xl border border-black/10 bg-white px-4 py-3.5 text-[15px] text-zinc-900 placeholder-zinc-400 shadow-sm outline-none transition focus:border-[#1a1a1a]";

  return (
    <div className="animate-fadeUp w-full max-w-sm rounded-2xl border border-black/[0.05] bg-white p-8 shadow-sm">
      <h2 className="text-center font-display text-xl font-semibold text-[#1a1a1a]">
        {mode === "login" ? "welcome back" : "join nous"}
      </h2>
      <p className="mt-1.5 text-center text-sm text-zinc-500">
        {mode === "login"
          ? "your episodes and memory are waiting."
          : "keep every episode, and let the hosts remember you."}
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
          className={input}
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
          className={input}
        />
      </div>

      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
      {waking && !error && (
        <p className="mt-3 text-sm text-zinc-500">waking up the server, one more moment...</p>
      )}

      <button
        onClick={submit}
        disabled={busy}
        className="mt-5 w-full rounded-full bg-[#1a1a1a] py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? "..." : mode === "login" ? "sign in" : "create account"}
      </button>

      <div className="mt-5 flex items-center justify-between text-xs text-zinc-500">
        <button
          className="lowercase transition hover:text-[#1a1a1a]"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "new here? create an account" : "have an account? sign in"}
        </button>
        <button className="lowercase transition hover:text-[#1a1a1a]" onClick={onSkip}>
          guest →
        </button>
      </div>
    </div>
  );
}
