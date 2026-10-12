import { deliveryAttemptAnnouncement, personalize } from '@/src/domain/announcements/announcements';
import type { Announcement } from '@/src/domain/announcements/entities';
import { addOnLabel, addOnsForDate } from '@/src/domain/customers/addOns';
import type { CustomerExtraOrder } from '@/src/domain/customers/entities';
import { inEveryLanguage, oneInEveryLanguage } from '@/src/domain/notifications/notificationText';
import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';
import { services } from '@/src/infrastructure/service-registry';
import type { Offer } from '@/src/domain/offers/entities';
import type { NewNotification } from '@/src/infrastructure/notificationsStore';
import { formatDay, formatMoney, formatMonth } from '@/src/utils/format';

/**
 * Every in-app notification the system raises, and the words it uses.
 *
 * Keeping the copy here (rather than at each call site) means the customer, the admin and the delivery boy always
 * read the same account of the same event. The words come from the `inbox` dictionary and are written in every
 * language when the event happens (`inEveryLanguage`): the row is read later, maybe on a phone set to the other
 * language. Callers do not await these: a notification that fails to write must never fail the delivery or order
 * that caused it.
 *
 * Who hears about what:
 * - the customer, about anything on their account — whoever made the change;
 * - the admin, about what customers and delivery boys do (not about their own changes);
 * - the delivery boy, about changes to their customers' days, since those change what goes on the van.
 */

/** Who made a change: the customer in their app, or the dairy on their behalf. */
export type ChangedBy = 'customer' | 'admin';

type CustomerEvent = {
  customerId: string;
  customerName: string;
  /** Who made the change; the customer when omitted. */
  by?: ChangedBy;
  /** The customer's delivery boy, who is told when their round changes. */
  deliveryBoyId?: string;
};

function words(lang: Lang) {
  return strings('inbox', lang).events;
}

function rangeLabel(fromYmd: string, toYmd: string, lang: Lang): string {
  return fromYmd === toYmd ? formatDay(fromYmd, { lang }) : `${formatDay(fromYmd, { lang })} – ${formatDay(toYmd, { lang })}`;
}

function deliveryBoyRow(
  input: CustomerEvent,
  lang: Lang,
  row: Pick<NewNotification, 'type' | 'body'> & { dateYmd?: string },
): NewNotification[] {
  const id = String(input.deliveryBoyId ?? '').trim();
  if (!id) return [];
  return [
    {
      audience: 'DeliveryBoy',
      deliveryBoyId: id,
      customerId: input.customerId,
      title: words(lang).deliveryBoyTitle(input.customerName),
      ...row,
    },
  ];
}

function adminRow(input: CustomerEvent, row: Omit<NewNotification, 'audience' | 'customerId'>): NewNotification[] {
  if (input.by === 'admin') return [];
  return [{ audience: 'Admin', customerId: input.customerId, ...row }];
}

/** "Cow Milk · 500 ml" from "Cow Milk · 500 ml × 3": the subject of a change, whatever the count. */
function itemBase(itemLabel: string): string {
  return itemLabel.replace(/\s*×\s*\d+\s*$/, '').trim();
}

/**
 * Fire and forget: the caller's action has already succeeded by the time this runs.
 *
 * `subjectKey` names what the rows are about; a later event on the same subject replaces these rows for each reader
 * (see `mergeNotifications`), so one change made in several steps is one notification.
 */
function raise(input: NewNotification[], subjectKey?: string): void {
  const rows = subjectKey ? input.map((row) => ({ ...row, subjectKey })) : input;
  if (rows.length === 0) return;
  void services.notifications.add(rows).catch(() => undefined);
}

/** What changed in the add-ons for a day, and every add-on still standing for that day afterwards. */
type AddOnDayEvent = CustomerEvent & {
  dateYmd: string;
  /** The item this change was about, e.g. "Paneer · 200 gm × 2". */
  itemLabel: string;
  /** The customer's add-ons after the change was saved — the notification lists the whole day from these. */
  extraOrders: CustomerExtraOrder[] | undefined;
};

function dayAddOnLabels(input: AddOnDayEvent, lang: Lang): string[] {
  return addOnsForDate({ extraOrders: input.extraOrders ?? [] }, input.dateYmd).map((o) => addOnLabel(o, lang));
}

