import { downloadFile } from './export-brief';

/**
 * html2canvas + jsPDF are dynamically imported here rather than at module
 * top level, so neither ships in the initial page bundle — only a click on
 * "Image" or "PDF" pulls them in. jsPDF is used purely to place a picture on
 * a page, never to render text, so the Bangla-glyph problem that ruled it
 * out for the management brief doesn't apply: html2canvas rasterises
 * whatever font the browser actually rendered on screen.
 */

async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
}

/** Visual breathing room around the report in the downloaded image, at the capture's 2x scale. */
const IMAGE_MARGIN_PX = 80;

export async function downloadOfficialReportImage(el: HTMLElement, filenameBase: string): Promise<void> {
  const captured = await captureElement(el);

  // html2canvas crops tight to the element's own box, which reads as cramped
  // once it's a standalone image rather than a card on a page — pad it out
  // on a larger white canvas instead of shrinking the capture itself.
  const padded = document.createElement('canvas');
  padded.width = captured.width + IMAGE_MARGIN_PX * 2;
  padded.height = captured.height + IMAGE_MARGIN_PX * 2;
  const ctx = padded.getContext('2d');
  if (!ctx) throw new Error('Could not render the image.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, padded.width, padded.height);
  ctx.drawImage(captured, IMAGE_MARGIN_PX, IMAGE_MARGIN_PX);

  const blob: Blob | null = await new Promise((resolve) => padded.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render the image.');
  downloadFile(`${filenameBase}.png`, blob, 'image/png');
}

export async function downloadOfficialReportPdf(el: HTMLElement, filenameBase: string): Promise<void> {
  const canvas = await captureElement(el);
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  // Fit the whole capture on one page, preserving aspect ratio, rather than
  // letting jsPDF's default addImage sizing cut it off partway down.
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  const x = (pageWidth - width) / 2;
  const y = margin;

  // jsPDF stores a PNG passed as a data URL close to raw (no real deflate
  // benefit for this size), which balloons a single page into several MB.
  // JPEG lets it store genuinely compressed data; at 0.92 quality the loss is
  // invisible on a black-text-on-white/peach table and the file drops by
  // roughly 20x.
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, width, height);
  pdf.save(`${filenameBase}.pdf`);
}
