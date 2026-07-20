"use client";

import { useEffect, useRef } from "react";
import { reactivity } from "@/lib/reactivity";

/**
 * NightSky — a slow, hypnotic, *3D* scene rendered on two canvases:
 *
 *  · a perspective-projected star field drifting gently toward the viewer,
 *    with parallax steered by the mouse (camera sways like a slow head-turn)
 *  · aurora ribbons — layered sinusoidal bands breathing on a 10s cycle
 *  · occasional shooting stars and floating fireflies
 *  · everything glows brighter with the episode audio (reactivity.audioLevel)
 *
 * The pace is deliberately sleep-inducing: nothing moves fast, everything
 * eases. Honors prefers-reduced-motion with a static render.
 */
export default function NightSky() {
  const starsRef = useRef<HTMLCanvasElement>(null);
  const auroraRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const starsCanvas = starsRef.current;
    const auroraCanvas = auroraRef.current;
    if (!starsCanvas || !auroraCanvas) return;
    const sctx = starsCanvas.getContext("2d");
    const actx = auroraCanvas.getContext("2d");
    if (!sctx || !actx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      for (const c of [starsCanvas, auroraCanvas]) {
        c.width = w * dpr;
        c.height = h * dpr;
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // --- mouse -> camera sway (heavily smoothed) ---
    const onMouse = (e: MouseEvent) => {
      reactivity.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      reactivity.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMouse);

    // --- 3D star field ---
    const STAR_COUNT = 340;
    const DEPTH = 1600;
    type Star = { x: number; y: number; z: number; r: number; tw: number; hue: number };
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: rand(-1400, 1400),
      y: rand(-900, 900),
      z: rand(1, DEPTH),
      r: rand(0.4, 1.6),
      tw: rand(0, Math.PI * 2),
      hue: Math.random() < 0.12 ? rand(180, 260) : 0, // a few tinted stars
    }));

    type Shooter = { x: number; y: number; vx: number; vy: number; life: number };
    let shooter: Shooter | null = null;

    type Firefly = { x: number; y: number; a: number; sp: number; ph: number };
    const flies: Firefly[] = Array.from({ length: 14 }, () => ({
      x: Math.random(),
      y: rand(0.55, 0.95),
      a: rand(0, Math.PI * 2),
      sp: rand(0.00004, 0.00012),
      ph: rand(0, Math.PI * 2),
    }));

    let camX = 0;
    let camY = 0;
    let raf = 0;
    let last = performance.now();

    const drawStars = (t: number, dt: number, breath: number, glow: number) => {
      sctx.clearRect(0, 0, w, h);
      // slow head-sway toward the pointer
      camX += (reactivity.mouseX * 90 - camX) * 0.012;
      camY += (reactivity.mouseY * 55 - camY) * 0.012;

      const cx = w / 2;
      const cy = h / 2;
      const fl = 420; // focal length
      const speed = reduced ? 0 : 0.011 * dt; // gentle forward drift

      for (const s of stars) {
        s.z -= speed;
        if (s.z < 1) {
          s.z = DEPTH;
          s.x = rand(-1400, 1400);
          s.y = rand(-900, 900);
        }
        const px = cx + ((s.x - camX) / s.z) * fl;
        const py = cy + ((s.y - camY) / s.z) * fl;
        if (px < -8 || px > w + 8 || py < -8 || py > h + 8) continue;
        const depth = 1 - s.z / DEPTH; // 0 far .. 1 near
        const twinkle = 0.55 + 0.45 * Math.sin(t * 0.0009 + s.tw);
        const alpha = Math.min(1, depth * 1.25) * twinkle * (0.5 + 0.5 * breath) + glow * 0.25;
        const radius = s.r * (0.4 + depth * 1.7) * (1 + glow * 0.5);
        sctx.beginPath();
        sctx.arc(px, py, radius, 0, Math.PI * 2);
        sctx.fillStyle = s.hue
          ? `hsla(${s.hue}, 80%, 78%, ${alpha})`
          : `rgba(226, 232, 255, ${alpha})`;
        sctx.fill();
        if (depth > 0.82) {
          // near stars get a soft bloom
          sctx.beginPath();
          sctx.arc(px, py, radius * 3.2, 0, Math.PI * 2);
          sctx.fillStyle = `rgba(180, 197, 255, ${alpha * 0.12})`;
          sctx.fill();
        }
      }

      // --- shooting star (rare, calm) ---
      if (!reduced) {
        if (!shooter && Math.random() < 0.0018) {
          const fromLeft = Math.random() < 0.5;
          shooter = {
            x: fromLeft ? -40 : w + 40,
            y: rand(h * 0.05, h * 0.35),
            vx: (fromLeft ? 1 : -1) * rand(0.25, 0.42),
            vy: rand(0.05, 0.11),
            life: 1,
          };
        }
        if (shooter) {
          shooter.x += shooter.vx * dt;
          shooter.y += shooter.vy * dt;
          shooter.life -= dt / 2600;
          const tail = 110;
          const grad = sctx.createLinearGradient(
            shooter.x,
            shooter.y,
            shooter.x - shooter.vx * tail * 4,
            shooter.y - shooter.vy * tail * 4
          );
          grad.addColorStop(0, `rgba(255,255,255,${0.8 * shooter.life})`);
          grad.addColorStop(1, "rgba(255,255,255,0)");
          sctx.strokeStyle = grad;
          sctx.lineWidth = 1.6;
          sctx.beginPath();
          sctx.moveTo(shooter.x, shooter.y);
          sctx.lineTo(shooter.x - shooter.vx * tail * 4, shooter.y - shooter.vy * tail * 4);
          sctx.stroke();
          if (shooter.life <= 0 || shooter.x < -160 || shooter.x > w + 160) shooter = null;
        }

        // --- fireflies in the lower field ---
        for (const f of flies) {
          f.a += rand(-0.03, 0.03);
          f.x += Math.cos(f.a) * f.sp * dt;
          f.y += Math.sin(f.a) * f.sp * dt * 0.6;
          if (f.x < 0) f.x = 1;
          if (f.x > 1) f.x = 0;
          f.y = Math.min(0.97, Math.max(0.5, f.y));
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.0016 + f.ph);
          const alpha = pulse * 0.5 * (0.6 + glow);
          const fx = f.x * w;
          const fy = f.y * h;
          sctx.beginPath();
          sctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
          sctx.fillStyle = `rgba(190, 242, 220, ${alpha})`;
          sctx.fill();
          sctx.beginPath();
          sctx.arc(fx, fy, 5, 0, Math.PI * 2);
          sctx.fillStyle = `rgba(120, 220, 180, ${alpha * 0.2})`;
          sctx.fill();
        }
      }
    };

    // --- aurora ribbons ---
    const RIBBONS = [
      { hue: 158, base: 0.30, amp: 62, speed: 0.000041, alpha: 0.05 },
      { hue: 200, base: 0.36, amp: 84, speed: 0.000029, alpha: 0.045 },
      { hue: 262, base: 0.26, amp: 58, speed: 0.000053, alpha: 0.05 },
      { hue: 310, base: 0.42, amp: 66, speed: 0.000023, alpha: 0.03 },
    ];

    const drawAurora = (t: number, breath: number, glow: number) => {
      actx.clearRect(0, 0, w, h);
      actx.globalCompositeOperation = "lighter";
      for (const rb of RIBBONS) {
        const yBase = rb.base * h + camY * 0.4;
        const amp = rb.amp * (1 + breath * 0.35 + glow * 0.8);
        const alpha = rb.alpha * (0.7 + breath * 0.5 + glow * 1.6);
        const grad = actx.createLinearGradient(0, yBase - amp * 2.4, 0, yBase + amp * 2.4);
        grad.addColorStop(0, `hsla(${rb.hue}, 90%, 62%, 0)`);
        grad.addColorStop(0.5, `hsla(${rb.hue}, 90%, 62%, ${alpha})`);
        grad.addColorStop(1, `hsla(${rb.hue}, 90%, 62%, 0)`);
        actx.fillStyle = grad;
        actx.beginPath();
        actx.moveTo(0, yBase);
        const step = Math.max(24, w / 48);
        for (let x = 0; x <= w + step; x += step) {
          const y =
            yBase +
            Math.sin(x * 0.0021 + t * rb.speed * 1000) * amp +
            Math.sin(x * 0.0009 - t * rb.speed * 640) * amp * 0.6 +
            camX * 0.15;
          actx.lineTo(x, y - amp * 1.6);
        }
        for (let x = w + step; x >= -step; x -= step) {
          const y =
            yBase +
            Math.sin(x * 0.0021 + t * rb.speed * 1000) * amp +
            Math.sin(x * 0.0009 - t * rb.speed * 640) * amp * 0.6 +
            camX * 0.15;
          actx.lineTo(x, y + amp * 1.6);
        }
        actx.closePath();
        actx.fill();
      }
      actx.globalCompositeOperation = "source-over";
    };

    const frame = (t: number) => {
      const dt = Math.min(64, t - last);
      last = t;
      // 10-second breath: ~4s swell, ~6s release — the sleep rhythm.
      const breath = 0.5 + 0.5 * Math.sin((t % 10000) / 10000 * Math.PI * 2 - Math.PI / 2);
      const glow = Math.min(1, reactivity.audioLevel * 1.4);
      drawStars(t, dt, breath, glow);
      drawAurora(t, breath, glow);
      if (!reduced) raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      // Single static render — still beautiful, nothing moves.
      frame(performance.now());
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-base">
      {/* deep-space base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 90% at 50% -10%, #101229 0%, #0a0b18 45%, #07070c 100%)",
        }}
      />
      <canvas ref={auroraRef} className="absolute inset-0" />
      <canvas ref={starsRef} className="absolute inset-0" />
      {/* horizon glow */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background:
            "linear-gradient(to top, rgba(20, 24, 46, 0.85), transparent)",
        }}
      />
      {/* film grain + vignette for the cinematic finish */}
      <div className="absolute inset-0 opacity-[0.05] [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.6%22/></svg>')]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 45%, transparent 55%, rgba(4, 4, 10, 0.55) 100%)",
        }}
      />
    </div>
  );
}
