import { ApiError } from '@/http';

/**
 * What a counter sale comes to.
 *
 * Kept apart from the route because it is the one piece of this area that is money: a mistake here is a customer
 * handed the wrong change, so it is worked out in one place, from the lines, and never read off the phone that
 * sent them.
 */

export type PricedLine = {
  productName?: string;
  packLabel?: string;
  quantity?: number;
  unitPrice?: number;
  productId?: string;
  packId?: string;
};

export type CountedLine = {
  lineNo: number;
  productId: string | null;
  packId: string | null;
  productName: string;
  packLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type SaleTotals = {
  lines: CountedLine[];
  itemsTotal: number;
  discount: number;
  total: number;
};

/** Whole rupees, never negative, never anything that is not a number. */
export function money(value: unknown, what: string): number {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n) || n < 0) throw ApiError.badRequest('SALE_AMOUNT_INVALID', `${what} is not an amount.`);
  return n;
}

/**
 * @throws ApiError SALE_EMPTY, SALE_AMOUNT_INVALID, SALE_DISCOUNT_TOO_BIG
 */
export function countSale(rawLines: PricedLine[], rawDiscount: unknown): SaleTotals {
  const kept = rawLines.filter((l) => String(l.productName ?? '').trim());
  if (!kept.length) throw ApiError.badRequest('SALE_EMPTY', 'There is nothing on this sale.');

  let itemsTotal = 0;
  const lines = kept.map((line, i) => {
    // Half a pack is not a thing anybody sells over a counter, so a quantity is a whole number of at least one.
    const quantity = Math.max(1, Math.round(Number(line.quantity ?? 1)) || 1);
    const unitPrice = money(line.unitPrice, 'A price');
    const lineTotal = quantity * unitPrice;
    itemsTotal += lineTotal;
    return {
      lineNo: i,
      productId: line.productId ?? null,
      packId: line.packId ?? null,
      productName: String(line.productName).trim(),
      packLabel: String(line.packLabel ?? '').trim(),
      quantity,
      unitPrice,
      lineTotal,
    };
  });

  const discount = money(rawDiscount, 'The discount');
  if (discount > itemsTotal) throw ApiError.badRequest('SALE_DISCOUNT_TOO_BIG', 'The discount is more than the sale.');

  return { lines, itemsTotal, discount, total: itemsTotal - discount };
}

/** Cash or UPI, and nothing else: those are the two things a counter takes. */
export function paymentWay(value: unknown): 'Cash' | 'UPI' {
  const paidBy = String(value ?? 'Cash');
  if (paidBy !== 'Cash' && paidBy !== 'UPI') throw ApiError.badRequest('SALE_PAYMENT_INVALID', 'A sale is paid by cash or UPI.');
  return paidBy;
}
