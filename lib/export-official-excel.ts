import ExcelJS from 'exceljs';
import { FONT_FOR_SCRIPT, LABELS, REGION_LABELS, pick, type OutputScript } from './bijoy';
import { buildOfficialReportModel } from './export-official-report';
import type { DengueReport } from './types';

/**
 * The official report's own eight-row shape, in either script — unlike
 * `lib/excel.ts` (the ten-row NMEP replica), this is a new document with no
 * legacy circulated file to byte-match, but the client asked for the same
 * SutonnyMJ/Unicode choice anyway, so it reuses the same `lib/bijoy.ts`
 * dictionary and `pick()` helper rather than inventing a second one.
 */

const FONT_SIZE = 11;

const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

const peachFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };

export async function buildOfficialReportWorkbook(report: DengueReport, script: OutputScript): Promise<Uint8Array> {
  const m = buildOfficialReportModel(report);
  const font = FONT_FOR_SCRIPT[script];

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

  const base = (size = FONT_SIZE, bold = false): Partial<ExcelJS.Font> => ({ name: font, size, bold });
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
  const masthead = [
    pick(LABELS.govt, script),
    pick(LABELS.dghs, script).trim(),
    pick(LABELS.branch, script),
    pick(LABELS.address, script),
  ];
  masthead.forEach((text, i) => {
    const row = i + 1;
    ws.mergeCells(`A${row}:H${row}`);
    set(`A${row}`, text, { font: base(12, true), alignment: centered });
  });
  ws.mergeCells('A6:H6');
  set('A6', pick(LABELS.title, script), { font: base(13, true), alignment: centered });

  // -- Table 1 header (rows 8-9) ----------------------------------------------
  const hRow1 = 8;
  const hRow2 = 9;
  ws.mergeCells(`A${hRow1}:A${hRow2}`);
  ws.mergeCells(`B${hRow1}:B${hRow2}`);
  ws.mergeCells(`C${hRow1}:D${hRow1}`);
  ws.mergeCells(`E${hRow1}:G${hRow1}`);
  ws.mergeCells(`H${hRow1}:H${hRow2}`);

  const hdr = { font: base(FONT_SIZE, true), alignment: centered, border: thin, fill: peachFill };
  set(`A${hRow1}`, pick(LABELS.serial, script), hdr);
  set(`B${hRow1}`, pick(LABELS.divisionName, script), hdr);
  set(`C${hRow1}`, pick(LABELS.last24h, script), hdr);
  set(`E${hRow1}`, m.cumulativeHeaderText, hdr);
  set(`H${hRow1}`, pick(LABELS.currentlyAdmitted, script), hdr);
  for (const addr of [`D${hRow1}`, `F${hRow1}`, `G${hRow1}`, `A${hRow2}`, `B${hRow2}`, `H${hRow2}`]) {
    ws.getCell(addr).border = thin;
    ws.getCell(addr).fill = peachFill;
  }
  set(`C${hRow2}`, pick(LABELS.admitted, script), hdr);
  set(`D${hRow2}`, pick(LABELS.deaths, script), hdr);
  set(`E${hRow2}`, pick(LABELS.totalAdmitted, script), hdr);
  set(`F${hRow2}`, pick(LABELS.totalDeaths, script), hdr);
  set(`G${hRow2}`, pick(LABELS.discharged, script), hdr);

  // -- Table 1 body ------------------------------------------------------------
  const FIRST = hRow2 + 1;
  m.rows.forEach((r, i) => {
    const n = FIRST + i;
    const cell = (addr: string, v: ExcelJS.CellValue, align: Partial<ExcelJS.Alignment> = centered) =>
      set(addr, v, { font: base(), alignment: align, border: thin });
    cell(`A${n}`, r.serial);
    cell(`B${n}`, pick(REGION_LABELS[r.row.key], script), { horizontal: 'left', vertical: 'middle' });
    cell(`C${n}`, r.row.admitted24h);
    cell(`D${n}`, r.row.deaths24h);
    cell(`E${n}`, r.row.totalAdmitted);
    cell(`F${n}`, r.row.totalDeaths);
    cell(`G${n}`, r.row.discharged ?? '—');
    cell(`H${n}`, r.row.currentlyAdmitted ?? '—');
  });

  // The সর্বমোট row is the press release's own national totals. Now that the
  // ঢাকা বিভাগ row combines Dhaka Division + DNCC + DSCC, this is also just
  // the sum of the eight rows above for every column that has real
  // per-division data — discharged/currentlyAdmitted are still national-only.
  const totalRow = FIRST + m.rows.length;
  ws.mergeCells(`A${totalRow}:B${totalRow}`);
  const totalStyle = { font: base(FONT_SIZE, true), alignment: centered, border: thin };
  set(`A${totalRow}`, pick(LABELS.grandTotal, script), totalStyle);
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
  set(`A${cmpHead}`, pick(LABELS.serialFlat, script), hdr);
  set(`B${cmpHead}`, pick(LABELS.year, script), hdr);
  set(`E${cmpHead}`, pick(LABELS.caseCount, script), hdr);
  set(`G${cmpHead}`, pick(LABELS.deathCount, script), hdr);
  set(`H${cmpHead}`, pick(LABELS.remarks, script), hdr);
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
  set(`A${noteRow}`, pick(LABELS.sourceNote, script), { font: base(FONT_SIZE, true), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } });

  // Excel has no way to load a web font, so the signature uses a script font
  // that ships with Windows/Office instead of the browser exports'
  // `Mrs Saint Delafield`. Monotype Corsiva is the thinnest classic
  // signature-style script Office ships — already slanted, so it doesn't
  // need the `italic` flag on top.
  // The designation lines are Unicode Bangla in the dictionary regardless of
  // script (the reference workbook keeps this block in Unicode even in its
  // legacy export — see lib/excel.ts), so they always need a Unicode-capable
  // font: SutonnyMJ applied to real Unicode text renders as mojibake, not
  // just the wrong glyphs.
  const sigStart = noteRow + 3;
  const sigCursiveFont: Partial<ExcelJS.Font> = { name: 'Monotype Corsiva', size: 20 };
  const sigTextFont: Partial<ExcelJS.Font> = { name: 'Nirmala UI', size: FONT_SIZE };
  set(`G${sigStart}`, 'Anahar', { font: sigCursiveFont, alignment: { horizontal: 'center' } });
  set(`G${sigStart + 1}`, m.downloadDate, { font: sigTextFont, alignment: { horizontal: 'center' } });
  set(`G${sigStart + 2}`, pick(LABELS.signatory, script), { font: sigTextFont, alignment: { horizontal: 'center' } });
  set(`G${sigStart + 3}`, pick(LABELS.signatoryOrg, script), { font: sigTextFont, alignment: { horizontal: 'center' } });
  set(`G${sigStart + 4}`, pick(LABELS.signatoryAddr, script), { font: sigTextFont, alignment: { horizontal: 'center' } });

  const preparedByFont: Partial<ExcelJS.Font> = { name: 'IBM Plex Sans', size: 10, italic: true, color: { argb: 'FF555555' } };
  set(`G${sigStart + 6}`, 'Prepared by: MIS Expert, NMEP', { font: preparedByFont, alignment: { horizontal: 'center' } });

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
