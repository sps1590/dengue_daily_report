# Scripts

Neither script is part of the build. Both exist to check assumptions that are
otherwise easy to break silently.

## verify-bijoy.py

Diffs every string in `lib/bijoy.ts` tagged `verbatim` against the workbook it
was copied from. Run it whenever that dictionary is edited, or when a new
reference file arrives from the office.

```bash
pip install openpyxl
python scripts/verify-bijoy.py "Dengue Report, Daily -2026 (02-09-26) F.xlsx"
```

Exits non-zero on any mismatch. All 30 strings matched at v1.0.0.

## test-excel.js

Builds both workbook variants from a synthetic ten-region report so the output
can be opened and compared against the circulated file without waiting for a
real press release.

```bash
npx tsc -p scripts/tsconfig.test.json
node scripts/test-excel.js
# writes /tmp/out-legacy.xlsx and /tmp/out-unicode.xlsx
```

The compiled output lands in `.testbuild/`, which is ignored.
