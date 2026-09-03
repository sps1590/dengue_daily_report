import Anthropic from '@anthropic-ai/sdk';
import { REGION_EN, REGION_ORDER, type DengueReport, type ManagementBrief, type RegionKey, type RegionRow, type YearComparison } from './types';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

export function hasModelAccess(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');
  return new Anthropic({ apiKey });
}

/** Strip a ```json fence if the model added one, then parse. */
function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('The model did not return JSON.');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Extraction fallback
// ---------------------------------------------------------------------------

const EXTRACTION_SCHEMA = `{
  "rows": [
    { "region": "DHAKA_NORTH_CITY|DHAKA_SOUTH_CITY|DHAKA_DIVISION|MYMENSINGH|CHATTOGRAM|KHULNA|RAJSHAHI|RANGPUR|BARISHAL|SYLHET",
      "admitted24h": number, "deaths24h": number,
      "totalAdmitted": number, "totalDeaths": number,
      "discharged": number, "currentlyAdmitted": number }
  ],
  "comparison": [ { "year": number, "cases": number, "deaths": number } ],
  "notes": [ "anything ambiguous or unreadable" ]
}`;

/**
 * Re-read the press release with the model when the pattern parser could not
 * recognise the table. The PDF itself is attached rather than the extracted
 * text, so this path also covers scanned releases.
 */
export async function extractWithModel(
  pdfBytes: Uint8Array,
  fallbackText: string,
): Promise<{ rows: RegionRow[]; comparison: YearComparison[]; notes: string[] }> {
  const anthropic = client();

  const instruction = `You are reading a Bangladesh DGHS daily dengue press release. It is written in Bangla; some copies use legacy SutonnyMJ encoding and some use Bengali numerals (০-৯).

Read the division-wise table and the year comparison table. Return ONLY JSON matching this shape, with no prose and no markdown fence:

${EXTRACTION_SCHEMA}

Rules:
- Convert every Bengali numeral to an ASCII number.
- Omit a region entirely if it is not present in the document. Do not invent rows.
- Do not include the grand-total row as a region.
- If a cell is blank, use 0 only when the document shows a zero; otherwise omit that region and say so in notes.`;

  const content: Anthropic.ContentBlockParam[] = [];
  const base64 = Buffer.from(pdfBytes).toString('base64');
  if (pdfBytes.byteLength < 25 * 1024 * 1024) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    });
  } else {
    content.push({ type: 'text', text: fallbackText.slice(0, 60_000) });
  }
  content.push({ type: 'text', text: instruction });

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content }],
  });

  const parsed = parseJson<{
    rows: ({ region: string } & Omit<RegionRow, 'key'>)[];
    comparison: YearComparison[];
    notes?: string[];
  }>(textOf(msg));

  const valid = new Set<string>(REGION_ORDER);
  const rows: RegionRow[] = (parsed.rows ?? [])
    .filter((r) => valid.has(r.region))
    .map((r) => ({
      key: r.region as RegionKey,
      admitted24h: r.admitted24h ?? null,
      deaths24h: r.deaths24h ?? null,
      totalAdmitted: r.totalAdmitted ?? null,
      totalDeaths: r.totalDeaths ?? null,
      discharged: r.discharged ?? null,
      currentlyAdmitted: r.currentlyAdmitted ?? null,
    }))
    .sort((a, b) => REGION_ORDER.indexOf(a.key) - REGION_ORDER.indexOf(b.key));

  return { rows, comparison: parsed.comparison ?? [], notes: parsed.notes ?? [] };
}

// ---------------------------------------------------------------------------
// Management brief
// ---------------------------------------------------------------------------

const BRIEF_SCHEMA = `{
  "headline": "one sentence, under 20 words",
  "situation": "2-4 sentences describing the current picture",
  "keyFindings": ["3-6 findings, each one sentence, each containing a specific figure"],
  "geographicPattern": "2-3 sentences on where the burden sits",
  "riskFlags": [ { "level": "high|moderate|watch", "text": "one sentence" } ],
  "recommendations": ["3-5 concrete actions a programme manager can take this week"],
  "dataCaveats": ["anything that limits how far these numbers should be pushed"]
}`;

export async function generateBrief(
  report: DengueReport,
  language: 'en' | 'bn',
): Promise<ManagementBrief> {
  const anthropic = client();

  const table = report.rows
    .map(
      (r) =>
        `${REGION_EN[r.key]}: 24h admissions ${r.admitted24h ?? '-'}, 24h deaths ${r.deaths24h ?? '-'}, cumulative admissions ${r.totalAdmitted ?? '-'}, cumulative deaths ${r.totalDeaths ?? '-'}, discharged ${r.discharged ?? '-'}, currently admitted ${r.currentlyAdmitted ?? '-'}`,
    )
    .join('\n');

  const comparison = report.comparison
    .map((c) => `${c.year}: ${c.cases ?? '-'} cases, ${c.deaths ?? '-'} deaths (same window)`)
    .join('\n');

  const cfr =
    report.totals.totalAdmitted && report.totals.totalDeaths
      ? ((report.totals.totalDeaths / report.totals.totalAdmitted) * 100).toFixed(3)
      : null;

  const prompt = `You are preparing a decision brief for senior management at the National Malaria Elimination and ATD Control Programme (NMEP), DGHS Bangladesh. The audience is the Line Director, Programme Manager, and partners including WHO and the Global Fund. They already know what dengue is. They need interpretation, not description.

Source: DGHS daily dengue press release for ${report.date} (${report.sourceUrl}).

Division-wise figures:
${table || '(no region rows were recognised)'}

National totals: 24h admissions ${report.totals.admitted24h ?? '-'}, 24h deaths ${report.totals.deaths24h ?? '-'}, cumulative admissions ${report.totals.totalAdmitted ?? '-'}, cumulative deaths ${report.totals.totalDeaths ?? '-'}, currently admitted ${report.totals.currentlyAdmitted ?? '-'}, discharged ${report.totals.discharged ?? '-'}.
${cfr ? `Case fatality ratio among reported admissions: ${cfr}%.` : ''}

Year comparison:
${comparison || '(not available)'}

Extraction confidence: ${(report.extraction.confidence * 100).toFixed(0)}% via ${report.extraction.method}.
Extraction notes: ${report.extraction.notes.join(' | ') || 'none'}

Write the brief in ${language === 'bn' ? 'Bangla (Unicode, formal government register)' : 'English'}.

Requirements:
- Every finding must carry a number drawn from the data above. Never invent a figure.
- Interpret: concentration of burden, bed occupancy pressure implied by "currently admitted", the trajectory against last year, and what the CFR does or does not tell you.
- Be explicit about what this daily press release cannot tell you: it reports hospitalised cases only, so it is not incidence; it carries no serotype, age, sex or upazila detail; and discharges lag admissions.
- Recommendations must be things this programme can actually do — surveillance, case management readiness, vector control tasking, risk communication, data quality follow-up. No generic advice.
- If extraction confidence is below 60%, lead the caveats with a verification instruction.

Return ONLY JSON in this shape, no prose, no markdown fence:
${BRIEF_SCHEMA}`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJson<Omit<ManagementBrief, 'language' | 'generatedAt'>>(textOf(msg));
  return { ...parsed, language, generatedAt: new Date().toISOString() };
}
