/* Builds a workbook from a synthetic report so its geometry can be diffed
 * against the reference file NMEP circulates.
 *   npx tsc -p scripts/tsconfig.test.json && node scripts/test-excel.js  */
const { writeFileSync } = require('node:fs');
const { buildWorkbook } = require('../.testbuild/lib/excel.js'); // built by scripts/tsconfig.test.json

const REGIONS = ['DHAKA_NORTH_CITY', 'DHAKA_SOUTH_CITY', 'DHAKA_DIVISION', 'MYMENSINGH', 'CHATTOGRAM',
  'KHULNA', 'RAJSHAHI', 'RANGPUR', 'BARISHAL', 'SYLHET'];

const sample = [
  [96, 0, 8412, 31, 8180, 201], [74, 1, 7233, 28, 7002, 203], [41, 0, 3980, 12, 3872, 96],
  [8, 0, 611, 2, 598, 11], [63, 1, 5177, 19, 5041, 117], [22, 0, 1844, 5, 1801, 38],
  [11, 0, 902, 3, 884, 15], [6, 0, 470, 1, 461, 8], [29, 0, 2310, 7, 2260, 43], [9, 0, 705, 2, 690, 13],
];

const rows = REGIONS.map((key, i) => {
  const [a, d, ta, td, dis, cur] = sample[i];
  return { key, admitted24h: a, deaths24h: d, totalAdmitted: ta, totalDeaths: td, discharged: dis, currentlyAdmitted: cur };
});
const sum = (k) => rows.reduce((t, r) => t + r[k], 0);

const report = {
  date: '2026-09-02',
  sourceUrl: 'https://old.dghs.gov.bd/images/docs/vpr/20260902_dengue_all.pdf',
  sourceLabel: 'ডেঙ্গু প্রেস রিলিজ ০২/০৯/২০২৬',
  rows,
  totals: {
    admitted24h: sum('admitted24h'), deaths24h: sum('deaths24h'),
    totalAdmitted: sum('totalAdmitted'), totalDeaths: sum('totalDeaths'),
    discharged: sum('discharged'), currentlyAdmitted: sum('currentlyAdmitted'),
  },
  comparison: [{ year: 2025, cases: 32946, deaths: 127 }, { year: 2026, cases: sum('totalAdmitted'), deaths: sum('totalDeaths') }],
  extraction: { method: 'pattern', confidence: 0.95, notes: [] },
};

(async () => {
  for (const script of ['legacy', 'unicode']) {
    const bytes = await buildWorkbook(report, { script });
    writeFileSync(`/tmp/out-${script}.xlsx`, bytes);
    console.log(`wrote /tmp/out-${script}.xlsx (${bytes.byteLength} bytes)`);
  }
})();
