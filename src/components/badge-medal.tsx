import type { BadgeDef } from "@/lib/badges";
import { cn } from "@/lib/utils";

export function BadgeMedal({ badge, locked, size = "md" }: { badge: BadgeDef; locked?: boolean; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-10 w-10 text-lg" : size === "lg" ? "h-24 w-24 text-5xl" : "h-16 w-16 text-3xl";
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full shadow-lg ring-4 ring-white/60 dark:ring-white/10",
        dims,
        locked && "grayscale opacity-40",
      )}
      style={{ background: `radial-gradient(circle at 30% 25%, ${badge.colors[0]}, ${badge.colors[1]})` }}
      title={`${badge.name}: ${badge.description}`}
    >
      <span className="drop-shadow">{badge.emoji}</span>
      <span className="pointer-events-none absolute inset-x-[18%] top-[8%] h-[30%] rounded-full bg-white/30 blur-[2px]" />
    </div>
  );
}
