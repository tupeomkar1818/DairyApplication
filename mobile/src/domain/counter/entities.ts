/**
 * The counter: what a walk-in bought, and what it came to.
 *
 * A counter sale is paid where it is made, so it is finished the moment it is rung up — it never reaches anybody's
 * monthly bill. What is kept is what was on the paper: the name and price of each thing **as it was sold**, not a
 * pointer to a product whose price may change next month.
 */

export type CartLine = {
  /** Where it came from in the catalogue, so the dairy can see what sells. Absent for something typed by hand. */
  productId?: string;
  packId?: string;
  productName: string;
  packLabel: string;
  quantity: number;
  unitPrice: number;
};

export type SaleLine = CartLine & { lineTotal: number };

export type PaidBy = 'Cash' | 'UPI';

export type CounterSale = {
  id: string;
  /** How it reads on the bill, counted within the day: 001, 002… */
  saleNo: string;
  ymd: string;
  soldAt: string;
  deskUserId?: string;
  soldByName: string;
  customerId?: string;
  customerName: string;
  customerMobile: string;
  itemsTotal: number;
  discount: number;
  total: number;
  paidBy: PaidBy;
  note: string;
  printedAt?: string;
  lines: SaleLine[];
};

export type DeskUser = {
  id: string;
  fullName: string;
  mobile: string;
  status: string;
  appAccessEnabled: boolean;
  counterName: string;
  createdAt: string;
  updatedAt: string;
};

export type Manager = {
  id: string;
  name: string;
  mobile: string;
  role: 'super_admin' | 'admin';
  status: string;
  createdAt: string;
  /** False for the owner's own login, which nothing may remove. */
  removable: boolean;
};

/** What the counter took, for the dairy's screen. */
export type CounterDay = {
  from: string;
  to: string;
  sales: number;
  total: number;
  cash: number;
  upi: number;
  discount: number;
  byDesk: { deskUserId?: string; name: string; sales: number; total: number }[];
  byProduct: { productName: string; packLabel: string; quantity: number; total: number }[];
};

/** Adds a line to the cart, or one more of something already on it. */
export function addToCart(cart: CartLine[], line: CartLine): CartLine[] {
  const same = (a: CartLine, b: CartLine) =>
    a.productName === b.productName && a.packLabel === b.packLabel && a.unitPrice === b.unitPrice;
  const at = cart.findIndex((l) => same(l, line));
  if (at < 0) return [...cart, line];
  return cart.map((l, i) => (i === at ? { ...l, quantity: l.quantity + line.quantity } : l));
}

/** Sets how many of a line, taking it off the cart at nothing. */
export function setCartQuantity(cart: CartLine[], index: number, quantity: number): CartLine[] {
  if (quantity <= 0) return cart.filter((_, i) => i !== index);
  return cart.map((l, i) => (i === index ? { ...l, quantity: Math.round(quantity) } : l));
}

/**
 * What the cart comes to, for showing while it is being filled.
 *
 * The server works this out again from the lines when the sale is placed, and the server's answer is the one on
 * the bill — this is only so the desk can read a running total without asking.
 */
export function cartTotals(cart: CartLine[], discount = 0): { itemsTotal: number; discount: number; total: number } {
  const itemsTotal = cart.reduce((sum, l) => sum + Math.max(1, Math.round(l.quantity)) * Math.max(0, Math.round(l.unitPrice)), 0);
  const capped = Math.min(Math.max(0, Math.round(discount)), itemsTotal);
  return { itemsTotal, discount: capped, total: itemsTotal - capped };
}
