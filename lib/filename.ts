/** Naming convention for the circulated workbook, kept free of any Node
 *  dependency so client components can import it without pulling in ExcelJS. */
export function workbookFilename(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `Dengue Report, Daily -${y} (${d}-${m}-${y.slice(2)}) F.xlsx`;
}
