import ExcelJS from 'exceljs';
import {
  BIJOY_MONTHS,
  FONT_FOR_SCRIPT,
  LABELS,
  REGION_LABELS,
  comparisonHeading,
  cumulativeHeader,
  periodLabel,
  pick,
  type OutputScript,
} from './bijoy';
import type { DengueReport } from './types';

/**
 * Rebuilds "Dengue Report, Daily -<year> (<dd-mm-yy>) F.xlsx".
 *
 * Geometry — column widths, row heights, merge ranges, fonts, border weights —
 * is copied from the reference workbook NMEP circulates, so a generated file
 * drops into the existing workflow without anyone reformatting it. The numbers
 * below are not arbitrary: they were read off that file cell by cell.
 */

const FONT_SIZE = 13;
const TITLE_SIZE = 14;

// Column widths, measured from the reference workbook.
const COL_WIDTHS: Record<string, number> = {
  A: 3.42578125,
  B: 5.7109375,
  C: 13.7109375,
  D: 11.42578125,
  E: 9.28515625,
  F: 9.85546875,
  G: 8.43, // default width in the source file
  H: 14.140625,
  I: 13.85546875,
  J: 8.7109375,
};

const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

export interface ExcelOptions {
  /** `legacy` writes SutonnyMJ bytes (matches the circulated file exactly);
   *  `unicode` writes Unicode Bangla in Nirmala UI (readable without the font). */
  script: OutputScript;
  /** Cumulative figures for the same window last year, for the comparison table. */
  previousYear?: { cases: number | null; deaths: number | null };
}

