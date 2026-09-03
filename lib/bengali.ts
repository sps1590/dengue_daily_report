/**
 * Bengali numeral and date helpers.
 *
 * The DGHS press-release index labels every link with Bengali numerals, e.g.
 *   "ডেঙ্গু প্রেস রিলিজ ০২/০৯/২০২৬"
 * while the PDF itself lives at a predictable ASCII path:
 *   /images/docs/vpr/20260902_dengue_all.pdf
 */

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

/** 2026 -> ২০২৬ */
export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** ২০২৬ -> 2026 */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d as (typeof BN_DIGITS)[number])));
}

/** "2026-09-02" -> "০২/০৯/২০২৬" (the exact label format used on the DGHS index page) */
export function toBengaliDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-');
  return toBengaliDigits(`${d}/${m}/${y}`);
}

/** "2026-09-02" -> "20260902" (the PDF filename stem) */
export function toCompactDate(iso: string): string {
  return iso.replace(/-/g, '');
}

export const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
] as const;

export const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** "2026-09-02" -> "০২ সেপ্টেম্বর ২০২৬" */
export function toBengaliLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${toBengaliDigits(String(d).padStart(2, '0'))} ${BN_MONTHS[m - 1]} ${toBengaliDigits(y)}`;
}

/** "2026-09-02" -> "02 September 2026" */
export function toEnglishLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${EN_MONTHS[m - 1]} ${y}`;
}

/** Yesterday in Asia/Dhaka, as an ISO date string. The press release for a given
 *  day is published the following morning, so yesterday is the sensible default. */
export function yesterdayInDhaka(): string {
  const nowUtc = Date.now();
  const dhaka = new Date(nowUtc + 6 * 60 * 60 * 1000); // UTC+6, no DST
  dhaka.setUTCDate(dhaka.getUTCDate() - 1);
  return dhaka.toISOString().slice(0, 10);
}

/** Guard against dates that cannot have a press release yet. */
export function isPlausibleReportDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  const earliest = Date.parse('2023-01-01T00:00:00Z');
  const latest = Date.now() + 6 * 60 * 60 * 1000;
  return t >= earliest && t <= latest;
}
