import type { CounterSale } from '@/src/domain/counter/entities';
import { receiptBytes } from '@/src/domain/counter/receipt';
import { services } from '@/src/infrastructure/service-registry';
import { billPrinter } from '@/src/infrastructure/printing/billPrinter';

/**
 * Prints a bill, and never gets in the way of the sale.
 *
 * The money is taken and the sale is saved before this is called, so whatever happens to the paper, the dairy's
 * books are right. A printer that is off, out of paper or not yet paired is a thing to tell the desk about — not
 * a reason to lose a sale.
 */

export type PrintOutcome = { ok: true } | { ok: false; reason: 'no-printer' | 'failed' };

/** Read once and kept: the dairy's name and address change about as often as the dairy moves. */
let shopCache: { name: string; line1?: string; phone?: string } | null = null;

async function shop(): Promise<{ name: string; line1?: string; phone?: string }> {
  if (shopCache) return shopCache;
  // The bill carries what is on the dairy's own settings; anything missing simply does not print.
  shopCache = { name: 'Amrale Dairy', line1: 'Sangam Chowk, Kothrud, Pune', phone: '+91 99224 43636' };
  try {
    const settings = await services.adminDashboard?.getSettings?.();
    const payee = (settings as { payment?: { payeeName?: string } } | undefined)?.payment?.payeeName;
    if (payee) shopCache = { ...shopCache, name: payee };
  } catch {
    // The bundled details are good enough for a bill; this is not worth failing a print over.
  }
  return shopCache;
}

export async function printBill(sale: CounterSale): Promise<PrintOutcome> {
  if (!billPrinter.isSupported() || !billPrinter.connected()) return { ok: false, reason: 'no-printer' };
  try {
    await billPrinter.write(receiptBytes(sale, await shop()));
    // Only now is it worth telling the server the bill exists on paper.
    void services.counter?.markPrinted(sale.id).catch(() => undefined);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
