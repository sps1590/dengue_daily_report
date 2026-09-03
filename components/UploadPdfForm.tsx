'use client';

import { useRef } from 'react';
import { toBengaliDateLabel } from '@/lib/bengali';

interface Props {
  date: string;
  onDateChange: (v: string) => void;
  maxDate: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  busy: boolean;
}

const fmtSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

/**
 * Fallback for when the DGHS fetch can't be trusted — upload the press
 * release PDF from wherever it was actually obtained, and it runs through
 * the same pattern-parser / model-fallback pipeline as a live fetch.
 */
export function UploadPdfForm({ date, onDateChange, maxDate, file, onFileChange, onAnalyze, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="rounded-panel bg-card p-5 shadow-panel">
      <h2 className="text-sm font-semibold text-ink">Upload the press release PDF</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        For when the DGHS fetch can&apos;t reach the source. Upload the day&apos;s PDF from wherever you
        actually have it — it&apos;s read with the same pattern parser and model fallback as a live fetch.
      </p>

      <label className="mt-4 block text-[13px] font-medium text-ink" htmlFor="upload-date">
        Report date
      </label>
      <input
        id="upload-date"
        type="date"
        value={date}
        max={maxDate}
        min="2023-01-01"
        onChange={(e) => onDateChange(e.target.value)}
        className="mt-1.5 w-full rounded-sheet border border-rule bg-white px-3 py-2 text-sm text-ink"
      />
      <p className="mt-2 text-micro text-muted">
        Labelled as{' '}
        <span className="font-bangla text-[12px] text-ink">ডেঙ্গু প্রেস রিলিজ {toBengaliDateLabel(date)}</span>{' '}
        on DGHS releases.
      </p>

      <label className="mt-4 block text-[13px] font-medium text-ink">PDF file</label>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-1.5 w-full rounded-sheet border border-dashed border-rule bg-paper px-3 py-4 text-center text-[13px] text-muted transition-colors hover:border-signal hover:text-signal"
      >
        {file ? (
          <span className="text-ink">
            {file.name} <span className="text-muted">({fmtSize(file.size)})</span>
          </span>
        ) : (
          'Click to choose a PDF'
        )}
      </button>

      <button
        type="button"
        onClick={onAnalyze}
        disabled={!file || busy}
        className="mt-4 w-full rounded-sheet bg-signal px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:bg-muted"
      >
        {busy ? 'Analysing the PDF…' : 'Analyse PDF'}
      </button>
    </section>
  );
}
