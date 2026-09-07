import { toAsciiDigits } from './bengali';
import { REGION_ORDER, type RegionKey, type RegionRow, type YearComparison } from './types';

/**
 * Pattern-based extraction from the press-release text.
 *
 * The DGHS PDF is produced from a Word template that has been broadly stable
 * since 2023, but the text layer is not: depending on which machine generated
 * it, Bangla comes out as Unicode, as legacy SutonnyMJ bytes, or (on scanned
 * days) not at all. So every region is matched against several spellings, and
 * the caller is told how much of the sheet was actually recognised. When
 * confidence is low, `lib/ai.ts` re-reads the PDF with a model instead.
 */

/** Spellings that have been observed for each region across the archive. */
const REGION_PATTERNS: Record<RegionKey, string[]> = {
  DHAKA_NORTH_CITY: ['ঢাকা উত্তর', 'ঢাকা  উত্তর', 'XvKv DËi', 'dhaka north'],
  DHAKA_SOUTH_CITY: ['ঢাকা দক্ষিণ', 'ঢাকা  দক্ষিণ', 'XvKv `w¶Y', 'dhaka south'],
  DHAKA_DIVISION: ['ঢাকা বিভাগ', 'ঢাকা  বিভাগ', 'XvKv wefvM', 'dhaka division'],
  MYMENSINGH: ['ময়মনসিংহ', 'gqgbwmsn', 'mymensingh'],
  CHATTOGRAM: ['চট্টগ্রাম', 'চট্রগ্রাম', 'চট্টগ্ৰাম', 'PÆMÖvg', 'chattogram', 'chittagong'],
  KHULNA: ['খুলনা', 'Lyjbv', 'khulna'],
  RAJSHAHI: ['রাজশাহী', 'রাজশাহি', 'ivRkvnx', 'rajshahi'],
  RANGPUR: ['রংপুর', 'iscyi', 'rangpur'],
  BARISHAL: ['বরিশাল', 'ewikvj', 'barishal', 'barisal'],
  SYLHET: ['সিলেট', 'wm‡jU', 'sylhet'],
};

const TOTAL_PATTERNS = ['সর্বমোট', 'সববম ট', 'me©‡gvU', 'total'];

/** Collapse whitespace and normalise digits so one regex family covers everything. */
function normalise(raw: string): string {
  return toAsciiDigits(raw)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e]/g, '')
    .replace(/[ \t]+/g, ' ');
}

/** Pull every integer out of a line, in order. Commas and Bangla digits handled. */
function numbersIn(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(/-?\d[\d,]*/g)) {
    const n = Number(m[0].replace(/,/g, ''));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Map the numbers on a region line onto the six reported columns.
 *
 * The table reads: serial | region | admitted(24h) | deaths(24h) |
 *                  total admitted | total deaths | discharged | currently admitted
 *
 * The serial number sits before the region name, so it is dropped by slicing
 * from the end: the six data columns are always the trailing six integers.
 */
function assignColumns(nums: number[]): Omit<RegionRow, 'key'> | null {
  if (nums.length < 6) return null;
  const [admitted24h, deaths24h, totalAdmitted, totalDeaths, discharged, currentlyAdmitted] =
    nums.slice(-6);
  return { admitted24h, deaths24h, totalAdmitted, totalDeaths, discharged, currentlyAdmitted };
}

export interface PatternResult {
  rows: RegionRow[];
  totals: Omit<RegionRow, 'key'> | null;
  comparison: YearComparison[];
  confidence: number;
  notes: string[];
}

export function parseReportText(rawText: string, reportYear: number): PatternResult {
  const text = normalise(rawText);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lower = lines.map((l) => l.toLowerCase());

  const notes: string[] = [];
  const rows: RegionRow[] = [];

  for (const key of REGION_ORDER) {
    const pats = REGION_PATTERNS[key];
    let hit = -1;
    for (let i = 0; i < lines.length && hit < 0; i++) {
      if (pats.some((p) => (p === p.toLowerCase() && /[a-z]/.test(p) ? lower[i].includes(p) : lines[i].includes(p)))) {
        hit = i;
      }
    }
    if (hit < 0) continue;

    // Numbers usually share the region's line. Some exports wrap the row, so
    // fall back to joining the next line before giving up.
    let cols = assignColumns(numbersIn(lines[hit]));
    if (!cols && hit + 1 < lines.length) {
      cols = assignColumns(numbersIn(`${lines[hit]} ${lines[hit + 1]}`));
      if (cols) notes.push(`Row for ${key} spanned two lines in the PDF text.`);
    }
    if (cols) rows.push({ key, ...cols });
  }

  // The sheet's own grand-total row, used as a check rather than a source.
  let totals: Omit<RegionRow, 'key'> | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (TOTAL_PATTERNS.some((p) => lines[i].includes(p) || lower[i].includes(p))) {
      const c = assignColumns(numbersIn(lines[i]));
      if (c) {
        totals = c;
        break;
      }
    }
  }

  const summed = sumRows(rows);
  if (totals && rows.length > 0) {
    const mismatches = (Object.keys(summed) as (keyof typeof summed)[]).filter(
      (k) => totals![k] !== null && summed[k] !== null && totals![k] !== summed[k],
    );
    if (mismatches.length) {
      notes.push(
        `The sheet's own total row disagrees with the sum of the region rows on: ${mismatches.join(', ')}. Region rows were used.`,
      );
    }
  }

  const comparison = parseComparison(text, reportYear, notes);

  // Confidence is driven by how much of the table we actually recognised.
  const coverage = rows.length / 10;
  let confidence = coverage;
  if (totals) confidence += 0.1;
  if (comparison.length >= 2) confidence += 0.05;
  if (rows.length === 0) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));

  if (rows.length && rows.length < REGION_ORDER.length) {
    const missing = REGION_ORDER.filter((k) => !rows.some((r) => r.key === k));
    notes.push(`No line matched for: ${missing.join(', ')}.`);
  }
  if (!rows.length) notes.push('No region rows were recognised in the PDF text layer.');

  return { rows, totals: totals ?? (rows.length ? summed : null), comparison, confidence, notes };
}

