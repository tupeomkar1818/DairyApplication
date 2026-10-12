import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { reportFileName, reportToCsv, reportToHtml } from '@/src/domain/reports/export';
import type { ReportDocument } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/**
 * Sharing a report from a phone: the PDF is printed from the report's HTML, the CSV written as a UTF-8 file, and both
 * handed to the system share sheet (WhatsApp, email, Files, Drive …). `reportShare.web.ts` downloads instead.
 */

/** A4 in PostScript points. */
const A4 = { width: 595, height: 842 };

async function share(file: File, mimeType: string, uti: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(strings('reports').share.notAvailable);
  }
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: title });
}

export async function shareReportPdf(doc: ReportDocument): Promise<void> {
  const printed = await Print.printToFileAsync({ html: reportToHtml(doc), ...A4 });
  // Printing names the file with a random id; a readable name is what the person sees in WhatsApp or mail.
  const target = new File(Paths.cache, reportFileName(doc, 'pdf'));
  const source = new File(printed.uri);
  try {
    await source.move(target, { overwrite: true });
  } catch {
    // Some Android versions refuse to move out of the print folder; share the printed file as it is.
    await share(source, 'application/pdf', 'com.adobe.pdf', doc.title);
    return;
  }
  await share(target, 'application/pdf', 'com.adobe.pdf', doc.title);
}

export async function shareReportCsv(doc: ReportDocument): Promise<void> {
  const file = new File(Paths.cache, reportFileName(doc, 'csv'));
  if (file.exists) file.delete();
  file.create();
  file.write(reportToCsv(doc));
  await share(file, 'text/csv', 'public.comma-separated-values-text', doc.title);
}

/** Opens the system print dialog (AirPrint / Android printing) for the report. */
export async function printReport(doc: ReportDocument): Promise<void> {
  await Print.printAsync({ html: reportToHtml(doc), ...A4 });
}
