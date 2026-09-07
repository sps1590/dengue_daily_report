'use client';

import { REGION_EN, type RegionKey, type RegionRow } from '@/lib/types';

/**
 * A schematic layout of the reporting units in their rough relative
 * position — north at the top, Dhaka's two city corporations stacked under
 * Dhaka Division since they sit inside it. This is a diagram, not a
 * surveyed map: exact borders would need real geographic data this app
 * doesn't have, and a wrong border is worse than an honest schematic.
 */
const LAYOUT: { key: RegionKey; col: number; row: number }[] = [
  { key: 'RANGPUR', col: 2, row: 1 },
  { key: 'RAJSHAHI', col: 1, row: 2 },
  { key: 'MYMENSINGH', col: 2, row: 2 },
  { key: 'SYLHET', col: 3, row: 2 },
  { key: 'KHULNA', col: 1, row: 3 },
  { key: 'DHAKA_DIVISION', col: 2, row: 3 },
  { key: 'DHAKA_NORTH_CITY', col: 2, row: 4 },
  { key: 'DHAKA_SOUTH_CITY', col: 2, row: 5 },
  { key: 'BARISHAL', col: 1, row: 6 },
  { key: 'CHATTOGRAM', col: 3, row: 6 },
];

/** Light wash to deep signal blue, interpolated by share of the highest value. */
function intensityColor(value: number, max: number): { bg: string; fg: string } {
  if (max <= 0) return { bg: '#EAF1F8', fg: '#134472' };
  const t = Math.max(0, Math.min(1, value / max));
  // #EAF1F8 -> #1B5E9C
  const from = [0xea, 0xf1, 0xf8];
  const to = [0x1b, 0x5e, 0x9c];
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * t));
  const bg = `rgb(${mix[0]},${mix[1]},${mix[2]})`;
  return { bg, fg: t > 0.5 ? '#FFFFFF' : '#134472' };
}

export function DivisionMap({ rows, metricLabel }: { rows: RegionRow[]; metricLabel: string }) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const values = LAYOUT.map((l) => byKey.get(l.key)?.admitted24h ?? 0);
  const max = Math.max(1, ...values);

  const cols = 3;
  const rowCount = 6;

  return (
    <div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rowCount}, 48px)` }}
      >
        {LAYOUT.map(({ key, col, row }) => {
          const value = byKey.get(key)?.admitted24h ?? 0;
          const { bg, fg } = intensityColor(value, max);
          return (
            <div
              key={key}
              style={{ gridColumn: col, gridRow: row, background: bg, color: fg }}
              className="flex flex-col items-center justify-center rounded-sheet px-1 text-center leading-tight"
              title={`${REGION_EN[key]}: ${value}`}
            >
              <span className="text-[10px] font-medium">{REGION_EN[key]}</span>
              <span className="text-[13px] font-semibold tabular-nums">{value.toLocaleString('en-US')}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-micro text-muted">
        <span>Schematic layout — relative position only, not to scale</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#EAF1F8' }} />
          low
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#1B5E9C' }} />
          high {metricLabel}
        </span>
      </div>
    </div>
  );
}
