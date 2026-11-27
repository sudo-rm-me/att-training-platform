import * as React from "react";
import type { AvatarConfig } from "@/db/schema";
import { BACKGROUNDS, DEFAULT_AVATAR } from "@/lib/avatar";

const INK = "#231a3f";

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function hashId(c: AvatarConfig) {
  const s = JSON.stringify(c);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `av${h.toString(36)}`;
}

/** Layered, fully vector avatar. Safe to render on the server. */
export function AvatarSvg({ config, className, title }: { config?: AvatarConfig | null; className?: string; title?: string }) {
  const c = { ...DEFAULT_AVATAR, ...(config ?? {}) };
  const id = hashId(c);
  const skinShadow = shade(c.skin, -22);
  const hairDark = shade(c.hairColor, -25);
  const topDark = shade(c.topColor, -30);
  const bg = BACKGROUNDS[c.background] ?? BACKGROUNDS.violet;

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={title ?? "Avatar"}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle cx="100" cy="100" r="100" />
        </clipPath>
        {Array.isArray(bg) && (
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={bg[0]} />
            <stop offset="1" stopColor={bg[1]} />
          </linearGradient>
        )}
        {bg === "galaxy" && (
          <radialGradient id={`${id}-bg`} cx="0.3" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#7c3aed" />
            <stop offset="0.6" stopColor="#1e1b4b" />
            <stop offset="1" stopColor="#020617" />
          </radialGradient>
        )}
        {bg === "rainbow" && (
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
            {["#f43f5e", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"].map((col, i) => (
              <stop key={col} offset={i / 5} stopColor={col} />
            ))}
          </linearGradient>
        )}
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${id}-clip)`}>
        <rect width="200" height="200" fill={`url(#${id}-bg)`} />
        {bg === "galaxy" &&
          [
            [30, 40, 1.6],
            [160, 30, 1.2],
            [140, 70, 1],
            [40, 120, 1.3],
            [170, 140, 1.5],
            [70, 25, 1],
            [110, 18, 1.4],
          ].map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity="0.9" />)}
        {/* soft shine */}
        <ellipse cx="60" cy="40" rx="70" ry="40" fill="#fff" opacity="0.12" />

        {/* Hair behind head */}
        <HairBack style={c.hair} color={c.hairColor} dark={hairDark} />

        {/* Neck & body */}
        <path d="M86 118 h28 v28 c0 6 -28 6 -28 0 z" fill={skinShadow} />
        <Top style={c.top} color={c.topColor} dark={topDark} skin={c.skin} id={id} />

        {/* Ears */}
        <circle cx="57" cy="94" r="10" fill={c.skin} />
        <circle cx="143" cy="94" r="10" fill={c.skin} />
        <circle cx="57" cy="94" r="5" fill={skinShadow} opacity="0.5" />
        <circle cx="143" cy="94" r="5" fill={skinShadow} opacity="0.5" />

        {/* Head */}
        <ellipse cx="100" cy="88" rx="43" ry="48" fill={c.skin} />
        {/* cheeks */}
        <ellipse cx="76" cy="106" rx="7" ry="4.5" fill="#ff7a9a" opacity="0.28" />
        <ellipse cx="124" cy="106" rx="7" ry="4.5" fill="#ff7a9a" opacity="0.28" />

        <Eyes style={c.eyes} />
        <Brows style={c.brows} color={hairDark} />
        <Mouth style={c.mouth} />
        <HairFront style={c.hair} color={c.hairColor} dark={hairDark} />
        <Accessory style={c.accessory} id={id} />
      </g>
    </svg>
  );
}

function HairBack({ style, color, dark }: { style: string; color: string; dark: string }) {
  switch (style) {
    case "long":
      return <path d="M52 92 C48 46 76 30 100 30 C126 30 154 46 148 92 L154 158 C132 168 68 168 46 158 Z" fill={dark} />;
    case "bob":
      return <path d="M52 96 C48 50 76 32 100 32 C126 32 152 50 148 96 L150 124 C130 130 70 130 50 124 Z" fill={dark} />;
    case "bun":
      return <circle cx="100" cy="34" r="18" fill={color} />;
    case "curly":
      return (
        <g fill={dark}>
          {[
            [56, 104],
            [144, 104],
            [52, 84],
            [148, 84],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="13" />
          ))}
        </g>
      );
    default:
      return null;
  }
}

