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

/**
 * The miscellaneous-infos listing above only carries recent releases (it
 * dropped everything on/before 03/09/2026 at some point). Older releases —
 * back to 27/08/2019 — live on this separate static page instead, under a
 * completely different markup shape (see `fetchArchiveListing`).
 */
export const ARCHIVE_LISTING_URL =
  'https://dghs.gov.bd/pages/static-pages/dengue-press-release-gxrgtg-6a9eb4cc7a024513d1b8c896';

/** Dates on or before this go to the archive page; anything after it goes to the live listing. */
export const ARCHIVE_CUTOFF_DATE = '2026-09-03';

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

// ---------------------------------------------------------------------------
// Archive listing (releases on/before ARCHIVE_CUTOFF_DATE)
// ---------------------------------------------------------------------------

/**
 * The archive page's link list isn't in its server-rendered HTML at all — the
 * whole thing sits inside a custom `<rt-renderer encoded-content="...">`
 * element, as base64. That attribute is not one contiguous base64 block: it's
 * several independently-encoded chunks joined with ";", each ending in its
 * own "=" padding. Decoding chunk-by-chunk as raw bytes and concatenating
 * *before* the final UTF-8 decode (rather than decoding each chunk to a
 * string and concatenating strings) avoids corrupting a multi-byte Bangla
 * character that happens to fall across a chunk boundary.
 */
function decodeRtRenderer(html: string): string | null {
  const m = html.match(/<rt-renderer[^>]*\bencoded-content="([^"]*)"/);
  if (!m) return null;
  const buffers: Buffer[] = [];
  for (const chunk of m[1].split(';')) {
    if (!chunk) continue;
    try {
      buffers.push(Buffer.from(chunk, 'base64'));
    } catch {
      // Skip a malformed chunk rather than fail the whole page.
    }
  }
  return Buffer.concat(buffers).toString('utf-8');
}

/**
 * The archive spans 2019-2026 and was clearly maintained by hand: the last
 * ~year of entries link a uniform `vpr/YYYYMMDD_dengue_all.pdf`, but older
 * ones use at least four different naming schemes. Read the date from the
 * PDF's own filename — never from the link's visible Bangla text — since the
 * filename is plain ASCII and unaffected by the chunk-boundary risk above.
 * Verified against the live archive: 1878 of 1879 linked files matched one of
 * these patterns; the one holdout uses a filename that doesn't encode a date
 * at all and is simply skipped.
 */
function dateFromArchiveFilename(url: string): string | null {
  let m = url.match(/\/(\d{4})(\d{2})(\d{2})_dengue_all\.pdf(?:[?#]|$)/i);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = url.match(/Dengue_(\d{4})(\d{2})(\d{2})\.pdf(?:[?#]|$)/i);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = url.match(/Dengue_(\d{4})_(\d{2})_(\d{2})\.pdf(?:[?#]|$)/i);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = url.match(/\/(\d{4})(\d{2})(\d{2})\.pdf(?:[?#]|$)/i);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = url.match(/Dengue_(\d{1,2})_(\d{1,2})_(\d{2})\.pdf(?:[?#]|$)/i);
  if (m) return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function parseArchiveEntries(decodedHtml: string): ListingEntry[] {
  const out: ListingEntry[] = [];
  const linkRe = /<a href="([^"]+\.pdf)">([^<]*)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(decodedHtml))) {
    const [, pdfUrl, title] = m;
    const date = dateFromArchiveFilename(pdfUrl);
    if (!date) continue;
    out.push({ date, title: title.trim(), pdfUrl });
  }
  return out;
}

let archiveCache: { at: number; entries: ListingEntry[] } | null = null;
/** Changes at most once a day and only near the cutoff, so a longer cache than the live listing is safe. */
const ARCHIVE_CACHE_MS = 30 * 60 * 1000;

async function fetchArchiveListingOnce(): Promise<ListingEntry[]> {
  const res = await fetch(ARCHIVE_LISTING_URL, {
    headers: BROWSER_HEADERS,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`The DGHS archive page returned ${res.status}.`);
  const html = await res.text();
  const decoded = decodeRtRenderer(html);
  if (!decoded) throw new Error("The DGHS archive page's content block was not found.");
  return parseArchiveEntries(decoded);
}

export async function fetchArchiveListing(): Promise<ListingEntry[]> {
  if (archiveCache && Date.now() - archiveCache.at < ARCHIVE_CACHE_MS) {
    return archiveCache.entries;
  }
  try {
    const entries = await fetchArchiveListingOnce();
    archiveCache = { at: Date.now(), entries };
    return entries;
  } catch (err) {
    try {
      const entries = await fetchArchiveListingOnce();
      archiveCache = { at: Date.now(), entries };
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
 * Find a given date's release. Dates on/before ARCHIVE_CUTOFF_DATE come from
 * the archive page; everything after it comes from the live miscellaneous-
 * infos listing, which is the only one of the two that gets same-day updates.
 */
export async function locateRelease(iso: string): Promise<LocateResult> {
  const isArchive = iso <= ARCHIVE_CUTOFF_DATE;
  const entries = isArchive ? await fetchArchiveListing() : await fetchListing();
  const hit = entries.find((e) => e.date === iso);
  if (!hit) {
    if (isArchive) {
      throw new NotPublishedError(
        `DGHS's dengue press-release archive does not carry a release for this date (it covers ${entries[entries.length - 1]?.date ?? 'unknown'} through ${ARCHIVE_CUTOFF_DATE}, but not every day in that range was published).`,
      );
    }
    const available = entries.map((e) => e.date).join(', ') || 'none';
    throw new NotPublishedError(
      `DGHS's current listing does not carry a dengue press release for this date. Dates currently listed: ${available}.`,
    );
  }
  return {
    url: hit.pdfUrl,
    label: hit.title,
    note: isArchive ? 'Matched on the DGHS dengue press-release archive page.' : 'Matched on the DGHS miscellaneous-info listing.',
  };
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
