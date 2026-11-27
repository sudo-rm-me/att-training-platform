"use client";

import * as React from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { playSound } from "@/lib/sounds";

export function Confetti({ fire }: { fire: boolean }) {
  React.useEffect(() => {
    if (fire) playSound("finish");
    if (!fire || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#6d4aff", "#c045ff", "#ff7ab6", "#ffb547", "#34d399"];
    const end = Date.now() + 1200;
    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.55 }, colors });
    frame();
  }, [fire]);
  return null;
}

export function CountUp({ to, className, prefix = "" }: { to: number; className?: string; prefix?: string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${prefix}${Math.round(v).toLocaleString()}`);
  React.useEffect(() => {
    const c = animate(mv, to, { duration: 1.2, ease: "easeOut", delay: 0.3 });
    return () => c.stop();
  }, [mv, to]);
  return <motion.span className={className}>{text}</motion.span>;
}

export function ScoreRing({ score, passed, passMark }: { score: number; passed: boolean; passMark: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-48 w-48">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={passed ? "#34d399" : "#fb7185"} />
            <stop offset="100%" stopColor={passed ? "#6d4aff" : "#f97316"} />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="14" />
        {/* pass mark tick */}
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="14"
          strokeDasharray={`2 ${c}`}
          strokeDashoffset={-(passMark / 100) * c}
        />
        <motion.circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (score / 100) * c }}
          transition={{ duration: 1.3, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-5xl font-extrabold tabular-nums">
            <CountUp to={score} />%
          </div>
          <div className="text-xs font-semibold text-muted">Pass mark {passMark}%</div>
        </div>
      </div>
    </div>
  );
}

/** Full-screen level-up moment, shown once per attempt. */
export function LevelUpModal({ attemptId, from, to, title }: { attemptId: string; from: number; to: number; title: string }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const key = `att:levelup:${attemptId}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    const t = setTimeout(() => {
      setOpen(true);
      playSound("levelup");
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        confetti({ particleCount: 160, spread: 120, startVelocity: 45, origin: { y: 0.45 }, colors: ["#ffd166", "#ffb547", "#c045ff", "#6d4aff"] });
    }, 1400);
    return () => clearTimeout(t);
  }, [attemptId]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[#140d33]/70 p-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="levelup-title"
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-brand-gradient p-8 text-center text-white shadow-2xl"
            initial={{ scale: 0.6, rotate: -6, y: 40 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.25),transparent_30%)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
            <div className="relative">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/80">Level up!</div>
              <div className="mt-4 flex items-center justify-center gap-4 font-display font-extrabold">
                <span className="text-4xl text-white/60 tabular-nums">{from}</span>
                <motion.span initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-3xl">
                  →
                </motion.span>
                <motion.span
                  className="text-7xl tabular-nums drop-shadow-[0_6px_20px_rgba(0,0,0,0.3)]"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.35, 1] }}
                  transition={{ delay: 0.45, duration: 0.6 }}
                >
                  {to}
                </motion.span>
              </div>
              <h2 id="levelup-title" className="mt-4 font-display text-2xl font-bold">
                You&apos;re now a {title}
              </h2>
              <p className="mt-1 text-sm text-white/85">New items may be waiting in the shop and character creator.</p>
              <button
                autoFocus
                onClick={() => setOpen(false)}
                className="mt-6 rounded-2xl bg-white px-6 py-2.5 font-bold text-[#3b1d9a] shadow-lg transition hover:scale-105"
              >
                Awesome!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
