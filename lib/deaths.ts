import { getDocumentProxy } from 'unpdf';
import { resolveDistrict, resolveDivision } from './districts';
import { REGION_ORDER, type DeathDistrictRow, type DeathSummary, type RegionKey } from './types';

/**
 * Reads the district-wise death counts out of a DGHS "Dengue Death list" PDF.
 *
 * That PDF is one wide table with a row per death and, alongside the
 * hospital's location (Reporting Division / District-CityCorporation /
 * Upazila-Zone), the patient's name, mobile number, address and home district.
 * Only the reporting district is wanted, and the rest is confidential, so the
 * table is read by column position and every other column is discarded
 * without ever being kept.
 *
 * "Position" matters because the cells are plain text runs, not a real table
 * structure: an empty "Reg No" cell or a hospital name that wraps onto a
 * second line would shift every later value if the rows were read as a flat
 * list. Instead each column's horizontal extent is measured from its header
 * cell, and each run of text is assigned to the row whose serial number it is
 * nearest to vertically.
 */

export class DeathListError extends Error {}

interface Item {
  x: number;
  y: number;
  /** Horizontal centre — cell text is centred, so this lines up with the header's centre. */
  cx: number;
  s: string;
}

interface Zones {
  headerY: number;
  /** Items left of this x are the serial-number column. */
  slMax: number;
  /** The "Date" column, used only as a fallback source for the list's date. */
  dateMin: number;
  rdMin: number;
  /** Reporting Division is (rdMin, rdMax]; District/CityCorporation is (rdMax, dcMax]. */
  rdMax: number;
  dcMax: number;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "7-Nov-2026" or "07-Nov-26" -> "2026-11-07". */
function parseListDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})-([A-Za-z]{3})[A-Za-z]*-(\d{2}|\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${year}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function findZones(items: Item[]): Zones | null {
  const first = (re: RegExp) => items.find((i) => re.test(i.s.trim()));
  const sl = first(/^SL$/i);
  const year = first(/^Year$/i);
  const date = first(/^Date$/i);
  const reporting = first(/^Reporting\s*Division$/i);
  const district = first(/City\s*Corporation$/i);
  // The patient's own address block repeats "Upazila/Zone"; the hospital's is the left-most.
  const upazila = items
    .filter((i) => /^Upazila\s*\/?\s*Zone$/i.test(i.s.trim()))
    .sort((a, b) => a.x - b.x)[0];
  if (!sl || !year || !date || !reporting || !district || !upazila) return null;

  return {
    headerY: sl.y,
    slMax: (sl.cx + year.cx) / 2,
    dateMin: date.cx - (reporting.cx - date.cx) / 2,
    rdMin: (date.cx + reporting.cx) / 2,
    rdMax: (reporting.cx + district.cx) / 2,
    dcMax: (district.cx + upazila.cx) / 2,
  };
}

async function readPages(bytes: Uint8Array): Promise<Item[][]> {
  const doc = await getDocumentProxy(bytes);
  const pages: Item[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items) {
      if (!('str' in it)) continue;
      const s = it.str.trim();
      if (!s) continue;
      const x = it.transform[4];
      items.push({ x, y: it.transform[5], cx: x + it.width / 2, s });
    }
    pages.push(items);
  }
  return pages;
}

const joinCell = (cell: Item[]) =>
  cell
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((i) => i.s)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

export async function parseDeathList(bytes: Uint8Array): Promise<DeathSummary> {
  const pages = await readPages(bytes);

  let zones: Zones | null = null;
  let sawHeader = false;
  let listDate: string | null = null;
  const counts = new Map<string, DeathDistrictRow>();
  const notes: string[] = [];
  let total = 0;

  for (const items of pages) {
    zones = findZones(items) ?? zones;
    if (!zones) continue;
    sawHeader = true;
    const z = zones;

    listDate ??= items
      .filter((i) => i.y > z.headerY)
      .map((i) => parseListDate(i.s))
      .find((d): d is string => d !== null) ?? null;

    const body = items.filter((i) => i.y < z.headerY - 2);
    const anchors = body
      .filter((i) => i.cx < z.slMax && /^\d{1,3}$/.test(i.s))
      .sort((a, b) => b.y - a.y);
    if (!anchors.length) continue;

    const gaps = anchors.slice(1).map((a, i) => anchors[i].y - a.y);
    const maxDy = gaps.length ? Math.min(...gaps) / 2 : 14;

    const cells = anchors.map(() => ({ division: [] as Item[], district: [] as Item[], date: [] as Item[] }));
    for (const it of body) {
      if (it.cx < z.slMax) continue;
      let best = -1;
      let bestDy = Infinity;
      anchors.forEach((a, idx) => {
        const dy = Math.abs(a.y - it.y);
        if (dy < bestDy) {
          bestDy = dy;
          best = idx;
        }
      });
      if (best < 0 || bestDy > maxDy) continue;
      if (it.cx > z.rdMin && it.cx <= z.rdMax) cells[best].division.push(it);
      else if (it.cx > z.rdMax && it.cx <= z.dcMax) cells[best].district.push(it);
      else if (it.cx > z.dateMin && it.cx <= z.rdMin) cells[best].date.push(it);
    }

    for (const row of cells) {
      total += 1;
      listDate ??= parseListDate(joinCell(row.date));
      const divisionText = joinCell(row.division);
      const districtText = joinCell(row.district);

      const resolved = districtText ? resolveDistrict(districtText) : null;
      const rowKey = resolved?.en ?? (districtText || 'Unknown');
      let entry = counts.get(rowKey);
      if (!entry) {
        const division: RegionKey | null = resolved?.division ?? resolveDivision(divisionText);
        entry = {
          district: rowKey,
          districtBn: resolved?.bn ?? (districtText ? districtText : 'অজানা'),
          division,
          deaths: 0,
        };
        counts.set(rowKey, entry);
        if (!resolved) {
          notes.push(
            districtText
              ? `District "${districtText}" is not one of the 64 known districts, so it is shown as written.`
              : 'A death row had no district written in it; it is counted under "অজানা" (unknown).',
          );
        }
      }
      entry.deaths += 1;
    }
  }

  if (!sawHeader) {
    throw new DeathListError(
      'This does not look like the DGHS dengue death list: the "Reporting Division" and "District/CityCorporation" columns were not found.',
    );
  }

  const divisionRank = (k: RegionKey | null) => (k === null ? 99 : REGION_ORDER.indexOf(k));
  const districts = [...counts.values()].sort(
    (a, b) => divisionRank(a.division) - divisionRank(b.division) || a.district.localeCompare(b.district),
  );

  notes.unshift(
    total === 0
      ? 'The list has no death rows.'
      : `Read ${total} death${total === 1 ? '' : 's'} in ${districts.length} district${districts.length === 1 ? '' : 's'}` +
          `${listDate ? ` from the list dated ${listDate}` : ''}.`,
    'Only the reporting district of each death was kept; patient names, mobile numbers and addresses were discarded.',
  );
  if (!listDate) notes.push('The date printed on the list could not be read.');

  return { date: listDate, total, districts, notes };
}
