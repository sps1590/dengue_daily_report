'use client';

import { useEffect, useState } from 'react';
import { toEnglishLongDate } from '@/lib/bengali';
import { listHistory, type HistoryEntry } from '@/lib/history';
import { DivisionMap } from './DivisionMap';
import { DivisionShare } from './DivisionShare';
import { TrendCharts } from './TrendCharts';

/**
 * Everything here is built from reports already saved to this browser (the
 * same store the Dashboard reads) — a trend needs more than one date, which
 * a single day's press release can never provide on its own.
 */
export function AdvancedAnalysis() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    setEntries(listHistory());
  }, []);

  if (entries === null) return null;

  if (entries.length === 0) {
    return (
      <div className="rounded-panel bg-card px-6 py-10 text-center shadow-panel">
        <p className="text-sm font-semibold">No data to visualise yet</p>
        <p className="mx-auto mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-muted">
          Fetch or upload a report from the Report tab first. Charts and trends build up from every date saved to
          this browser — the more dates you fetch, the more useful the trend charts below become.
        </p>
      </div>
    );
  }

  const latest = entries[0];

  return (
    <div className="space-y-5">
      <section className="rounded-panel bg-card px-5 py-4 shadow-panel">
        <h1 className="text-sm font-semibold">Advanced analysis</h1>
        <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-muted">
          Built from every report saved to this browser ({entries.length} date{entries.length === 1 ? '' : 's'}).
          Trend charts need more than one date to say anything — fetch a few more days from the Report tab to fill
          them in.
        </p>
      </section>

      {entries.length < 2 && (
        <div className="rounded-panel border border-amber/30 bg-amber-wash px-5 py-3.5">
          <p className="text-[13px] font-semibold text-amber">Only one date saved so far</p>
          <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-ink/80">
            The trend charts below will be flat until there&apos;s more than one date to compare. The division
            breakdown already reflects {toEnglishLongDate(latest.date)}.
          </p>
        </div>
      )}

      <TrendCharts entries={entries} />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-panel bg-card p-5 shadow-panel">
          <h3 className="text-sm font-semibold">Share of admissions by division</h3>
          <p className="mt-0.5 text-micro text-muted">{toEnglishLongDate(latest.date)} · last 24 hours</p>
          <div className="mt-3">
            <DivisionShare rows={latest.report.rows} />
          </div>
        </div>

        <div className="rounded-panel bg-card p-5 shadow-panel">
          <h3 className="text-sm font-semibold">Where the burden sits</h3>
          <p className="mt-0.5 text-micro text-muted">{toEnglishLongDate(latest.date)} · last 24 hours, by reporting unit</p>
          <div className="mt-3">
            <DivisionMap rows={latest.report.rows} metricLabel="admissions" />
          </div>
        </div>
      </section>
    </div>
  );
}