/**
 * One notification per customer per day for add-ons: ordering Paneer, then Curd, then two more Paneer for the same
 * day reads as one "3 add-ons for Fri, 18 Sep" listing all of them, not three separate notices. Each change
 * replaces the day's notice with the day as it now stands.
 */
function raiseAddOnDay(input: AddOnDayEvent, change: 'added' | 'cancelled'): void {
  const byDairy = input.by === 'admin';

  const rows = inEveryLanguage((lang): NewNotification[] => {
    const t = words(lang);
    // A combo's name is in each language.
    const items = dayAddOnLabels(input, lang);
    const list = items.join(', ');
    const day = formatDay(input.dateYmd, { weekday: true, lang });
    let type: NewNotification['type'];
    let customerTitle: string;
    let adminTitle: string;
    let body: string;
    if (items.length === 0) {
      type = 'OrderCancelled';
      customerTitle = byDairy ? t.addOnsCancelledByDairyTitle : t.addOnsCancelledTitle;
      adminTitle = t.adminAddOnsCancelledTitle(input.customerName);
      body = t.addOnsNoneLeftBody(day, input.itemLabel);
    } else if (change === 'cancelled') {
      type = 'OrderCancelled';
      customerTitle = byDairy ? t.addOnsUpdatedByDairyTitle : t.addOnsUpdatedTitle;
      adminTitle = t.adminAddOnsChangedTitle(input.customerName);
      body = t.addOnCancelledBody(input.itemLabel, day, list);
    } else {
      type = 'OrderPlaced';
      const count = t.addOnCount(items.length);
      customerTitle = byDairy ? t.addOnsAddedByDairyTitle(count) : t.addOnsOrderedTitle(count);
      adminTitle = t.adminAddOnsOrderedTitle(input.customerName, count);
      body = t.addOnsOrderedBody(day, list);
    }
    return [
      { audience: 'Customer', customerId: input.customerId, type, title: customerTitle, body, dateYmd: input.dateYmd },
      ...adminRow(input, { type, title: adminTitle, body, dateYmd: input.dateYmd }),
      ...deliveryBoyRow(input, lang, {
        type,
        body: items.length ? t.deliveryBoyAddOnsBody(day, list) : t.deliveryBoyNoAddOnsBody(day),
        dateYmd: input.dateYmd,
      }),
    ];
  });

  raise(rows, `addons:${input.customerId}:${input.dateYmd}`);
}

/** An add-on was ordered (or its count raised) for a day. */
export function notifyOrderPlaced(input: AddOnDayEvent): void {
  raiseAddOnDay(input, 'added');
}

/** An add-on for a day was cancelled. */
export function notifyOrderCancelled(input: AddOnDayEvent): void {
  raiseAddOnDay(input, 'cancelled');
}

/** Delivery stopped for a day or a stretch of days. */
export function notifyDaysSkipped(input: CustomerEvent & { fromYmd: string; toYmd: string }): void {
  raise(
    inEveryLanguage((lang): NewNotification[] => {
      const t = words(lang);
      const range = rangeLabel(input.fromYmd, input.toYmd, lang);
      return [
        {
          audience: 'Customer',
          customerId: input.customerId,
          type: 'DaySkipped',
          title: input.by === 'admin' ? t.pausedByDairyTitle : t.pausedTitle,
          body: t.pausedBody(range),
          dateYmd: input.fromYmd,
        },
        ...adminRow(input, {
          type: 'DaySkipped',
          title: t.adminPausedTitle(input.customerName),
          body: t.noDeliveryBody(range),
          dateYmd: input.fromYmd,
        }),
        ...deliveryBoyRow(input, lang, {
          type: 'DaySkipped',
          body: t.noDeliveryBody(range),
          dateYmd: input.fromYmd,
        }),
      ];
    }),
    `days:${input.customerId}:${input.fromYmd}:${input.toYmd}`,
  );
}

