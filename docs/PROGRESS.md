# Progress log

Every change to this project, newest first. Each entry records what changed, why, and — where it matters — what was verified rather than assumed.

Add a new entry at the top of the log for each change. Keep the "verified" line honest: it is the part that saves someone a bad afternoon later.

---

## 2026-09-03 — v1.0.0, initial build

### Requirements taken from the brief

1. Fetch and parse the DGHS daily dengue press release for a chosen date.
2. Produce `Dengue Report, Daily -2026 (02-09-26) F.xlsx` in downloadable form.
3. An analyse-data action producing a management-grade AI report.
4. Modern interface.
5. Deployable to Vercel.
6. Markdown documentation with a progress log.
7. Git repository named `dengue_daily_info`.

### Investigation before any code was written

**Reference workbook.** Opened `Dengue_Report__Daily_-2026__02-09-26__F_.xlsx` and dumped every cell, font, border, merge range, column width and row height. Findings:

- Bangla is stored as **legacy SutonnyMJ (Bijoy) ASCII**, not Unicode. B2 holds `MYcÖRvZš¿x evsjv‡`k miKvi`.
- The signature block (H34–H36) is the exception — it is Unicode Bangla in Nirmala UI. The file mixes both.
- Numbers are stored as numbers. SutonnyMJ renders ASCII `0-9` as `০-৯`, which is why this works.
- The sheet was **partially filled**: most figures are blank or zero. Only the 2025 comparison row is populated (32,946 cases / 127 deaths through 03 September).
- Eight division rows, **numbered 2–9**. Serial 1 is absent. See open question below.

**DGHS portal.** Fetched the index page. The PDF URL is fully deterministic:

```
https://old.dghs.gov.bd/images/docs/vpr/YYYYMMDD_dengue_all.pdf
```

Archive runs back to 08 July 2023. Two data-quality notes: 18–23 July 2024 is missing from the index, and the 12–14 April 2024 labels carry a stray space (`ডেঙ্গু প্রেস রিলিজ ১৪ /০৪/২০২৪`) — which is why the index check matches on the filename stem first and the Bengali label only as a fallback.

**Attempted and failed.** Could not fetch an actual press-release PDF. DGHS returns `ROBOTS_DISALLOWED` for the `/images/docs/vpr/` path from an automated client. The parser is therefore written against the known table structure but **has not been validated against live input**. This is the single largest open risk in the project.

### Decisions

**Closed dictionary instead of a Bijoy transliterator.** A general Unicode→SutonnyMJ converter needs vowel reordering, reph placement and conjunct handling, and when it gets one wrong it produces plausible-looking garbage rather than an error. Since the sheet emits a fixed, small set of strings, `lib/bijoy.ts` holds them all explicitly, tagged `verbatim` (copied from the reference file) or `derived` (composed from the standard table). Only 12 strings are `derived`: ten month names and the two city-corporation labels.

**Next.js API routes instead of Supabase Edge Functions.** The brief specified Supabase. Deploying to Vercel makes a second service unnecessary — one framework, no CORS hop, nothing extra to provision. Both PDF-handling routes run on the Node runtime because `exceljs` and `unpdf` cannot run on Edge.

**HTML brief instead of `jspdf`.** `jspdf` embeds no Bangla font, so a Bangla brief would export as empty boxes. A self-contained HTML file with print CSS prints to PDF from any browser with fonts already resolved.

**Anthropic instead of OpenAI/Gemini.** Native PDF input is what makes the scanned-release fallback work — the file is attached rather than the extracted text. Swappable in `lib/ai.ts`.

**Two-path extraction.** A deterministic pattern parser runs first and scores its own confidence from how much of the table it recognised. Below 60%, or when the text layer is nearly empty, the PDF is re-read by the model. The UI always shows which path ran.

**Linked fonts instead of `next/font/google`.** `next/font` self-hosts at build time, which is faster — but it turns a font CDN outage into a failed deployment. For a tool that may need redeploying from a government network, a linked stylesheet with a system fallback is the safer trade. Reverting is a one-file change.

### Verified

| What | How | Result |
|---|---|---|
| All 30 `verbatim` Bijoy strings | Byte-for-byte diff against the reference workbook | **30/30 match** |
| Workbook geometry | Generated a file, dumped widths, heights, merges, fonts, compared to source | Matches; extends correctly from 8 to 10 rows |
| Formulas | LibreOffice recalculation | 6 formulas, **0 errors** |
| TypeScript | `tsc --noEmit` | Clean |
| Production build | `next build` | Succeeds. 213 kB first load |
| Bundle hygiene | Searched client chunks for ExcelJS | Absent — `workbookFilename` was split into `lib/filename.ts` to keep it out |
| `POST /api/excel` | Live server, real payload | 200, correct MIME, correct filename, valid workbook |
| Error paths | Implausible date, missing key, empty body | All return the intended message and status |
| Comparison-row fallback | Payload omitting the current year | Falls back to report totals correctly |

### Not verified

- **The pattern parser against a real PDF.** Blocked by `robots.txt`. Highest-priority follow-up.
- **The 12 `derived` Bijoy strings.** They render correctly only if SutonnyMJ is installed; composed from the standard table, not copied from a source file. The ten month names appear once each per year in the comparison table.
- **The two city-corporation row labels**, for the same reason.

### Fixed during the build

- `lib/bijoy.ts` — the SutonnyMJ byte for `দ` is U+0060, a backtick, which silently terminated a template literal in `cumulativeHeader()`. Switched to concatenation, with a comment so it is not reintroduced.
- `lib/excel.ts` — ExcelJS `writeBuffer()` returns its own `Buffer` type, which does not satisfy `BodyInit`. Now returns `Uint8Array` and the route slices a real `ArrayBuffer`.
- `app/page.tsx` — importing `workbookFilename` from `lib/excel.ts` would have pulled all of ExcelJS into the client bundle. Split into `lib/filename.ts`.
- `app/api/excel/route.ts` — the download filename was percent-encoded in the plain `filename=` parameter, so browsers showed `%20` literally. The name is pure ASCII, so it is now passed verbatim, with the RFC 5987 form kept in `filename*`.

### Open question for the client

The reference workbook has eight division rows numbered 2–9, with serial 1 missing. The press release itself reports Dhaka North and Dhaka South city corporations separately, so this build produces the full ten-row structure numbered from 1.

**If the circulated sheet genuinely uses eight rows starting at 2, edit `REGION_ORDER` in `lib/types.ts`.** Everything downstream — the table, the charts, the Excel writer, the Dhaka split — follows from that one array.

### Next

1. Run against a real date and check the extraction log. Correct `REGION_PATTERNS` in `lib/parse.ts` if a region fails to match.
2. Have someone with SutonnyMJ installed open a `legacy` export and confirm the twelve `derived` strings. Promote them to `verbatim` in `lib/bijoy.ts` once confirmed.
3. Confirm the eight-versus-ten row question above.
4. Consider persisting each day's parsed figures so the brief can speak to a trend rather than a single day. A daily cron writing to Postgres or KV would be a small addition and would make the brief substantially more useful.
