import { describe, expect, it } from 'vitest';

import { addToCart, cartTotals, setCartQuantity, type CartLine } from '@/src/domain/counter/entities';

const milk = (over: Partial<CartLine> = {}): CartLine => ({
  productName: 'Cow Milk',
  packLabel: '500 ml',
  quantity: 1,
  unitPrice: 30,
  ...over,
});

describe('the counter cart', () => {
  it('adds a new line', () => {
    expect(addToCart([], milk())).toHaveLength(1);
  });

  it('adds to the line that is already there rather than listing it twice', () => {
    const cart = addToCart(addToCart([], milk()), milk());
    expect(cart).toHaveLength(1);
    expect(cart[0]!.quantity).toBe(2);
  });

  it('keeps a different pack of the same product apart', () => {
    const cart = addToCart(addToCart([], milk()), milk({ packLabel: '1 litre', unitPrice: 58 }));
    expect(cart).toHaveLength(2);
  });

  it('keeps the same pack apart when it was sold at a different price', () => {
    const cart = addToCart(addToCart([], milk()), milk({ unitPrice: 28 }));
    expect(cart).toHaveLength(2);
  });

  it('changes how many of a line', () => {
    const cart = setCartQuantity([milk()], 0, 4);
    expect(cart[0]!.quantity).toBe(4);
  });

  it('takes a line off the cart at none', () => {
    expect(setCartQuantity([milk()], 0, 0)).toHaveLength(0);
    expect(setCartQuantity([milk()], 0, -2)).toHaveLength(0);
  });

  it('adds the cart up', () => {
    const cart = [milk({ quantity: 2 }), milk({ productName: 'Paneer', packLabel: '200 g', unitPrice: 90 })];
    expect(cartTotals(cart)).toMatchObject({ itemsTotal: 150, total: 150 });
  });

  it('takes a discount off the total', () => {
    expect(cartTotals([milk({ quantity: 2 })], 15)).toMatchObject({ itemsTotal: 60, discount: 15, total: 45 });
  });

  it('never lets a discount make the total negative', () => {
    expect(cartTotals([milk()], 500)).toMatchObject({ discount: 30, total: 0 });
  });

  it('ignores a negative discount rather than charging more', () => {
    expect(cartTotals([milk()], -20)).toMatchObject({ discount: 0, total: 30 });
  });

  it('comes to nothing for an empty cart', () => {
    expect(cartTotals([])).toMatchObject({ itemsTotal: 0, total: 0 });
  });
});
