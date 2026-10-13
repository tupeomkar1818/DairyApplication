import type { CounterSale } from '@/src/domain/counter/entities';

/**
 * The paper bill, as bytes a counter printer understands.
 *
 * Thermal printers at a counter speak ESC/POS: a stream of plain text with a few control codes for bold, centring
 * and cutting. Nothing here is a picture, which is why a bill prints in a second rather than ten.
 *
 * The width is the printer's, in characters — 32 for the common 58mm roll, 48 for an 80mm one. Everything is laid
 * out to that width, so a name that is too long is cut rather than wrapped into a mess.
 */

export type ReceiptShop = {
  name: string;
  line1?: string;
  line2?: string;
  phone?: string;
  /** Printed at the foot, e.g. "Thank you". */
  footer?: string;
};

export type ReceiptOptions = {
  /** Characters across the roll: 32 for 58mm, 48 for 80mm. */
  width?: number;
  /** Marathi cannot be printed by most counter printers (see `canPrintText`), so the bill is laid out in English. */
  moneyPrefix?: string;
};

const ESC = 0x1b;
const GS = 0x1d;

/** A line of text cut to the roll, never wrapped. */
function fit(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
}

/** Name on the left, amount hard against the right edge. */
export function twoColumns(left: string, right: string, width: number): string {
  const room = Math.max(0, width - right.length - 1);
  const name = fit(left, room);
  return `${name}${' '.repeat(Math.max(1, width - name.length - right.length))}${right}`;
}

export function centre(text: string, width: number): string {
  const line = fit(text, width);
  const pad = Math.max(0, Math.floor((width - line.length) / 2));
  return `${' '.repeat(pad)}${line}`;
}

/**
 * The bill as lines of text, without any printer codes.
 *
 * Kept apart from the bytes so it can be read in a test, shown on screen, or dropped into a PDF for a printer
 * that is not a counter printer at all.
 */
export function receiptLines(sale: CounterSale, shop: ReceiptShop, options: ReceiptOptions = {}): string[] {
  const width = options.width ?? 32;
  const rupee = options.moneyPrefix ?? 'Rs ';
  const amount = (n: number) => `${rupee}${n}`;
  const rule = '-'.repeat(width);

  const out: string[] = [centre(shop.name, width)];
  if (shop.line1) out.push(centre(shop.line1, width));
  if (shop.line2) out.push(centre(shop.line2, width));
  if (shop.phone) out.push(centre(shop.phone, width));
  out.push(rule);

  const when = sale.soldAt ? new Date(sale.soldAt) : new Date();
  // The dairy's own clock, not the phone's idea of UTC.
  const india = new Date(when.getTime() + (when.getTimezoneOffset() + 330) * 60_000);
  const two = (n: number) => String(n).padStart(2, '0');
  out.push(twoColumns(`Bill ${sale.saleNo}`, `${two(india.getDate())}/${two(india.getMonth() + 1)}`, width));
  out.push(twoColumns(sale.soldByName || '', `${two(india.getHours())}:${two(india.getMinutes())}`, width));
  if (sale.customerName) out.push(fit(sale.customerName, width));
  out.push(rule);

  for (const line of sale.lines) {
    const what = [line.productName, line.packLabel].filter(Boolean).join(' ');
    out.push(fit(what, width));
    out.push(twoColumns(`  ${line.quantity} x ${rupee}${line.unitPrice}`, amount(line.lineTotal), width));
  }

  out.push(rule);
  if (sale.discount > 0) {
    out.push(twoColumns('Items', amount(sale.itemsTotal), width));
    out.push(twoColumns('Discount', `- ${amount(sale.discount)}`, width));
  }
  out.push(twoColumns('TOTAL', amount(sale.total), width));
  out.push(twoColumns('Paid by', sale.paidBy, width));
  if (sale.note) out.push(fit(sale.note, width));

  out.push('');
  out.push(centre(shop.footer ?? 'Thank you', width));
  return out;
}

/**
 * Whether a counter printer can print this at all.
 *
 * These printers hold a handful of single-byte code pages and no Devanagari, so Marathi comes out as blanks or
 * nonsense. The bill is written in English for that reason, and anything outside what the printer can show is
 * caught here rather than silently printed as rubbish.
 */
export function canPrintText(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E\n]*$/.test(text);
}

/** Replaces what a counter printer cannot show, so a stray character never spoils a bill. */
function printable(text: string): string {
  return text
    .replace(/[₹]/g, 'Rs ')
    .replace(/[—–]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\n]/g, '');
}

/**
 * The bill as ESC/POS bytes, ready to go down a Bluetooth socket.
 *
 * @param cut whether to cut the paper at the end — off for a printer with no cutter, which would otherwise beep.
 */
export function receiptBytes(sale: CounterSale, shop: ReceiptShop, options: ReceiptOptions & { cut?: boolean } = {}): Uint8Array {
  const lines = receiptLines(sale, shop, options);
  const body = printable(lines.join('\n'));

  const text = new TextEncoder().encode(`${body}\n`);
  const head = new Uint8Array([
    ESC, 0x40, // wake up and forget whatever the last job left set
    ESC, 0x74, 0x00, // code page 437, the one every one of these printers has
    ESC, 0x61, 0x00, // left aligned; the lines are centred by spaces, which every printer agrees on
  ]);
  // Feed enough that the tear bar clears the last line, then cut if it can.
  const tail = options.cut === false ? new Uint8Array([0x0a, 0x0a, 0x0a]) : new Uint8Array([0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00]);

  const out = new Uint8Array(head.length + text.length + tail.length);
  out.set(head, 0);
  out.set(text, head.length);
  out.set(tail, head.length + text.length);
  return out;
}
