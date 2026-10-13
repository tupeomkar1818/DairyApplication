import type { CartLine, CounterDay, CounterSale, DeskUser, Manager, PaidBy } from '@/src/domain/counter/entities';

export type PlaceSaleRequest = {
  lines: CartLine[];
  discount?: number;
  paidBy: PaidBy;
  note?: string;
  customerId?: string;
  /**
   * The phone's own id for this sale.
   *
   * A counter is a place where the same button gets pressed twice — the till did not seem to answer, the signal
   * dropped halfway. Sending the same id again gets the same bill back instead of taking the money twice.
   */
  clientRef?: string;
};

/**
 * The counter, and the people who work it.
 *
 * Only exists with the dairy's server: a sale is money, and money is not something a phone keeps its own copy of.
 */
export interface ICounterService {
  /** POST /counter/sales — the server adds it up again and its answer is what goes on the bill. */
  placeSale(data: PlaceSaleRequest): Promise<CounterSale>;

  /** POST /counter/sales/:id/printed — so the desk can see which bills did not come out. */
  markPrinted(id: string): Promise<CounterSale>;

  /** GET /counter/sales?ymd= — a desk user's own sales; everybody's for the dairy. */
  salesOn(ymd?: string): Promise<{ ymd: string; items: CounterSale[] }>;

  /** GET /counter/day — what the counter took. The dairy's. */
  day(range?: { from: string; to?: string }): Promise<CounterDay>;

  /** GET /desk-users */
  listDeskUsers(): Promise<DeskUser[]>;

  /** POST /desk-users. The owner's. */
  addDeskUser(data: Partial<DeskUser>): Promise<DeskUser>;

  /** PATCH /desk-users/:id. The owner's. */
  updateDeskUser(id: string, data: Partial<DeskUser>): Promise<DeskUser>;

  /** DELETE /desk-users/:id. The owner's; their sales stay. */
  removeDeskUser(id: string): Promise<void>;

  /** GET /admins. The owner's. */
  listManagers(): Promise<Manager[]>;

  /** POST /admins. The owner's. */
  addManager(data: { name: string; mobile: string }): Promise<Manager>;

  /** DELETE /admins/:id. The owner's, and never their own login. */
  removeManager(id: string): Promise<void>;
}
