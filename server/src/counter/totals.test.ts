import { describe, expect, it } from 'vitest';

import { countSale, money, paymentWay } from '@/counter/totals';

describe('what a counter sale comes to', () => {
  it('multiplies each line out and adds them up', () => {
    const sale = countSale(
      [
        { productName: 'Cow Milk', packLabel: '500 ml', quantity: 2, unitPrice: 30 },
        { productName: 'Shrikhand', packLabel: '200 g', quantity: 1, unitPrice: 90 },
      ],
      0,
    );
    expect(sale.lines.map((l) => l.lineTotal)).toEqual([60, 90]);
    expect(sale.itemsTotal).toBe(150);
    expect(sale.total).toBe(150);
  });

  it('takes the discount off the total, not off a line', () => {
    const sale = countSale([{ productName: 'Paneer', quantity: 1, unitPrice: 100 }], 15);
    expect(sale.itemsTotal).toBe(100);
    expect(sale.discount).toBe(15);
    expect(sale.total).toBe(85);
  });

  it('allows a discount of the whole sale, and refuses more', () => {
    expect(countSale([{ productName: 'Milk', quantity: 1, unitPrice: 30 }], 30).total).toBe(0);
    expect(() => countSale([{ productName: 'Milk', quantity: 1, unitPrice: 30 }], 31)).toThrow(/more than the sale/i);
  });

  it('refuses a sale with nothing on it, including lines with no product', () => {
    expect(() => countSale([], 0)).toThrow(/nothing on this sale/i);
    expect(() => countSale([{ productName: '  ', quantity: 1, unitPrice: 10 }], 0)).toThrow(/nothing on this sale/i);
  });

  it('counts a missing or silly quantity as one', () => {
    expect(countSale([{ productName: 'Milk', unitPrice: 30 }], 0).total).toBe(30);
    expect(countSale([{ productName: 'Milk', quantity: 0, unitPrice: 30 }], 0).total).toBe(30);
    expect(countSale([{ productName: 'Milk', quantity: -4, unitPrice: 30 }], 0).total).toBe(30);
  });

  it('rounds a quantity rather than selling a third of a pack', () => {
    expect(countSale([{ productName: 'Milk', quantity: 2.4, unitPrice: 30 }], 0).total).toBe(60);
    expect(countSale([{ productName: 'Milk', quantity: 2.6, unitPrice: 30 }], 0).total).toBe(90);
  });

  it('refuses a price that is not an amount', () => {
    expect(() => money('free', 'A price')).toThrow(/not an amount/i);
    expect(() => money(-5, 'A price')).toThrow(/not an amount/i);
    expect(() => countSale([{ productName: 'Milk', quantity: 1, unitPrice: Number.NaN }], 0)).toThrow(/not an amount/i);
  });

  it('allows something given away, which is a price of nothing', () => {
    expect(countSale([{ productName: 'Taster', quantity: 1, unitPrice: 0 }], 0).total).toBe(0);
  });

  it('keeps the name and pack as typed, trimmed', () => {
    const [line] = countSale([{ productName: '  Cow Milk ', packLabel: ' 500 ml ', quantity: 1, unitPrice: 30 }], 0).lines;
    expect(line).toMatchObject({ productName: 'Cow Milk', packLabel: '500 ml' });
  });

  it('takes cash or UPI and nothing else', () => {
    expect(paymentWay('Cash')).toBe('Cash');
    expect(paymentWay('UPI')).toBe('UPI');
    expect(paymentWay(undefined)).toBe('Cash');
    expect(() => paymentWay('Cheque')).toThrow(/cash or UPI/i);
    expect(() => paymentWay('card')).toThrow(/cash or UPI/i);
  });
});
