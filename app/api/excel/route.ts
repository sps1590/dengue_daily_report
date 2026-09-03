import { buildWorkbook, workbookFilename } from '@/lib/excel';
import type { DengueReport } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: { report?: DengueReport; script?: 'legacy' | 'unicode' };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Send a JSON body containing the report.' }, { status: 400 });
  }

  const report = body.report;
  if (!report?.date || !Array.isArray(report.rows)) {
    return Response.json({ error: 'The request did not include a parsed report.' }, { status: 400 });
  }

  const script = body.script === 'unicode' ? 'unicode' : 'legacy';

  try {
    const bytes = await buildWorkbook(report, { script });
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const filename = workbookFilename(report.date);
    // The name is pure ASCII, so `filename=` takes it verbatim; `filename*` is
    // kept as the RFC 5987 form for clients that prefer it.
    return new Response(body, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Could not build the workbook.' },
      { status: 500 },
    );
  }
}
