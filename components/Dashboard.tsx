'use client';

import { useCallback, useEffect, useState } from 'react';
import { REGION_EN } from '@/lib/types';
import { toEnglishLongDate } from '@/lib/bengali';
import { briefToHtml, downloadFile } from '@/lib/export-brief';
import { downloadExcelFile } from '@/lib/download';
import { clearHistory, listHistory, removeEntry, type HistoryEntry } from '@/lib/history';

const fmt = (n: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US'));

type Job = `${string}:${'legacy' | 'unicode' | 'brief'}` | null;

/**
 * Every report fetched in this browser, kept so it can be re-downloaded
 * without going back to DGHS. The workbook is rebuilt fresh from the stored
 * figures on each click — it is not a cached blob — so it always carries live
 * formulas, and the brief is plain HTML. Both open ready to edit, not as a
 * flattened snapshot.
 */
export function Dashboard() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [job, setJob] = useState<Job>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(listHistory());
  }, []);

  const refresh = useCallback(() => setEntries(listHistory()), []);

  const handleExcel = useCallback(
    async (entry: HistoryEntry, script: 'legacy' | 'unicode') => {
      setError(null);
      setJob(`${entry.date}:${script}`);
      const err = await downloadExcelFile(entry.report, script);
      if (err) setError(err);
      setJob(null);
    },
    [],
  );

  const handleBrief = useCallback((entry: HistoryEntry) => {
    if (!entry.brief) return;
    downloadFile(
      `Dengue brief ${entry.date}.html`,
      briefToHtml(entry.report, entry.brief),
      'text/html;charset=utf-8',
    );
  }, []);

  const handleRemove = useCallback(
    (date: string) => {
      removeEntry(date);
      refresh();
    },
    [refresh],
  );

  const handleClearAll = useCallback(() => {
    if (!window.confirm('Remove every saved report from this browser? Nothing on the server is affected.')) {
      return;
    }
    clearHistory();
    refresh();
  }, [refresh]);

  if (entries === null) return null;

  return (
    <div className="space-y-5">
      <section className="rounded-panel bg-card px-5 py-4 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold">Dashboard</h1>
            <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-muted">
              Every report fetched on the Report tab is saved here, in this browser only. Each
              download below is built fresh from the stored figures — the workbook keeps its live
              formulas and the brief is plain HTML, so both open ready to edit, not as a locked
              snapshot.
            </p>
          </div>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="shrink-0 rounded-sheet border border-rule px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-alert hover:text-alert"
            >
              Clear all
            </button>
          )}
        </div>
      </section>

      {error && (
        <p className="rounded-panel border border-alert/30 bg-alert-wash px-4 py-3 text-[13px] text-alert">
          {error}
        </p>
      )}

      {entries.length === 0 && (
        <div className="rounded-panel bg-card px-6 py-10 text-center shadow-panel">
          <p className="text-sm font-semibold">No reports saved yet</p>
          <p className="mx-auto mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-muted">
            Fetch a report from the Report tab. Every date that produces figures is added here
            automatically, with its own download links.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {entries.map((entry) => {
          const t = entry.report.totals;
          const confidencePct = (entry.report.extraction.confidence * 100).toFixed(0);
          const lowConfidence = entry.report.extraction.confidence < 0.6;

          return (
            <section key={entry.date} className="rounded-panel bg-card shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="text-[13.5px] font-semibold">{toEnglishLongDate(entry.date)}</h2>
                  <span
                    className={`rounded-sheet px-1.5 py-0.5 text-micro ${
                      lowConfidence ? 'bg-amber-wash text-amber' : 'bg-signal-wash text-signal'
                    }`}
                  >
                    {confidencePct}% · {entry.report.extraction.method}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(entry.date)}
                  className="text-micro text-muted underline-offset-2 hover:text-alert hover:underline"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-rule px-5 py-3 text-[13px] sm:grid-cols-4">
                <Figure label="Admitted 24h" value={fmt(t.admitted24h)} />
                <Figure label="Deaths 24h" value={fmt(t.deaths24h)} tone="alert" />
                <Figure label="In hospital" value={fmt(t.currentlyAdmitted)} tone="amber" />
                <Figure label="Total admitted" value={fmt(t.totalAdmitted)} />
              </div>

              <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => handleExcel(entry, 'legacy')}
                  disabled={job === `${entry.date}:legacy`}
                  className="rounded-sheet bg-signal px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-signal-deep disabled:bg-muted"
                >
                  {job === `${entry.date}:legacy` ? 'Building…' : 'Excel (SutonnyMJ)'}
                </button>
                <button
                  type="button"
                  onClick={() => handleExcel(entry, 'unicode')}
                  disabled={job === `${entry.date}:unicode`}
                  className="rounded-sheet border border-rule px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-signal hover:text-signal disabled:text-muted"
                >
                  {job === `${entry.date}:unicode` ? 'Building…' : 'Excel (Unicode)'}
                </button>
                {entry.brief ? (
                  <button
                    type="button"
                    onClick={() => handleBrief(entry)}
                    className="rounded-sheet border border-rule px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-signal hover:text-signal"
                  >
                    Brief ({entry.brief.language === 'bn' ? 'বাংলা' : 'English'})
                  </button>
                ) : (
                  <span className="text-micro text-muted">
                    No brief yet — generate one from the Report tab.
                  </span>
                )}
                {entry.report.sourceUrl && (
                  <a
                    href={entry.report.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-micro text-signal underline underline-offset-2 hover:text-signal-deep"
                  >
                    Source
                  </a>
                )}
              </div>

              {entry.report.rows.length > 0 && (
                <p className="border-t border-rule px-5 py-2 text-micro text-muted">
                  {entry.report.rows.map((r) => REGION_EN[r.key]).join(' · ')}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'alert' | 'amber' }) {
  return (
    <div>
      <p
        className={`figures text-[16px] font-semibold leading-none ${
          tone === 'alert' ? 'text-alert' : tone === 'amber' ? 'text-amber' : 'text-ink'
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-micro leading-snug text-muted">{label}</p>
    </div>
  );
}
