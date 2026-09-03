'use client';

import { toBengaliDateLabel } from '@/lib/bengali';

interface Props {
  date: string;
  onDateChange: (v: string) => void;
  onFetch: () => void;
  busy: boolean;
  maxDate: string;
}

export function DateControl({ date, onDateChange, onFetch, busy, maxDate }: Props) {
  return (
    <section className="rounded-panel bg-card p-5 shadow-panel">
      <h2 className="text-sm font-semibold text-ink">Choose a report date</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        DGHS publishes each release the following morning, so the default is yesterday.
      </p>

      <label className="mt-4 block text-[13px] font-medium text-ink" htmlFor="report-date">
        Report date
      </label>
      <input
        id="report-date"
        type="date"
        value={date}
        max={maxDate}
        min="2023-01-01"
        onChange={(e) => onDateChange(e.target.value)}
        className="mt-1.5 w-full rounded-sheet border border-rule bg-white px-3 py-2 text-sm text-ink"
      />

      <p className="mt-2 text-micro text-muted">
        Looks for{' '}
        <span className="font-bangla text-[12px] text-ink">
          ডেঙ্গু প্রেস রিলিজ {toBengaliDateLabel(date)}
        </span>
      </p>

      <button
        type="button"
        onClick={onFetch}
        disabled={busy}
        className="mt-4 w-full rounded-sheet bg-signal px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:bg-muted"
      >
        {busy ? 'Fetching the release…' : 'Fetch report'}
      </button>
    </section>
  );
}
