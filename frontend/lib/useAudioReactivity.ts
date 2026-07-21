import { useEffect, useRef } from "react";
import { reactivity } from "@/lib/reactivity";

/**
 * Attach a Web Audio analyser to an <audio> element and stream its loudness +
 * spectrum into the shared `reactivity` signals every frame. The whole scene
 * (stars, aurora, waveform) breathes with the hosts' voices.
 */
export function useAudioReactivity(audioRef: React.RefObject<HTMLAudioElement>) {
  const ctxRef = useRef<AudioContext | null>(null);
  const wired = useRef(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    let raf = 0;
    let analyser: AnalyserNode | null = null;
    let data: Uint8Array | null = null;

    const wire = () => {
      if (wired.current) return;
      wired.current = true;
      // MediaElementSource can only be created once per element.
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      ctxRef.current = ctx;
      const src = ctx.createMediaElementSource(el);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128; // 64 bins — plenty for a glow signal
      analyser.smoothingTimeConstant = 0.85;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (analyser && data) {
          analyser.getByteFrequencyData(data);
          // average of the voice band, normalized + eased
          let sum = 0;
          const n = Math.min(data.length, 40);
          for (let i = 2; i < n; i++) sum += data[i];
          const level = sum / (n - 2) / 255;
          reactivity.audioLevel += (level - reactivity.audioLevel) * 0.18;
          reactivity.spectrum = data;
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    };

    // Browsers require a user gesture before AudioContext runs — wire on play.
    const onPlay = () => {
      wire();
      void ctxRef.current?.resume();
    };
    const onQuiet = () => {
      // ease the glow out when paused/ended
      reactivity.audioLevel = 0;
      reactivity.spectrum = null;
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onQuiet);
    el.addEventListener("ended", onQuiet);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onQuiet);
      el.removeEventListener("ended", onQuiet);
      onQuiet();
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      wired.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef.current]);
}
