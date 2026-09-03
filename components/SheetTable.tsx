'use client';

import { useState } from 'react';
import { LABELS, REGION_LABELS } from '@/lib/bijoy';
import { REGION_EN, type DengueReport } from '@/lib/types';

const fmt = (n: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US'));

/**
 * The table is shown the way it will land in the workbook: same column order,
 * same grand-total row, same two-level header. Toggling to Bangla shows the
 * exact division labels that get written to the file.
 */
export function SheetTable({ report }: { report: DengueReport }) {
  const [bangla, setBangla] = useState(false);
  const year = report.date.slice(0, 4);

  return (
    <section className="rounded-panel bg-card shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <h2 className="text-sm font-semibold">Division-wise figures</h2>
        <div className="flex gap-1 rounded-sheet border border-rule p-0.5">
          {[
            { v: false, label: 'English' },
            { v: true, label: 'বাংলা' },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setBangla(opt.v)}
              className={`rounded-[2px] px-2.5 py-1 text-micro ${
                bangla === opt.v ? 'bg-signal text-white' : 'text-muted hover:text-ink'
              } ${opt.v ? 'font-bangla' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto px-5 py-4">
        <table className="sheet-table">
          <thead>
            <tr>
              <th rowSpan={2} className="w-10">#</th>
              <th rowSpan={2} className="text-left">
                {bangla ? <span className="font-bangla">{LABELS.divisionName.unicode}</span> : 'Division'}
              </th>
              <th colSpan={2}>
                {bangla ? <span className="font-bangla">{LABELS.last24h.unicode}</span> : 'Last 24 hours'}
              </th>
              <th colSpan={3}>
                {bangla ? (
                  <span className="font-bangla">{`০১ জানুয়ারি ${year} হতে অদ্যাবধি`}</span>
                ) : (
                  `Since 01 January ${year}`
                )}
              </th>
              <th rowSpan={2}>
                {bangla ? (
                  <span className="font-bangla">{LABELS.currentlyAdmitted.unicode}</span>
                ) : (
                  'In hospital now'
                )}
              </th>
            </tr>
            <tr>
              <th>{bangla ? <span className="font-bangla">{LABELS.admitted.unicode}</span> : 'Admitted'}</th>
              <th>{bangla ? <span className="font-bangla">{LABELS.deaths.unicode}</span> : 'Deaths'}</th>
              <th>{bangla ? <span className="font-bangla">{LABELS.totalAdmitted.unicode}</span> : 'Admitted'}</th>
              <th>{bangla ? <span className="font-bangla">{LABELS.totalDeaths.unicode}</span> : 'Deaths'}</th>
              <th>{bangla ? <span className="font-bangla">{LABELS.discharged.unicode}</span> : 'Discharged'}</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r, i) => (
              <tr key={r.key}>
                <td className="text-center text-muted">{i + 1}</td>
                <td className={bangla ? 'font-bangla' : ''}>
                  {bangla ? REGION_LABELS[r.key].unicode : REGION_EN[r.key]}
                </td>
                <td className="text-center">{fmt(r.admitted24h)}</td>
                <td className={`text-center ${r.deaths24h ? 'text-alert' : ''}`}>{fmt(r.deaths24h)}</td>
                <td className="text-center">{fmt(r.totalAdmitted)}</td>
                <td className={`text-center ${r.totalDeaths ? 'text-alert' : ''}`}>{fmt(r.totalDeaths)}</td>
                <td className="text-center">{fmt(r.discharged)}</td>
                <td className="text-center">{fmt(r.currentlyAdmitted)}</td>
              </tr>
            ))}
            <tr>
              <td />
              <td className={bangla ? 'font-bangla' : ''}>
                {bangla ? LABELS.grandTotal.unicode : 'Total'}
              </td>
              <td className="text-center">{fmt(report.totals.admitted24h)}</td>
              <td className="text-center">{fmt(report.totals.deaths24h)}</td>
              <td className="text-center">{fmt(report.totals.totalAdmitted)}</td>
              <td className="text-center">{fmt(report.totals.totalDeaths)}</td>
              <td className="text-center">{fmt(report.totals.discharged)}</td>
              <td className="text-center">{fmt(report.totals.currentlyAdmitted)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
