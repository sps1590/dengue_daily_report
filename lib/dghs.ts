import { toAsciiDigits } from './bengali';

/**
 * `old.dghs.gov.bd` — the domain this app originally targeted — is dead: DNS
 * resolves but the TCP connection never completes, from every network this
 * was checked from (see docs/PROGRESS.md, v1.2.0). DGHS's current site lists
 * miscellaneous notices, filtered here to the dengue press-release category.
 * Each listing row already carries a direct link to that day's PDF — no
 * second "detail page" fetch is needed.
 */
export const LISTING_URL =
  'https://dghs.gov.bd/pages/miscellaneous-infos?filters=%7B%22miscellaneous_info_type%22%3A%226a9cf0471fa8cd87d1f50227%22%7D';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BROWSER_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
};

export interface ListingEntry {
  /** ISO date parsed from the row's publish_date column. */
  date: string;
  /** The row's own title, e.g. "ডেঙ্গু প্রেস রিলিজ (০৬/০৯/২০২৬)". */
  title: string;
  /** Direct link to the PDF attached to this row. */
  pdfUrl: string;
}

/** "০৬-০৯-২০২৬" -> "2026-09-06" */
function parseListingDate(bengaliDdMmYyyy: string): string | null {
  const ascii = toAsciiDigits(bengaliDdMmYyyy.trim());
  const m = ascii.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * The listing is a small, server-rendered HTML table (confirmed by fetching
 * it directly — no client-side rendering to work around). Each row holds a
 * title, a file link, and a publish date; pull all three with one regex pass
 * rather than a full HTML parser, since the markup is simple and stable.
 */
function parseListingRows(html: string): ListingEntry[] {
  const rows: ListingEntry[] = [];
  const rowRe = /<tr class="table-tr">([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html))) {
    const row = rowMatch[1];
    const titleMatch = row.match(/data-column="title"[^>]*>\s*([^<]*?)\s*<\/td>/);
    const pdfMatch = row.match(/data-column="files"[\s\S]*?href="([^"]+\.pdf)"/);
    const dateMatch = row.match(/data-column="publish_date"[\s\S]*?<span>([^<]+)<\/span>/);
    if (!titleMatch || !pdfMatch || !dateMatch) continue;
    const date = parseListingDate(dateMatch[1]);
    if (!date) continue;
    rows.push({ date, title: titleMatch[1].trim(), pdfUrl: pdfMatch[1] });
  }
  return rows;
}

/**
 * Turns whatever `fetch()` throws for a network-level failure (Node's
 * undici gives the unhelpful, literal message "fetch failed" for a
 * connection reset/refused/timed-out) into something a user can act on.
 * This is what shows up when DGHS's server — or a WAF in front of it —
 * won't complete the connection from this network at all, which is a real,
 * observed failure mode distinct from "this date isn't published".
 */
function describeNetworkFailure(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/fetch failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|network/i.test(message)) {
    return new Error(
      "Could not reach the DGHS server from here — it isn't responding to this app's requests right now " +
        '(this can happen when a government server rate-limits or firewalls automated traffic). ' +
        'This isn\'t about the date you picked: switch to "Upload PDF" and attach the release yourself, or try fetching again in a few minutes.',
    );
  }
  return err instanceof Error ? err : new Error(message);
}

/**
 * A short in-memory cache for the listing fetch. Best-effort only — a
 * serverless function instance is not guaranteed to survive between
 * requests — but when it does, this both cuts DGHS's own load from repeat
 * "Fetch report" clicks (several users checking the same day) and reduces
 * how often this app's own traffic could look like a burst worth blocking.
 */
let listingCache: { at: number; entries: ListingEntry[] } | null = null;
const LISTING_CACHE_MS = 5 * 60 * 1000;

async function fetchListingOnce(): Promise<ListingEntry[]> {
  const res = await fetch(LISTING_URL, {
    headers: BROWSER_HEADERS,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`The DGHS listing page returned ${res.status}.`);
  const html = await res.text();
  return parseListingRows(html);
}

export async function fetchListing(): Promise<ListingEntry[]> {
  if (listingCache && Date.now() - listingCache.at < LISTING_CACHE_MS) {
    return listingCache.entries;
  }
  try {
    const entries = await fetchListingOnce();
    listingCache = { at: Date.now(), entries };
    return entries;
  } catch (err) {
    // One retry: government servers occasionally drop a single connection
    // without it meaning anything is actually down.
    try {
      const entries = await fetchListingOnce();
      listingCache = { at: Date.now(), entries };
      return entries;
    } catch {
      throw describeNetworkFailure(err);
    }
  }
}

export interface LocateResult {
  url: string;
  label: string;
  note: string;
}

/**
 * Find the listing row for a given date. Unlike the old (dead) source, there
 * is no derivable URL here — the listing is the only way to find a given
 * day's PDF, and it currently only carries the entries DGHS has chosen to
 * keep published, not a full dated archive.
 */
export async function locateRelease(iso: string): Promise<LocateResult> {
  const entries = await fetchListing();
  const hit = entries.find((e) => e.date === iso);
  if (!hit) {
    const available = entries.map((e) => e.date).join(', ') || 'none';
    throw new NotPublishedError(
      `DGHS's current listing does not carry a dengue press release for this date. Dates currently listed: ${available}.`,
    );
  }
  return { url: hit.pdfUrl, label: hit.title, note: 'Matched on the DGHS miscellaneous-info listing.' };
}

export interface DownloadResult {
  bytes: Uint8Array;
  contentType: string;
  size: number;
}

export async function downloadPdf(url: string): Promise<DownloadResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Accept: 'application/pdf,*/*' },
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    throw describeNetworkFailure(err);
  }
  if (!res.ok) {
    throw new NotPublishedError(`The DGHS file server returned ${res.status} for this file.`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder().decode(buf.slice(0, 5));
  if (head !== '%PDF-') {
    throw new NotPublishedError('The link for this date did not return a PDF.');
  }
  return { bytes: buf, contentType: res.headers.get('content-type') ?? 'application/pdf', size: buf.byteLength };
}

export class NotPublishedError extends Error {
  readonly code = 'NOT_PUBLISHED';
}
