'use client';

import { LABELS } from '@/lib/bijoy';
import { OFFICIAL_REPORT_CSS, buildOfficialReportModel, downloadOfficialReport, fmtBn } from '@/lib/export-official-report';
import type { DengueReport } from '@/lib/types';

/**
 * A faithful on-screen reproduction of the government sheet — exact wording,
 * exact eight rows (serial ২–৯, matching the reference workbook's own
 * structure), peach header shading, black cell borders. "Download Report"
 * builds the same document as a standalone HTML page and hands it straight
 * to the browser's print dialog, so "Save as PDF" is a single click away.
 */
export function OfficialReport({ report }: { report: DengueReport }) {
  const m = buildOfficialReportModel(report);

  return (
    <section className="rounded-panel bg-card shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Official report</h2>
          <p className="mt-0.5 text-micro text-muted">The exact sheet layout, ready to print or save as PDF.</p>
        </div>
        <button
          type="button"
          onClick={() => downloadOfficialReport(report)}
          className="rounded-sheet bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-signal-deep"
        >
          Download Report
        </button>
      </div>

      <div className="overflow-x-auto px-5 py-5">
        <style>{OFFICIAL_REPORT_CSS}</style>
        <div className="official-report" style={{ maxWidth: 'none', padding: 0 }}>
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
        Discharged and currently-admitted figures are national totals — DGHS's current press release does not
        publish those two per division. Every other cell is a real reported figure.
      </p>
    </section>
  );
}
