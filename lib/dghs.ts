import { toBengaliDateLabel, toCompactDate } from './bengali';

export const INDEX_URL =
  'https://old.dghs.gov.bd/index.php/bd/home/5200-daily-dengue-status-report';

const PDF_BASE = 'https://old.dghs.gov.bd/images/docs/vpr';

/**
 * DGHS names every press release the same way, so the URL is derivable without
 * touching the index page:
 *
 *   2026-09-02  ->  .../vpr/20260902_dengue_all.pdf
 *
 * The index scrape below is still worth doing as a *confirmation* step — it
 * proves the release actually exists rather than us 404-ing on a guess — but
 * the derived URL is what we fetch.
 */
export function derivePdfUrl(iso: string): string {
  return `${PDF_BASE}/${toCompactDate(iso)}_dengue_all.pdf`;
}

export function deriveLabel(iso: string): string {
  return `ডেঙ্গু প্রেস রিলিজ ${toBengaliDateLabel(iso)}`;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface LocateResult {
  url: string;
  label: string;
  /** True when the link was actually found on the index page. */
  confirmed: boolean;
  note: string;
}

/**
 * Look the date up on the index page. The page lists ~1000 links in one flat
 * document, so a single fetch covers every date we support.
 *
 * A failure here is not fatal: the derived URL is still returned, and the
 * download step decides whether the release exists.
 */
export async function locateRelease(iso: string): Promise<LocateResult> {
  const url = derivePdfUrl(iso);
  const label = deriveLabel(iso);
  const stem = `${toCompactDate(iso)}_dengue_all.pdf`;

  try {
    const res = await fetch(INDEX_URL, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      return { url, label, confirmed: false, note: `Index page returned ${res.status}; using the derived link.` };
    }
    const html = await res.text();

    // Prefer an exact filename hit, since the Bengali label occasionally
    // carries stray spaces (the 14/04/2024 entry reads "১৪ /০৪/২০২৪").
    if (html.includes(stem)) {
      return { url, label, confirmed: true, note: 'Matched on the DGHS index page.' };
    }
    const bengaliDate = toBengaliDateLabel(iso);
    if (html.includes(bengaliDate)) {
      return { url, label, confirmed: true, note: 'Matched the Bengali date label on the index page.' };
    }
    return {
      url,
      label,
      confirmed: false,
      note: 'No matching link on the index page. The release may not be published yet.',
    };
  } catch {
    return { url, label, confirmed: false, note: 'Could not reach the index page; using the derived link.' };
  }
}

export interface DownloadResult {
  bytes: Uint8Array;
  contentType: string;
  size: number;
}

export async function downloadPdf(url: string): Promise<DownloadResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' },
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    throw new NotPublishedError(
      res.status === 404
        ? 'DGHS has not published a press release for this date.'
        : `The DGHS server returned ${res.status} for this date.`,
    );
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  // A Joomla error page is HTML served with a 200.
  const head = new TextDecoder().decode(buf.slice(0, 5));
  if (head !== '%PDF-') {
    throw new NotPublishedError('The link for this date did not return a PDF.');
  }
  return { bytes: buf, contentType: res.headers.get('content-type') ?? 'application/pdf', size: buf.byteLength };
}

export class NotPublishedError extends Error {
  readonly code = 'NOT_PUBLISHED';
}
