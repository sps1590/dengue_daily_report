'use client';

import { useMemo, useRef, useState } from 'react';
import { checkDeathsAgainstCases } from '@/lib/death-check';
import { toEnglishLongDate } from '@/lib/bengali';
import type { DeathSummary, DengueReport } from '@/lib/types';

interface Props {
  /** The case report currently on screen, if any — used to cross-check the death counts. */
  report: DengueReport | null;
  deaths: DeathSummary | null;
  onDeaths: (deaths: DeathSummary | null) => void;
}

/**
 * Second upload, alongside the case-data PDF: the day's DGHS "Dengue Death
 * list". It works in both modes (fetching from DGHS or uploading the case
 * PDF) because the death list is never part of the DGHS case release — it
 * always comes from somewhere else. Reading it takes a moment, so it starts
 * as soon as a file is chosen.
 */
export function DeathListPanel({ report, deaths, onDeaths }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const issues = useMemo(() => (report && deaths ? checkDeathsAgainstCases(report, deaths) : []), [report, deaths]);

  const readFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/report/deaths', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'The death list could not be read.');
        return;
      }
      onDeaths(data as DeathSummary);
    } catch {
      setError('Could not reach the server. Check the connection and try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className="rounded-panel bg-card p-5 shadow-panel">
      <h2 className="text-sm font-semibold text-ink">
        Death list <span className="font-normal text-muted">(optional)</span>
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Upload the day&apos;s DGHS &ldquo;Dengue Death list&rdquo; PDF. The report gets a district-wise death table
        below the year-comparison table. Only the district of each death is read &mdash; names and phone numbers are never copied.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void readFile(f);
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-3 w-full rounded-sheet border border-dashed border-rule bg-paper px-3 py-3 text-center text-[13px] text-muted transition-colors hover:border-signal hover:text-signal disabled:cursor-wait"
      >
        {busy ? 'Reading the death list…' : deaths ? `Replace (${fileName ?? 'current list'})` : 'Click to choose the death list PDF'}
      </button>

      {error && <p className="mt-2 text-[13px] leading-snug text-alert">{error}</p>}

      {deaths && (
        <div className="mt-3">
          <p className="text-[13px] font-medium text-ink">
            {deaths.total} death{deaths.total === 1 ? '' : 's'} in {deaths.districts.length} district
            {deaths.districts.length === 1 ? '' : 's'}
            {deaths.date ? <span className="font-normal text-muted"> · {toEnglishLongDate(deaths.date)}</span> : null}
          </p>
          {deaths.districts.length > 0 && (
            <ul className="mt-1.5 divide-y divide-rule rounded-sheet border border-rule">
              {deaths.districts.map((d) => (
                <li key={d.district} className="flex items-center justify-between px-3 py-1.5 text-[13px]">
                  <span className="font-bangla">{d.districtBn}</span>
                  <span className="tabular-nums font-semibold">{d.deaths}</span>
                </li>
              ))}
            </ul>
          )}

          {issues.length > 0 ? (
            <div className="mt-2 rounded-sheet border border-amber/30 bg-amber-wash px-3 py-2">
              <p className="text-[12.5px] font-semibold text-amber">Check before circulating</p>
              <ul className="mt-1 space-y-1">
                {issues.map((i, idx) => (
                  <li key={idx} className="text-[12.5px] leading-snug text-ink/80">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ) : report ? (
            <p className="mt-2 text-[12.5px] leading-snug text-muted">
              Matches the case table&apos;s deaths in the last 24 hours, division by division.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              onDeaths(null);
              setFileName(null);
              setError(null);
            }}
            className="mt-2 text-[12.5px] text-signal underline underline-offset-2 hover:text-signal-deep"
          >
            Remove the death list
          </button>
        </div>
      )}
    </section>
  );
}
