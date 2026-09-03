# Progress log

Every change to this project, newest first. Each entry records what changed, why, and — where it matters — what was verified rather than assumed.

Add a new entry at the top of the log for each change. Keep the "verified" line honest: it is the part that saves someone a bad afternoon later.

---

## 2026-09-03 — v1.2.0, manual entry fallback; the DGHS source is not what it was built against

### What was found

The client reported "Download the PDF" failing on the live deployment. Investigated
properly instead of repeating the earlier "DGHS blocks bots" assumption from the
initial build (which was never actually verified against a live server — see the
v1.0.0 entry below):

- **`old.dghs.gov.bd` — the domain this entire app targets — times out at the TCP
  level.** DNS resolves (`103.247.238.22`), but the connection never completes,
  from both a local sandbox and Vercel's `sin1` region. This is not a robots.txt
  block; the subdomain looks dead or firewalled off entirely.
- **DGHS's current site (`dghs.gov.bd`, no `old.`) is alive** and has a modern
  press-releases system (`/pages/press-releases`, ~155 entries, paginated,
  search box that actually filters). As of the date checked, the daily
  disease-surveillance bulletin being published there is **হাম প্রেস রিলিজ —
  measles**, not dengue.
- Searching that system's own press-release search for **ডেঙ্গু (dengue) returned
  zero results.** No dengue press release exists anywhere in DGHS's current
  content system under that name, as far as this check could tell.

**Conclusion:** there is no code bug to fix in `lib/dghs.ts` — the URL pattern it
targets (`old.dghs.gov.bd/images/docs/vpr/YYYYMMDD_dengue_all.pdf`) points at
infrastructure that is either gone or has moved, and the daily dengue series
under that name does not currently exist to be found. This was flagged to the
client rather than silently worked around.

### What was built

Per the client's choice, added a **manual entry fallback** rather than guessing
at a replacement URL:

- `components/ManualEntryForm.tsx` — a "Enter manually" mode on the Report tab
  (toggle next to "Fetch from DGHS"), with the same 10-region × 6-figure grid as
  the sheet, a live-updating total row, and optional source-note/source-link
  fields for citing wherever the figures actually came from that day.
- The resulting `DengueReport` is tagged `extraction.method: 'manual'`,
  `confidence: 1`, and flows through the exact same `report` state as a
  successful fetch — Excel export, the brief, the Dashboard, all unchanged.
  Nothing downstream needed to know the numbers didn't come off a PDF.
- `lib/types.ts` — `extraction.method` gained `'manual'` alongside `pattern` /
  `model` / `mixed`.
- Manual entries can leave `sourceUrl` blank (there may be no single URL for a
  phoned-in or press-briefing figure). Every place that previously rendered
  `report.sourceUrl` unconditionally — the Report tab's "Open the original…"
  link, the Dashboard's per-entry "Source" link, the brief's HTML export — now
  guards on it being non-empty instead of rendering a dead link.

### Verified

| What | How | Result |
|---|---|---|
| `old.dghs.gov.bd` reachability | `curl` from sandbox with a 15s timeout, both `http://` and `https://` | Connection timed out both times; `dghs.gov.bd` (no `old.`) and a control site (`google.com`) both responded in under 1s from the same network |
| DGHS's current press-release search | Typed "ডেঙ্গু" into the live site's own search box | "কোনো তথ্য পাওয়া যায়নি" — no results |
| `npm run typecheck` / `npm run build` | — | Clean; `/dashboard` route unaffected |
| Manual entry → full report UI | Filled 2 of 10 regions in a running dev server, submitted | Figure strip, division table, both charts and the extraction log all rendered correctly; unfilled regions show `—` |
| Manual entry → Excel export | Clicked both script buttons against the populated report | `POST /api/excel` → 200 for both `legacy` and `unicode` |
| Manual entry → Dashboard | Same entry, checked the Dashboard tab | Shows `100% · manual` badge, correct aggregated totals, "Source" link correctly hidden when no URL was given |

### Open question for the client

Where do the day's dengue figures actually come from right now, if not
`old.dghs.gov.bd`? If there is a current URL (a different DGHS page, a PDF
posted elsewhere, an API), `lib/dghs.ts` and `lib/parse.ts` can be rewired to
it in the same shape as before. Until then, the manual entry form is the
supported path.

## 2026-09-03 — v1.1.0, Dashboard tab, repo rename to `dengue_daily_report`

### What changed

1. **Dashboard tab** (`app/dashboard/page.tsx`, `components/Dashboard.tsx`,
   `lib/history.ts`). Every report the Report tab successfully fetches is now
   saved to `localStorage` in the browser (client-side only — no server store
   yet, consistent with the "Next" item already logged below). The Dashboard
   lists every saved date with its confidence/method badge, headline figures,
   and download buttons for both Excel scripts and the brief, if one has been
   generated for that date. Downloads are rebuilt from the stored report JSON
   on each click (via the same `/api/excel` route the Report tab uses, and the
   same `briefToHtml()` for the brief) rather than replayed from a cached
   blob — so every download is a live working file: the workbook keeps its
   `SUM` formulas, the brief is plain HTML. Neither is a flattened snapshot.
2. **Shared download/footer code** extracted so the Report tab and Dashboard
   don't duplicate it: `lib/download.ts` (the `/api/excel` call + blob
   download) and `components/Footer.tsx` (the data-caveat footer).
3. **Tab navigation** added to `Masthead.tsx` (now a client component, uses
   `usePathname`) so both tabs share one header.
4. **Project moved into its own repository, `dengue_daily_report`** (GitHub)
   — the name the client asked for. `package.json`'s `name` field and the
   README title were updated to match; nothing in `lib/` or the DGHS-facing
   code changed, since none of it referenced the old name.

### Verified

| What | How | Result |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit` | Clean |
| `npm run build` | `next build` | Succeeds, same route shape plus `/dashboard` |
| Dashboard → Excel download | Seeded a synthetic report into `localStorage`, clicked both script buttons in a running dev server | `POST /api/excel` → 200 for both `legacy` and `unicode` |
| Report tab still fetches, marks pipeline steps, shows the "did not produce a report" error state | Ran against today's date in the dev sandbox | Works; the DGHS fetch itself still fails from this sandbox for the reason already logged below (not something this change could affect) |

### Not verified

- The Dashboard's real end-to-end path (fetch a real release on the Report
  tab → confirm it appears on the Dashboard → download from there) — blocked
  by the same DGHS `robots.txt` restriction noted below. The synthetic-data
  check above exercises the same code path (`downloadExcelFile` →
  `/api/excel`) that a real fetch would use, so this is a low-risk gap, but
  run it for real once a live fetch succeeds.

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
