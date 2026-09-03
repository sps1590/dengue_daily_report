# dengue_daily_report

Turns the DGHS daily dengue press release into the workbook NMEP circulates, and drafts a management brief from it.

Pick a date. The app finds that day's press release on the DGHS portal, reads the division-wise table out of the Bangla PDF, rebuilds `Dengue Report, Daily -2026 (02-09-26) F.xlsx` with the same layout your office already uses, and — on request — writes a situation brief for management.

---

## What it does

| Step | What happens |
|---|---|
| 1 | The chosen date becomes the Bengali label DGHS uses (`০২/০৯/২০২৬`) and the ASCII filename stem (`20260902`) |
| 2 | The DGHS index page is checked to confirm the release exists |
| 3 | The PDF is downloaded and validated (a Joomla error page served with a 200 is caught here) |
| 4 | The division table and the year-comparison table are read out of the text layer |
| 5 | Figures, charts, the Excel export and the brief become available |

Two outputs:

- **Excel** — the government sheet, in either legacy SutonnyMJ or Unicode Bangla.
- **Management brief** — interpretation rather than restatement, in English or Bangla, exportable as a self-contained HTML file that prints cleanly to PDF.

A **Dashboard** tab keeps every report fetched in this browser (`lib/history.ts`,
localStorage, nothing server-side yet) and re-offers both downloads for each one
without re-fetching. Every download — Excel or brief — is rebuilt fresh from the
stored figures rather than replayed from a cached blob, so it opens as a real
working file: the workbook keeps its live `SUM` formulas, the brief is plain
HTML. Neither is a flattened, read-only snapshot.

**"Upload PDF"** on the Report tab is a fallback for when the DGHS fetch can't
be trusted — as of writing, `old.dghs.gov.bd` (the domain this app was built
against) is unreachable and DGHS's current site shows no active dengue
press-release series (see `docs/PROGRESS.md`, v1.2.0 and v1.3.0). Attach the
day's PDF from wherever it was actually obtained and it runs through the same
pattern-parser / model-fallback extraction as a live fetch, landing in the
same Excel/brief/Dashboard pipeline.

---

## The Excel export

This is the part that had to be exact, so it was built by measurement rather than by eye.

**Geometry** — column widths, row heights, all 18 merge ranges, font sizes, border weights and the print setup were read cell by cell out of the reference workbook and are reproduced in `lib/excel.ts`. The constants there are not round numbers because the source file's are not either (column C is `13.7109375`).

**Bangla encoding** — the reference workbook stores Bangla as ASCII bytes rendered through the SutonnyMJ font. Cell B2 literally holds:

```
MYcÖRvZš¿x evsjv‡`k miKvi
```

which only reads as `গণপ্রজাতন্ত্রী বাংলাদেশ সরকার` when SutonnyMJ is installed.

Rather than ship a general Unicode→Bijoy transliterator — which needs vowel reordering, reph placement and conjunct handling, and fails *silently* when it gets one wrong — `lib/bijoy.ts` holds a closed dictionary. Every string the sheet can emit is listed once, and each is tagged:

- `verbatim` — lifted byte-for-byte out of your reference workbook. Exact by construction. **All 30 of these were verified against the file and all 30 match.**
- `derived` — composed from the standard SutonnyMJ table. These are the only strings that could ever be wrong: ten month names, and the two Dhaka city-corporation row labels.

If a label is missing from the dictionary the writer falls back to Unicode rather than emitting mojibake.

**Two output scripts:**

| | Reads correctly | Matches the circulated file |
|---|---|---|
| `legacy` (SutonnyMJ) | only with the font installed | byte for byte |
| `unicode` (Nirmala UI) | everywhere | same layout, Unicode text |

**Totals are live formulas** (`=SUM(D11:D20)`), not baked values, so the sheet still recalculates if someone edits a row. Verified: 6 formulas, 0 errors.

---

## Setup

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY
npm run dev
```

The app works without an API key — fetching, parsing and Excel export all run locally. The key is needed for two things: the management brief, and the model fallback when the pattern parser cannot read a PDF.

### Deploying to Vercel

```bash
npm i -g vercel
vercel link
vercel env add ANTHROPIC_API_KEY production
vercel --prod
```

`vercel.json` pins the region to `sin1` (Singapore), the nearest edge to Dhaka, and raises the timeout on `/api/report` and `/api/analyze` to 60s. Both routes run on the Node runtime — `exceljs` and `unpdf` will not run on the Edge runtime.

---

## How extraction works

The DGHS PDF comes from a Word template that has been broadly stable since 2023, but its **text layer is not**. Depending on the machine that generated it, Bangla comes out as Unicode, as legacy SutonnyMJ bytes, or — on scanned days — not at all.

