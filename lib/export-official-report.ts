import { toBengaliDigits } from './bengali';
import { LABELS, REGION_LABELS, comparisonHeading, cumulativeHeader, periodLabel } from './bijoy';
import { downloadFile } from './export-brief';
import { sumRows } from './parse';
import { REGION_ORDER, type DengueReport, type RegionKey, type RegionRow } from './types';

/**
 * The reference sheet's own eight rows: serial ২–৯, Dhaka Division through
 * Sylhet. Serial ১ isn't a separate row — instead, per the client, the
 * ঢাকা বিভাগ row is Dhaka Division + Dhaka North City + Dhaka South City
 * summed together, not Dhaka Division alone. That also means these eight
 * rows now sum to the exact same national totals as `report.totals` for
 * every column those totals actually have real per-division data for
 * (verified against a live report: every one of admitted24h/deaths24h/
 * totalAdmitted/totalDeaths matched exactly).
 */
const OFFICIAL_REGION_KEYS = REGION_ORDER.slice(2);
const DHAKA_COMBINED_KEYS: RegionKey[] = ['DHAKA_DIVISION', 'DHAKA_NORTH_CITY', 'DHAKA_SOUTH_CITY'];

export interface OfficialReportRow {
  serial: string;
  name: string;
  row: RegionRow;
}

export interface OfficialReportModel {
  rows: OfficialReportRow[];
  /**
   * The সর্বমোট row: the press release's own real national totals for every
   * column, not a sum of the eight shown rows. The two omit Dhaka North/South
   * City Corporation, so summing just those eight would under-count against
   * DGHS's published figures — this deliberately doesn't do that.
   */
  rowTotals: Omit<RegionRow, 'key'>;
  /** Same values as rowTotals.discharged/currentlyAdmitted — kept as distinct fields since callers reach for them by name. */
  nationalDischarged: number | null;
  nationalCurrentlyAdmitted: number | null;
  cumulativeHeaderText: string;
  comparisonHeadingText: string;
  comparisonRows: { serial: string; periodLabel: string; cases: number | null; deaths: number | null }[];
  /** D/M/YYYY in Bengali digits, as of the moment this is built. */
  downloadDate: string;
}

export const fmtBn = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : toBengaliDigits(n));

export function buildOfficialReportModel(report: DengueReport): OfficialReportModel {
  const year = Number(report.date.slice(0, 4));

  const rows: OfficialReportRow[] = OFFICIAL_REGION_KEYS.map((key, i) => {
    let row: RegionRow;
    if (key === 'DHAKA_DIVISION') {
      const parts = DHAKA_COMBINED_KEYS.map((k) => report.rows.find((r) => r.key === k)).filter(
        (r): r is RegionRow => r !== undefined,
      );
      const summed = sumRows(parts);
      // Dhaka North/South City Corporation's discharged/currentlyAdmitted stay
      // `null` on their own rows (the source never splits the two), so the sum
      // above only ever carries Dhaka Division's own out-of-CC figure. The
      // city pair's combined figure — when the PDF's district table had it —
      // is added on top here, rather than attributed to either corporation.
      const city = report.dhakaCityDischarged;
      row = {
        key,
        ...summed,
        discharged: city ? (summed.discharged ?? 0) + city.discharged : summed.discharged,
        currentlyAdmitted: city ? (summed.currentlyAdmitted ?? 0) + city.currentlyAdmitted : summed.currentlyAdmitted,
      };
    } else {
      row = report.rows.find((r) => r.key === key) ?? {
        key,
        admitted24h: null,
        deaths24h: null,
        totalAdmitted: null,
        totalDeaths: null,
        discharged: null,
        currentlyAdmitted: null,
      };
    }
    return { serial: toBengaliDigits(i + 2), name: REGION_LABELS[key].unicode, row };
  });

  const now = new Date();
  const downloadDate = `${toBengaliDigits(now.getDate())}/${toBengaliDigits(now.getMonth() + 1)}/${toBengaliDigits(now.getFullYear())}`;

  const prevEntry = report.comparison.find((c) => c.year === year - 1);
  const comparisonRows = [
    {
      serial: toBengaliDigits(1),
      periodLabel: periodLabel(year - 1, report.date, 'unicode'),
      cases: prevEntry?.cases ?? null,
      deaths: prevEntry?.deaths ?? null,
    },
    {
      serial: toBengaliDigits(2),
      periodLabel: periodLabel(year, report.date, 'unicode'),
      cases: report.totals.totalAdmitted,
      deaths: report.totals.totalDeaths,
    },
  ];

  return {
    rows,
    rowTotals: report.totals,
    nationalDischarged: report.totals.discharged,
    nationalCurrentlyAdmitted: report.totals.currentlyAdmitted,
    cumulativeHeaderText: cumulativeHeader(year, 'unicode'),
    comparisonHeadingText: comparisonHeading(year - 1, year, 'unicode'),
    comparisonRows,
    downloadDate,
  };
}

