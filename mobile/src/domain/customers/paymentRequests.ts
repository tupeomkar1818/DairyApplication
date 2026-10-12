import { buildBillingTimeline, summarizeBilling } from '@/src/components/admin/billingTimeline';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type {
  CustomerPayment,
  CustomerPaymentRequest,
  PaymentRequestMethod,
} from '@/src/domain/customers/entities';
import type { PaymentMode } from '@/src/domain/customers/enums';
import { strings } from '@/src/i18n/strings';
import { formatMoney } from '@/src/utils/format';
import type { Offer } from '@/src/domain/offers/entities';

/**
 * Paying a bill from the customer app.
 *
 * The customer pays through their own UPI app (or says they will hand over cash) and tells the dairy the reference.
 * Nothing is taken off the bill until the dairy confirms it — the app cannot see money arrive — and confirming
 * records an ordinary payment, so bills, balances and reports treat it exactly like one the dairy entered itself.
 */

/** UPI IDs look like name@bank: letters, digits, dot, dash and underscore before the @, letters after. */
const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
/** UPI references (UTR) are 12 digits; gateways use longer ids, so letters and digits up to 35. */
const REFERENCE = /^[a-zA-Z0-9]{6,35}$/;

/** No single app payment above this: a mistyped extra zero should not be sent to UPI. */
export const MAX_APP_PAYMENT = 100_000;

export function isValidUpiId(value: string): boolean {
  return UPI_ID.test(String(value ?? '').trim());
}

export function normalizeReference(value: string): string {
  return String(value ?? '').replace(/[\s-]/g, '').toUpperCase();
}

export function isValidReference(value: string): boolean {
  return REFERENCE.test(normalizeReference(value));
}

/**
 * The link every UPI app on the phone opens with the payee, amount and note filled in (NPCI's `upi://pay` format).
 * `tr` carries our own reference so the dairy can match the transfer in its bank statement.
 */
export function buildUpiPayLink(input: {
  upiId: string;
  payeeName: string;
  amount: number;
  note: string;
  reference?: string;
}): string {
  const params: [string, string][] = [
    ['pa', input.upiId.trim()],
    ['pn', input.payeeName.trim() || 'Dairy'],
    ['am', (Math.round(input.amount * 100) / 100).toFixed(2)],
    ['cu', 'INR'],
    ['tn', input.note.trim().slice(0, 50)],
  ];
  if (input.reference) params.push(['tr', input.reference.slice(0, 35)]);
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

/** A short reference for one bill payment, e.g. "AMR7K2Q9X". */
export function newPaymentReference(random: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'AMR';
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(random() * alphabet.length)];
  return out;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function pendingPaymentRequests(c: Pick<CustomerResponse, 'paymentRequests'>): CustomerPaymentRequest[] {
  return (c.paymentRequests ?? [])
    .filter((r) => r.status === 'Pending')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function pendingPaymentTotal(c: Pick<CustomerResponse, 'paymentRequests'>): number {
  return pendingPaymentRequests(c).reduce((sum, r) => sum + r.amount, 0);
}

export class PaymentRequestError extends Error {}

export type NewPaymentRequest = {
  amount: number;
  method: PaymentRequestMethod;
  reference?: string;
  paidOnYmd: string;
  note?: string;
};

/** Why a payment cannot be sent, or null when it is fine. */
export function validatePaymentRequest(c: Pick<CustomerResponse, 'paymentRequests'>, input: NewPaymentRequest, today: string): string | null {
  const t = strings('billing').requestErrors;
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 1) return t.amountTooSmall;
  if (amount > MAX_APP_PAYMENT) return t.amountTooLarge(formatMoney(MAX_APP_PAYMENT));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOnYmd)) return t.choosePaidDay;
  if (input.method !== 'Cash') {
    if (input.paidOnYmd > today) return t.futureDay;
    if (!isValidReference(input.reference ?? '')) {
      return input.method === 'UPI' ? t.upiReference : t.onlineReference;
    }
    const ref = normalizeReference(input.reference ?? '');
    const reused = (c.paymentRequests ?? []).some(
      (r) => (r.status === 'Pending' || r.status === 'Confirmed') && normalizeReference(r.reference ?? '') === ref,
    );
    if (reused) return t.referenceReused;
  }
  return null;
}

/** Adds the customer's payment for the dairy to confirm. Throws `PaymentRequestError` when it is not valid. */
export function addPaymentRequest(
  c: Pick<CustomerResponse, 'paymentRequests'>,
  input: NewPaymentRequest,
  opts: { today: string; nowIso: string },
): { paymentRequests: CustomerPaymentRequest[]; request: CustomerPaymentRequest } {
  const problem = validatePaymentRequest(c, input, opts.today);
  if (problem) throw new PaymentRequestError(problem);
  const note = input.note?.trim();
  const request: CustomerPaymentRequest = {
    id: newId('payreq'),
    amount: Math.round(Number(input.amount) * 100) / 100,
    method: input.method,
    ...(input.method !== 'Cash' ? { reference: normalizeReference(input.reference ?? '') } : {}),
    paidOnYmd: input.paidOnYmd,
    ...(note ? { note: note.slice(0, 200) } : {}),
    status: 'Pending',
    createdAt: opts.nowIso,
    updatedAt: opts.nowIso,
  };
  return { paymentRequests: [request, ...(c.paymentRequests ?? [])], request };
}