So there are two paths:

**Pattern parser** (`lib/parse.ts`) — matches each region against several observed spellings (Unicode Bangla, legacy bytes, English), normalises Bengali numerals to ASCII, and takes the trailing six integers on the row. It reports a confidence score driven by how much of the table it actually recognised, and cross-checks the region rows against the sheet's own grand-total row.

**Model fallback** (`lib/ai.ts`) — when confidence drops below 60%, or the PDF has almost no text layer, the PDF file itself is sent to Claude for structured extraction. Because the file is attached rather than the extracted text, this path also covers scanned releases.

The UI shows which path was used, the confidence, and a full extraction log. Below 60% it shows a **verify before circulating** banner. The figures never leave the screen claiming more certainty than they have.

### Known limitation

**The parser has not been run against a live PDF.** DGHS blocks automated fetches of the `/images/docs/vpr/` path (`robots.txt`), so it could not be tested from the development sandbox. Your own server and Vercel will very likely not hit this, but treat the first few runs as validation. If a date parses badly, open the extraction log — the raw text is kept on the response for exactly this reason.

---

## One thing to confirm

Your reference workbook has **eight division rows numbered 2–9**. Serial 1 is missing, which suggests a Dhaka City row was deleted at some point.

The underlying press release reports Dhaka North City Corporation and Dhaka South City Corporation as separate rows, so this app builds the full ten-row structure numbered from 1. If your circulated sheet genuinely uses eight rows starting at 2, edit `REGION_ORDER` in `lib/types.ts` — it is one line, and everything downstream follows from it.

---

## Layout

```
app/
  page.tsx              Report tab: orchestration and state
  dashboard/page.tsx    Dashboard tab
  layout.tsx            fonts, metadata
  api/report/route.ts        locate → download → extract → assemble
  api/report/upload/route.ts same extraction, from an uploaded PDF
  api/excel/route.ts         workbook generation
  api/analyze/route.ts       management brief
components/
  Masthead.tsx          the reproduced government header, plus tab nav
  DateControl.tsx       date picker and fetch action
  Pipeline.tsx          five-step progress rail
  FigureStrip.tsx       headline figures
  SheetTable.tsx        division table, English/Bangla toggle
  BurdenChart.tsx       Dhaka split and division ranking
  BriefPanel.tsx        management brief and analyse action
  Dashboard.tsx         saved-report list with re-download actions
  UploadPdfForm.tsx     upload-and-analyse fallback when the DGHS fetch can't be trusted
  Footer.tsx            shared data-caveat footer
lib/
  bengali.ts            numerals, dates, Dhaka timezone
  bijoy.ts              SutonnyMJ dictionary  ← verified against the reference file
  dghs.ts               URL derivation, index check, download
  pdf.ts                text extraction (unpdf)
  parse.ts              pattern parser and confidence scoring
  ai.ts                 model extraction and brief generation
  excel.ts              workbook writer  ← geometry from the reference file
  export-brief.ts       self-contained HTML brief
  download.ts           shared Excel-download call, used by Report and Dashboard
  history.ts            localStorage-backed report history for the Dashboard
  types.ts              domain types, region order
```

---

## Departures from the original Gemini specification

| Spec said | Built instead | Why |
|---|---|---|
| Supabase Edge Function | Next.js API route | One framework for a Vercel deploy. No second service to provision, no CORS hop. |
| Scrape the index for the PDF URL | Derive the URL, use the index to confirm | The URL is fully deterministic: `/vpr/YYYYMMDD_dengue_all.pdf`. Deriving it removes the scrape from the critical path; the index check still proves the release exists. |
| `jspdf` for the summary export | Self-contained HTML with print CSS | `jspdf` has no Bangla font embedded, so a Bangla brief would export as empty boxes. HTML prints to PDF from any browser with the fonts already resolved. |
| OpenAI or Gemini | Anthropic | Native PDF input, which is what makes the scanned-release fallback work at all. Swappable in `lib/ai.ts`. |
| Summary cards, bar chart | Kept, plus the division ranking and the reconstructed sheet | The Dhaka split answers "city or national"; the ranking answers "where do we send people". |

---

## What these numbers are not

The daily press release reports **hospitalised cases notified to the DGHS Health Emergency Operation Centre and control room**. It is not population incidence. It carries no serotype, age, sex or upazila detail, and discharges lag admissions. The brief is instructed to say so, and the footer says so on every screen.

Always check against the source PDF before figures leave this tool. The link is one click from the export panel.

---

Progress log: [`docs/PROGRESS.md`](docs/PROGRESS.md)