// ---------------------------------------------------------------------------
// BI-dashboard export parser
// ---------------------------------------------------------------------------

/**
 * DGHS's current press release (published via dghs.gov.bd, not the old dead
 * `old.dghs.gov.bd`) is exported from a BI/dashboard tool, not the plain
 * Bangla table `parseReportText` above was built for. Its charts extract as
 * text in a very specific, consistent shape:
 *
 *   [heading] No. [value][value]...[value] [axis word] [label][label]...
 *
 * Two quirks make this workable rather than hopeless:
 * - Each chart's data-label number is duplicated three times back-to-back
 *   with no separator (e.g. "137137137" for the value 137) — an artifact of
 *   how the chart's SVG/canvas text layer gets extracted. `detriple` reverses it.
 * - Zero-value bars are omitted from the chart entirely, so the number list
 *   and the label list are always the same length and in the same left-to-
 *   right order as each other — just not always length 10. Matching is done
 *   by position within each chart, not by a fixed slot per region.
 *
 * Per-division "discharged" and "currently admitted" are not published at
 * division granularity anywhere in this document — only as national totals —
 * so those two fields are left `null` on every row. The caller fills in the
 * national totals directly.
 */

const BI_HEADINGS = [
  'Dengue cases of last 24 hours',
  'Dengue death of last 24 hours',
  'Division & City corporation cases of last 24 hours',
  'Division & City corporation deaths of last 24 hours',
  'Discharged',
  'Total Dengue cases from 1 January to Till date',
  'Total Dengue deaths from 1 January to till date',
  'Division & City corporation wise reported cases from 1 January to till date',
  'Division & City corporation wise deaths from 1 January to till date',
] as const;

/** English spellings for each region as they appear in this specific export. */
const BI_AREA_PATTERNS: Record<RegionKey, RegExp> = {
  DHAKA_NORTH_CITY: /DNCC/,
  DHAKA_SOUTH_CITY: /DSCC/,
  DHAKA_DIVISION: /Dhaka[\s\S]{0,20}Out\s*of\s*CC/i,
  MYMENSINGH: /Mymensingh/i,
  CHATTOGRAM: /Chattogram/i,
  KHULNA: /Khulna/i,
  RAJSHAHI: /Rajshahi/i,
  RANGPUR: /Rangpur/i,
  BARISHAL: /Barishal/i,
  SYLHET: /Sylhet/i,
};

