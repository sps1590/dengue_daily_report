/**
 * Legacy Bijoy / SutonnyMJ encoding for the DGHS daily dengue sheet.
 *
 * WHY THIS EXISTS
 * ---------------
 * The reference workbook that NMEP circulates ("Dengue Report, Daily -2026
 * (02-09-26) F.xlsx") stores its Bangla as ASCII bytes rendered through the
 * SutonnyMJ font — the ANSI "Bijoy" convention that predates Unicode Bangla.
 * Cell B2 literally holds the bytes `MYcÖRvZš¿x evsjv‡`k miKvi`, which only
 * reads as "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার" when SutonnyMJ is installed.
 *
 * Rather than ship a general Unicode -> Bijoy transliterator (which needs
 * vowel reordering, reph placement and conjunct handling, and fails silently
 * on the cases it gets wrong), this module holds a closed dictionary. Every
 * string the report can emit is listed once. Strings marked VERBATIM were
 * lifted byte-for-byte out of the reference workbook, so they are exact by
 * construction. Strings marked DERIVED were composed from the standard
 * SutonnyMJ table and are the only ones that could ever need correcting.
 *
 * Consequence: the Excel writer never guesses. If a label is missing from
 * this dictionary the writer falls back to Unicode + Nirmala UI rather than
 * emitting mojibake.
 */

export type BijoyEntry = { unicode: string; bijoy: string; source: 'verbatim' | 'derived' };

/** Every fixed label on the sheet. `bijoy` is what gets written when the
 *  output format is `legacy`; `unicode` when it is `unicode`. */
