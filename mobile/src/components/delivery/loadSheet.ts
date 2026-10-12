import type { TodayEntry } from '@/src/components/admin/dashboardMetrics';

/**
 * The load sheet: what the delivery boy has to carry for a day, summed across their stops.
 *
 * It counts packs, not stops — a customer on 3 packets needs 3 on the van — and one-off orders count too; they go
 * on the van like anything else.
 */

export type LoadSheetLine = {
  /** "Cow Milk · 500 ml" — the same product and pack wording the stop shows. */
  label: string;
  productName: string;
  packLabel: string;
  /** Packs to load for this line. */
  count: number;
  /** True when at least one of these is a one-off order rather than a subscription line. */
  hasAddOn: boolean;
};

function splitLabel(label: string): { productName: string; packLabel: string; count: number } {
  // "Cow Milk · 500 ml × 3" → product, pack, count
  const m = label.match(/^(.*?)\s*×\s*(\d+)\s*$/);
  const base = m ? m[1]! : label;
  const count = m ? Math.max(1, Number(m[2])) : 1;
  const [productName = base, packLabel = ''] = base.split(' · ');
  return { productName: productName.trim(), packLabel: packLabel.trim(), count };
}

/** Lines to load, product name first, then pack size. */
export function buildLoadSheet(entries: readonly TodayEntry[]): LoadSheetLine[] {
  const byKey = new Map<string, LoadSheetLine>();

  const add = (productName: string, packLabel: string, count: number, isAddOn: boolean) => {
    const name = productName.trim();
    if (!name || count <= 0) return;
    const pack = packLabel.trim();
    const label = [name, pack].filter(Boolean).join(' · ');
    const existing = byKey.get(label);
    if (existing) {
      existing.count += count;
      existing.hasAddOn = existing.hasAddOn || isAddOn;
      return;
    }
    byKey.set(label, { label, productName: name, packLabel: pack, count, hasAddOn: isAddOn });
  };

  for (const entry of entries) {
    if (entry.lines) {
      for (const line of entry.lines) add(line.productName, line.packLabel, line.count, line.addOn);
      continue;
    }
    // Entries built without pack counts: read them from the labels.
    for (const item of entry.planItems) {
      const { productName, packLabel, count } = splitLabel(item);
      add(productName, packLabel, count, false);
    }
    for (const item of entry.addOnItems) {
      const { productName, packLabel, count } = splitLabel(item);
      add(productName, packLabel, count, true);
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => a.productName.localeCompare(b.productName) || a.packLabel.localeCompare(b.packLabel),
  );
}

/** Total packs on the sheet, for the "items to carry" tile. */
export function loadSheetItemCount(lines: readonly LoadSheetLine[]): number {
  return lines.reduce((sum, l) => sum + l.count, 0);
}
