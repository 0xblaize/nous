"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UploadCardProps {
  onSubmit: (file: File, topic: string) => void;
  disabled?: boolean;
}

const ACCEPT = ".pdf,.txt,.md,.mp3,.wav,.m4a,.ogg,.webm";

export default function UploadDrop({ onSubmit, disabled }: UploadCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- mic recording (MediaRecorder -> webm File) ---
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      // Tidy up if unmounted mid-recording.
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        const ext = mime.includes("webm") ? "webm" : "ogg";
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size > 0) {
          setFile(new File([blob], `voice_note.${ext}`, { type: mime }));
        }
      };
      rec.start();
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was blocked — allow it in the browser, or upload a file.");
    }
  }, []);

  const pick = useCallback((f: File | null) => {
    if (!f) return;
    setFile(f);
    setError(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      pick(e.dataTransfer.files?.[0] ?? null);
    },
    [pick]
  );

  const submit = () => {
    if (!file) {
      setError("Add a PDF, note, or voice memo first.");
      return;
    }
    if (!topic.trim()) {
      setError("Tell the hosts what you want to learn today.");
      return;
    }
    onSubmit(file, topic.trim());
  };

  const isAudio = file && /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.name);

  return (
    <div className="animate-fadeUp glass w-full max-w-xl rounded-[28px] p-7">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        className={`group relative cursor-pointer rounded-2xl border border-dashed p-8 text-center transition-all ${
          dragging
            ? "border-violet bg-violet/10"
            : "border-white/15 hover:border-white/30 hover:bg-white/[0.03]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />

        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo/30 to-teal/20 text-white/80 transition group-hover:scale-105">
          {isAudio ? <MicIcon /> : <DocIcon />}
        </div>

        {file ? (
          <>
            <p className="truncate text-sm font-medium text-white/90">{file.name}</p>
            <p className="mt-1 text-xs text-white/45">
              {(file.size / 1024).toFixed(0)} KB · click to replace
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-white/85">
              Drop a PDF or voice note
            </p>
            <p className="mt-1 text-xs text-white/45">
              PDF, text, or audio · or click to browse
            </p>
          </>
        )}
      </div>

      {/* Mic — speak instead of uploading */}
      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/35">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled}
        className={`mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border py-3.5 text-sm font-medium transition-all ${
          recording
            ? "border-rose-400/50 bg-rose-500/10 text-rose-200"
            : "border-hairline bg-white/[0.04] text-white/75 hover:border-white/30 hover:bg-white/[0.07]"
        }`}
      >
        <span
          className={`grid h-8 w-8 place-items-center rounded-full ${
            recording
              ? "animate-pulseGlow bg-rose-500/25 text-rose-300"
              : "bg-gradient-to-br from-indigo/30 to-teal/20 text-white/80"
          }`}
        >
          {recording ? <StopIcon /> : <MicIcon small />}
        </span>
        {recording
          ? `Recording… ${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")} — tap to finish`
          : "Speak your notes instead"}
      </button>

      {/* Topic */}
      <div className="mt-5">
        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/50">
          What do you want to learn today?
        </label>
        <input
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. Explain chapter three like I'm new to it"
          disabled={disabled}
          className="w-full rounded-2xl border border-hairline bg-white/[0.04] px-4 py-3.5 text-[15px] text-white placeholder-white/30 outline-none transition focus:border-violet/60 focus:bg-white/[0.06]"
        />
      </div>

      {error && <p className="mt-3 text-sm text-rose-300/80">{error}</p>}

      <button
        onClick={submit}
        disabled={disabled}
        className="group relative mt-5 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-indigo via-violet to-indigo bg-[length:200%_100%] py-4 text-sm font-semibold text-white transition-all hover:bg-[position:100%_0] active:scale-[0.99] disabled:opacity-50"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          Compose my episode
          <ArrowIcon />
        </span>
      </button>
    </div>
  );
}

function DocIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}
function MicIcon({ small }: { small?: boolean } = {}) {
  const s = small ? 16 : 24;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