export const LABELS = {
  // --- Masthead -----------------------------------------------------------
  govt: { unicode: 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার', bijoy: 'MYcÖRvZš¿x evsjv‡`k miKvi', source: 'verbatim' },
  dghs: { unicode: 'স্বাস্থ্য অধিদপ্তর ', bijoy: '¯^v¯’¨ Awa`ßi ', source: 'verbatim' },
  branch: { unicode: 'রোগ নিয়ন্ত্রণ শাখা', bijoy: '‡ivM wbqš¿Y kvLv', source: 'verbatim' },
  address: { unicode: 'মহাখালী, ঢাকা-১২১২।', bijoy: 'gnvLvjx, XvKv-1212|', source: 'verbatim' },
  title: { unicode: 'হালনাগাদ ডেঙ্গু রোগীর তথ্য', bijoy: 'nvjbvMv` †W½y †ivMxi Z_¨', source: 'verbatim' },

  // --- Table 1 header -----------------------------------------------------
  serial: { unicode: 'ক্রমিক\nনং', bijoy: 'µwgK\nbs', source: 'verbatim' },
  divisionName: { unicode: 'বিভাগের নাম', bijoy: 'wefv‡Mi bvg', source: 'verbatim' },
  last24h: { unicode: 'গত ২৪ ঘণ্টায় ডেঙ্গু রোগীর তথ্য', bijoy: 'MZ 24 N›Uvq ‡Ws¸ †ivMxi Z_¨', source: 'verbatim' },
  currentlyAdmitted: { unicode: 'বর্তমানে হাসপাতালে ভর্তি রোগী', bijoy: 'eZ©gv‡b nvmcvZv‡j fwZ© †ivMx', source: 'verbatim' },
  admitted: { unicode: 'ভর্তি রোগী', bijoy: 'fwZ© †ivMx', source: 'verbatim' },
  deaths: { unicode: 'মৃত্যু', bijoy: 'g„Zz¨', source: 'verbatim' },
  totalAdmitted: { unicode: 'সর্বমোট ভর্তি', bijoy: 'me©‡gvU fwZ©', source: 'verbatim' },
  totalDeaths: { unicode: 'সর্বমোট মৃত্যু', bijoy: 'me©‡gvU g„Zz¨', source: 'verbatim' },
  discharged: { unicode: 'ছাড়পত্র প্রাপ্ত রোগী', bijoy: 'QvocÎ cÖvß †ivMx', source: 'verbatim' },
  grandTotal: { unicode: 'সর্বমোট', bijoy: 'me©‡gvU', source: 'verbatim' },

  // --- Table 2 ------------------------------------------------------------
  serialFlat: { unicode: 'ক্রমিক নং', bijoy: 'µwgK bs', source: 'verbatim' },
  year: { unicode: 'সাল', bijoy: 'mvj', source: 'verbatim' },
  caseCount: { unicode: 'রোগীর সংখ্যা', bijoy: '‡ivMxi msL¨v', source: 'verbatim' },
  deathCount: { unicode: 'মৃত্যুবরণ কারীর সংখ্যা', bijoy: 'g„Zy¨eiY Kvixi msL¨v', source: 'verbatim' },
  remarks: { unicode: 'মন্তব্য', bijoy: 'gšÍe¨', source: 'verbatim' },

  // --- Footer -------------------------------------------------------------
  sourceNote: {
    unicode: 'তথ্য সূত্র: হেলথ ইমার্জেন্সী অপারেশন সেন্টার ও কন্ট্রোল রুম, স্বাস্থ্য অধিদপ্তর, ঢাকা।',
    bijoy: 'Z_¨ m~Î: ‡nj_ Bgv‡R©Ýx Acv‡ikb †m›Uvi I K‡›Uªvj iæg, ¯^v¯’¨ Awa`ßi, XvKv|',
    source: 'verbatim',
  },
  signatory: { unicode: 'উপপরিচালক, সিডিসি', bijoy: 'উপপরিচালক, সিডিসি', source: 'verbatim' },
  signatoryOrg: { unicode: 'স্বাস্থ্য অধিদপ্তর,', bijoy: 'স্বাস্থ্য অধিদপ্তর,', source: 'verbatim' },
  signatoryAddr: { unicode: 'মহাখালী, ঢাকা।', bijoy: 'মহাখালী, ঢাকা।', source: 'verbatim' },
} satisfies Record<string, BijoyEntry>;

/**
 * Region labels. The eight divisions are VERBATIM from the reference workbook.
 * The two city-corporation rows are DERIVED — the reference sheet did not
 * contain them, but the underlying press release reports them separately, so
 * the writer needs them when the parser finds city-level rows.
 */
export const REGION_LABELS: Record<string, BijoyEntry> = {
  DHAKA_NORTH_CITY: { unicode: 'ঢাকা উত্তর সিটি কর্পোরেশন', bijoy: 'XvKv DËi wmwU K‡c©v‡ikb', source: 'derived' },
  DHAKA_SOUTH_CITY: { unicode: 'ঢাকা দক্ষিণ সিটি কর্পোরেশন', bijoy: 'XvKv `w¶Y wmwU K‡c©v‡ikb', source: 'derived' },
  DHAKA_DIVISION: { unicode: 'ঢাকা বিভাগ', bijoy: 'XvKv wefvM', source: 'verbatim' },
  MYMENSINGH: { unicode: 'ময়মনসিংহ', bijoy: 'gqgbwmsn', source: 'verbatim' },
  CHATTOGRAM: { unicode: 'চট্টগ্রাম', bijoy: 'PÆMÖvg', source: 'verbatim' },
  KHULNA: { unicode: 'খুলনা', bijoy: 'Lyjbv', source: 'verbatim' },
  RAJSHAHI: { unicode: 'রাজশাহী', bijoy: 'ivRkvnx', source: 'verbatim' },
  RANGPUR: { unicode: 'রংপুর', bijoy: 'iscyi', source: 'verbatim' },
  BARISHAL: { unicode: 'বরিশাল', bijoy: 'ewikvj', source: 'verbatim' },
  SYLHET: { unicode: 'সিলেট', bijoy: 'wm‡jU', source: 'verbatim' },
};

/** Month names. January and September are VERBATIM (they appear in the
 *  reference workbook's comparison table); the rest are DERIVED from the
 *  standard SutonnyMJ table. */
export const BIJOY_MONTHS: BijoyEntry[] = [
  { unicode: 'জানুয়ারি', bijoy: 'Rvbyqvwi', source: 'verbatim' },
  { unicode: 'ফেব্রুয়ারি', bijoy: '‡deªæqvwi', source: 'derived' },
  { unicode: 'মার্চ', bijoy: 'gvP©', source: 'derived' },
  { unicode: 'এপ্রিল', bijoy: 'GwcÖj', source: 'derived' },
  { unicode: 'মে', bijoy: '‡g', source: 'derived' },
  { unicode: 'জুন', bijoy: 'Ryb', source: 'derived' },
  { unicode: 'জুলাই', bijoy: 'RyjvB', source: 'derived' },
  { unicode: 'আগস্ট', bijoy: 'AvM÷', source: 'derived' },
  { unicode: 'সেপ্টেম্বর', bijoy: '‡m‡Þ¤^i', source: 'verbatim' },
  { unicode: 'অক্টোবর', bijoy: 'A‡±vei', source: 'derived' },
  { unicode: 'নভেম্বর', bijoy: 'b‡f¤^i', source: 'derived' },
  { unicode: 'ডিসেম্বর', bijoy: 'wW‡m¤^i', source: 'derived' },
];

export type OutputScript = 'legacy' | 'unicode';

/** Pick the right byte string for the requested output script. */
export function pick(entry: BijoyEntry, script: OutputScript): string {
  return script === 'legacy' ? entry.bijoy : entry.unicode;
}

/**
 * "01 জানুয়ারি- 03 সেপ্টেম্বর" — the cumulative-window label used inside the
 * year comparison table. In SutonnyMJ, ASCII digits render as Bangla digits,
 * which is why the legacy branch keeps them as ASCII.
 */
export function periodLabel(year: number, throughIso: string, script: OutputScript): string {
  const [, m, d] = throughIso.split('-').map(Number);
  if (script === 'legacy') {
    const month = BIJOY_MONTHS[m - 1].bijoy;
    return `${year} (01 ${BIJOY_MONTHS[0].bijoy}- ${String(d).padStart(2, '0')} ${month} )`;
  }
  const month = BIJOY_MONTHS[m - 1].unicode;
  const bn = (n: string | number) => String(n).replace(/[0-9]/g, (x) => '০১২৩৪৫৬৭৮৯'[Number(x)]);
  return `${bn(year)} (${bn('01')} ${BIJOY_MONTHS[0].unicode}- ${bn(String(d).padStart(2, '0'))} ${month} )`;
}

/** Header for the cumulative column group, e.g. "01 জানুয়ারি 2026 ইং তারিখ হতে অদ্যাবধি". */
export function cumulativeHeader(year: number, script: OutputScript): string {
  // NOTE: the SutonnyMJ byte for দ is U+0060 (backtick), so "A`v¨ewa" can never
  // sit inside a template literal. Concatenate instead.
  if (script === 'legacy') return '01 Rvbyqvix ' + year + ' Bs ZvwiL n‡Z A`v¨ewa';
  const bn = (n: string | number) => String(n).replace(/[0-9]/g, (x) => '০১২৩৪৫৬৭৮৯'[Number(x)]);
  return `${bn('01')} জানুয়ারি ${bn(year)} ইং তারিখ হতে অদ্যাবধি`;
}

/** Heading above the year comparison table. */
export function comparisonHeading(prevYear: number, year: number, script: OutputScript): string {
  if (script === 'legacy') return `${prevYear}-${year} mv‡ji ‡W½y †ivMxi Zzjbvg~jK wPÎ wb¤œiæct`;
  const bn = (n: string | number) => String(n).replace(/[0-9]/g, (x) => '০১২৩৪৫৬৭৮৯'[Number(x)]);
  return `${bn(prevYear)}-${bn(year)} সালের ডেঙ্গু রোগীর তুলনামূলক চিত্র নিম্নরূপঃ`;
}

/** The font each script needs. Legacy bytes are meaningless without SutonnyMJ. */
export const FONT_FOR_SCRIPT: Record<OutputScript, string> = {
  legacy: 'SutonnyMJ',
  unicode: 'Nirmala UI',
};