/** "137137137" -> 137. A token that isn't evenly triplicated is taken literally. */
function detriple(token: string): number | null {
  const digits = token.replace(/,/g, '');
  if (!digits.length) return null;
  if (digits.length % 3 === 0) {
    const n = digits.length / 3;
    const a = digits.slice(0, n);
    const b = digits.slice(n, 2 * n);
    const c = digits.slice(2 * n);
    if (a === b && b === c) return Number(a);
  }
  const asNumber = Number(digits);
  return Number.isFinite(asNumber) ? asNumber : null;
}

/** The window of text from one known heading up to whichever heading follows it. */
function sectionWindow(text: string, heading: string): string | null {
  const start = text.indexOf(heading);
  if (start < 0) return null;
  const from = start + heading.length;
  let end = text.length;
  for (const h of BI_HEADINGS) {
    if (h === heading) continue;
    const idx = text.indexOf(h, from);
    if (idx >= 0 && idx < end) end = idx;
  }
  return text.slice(from, end);
}

/** The single national figure that follows a heading's "No." marker. */
function nationalValueAfter(text: string, heading: string): number | null {
  const win = sectionWindow(text, heading);
  if (!win) return null;
  const afterNo = win.indexOf('No.');
  const scanFrom = afterNo >= 0 ? afterNo + 3 : 0;
  const token = win.slice(scanFrom).match(/\d[\d,]*/);
  return token ? detriple(token[0]) : null;
}

/**
 * A chart section's per-area figures, matched by position: the Nth number in
 * the value block pairs with the Nth region name found in the label block
 * that follows it (whichever regions actually appear — zero-value bars are
 * dropped from the source, not zero-filled).
 */
function chartValuesByArea(text: string, heading: string, notes: string[]): Partial<Record<RegionKey, number>> {
  const win = sectionWindow(text, heading);
  if (!win) {
    notes.push(`Section "${heading}" was not found in the PDF text.`);
    return {};
  }

  // The label block starts at the first recognised region name; everything
  // before that (after "No.") is the chart's value list.
  let labelStart = win.length;
  for (const key of REGION_ORDER) {
    const m = win.match(BI_AREA_PATTERNS[key]);
    if (m && m.index !== undefined && m.index < labelStart) labelStart = m.index;
  }
  const afterNo = win.indexOf('No.');
  const valuesText = win.slice(afterNo >= 0 ? afterNo + 3 : 0, labelStart);
  const labelsText = win.slice(labelStart);

  const values = [...valuesText.matchAll(/\d[\d,]*/g)].map((m) => detriple(m[0])).filter((v): v is number => v !== null);

  const found = REGION_ORDER.map((key) => {
    const m = labelsText.match(BI_AREA_PATTERNS[key]);
    return m && m.index !== undefined ? { key, index: m.index } : null;
  })
    .filter((v): v is { key: RegionKey; index: number } => v !== null)
    .sort((a, b) => a.index - b.index);

  if (values.length !== found.length) {
    notes.push(
      `"${heading}" listed ${values.length} value(s) but ${found.length} region name(s) were recognised; that section was skipped.`,
    );
    return {};
  }

  const out: Partial<Record<RegionKey, number>> = {};
  found.forEach(({ key }, i) => {
    out[key] = values[i];
  });
  return out;
}

