import { describe, expect, it } from 'vitest';

import type { CounterSale } from '@/src/domain/counter/entities';
import { canPrintText, centre, receiptBytes, receiptLines, twoColumns } from '@/src/domain/counter/receipt';

const shop = { name: 'Amrale Dairy', line1: 'Sangam Chowk, Kothrud', phone: '+91 99224 43636' };

const sale = (over: Partial<CounterSale> = {}): CounterSale => ({
  id: 'sale_1',
  saleNo: '007',
  ymd: '2026-10-13',
  soldAt: '2026-10-13T09:30:00.000Z',
  soldByName: 'Nilesh',
  customerName: '',
  customerMobile: '',
  itemsTotal: 150,
  discount: 0,
  total: 150,
  paidBy: 'Cash',
  note: '',
  lines: [
    { productName: 'Cow Milk', packLabel: '500 ml', quantity: 2, unitPrice: 30, lineTotal: 60 },
    { productName: 'Shrikhand', packLabel: '200 g', quantity: 1, unitPrice: 90, lineTotal: 90 },
  ],
  ...over,
});

describe('laying a bill out for the roll', () => {
  it('puts the amount hard against the right edge', () => {
    const line = twoColumns('Cow Milk', 'Rs 60', 32);
    expect(line).toHaveLength(32);
    expect(line.endsWith('Rs 60')).toBe(true);
    expect(line.startsWith('Cow Milk')).toBe(true);
  });

  it('cuts a name that would not fit rather than wrapping it', () => {
    const line = twoColumns('A very long product name indeed that will not fit', 'Rs 1200', 32);
    expect(line).toHaveLength(32);
    expect(line.endsWith('Rs 1200')).toBe(true);
  });

  it('centres within the roll', () => {
    expect(centre('Amrale Dairy', 32).trimStart()).toBe('Amrale Dairy');
    expect(centre('x', 32)).toHaveLength(16); // 15 spaces, then the character
  });

  it('never makes a line wider than the roll', () => {
    for (const width of [32, 48]) {
      for (const line of receiptLines(sale(), shop, { width })) {
        expect(line.length).toBeLessThanOrEqual(width);
      }
    }
  });
});

describe('what the bill says', () => {
  it('names the dairy, the bill and who sold it', () => {
    const text = receiptLines(sale(), shop).join('\n');
    expect(text).toContain('Amrale Dairy');
    expect(text).toContain('Bill 007');
    expect(text).toContain('Nilesh');
  });

  it('prints every line with its quantity and what it came to', () => {
    const text = receiptLines(sale(), shop).join('\n');
    expect(text).toContain('Cow Milk 500 ml');
    expect(text).toContain('2 x Rs 30');
    expect(text).toContain('Rs 60');
    expect(text).toContain('Shrikhand 200 g');
  });

  it('shows the total and how it was paid', () => {
    const text = receiptLines(sale(), shop).join('\n');
    expect(text).toContain('TOTAL');
    expect(text).toContain('Rs 150');
    expect(text).toContain('Cash');
  });

  it('shows the discount only when there is one', () => {
    expect(receiptLines(sale(), shop).join('\n')).not.toContain('Discount');
    const withDiscount = receiptLines(sale({ discount: 20, total: 130 }), shop).join('\n');
    expect(withDiscount).toContain('Discount');
    expect(withDiscount).toContain('- Rs 20');
    expect(withDiscount).toContain('Rs 130');
  });

  it("names the customer when the sale was put on somebody's record", () => {
    expect(receiptLines(sale({ customerName: 'Asha Patil' }), shop).join('\n')).toContain('Asha Patil');
  });

  it('reads the time in the dairy’s own day, not UTC', () => {
    // 09:30 UTC is 15:00 in Kothrud.
    expect(receiptLines(sale(), shop).join('\n')).toContain('15:00');
  });
});

describe('what a counter printer can actually print', () => {
  it('is plain ASCII, whatever went in', () => {
    const text = receiptLines(sale({ customerName: 'अशा पाटील', note: 'दिलं — धन्यवाद' }), shop).join('\n');
    expect(canPrintText(text)).toBe(false); // the laid-out text still holds the Marathi
    const bytes = receiptBytes(sale({ customerName: 'अशा पाटील', note: 'दिलं — धन्यवाद' }), shop);
    const printed = new TextDecoder().decode(bytes);
    // Everything the printer cannot show has gone, and nothing is left as a stray byte.
    expect(canPrintText(printed.replace(/[\x00-\x1f]/g, '\n'))).toBe(true);
  });

  it('turns a rupee sign into something the printer has', () => {
    const bytes = receiptBytes(sale({ note: 'paid ₹150' }), shop);
    const printed = new TextDecoder().decode(bytes);
    expect(printed).toContain('Rs 150');
    expect(printed).not.toContain('₹');
  });

  it('starts by resetting the printer and ends by cutting', () => {
    const bytes = receiptBytes(sale(), shop);
    expect([bytes[0], bytes[1]]).toEqual([0x1b, 0x40]);
    expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it('leaves the paper uncut for a printer with no cutter', () => {
    const bytes = receiptBytes(sale(), shop, { cut: false });
    expect(Array.from(bytes.slice(-3))).toEqual([0x0a, 0x0a, 0x0a]);
  });
});
