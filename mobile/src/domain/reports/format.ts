import type { ReportCell, ReportValueKind } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/**
 * One wording for report values on screen, in the PDF and in the CSV: "₹1,24,500", "92%", "05 Sep 2026".
 * The CSV keeps plain numbers (no ₹ or grouping) so a spreadsheet can add them up. Month names follow the app language.
 */

/** Indian digit grouping: 1,23,456. */
function groupIndian(digits: string): string {
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return rest ? `${rest},${last3}` : last3;
}

export function formatReportMoney(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `${n < 0 ? '-' : ''}₹${groupIndian(String(Math.abs(n)))}`;
}

export function formatReportNumber(value: number): string {
  const n = Number(value) || 0;
  if (Number.isInteger(n)) return `${n < 0 ? '-' : ''}${groupIndian(String(Math.abs(n)))}`;
  // Digits stay 0-9 in both languages, so the Indian English grouping is right for Marathi too.
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** "05 Sep 2026" for yyyy-mm-dd; "Sep 2026" for yyyy-mm; anything else unchanged. */
export function formatReportDate(value: string): string {
  const monthsShort = strings('common').dates.monthsShort;
  const d = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[3]} ${monthsShort[Number(d[2]) - 1] ?? d[2]} ${d[1]}`;
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})$/);
  if (m) return `${monthsShort[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
  return String(value ?? '');
}

export function formatReportValue(value: ReportCell | undefined, kind: ReportValueKind): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return kind === 'date' ? formatReportDate(value) : value;
  switch (kind) {
    case 'money':
      return formatReportMoney(value);
    case 'percent':
      return `${Math.round(value)}%`;
    case 'number':
    case 'quantity':
      return formatReportNumber(value);
    default:
      return String(value);
  }
}

/** CSV keeps numbers plain; dates stay yyyy-mm-dd so spreadsheets sort them. */
export function csvValue(value: ReportCell | undefined, kind: ReportValueKind): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (kind === 'money') return String(Math.round(value));
    if (kind === 'percent') return String(Math.round(value));
    return String(Math.round(value * 100) / 100);
  }
  return value;
}

/** Share of a whole as a whole percent (0 when the whole is 0). */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/** "12.5 L", "750 ml", "2.4 kg", "3 items" — how much a quantity of base units is. */
export function formatQuantity(amount: number, family: 'volume' | 'weight' | 'count'): string {
  const n = Number(amount) || 0;
  if (family === 'volume') return n >= 1000 ? `${formatReportNumber(Math.round(n / 10) / 100)} L` : `${Math.round(n)} ml`;
  if (family === 'weight') return n >= 1000 ? `${formatReportNumber(Math.round(n / 10) / 100)} kg` : `${Math.round(n)} g`;
  return strings('reports').quantity.items(formatReportNumber(Math.round(n)), Math.round(n));
}

/** A stored status word ("Paid", "In Progress", "Present" …) in the app language; unknown words show as stored. */
export function reportStatusLabel(value: string): string {
  return strings('reports').values.statuses[value] ?? value;
}

/** A stored payment mode ("Cash", "UPI" …) in the app language; unknown modes show as stored. */
export function paymentModeLabel(value: string): string {
  return strings('reports').values.paymentModes[value] ?? value;
}