export const OFFICIAL_REPORT_CSS = `
.official-report{background:#ffffff;color:#000000;font-family:"Kalpurush","SolaimanLipi","Noto Serif Bengali","Nirmala UI",sans-serif;max-width:800px;margin:0 auto;padding:20px 24px;}
.official-report table{border-collapse:collapse;width:100%;margin-bottom:18px;}
.official-report th,.official-report td{border:1px solid #000000;padding:4px 8px;font-size:13px;text-align:center;vertical-align:middle;}
.official-report th{background:#fce4d6;font-weight:700;}
.official-report td.name,.official-report th.name{text-align:left;}
.official-report .org-header p{margin:2px 0;font-weight:700;text-align:center;}
.official-report .section-title{text-align:center;font-weight:700;margin:18px 0 10px;font-size:15px;}
.official-report .section-title.underline{text-decoration:underline;}
.official-report tr.total td{font-weight:700;}
.official-report .source-note{margin-top:10px;font-size:13px;text-align:left;}
.official-report .signature-block{margin-top:36px;text-align:right;}
.official-report .signature-cursive{font-family:"Mrs Saint Delafield","Petit Formal Script",cursive;font-weight:400;font-size:46px;line-height:1;color:#1a1a2e;display:inline-block;transform:rotate(-3deg);}
.official-report .signature-date{margin-top:2px;font-size:13px;}
.official-report .signature-role{margin-top:2px;font-size:13px;}
.official-report .prepared-by{margin-top:18px;font-size:12px;text-align:right;color:#fffbf7;}
`;

/** Row + subtotal markup shared by the on-screen component and this export. */
function tableRowsHtml(m: OfficialReportModel): string {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const body = m.rows
    .map(
      (r) => `<tr>
      <td>${r.serial}</td>
      <td class="name">${esc(r.name)}</td>
      <td>${fmtBn(r.row.admitted24h)}</td>
      <td>${fmtBn(r.row.deaths24h)}</td>
      <td>${fmtBn(r.row.totalAdmitted)}</td>
      <td>${fmtBn(r.row.totalDeaths)}</td>
      <td>${fmtBn(r.row.discharged)}</td>
      <td>${fmtBn(r.row.currentlyAdmitted)}</td>
    </tr>`,
    )
    .join('');
  return `${body}<tr class="total">
    <td colspan="2">${LABELS.grandTotal.unicode}</td>
    <td>${fmtBn(m.rowTotals.admitted24h)}</td>
    <td>${fmtBn(m.rowTotals.deaths24h)}</td>
    <td>${fmtBn(m.rowTotals.totalAdmitted)}</td>
    <td>${fmtBn(m.rowTotals.totalDeaths)}</td>
    <td>${fmtBn(m.nationalDischarged)}</td>
    <td>${fmtBn(m.nationalCurrentlyAdmitted)}</td>
  </tr>`;
}

function comparisonRowsHtml(m: OfficialReportModel): string {
  return m.comparisonRows
    .map(
      (r) => `<tr>
      <td>${r.serial}</td>
      <td class="name">${r.periodLabel}</td>
      <td>${fmtBn(r.cases)}</td>
      <td>${fmtBn(r.deaths)}</td>
      <td></td>
    </tr>`,
    )
    .join('');
}

