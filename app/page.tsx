'use client';

import { useCallback, useMemo, useState } from 'react';
import { Masthead } from '@/components/Masthead';
import { DateControl } from '@/components/DateControl';
import { Pipeline } from '@/components/Pipeline';
import { FigureStrip } from '@/components/FigureStrip';
import { SheetTable } from '@/components/SheetTable';
import { BurdenChart } from '@/components/BurdenChart';
import { BriefPanel } from '@/components/BriefPanel';
import { Footer } from '@/components/Footer';
import { yesterdayInDhaka } from '@/lib/bengali';
import { briefToHtml, downloadFile } from '@/lib/export-brief';
import { downloadExcelFile } from '@/lib/download';
import { saveBrief, saveReport } from '@/lib/history';
import type { DengueReport, ManagementBrief, PipelineStep } from '@/lib/types';

const STEPS: { id: PipelineStep['id']; label: string }[] = [
  { id: 'resolve', label: 'Convert the date to the Bengali label DGHS uses' },
  { id: 'locate', label: 'Find the press release on the DGHS index' },
  { id: 'download', label: 'Download the PDF' },
  { id: 'extract', label: 'Read the tables out of the Bangla text' },
  { id: 'compose', label: 'Assemble the report' },
];

export default function Page() {
  const today = useMemo(() => {
    const d = new Date(Date.now() + 6 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }, []);

  const [date, setDate] = useState(yesterdayInDhaka);
  const [report, setReport] = useState<DengueReport | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>(
    STEPS.map((s) => ({ ...s, state: 'pending' })),
  );
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [brief, setBrief] = useState<ManagementBrief | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'bn'>('en');

  const [exporting, setExporting] = useState(false);

  const mark = useCallback(
    (id: PipelineStep['id'], state: PipelineStep['state'], detail?: string) => {
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, state, detail } : s)));
    },
    [],
  );

  const runFetch = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    setReport(null);
    setBrief(null);
    setBriefError(null);
    setSteps(STEPS.map((s) => ({ ...s, state: 'pending' })));

    // The request runs server-side in one pass; the rail reflects where it is.
    mark('resolve', 'done');
    mark('locate', 'running');

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();

      if (!res.ok) {
        const failedAt = res.status === 404 ? 'locate' : 'download';
        mark(failedAt, 'failed', data.error ?? 'Request failed.');
        setFetchError(data.error ?? 'Could not fetch this report.');
        return;
      }

      const r = data as DengueReport;
      mark('locate', 'done', r.sourceLabel);
      mark('download', 'done');
      mark(
        'extract',
        r.rows.length ? 'done' : 'failed',
        r.rows.length
          ? `${r.rows.length} region rows, ${(r.extraction.confidence * 100).toFixed(0)}% confidence via ${r.extraction.method}`
          : 'No region rows could be read.',
      );
      mark('compose', r.rows.length ? 'done' : 'skipped');
      setReport(r);
      if (r.rows.length) {
        saveReport(r);
      } else {
        setFetchError('The release was downloaded but no figures could be read from it.');
      }
    } catch (e) {
      mark('download', 'failed', e instanceof Error ? e.message : 'Network error.');
      setFetchError('Could not reach the server. Check the connection and try again.');
    } finally {
      setFetching(false);
    }
  }, [date, mark]);

  const downloadExcel = useCallback(
    async (script: 'legacy' | 'unicode') => {
      if (!report) return;
      setExporting(true);
      try {
        const err = await downloadExcelFile(report, script);
        if (err) setFetchError(err);
      } finally {
        setExporting(false);
      }
    },
    [report],
  );

  const runAnalysis = useCallback(async () => {
    if (!report) return;
    setAnalysing(true);
    setBriefError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBriefError(data.error ?? 'The analysis could not be completed.');
        return;
      }
      const b = data as ManagementBrief;
      setBrief(b);
      saveBrief(report.date, b);
    } catch {
      setBriefError('Could not reach the analysis service.');
    } finally {
      setAnalysing(false);
    }
  }, [report, language]);

  const lowConfidence = report && report.extraction.confidence < 0.6;

  return (
    <div className="min-h-screen">
      <Masthead date={report?.date ?? null} />

      <main className="mx-auto grid max-w-[1180px] gap-5 px-6 py-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <DateControl
            date={date}
            onDateChange={setDate}
            onFetch={runFetch}
            busy={fetching}
            maxDate={today}
          />
          <Pipeline steps={steps} />

          {report && (
            <section className="rounded-panel bg-card p-5 shadow-panel">
              <h2 className="text-sm font-semibold">Export</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Same layout, column widths and row heights as the workbook NMEP circulates.
              </p>
              <button
                type="button"
                onClick={() => downloadExcel('legacy')}
                disabled={exporting}
                className="mt-3 w-full rounded-sheet bg-signal px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-signal-deep disabled:bg-muted"
              >
                {exporting ? 'Building…' : 'Download Excel (SutonnyMJ)'}
              </button>
              <button
                type="button"
                onClick={() => downloadExcel('unicode')}
                disabled={exporting}
                className="mt-2 w-full rounded-sheet border border-rule px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-signal hover:text-signal disabled:text-muted"
              >
                Download Excel (Unicode Bangla)
              </button>
              <p className="mt-2 text-micro leading-snug text-muted">
                The SutonnyMJ version matches the circulated file byte for byte but needs that font
                installed. The Unicode version reads correctly anywhere.
              </p>
              <a
                href={report.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block text-[13px] text-signal underline underline-offset-2 hover:text-signal-deep"
              >
                Open the original DGHS PDF
              </a>
            </section>
          )}
        </div>

        <div className="space-y-5">
          {fetchError && (
            <div className="rounded-panel border border-alert/25 bg-alert-wash px-5 py-4">
              <p className="text-sm font-semibold text-alert">This date did not produce a report</p>
              <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-ink/80">{fetchError}</p>
              <p className="mt-2 text-micro text-muted">
                Releases usually appear the morning after the reporting day. Try the previous date.
              </p>
            </div>
          )}

          {!report && !fetchError && (
            <div className="rounded-panel bg-card px-6 py-10 text-center shadow-panel">
              <p className="text-sm font-semibold">Pick a date and fetch the release</p>
              <p className="mx-auto mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-muted">
                The report is read straight from the DGHS press release for that day, turned into the
                NMEP workbook, and can then be analysed for management.
              </p>
            </div>
          )}

          {report && lowConfidence && (
            <div className="rounded-panel border border-amber/30 bg-amber-wash px-5 py-3.5">
              <p className="text-[13px] font-semibold text-amber">Verify before circulating</p>
              <p className="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-ink/80">
                Only {(report.extraction.confidence * 100).toFixed(0)}% of the table was recognised.
                Open the source PDF and check the figures against it.
              </p>
            </div>
          )}

          {report && report.rows.length > 0 && (
            <>
              <FigureStrip report={report} />
              <SheetTable report={report} />
              <BurdenChart report={report} />
              <BriefPanel
                brief={brief}
                busy={analysing}
                error={briefError}
                language={language}
                onLanguageChange={setLanguage}
                onAnalyse={runAnalysis}
                onDownload={() =>
                  brief &&
                  downloadFile(
                    `Dengue brief ${report.date}.html`,
                    briefToHtml(report, brief),
                    'text/html;charset=utf-8',
                  )
                }
              />
            </>
          )}

          {report && report.extraction.notes.length > 0 && (
            <details className="rounded-panel bg-card px-5 py-3.5 shadow-panel">
              <summary className="cursor-pointer text-[13px] font-medium">
                Extraction log ({report.extraction.notes.length})
              </summary>
              <ul className="mt-2.5 space-y-1.5">
                {report.extraction.notes.map((n, i) => (
                  <li key={i} className="max-w-[80ch] text-[12.5px] leading-relaxed text-muted">
                    {n}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
