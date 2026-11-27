"use client";

import * as React from "react";
import confetti from "canvas-confetti";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

export function Confetti({ fire }: { fire: boolean }) {
  React.useEffect(() => {
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
