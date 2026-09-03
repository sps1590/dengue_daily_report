import { NextResponse } from 'next/server';
import { isPlausibleReportDate } from '@/lib/bengali';
import { extractPdfText } from '@/lib/pdf';
import { parseReportText, sumRows } from '@/lib/parse';
import { extractWithModel, hasModelAccess } from '@/lib/ai';
import type { DengueReport } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Below this, the pattern parser is not trusted and the model re-reads the PDF. */
const MODEL_FALLBACK_THRESHOLD = 0.6;

/**
 * Same extraction pipeline as `/api/report`, but the PDF comes from the
 * client instead of a DGHS fetch — for when the site the automated fetch
 * targets can't be reached, but someone can still get the press release
 * another way (their own browser, an email, a phone photo turned into a PDF)
 * and upload it here.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Send a multipart form with a "date" field and a "file".' }, { status: 400 });
  }

  const date = String(form.get('date') ?? '');
  if (!isPlausibleReportDate(date)) {
    return NextResponse.json({ error: 'Pick a date between 01 January 2023 and today.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Attach the PDF as "file".' }, { status: 400 });
  }
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'That file does not look like a PDF.' }, { status: 400 });
  }

  const allowModel = form.get('allowModel') !== 'false' && hasModelAccess();
  const year = Number(date.slice(0, 4));

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const head = new TextDecoder().decode(bytes.slice(0, 5));
    if (head !== '%PDF-') {
      return NextResponse.json({ error: 'That file is not a valid PDF.' }, { status: 400 });
    }

    const { text, pages, looksScanned } = await extractPdfText(bytes);

    const pattern = parseReportText(text, year);
    const notes = ['Uploaded manually; not fetched from DGHS.', ...pattern.notes];
    if (looksScanned) notes.push(`The PDF has almost no text layer (${pages} page(s)); it is probably a scan.`);

    let rows = pattern.rows;
    let comparison = pattern.comparison;
    let method: DengueReport['extraction']['method'] = 'pattern';
    let confidence = pattern.confidence;

    if ((confidence < MODEL_FALLBACK_THRESHOLD || looksScanned) && allowModel) {
      try {
        const model = await extractWithModel(bytes, text);
        if (model.rows.length > rows.length) {
          method = rows.length ? 'mixed' : 'model';
          rows = model.rows;
          comparison = model.comparison.length ? model.comparison : comparison;
          confidence = Math.min(0.95, 0.55 + model.rows.length * 0.04);
          notes.push('The pattern parser fell short, so the PDF was re-read by the model.');
          notes.push(...model.notes);
        }
      } catch (e) {
        notes.push(`Model fallback failed: ${e instanceof Error ? e.message : 'unknown error'}.`);
      }
    } else if (confidence < MODEL_FALLBACK_THRESHOLD && !allowModel) {
      notes.push('Confidence is low and no model key is configured. Check the figures against the source PDF.');
    }

    const report: DengueReport = {
      date,
      sourceUrl: '',
      sourceLabel: `Uploaded PDF (${file.name})`,
      rows,
      totals: pattern.totals ?? sumRows(rows),
      comparison,
      extraction: { method, confidence, notes: notes.filter(Boolean) },
      rawText: text.slice(0, 20_000),
    };

    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not process this file.' },
      { status: 502 },
    );
  }
}
