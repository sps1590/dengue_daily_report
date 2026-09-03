"""Assert every 'verbatim' Bijoy string in lib/bijoy.ts matches the reference workbook.

Run this whenever lib/bijoy.ts is edited, or when a new reference workbook
arrives from the office:

    pip install openpyxl
    python scripts/verify-bijoy.py path/to/reference.xlsx

Exits non-zero on any mismatch, so it drops straight into CI.
"""
import re, sys, openpyxl

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TS = open(os.path.join(ROOT, 'lib', 'bijoy.ts'), encoding='utf-8').read()
REF = sys.argv[1] if len(sys.argv) > 1 else 'reference.xlsx'
wb = openpyxl.load_workbook(REF)
ws = wb['Sheet1']

# key in TS  ->  cell in the reference workbook
EXPECT = {
    'govt': 'B2', 'dghs': 'B3', 'branch': 'B4', 'address': 'B5', 'title': 'B7',
    'serial': 'B9', 'divisionName': 'C9', 'last24h': 'D9', 'currentlyAdmitted': 'I9',
    'admitted': 'D10', 'deaths': 'E10', 'totalAdmitted': 'F10', 'totalDeaths': 'G10',
    'discharged': 'H10', 'grandTotal': 'C19',
    'serialFlat': 'B24', 'year': 'C24', 'caseCount': 'F24', 'deathCount': 'H24',
    'remarks': 'I24', 'sourceNote': 'B28',
}
REGION_EXPECT = {
    'DHAKA_DIVISION': 'C11', 'MYMENSINGH': 'C12', 'CHATTOGRAM': 'C13', 'KHULNA': 'C14',
    'RAJSHAHI': 'C15', 'RANGPUR': 'C16', 'BARISHAL': 'C17', 'SYLHET': 'C18',
}

def extract(key):
    """Pull the bijoy: '...' value for a given dictionary key out of the TS source."""
    m = re.search(re.escape(key) + r":\s*\{[^}]*?bijoy:\s*'((?:[^'\\]|\\.)*)'", TS, re.S)
    return m.group(1).replace('\\n', '\n') if m else None

fails = 0
for key, cell in {**EXPECT, **REGION_EXPECT}.items():
    got, want = extract(key), ws[cell].value
    if got != want:
        fails += 1
        print(f'MISMATCH {key} ({cell})\n   ts   = {got!r}\n   xlsx = {want!r}')
    else:
        print(f'ok  {key:20s} {cell:4s} {want!r}')

# Month strings that do appear in the workbook, inside the period label of C25.
c25 = ws['C25'].value
for name, frag in (('জানুয়ারি', 'Rvbyqvwi'), ('সেপ্টেম্বর', '‡m‡Þ¤^i')):
    if frag not in c25:
        fails += 1
        print(f'MISMATCH month {name}: {frag!r} not found in C25 {c25!r}')
    else:
        print(f'ok  month {name} present in C25')

print(f'\n{"FAILED: " + str(fails) + " mismatch(es)" if fails else "PASS: all verbatim strings match the reference workbook"}')
sys.exit(1 if fails else 0)
