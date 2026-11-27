"use client";

import * as React from "react";

/** Single-series column chart with hover tooltips and a table view. */
export function ColumnChart({
  data,
  label,
  unit,
}: {
  data: { key: string; label: string; value: number; detail?: string }[];
  label: string;
  unit: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const [table, setTable] = React.useState(false);
  const W = 640;
  const H = 220;
  const pad = { l: 32, r: 8, t: 16, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = max <= 5 ? 1 : Math.ceil(max / 4 / 5) * 5;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const band = (W - pad.l - pad.r) / data.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const maxIdx = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => setTable((t) => !t)} className="text-xs font-semibold text-brand hover:underline">
          {table ? "Show chart" : "Show as table"}
        </button>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-medium">Week of</th>
              <th className="py-1 text-right font-medium">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-border/60">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{d.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
                <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px] tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = pad.l + band * i + band / 2;
              const h = y(0) - y(d.value);
              const r = Math.min(4, h);
              const x0 = cx - bw / 2;
              const yTop = y(d.value);
              return (
                <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  {/* hit target: the whole band */}
                  <rect x={pad.l + band * i} y={pad.t} width={band} height={H - pad.t - pad.b} fill="transparent" />
                  {d.value > 0 && (
                    <path
                      d={`M${x0} ${y(0)} V${yTop + r} Q${x0} ${yTop} ${x0 + r} ${yTop} H${x0 + bw - r} Q${x0 + bw} ${yTop} ${x0 + bw} ${yTop + r} V${y(0)} Z`}
                      fill="var(--brand)"
                      opacity={hover == null || hover === i ? 1 : 0.45}
                    />
                  )}
                  {(i === maxIdx || i === data.length - 1) && d.value > 0 && (
                    <text x={cx} y={yTop - 5} textAnchor="middle" className="fill-fg text-[10px] font-semibold tabular-nums">
                      {d.value}
                    </text>
                  )}
                  {(i % 2 === 0 || data.length <= 8) && (
                    <text x={cx} y={H - 10} textAnchor="middle" className="fill-muted text-[10px]">
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
          </svg>
          {hover != null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-card-solid! px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%` }}
            >
              <div className="font-semibold">Week of {data[hover].label}</div>
              <div className="tabular-nums">
                {data[hover].value.toLocaleString()} {unit.toLowerCase()}
              </div>
              {data[hover].detail && <div className="text-muted">{data[hover].detail}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Horizontal percentage bars (one measure), labelled at the tip. */
export function PercentBars({ rows }: { rows: { key: string; label: string; pct: number; detail: string }[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} title={r.detail}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{r.label}</span>
            <span className="shrink-0 text-xs text-muted">{r.detail}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-3 flex-1 overflow-hidden rounded-full bg-brand/12"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={r.pct}
              aria-label={`${r.label} ${r.pct}%`}
            >
              <div className="h-full rounded-full bg-brand" style={{ width: `${r.pct}%` }} />
            </div>
            <span className="w-10 text-right text-sm font-semibold tabular-nums">{r.pct}%</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
