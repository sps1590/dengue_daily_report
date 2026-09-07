'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { REGION_EN, type RegionRow } from '@/lib/types';

const COLORS = ['#1B5E9C', '#3D7CB5', '#5F9BCF', '#8FB0CC', '#A9702A', '#C99257', '#B3302A', '#D9857F', '#61798F', '#9AABBB'];

const tooltipStyle = {
  border: '1px solid #D9E0E8',
  borderRadius: 2,
  fontSize: 12,
  boxShadow: 'none',
} as const;

/** Share of the latest day's admissions, by reporting unit. */
export function DivisionShare({ rows }: { rows: RegionRow[] }) {
  const data = rows
    .map((r) => ({ name: REGION_EN[r.key], value: r.admitted24h ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!data.length) {
    return <p className="text-[13px] text-muted">No admissions recorded for this date.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={1.5}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 11.5, color: '#61798F', lineHeight: '1.6em' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
