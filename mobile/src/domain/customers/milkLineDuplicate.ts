import type { CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';

/** Normalized milk catalog product name only — used to detect “same milk” for close-and-replace. */
export function milkProductNameKey(p: CustomerSubscriptionPlanDto): string {
  return String(p.productName ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Full line signature (product + pack + qty + schedule + kind) for delivery attribution / overlap rules — not for duplicate dialog. */
export function milkLineDuplicateKey(p: CustomerSubscriptionPlanDto): string {
  const pack = String(p.quantityLabel ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const parts = [
    String(p.productName ?? '').trim().toLowerCase(),
    pack,
    String(Math.max(1, Math.floor(Number(p.numberOfItems ?? 1)))),
    String(p.frequency ?? ''),
    String(p.deliveryTime ?? ''),
    String(p.subscriptionKind ?? 'Monthly'),
    String(p.unitType ?? '').trim().toLowerCase(),
  ];
  return parts.join('\u{1F}');
}

/** Index of another milk row with the same catalog product name, or -1. Skips `editingIndex` when editing. */
export function findDuplicateMilkLineIndex(
  draft: CustomerSubscriptionPlanDto,
  milkRows: CustomerSubscriptionPlanDto[],
  editingIndex: number | null,
): number {
  const k = milkProductNameKey(draft);
  if (!k) return -1;
  for (let i = 0; i < milkRows.length; i++) {
    if (editingIndex !== null && i === editingIndex) continue;
    if (milkProductNameKey(milkRows[i]!) === k) return i;
  }
  return -1;
}