/** A skipped day was brought back. */
export function notifyDayResumed(input: CustomerEvent & { fromYmd: string; toYmd: string }): void {
  raise(
    inEveryLanguage((lang): NewNotification[] => {
      const t = words(lang);
      const range = rangeLabel(input.fromYmd, input.toYmd, lang);
      return [
        {
          audience: 'Customer',
          customerId: input.customerId,
          type: 'SubscriptionResumed',
          title: t.resumedTitle,
          body: t.resumedBody(range),
          dateYmd: input.fromYmd,
        },
        ...adminRow(input, {
          type: 'SubscriptionResumed',
          title: t.adminResumedTitle(input.customerName),
          body: t.backOnBody(range),
          dateYmd: input.fromYmd,
        }),
        ...deliveryBoyRow(input, lang, {
          type: 'SubscriptionResumed',
          body: t.backOnBody(range),
          dateYmd: input.fromYmd,
        }),
      ];
    }),
    `days:${input.customerId}:${input.fromYmd}:${input.toYmd}`,
  );
}

/** How many packs of a subscription line come on a day or a stretch of days changed. */
export function notifyQuantityChanged(
  input: CustomerEvent & {
    itemLabel: string;
    fromYmd: string;
    toYmd: string;
    numberOfItems: number;
    usual: number;
  },
): void {
  raise(
    inEveryLanguage((lang): NewNotification[] => {
      const t = words(lang);
      const range = rangeLabel(input.fromYmd, input.toYmd, lang);
      const what =
        input.numberOfItems === 0
          ? t.quantityNone(input.itemLabel)
          : input.numberOfItems === input.usual
            ? t.quantityUsual(input.itemLabel, String(input.usual))
            : `${input.itemLabel} × ${input.numberOfItems}`;
      const body = t.quantityBody(what, range);
      return [
        {
          audience: 'Customer',
          customerId: input.customerId,
          type: 'QuantityChanged',
          title: input.by === 'admin' ? t.quantityByDairyTitle : t.quantityTitle,
          body,
          dateYmd: input.fromYmd,
        },
        ...adminRow(input, {
          type: 'QuantityChanged',
          title: t.adminQuantityTitle(input.customerName),
          body,
          dateYmd: input.fromYmd,
        }),
        ...deliveryBoyRow(input, lang, {
          type: 'QuantityChanged',
          body,
          dateYmd: input.fromYmd,
        }),
      ];
    }),
    `quantity:${input.customerId}:${itemBase(input.itemLabel)}:${input.fromYmd}:${input.toYmd}`,
  );
}

export function notifySubscriptionStarted(input: CustomerEvent & { itemLabel: string; startYmd: string }): void {
  raise(
    inEveryLanguage((lang): NewNotification[] => {
      const t = words(lang);
      const day = formatDay(input.startYmd, { lang });
      const body = t.subscriptionStartedBody(input.itemLabel, day);
      return [
        {
          audience: 'Customer',
          customerId: input.customerId,
          type: 'SubscriptionStarted',
          title: input.by === 'admin' ? t.subscriptionStartedByDairyTitle : t.subscriptionStartedTitle,
          body,
          dateYmd: input.startYmd,
        },
        ...adminRow(input, {
          type: 'SubscriptionStarted',
          title: t.adminSubscribedTitle(input.customerName),
          body,
          dateYmd: input.startYmd,
        }),
        ...deliveryBoyRow(input, lang, {
          type: 'SubscriptionStarted',
          body: t.deliveryBoyNewSubscriptionBody(input.itemLabel, day),
          dateYmd: input.startYmd,
        }),
      ];
    }),
  );
}

/** A subscription's end date moved, or it was stopped. */
export function notifySubscriptionEnded(input: CustomerEvent & { itemLabel: string; lastYmd: string }): void {
  raise(
    inEveryLanguage((lang): NewNotification[] => {
      const t = words(lang);
      const body = t.subscriptionEndedBody(input.itemLabel, formatDay(input.lastYmd, { lang }));
      return [
        {
          audience: 'Customer',
          customerId: input.customerId,
          type: 'SubscriptionExpired',
          title: input.by === 'admin' ? t.subscriptionEndedByDairyTitle : t.subscriptionEndedTitle,
          body,
          dateYmd: input.lastYmd,
        },
        ...adminRow(input, {
          type: 'SubscriptionExpired',
          title: t.adminEndDateTitle(input.customerName),
          body,
          dateYmd: input.lastYmd,
        }),
        ...deliveryBoyRow(input, lang, {
          type: 'SubscriptionExpired',
          body,
          dateYmd: input.lastYmd,
        }),
      ];
    }),
    `end:${input.customerId}:${itemBase(input.itemLabel)}`,
  );
}

