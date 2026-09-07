import { toBengaliDigits } from './bengali';
import { LABELS, REGION_LABELS, comparisonHeading, cumulativeHeader, periodLabel } from './bijoy';
import { downloadFile } from './export-brief';
import { sumRows } from './parse';
import { REGION_ORDER, type DengueReport, type RegionRow } from './types';

/**
 * The reference sheet's own eight rows: serial ২–৯, Dhaka Division through
 * Sylhet. Serial ১ (the two city corporations) is not part of this document
 * — see docs/PROGRESS.md v1.4.0 for why, confirmed against the client's own
 * reference image.
 */
const OFFICIAL_REGION_KEYS = REGION_ORDER.slice(2);

export interface OfficialReportRow {
  serial: string;
  name: string;
  row: RegionRow;
}

export interface OfficialReportModel {
  rows: OfficialReportRow[];
  /** Sum of the eight shown rows — real for admitted/deaths, not for discharged/currentlyAdmitted. */
  rowTotals: Omit<RegionRow, 'key'>;
  /** The report's true national totals, including the two city corporations this document omits. */
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
    const row =
      report.rows.find((r) => r.key === key) ?? {
        key,
        admitted24h: null,
        deaths24h: null,
        totalAdmitted: null,
        totalDeaths: null,
        discharged: null,
        currentlyAdmitted: null,
      };
    return { serial: toBengaliDigits(i + 2), name: REGION_LABELS[key].unicode, row };
  });

  const rowTotals = sumRows(rows.map((r) => r.row));

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
    rowTotals,
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
.official-report .signature-cursive{font-family:"Caveat","Dancing Script",cursive;font-size:34px;line-height:1;}
.official-report .signature-date{margin-top:2px;font-size:13px;}
.official-report .signature-role{margin-top:2px;font-size:13px;}
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap">
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { background:#fff; }
  body { margin:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${OFFICIAL_REPORT_CSS}
</style>
<div class="official-report">
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
</div>
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
