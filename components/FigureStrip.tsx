import type { DengueReport } from '@/lib/types';

const fmt = (n: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US'));

/**
 * Four figures, one rule between each. Deliberately not four shadowed cards:
 * these belong to one sentence about the same day, and boxing them separately
 * would imply they are independent.
 */
export function FigureStrip({ report }: { report: DengueReport }) {
  const t = report.totals;
  const items: { label: string; value: string; tone?: 'alert' | 'amber' }[] = [
    { label: 'Admitted in 24 hours', value: fmt(t.admitted24h) },
    { label: 'Deaths in 24 hours', value: fmt(t.deaths24h), tone: 'alert' },
    { label: 'Currently in hospital', value: fmt(t.currentlyAdmitted), tone: 'amber' },
    { label: 'Discharged this year', value: fmt(t.discharged) },
  ];

  return (
    <section className="figures rounded-panel bg-card shadow-panel">
      <div className="grid grid-cols-2 divide-rule sm:grid-cols-4 sm:divide-x">
        {items.map((it, i) => (
          <div
            key={it.label}
            className={`px-5 py-4 ${i < 2 ? 'border-b border-rule sm:border-b-0' : ''} ${
              i % 2 === 1 ? 'border-l border-rule sm:border-l-0' : ''
            }`}
          >
            <p
              className={`text-[26px] font-semibold leading-none ${
                it.tone === 'alert' ? 'text-alert' : it.tone === 'amber' ? 'text-amber' : 'text-ink'
              }`}
            >
              {it.value}
            </p>
            <p className="mt-1.5 text-micro leading-snug text-muted">{it.label}</p>
          </div>
        ))}
      </div>
      <p className="border-t border-rule px-5 py-2.5 text-micro text-muted">
        Cumulative since 01 January: {fmt(t.totalAdmitted)} admissions, {fmt(t.totalDeaths)} deaths.
        {t.totalAdmitted && t.totalDeaths
          ? ` Case fatality among admissions ${((t.totalDeaths / t.totalAdmitted) * 100).toFixed(2)}%.`
          : ''}
      </p>
    </section>
  );
}