/**
 * The delivery boy (or the admin) marked the day. The customer gets a Delivery announcement from them — a receipt
 * when delivered, an apology when not — and one notification that opens it; a missed delivery also alerts the admin.
 * Marking the day again updates the same announcement and notification rather than adding more.
 */
export function notifyDeliveryMarked(input: {
  customerId: string;
  customerName: string;
  dateYmd: string;
  delivered: boolean;
  itemsLabel: string;
  deliveryBoyName?: string;
}): void {
  const subject = `delivery:${input.customerId}:${input.dateYmd}`;
  const announcement = deliveryAttemptAnnouncement(input);
  const rows = inEveryLanguage((lang): NewNotification[] => {
    const t = words(lang);
    const day = formatDay(input.dateYmd, { lang });
    const customerRow: NewNotification = input.delivered
      ? {
          audience: 'Customer',
          customerId: input.customerId,
          type: 'DeliveryCompleted',
          title: t.deliveredTitle,
          body: t.deliveredBody(input.itemsLabel, day),
          dateYmd: input.dateYmd,
          announcementId: announcement.id,
        }
      : {
          audience: 'Customer',
          customerId: input.customerId,
          type: 'DeliveryNotCompleted',
          title: t.notDeliveredTitle,
          body: t.notDeliveredBody(day),
          dateYmd: input.dateYmd,
          announcementId: announcement.id,
        };
    return input.delivered
      ? [customerRow]
      : [
          customerRow,
          {
            audience: 'Admin',
            customerId: input.customerId,
            type: 'DeliveryNotCompleted',
            title: t.adminNotDeliveredTitle(input.customerName),
            body: input.deliveryBoyName
              ? t.adminNotDeliveredMarkedByBody(day, input.deliveryBoyName)
              : t.adminNotDeliveredBody(day),
            dateYmd: input.dateYmd,
          },
        ];
  });

  // The announcement is saved first, so the notification pointing at it never opens to nothing.
  void services.announcements
    .save(announcement)
    .catch(() => undefined)
    .then(() => raise(rows, subject));
}

/** The dairy sent an announcement: each customer it reaches gets one notification that opens it. */
export function notifyAnnouncementSent(input: {
  announcement: Pick<Announcement, 'id' | 'title' | 'category'> & Partial<Pick<Announcement, 'translations'>>;
  recipients: readonly { id: string; name?: string }[];
}): void {
  raise(
    inEveryLanguage((lang): NewNotification[] => {
      const t = words(lang);
      // The title the admin wrote, unless the announcement carries its own wording for this language.
      const title = (lang !== 'en' && input.announcement.translations?.[lang]?.title) || input.announcement.title;
      return input.recipients.map((r) => ({
        audience: 'Customer' as const,
        customerId: r.id,
        type: 'Announcement' as const,
        title: input.announcement.category === 'Birthday' ? t.birthdayWishTitle : t.newAnnouncementTitle,
        body: personalize(title, r.name, lang),
        announcementId: input.announcement.id,
      }));
    }),
  );
}

/**
 * A chat message. The other side gets one notification per conversation, showing the latest message — a burst of
 * messages is one notification, not one each.
 */
export function notifyChatMessage(input: {
  customerId: string;
  customerName: string;
  from: 'customer' | 'admin';
  text: string;
}): void {
  const preview = input.text.length > 140 ? `${input.text.slice(0, 137)}…` : input.text;
  raise(
    inEveryLanguage((lang): NewNotification[] => {
      const t = words(lang);
      return [
        input.from === 'customer'
          ? {
              audience: 'Admin',
              customerId: input.customerId,
              type: 'ChatMessage',
              title: t.chatFromCustomerTitle(input.customerName),
              body: preview,
            }
          : {
              audience: 'Customer',
              customerId: input.customerId,
              type: 'ChatMessage',
              title: t.chatFromDairyTitle,
              body: preview,
            },
      ];
    }),
    `chat:${input.customerId}`,
  );
}

