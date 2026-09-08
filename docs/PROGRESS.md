# Progress log

Every change to this project, newest first. Each entry records what changed, why, and — where it matters — what was verified rather than assumed.

Add a new entry at the top of the log for each change. Keep the "verified" line honest: it is the part that saves someone a bad afternoon later.

---

## 2026-09-08 — v1.9.1, thinner, more realistic signature

### What was reported

The client asked for the signature to look thinner and more human — either
by adjusting the existing text signature or by pasting in a cropped image of
a real signature (no image was actually attached, so the text route was
taken).

### What changed

`Caveat` (weight 600) reads as a thick, marker-like script rather than a pen
signature. Replaced with `Mrs Saint Delafield` — thin single-weight strokes,
much closer to real handwriting — across every export that can load a web
font (on-screen, HTML, PDF, Image): `app/layout.tsx`'s global font link and
`lib/export-official-report.ts`'s `OFFICIAL_REPORT_CSS` and standalone-HTML
font link. Added a slight `rotate(-3deg)` and a dark-ink colour (`#1a1a2e`
instead of pure black) rather than plain upright black text, since a real
signature is never perfectly level or exactly the same black as the printed
text around it.

Word and Excel can't load web fonts, so their fallback scripts changed too:
Word's override now tries `Monotype Corsiva` before `Segoe Script` (Corsiva
is the thinner, more classically signature-like of the two, and Word doesn't
reliably honour the `rotate()` transform so that's dropped in its override).
Excel's signature font (`lib/export-official-excel.ts`) switched from `Segoe
Script` to `Monotype Corsiva` outright, dropping the `italic` flag Corsiva
doesn't need.

### Verified

Dev server: `document.fonts.check` confirms `Mrs Saint Delafield` actually
loads and the computed style shows the intended font, weight, colour and
rotation on the rendered `.signature-cursive` element. Generated the Excel
export and read the signature cell's font back via `exceljs`: confirmed
`Monotype Corsiva`, size 20. Typecheck and a full production build both
clean.

---

## 2026-09-08 — v1.9.0, archive source for releases on/before 03/09/2026

### What was reported

Fetching 03/09/2026 or earlier showed "This date did not produce a report —
DGHS's current listing does not carry a dengue press release for this date.
Dates currently listed: 2026-09-08, 2026-09-06, 2026-09-05, 2026-09-04." The
client also asked that older, current, and upcoming releases all be
reachable — pointing at a second DGHS URL, a static archive page, for the
older ones.

### What was found

The live `miscellaneous-infos` listing (`lib/dghs.ts`'s `fetchListing`) had
simply dropped every entry on/before 03/09/2026 — DGHS's own doing, not a
bug in this app. The archive page the client pointed at
(`dghs.gov.bd/pages/static-pages/dengue-press-release-gxrgtg-...`) does carry
those dates, back to 27/08/2019, but not in ordinary server-rendered HTML: the
entire link list sits inside a custom `<rt-renderer encoded-content="...">`
element, base64-encoded, and *not* as one contiguous block — several
independently-encoded chunks joined with `;`. Decoding chunk-by-chunk as raw
bytes and concatenating before the final UTF-8 decode avoids corrupting a
multi-byte Bangla character that lands on a chunk boundary.

The archive was clearly maintained by hand over 7 years: the linked PDF
filenames follow at least five different naming schemes (`vpr/YYYYMMDD_
dengue_all.pdf` for the last year or so; `Dengue_YYYYMMDD.pdf`, `Dengue_
YYYY_MM_DD.pdf`, a bare `YYYYMMDD.pdf`, and `Dengue_DD_MM_YY.pdf` for
various older stretches). Dates are read from each PDF's own filename — never
from the link's visible Bangla text — since the filename is plain ASCII and
unaffected by the chunk-boundary risk above. Verified against the live page:
1878 of 1879 linked files matched one of the five patterns; the one holdout's
filename doesn't encode a date at all and is simply skipped.

`lib/dghs.ts`'s `locateRelease` now routes by date: on/before
`ARCHIVE_CUTOFF_DATE` ('2026-09-03') goes to the new `fetchArchiveListing`;
after it, to the existing live `fetchListing`, unchanged. The archive fetch
gets the same retry-once + `describeNetworkFailure` treatment as the live
listing, plus its own 30-minute cache (longer than the live listing's 5,
since the archive changes at most once a day and only right at the cutoff).
The date picker's minimum and `isPlausibleReportDate`'s earliest bound both
moved from 2023-01-01 to 2019-01-01 to match.

Not addressed here: the 2019-era press releases use a completely different
plain-table PDF layout than the BI-dashboard export the current parser
(`parseBiPressRelease`) targets. A spot check on 27/08/2019 located and
downloaded the file correctly but the legacy `parseReportText` fallback
mis-parsed it (95% reported confidence on numbers that don't hold together,
e.g. admitted-24h reading higher than cumulative-admitted) — a parser-quality
problem for that older layout, separate from the archive-access problem this
entry fixes, flagged as a follow-up rather than fixed here.

### Verified

Dev server: 2026-09-03 (the reported failing date) now returns a full report
via the archive URL (`vpr/20260903_dengue_all.pdf`) instead of the "did not
produce a report" error — confirmed end-to-end in the browser UI, not just
via curl. 2026-08-15 and 2019-08-27 (oldest/legacy-format entry) both locate
and download correctly. 2026-09-06 (after the cutoff) still routes to the
live listing, unchanged. An unpublished archive-range date (2020-02-15)
returns a short, sane 404 instead of the live listing's "dump every date"
message. Typecheck clean.

---

## 2026-09-08 — v1.8.0, per-division discharged/currently-admitted recovered from the PDF

### What was reported

The client noticed that every division row in the official report showed `—`
for the last two columns (discharged, currently admitted) except the
সর্বমোট totals row, and asked for that row-level data to be pulled from the
source PDF instead of left blank.

### What was found

`lib/parse.ts` only ever read the BI-dashboard's page-one charts, which give
admitted/deaths per division but never discharged/currently-admitted. Those
two figures for the day *are* in the PDF — much further down, in a long
district-by-district table that rolls each district up into a
"বিভাগের সর্বমোট" (division grand total) row carrying exactly those two
columns. Verified against the live 06/09/2026 PDF: every one of the eight
division grand-total rows was found and summed to the press release's own
national totals (discharged: 39,479 matched exactly; currently-admitted:
2,995 vs. the chart's 2,994, a pre-existing 1-unit discrepancy between DGHS's
own two internal tables, not a parsing error — deaths shows the same 116 vs
117 split).

Matching a division's grand-total row by its 24-hour admission figure alone
was not unique on the first pass: a Mymensingh district subtotal and
Rangpur's actual division total both summed to 56, and a Satkhira district
subtotal happened to equal Sylhet's national 9 — both were initially
misattributed. Fixed by also preferring whichever same-total candidate's
cumulative admitted figure lands closest to that division's already-known
chart total, which resolved both collisions correctly and left every other
(unambiguous) division unaffected.

Dhaka North and South City Corporation are still never broken out from each
other in that table — only their combined "ঢাকা মহানগর" row exists — so
`DengueReport.dhakaCityDischarged` carries that combined figure separately,
and `buildOfficialReportModel` adds it onto the merged ঢাকা বিভাগ row rather
than attributing it to either corporation individually. Their rows in the
plain division table (`SheetTable`) correctly still show `—` for these two
columns, since the source genuinely doesn't split them.

### Verified

Live 06/09/2026 report via the dev server: all 8 non-Dhaka-city rows and the
combined ঢাকা বিভাগ row now show real figures; the eight rows' discharged sum
to the national total exactly (39,479); typecheck clean; confirmed on-screen
in the Official Report table via the browser.

---

## 2026-09-08 — v1.7.1, "fetch failed" diagnosed: DGHS unreachable from Vercel, not a code bug

### What was reported

The client saw the fetch fail with a raw "fetch failed" message on the live
site, for a date (06/09/2026) that had worked minutes earlier.

### What was found

Reproduced it directly against production and checked Vercel's own function
logs before touching any code:

- `curl` from this sandbox to the DGHS listing URL: instant `200`, every time.
- The same URL, called from the live Vercel deployment: a consistent ~10.8s
  hang ending in a raw network-level failure, on every attempt (three
  in a row, a few seconds apart — not a one-off blip).
- The function log confirms only *one* outbound call was ever attempted (the
  listing fetch) before the request died — it never got as far as the PDF
  download step.

DGHS's server (or a WAF in front of it) is not completing the connection
from Vercel's egress right now, while it answers this sandbox's requests
immediately. The most likely explanation is that this session's own
extensive testing volume against the live source earlier today (v1.4.0
onward) tripped a rate limit or temporary IP-level block on Vercel's shared
egress range — DGHS's server behaviour is otherwise unchanged, and the
scraping logic itself was working correctly as recently as the same session.
This is **not a parsing or scraping bug**: the code that worked an hour ago
is unchanged.

### What was built regardless

Whether or not this specific block is self-inflicted, "a government server
occasionally won't answer this app's requests" is a real, standing risk this
project flagged from its very first build. Made the failure mode itself
better rather than only waiting it out:

- `lib/dghs.ts`: network-level fetch failures (Node's `fetch` throws the bare
  string `"fetch failed"` for a reset/refused/timed-out connection, which is
  what the client saw verbatim) are now caught and rewritten into an
  actionable message that says this isn't about the chosen date and points
  at "Upload PDF" as the immediate workaround.
- One automatic retry on the listing fetch, for a genuinely transient single
  dropped connection (does not help a sustained block like the one observed,
  but costs nothing and helps ordinary flakiness).
- A 5-minute in-memory cache on the listing fetch, best-effort across
  serverless invocations, to cut down repeat hits to DGHS from normal
  "Fetch report" clicks — lower request volume is directly relevant if the
  cause here really is rate-limiting.

### Verified

| What | How | Result |
|---|---|---|
| Reachability from this sandbox | `curl` the listing URL directly | 200, ~0.1–0.2s, every time |
| Reachability from Vercel | `curl` the live `/api/report` endpoint, 3x with delays | 502 `{"error":"fetch failed"}`, ~10.8s, every time — consistent, not intermittent |
| Vercel function log | Inspected the request detail panel | Exactly one external call attempted (the listing GET), no second call to a PDF, confirming the failure is at the very first network hop |
| `npm run typecheck` / `npm run build` | — | Clean |

### Open item

If this doesn't clear on its own within a normal cooldown window, the next
step is confirming whether it's Vercel's `sin1` (Singapore) region
specifically being blocked (in which case switching the pinned region in
`vercel.json` is a one-line fix) or a broader "block known cloud/hosting
ASNs" WAF rule (in which case no Vercel region change would help, and the
fetch path would need to run somewhere with residential/non-cloud egress —
a materially bigger change). Not enough evidence yet to tell which.

## 2026-09-08 — v1.7.0, six download formats, corrected ঢাকা বিভাগ, signature everywhere

### Three client requests

1. Excel needed both scripts (Unicode and SutonnyMJ), plus PDF/Word/HTML —
   the menu only had one Excel variant and had dropped plain HTML entirely
   when it became a dropdown in v1.5.0.
2. The signature needed to actually appear in every downloaded format.
3. **ঢাকা বিভাগ = Dhaka Division + Dhaka North City + Dhaka South City,
   summed** — not Dhaka Division alone, which is what v1.4.0 shipped after
   guessing from the client's first reference image before the follow-up
   images and this explicit instruction arrived.

### What changed

- **ঢাকা বিভাগ row.** `buildOfficialReportModel()` now sums all three Dhaka
  entries into the row shown for serial ২, via the existing `sumRows()`
  helper. This has a pleasant side effect: since v1.5.0 already made
  সর্বমোট use the real national totals, and Dhaka's three components are
  now fully accounted for in the eight visible rows, **সর্বমোট is now
  provably equal to the sum of the rows above it** for every column with
  real per-division data — verified arithmetically against the live report
  (657+84+169+334+112+56+137+9 = 1,558, matching the national 24h total
  exactly; same result cross-checked for deaths, cumulative admitted, and
  cumulative deaths). The "won't equal a sum" caveat from v1.5.0 no longer
  applies and the on-screen footnote was rewritten to say so.
- **Excel gained a script parameter.** `buildOfficialReportWorkbook(report,
  script)` now uses `pick()`/`FONT_FOR_SCRIPT` from `lib/bijoy.ts` throughout,
  same as the NMEP workbook. One real bug caught before it shipped: the
  signature's designation lines (উপপরিচালক, সিডিসি etc.) are Unicode Bangla
  in the dictionary *regardless* of script — pointing the SutonnyMJ font at
  that real Unicode text would have rendered mojibake, not just the wrong
  glyphs. Fixed by giving those three lines their own fixed Nirmala UI font,
  independent of the script toggle — the same pattern `lib/excel.ts` already
  used for the NMEP workbook's signature block, for the same reason.
- **HTML restored** as its own menu option (`downloadOfficialReport()` already
  existed from v1.4.0, just wasn't wired into the v1.5.0 dropdown).
- **Signature consistency.** Word can't fetch the `Caveat` Google Font its
  `<link>` points at — Word's HTML importer doesn't load external
  stylesheets — so `officialReportToWordHtml()` overrides the signature to
  `"Segoe Script"` (ships with Windows/Office). Excel already used Segoe
  Script. HTML, Image and PDF keep `Caveat`, which they can and do load.
  Every format now shows a cursive signature; none silently fall back to
  the body's plain sans-serif.
- **Image padding.** `downloadOfficialReportImage()` draws the html2canvas
  capture onto a larger white canvas (80px margin on all four sides at the
  capture's 2x scale) instead of shipping the tight-cropped element — a
  card that reads fine on a page looked cramped as a standalone image file.

### Verified

| What | How | Result |
|---|---|---|
| ঢাকা বিভাগ combination | Fetched the live 06/09/2026 report | Row shows ৬৫৭/৪/১৬৯৬৯/৬২ — matches 316+193+148, 1+0+3, 6333+5088+5548, 4+16+42 exactly |
| সর্বমোট now sums the rows | Same report | ১৫৫৮/৪/৪২৫৯০/১১৭ — both the real national total *and* the sum of all eight rows |
| Excel (SutonnyMJ) | Downloaded via the real menu, intercepted the blob | Valid `.xlsx`, 8,456 bytes, filename tagged `(SutonnyMJ)` |
| Excel (Unicode) | Same | Valid `.xlsx`, 8,446 bytes, filename tagged `(Unicode)` |
| Word | Same | Valid `.doc`, contains `Segoe Script`, no `fonts.googleapis` reference |
| HTML | Same | Valid, contains the signature and the `Caveat` font link |
| Image padding | Downloaded, loaded the blob into an `<img>`, screenshotted | Visible white margin on all sides; table and signature otherwise unchanged |
| `npm run typecheck` / `npm run build` | — | Clean |

## 2026-09-08 — v1.6.0, Advanced Analysis tab

### What was asked

"a tab/button/option for advance calculation where it will show a detailed
visualization report with the data visible in the graphs, charts, maps, and
other visualization tools."

### What was built

A single day's press release can't show a trend — there's nothing to trend
against. So `components/AdvancedAnalysis.tsx` reads the *same* local
history the Dashboard already keeps (`lib/history.ts`, every date fetched or
uploaded in this browser) and builds from however many dates are actually
saved:

- `TrendCharts.tsx` — three `recharts` charts across every saved date:
  admissions in the last 24 hours (area), deaths in the last 24 hours
  (line), cumulative admissions since 01 January (area). All degrade
  gracefully to a single point with an explanatory banner rather than
  breaking when only one date is saved.
- `DivisionShare.tsx` — a donut chart of the most recent date's admissions,
  split by reporting unit.
- `DivisionMap.tsx` — **not** a real geographic map: there's no boundary
  data in this app to draw one accurately, and a wrong border is worse than
  an honest diagram. It's a tile grid in the reporting units' rough relative
  position (north at the top, DNCC/DSCC stacked under Dhaka Division since
  they sit inside it), each tile shaded by a blue intensity scale for that
  unit's 24h admissions, labelled "schematic layout — not to scale" so
  nobody mistakes it for a survey.
- New third nav tab, "Advanced Analysis" (`app/analysis/page.tsx`), next to
  Report and Dashboard.

### Verified

| What | How | Result |
|---|---|---|
| Empty state | Cleared localStorage, loaded the tab | Clean "no data yet" card, no crash |
| Single-date state | Seeded exactly one history entry | Amber "only one date saved" banner; charts render a single point instead of erroring |
| Multi-date trend | Seeded five synthetic dates with a rising admissions curve | All three trend charts plotted the correct shape in date order; donut and map reflected the latest date only |
| `npm run typecheck` / `npm run build` | — | Clean; new `/analysis` route listed |

## 2026-09-08 — v1.5.0, four real download formats; fixed a totals mismatch

### Two client requests

1. "The report download options will be the Image, Pdf, Excel, and Word" —
   the single HTML-then-print-it-yourself download wasn't enough; each format
   needed to be a real, directly downloaded file.
2. The client noticed সর্বমোট (the totals row) didn't match the press
   release's own published national figures. It didn't, on purpose but
   wrongly: `rowTotals` was `sumRows()` of just the eight shown division rows,
   which excludes Dhaka North/South City Corporation by design (see v1.4.0)
   — so admitted/deaths/totalAdmitted/totalDeaths under-counted against
   DGHS's real totals, while discharged/currentlyAdmitted (already sourced
   from `report.totals`) did not. Fixed by making the whole totals row use
   `report.totals` — the real national figures — for every column. It will
   still not equal a sum of the eight rows above it, which is correct and
   now says so in the footnote, rather than silently being wrong.

### What was built

- **Image / PDF** — `lib/export-official-image.ts`, dynamically imports
  `html2canvas` (only on click, not in the initial bundle) to rasterise the
  actual on-screen `.official-report` element — whatever font really
  rendered, borders, peach fill, all of it — into a canvas. Image downloads
  that as a PNG. PDF wraps it in a single-page A4 `jsPDF` document. `jsPDF`
  was previously ruled out for this app (management brief) because it can't
  render Bangla *text* — that objection doesn't apply here, since it's only
  placing a picture, never drawing a glyph. Discovered along the way that
  passing jsPDF a PNG data URL stores it close to raw (7.4 MB for one page);
  switched to JPEG at 0.92 quality, invisible loss on a black-on-white/peach
  table, and the file dropped to ~227 KB.
- **Excel** — `lib/export-official-excel.ts` + `app/api/report/official-excel/route.ts`.
  A plain Unicode workbook (Nirmala UI, not SutonnyMJ — this is a new
  document, not required to byte-match the legacy circulated file) mirroring
  the on-screen eight rows, peach header fill, thin borders, comparison
  table, and the same corrected totals-row logic.
- **Word** — `officialReportToWordHtml()` in `lib/export-official-report.ts`,
  reusing the same row-rendering functions as the HTML/print export. Word
  opens HTML directly when it carries the `office:word` XML namespace and an
  `mso-application` marker — no OOXML library needed, downloaded as `.doc`.
- The single "Download Report" button became a small dropdown
  (Image / PDF / Excel / Word), each with its own busy state and error
  message, since image/PDF generation isn't instant.

### Verified

| What | How | Result |
|---|---|---|
| Totals fix | Fetched the live 06/09/2026 report, read সর্বমোট | ১৫৫৮ । ৪ । ৪২৫৯০ । ১১৭ — matches the press release's own headline figures (1,558 / 4 / 42,590 / 117) exactly |
| Image | Clicked through the real menu in a running dev server, rendered the downloaded PNG back into the page and screenshotted it | Peach headers, black borders, correct Bangla text and figures — pixel-identical to the live component |
| PDF | Intercepted the blob at `URL.createObjectURL` (jsPDF's `.save()` doesn't go through a `click()` call, so an anchor-click interceptor doesn't see it) | Valid `application/pdf`, 227 KB after the JPEG switch (was 7.4 MB with PNG) |
| Excel | Same interception approach | Valid `.xlsx`, correct MIME, 8.4 KB |
| Word | Same | Valid `.doc`, carries the `office:word` namespace, opens as HTML-for-Word |
| `npm run typecheck` | — | Clean |

## 2026-09-08 — v1.4.0, real working data source, official-report replica, print export

### The new source

The client pointed at a specific URL:
`https://dghs.gov.bd/pages/miscellaneous-infos?filters={"miscellaneous_info_type":"6a9cf0471fa8cd87d1f50227"}`
— DGHS's current site, filtered to the dengue-press-release category. Checked
it directly before writing any code against it (the previous "old.dghs.gov.bd
is dead" finding was itself the result of not doing this the first time):

- The listing is a small, server-rendered HTML table — no client-side
  rendering to fight. Each row already carries a direct link to that day's
  PDF in its own `files` column; no second "detail page" fetch is needed.
- The PDF itself is a **BI-dashboard export** (10 pages, English labels,
  numbers as chart data-labels), not the plain Bangla table the original
  `parseReportText` was built to read. Two quirks make it parseable anyway:
  each chart value is text-extracted as three back-to-back copies of itself
  with no separator (`137137137` = 137 — an SVG-text-layer artifact, not
  intentional obfuscation), and zero-value bars are dropped from the chart
  entirely rather than shown as zero, so a chart's value list and its label
  list are always the same length and in the same order as each other, just
  not always length 10.
- **Per-division discharge and "currently admitted" figures do not exist in
  this document at all** — only as national totals. Confirmed by reading the
  full extracted text, not by assumption. The client's own example of a
  richer hospital-level breakdown (govt/private split, per-institution rows)
  turned out to be an illustration of the desired shape, not a reachable
  source (it would be DHIS2, a different, authenticated system) — confirmed
  with the client directly before building anything against it.
- The client's reference image confirmed something the original build had
  flagged as an open question and left unresolved: the sheet genuinely uses
  **eight division rows, serial ২–৯**, with no Dhaka City Corporation row at
  all — not the ten-row structure this app had defaulted to building.

### What was built

- `lib/dghs.ts` — rewritten. `fetchListing()` regex-parses the listing table
  (title, publish date, PDF href) in one pass; `locateRelease(iso)` finds the
  row for a date. `old.dghs.gov.bd` and every URL-derivation helper built
  around it are gone.
- `lib/parse.ts` — added `parseBiPressRelease()`: `detriple()` decodes the
  repeated-digit chart labels; `chartValuesByArea()` matches a chart's values
  to whichever region names actually appear in it, by position, not by a
  fixed slot; national totals (admitted/deaths, 24h and cumulative,
  discharged) are read directly; "currently admitted" nationally is derived
  as `totalAdmitted − totalDeaths − discharged` — the same arithmetic the
  source's own per-hospital tables use, verified against a real sample
  (1,551 − 22 − 1,457 = 72, exactly). Per-division discharged/currentlyAdmitted
  are left `null`, not guessed.
- Both `/api/report` and `/api/report/upload` try the BI parser first and
  fall back to the legacy line-matcher for an old-format PDF that happens to
  reach either route.
- `components/OfficialReport.tsx` + `lib/export-official-report.ts` — the
  eight-row replica (peach `#fce4d6` header, `1px solid #000` borders,
  Kalpurush/SolaimanLipi-first font stack), reusing the *already-verified*
  `lib/bijoy.ts` dictionary and its `cumulativeHeader`/`comparisonHeading`/
  `periodLabel` helpers — the same ones the Excel writer uses — so the wording
  is guaranteed to match rather than being retyped and risking drift. The
  totals row sums the eight shown rows for admitted/deaths (real, since every
  row has real data there) but uses the true national figures for
  discharged/currentlyAdmitted (since summing eight `null`s would render as
  zero, which is false, not just imprecise). The 2025 comparison row is
  honestly `—` — there is no live source for a prior-year, same-window total,
  and hardcoding one fixed number would be correct today and silently wrong
  every other day. The signature is styled cursive text ("Anahar", the
  `Caveat` Google Font), not an image — the client's reference turned out to
  be exactly that, rendered text, once the actual image arrived.
- "Download Report" downloads a self-contained HTML file
  (`@page { size: A4 }`, `-webkit-print-color-adjust: exact`) rather than
  opening a new tab and calling `window.print()` — the latter was tried
  first and silently swallowed by popup blocking (observed even from a
  direct button click in an automated browser; not worth the risk for real
  users either). Matches the download-based pattern `lib/export-brief.ts`
  already established for the management brief.

### Verified

| What | How | Result |
|---|---|---|
| Listing scrape | `curl` the listing URL directly, regex-check row structure | Server-rendered HTML, one row for `০৬/০৯/২০২৬` with a direct `.pdf` link in its own cell |
| BI parser against the real, live PDF | Extracted text with `unpdf`, ran the parser's logic standalone against it | All 10 areas' admitted24h summed to the national total exactly (1,558); all 10 areas' cumulative admitted summed to 42,590 exactly; cumulative deaths summed to 117 exactly; the 2-area-only deaths-24h chart (zero-suppressed) summed to 4, matching the national annotation |
| Full fetch pipeline, live | `POST /api/report` against the real listing on a running dev server | 200, 10 rows, 95% confidence, correct national totals, honest notes about the two missing per-division fields |
| Official report, on-screen | Fetched the live report in a browser, inspected rendered text | Every cell matches: 8 rows serial ২–৯, totals row sums correctly, comparison table shows real 2026 cumulative figures and an honest `—` for 2025 |
| Official report, exported HTML | Captured the actual downloaded blob content via an intercepted anchor click, rendered it standalone | Identical to the on-screen version; peach headers and borders render correctly; `Caveat` signature font loads from its own `<link>` (the standalone file has no other font links, unlike the live app) |
| Excel export with the new null-per-row shape | `POST /api/excel` with a live-fetched report containing `discharged: null` rows | 200, valid `.xlsx` — the writer already handled `null` cells, no change needed |
| `npm run typecheck` / `npm run build` | — | Clean |

### Open question for the client

If a source ever surfaces for real per-division discharged and
currently-admitted figures (a DHIS2 export you have access to, a different
DGHS page), point `lib/parse.ts`'s `parseBiPressRelease` at it and those two
columns stop being `—`. Until then, this is a real gap in what DGHS publishes
per division, not a parsing shortfall.

## 2026-09-03 — v1.3.0, replace hand-entry with PDF upload

### What changed

The client wanted the DGHS-fetch fallback to be an actual PDF upload, not a
60-field number-entry form: "we will upload the files (PDF) then the app will
analyze the data." Replaced it:

- `app/api/report/upload/route.ts` — the same extraction pipeline as
  `/api/report` (`extractPdfText` → `parseReportText` → model fallback below
  60% confidence), except the PDF comes from a client upload
  (`multipart/form-data`, fields `date` and `file`) instead of a fetch. Same
  validity check (`%PDF-` magic bytes), same confidence scoring, same notes
  format — the client can't tell the two apart except by `sourceLabel`.
- `components/UploadPdfForm.tsx` replaces `components/ManualEntryForm.tsx`
  (deleted). Date picker, a click-to-choose PDF dropzone, "Analyse PDF". The
  Report tab's mode toggle is now "Fetch from DGHS" / "Upload PDF".
- `app/page.tsx`'s `runUpload` mirrors `runFetch`'s state handling
  (clears brief, sets `report`, saves to history on success) but posts
  `FormData` instead of JSON and skips the pipeline rail, since there's
  nothing to locate or download.
- Removed `extraction.method: 'manual'` from `lib/types.ts` — uploaded PDFs
  get real `pattern`/`model`/`mixed` methods from actual extraction, so the
  synthetic "manual, 100% confidence" tag from the old hand-entry form no
  longer has a caller. Cleaned up the one place that branched on it
  (`lib/export-brief.ts`'s brief footer now checks `report.sourceUrl` instead).
- `vercel.json` — added `maxDuration: 60` for the new route (matches
  `/api/report`, since the model fallback can take a while).

### Verified

| What | How | Result |
|---|---|---|
| Pattern extraction from an upload | Hand-built a minimal PDF (`%PDF-1.4`, one content stream, no external deps available in the sandbox) with all 10 region rows, a total row, and both comparison-table years, `curl`-posted to `/api/report/upload` | 200, all 10 regions matched, totals matched the sheet's own total row exactly (no mismatch note), both comparison years parsed, confidence 100% |
| Error paths | No file, non-PDF file, implausible date | Clean 400s: `Attach the PDF as "file".` / `That file does not look like a PDF.` / `Pick a date between 01 January 2023 and today.` |
| Full UI flow | Ran a clean dev server, uploaded the same test PDF through the real file input (Chrome automation, not a mocked fetch), clicked Analyse | Figure strip, division table, both charts all rendered with the correct numbers |
| Dashboard save | Checked the Dashboard tab after the upload | Entry saved with a `100% · pattern` badge (real extraction, not the old synthetic `manual` tag), correct totals, both Excel buttons |
| `npm run typecheck` / `npm run build` | — | Clean; new `/api/report/upload` route listed alongside the others |

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
