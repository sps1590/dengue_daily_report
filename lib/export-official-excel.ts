import ExcelJS from 'exceljs';
import { LABELS } from './bijoy';
import { buildOfficialReportModel } from './export-official-report';
import type { DengueReport } from './types';

/**
 * A plain Unicode workbook of the official report's own eight-row shape —
 * not the byte-exact SutonnyMJ replica `lib/excel.ts` builds for the
 * circulated ten-row NMEP file. This is a new document, so it doesn't need
 * to match a legacy font encoding; Nirmala UI and Unicode Bangla are enough.
 */

const FONT = 'Nirmala UI';
const FONT_SIZE = 11;

const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

const peachFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };

export async function buildOfficialReportWorkbook(report: DengueReport): Promise<Uint8Array> {
  const m = buildOfficialReportModel(report);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'dengue_daily_report';
  wb.created = new Date();
  const ws = wb.addWorksheet('Official report');

  ws.columns = [
    { width: 8 }, // A serial
    { width: 22 }, // B division
    { width: 11 }, // C
    { width: 9 }, // D
    { width: 12 }, // E
    { width: 12 }, // F
    { width: 14 }, // G
    { width: 16 }, // H
  ];

  const base = (size = FONT_SIZE, bold = false): Partial<ExcelJS.Font> => ({ name: FONT, size, bold });
  const set = (addr: string, value: ExcelJS.CellValue, style: Partial<ExcelJS.Style> = {}) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    if (style.font) cell.font = style.font;
    if (style.alignment) cell.alignment = style.alignment;
    if (style.border) cell.border = style.border;
    if (style.fill) cell.fill = style.fill;
    return cell;
  };
  const centered: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // -- Masthead --------------------------------------------------------------
  const masthead = [LABELS.govt.unicode, LABELS.dghs.unicode.trim(), LABELS.branch.unicode, LABELS.address.unicode];
  masthead.forEach((text, i) => {
    const row = i + 1;
    ws.mergeCells(`A${row}:H${row}`);
    set(`A${row}`, text, { font: base(12, true), alignment: centered });
  });
  ws.mergeCells('A6:H6');
  set('A6', LABELS.title.unicode, { font: base(13, true), alignment: centered });

  // -- Table 1 header (rows 8-9) ----------------------------------------------
  const hRow1 = 8;
  const hRow2 = 9;
  ws.mergeCells(`A${hRow1}:A${hRow2}`);
  ws.mergeCells(`B${hRow1}:B${hRow2}`);
  ws.mergeCells(`C${hRow1}:D${hRow1}`);
  ws.mergeCells(`E${hRow1}:G${hRow1}`);
  ws.mergeCells(`H${hRow1}:H${hRow2}`);

  const hdr = { font: base(FONT_SIZE, true), alignment: centered, border: thin, fill: peachFill };
  set(`A${hRow1}`, 'ক্রমিক নং', hdr);
  set(`B${hRow1}`, LABELS.divisionName.unicode, hdr);
  set(`C${hRow1}`, LABELS.last24h.unicode, hdr);
  set(`E${hRow1}`, m.cumulativeHeaderText, hdr);
  set(`H${hRow1}`, LABELS.currentlyAdmitted.unicode, hdr);
  for (const addr of [`D${hRow1}`, `F${hRow1}`, `G${hRow1}`, `A${hRow2}`, `B${hRow2}`, `H${hRow2}`]) {
    ws.getCell(addr).border = thin;
    ws.getCell(addr).fill = peachFill;
  }
  set(`C${hRow2}`, LABELS.admitted.unicode, hdr);
  set(`D${hRow2}`, LABELS.deaths.unicode, hdr);
  set(`E${hRow2}`, LABELS.totalAdmitted.unicode, hdr);
  set(`F${hRow2}`, LABELS.totalDeaths.unicode, hdr);
  set(`G${hRow2}`, LABELS.discharged.unicode, hdr);

  // -- Table 1 body ------------------------------------------------------------
  const FIRST = hRow2 + 1;
  m.rows.forEach((r, i) => {
    const n = FIRST + i;
    const cell = (addr: string, v: ExcelJS.CellValue, align: Partial<ExcelJS.Alignment> = centered) =>
      set(addr, v, { font: base(), alignment: align, border: thin });
    cell(`A${n}`, r.serial);
    cell(`B${n}`, r.name, { horizontal: 'left', vertical: 'middle' });
    cell(`C${n}`, r.row.admitted24h);
    cell(`D${n}`, r.row.deaths24h);
    cell(`E${n}`, r.row.totalAdmitted);
    cell(`F${n}`, r.row.totalDeaths);
    cell(`G${n}`, r.row.discharged ?? '—');
    cell(`H${n}`, r.row.currentlyAdmitted ?? '—');
  });

  // The সর্বমোট row is the press release's own national totals, not a sum of
  // these eight rows — they omit Dhaka North/South City Corporation, so a
  // SUM() formula here would under-count against DGHS's published figures.
  const totalRow = FIRST + m.rows.length;
  ws.mergeCells(`A${totalRow}:B${totalRow}`);
  const totalStyle = { font: base(FONT_SIZE, true), alignment: centered, border: thin };
  set(`A${totalRow}`, LABELS.grandTotal.unicode, totalStyle);
  set(`C${totalRow}`, m.rowTotals.admitted24h, totalStyle);
  set(`D${totalRow}`, m.rowTotals.deaths24h, totalStyle);
  set(`E${totalRow}`, m.rowTotals.totalAdmitted, totalStyle);
  set(`F${totalRow}`, m.rowTotals.totalDeaths, totalStyle);
  set(`G${totalRow}`, m.nationalDischarged, totalStyle);
  set(`H${totalRow}`, m.nationalCurrentlyAdmitted, totalStyle);

  // -- Table 2: year comparison --------------------------------------------
  const heading2 = totalRow + 2;
  ws.mergeCells(`A${heading2}:H${heading2}`);
  set(`A${heading2}`, m.comparisonHeadingText, { font: base(13, true), alignment: centered });

  const cmpHead = heading2 + 2;
  ws.mergeCells(`B${cmpHead}:D${cmpHead}`);
  ws.mergeCells(`E${cmpHead}:F${cmpHead}`);
  set(`A${cmpHead}`, LABELS.serialFlat.unicode, hdr);
  set(`B${cmpHead}`, LABELS.year.unicode, hdr);
  set(`E${cmpHead}`, LABELS.caseCount.unicode, hdr);
  set(`G${cmpHead}`, LABELS.deathCount.unicode, hdr);
  set(`H${cmpHead}`, LABELS.remarks.unicode, hdr);
  for (const addr of [`C${cmpHead}`, `D${cmpHead}`, `F${cmpHead}`]) {
    ws.getCell(addr).border = thin;
    ws.getCell(addr).fill = peachFill;
  }

  m.comparisonRows.forEach((r, i) => {
    const n = cmpHead + 1 + i;
    ws.mergeCells(`B${n}:D${n}`);
    ws.mergeCells(`E${n}:F${n}`);
    const body = { font: base(), alignment: centered, border: thin };
    set(`A${n}`, r.serial, body);
    set(`B${n}`, r.periodLabel, { font: base(), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true }, border: thin });
    set(`E${n}`, r.cases ?? '—', body);
    set(`G${n}`, r.deaths ?? '—', body);
    set(`H${n}`, '', body);
    ws.getCell(`C${n}`).border = thin;
    ws.getCell(`D${n}`).border = thin;
    ws.getCell(`F${n}`).border = thin;
  });

  // -- Footer ------------------------------------------------------------------
  const noteRow = cmpHead + m.comparisonRows.length + 2;
  ws.mergeCells(`A${noteRow}:H${noteRow}`);
  set(`A${noteRow}`, LABELS.sourceNote.unicode, { font: base(FONT_SIZE, true), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } });

  const sigStart = noteRow + 3;
  const sigFont: Partial<ExcelJS.Font> = { name: 'Segoe Script', size: 16, italic: true };
  set(`G${sigStart}`, 'Anahar', { font: sigFont, alignment: { horizontal: 'center' } });
  set(`G${sigStart + 1}`, m.downloadDate, { font: base(), alignment: { horizontal: 'center' } });
  set(`G${sigStart + 2}`, LABELS.signatory.unicode, { font: base(), alignment: { horizontal: 'center' } });
  set(`G${sigStart + 3}`, LABELS.signatoryOrg.unicode, { font: base(), alignment: { horizontal: 'center' } });
  set(`G${sigStart + 4}`, LABELS.signatoryAddr.unicode, { font: base(), alignment: { horizontal: 'center' } });

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };

  const written = await wb.xlsx.writeBuffer();
  return new Uint8Array(written as ArrayBuffer);
}
