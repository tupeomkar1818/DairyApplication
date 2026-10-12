import { reportFileName, reportToCsv, reportToHtml } from '@/src/domain/reports/export';
import type { ReportDocument } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/**
 * Web: the CSV downloads as a file; the PDF opens the report in a print window, where "Save as PDF" is one of the
 * printers (browsers cannot write a PDF file without a library).
 */

function download(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printHtml(html: string): void {
  // A hidden frame keeps pop-up blockers out of the way and leaves the app's own page untouched.
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  // Safari returns from print() while its dialog is still open, so the frame goes on `afterprint` (or after a minute).
  const fallback = setTimeout(() => frame.remove(), 60_000);
  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    throw new Error(strings('reports').share.printNotAvailable);
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener(
    'afterprint',
    () => {
      clearTimeout(fallback);
      cleanup();
    },
    { once: true },
  );
  // Let the frame lay out before printing, or the first page can come out blank.
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}

export async function shareReportPdf(doc: ReportDocument): Promise<void> {
  printHtml(reportToHtml(doc));
}

export async function shareReportCsv(doc: ReportDocument): Promise<void> {
  download(reportToCsv(doc), reportFileName(doc, 'csv'), 'text/csv;charset=utf-8');
}

export async function printReport(doc: ReportDocument): Promise<void> {
  printHtml(reportToHtml(doc));
}