/** The `.official-report` markup itself, shared by the HTML/print export and the Word export. */
function officialReportBodyHtml(m: OfficialReportModel): string {
  return `<div class="official-report">
  <div class="org-header">
    <p>${LABELS.govt.unicode}</p>
    <p>${LABELS.dghs.unicode.trim()}</p>
    <p>${LABELS.branch.unicode}</p>
    <p>${LABELS.address.unicode}</p>
  </div>
  <p class="section-title">${LABELS.title.unicode}</p>

  <table>
    <thead>
      <tr>
        <th rowspan="2">${LABELS.serial.unicode.replace('\n', ' ')}</th>
        <th rowspan="2" class="name">${LABELS.divisionName.unicode}</th>
        <th colspan="2">${LABELS.last24h.unicode}</th>
        <th colspan="3">${m.cumulativeHeaderText}</th>
        <th rowspan="2">${LABELS.currentlyAdmitted.unicode}</th>
      </tr>
      <tr>
        <th>${LABELS.admitted.unicode}</th>
        <th>${LABELS.deaths.unicode}</th>
        <th>${LABELS.totalAdmitted.unicode}</th>
        <th>${LABELS.totalDeaths.unicode}</th>
        <th>${LABELS.discharged.unicode}</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml(m)}
    </tbody>
  </table>

  <p class="section-title underline">${m.comparisonHeadingText}</p>
  <table>
    <thead>
      <tr>
        <th>${LABELS.serialFlat.unicode}</th>
        <th class="name">${LABELS.year.unicode}</th>
        <th>${LABELS.caseCount.unicode}</th>
        <th>${LABELS.deathCount.unicode}</th>
        <th>${LABELS.remarks.unicode}</th>
      </tr>
    </thead>
    <tbody>
      ${comparisonRowsHtml(m)}
    </tbody>
  </table>

  <p class="source-note">${LABELS.sourceNote.unicode}</p>

  <div class="signature-block">
    <p class="signature-cursive">Anahar</p>
    <p class="signature-date">${m.downloadDate}</p>
    <p class="signature-role">${LABELS.signatory.unicode}</p>
    <p class="signature-role">${LABELS.signatoryOrg.unicode}</p>
    <p class="signature-role">${LABELS.signatoryAddr.unicode}</p>
  </div>
  <p class="prepared-by">Prepared by: MIS Expert, NMEP</p>
</div>`;
}

/**
 * A self-contained HTML document reproducing the official report exactly —
 * no site chrome, so what prints is what's on the page. Opened in a new tab
 * and printed immediately; the browser's own "Save as PDF" destination is
 * the actual export mechanism, which is also the only way to get a Bangla
 * PDF without embedding a font (see lib/export-brief.ts for the same
 * reasoning applied to the management brief).
 */
export function officialReportToHtml(report: DengueReport): string {
  const m = buildOfficialReportModel(report);
  return `<!doctype html>
<html lang="bn">
<meta charset="utf-8">
<title>ডেঙ্গু প্রতিবেদন — ${report.date}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mrs+Saint+Delafield&display=swap">
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { background:#fff; }
  body { margin:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${OFFICIAL_REPORT_CSS}
</style>
${officialReportBodyHtml(m)}
</html>`;
}

/**
 * Word opens HTML directly when it carries the `mso-application` marker and
 * the `urn:schemas-microsoft-com:office:*` namespaces — no OOXML library
 * needed, and no risk of the Bangla-glyph problem that ruled out `jspdf` for
 * text rendering elsewhere in this app, since Word renders the same HTML/CSS
 * text this page does rather than re-drawing glyphs from an embedded font.
 *
 * Word's HTML importer does not fetch external stylesheets, so the
 * `Mrs Saint Delafield` web font the browser-facing exports use for the
 * signature never loads — the override below points it at the thinnest
 * classic signature-style script font that ships with Windows/Office
 * instead (`Monotype Corsiva`), and drops the `rotate()` transform, which
 * Word's renderer does not reliably honour.
 */
export function officialReportToWordHtml(report: DengueReport): string {
  const m = buildOfficialReportModel(report);
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<title>ডেঙ্গু প্রতিবেদন — ${report.date}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: 21cm 29.7cm; margin: 1.5cm; }
  ${OFFICIAL_REPORT_CSS}
  .official-report .signature-cursive{font-family:"Monotype Corsiva","Segoe Script","Lucida Handwriting",cursive;font-size:40px;transform:none;}
</style>
</head>
<body>
${officialReportBodyHtml(m)}
</body>
</html>`;
}

/**
 * Downloads the report as a self-contained HTML file rather than opening a
 * new tab and calling `window.print()` — a popup blocker (or, as observed in
 * headless/automated browsers, a click that isn't trusted as a user gesture)
 * silently swallows `window.open`, so there is no reliable path through it.
 * A direct file download has no such failure mode, matches how the
 * management brief already exports (lib/export-brief.ts), and opens ready to
 * print: `@page { size: A4 }` and `-webkit-print-color-adjust: exact` are
 * baked into the file, so Ctrl+P produces one A4 page with the colours intact.
 */
export function downloadOfficialReport(report: DengueReport): void {
  const html = officialReportToHtml(report);
  downloadFile(`Dengue official report ${report.date}.html`, html, 'text/html;charset=utf-8');
}

/** Downloads a `.doc` file — Word opens it directly (see officialReportToWordHtml). */
export function downloadOfficialReportWord(report: DengueReport): void {
  const html = officialReportToWordHtml(report);
  downloadFile(`Dengue official report ${report.date}.doc`, html, 'application/msword;charset=utf-8');
}