/** "Cash" reads "रोख" in Marathi; a mode the dictionary does not know is shown as recorded. */
function paymentModeLabel(mode: string, lang: Lang): string {
  return words(lang).paymentModes[mode] ?? mode;
}

/** The dairy recorded a payment on the customer's account. */
export function notifyPaymentRecorded(input: {
  customerId: string;
  amount: number;
  paymentMode?: string;
  dateYmd: string;
  /** Still owed after this payment, across all bills. */
  outstandingAfter?: number;
}): void {
  raise(
    inEveryLanguage((lang): NewNotification[] => {
      const t = words(lang);
      const day = formatDay(input.dateYmd, { lang });
      const amount = formatMoney(input.amount);
      const paid = input.paymentMode
        ? t.paymentRecordedByBody(amount, paymentModeLabel(input.paymentMode, lang), day)
        : t.paymentRecordedBody(amount, day);
      const rest =
        input.outstandingAfter === undefined
          ? ''
          : input.outstandingAfter > 0
            ? ` ${t.stillToPay(formatMoney(input.outstandingAfter))}`
            : ` ${t.allPaidUp}`;
      return [
        {
          audience: 'Customer',
          customerId: input.customerId,
          type: 'PaymentReceived',
          title: t.paymentReceivedTitle,
          body: `${paid}${rest}`,
          dateYmd: input.dateYmd,
        },
      ];
    }),
  );
}

/** The month's bill is ready. */
export function notifyBillGenerated(input: {
  customerId: string;
  monthYyyyMm: string;
  total: number;
  dueDateYmd?: string;
}): NewNotification {
  return oneInEveryLanguage((lang): NewNotification => {
    const t = words(lang);
    const total = formatMoney(input.total);
    return {
      audience: 'Customer',
      customerId: input.customerId,
      type: 'MonthlyBillGenerated',
      title: t.billTitle(formatMonth(input.monthYyyyMm, lang)),
      body: input.dueDateYmd ? t.billDueBody(total, formatDay(input.dueDateYmd, { lang })) : t.billBody(total),
      monthYyyyMm: input.monthYyyyMm,
    };
  });
}

/** Bills are generated for everyone at once, so these go in one write. */
export function notifyBillsGenerated(rows: readonly NewNotification[]): void {
  raise([...rows]);
}

export function notifyPaymentPending(input: {
  customerId: string;
  monthYyyyMm: string;
  amount: number;
  dueDateYmd?: string;
}): void {
  raise([
    oneInEveryLanguage((lang): NewNotification => {
      const t = words(lang);
      const amount = formatMoney(input.amount);
      const month = formatMonth(input.monthYyyyMm, lang);
      return {
        audience: 'Customer',
        customerId: input.customerId,
        type: 'PaymentPending',
        title: t.paymentPendingTitle,
        body: input.dueDateYmd
          ? t.paymentPendingDueBody(amount, month, formatDay(input.dueDateYmd, { lang }))
          : t.paymentPendingBody(amount, month),
        monthYyyyMm: input.monthYyyyMm,
      };
    }),
  ]);
}

export function notifyComplaintRaised(input: { customerId: string; customerName: string; subject: string }): void {
  raise(
    inEveryLanguage((lang): NewNotification[] => {
      const t = words(lang);
      return [
        {
          audience: 'Customer',
          customerId: input.customerId,
          type: 'ComplaintRaised',
          title: t.complaintRaisedTitle,
          body: t.complaintRaisedBody(input.subject),
        },
        {
          audience: 'Admin',
          customerId: input.customerId,
          type: 'ComplaintRaised',
          title: t.adminComplaintTitle(input.customerName),
          body: input.subject,
        },
      ];
    }),
  );
}

export function notifyComplaintAnswered(input: { customerId: string; subject: string; reply: string }): void {
  raise([
    oneInEveryLanguage(
      (lang): NewNotification => ({
        audience: 'Customer',
        customerId: input.customerId,
        type: 'ComplaintAnswered',
        title: words(lang).complaintReplyTitle(input.subject),
        body: input.reply,
      }),
    ),
  ]);
}

/**
 * The customer paid from the app (or will hand over cash): the dairy has to confirm it. For cash, the delivery
 * partner is told too, since they are usually the one handed the money.
 */