export function cancelPaymentRequest(
  c: Pick<CustomerResponse, 'paymentRequests'>,
  requestId: string,
  nowIso: string,
): CustomerPaymentRequest[] {
  return (c.paymentRequests ?? []).map((r) =>
    r.id === requestId && r.status === 'Pending' ? { ...r, status: 'Cancelled' as const, updatedAt: nowIso } : r,
  );
}

const MODE: Record<PaymentRequestMethod, PaymentMode> = { UPI: 'UPI', Cash: 'Cash', Online: 'Other' };

/**
 * The dairy confirms the money arrived: the request becomes an ordinary payment, and the stored balance is brought
 * up to date the same way "Mark paid" does it. `amount` lets the admin record what actually arrived.
 */
export function confirmPaymentRequest(
  c: CustomerResponse,
  requestId: string,
  opts: { today: string; nowIso: string; amount?: number; collectedBy?: string; offers?: readonly Offer[] },
): {
  paymentRequests: CustomerPaymentRequest[];
  payments: CustomerPayment[];
  payment: CustomerPayment;
  pendingAmount: number;
  advanceBalance: number;
  lastPaymentDate: string;
} {
  const request = (c.paymentRequests ?? []).find((r) => r.id === requestId);
  const errors = strings('billing').requestErrors;
  if (!request) throw new PaymentRequestError(errors.noLongerOnAccount);
  if (request.status !== 'Pending') throw new PaymentRequestError(errors.alreadyReviewed[request.status]);
  const amount = Math.round(Number(opts.amount ?? request.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new PaymentRequestError(errors.amountReceived);

  // The note is stored on the payment record (statements and exports read it), so it stays in English.
  const methodLabel = request.method === 'Online' ? 'online' : request.method;
  const payment: CustomerPayment = {
    id: newId('pay'),
    paymentDate: request.paidOnYmd > opts.today ? opts.today : request.paidOnYmd,
    amountPaid: amount,
    paymentMode: MODE[request.method],
    ...(request.reference ? { transactionId: request.reference } : {}),
    ...(opts.collectedBy?.trim() ? { collectedBy: opts.collectedBy.trim() } : {}),
    notes: `Paid from the customer app (${methodLabel})${request.note ? ` · ${request.note}` : ''}`.slice(0, 300),
    createdAt: opts.nowIso,
    updatedAt: opts.nowIso,
  };
  const payments = [payment, ...(c.payments ?? [])];
  const after = { ...c, payments };
  const settled = summarizeBilling(after, buildBillingTimeline(after, opts.today.slice(0, 7), { offers: opts.offers }), opts.today);

  return {
    paymentRequests: (c.paymentRequests ?? []).map((r) =>
      r.id === requestId
        ? { ...r, status: 'Confirmed' as const, amount, paymentId: payment.id, reviewedAt: opts.nowIso, updatedAt: opts.nowIso }
        : r,
    ),
    payments,
    payment,
    pendingAmount: settled.outstanding,
    advanceBalance: settled.advance,
    lastPaymentDate: opts.nowIso,
  };
}

export function rejectPaymentRequest(
  c: Pick<CustomerResponse, 'paymentRequests'>,
  requestId: string,
  reason: string,
  nowIso: string,
): CustomerPaymentRequest[] {
  const request = (c.paymentRequests ?? []).find((r) => r.id === requestId);
  const errors = strings('billing').requestErrors;
  if (!request || request.status !== 'Pending') throw new PaymentRequestError(errors.noLongerWaiting);
  const why = reason.trim();
  if (!why) throw new PaymentRequestError(errors.reasonRequired);
  return (c.paymentRequests ?? []).map((r) =>
    r.id === requestId
      ? { ...r, status: 'Rejected' as const, rejectReason: why.slice(0, 200), reviewedAt: nowIso, updatedAt: nowIso }
      : r,
  );
}

/** "UPI", "Cash" or "Online", in the app language. */
export function paymentMethodLabel(method: PaymentRequestMethod): string {
  return strings('billing').methods[method] ?? method;
}

/** A recorded payment's mode ("Cash", "UPI", "Bank", "Other") in the app language; any other value as stored. */
export function paymentModeLabel(mode: string): string {
  return (strings('billing').paymentModes as Record<string, string>)[mode] ?? mode;
}