export async function buildWorkbook(
  report: DengueReport,
  opts: ExcelOptions,
): Promise<Uint8Array> {
  const { script } = opts;
  const font = FONT_FOR_SCRIPT[script];
  const year = Number(report.date.slice(0, 4));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'dengue_daily_info';
  wb.created = new Date();
  const ws = wb.addWorksheet('Sheet1');
  wb.addWorksheet('Sheet2'); // present in the source file

  for (const [col, width] of Object.entries(COL_WIDTHS)) {
    ws.getColumn(col).width = width;
  }

  const base = (size = FONT_SIZE, bold = false): Partial<ExcelJS.Font> => ({ name: font, size, bold });
  const set = (
    addr: string,
    value: ExcelJS.CellValue,
    style: Partial<ExcelJS.Style> = {},
  ) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    if (style.font) cell.font = style.font;
    if (style.alignment) cell.alignment = style.alignment;
    if (style.border) cell.border = style.border;
    if (style.numFmt) cell.numFmt = style.numFmt;
    return cell;
  };

  const centered: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
  const headerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'top', wrapText: true };

  // -- Masthead -------------------------------------------------------------
  ws.getRow(1).height = 12.75;
  const masthead: [string, string][] = [
    ['B2', pick(LABELS.govt, script)],
    ['B3', pick(LABELS.dghs, script)],
    ['B4', pick(LABELS.branch, script)],
    ['B5', pick(LABELS.address, script)],
  ];
  for (const [addr, value] of masthead) {
    const row = Number(addr.slice(1));
    ws.getRow(row).height = 14.1;
    ws.mergeCells(`B${row}:I${row}`);
    set(addr, value, { font: base(FONT_SIZE, true), alignment: centered });
  }

  ws.getRow(6).height = 18;
  ws.getRow(7).height = 19.5;
  ws.mergeCells('B7:I7');
  set('B7', pick(LABELS.title, script), { font: base(TITLE_SIZE, true), alignment: centered });
  ws.getRow(8).height = 15;

  // -- Table 1 header (rows 9-10) ------------------------------------------
  ws.getRow(9).height = 18;
  ws.getRow(10).height = 36.75;
  ws.mergeCells('B9:B10');
  ws.mergeCells('C9:C10');
  ws.mergeCells('D9:E9');
  ws.mergeCells('F9:H9');
  ws.mergeCells('I9:I10');

  const hdr = { font: base(FONT_SIZE, true), alignment: headerAlign, border: thin };
  set('B9', pick(LABELS.serial, script), hdr);
  set('C9', pick(LABELS.divisionName, script), hdr);
  set('D9', pick(LABELS.last24h, script), hdr);
  set('F9', cumulativeHeader(year, script), hdr);
  set('I9', pick(LABELS.currentlyAdmitted, script), hdr);

  const sub = { font: base(FONT_SIZE, true), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } as Partial<ExcelJS.Alignment>, border: thin };
  set('D10', pick(LABELS.admitted, script), sub);
  set('E10', pick(LABELS.deaths, script), sub);
  set('F10', pick(LABELS.totalAdmitted, script), sub);
  set('G10', pick(LABELS.totalDeaths, script), sub);
  set('H10', pick(LABELS.discharged, script), sub);
  // The merged spans still need their border edges drawn.
  for (const addr of ['E9', 'G9', 'H9', 'B10', 'C10', 'I10']) {
    ws.getCell(addr).border = thin;
  }

  // -- Table 1 body ---------------------------------------------------------
  const FIRST = 11;
  const rows = report.rows;
  rows.forEach((r, i) => {
    const n = FIRST + i;
    ws.getRow(n).height = 18;
    const cell = (addr: string, v: ExcelJS.CellValue, align: Partial<ExcelJS.Alignment> = centered) =>
      set(addr, v, { font: base(), alignment: align, border: thin });

    cell(`B${n}`, i + 1);
    cell(`C${n}`, pick(REGION_LABELS[r.key], script), { vertical: 'middle' });
    cell(`D${n}`, r.admitted24h);
    cell(`E${n}`, r.deaths24h);
    cell(`F${n}`, r.totalAdmitted);
    cell(`G${n}`, r.totalDeaths);
    cell(`H${n}`, r.discharged);
    cell(`I${n}`, r.currentlyAdmitted);
  });

  // Grand total row, as live formulas so the sheet recalculates if edited.
  const totalRow = FIRST + rows.length;
  ws.getRow(totalRow).height = 18;
  const last = totalRow - 1;
  set(`B${totalRow}`, null, { font: base(FONT_SIZE, true), alignment: centered, border: thin });
  set(`C${totalRow}`, pick(LABELS.grandTotal, script), {
    font: base(FONT_SIZE, true),
    alignment: { vertical: 'middle' },
    border: thin,
  });
  for (const col of ['D', 'E', 'F', 'G', 'H', 'I']) {
    const formula = rows.length ? `SUM(${col}${FIRST}:${col}${last})` : '0';
    set(`${col}${totalRow}`, rows.length ? { formula } : 0, {
      font: base(FONT_SIZE, true),
      alignment: centered,
      border: thin,
    });
  }

  // -- Table 2: year comparison --------------------------------------------
  const gap1 = totalRow + 1;
  const gap2 = totalRow + 2;
  ws.getRow(gap1).height = 13.5;
  ws.getRow(gap2).height = 13.5;

  const headingRow = totalRow + 3;
  ws.getRow(headingRow).height = 19.5;
  ws.mergeCells(`B${headingRow}:I${headingRow}`);
  set(`B${headingRow}`, comparisonHeading(year - 1, year, script), {
    font: base(TITLE_SIZE, true),
    alignment: centered,
  });
  ws.getRow(headingRow + 1).height = 15;

  const cmpHead = headingRow + 2;
  const cmpWrap: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
  for (const n of [cmpHead, cmpHead + 1, cmpHead + 2]) ws.getRow(n).height = 32.1;

  ws.mergeCells(`C${cmpHead}:E${cmpHead}`);
  ws.mergeCells(`F${cmpHead}:G${cmpHead}`);
  set(`B${cmpHead}`, pick(LABELS.serialFlat, script), { font: base(FONT_SIZE, true), alignment: cmpWrap, border: thin });
  set(`C${cmpHead}`, pick(LABELS.year, script), { font: base(FONT_SIZE, true), alignment: cmpWrap, border: thin });
  set(`F${cmpHead}`, pick(LABELS.caseCount, script), { font: base(FONT_SIZE, true), alignment: cmpWrap, border: thin });
  set(`H${cmpHead}`, pick(LABELS.deathCount, script), { font: base(FONT_SIZE, true), alignment: cmpWrap, border: thin });
  set(`I${cmpHead}`, pick(LABELS.remarks, script), { font: base(FONT_SIZE, true), alignment: cmpWrap, border: thin });
  for (const addr of [`D${cmpHead}`, `E${cmpHead}`, `G${cmpHead}`]) ws.getCell(addr).border = thin;

  const lastYear = report.comparison.find((c) => c.year === year - 1) ?? {
    year: year - 1,
    cases: opts.previousYear?.cases ?? null,
    deaths: opts.previousYear?.deaths ?? null,
  };
  const thisYear = report.comparison.find((c) => c.year === year) ?? {
    year,
    cases: report.totals.totalAdmitted,
    deaths: report.totals.totalDeaths,
  };

  [lastYear, thisYear].forEach((entry, i) => {
    const n = cmpHead + 1 + i;
    ws.mergeCells(`C${n}:E${n}`);
    ws.mergeCells(`F${n}:G${n}`);
    const body = { font: base(), alignment: cmpWrap, border: thin };
    set(`B${n}`, i + 1, body);
    set(`C${n}`, periodLabel(entry.year, report.date, script), {
      font: base(),
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      border: thin,
    });
    set(`F${n}`, entry.cases, body);
    set(`H${n}`, entry.deaths, body);
    set(`I${n}`, entry.remarks ?? null, body);
    for (const addr of [`D${n}`, `E${n}`, `G${n}`]) ws.getCell(addr).border = thin;
  });

  // -- Footer ---------------------------------------------------------------
  const noteRow = cmpHead + 4;
  ws.getRow(noteRow - 1).height = 10.5;
  ws.getRow(noteRow).height = 18;
  ws.mergeCells(`B${noteRow}:H${noteRow}`);
  set(`B${noteRow}`, pick(LABELS.sourceNote, script), {
    font: base(FONT_SIZE, true),
    alignment: { horizontal: 'left', vertical: 'middle' },
  });

  // Signature block. The reference file keeps this in Unicode Bangla (Nirmala UI)
  // even when the body is legacy, so it is reproduced that way.
  const sigDate = noteRow + 5;
  ws.getRow(sigDate).height = 18;
  set(`H${sigDate}`, new Date(`${report.date}T00:00:00Z`), {
    font: base(),
    alignment: centered,
    numFmt: 'dd-mm-yy',
  });
  const sigFont: Partial<ExcelJS.Font> = { name: 'Nirmala UI', size: 12 };
  set(`H${sigDate + 1}`, LABELS.signatory.unicode, { font: sigFont, alignment: centered });
  set(`H${sigDate + 2}`, LABELS.signatoryOrg.unicode, { font: sigFont, alignment: centered });
  set(`H${sigDate + 3}`, LABELS.signatoryAddr.unicode, { font: sigFont, alignment: centered });

  // -- Print setup ----------------------------------------------------------
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.4, top: 0.5, bottom: 0.4, header: 0.3, footer: 0.3 },
  };

  const written = await wb.xlsx.writeBuffer();
  return new Uint8Array(written as ArrayBuffer);
}

export { workbookFilename } from './filename';

/** Month names are exported for the docs build, which lists derived strings. */
export const DERIVED_MONTHS = BIJOY_MONTHS.filter((m) => m.source === 'derived').map((m) => m.unicode);
