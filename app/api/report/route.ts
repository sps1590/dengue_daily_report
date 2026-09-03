import { NextResponse } from 'next/server';
import { isPlausibleReportDate } from '@/lib/bengali';
import { NotPublishedError, downloadPdf, locateRelease } from '@/lib/dghs';
import { extractPdfText } from '@/lib/pdf';
import { parseReportText, sumRows } from '@/lib/parse';
import { extractWithModel, hasModelAccess } from '@/lib/ai';
import type { DengueReport } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Below this, the pattern parser is not trusted and the model re-reads the PDF. */
const MODEL_FALLBACK_THRESHOLD = 0.6;

export async function POST(req: Request) {
  let body: { date?: string; allowModel?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with a "date" field.' }, { status: 400 });
  }

  const date = body.date ?? '';
  if (!isPlausibleReportDate(date)) {
    return NextResponse.json(
      { error: 'Pick a date between 01 January 2023 and today.' },
      { status: 400 },
    );
  }
  const allowModel = body.allowModel !== false && hasModelAccess();
  const year = Number(date.slice(0, 4));

  try {
    const located = await locateRelease(date);
    const pdf = await downloadPdf(located.url);
    const { text, pages, looksScanned } = await extractPdfText(pdf.bytes);

    const pattern = parseReportText(text, year);
    const notes = [located.note, ...pattern.notes];
    if (looksScanned) notes.push(`The PDF has almost no text layer (${pages} page(s)); it is probably a scan.`);

    let rows = pattern.rows;
    let comparison = pattern.comparison;
    let method: DengueReport['extraction']['method'] = 'pattern';
    let confidence = pattern.confidence;

    if ((confidence < MODEL_FALLBACK_THRESHOLD || looksScanned) && allowModel) {
      try {
        const model = await extractWithModel(pdf.bytes, text);
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
      sourceUrl: located.url,
      sourceLabel: located.label,
      rows,
      totals: pattern.totals ?? sumRows(rows),
      comparison,
      extraction: { method, confidence, notes: notes.filter(Boolean) },
      rawText: text.slice(0, 20_000),
    };

    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof NotPublishedError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not process this date.' },
      { status: 502 },
    );
  }
}
