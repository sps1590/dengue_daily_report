import { NextResponse } from 'next/server';
import { DeathListError, parseDeathList } from '@/lib/deaths';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * Reads an uploaded DGHS "Dengue Death list" PDF and returns only the
 * district-wise counts. The list itself carries patient names, mobile numbers
 * and addresses; none of that is returned, logged or stored (see
 * `lib/deaths.ts`).
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Send a multipart form with a "file".' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Attach the death list PDF as "file".' }, { status: 400 });
  }
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'That file does not look like a PDF.' }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
      return NextResponse.json({ error: 'That file is not a valid PDF.' }, { status: 400 });
    }
    return NextResponse.json(await parseDeathList(bytes));
  } catch (err) {
    if (err instanceof DeathListError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: 'The death list could not be read.' }, { status: 502 });
  }
}
