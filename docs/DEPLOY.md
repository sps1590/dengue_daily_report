# Deploying to Vercel

## 1. Push to GitHub

The repository is already initialised with a commit history. Create an empty
repository named `dengue_daily_info` on GitHub, then:

```bash
git remote add origin https://github.com/<your-account>/dengue_daily_info.git
git branch -M main
git push -u origin main
```

Do not initialise the GitHub repository with a README or .gitignore — this one
already has both, and the push would be rejected as a non-fast-forward.

## 2. Import into Vercel

- New Project, pick `dengue_daily_info`.
- Framework preset: Next.js. Everything else can stay on defaults; `vercel.json`
  supplies the region and the function timeouts.

## 3. Environment variable

Settings → Environment Variables:

| Name | Value | Environments |
|---|---|---|
| `ANTHROPIC_API_KEY` | your key | Production, Preview, Development |
| `ANTHROPIC_MODEL` | optional override | as needed |

Redeploy after adding it — Vercel does not apply new variables to an existing build.

The app runs without the key. Fetching, parsing and Excel export are all local;
only the management brief and the model extraction fallback need it.

## 4. First run

Open the deployment, pick yesterday's date, fetch.

Then check three things:

1. **The extraction log.** Confidence should be high and every region should
   have matched. If regions are missing, the DGHS text layer differs from what
   `REGION_PATTERNS` in `lib/parse.ts` expects — add the spelling you see.
2. **The Excel download**, opened on a machine with SutonnyMJ installed. Compare
   it against the file your office circulates.
3. **The brief**, checked against the source PDF before it goes anywhere.

## Notes

- Region is pinned to `sin1` (Singapore), the nearest Vercel edge to Dhaka.
- `/api/report` and `/api/analyze` are given 60s; both make an outbound call to
  a government server that is not always quick.
- Both PDF routes run on the Node runtime. `exceljs` and `unpdf` will not run on
  the Edge runtime, and `serverExternalPackages` in `next.config.mjs` keeps them
  out of the bundler.
- If the DGHS portal blocks the Vercel egress IPs, the fallback is to run this
  on a machine inside the DGHS network, or to proxy the fetch. Everything else
  in the app is unaffected.
