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
  /**
   * Dhaka North + South City Corporation combined discharged/currently-admitted,
   * when the district-level table further down the PDF published it. The two
   * corporations are never split from each other there, so this is the
   * combined figure rather than an attempt at guessing a division between them
   * — see `districtTableDivisionTotals` in this file.
   */
  dhakaCityCombined?: { discharged: number; currentlyAdmitted: number } | null;
  /** Which press-release layout produced this result (set by `parseCasePdf`). */
  format?: CaseFormat;
  /** See `DengueReport.dhakaCombined`. */
  dhakaCombined?: boolean;
  /** ISO date printed on the PDF itself, when the layout carries one. */
  printedDate?: string | null;
}

export type CaseFormat = 'bi-dashboard' | 'word-table' | 'legacy-table';

export const CASE_FORMAT_LABEL: Record<CaseFormat, string> = {
  'bi-dashboard': 'DGHS BI-dashboard export (charts and per-district tables)',
  'word-table': 'DGHS Word-table layout (division summary table on page 1)',
  'legacy-table': 'older plain division table',
};

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

/**
 * Further down the same PDF, past the charts, sits a second, much longer
 * table: hospital-by-hospital and then district-by-district figures, rolling
 * up into a "বিভাগের সর্বমোট" (division grand total) row for each division.
 * That row is the only place in the document discharged and
 * currently-admitted are broken out below the national level — the charts
 * above only give admitted/deaths per division.
 *
 * Each data row (hospital, district, or division) has the same shape once
 * the leading serial number and name are dropped: government admitted +
 * private admitted = total admitted (last 24h), and discharged + currently
 * admitted + deaths = cumulative total admitted. A division's grand-total row
 * is a candidate whose "total admitted last 24h" figure matches the same
 * division's figure already read off the chart above — but that alone is not
 * unique: a smaller district or hospital subtotal elsewhere in the document
 * can coincidentally total the same 24h figure (observed live: a Mymensingh
 * district subtotal and Rangpur's actual division total both summed to 56).
 * Disambiguated by also preferring whichever matching candidate's cumulative
 * total-admitted figure lands closest to that division's cumulative figure
 * already read off the chart above, since a coincidental subtotal is always
 * for a much smaller area and so a very different cumulative count.
 *
 * Dhaka North and South City Corporation are never broken out from each
 * other in this table — the hospital list rolls straight up into one
 * "ঢাকা মহানগর" (Dhaka City) combined row — so that combined figure is
 * matched separately (by DNCC's + DSCC's 24h admissions and cumulative
 * totals) rather than forced onto either corporation individually.
 */
