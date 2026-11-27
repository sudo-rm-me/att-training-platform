"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, Lock, Shuffle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AvatarConfig } from "@/db/schema";
import {
  AVATAR_ITEMS,
  CATEGORY_LABELS,
  HAIR_COLORS,
  isUnlocked,
  SKIN_TONES,
  TOP_COLORS,
  type AvatarCategory,
} from "@/lib/avatar";
import { AvatarSvg } from "@/components/avatar-svg";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { saveAvatarAction } from "./actions";

const TABS: (AvatarCategory | "skin")[] = ["skin", "hair", "eyes", "brows", "mouth", "top", "accessory", "background"];

export function AvatarBuilder({
  initial,
  owned,
  level,
  name,
}: {
  initial: AvatarConfig;
  owned: string[];
  level: number;
  name: string;
}) {
  const [config, setConfig] = React.useState(initial);
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("hair");
  const [saving, setSaving] = React.useState(false);
  const ownedSet = React.useMemo(() => new Set(owned), [owned]);
  const [saved, setSaved] = React.useState(initial);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  const set = (patch: Partial<AvatarConfig>) => setConfig((c) => ({ ...c, ...patch }));

  function randomise() {
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const avail = (cat: AvatarCategory) =>
      AVATAR_ITEMS.filter((i) => i.category === cat && isUnlocked(i, level, ownedSet)).map((i) => i.value);
    setConfig({
      skin: pick(SKIN_TONES),
      hair: pick(avail("hair")),
      hairColor: pick(HAIR_COLORS),
      eyes: pick(avail("eyes")),
      brows: pick(avail("brows")),
      mouth: pick(avail("mouth")),
      top: pick(avail("top")),
      topColor: pick(TOP_COLORS),
      accessory: pick(avail("accessory")),
      background: pick(avail("background")),
    });
  }

  async function save() {
    setSaving(true);
    const res = await saveAvatarAction(config);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setSaved(config);
    toast.success("Looking sharp! ✨");
    for (const b of res.badges) toast.success(`Badge unlocked: ${b} 🏅`);
  }

  const colorRow = (label: string, colors: string[], value: string, key: keyof AvatarConfig) => (
    <div>
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <div className="flex flex-wrap gap-2">
        {colors.map((col) => (
          <button
            key={col}
            onClick={() => set({ [key]: col } as Partial<AvatarConfig>)}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-card-solid transition hover:scale-110",
              value === col ? "ring-brand" : "ring-transparent",
            )}
            style={{ background: col }}
            aria-label={col}
          >
            {value === col && <Check className="h-4 w-4 text-white mix-blend-difference" />}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card className="flex flex-col items-center p-8 lg:sticky lg:top-24 lg:self-start">
        <motion.div key={JSON.stringify(config)} initial={{ scale: 0.96 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
          <AvatarSvg config={config} className="h-64 w-64 drop-shadow-2xl" title={name} />
        </motion.div>
        <div className="mt-4 font-display text-xl font-bold">{name}</div>
        <div className="mt-6 flex w-full gap-2">
          <Button variant="secondary" className="flex-1" onClick={randomise}>
            <Shuffle className="h-4 w-4" /> Surprise me
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving || !dirty}>
            <Sparkles className="h-4 w-4" /> {saving ? "Saving…" : dirty ? "Save look" : "Saved"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-6 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                tab === t ? "bg-brand-gradient text-white" : "bg-fg/5 text-muted hover:text-fg",
              )}
            >
              {t === "skin" ? "Skin" : CATEGORY_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === "skin" ? (
          colorRow("Skin tone", SKIN_TONES, config.skin, "skin")
        ) : (
          <div className="space-y-6">
            {tab === "hair" && colorRow("Hair colour", HAIR_COLORS, config.hairColor, "hairColor")}
            {tab === "top" && colorRow("Outfit colour", TOP_COLORS, config.topColor, "topColor")}
            <div>
              <div className="mb-2 text-sm font-semibold">{CATEGORY_LABELS[tab]}</div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
                {AVATAR_ITEMS.filter((i) => i.category === tab).map((it) => {
                  const unlocked = isUnlocked(it, level, ownedSet);
                  const active = config[tab] === it.value;
                  const preview = { ...config, [tab]: it.value };
                  return (
                    <button
                      key={it.key}
                      disabled={!unlocked}
                      onClick={() => set({ [tab]: it.value } as Partial<AvatarConfig>)}
                      className={cn(
                        "group relative flex flex-col items-center rounded-2xl border-2 p-2 transition",
                        active ? "border-brand bg-brand/8" : "border-transparent bg-fg/[0.03] hover:border-border",
                        !unlocked && "cursor-not-allowed",
                      )}
                    >
                      <AvatarSvg config={preview} className={cn("h-20 w-20", !unlocked && "opacity-40 grayscale")} />
                      <span className="mt-1 text-xs font-semibold">{it.label}</span>
                      {!unlocked && (
                        <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-card-solid px-1.5 py-0.5 text-[10px] font-bold shadow">
                          <Lock className="h-3 w-3" />
                          {it.badge ? "🏅 Badge" : it.minLevel ? `Lv ${it.minLevel}` : `${it.price}🪙`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <p className="mt-6 text-sm text-muted">
          Locked items can be bought in the <Link href="/shop" className="font-semibold text-brand hover:underline">shop</Link> with coins, or unlock as you level up.
        </p>
      </Card>
    </div>
  );
}
