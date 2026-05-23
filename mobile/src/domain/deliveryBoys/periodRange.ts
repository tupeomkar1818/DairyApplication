/** Preset ranges for admin filters (contract-first; backend can mirror). */
export type PeriodPreset = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'custom';

export type IsoDateRange = { startIso: string; endIso: string };

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function isoDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Inclusive range [startIso, endIso] as yyyy-mm-dd */
export function resolvePeriodRange(preset: PeriodPreset, custom?: { startIso: string; endIso: string }, ref: Date = new Date()): IsoDateRange {
  const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let start = new Date(end);

  if (preset === 'custom' && custom?.startIso && custom?.endIso) {
    const a = custom.startIso.slice(0, 10);
    const b = custom.endIso.slice(0, 10);
    return a <= b ? { startIso: a, endIso: b } : { startIso: b, endIso: a };
  }

  if (preset === 'today') {
    start = new Date(end);
  } else if (preset === 'thisWeek') {
    const dow = end.getDay();
    start = new Date(end);
    start.setDate(end.getDate() - dow);
  } else if (preset === 'thisMonth') {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else if (preset === 'lastMonth') {
    const firstThis = new Date(end.getFullYear(), end.getMonth(), 1);
    const lastPrev = new Date(firstThis.getTime() - 86400000);
    const startLm = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
    return { startIso: isoDateOnly(startLm), endIso: isoDateOnly(lastPrev) };
  } else if (preset === 'last3Months') {
    start = new Date(end.getFullYear(), end.getMonth() - 2, 1);
  } else if (preset === 'last6Months') {
    start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  } else {
    start = new Date(end);
  }

  return { startIso: isoDateOnly(start), endIso: isoDateOnly(end) };
}

export function presetLabel(p: PeriodPreset): string {
  switch (p) {
    case 'today':
      return 'Today';
    case 'thisWeek':
      return 'This Week';
    case 'thisMonth':
      return 'This Month';
    case 'lastMonth':
      return 'Last Month';
    case 'last3Months':
      return 'Last 3 Months';
    case 'last6Months':
      return 'Last 6 Months';
    case 'custom':
      return 'Custom';
    default:
      return p;
  }
}
