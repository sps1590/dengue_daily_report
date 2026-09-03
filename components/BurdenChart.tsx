'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DHAKA_CITY_KEYS, REGION_EN, type DengueReport } from '@/lib/types';

/**
 * Two views of the same day. The split answers "is this a city outbreak or a
 * national one", which is the first question management asks; the division
 * ranking answers "where do we send people".
 */
export function BurdenChart({ report }: { report: DengueReport }) {
  const rows = report.rows.filter((r) => typeof r.admitted24h === 'number');
  if (!rows.length) return null;

  const dhakaCity = rows
    .filter((r) => DHAKA_CITY_KEYS.includes(r.key))
    .reduce((a, r) => a + (r.admitted24h ?? 0), 0);
  const outside = rows
    .filter((r) => !DHAKA_CITY_KEYS.includes(r.key))
    .reduce((a, r) => a + (r.admitted24h ?? 0), 0);

  const split = [
    { name: 'Dhaka city', value: dhakaCity },
    { name: 'Outside Dhaka city', value: outside },
  ];

  const ranked = rows
    .map((r) => ({ name: REGION_EN[r.key], value: r.admitted24h ?? 0 }))
    .sort((a, b) => b.value - a.value);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Panel title="Admissions in the last 24 hours" subtitle="Dhaka city against the rest of the country">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={split} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
            <CartesianGrid stroke="#EDF1F5" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#61798F' }} axisLine={{ stroke: '#D9E0E8' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#61798F' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: '#EAF1F8' }} contentStyle={tooltipStyle} />
            <Bar dataKey="value" name="Admissions" radius={[2, 2, 0, 0]}>
              <Cell fill="#1B5E9C" />
              <Cell fill="#8FB0CC" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Where the admissions are" subtitle="Every reporting unit, highest first">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={ranked} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="#EDF1F5" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#61798F' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={128}
              tick={{ fontSize: 10.5, fill: '#61798F' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: '#EAF1F8' }} contentStyle={tooltipStyle} />
            <Bar dataKey="value" name="Admissions" fill="#1B5E9C" radius={[0, 2, 2, 0]} barSize={11} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </section>
  );
}

const tooltipStyle = {
  border: '1px solid #D9E0E8',
  borderRadius: 2,
  fontSize: 12,
  boxShadow: 'none',
} as const;

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-panel bg-card p-5 shadow-panel">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-micro text-muted">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
