"use client";

/** Tiny synthesised sound effects (WebAudio, no files to download). */

const KEY = "att:sound";
type Sound = "correct" | "wrong" | "finish" | "levelup";

let ctx: AudioContext | null = null;

export function soundEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) !== "off";
}

const listeners = new Set<() => void>();

export function setSoundEnabled(on: boolean) {
  window.localStorage.setItem(KEY, on ? "on" : "off");
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore. */
export function subscribeSound(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function tone(ac: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = "sine", gain = 0.18) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + at);
  g.gain.setValueAtTime(0.0001, ac.currentTime + at);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + at);
  osc.stop(ac.currentTime + at + dur + 0.02);
}

const SCORES: Record<Sound, [number, number, number, OscillatorType?][]> = {
  correct: [
    [660, 0, 0.12, "triangle"],
    [990, 0.09, 0.22, "triangle"],
  ],
  wrong: [
    [220, 0, 0.18, "sawtooth"],
    [180, 0.12, 0.26, "sawtooth"],
  ],
  finish: [
    [523, 0, 0.14, "triangle"],
    [659, 0.12, 0.14, "triangle"],
    [784, 0.24, 0.14, "triangle"],
    [1047, 0.36, 0.4, "triangle"],
  ],
  levelup: [
    [392, 0, 0.12, "square"],
    [523, 0.1, 0.12, "square"],
    [659, 0.2, 0.12, "square"],
    [784, 0.3, 0.12, "square"],
    [1047, 0.42, 0.5, "triangle"],
  ],
};

export function playSound(s: Sound) {
  if (!soundEnabled()) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && s === "levelup") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    for (const [f, at, dur, type] of SCORES[s]) tone(ctx, f, at, dur, type, s === "wrong" ? 0.08 : 0.16);
  } catch {
    // Audio is a nice-to-have.
  }
}
