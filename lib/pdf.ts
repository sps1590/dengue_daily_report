import { extractText, getDocumentProxy } from 'unpdf';

export interface PdfText {
  text: string;
  pages: number;
  /** True when the text layer is too thin to parse — usually a scanned page. */
  looksScanned: boolean;
}

/**
 * `unpdf` is a serverless build of pdf.js, so it runs inside a Vercel function
 * without a native dependency or a bundled test fixture (the classic
 * `pdf-parse` failure mode).
 */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfText> {
  const doc = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(doc, { mergePages: true });
  const merged = Array.isArray(text) ? text.join('\n') : text;
  const meaningful = merged.replace(/\s/g, '').length;
  return {
    text: merged,
    pages: totalPages,
    looksScanned: meaningful < 200,
  };
}