export function parseBiPressRelease(rawText: string, _reportYear: number): PatternResult {
  const text = normalise(rawText);
  const notes: string[] = [];

  if (!text.includes('Division & City corporation')) {
    return { rows: [], totals: null, comparison: [], confidence: 0, notes: ['Not a recognised BI-export press release.'] };
  }

  const admitted24h = chartValuesByArea(text, 'Division & City corporation cases of last 24 hours', notes);
  const deaths24h = chartValuesByArea(text, 'Division & City corporation deaths of last 24 hours', notes);
  const totalAdmitted = chartValuesByArea(
    text,
    'Division & City corporation wise reported cases from 1 January to till date',
    notes,
  );
  const totalDeaths = chartValuesByArea(
    text,
    'Division & City corporation wise deaths from 1 January to till date',
    notes,
  );

  // Divisions with zero cases for a metric are simply absent from that
  // metric's chart, not published as zero — so an area missing from e.g.
  // deaths24h genuinely means 0, not "unknown". Only totalAdmitted (every
  // division has *some* cumulative case count) is required for a row to
  // count as recognised at all.
  const rows: RegionRow[] = REGION_ORDER.filter((key) => key in totalAdmitted).map((key) => ({
    key,
    admitted24h: admitted24h[key] ?? 0,
    deaths24h: deaths24h[key] ?? 0,
    totalAdmitted: totalAdmitted[key] ?? null,
    totalDeaths: totalDeaths[key] ?? 0,
    discharged: null,
    currentlyAdmitted: null,
  }));

  const nationalAdmitted24h = nationalValueAfter(text, 'Dengue cases of last 24 hours');
  const nationalDeaths24hAnnotation = text.match(/●\s*Death:\s*(\d[\d,]*)/);
  const nationalDeaths24h = nationalDeaths24hAnnotation
    ? Number(nationalDeaths24hAnnotation[1].replace(/,/g, ''))
    : nationalValueAfter(text, 'Dengue death of last 24 hours');
  const nationalTotalAdmitted = nationalValueAfter(text, 'Total Dengue cases from 1 January to Till date');
  const nationalTotalDeaths = nationalValueAfter(text, 'Total Dengue deaths from 1 January to till date');

  const dischargedWindow = sectionWindow(text, 'Discharged');
  const dischargedValues = dischargedWindow
    ? [...dischargedWindow.matchAll(/\d[\d,]*/g)].map((m) => detriple(m[0])).filter((v): v is number => v !== null)
    : [];
  const dischargedCumulative = dischargedValues[1] ?? null;

  // Not published anywhere in this document: derived the same way the
  // source's own per-hospital tables do it (verified against a real sample:
  // 1,551 admitted - 22 deaths - 1,457 discharged = 72 currently admitted).
  const currentlyAdmitted =
    nationalTotalAdmitted !== null && nationalTotalDeaths !== null && dischargedCumulative !== null
      ? nationalTotalAdmitted - nationalTotalDeaths - dischargedCumulative
      : null;

  if (dischargedCumulative === null) notes.push('National cumulative discharge figure was not found.');
  notes.push(
    'Per-division "discharged" and "currently admitted" are not published in this report; only the national totals are real figures.',
  );

  const totals: Omit<RegionRow, 'key'> = {
    admitted24h: nationalAdmitted24h,
    deaths24h: nationalDeaths24h,
    totalAdmitted: nationalTotalAdmitted,
    totalDeaths: nationalTotalDeaths,
    discharged: dischargedCumulative,
    currentlyAdmitted,
  };

  const coverage = rows.length / REGION_ORDER.length;
  let confidence = coverage * 0.85; // capped below 1, since discharged/currentlyAdmitted are never per-row real data
  if (nationalTotalAdmitted !== null) confidence += 0.1;
  if (rows.length === 0) confidence = 0;
  confidence = Math.max(0, Math.min(0.95, confidence));

  if (rows.length && rows.length < REGION_ORDER.length) {
    const missing = REGION_ORDER.filter((k) => !rows.some((r) => r.key === k));
    notes.push(`No cumulative figure found for: ${missing.join(', ')}.`);
  }

  // This document carries no year-on-year comparison table of its own.
  const comparison: YearComparison[] = [];

  return { rows, totals, comparison, confidence, notes };
}

export function sumRows(rows: RegionRow[]): Omit<RegionRow, 'key'> {
  const add = (k: keyof Omit<RegionRow, 'key'>) => {
    const vals = rows.map((r) => r[k]).filter((v): v is number => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  return {
    admitted24h: add('admitted24h'),
    deaths24h: add('deaths24h'),
    totalAdmitted: add('totalAdmitted'),
    totalDeaths: add('totalDeaths'),
    discharged: add('discharged'),
    currentlyAdmitted: add('currentlyAdmitted'),
  };
}

/**
 * The second table compares this year to last year over the same window.
 * It is short and its shape is stable, so a line-scan for the two years works.
 */
function parseComparison(text: string, reportYear: number, notes: string[]): YearComparison[] {
  const out: YearComparison[] = [];
  for (const year of [reportYear - 1, reportYear]) {
    const re = new RegExp(`${year}[^\\n]*`, 'g');
    for (const m of text.matchAll(re)) {
      const nums = numbersIn(m[0]).filter((n) => n !== year);
      // Expect at least [cases, deaths] after dropping the date fragments.
      const tail = nums.filter((n) => n >= 0);
      if (tail.length >= 2) {
        out.push({ year, cases: tail[tail.length - 2], deaths: tail[tail.length - 1] });
        break;
      }
    }
  }
  if (out.length < 2) notes.push('The year-on-year comparison table was not fully recognised.');
  return out;
}
