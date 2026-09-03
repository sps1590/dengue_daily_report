import type { DengueReport, ManagementBrief } from './types';

/**
 * Local, per-browser record of every report that has been fetched, so the
 * dashboard can re-offer downloads without re-fetching from DGHS. Nothing here
 * leaves the browser — there is no server-side store yet (see PROGRESS.md).
 */
export interface HistoryEntry {
  date: string;
  savedAt: string;
  report: DengueReport;
  brief?: ManagementBrief;
}

const KEY = 'dengue-daily:history:v1';
const MAX_ENTRIES = 60;

function read(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable or full — the current session still works, it just
    // will not be there next time.
  }
}

export function listHistory(): HistoryEntry[] {
  return read().sort((a, b) => b.date.localeCompare(a.date));
}

export function saveReport(report: DengueReport): void {
  const entries = read();
  const existing = entries.find((e) => e.date === report.date);
  if (existing) {
    existing.report = report;
    existing.savedAt = new Date().toISOString();
  } else {
    entries.push({ date: report.date, savedAt: new Date().toISOString(), report });
  }
  write(entries.slice(-MAX_ENTRIES));
}

export function saveBrief(date: string, brief: ManagementBrief): void {
  const entries = read();
  const existing = entries.find((e) => e.date === date);
  if (!existing) return;
  existing.brief = brief;
  write(entries);
}

export function removeEntry(date: string): void {
  write(read().filter((e) => e.date !== date));
}

export function clearHistory(): void {
  write([]);
}