export function notifyPaymentSubmitted(input: {
  customerId: string;
  customerName: string;
  amount: number;
  method: 'UPI' | 'Cash' | 'Online';
  reference?: string;
  paidOnYmd: string;
  deliveryBoyId?: string;
  requestId: string;
}): void {
  const rows = inEveryLanguage((lang): NewNotification[] => {
    const t = words(lang);
    const amount = formatMoney(input.amount);
    const day = formatDay(input.paidOnYmd, { lang });
    const method = input.method === 'UPI' ? t.methodUpi : t.methodOnline;
    const body =
      input.method === 'Cash'
        ? input.paidOnYmd
          ? t.cashPromisedOnBody(input.customerName, amount, day)
          : t.cashPromisedBody(input.customerName, amount)
        : input.reference
          ? t.paidWithRefBody(input.customerName, amount, method, day, input.reference)
          : t.paidBody(input.customerName, amount, method, day);
    const out: NewNotification[] = [
      {
        audience: 'Admin',
        customerId: input.customerId,
        type: 'PaymentReceived',
        title: input.method === 'Cash' ? t.cashToCollectTitle : t.paymentToConfirmTitle,
        body,
        dateYmd: input.paidOnYmd,
      },
    ];
    const boyId = String(input.deliveryBoyId ?? '').trim();
    if (input.method === 'Cash' && boyId) {
      out.push({
        audience: 'DeliveryBoy',
        deliveryBoyId: boyId,
        customerId: input.customerId,
        type: 'PaymentReceived',
        title: t.collectCashTitle(input.customerName),
        body: t.collectCashBody(input.customerName, amount),
        dateYmd: input.paidOnYmd,
      });
    }
    return out;
  });
  raise(rows, `payreq:${input.requestId}`);
}

/** The dairy could not match the customer's payment. */
export function notifyPaymentRejected(input: { customerId: string; amount: number; reason: string; requestId: string }): void {
  raise(
    [
      oneInEveryLanguage((lang): NewNotification => {
        const t = words(lang);
        return {
          audience: 'Customer',
          customerId: input.customerId,
          type: 'PaymentPending',
          title: t.paymentNotConfirmedTitle,
          body: t.paymentRejectedBody(formatMoney(input.amount), input.reason),
        };
      }),
    ],
    `payreq:${input.requestId}`,
  );
}

/** The subject of the one notification a customer gets about an offer. */
export function offerNotificationSubject(offerId: string, customerId: string): string {
  return `offer:${offerId}:${customerId}`;
}

/**
 * A dairy offer the customer can use now. Each customer hears about each offer once, ever: an offer they already
 * have a notification for (read or not, however long ago) is not raised again.
 *
 * Resolves true when a notification was written. Never rejects — callers fire and forget.
 */
export async function notifyOfferAvailable(input: {
  customerId: string;
  offer: Pick<Offer, 'id' | 'title' | 'endYmd'>;
}): Promise<boolean> {
  const customerId = String(input.customerId ?? '').trim();
  if (!customerId || !input.offer?.id) return false;
  const subjectKey = offerNotificationSubject(input.offer.id, customerId);
  try {
    const existing = await services.notifications.list();
    if (existing.some((n) => n.audience === 'Customer' && n.customerId === customerId && n.subjectKey === subjectKey)) {
      return false;
    }
    // Two calls racing past the look-up still end as one row: a recent row on the same subject is replaced.
    await services.notifications.add([
      {
        ...oneInEveryLanguage((lang): NewNotification => {
          const t = words(lang);
          const o = strings('offers', lang);
          const title =
            (lang === 'en' ? '' : String(input.offer.title?.[lang] ?? '').trim()) || String(input.offer.title?.en ?? '').trim();
          const validity = input.offer.endYmd ? o.validTill(formatDay(input.offer.endYmd, { lang })) : o.untilEnded;
          return {
            audience: 'Customer',
            customerId,
            type: 'Offer',
            title: t.offerTitle,
            body: t.offerBody(title, validity),
            link: '/(customer)/offers',
          };
        }),
        subjectKey,
      },
    ]);
    return true;
  } catch {
    return false;
  }
}
