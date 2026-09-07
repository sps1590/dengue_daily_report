'use client';

import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toEnglishLongDate } from '@/lib/bengali';
import type { HistoryEntry } from '@/lib/history';

const tooltipStyle = {
  border: '1px solid #D9E0E8',
  borderRadius: 2,
  fontSize: 12,
  boxShadow: 'none',
} as const;

const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

/**
 * Every date the app has ever fetched, in this browser, turned into an
 * actual trend — something a single day's press release can never show on
 * its own. Only meaningful once more than a couple of dates are saved, which
 * the empty/thin states in AdvancedAnalysis handle.
 */
export function TrendCharts({ entries }: { entries: HistoryEntry[] }) {
  const chrono = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const data = chrono.map((e) => ({
    date: shortDate(e.date),
    fullDate: toEnglishLongDate(e.date),
    admitted24h: e.report.totals.admitted24h ?? 0,
    deaths24h: e.report.totals.deaths24h ?? 0,
    totalAdmitted: e.report.totals.totalAdmitted ?? 0,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Admissions in the last 24 hours" subtitle="National total, by date fetched">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
            <defs>
              <linearGradient id="admittedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1B5E9C" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#1B5E9C" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#EDF1F5" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#61798F' }} axisLine={{ stroke: '#D9E0E8' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#61798F' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: '#1B5E9C', strokeWidth: 1 }}
              contentStyle={tooltipStyle}
              labelFormatter={(_, p) => p?.[0]?.payload?.fullDate ?? ''}
            />
            <Area type="monotone" dataKey="admitted24h" name="Admitted (24h)" stroke="#1B5E9C" fill="url(#admittedFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Deaths in the last 24 hours" subtitle="National total, by date fetched">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
            <CartesianGrid stroke="#EDF1F5" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#61798F' }} axisLine={{ stroke: '#D9E0E8' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#61798F' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: '#B3302A', strokeWidth: 1 }}
              contentStyle={tooltipStyle}
              labelFormatter={(_, p) => p?.[0]?.payload?.fullDate ?? ''}
            />
            <Line type="monotone" dataKey="deaths24h" name="Deaths (24h)" stroke="#B3302A" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Cumulative admissions" subtitle="Since 01 January, by date fetched" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
            <defs>
              <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A9702A" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#A9702A" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#EDF1F5" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#61798F' }} axisLine={{ stroke: '#D9E0E8' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#61798F' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: '#A9702A', strokeWidth: 1 }}
              contentStyle={tooltipStyle}
              labelFormatter={(_, p) => p?.[0]?.payload?.fullDate ?? ''}
            />
            <Area type="monotone" dataKey="totalAdmitted" name="Cumulative admitted" stroke="#A9702A" fill="url(#cumulativeFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-panel bg-card p-5 shadow-panel ${className}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-micro text-muted">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