function HairFront({ style, color, dark }: { style: string; color: string; dark: string }) {
  switch (style) {
    case "short":
      return (
        <path
          d="M57 86 C54 50 78 36 102 37 C128 38 148 54 143 86 C138 70 126 60 108 58 C98 66 80 68 64 70 C60 76 58 80 57 86 Z"
          fill={color}
        />
      );
    case "long":
    case "bob":
      return (
        <path d="M56 92 C52 52 78 38 100 38 C124 38 148 52 144 92 C140 68 124 56 100 56 C88 64 70 70 60 72 C58 78 57 84 56 92 Z" fill={color} />
      );
    case "bun":
      return (
        <>
          <path d="M58 84 C56 52 78 40 100 40 C124 40 146 52 142 84 C136 64 120 56 100 56 C80 56 64 64 58 84 Z" fill={color} />
          <path d="M86 40 C92 36 108 36 114 40" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      );
    case "curly":
      return (
        <g fill={color}>
          {[
            [64, 64, 14],
            [80, 50, 15],
            [100, 45, 16],
            [120, 50, 15],
            [136, 64, 14],
            [58, 80, 11],
            [142, 80, 11],
          ].map(([x, y, r]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
      );
    case "buzz":
      return <path d="M59 82 C58 54 78 42 100 42 C124 42 142 54 141 82 C132 64 118 58 100 58 C82 58 68 64 59 82 Z" fill={color} opacity="0.75" />;
    case "mohawk":
      return (
        <>
          <path d="M60 80 C60 58 78 46 100 46 C122 46 140 58 140 80 C130 66 70 66 60 80 Z" fill={dark} opacity="0.55" />
          <path d="M90 62 C88 40 92 22 100 14 C108 22 112 40 110 62 Z" fill={color} />
        </>
      );
    case "spiky":
      return (
        <path
          d="M56 86 L54 60 L68 66 L66 40 L82 52 L88 28 L100 46 L112 26 L118 52 L134 40 L132 66 L146 60 L144 86 C136 68 120 60 100 60 C80 60 64 68 56 86 Z"
          fill={color}
        />
      );
    default:
      return null;
  }
}

function Eyes({ style }: { style: string }) {
  const l = 83;
  const r = 117;
  const y = 92;
  const dot = (x: number) => (
    <g key={x}>
      <circle cx={x} cy={y} r="5.5" fill={INK} />
      <circle cx={x + 1.8} cy={y - 1.8} r="1.8" fill="#fff" />
    </g>
  );
  const arc = (x: number, up = true) => (
    <path key={x} d={up ? `M${x - 7} ${y + 2} Q${x} ${y - 6} ${x + 7} ${y + 2}` : `M${x - 7} ${y} Q${x} ${y + 5} ${x + 7} ${y}`} stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
  );
  switch (style) {
    case "happy":
      return <>{[arc(l), arc(r)]}</>;
    case "wink":
      return <>{[dot(l), arc(r)]}</>;
    case "sleepy":
      return <>{[arc(l, false), arc(r, false)]}</>;
    case "surprised":
      return (
        <>
          {[l, r].map((x) => (
            <g key={x}>
              <circle cx={x} cy={y} r="8" fill="#fff" stroke={INK} strokeWidth="2" />
              <circle cx={x} cy={y} r="4" fill={INK} />
            </g>
          ))}
        </>
      );
    case "hearts":
      return (
        <>
          {[l, r].map((x) => (
            <path
              key={x}
              d={`M${x} ${y + 7} C${x - 12} ${y - 1} ${x - 6} ${y - 11} ${x} ${y - 4} C${x + 6} ${y - 11} ${x + 12} ${y - 1} ${x} ${y + 7} Z`}
              fill="#f43f5e"
            />
          ))}
        </>
      );
    case "stars":
      return (
        <>
          {[l, r].map((x) => (
            <path
              key={x}
              d={`M${x} ${y - 9} L${x + 2.6} ${y - 2.6} L${x + 9} ${y - 2} L${x + 4} ${y + 2.4} L${x + 5.6} ${y + 9} L${x} ${y + 5.4} L${x - 5.6} ${y + 9} L${x - 4} ${y + 2.4} L${x - 9} ${y - 2} L${x - 2.6} ${y - 2.6} Z`}
              fill="#facc15"
              stroke="#b45309"
              strokeWidth="1"
            />
          ))}
        </>
      );
    default:
      return <>{[dot(l), dot(r)]}</>;
  }
}

function Brows({ style, color }: { style: string; color: string }) {
  const p = { stroke: color, strokeWidth: 4, strokeLinecap: "round" as const, fill: "none" };
  switch (style) {
    case "raised":
      return (
        <>
          <path d="M74 76 Q83 68 92 74" {...p} />
          <path d="M108 74 Q117 68 126 76" {...p} />
        </>
      );
    case "focused":
      return (
        <>
          <path d="M75 76 L92 80" {...p} />
          <path d="M108 80 L125 76" {...p} />
        </>
      );
    case "none":
      return null;
    default:
      return (
        <>
          <path d="M75 79 Q83 75 91 78" {...p} />
          <path d="M109 78 Q117 75 125 79" {...p} />
        </>
      );
  }
}

function Mouth({ style }: { style: string }) {
  switch (style) {
    case "grin":
      return (
        <g>
          <path d="M84 109 Q100 130 116 109 Z" fill={INK} />
          <path d="M87 110 h26 v4 q-13 3 -26 0 z" fill="#fff" />
        </g>
      );
    case "open":
      return (
        <g>
          <ellipse cx="100" cy="116" rx="9" ry="10" fill={INK} />
          <ellipse cx="100" cy="121" rx="6" ry="4" fill="#ff7a9a" />
        </g>
      );
    case "neutral":
      return <path d="M90 115 H110" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />;
    case "smirk":
      return <path d="M89 116 Q103 121 113 110" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />;
    case "tongue":
      return (
        <g>
          <path d="M85 110 Q100 128 115 110 Z" fill={INK} />
          <path d="M94 116 q6 14 12 0 z" fill="#fb7185" />
        </g>
      );
    default:
      return <path d="M87 111 Q100 124 113 111" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  }
}

function Top({ style, color, dark, skin, id }: { style: string; color: string; dark: string; skin: string; id: string }) {
  const body = "M34 200 C34 162 62 142 100 142 C138 142 166 162 166 200 Z";
  switch (style) {
    case "hoodie":
      return (
        <g>
          <path d={body} fill={color} />
          <path d="M70 146 C76 162 124 162 130 146 C120 140 80 140 70 146 Z" fill={dark} />
          <path d="M92 156 v18 M108 156 v18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d="M80 186 h40 v14 h-40 z" fill={dark} opacity="0.6" />
        </g>
      );
    case "shirt":
      return (
        <g>
          <path d={body} fill="#f8fafc" />
          <path d="M84 144 L100 160 L116 144 L122 150 L104 168 L96 168 L78 150 Z" fill="#e2e8f0" />
          <path d="M96 160 h8 l4 8 l-8 32 l-8 -32 z" fill={color} />
          <path d="M34 200 C34 172 48 156 66 148 L72 200 Z M166 200 C166 172 152 156 134 148 L128 200 Z" fill={dark} opacity="0.35" />
        </g>
      );
    case "sweater":
      return (
        <g>
          <path d={body} fill={color} />
          <path d="M80 144 C84 156 116 156 120 144" stroke={dark} strokeWidth="7" fill="none" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${60 + i * 20} 178 l6 6 l6 -6`} stroke={dark} strokeWidth="2.5" fill="none" opacity="0.6" />
          ))}
        </g>
      );
    case "jacket":
      return (
        <g>
          <path d={body} fill={dark} />
          <path d="M86 144 L100 176 L114 144 Z" fill="#f8fafc" />
          <path d="M82 144 L100 190 L88 200 L70 150 Z M118 144 L100 190 L112 200 L130 150 Z" fill={color} />
          <circle cx="100" cy="194" r="2.5" fill="#fde68a" />
        </g>
      );
    case "hero":
      return (
        <g>
          <path d={body} fill={color} />
          <path d="M40 200 C44 170 60 152 80 146 L100 200 Z M160 200 C156 170 140 152 120 146 L100 200 Z" fill="#ef4444" opacity="0.85" />
          <path d="M100 156 l6 12 l13 2 l-10 9 l3 13 l-12 -7 l-12 7 l3 -13 l-10 -9 l13 -2 z" fill={`url(#${id}-gold)`} />
        </g>
      );
    case "royal":
      return (
        <g>
          <path d={body} fill="#7c2d12" />
          <path d="M34 200 C34 166 58 146 92 143 L84 200 Z M166 200 C166 166 142 146 108 143 L116 200 Z" fill="#b91c1c" />
          <path d="M70 148 C80 160 120 160 130 148" stroke="#f8fafc" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray="1 7" />
          <circle cx="100" cy="176" r="6" fill={`url(#${id}-gold)`} />
        </g>
      );
    default:
      return (
        <g>
          <path d={body} fill={color} />
          <path d="M84 143 Q100 158 116 143" fill={skin} />
          <path d="M84 143 Q100 158 116 143" stroke={dark} strokeWidth="3" fill="none" />
        </g>
      );
  }
}

function Accessory({ style, id }: { style: string; id: string }) {
  switch (style) {
    case "glasses":
      return (
        <g stroke={INK} strokeWidth="3" fill="#ffffff22">
          <circle cx="83" cy="92" r="12" />
          <circle cx="117" cy="92" r="12" />
          <path d="M95 91 Q100 87 105 91" fill="none" />
          <path d="M71 90 L58 86 M129 90 L142 86" />
        </g>
      );
    case "sunglasses":
      return (
        <g>
          <path d="M68 84 h30 v10 q0 12 -15 12 q-15 0 -15 -12 z M102 84 h30 v10 q0 12 -15 12 q-15 0 -15 -12 z" fill="#0f172a" />
          <path d="M98 87 h4" stroke="#0f172a" strokeWidth="4" />
          <path d="M74 88 l8 0" stroke="#fff" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />
          <path d="M108 88 l8 0" stroke="#fff" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />
        </g>
      );
    case "earrings":
      return (
        <g fill={`url(#${id}-gold)`}>
          <circle cx="55" cy="108" r="4" />
          <circle cx="145" cy="108" r="4" />
        </g>
      );
    case "bowtie":
      return (
        <g fill="#ef4444">
          <path d="M100 150 L82 140 L82 160 Z M100 150 L118 140 L118 160 Z" />
          <circle cx="100" cy="150" r="5" fill="#b91c1c" />
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M52 92 C50 44 150 44 148 92" stroke="#1f2937" strokeWidth="8" fill="none" strokeLinecap="round" />
          <rect x="44" y="80" width="18" height="30" rx="8" fill="#ef4444" />
          <rect x="138" y="80" width="18" height="30" rx="8" fill="#ef4444" />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M56 74 C56 40 144 40 144 74 Z" fill="#2563eb" />
          <path d="M100 70 C130 66 160 70 166 78 C150 82 120 80 100 78 Z" fill="#1d4ed8" />
          <circle cx="100" cy="44" r="4" fill="#1e3a8a" />
        </g>
      );
    case "crown":
      return (
        <g>
          <path d="M66 52 L72 22 L88 40 L100 14 L112 40 L128 22 L134 52 Z" fill={`url(#${id}-gold)`} stroke="#b45309" strokeWidth="2" />
          <circle cx="100" cy="40" r="4" fill="#ef4444" />
          <circle cx="80" cy="45" r="3" fill="#3b82f6" />
          <circle cx="120" cy="45" r="3" fill="#22c55e" />
        </g>
      );
    case "halo":
      return <ellipse cx="100" cy="24" rx="30" ry="8" fill="none" stroke="#fde047" strokeWidth="5" opacity="0.95" />;
    default:
      return null;
  }
}
