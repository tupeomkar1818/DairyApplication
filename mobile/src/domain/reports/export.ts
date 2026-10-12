import { formatRange, ymdOfDate } from '@/src/domain/reports/dateRange';
import { csvValue, formatReportDate, formatReportValue } from '@/src/domain/reports/format';
import type { ReportDocument, ReportTone } from '@/src/domain/reports/model';
import { getLanguage } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';

/**
 * A report as a CSV file and as a printable HTML page (which the phone turns into a PDF). Both come from the same
 * `ReportDocument` the screen shows, so the shared file never differs from what was on screen.
 */

/** The dairy's name on every exported report, in the app language. */
export function reportBrand(): string {
  return strings('common').appName;
}

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvLine(cells: string[]): string {
  return cells.map(csvEscape).join(',');
}

/** Summary block, then each table under its title, separated by blank lines. */
export function reportToCsv(doc: ReportDocument): string {
  const common = strings('common');
  const t = strings('reports');
  const lines: string[] = [];
  lines.push(csvLine([`${reportBrand()} — ${doc.title}`]));
  if (doc.subject) lines.push(csvLine([doc.subject]));
  lines.push(csvLine([common.dates.from, doc.range.fromYmd, common.dates.to, doc.range.toYmd]));
  lines.push('');

  if (doc.stats.length) {
    lines.push(csvLine([t.exports.summary]));
    for (const s of doc.stats) lines.push(csvLine([s.label, csvValue(s.value, s.kind)]));
    lines.push('');
  }

  for (const table of doc.tables) {
    lines.push(csvLine([table.title]));
    lines.push(csvLine(table.columns.map((c) => c.label)));
    for (const row of table.rows) lines.push(csvLine(table.columns.map((c) => csvValue(row[c.key], c.kind))));
    if (table.totals) {
      lines.push(csvLine(table.columns.map((c, i) => (i === 0 && table.totals![c.key] == null ? common.fields.total : csvValue(table.totals![c.key], c.kind)))));
    }
    lines.push('');
  }

  // Excel opens a UTF-8 CSV correctly (₹, Marathi text) only with the byte-order mark.
  return `﻿${lines.join('\r\n')}`;
}

