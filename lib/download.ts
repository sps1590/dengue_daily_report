import type { DengueReport } from './types';
import { workbookFilename } from './filename';
import { downloadFile } from './export-brief';

/**
 * Shared by the Report page and the Dashboard — both need to turn a
 * `DengueReport` already held client-side into the downloaded workbook.
 * Returns an error message on failure, `null` on success.
 */
export async function downloadExcelFile(
  report: DengueReport,
  script: 'legacy' | 'unicode',
): Promise<string | null> {
  const res = await fetch('/api/excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report, script }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return err.error ?? 'The workbook could not be built.';
  }
  downloadFile(
    workbookFilename(report.date),
    await res.blob(),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  return null;
}
