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
