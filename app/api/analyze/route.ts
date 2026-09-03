import { NextResponse } from 'next/server';
import { generateBrief, hasModelAccess } from '@/lib/ai';
import type { DengueReport } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!hasModelAccess()) {
    return NextResponse.json(
      { error: 'Set ANTHROPIC_API_KEY in the environment to generate a brief.' },
      { status: 503 },
    );
  }

  let body: { report?: DengueReport; language?: 'en' | 'bn' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body containing the report.' }, { status: 400 });
  }

  const report = body.report;
  if (!report?.date) {
    return NextResponse.json({ error: 'Fetch a report before running the analysis.' }, { status: 400 });
  }
  if (!report.rows?.length) {
    return NextResponse.json(
      { error: 'No division rows were extracted, so there is nothing to analyse.' },
      { status: 422 },
    );
  }

  try {
    const brief = await generateBrief(report, body.language === 'bn' ? 'bn' : 'en');
    return NextResponse.json(brief);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'The analysis could not be completed.' },
      { status: 502 },
    );
  }
}