function districtTableDivisionTotals(
  text: string,
  admitted24hByRegion: Partial<Record<RegionKey, number>>,
  totalAdmittedByRegion: Partial<Record<RegionKey, number>>,
): {
  byRegion: Partial<Record<RegionKey, { discharged: number; currentlyAdmitted: number }>>;
  dhakaCityCombined: { discharged: number; currentlyAdmitted: number } | null;
} {
  const candidates: number[][] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const nums = numbersIn(rawLine);
    if (nums.length < 7) continue;
    const [govt, priv, total, cumulative, deaths, discharged, currentlyAdmitted] = nums.slice(-7);
    if (govt + priv !== total) continue;
    if (discharged + currentlyAdmitted + deaths !== cumulative) continue;
    candidates.push([govt, priv, total, cumulative, deaths, discharged, currentlyAdmitted]);
  }

  const bestMatch = (admit24hTarget: number, cumulativeTarget: number | undefined): number[] | null => {
    const matches = candidates.filter((c) => c[2] === admit24hTarget);
    if (!matches.length) return null;
    if (matches.length === 1 || cumulativeTarget === undefined) return matches[0];
    return matches.reduce((best, c) =>
      Math.abs(c[3] - cumulativeTarget) < Math.abs(best[3] - cumulativeTarget) ? c : best,
    );
  };

  const byRegion: Partial<Record<RegionKey, { discharged: number; currentlyAdmitted: number }>> = {};
  for (const key of REGION_ORDER) {
    if (key === 'DHAKA_NORTH_CITY' || key === 'DHAKA_SOUTH_CITY') continue;
    const target = admitted24hByRegion[key];
    if (target === undefined) continue;
    const hit = bestMatch(target, totalAdmittedByRegion[key]);
    if (hit) byRegion[key] = { discharged: hit[5], currentlyAdmitted: hit[6] };
  }

  let dhakaCityCombined: { discharged: number; currentlyAdmitted: number } | null = null;
  const dncc = admitted24hByRegion.DHAKA_NORTH_CITY;
  const dscc = admitted24hByRegion.DHAKA_SOUTH_CITY;
  if (dncc !== undefined && dscc !== undefined) {
    const cumulativeTarget =
      totalAdmittedByRegion.DHAKA_NORTH_CITY !== undefined && totalAdmittedByRegion.DHAKA_SOUTH_CITY !== undefined
        ? totalAdmittedByRegion.DHAKA_NORTH_CITY + totalAdmittedByRegion.DHAKA_SOUTH_CITY
        : undefined;
    const hit = bestMatch(dncc + dscc, cumulativeTarget);
    if (hit) dhakaCityCombined = { discharged: hit[5], currentlyAdmitted: hit[6] };
  }

  return { byRegion, dhakaCityCombined };
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

  const districtTotals = districtTableDivisionTotals(text, admitted24h, totalAdmitted);

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
    discharged: districtTotals.byRegion[key]?.discharged ?? null,
    currentlyAdmitted: districtTotals.byRegion[key]?.currentlyAdmitted ?? null,
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
  const districtRegionsFound = Object.keys(districtTotals.byRegion).length;
  if (districtRegionsFound > 0) {
    notes.push(
      `Per-division "discharged" and "currently admitted" were read from the PDF's district-level tables for ${districtRegionsFound} of ${REGION_ORDER.length - 2} divisions` +
        (districtTotals.dhakaCityCombined
          ? '; Dhaka North and South City Corporation are only published there as one combined figure, folded into the combined ঢাকা বিভাগ row.'
          : '.'),
    );
  } else {
    notes.push(
      'Per-division "discharged" and "currently admitted" could not be matched in this report; only the national totals are real figures.',
    );
  }

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

  return { rows, totals, comparison, confidence, notes, dhakaCityCombined: districtTotals.dhakaCityCombined };
}

// ---------------------------------------------------------------------------
// Word-table layout parser
// ---------------------------------------------------------------------------

/**
 * From November 2026 DGHS also publishes the daily release as a Word-style
 * document (same `YYYYMMDD_dengue_all.pdf` name). Page 1 is a plain table —
 * one row per division with all six figures, including discharged and
 * currently admitted, and Dhaka already reported as a single combined
 * division — followed by hospital-wise and district-wise pages this parser
 * does not need.
 *
 * The Bangla letters in that PDF come out garbled (a legacy-font quirk), but
 * the digits are real text, so rows are recognised by shape rather than by
 * name: a leading serial 1..8 followed by exactly six figures, then a
 * totals line of six bare figures. The divisions are always listed in the
 * same order DGHS uses everywhere (the order of `WORD_TABLE_ORDER`), and the
 * arithmetic is checked: every column of the eight rows must add up to the
 * totals line, otherwise the result is flagged as low-confidence.
 */
const WORD_TABLE_ORDER: RegionKey[] = [
  'DHAKA_DIVISION',
  'MYMENSINGH',
  'CHATTOGRAM',
  'KHULNA',
  'RAJSHAHI',
  'RANGPUR',
  'BARISHAL',
  'SYLHET',
];

const COLUMN_NAMES = ['admitted24h', 'deaths24h', 'totalAdmitted', 'totalDeaths', 'discharged', 'currentlyAdmitted'] as const;