function html(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TONE_COLOR: Record<ReportTone, string> = {
  default: '#1a2b4b',
  good: '#15803d',
  bad: '#b91c1c',
  warn: '#b45309',
};

function isNumericKind(kind: string): boolean {
  return kind === 'money' || kind === 'number' || kind === 'percent' || kind === 'quantity';
}

/**
 * A self-contained A4 page: no external fonts or images, so it prints the same offline. The font list names
 * Devanagari faces the phone or computer already has, so Marathi prints instead of empty boxes.
 */
export function reportToHtml(doc: ReportDocument): string {
  const lang = getLanguage();
  const totalWord = strings('common').fields.total;
  const brand = reportBrand();
  const generated = new Date(doc.generatedAtIso);
  const generatedText = Number.isNaN(generated.getTime()) ? '' : formatReportDate(ymdOfDate(generated));

  const stats = doc.stats
    .map(
      (s) => `<div class="stat"><div class="stat-label">${html(s.label)}</div>` +
        `<div class="stat-value" style="color:${TONE_COLOR[s.tone ?? 'default']}">${html(formatReportValue(s.value, s.kind))}</div>` +
        (s.hint ? `<div class="stat-hint">${html(s.hint)}</div>` : '') +
        '</div>',
    )
    .join('');

  const tables = doc.tables
    .map((t) => {
      const head = t.columns.map((c) => `<th class="${isNumericKind(c.kind) ? 'num' : ''}">${html(c.label)}</th>`).join('');
      const body = t.rows.length
        ? t.rows
            .map(
              (r) =>
                `<tr>${t.columns
                  .map((c) => `<td class="${isNumericKind(c.kind) ? 'num' : ''}">${html(formatReportValue(r[c.key], c.kind))}</td>`)
                  .join('')}</tr>`,
            )
            .join('')
        : `<tr><td colspan="${t.columns.length}" class="empty">${html(t.emptyText)}</td></tr>`;
      const totals = t.totals && t.rows.length
        ? `<tr class="totals">${t.columns
            .map((c, i) => {
              const v = t.totals![c.key];
              const text = i === 0 && (v === null || v === undefined) ? totalWord : v === null || v === undefined ? '' : formatReportValue(v, c.kind);
              return `<td class="${isNumericKind(c.kind) ? 'num' : ''}">${html(text)}</td>`;
            })
            .join('')}</tr>`
        : '';
      return `<section><h2>${html(t.title)}</h2>${t.note ? `<p class="note">${html(t.note)}</p>` : ''}` +
        `<table><thead><tr>${head}</tr></thead><tbody>${body}${totals}</tbody></table></section>`;
    })
    .join('');

  const notes = doc.notes?.length
    ? `<section class="notes">${doc.notes.map((n) => `<p>${html(n)}</p>`).join('')}</section>`
    : '';

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${html(`${doc.title} — ${formatRange(doc.range)}`)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, 'Noto Sans Devanagari', 'Mukta', 'Nirmala UI', 'Kohinoor Devanagari', 'Devanagari Sangam MN', Arial, sans-serif; color: #1a2b4b; font-size: 11px; margin: 0; }
  header { border-bottom: 2px solid #3551a1; padding-bottom: 8px; margin-bottom: 12px; }
  .brand { color: #3551a1; font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
  h1 { font-size: 20px; margin: 2px 0; }
  .meta { color: #5b6b82; font-size: 11px; }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .stat { border: 1px solid #dfe5f0; border-radius: 8px; padding: 8px 10px; min-width: 120px; flex: 1 1 120px; }
  .stat-label { color: #5b6b82; font-size: 10px; }
  .stat-value { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .stat-hint { color: #7a8699; font-size: 9px; margin-top: 2px; }
  section { margin-bottom: 14px; page-break-inside: auto; }
  h2 { font-size: 13px; margin: 0 0 4px; color: #3551a1; }
  .note { color: #5b6b82; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; background: #eef2fb; color: #3551a1; font-weight: 700; padding: 5px 6px; border-bottom: 1px solid #cfd8ea; }
  td { padding: 4px 6px; border-bottom: 1px solid #eef1f6; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; }
  .totals td { font-weight: 700; border-top: 1px solid #cfd8ea; background: #f7f9fd; }
  .empty { color: #7a8699; text-align: center; padding: 10px; }
  .notes p { color: #5b6b82; margin: 2px 0; font-size: 10px; }
  footer { color: #7a8699; font-size: 9px; margin-top: 10px; }
</style></head><body>
<header><div class="brand">${html(brand)}</div><h1>${html(doc.title)}</h1>
<div class="meta">${doc.subject ? `${html(doc.subject)} · ` : ''}${html(formatRange(doc.range))}${generatedText ? ` · ${html(strings('reports').exports.generated(generatedText))}` : ''}</div></header>
${stats ? `<div class="stats">${stats}</div>` : ''}
${tables}
${notes}
<footer>${html(brand)} · ${html(doc.title)}</footer>
</body></html>`;
}

/**
 * "sales-summary-2026-09-01-to-2026-09-17" — safe on every phone's file system. Marathi letters are kept, so a
 * Marathi report gets a Marathi file name rather than a bare "report".
 */
export function reportFileName(doc: ReportDocument, extension: 'pdf' | 'csv'): string {
  const slug = `${doc.title}${doc.subject ? `-${doc.subject}` : ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'report';
  const period = doc.range.fromYmd === doc.range.toYmd ? doc.range.fromYmd : `${doc.range.fromYmd}-to-${doc.range.toYmd}`;
  return `${slug}-${period}.${extension}`;
}
