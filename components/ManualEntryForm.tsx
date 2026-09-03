'use client';

import { useMemo, useState } from 'react';
import { isPlausibleReportDate } from '@/lib/bengali';
import { sumRows } from '@/lib/parse';
import { REGION_EN, REGION_ORDER, type DengueReport, type RegionKey, type RegionRow } from '@/lib/types';

type Field = keyof Omit<RegionRow, 'key'>;

const FIELDS: { key: Field; label: string }[] = [
  { key: 'admitted24h', label: 'Admitted 24h' },
  { key: 'deaths24h', label: 'Deaths 24h' },
  { key: 'totalAdmitted', label: 'Total admitted' },
  { key: 'totalDeaths', label: 'Total deaths' },
  { key: 'discharged', label: 'Discharged' },
  { key: 'currentlyAdmitted', label: 'In hospital' },
];

type CellValues = Record<RegionKey, Record<Field, string>>;

function emptyCells(): CellValues {
  const blank = { admitted24h: '', deaths24h: '', totalAdmitted: '', totalDeaths: '', discharged: '', currentlyAdmitted: '' };
  return Object.fromEntries(REGION_ORDER.map((k) => [k, { ...blank }])) as CellValues;
}

function cellsFromReport(report: DengueReport): CellValues {
  const cells = emptyCells();
  for (const row of report.rows) {
    for (const f of FIELDS) {
      const v = row[f.key];
      cells[row.key][f.key] = v === null || v === undefined ? '' : String(v);
    }
  }
  return cells;
}

const toNumber = (s: string): number | null => (s.trim() === '' ? null : Number.isFinite(Number(s)) ? Number(s) : null);
const fmt = (n: number | null) => (n === null ? '—' : n.toLocaleString('en-US'));

interface Props {
  date: string;
  onDateChange: (v: string) => void;
  maxDate: string;
  initialReport: DengueReport | null;
  onSubmit: (report: DengueReport) => void;
}

/**
 * Fallback for when the DGHS fetch can't be trusted (source moved, offline,
 * or blocked) — the same figures, typed in by hand from whatever the office
 * actually has that day, flowing through the same Excel/brief/Dashboard
 * pipeline as a successful fetch. Nothing downstream needs to know the
 * numbers didn't come off a PDF.
 */
export function ManualEntryForm({ date, onDateChange, maxDate, initialReport, onSubmit }: Props) {
  const [sourceLabel, setSourceLabel] = useState(initialReport?.sourceLabel ?? '');
  const [sourceUrl, setSourceUrl] = useState(initialReport?.sourceUrl ?? '');
  const [cells, setCells] = useState<CellValues>(() =>
    initialReport ? cellsFromReport(initialReport) : emptyCells(),
  );
  const [error, setError] = useState<string | null>(null);

  const setCell = (key: RegionKey, field: Field, value: string) => {
    setCells((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const rows = useMemo<RegionRow[]>(
    () =>
      REGION_ORDER.map((key) => ({
        key,
        admitted24h: toNumber(cells[key].admitted24h),
        deaths24h: toNumber(cells[key].deaths24h),
        totalAdmitted: toNumber(cells[key].totalAdmitted),
        totalDeaths: toNumber(cells[key].totalDeaths),
        discharged: toNumber(cells[key].discharged),
        currentlyAdmitted: toNumber(cells[key].currentlyAdmitted),
      })),
    [cells],
  );

  const totals = useMemo(() => sumRows(rows), [rows]);
  const filledRows = rows.filter((r) => FIELDS.some((f) => r[f.key] !== null)).length;

  const handleSubmit = () => {
    setError(null);
    if (!isPlausibleReportDate(date)) {
      setError('Pick a date between 01 January 2023 and today.');
      return;
    }
    if (filledRows === 0) {
      setError('Enter at least one region before using this data.');
      return;
    }
    const report: DengueReport = {
      date,
      sourceUrl: sourceUrl.trim(),
      sourceLabel: sourceLabel.trim() || `Entered manually for ${date}`,
      rows,
      totals,
      comparison: initialReport?.comparison ?? [],
      extraction: {
        method: 'manual',
        confidence: 1,
        notes: ['Entered manually; not extracted from a DGHS PDF. Figures are only as accurate as the entry.'],
      },
    };
    onSubmit(report);
  };

  return (
    <section className="rounded-panel bg-card p-5 shadow-panel">
      <h2 className="text-sm font-semibold text-ink">Enter figures manually</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        For when the DGHS fetch can&apos;t be trusted. Type in the day&apos;s figures from wherever your
        office actually has them — the workbook, brief and Dashboard all work the same either way.
      </p>

      <label className="mt-4 block text-[13px] font-medium text-ink" htmlFor="manual-date">
        Report date
      </label>
      <input
        id="manual-date"
        type="date"
        value={date}
        max={maxDate}
        min="2023-01-01"
        onChange={(e) => onDateChange(e.target.value)}
        className="mt-1.5 w-full rounded-sheet border border-rule bg-white px-3 py-2 text-sm text-ink"
      />

      <label className="mt-3 block text-[13px] font-medium text-ink" htmlFor="manual-source-label">
        Source note <span className="text-muted">(optional)</span>
      </label>
      <input
        id="manual-source-label"
        type="text"
        value={sourceLabel}
        onChange={(e) => setSourceLabel(e.target.value)}
        placeholder="e.g. DGHS press briefing, phoned in by control room"
        className="mt-1.5 w-full rounded-sheet border border-rule bg-white px-3 py-2 text-[13px] text-ink"
      />

      <label className="mt-3 block text-[13px] font-medium text-ink" htmlFor="manual-source-url">
        Source link <span className="text-muted">(optional)</span>
      </label>
      <input
        id="manual-source-url"
        type="url"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="https://…"
        className="mt-1.5 w-full rounded-sheet border border-rule bg-white px-3 py-2 text-[13px] text-ink"
      />

      <div className="mt-4 overflow-x-auto">
        <table className="sheet-table min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left">Division</th>
              {FIELDS.map((f) => (
                <th key={f.key}>{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REGION_ORDER.map((key) => (
              <tr key={key}>
                <td className="whitespace-nowrap text-[13px]">{REGION_EN[key]}</td>
                {FIELDS.map((f) => (
                  <td key={f.key} className="p-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={cells[key][f.key]}
                      onChange={(e) => setCell(key, f.key, e.target.value)}
                      className="w-16 rounded-sheet border border-rule bg-white px-1.5 py-1 text-center text-[13px] text-ink"
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="text-[13px] font-semibold">Total</td>
              {FIELDS.map((f) => (
                <td key={f.key} className="text-center text-[13px] font-semibold">
                  {fmt(totals[f.key])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {error && <p className="mt-3 text-[13px] text-alert">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        className="mt-4 w-full rounded-sheet bg-signal px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
      >
        Use this data
      </button>
      <p className="mt-2 text-micro text-muted">
        Leave a division blank to leave it null. {filledRows} of {REGION_ORDER.length} divisions have at
        least one figure.
      </p>
    </section>
  );
}
