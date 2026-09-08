'use client';

import { useCallback, useRef, useState } from 'react';
import { LABELS } from '@/lib/bijoy';
import {
  OFFICIAL_REPORT_CSS,
  buildOfficialReportModel,
  downloadOfficialReport,
  downloadOfficialReportWord,
  fmtBn,
} from '@/lib/export-official-report';
import { downloadOfficialReportImage, downloadOfficialReportPdf } from '@/lib/export-official-image';
import type { DengueReport } from '@/lib/types';

type Format = 'image' | 'pdf' | 'excel-unicode' | 'excel-legacy' | 'word' | 'html';

async function downloadOfficialExcel(report: DengueReport, script: 'legacy' | 'unicode', filenameBase: string) {
  const res = await fetch('/api/report/official-excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report, script }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'The workbook could not be built.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase} (${script === 'legacy' ? 'SutonnyMJ' : 'Unicode'}).xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * A faithful on-screen reproduction of the government sheet — exact wording,
 * exact eight rows (serial ২–৯, ঢাকা বিভাগ combining Dhaka Division with the
 * two city corporations), peach header shading, black cell borders.
 * Downloadable as an image, a PDF, an Excel workbook (Unicode or legacy
 * SutonnyMJ), a Word document, or plain HTML — all built from this same
 * rendered element or the same data model, so none of them can drift from
 * what's on screen or from each other.
 */
export function OfficialReport({ report }: { report: DengueReport }) {
  const m = buildOfficialReportModel(report);
  const reportRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filenameBase = `Dengue official report ${report.date}`;

  const handleFormat = useCallback(
    async (format: Format) => {
      setMenuOpen(false);
      setError(null);
      setBusy(format);
      try {
        switch (format) {
          case 'image':
            if (reportRef.current) await downloadOfficialReportImage(reportRef.current, filenameBase);
            break;
          case 'pdf':
            if (reportRef.current) await downloadOfficialReportPdf(reportRef.current, filenameBase);
            break;
          case 'word':
            downloadOfficialReportWord(report);
            break;
          case 'html':
            downloadOfficialReport(report);
            break;
          case 'excel-unicode':
            await downloadOfficialExcel(report, 'unicode', filenameBase);
            break;
          case 'excel-legacy':
            await downloadOfficialExcel(report, 'legacy', filenameBase);
            break;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That download could not be built.');
      } finally {
        setBusy(null);
      }
    },
    [report, filenameBase],
  );

  const OPTIONS: { format: Format; label: string }[] = [
    { format: 'excel-unicode', label: 'Excel (Unicode)' },
    { format: 'excel-legacy', label: 'Excel (SutonnyMJ)' },
    { format: 'pdf', label: 'PDF' },
    { format: 'word', label: 'Word' },
    { format: 'html', label: 'HTML' },
    { format: 'image', label: 'Image (PNG)' },
  ];

  return (
    <section className="rounded-panel bg-card shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Official report</h2>
          <p className="mt-0.5 text-micro text-muted">The exact sheet layout, downloadable in six formats.</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={busy !== null}
            className="rounded-sheet bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:bg-muted"
          >
            {busy ? `Building ${OPTIONS.find((o) => o.format === busy)?.label}…` : 'Download Report ▾'}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-sheet border border-rule bg-card shadow-panel">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.format}
                    type="button"
                    onClick={() => handleFormat(opt.format)}
                    className="block w-full px-3.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-signal-wash hover:text-signal"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="border-b border-rule bg-alert-wash px-5 py-2.5 text-[13px] text-alert">{error}</p>
      )}

      <div className="overflow-x-auto px-5 py-5">
        <style>{OFFICIAL_REPORT_CSS}</style>
        <div ref={reportRef} className="official-report" style={{ maxWidth: 'none', padding: 0 }}>
          <div className="org-header">
            <p>{LABELS.govt.unicode}</p>
            <p>{LABELS.dghs.unicode.trim()}</p>
            <p>{LABELS.branch.unicode}</p>
            <p>{LABELS.address.unicode}</p>
          </div>
          <p className="section-title">{LABELS.title.unicode}</p>

          <table>
            <thead>
              <tr>
                <th rowSpan={2}>ক্রমিক নং</th>
                <th rowSpan={2} className="name">
                  {LABELS.divisionName.unicode}
                </th>
                <th colSpan={2}>{LABELS.last24h.unicode}</th>
                <th colSpan={3}>{m.cumulativeHeaderText}</th>
                <th rowSpan={2}>{LABELS.currentlyAdmitted.unicode}</th>
              </tr>
              <tr>
                <th>{LABELS.admitted.unicode}</th>
                <th>{LABELS.deaths.unicode}</th>
                <th>{LABELS.totalAdmitted.unicode}</th>
                <th>{LABELS.totalDeaths.unicode}</th>
                <th>{LABELS.discharged.unicode}</th>
              </tr>
            </thead>
            <tbody>
              {m.rows.map((r) => (
                <tr key={r.row.key}>
                  <td>{r.serial}</td>
                  <td className="name">{r.name}</td>
                  <td>{fmtBn(r.row.admitted24h)}</td>
                  <td>{fmtBn(r.row.deaths24h)}</td>
                  <td>{fmtBn(r.row.totalAdmitted)}</td>
                  <td>{fmtBn(r.row.totalDeaths)}</td>
                  <td>{fmtBn(r.row.discharged)}</td>
                  <td>{fmtBn(r.row.currentlyAdmitted)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>{LABELS.grandTotal.unicode}</td>
                <td>{fmtBn(m.rowTotals.admitted24h)}</td>
                <td>{fmtBn(m.rowTotals.deaths24h)}</td>
                <td>{fmtBn(m.rowTotals.totalAdmitted)}</td>
                <td>{fmtBn(m.rowTotals.totalDeaths)}</td>
                <td>{fmtBn(m.nationalDischarged)}</td>
                <td>{fmtBn(m.nationalCurrentlyAdmitted)}</td>
              </tr>
            </tbody>
          </table>

          <p className="section-title underline">{m.comparisonHeadingText}</p>
          <table>
            <thead>
              <tr>
                <th>{LABELS.serialFlat.unicode}</th>
                <th className="name">{LABELS.year.unicode}</th>
                <th>{LABELS.caseCount.unicode}</th>
                <th>{LABELS.deathCount.unicode}</th>
                <th>{LABELS.remarks.unicode}</th>
              </tr>
            </thead>
            <tbody>
              {m.comparisonRows.map((r) => (
                <tr key={r.serial}>
                  <td>{r.serial}</td>
                  <td className="name">{r.periodLabel}</td>
                  <td>{fmtBn(r.cases)}</td>
                  <td>{fmtBn(r.deaths)}</td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="source-note">{LABELS.sourceNote.unicode}</p>

          <div className="signature-block">
            <p className="signature-cursive">Anahar</p>
            <p className="signature-date">{m.downloadDate}</p>
            <p className="signature-role">{LABELS.signatory.unicode}</p>
            <p className="signature-role">{LABELS.signatoryOrg.unicode}</p>
            <p className="signature-role">{LABELS.signatoryAddr.unicode}</p>
          </div>
        </div>
      </div>

      <p className="border-t border-rule px-5 py-3 text-micro leading-relaxed text-muted">
        ঢাকা বিভাগ combines Dhaka Division, Dhaka North City Corporation, and Dhaka South City Corporation into one
        row, so সর্বমোট is both the press release&apos;s real national total and the sum of the eight rows above, for
        every column. Discharged and currently-admitted per division come from the PDF&apos;s district-level tables
        further down the report; Dhaka North and South City Corporation are only published there as one combined
        figure, which is folded into the ঢাকা বিভাগ row rather than split between the two.
      </p>
    </section>
  );
}