/** "7র্র্ শোল র্র্ ভোগ 213 1 18281 31 17559 691" -> [213, 1, 18281, 31, 17559, 691] when `serial` is 7. */
function summaryRow(line: string, serial: number): number[] | null {
  const lead = line.match(/^(\d{1,2})(?!\d)/);
  if (!lead || Number(lead[1]) !== serial) return null;
  const nums = numbersIn(line);
  return nums.length === 7 ? nums.slice(1) : null;
}

/** A line made only of figures: the table's totals row has no label of its own. */
function bareFigures(line: string): number[] | null {
  if (!/^[\d,\s]+$/.test(line)) return null;
  const nums = numbersIn(line);
  return nums.length === 6 ? nums : null;
}

export function parseWordTablePressRelease(rawText: string): PatternResult {
  const empty: PatternResult = { rows: [], totals: null, comparison: [], confidence: 0, notes: [] };
  const lines = normalise(rawText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const n = WORD_TABLE_ORDER.length;
  let start = -1;
  let figures: number[][] = [];
  for (let s = 0; s + n < lines.length && start < 0; s++) {
    const block: number[][] = [];
    for (let k = 0; k < n; k++) {
      const row = summaryRow(lines[s + k], k + 1);
      if (!row) break;
      block.push(row);
    }
    if (block.length === n && bareFigures(lines[s + n])) {
      start = s;
      figures = block;
    }
  }
  if (start < 0) return { ...empty, notes: ['Not the Word-table layout.'] };

  const totalsFigures = bareFigures(lines[start + n])!;
  const toRow = (f: number[]): Omit<RegionRow, 'key'> => ({
    admitted24h: f[0],
    deaths24h: f[1],
    totalAdmitted: f[2],
    totalDeaths: f[3],
    discharged: f[4],
    currentlyAdmitted: f[5],
  });

  const rows: RegionRow[] = WORD_TABLE_ORDER.map((key, i) => ({ key, ...toRow(figures[i]) }));
  const totals = toRow(totalsFigures);

  const notes: string[] = [];
  const mismatched = COLUMN_NAMES.filter((col, c) => figures.reduce((sum, f) => sum + f[c], 0) !== totalsFigures[c]);
  if (mismatched.length) {
    notes.push(
      `The eight division rows do not add up to the table's own totals row on: ${mismatched.join(', ')}. Check the figures against the PDF.`,
    );
  } else {
    notes.push("All six columns of the eight division rows add up exactly to the table's totals row.");
  }
  notes.push(
    'Dhaka is reported as one combined division here (Dhaka Division + DNCC + DSCC); the PDF does not split it, so there are no separate city-corporation rows.',
  );

  // "তারিখ 07-11-26" sits at the top of every page: dd-mm-yy.
  let printedDate: string | null = null;
  for (const line of lines.slice(0, 6)) {
    const m = line.match(/(\d{2})-(\d{2})-(\d{2})\s*$/);
    if (m) {
      printedDate = `20${m[3]}-${m[2]}-${m[1]}`;
      break;
    }
  }

  return {
    rows,
    totals,
    comparison: [],
    confidence: mismatched.length ? 0.55 : 0.97,
    notes,
    dhakaCombined: true,
    printedDate,
  };
}

/**
 * Tries each press-release layout this app knows, newest first, and records
 * which one matched. The BI-dashboard export and the Word-table layout can
 * both be published under the same file name, so the layout is recognised
 * from the content, never from the name or the date.
 */
export function parseCasePdf(text: string, year: number): PatternResult {
  const bi = parseBiPressRelease(text, year);
  if (bi.rows.length) return { ...bi, format: 'bi-dashboard' };

  const word = parseWordTablePressRelease(text);
  if (word.rows.length) return { ...word, format: 'word-table' };

  return { ...parseReportText(text, year), format: 'legacy-table' };
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
