import { REGION_EN, type DeathSummary, type DengueReport, type RegionKey } from './types';

/**
 * The death list and the case table are two separate DGHS files for the same
 * day, so each is a check on the other: the deaths in the last 24 hours that
 * the case table reports, division by division, should equal the deaths the
 * list names. Returns a plain-language line for each way they disagree (none
 * when they agree), shown next to the upload rather than blocking it.
 */
export function checkDeathsAgainstCases(report: DengueReport, deaths: DeathSummary): string[] {
  const issues: string[] = [];

  if (deaths.date && deaths.date !== report.date) {
    issues.push(`The death list is dated ${deaths.date}, but the report is for ${report.date}.`);
  }

  const reported = report.totals.deaths24h;
  if (typeof reported === 'number' && reported !== deaths.total) {
    issues.push(
      `The case table reports ${reported} death${reported === 1 ? '' : 's'} in the last 24 hours; the death list has ${deaths.total}.`,
    );
  }

  const fromList = new Map<RegionKey, number>();
  for (const d of deaths.districts) {
    if (d.division) fromList.set(d.division, (fromList.get(d.division) ?? 0) + d.deaths);
  }
  const caseDeaths = (key: RegionKey): number | null => {
    // Dhaka is Dhaka Division plus the two city corporations, whichever way the PDF reports it.
    const keys: RegionKey[] = key === 'DHAKA_DIVISION' ? ['DHAKA_DIVISION', 'DHAKA_NORTH_CITY', 'DHAKA_SOUTH_CITY'] : [key];
    const values = report.rows.filter((r) => keys.includes(r.key)).map((r) => r.deaths24h);
    return values.length ? values.reduce<number>((a, v) => a + (v ?? 0), 0) : null;
  };

  const divisions = new Set<RegionKey>([...fromList.keys(), ...report.rows.map((r) => (r.key === 'DHAKA_NORTH_CITY' || r.key === 'DHAKA_SOUTH_CITY' ? 'DHAKA_DIVISION' : r.key))]);
  for (const key of divisions) {
    const inCases = caseDeaths(key);
    const inList = fromList.get(key) ?? 0;
    if (inCases !== null && inCases !== inList) {
      issues.push(`${REGION_EN[key]}: the case table has ${inCases} death${inCases === 1 ? '' : 's'}, the list has ${inList}.`);
    }
  }
  return issues;
}
