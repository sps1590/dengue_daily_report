import { buildOfficialReportWorkbook } from '@/lib/export-official-excel';
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
  const script = body.script === 'legacy' ? 'legacy' : 'unicode';

  try {
    const bytes = await buildOfficialReportWorkbook(report, script);
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const suffix = script === 'legacy' ? 'SutonnyMJ' : 'Unicode';
    const filename = `Dengue official report ${report.date} (${suffix}).xlsx`;
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
