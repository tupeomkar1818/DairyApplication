import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ContactDairyNote } from '@/src/components/customer/ContactDairyNote';
import {
  DayLockedError,
  OfferNotAvailableError,
  placeAddOnOrder,
  placeComboOrder,
  setAddOnItems,
} from '@/src/components/customer/customerActions';
import {
  CustomerChoiceChips,
  CustomerDateField,
  CustomerPrimaryButton,
  CustomerSheet,
  CustomerStepper,
  dayLabel,
  money,
} from '@/src/components/customer/customerUi';
import { findPendingOfferOrder, offerOrderDays } from '@/src/components/customer/offers/offerCards';
import { addOnItemCount, addOnLabel } from '@/src/domain/customers/addOns';
import { MAX_DAY_QUANTITY } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse, UpdateCustomerRequest } from '@/src/domain/customers/dtos';
import { notifyOrderPlaced } from '@/src/domain/notifications/events';
import type { Offer, PriceOfferItem } from '@/src/domain/offers/entities';
import { comboListTotal, offerCoversDay, offerText, priceOfferForPack } from '@/src/domain/offers/offers';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductPack } from '@/src/domain/products/entities';
import { packPrice } from '@/src/domain/products/packs';
import { useNow } from '@/src/hooks/useNow';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/** What is being ordered from an offer card: one pack of a price offer, or a combo. */
export type OfferOrderTarget =
  | { kind: 'price'; offer: Offer; item: PriceOfferItem; product: ProductResponse; pack: ProductPack }
  | { kind: 'combo'; offer: Offer };

/**
 * Ordering from an offer: pick one of the days the offer runs on (the first open day is chosen), and how many. The
 * order comes with that day's delivery at the offer price and goes on the monthly bill, like any one-off order.
 */
export function OfferOrderSheet({
  target,
  customer,
  offers,
  saving,
  onSave,
  onClose,
  onDone,
}: {
  target: OfferOrderTarget | null;
  customer: CustomerResponse;
  offers: readonly Offer[];
  saving: boolean;
  onSave: (patch: UpdateCustomerRequest) => Promise<void>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useStrings('offerCustomer').order;
  const o = useStrings('offers');
  const lang = useLanguage();
  const now = useNow();
  const offer = target?.offer ?? null;

  const days = useMemo(() => (customer && offer ? offerOrderDays(customer, offer, now) : []), [customer, offer, now]);
  const [dayYmd, setDayYmd] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [lockedByCutoff, setLockedByCutoff] = useState(false);

  // Every opening starts on the first open day, one pack or combo.
  const firstDay = days[0] ?? '';
  useEffect(() => {
    if (!target) return;
    setDayYmd(firstDay);
    setQuantity(1);
    setError(null);
    setLockedByCutoff(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new order starts, not on every clock tick
  }, [target]);

  // The shown day closed while the sheet was open (9 pm): move to the next open one.
  useEffect(() => {
    if (target && dayYmd && firstDay && dayYmd < firstDay) setDayYmd(firstDay);
  }, [target, dayYmd, firstDay]);

  const pricing = useMemo(() => {
    if (!target || !dayYmd) return null;
    if (target.kind === 'combo') {
      const price = Math.round(Number(target.offer.comboPrice) || 0);
      return { unit: price, list: comboListTotal(target.offer) };
    }
    const list = packPrice(target.pack);
    const deal = priceOfferForPack(
      offers,
      customer,
      { packId: target.pack.id, productName: target.product.name, packLabel: target.pack.label },
      dayYmd,
    );
    const unit = deal && deal.item.offerPrice < list ? Math.round(deal.item.offerPrice) : list;
    return { unit, list, offerId: deal && deal.item.offerPrice < list ? deal.offer.id : null };
  }, [customer, dayYmd, offers, target]);

  if (!target || !offer) return null;

  const title = offerText(offer.title, lang);
  const lastShown = days[days.length - 1];
  const moreDays = !!lastShown && (!offer.endYmd || offer.endYmd > lastShown);
  const dayOptions = [...days, ...(dayYmd && !days.includes(dayYmd) ? [dayYmd] : [])]
    .sort()
    .map((ymd) => ({ key: ymd, label: dayLabel(ymd, { weekday: true }) }));

  function pickOtherDay(ymd: string) {
    if (!ymd || !offer) return;
    if (!offerCoversDay(offer, ymd)) {
      setError(t.dayNotCovered);
      setLockedByCutoff(false);
      return;
    }
    setError(null);
    setDayYmd(ymd);
  }

  async function save() {
    if (!target || !dayYmd) return;
    setError(null);
    setLockedByCutoff(false);
    try {
      let extraOrders: NonNullable<CustomerResponse['extraOrders']>;
      let itemLabel: string;
      if (target.kind === 'combo') {
        // Placing checks the combo still runs that day and the day is open, even when it is then added to an order.
        const placed = placeComboOrder(customer, { offer: target.offer, numberOfItems: quantity, dateYmd: dayYmd });
        const existing = findPendingOfferOrder(customer, dayYmd, { offerId: target.offer.id, comboOfferId: target.offer.id });
        extraOrders = existing
          ? setAddOnItems(customer, existing.id, addOnItemCount(existing) + quantity).extraOrders
          : placed.extraOrders;
        itemLabel = addOnLabel(placed.order);
      } else {
        if (!offerCoversDay(target.offer, dayYmd) || target.offer.endedAt) throw new OfferNotAvailableError();
        const existing = findPendingOfferOrder(customer, dayYmd, {
          offerId: pricing && 'offerId' in pricing ? (pricing.offerId ?? null) : null,
          packId: target.pack.id,
          productName: target.product.name,
          packLabel: target.pack.label,
        });
        extraOrders = existing
          ? setAddOnItems(customer, existing.id, addOnItemCount(existing) + quantity).extraOrders
          : placeAddOnOrder(customer, {
              product: target.product,
              pack: target.pack,
              numberOfItems: quantity,
              dateYmd: dayYmd,
              offers,
            }).extraOrders;
        itemLabel = `${target.product.name} · ${target.pack.label}${quantity > 1 ? ` × ${quantity}` : ''}`;
      }
      await onSave({ extraOrders });
      notifyOrderPlaced({
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        itemLabel,
        dateYmd: dayYmd,
        extraOrders,
      });
      onDone(t.ordered(itemLabel, dayLabel(dayYmd, { weekday: true })));
    } catch (err) {
      if (err instanceof DayLockedError) {
        setError(err.message);
        setLockedByCutoff(err.contactAdmin);
      } else {
        setError(err instanceof OfferNotAvailableError ? o.notAvailable : t.error);
      }
    }
  }

  const what =
    target.kind === 'price'
      ? `${target.product.name} · ${target.pack.label}`
      : (offer.comboItems ?? [])
          .map((i) => `${i.productName} · ${i.packLabel}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`)
          .join(', ');
  const saveEach = pricing ? Math.max(0, pricing.list - pricing.unit) : 0;

  return (
    <CustomerSheet visible title={title} subtitle={t.subtitle} onClose={onClose}>
      <View style={styles.what}>
        <Text style={styles.whatText}>{what}</Text>
        {pricing ? (
          <View style={styles.priceRow}>
            {saveEach > 0 ? <Text style={styles.struck}>{money(pricing.list)}</Text> : null}
            <Text style={styles.price}>{t.each(money(pricing.unit))}</Text>
          </View>
        ) : null}
      </View>

      {days.length === 0 && !dayYmd ? (
        <Text style={styles.note}>{t.noDays}</Text>
      ) : (
        <>
          <CustomerChoiceChips label={t.day} options={dayOptions} value={dayYmd} onChange={setDayYmd} />
          {moreDays ? (
            <CustomerDateField
              label={t.anotherDay}
              value={dayYmd && !days.includes(dayYmd) ? dayYmd : ''}
              onChange={pickOtherDay}
              fieldName="offerOrderDay"
            />
          ) : null}
          <CustomerStepper label={t.howMany} value={quantity} onChange={setQuantity} min={1} max={MAX_DAY_QUANTITY} />

          {pricing ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.total}</Text>
              <Text style={styles.total}>{money(pricing.unit * quantity)}</Text>
              {saveEach > 0 ? <Text style={styles.saveTag}>{o.save(money(saveEach * quantity))}</Text> : null}
            </View>
          ) : null}

          {error && lockedByCutoff ? (
            <ContactDairyNote dayYmd={dayYmd} message={error} onBeforeNavigate={onClose} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <CustomerPrimaryButton
            label={dayYmd ? t.orderFor(dayLabel(dayYmd)) : t.day}
            icon="basket-plus-outline"
            onPress={() => void save()}
            busy={saving}
            disabled={!dayYmd}
          />
        </>
      )}
    </CustomerSheet>
  );
}

const styles = StyleSheet.create({
  what: {
    gap: 4,
    padding: 10,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
  },
  whatText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, lineHeight: 20, color: amraleColors.text },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  struck: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    color: amraleColors.textSubtle,
    textDecorationLine: 'line-through',
  },
  price: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.text },
  totalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  totalLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, color: amraleColors.textMuted },
  total: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.blue },
  saveTag: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 12,
    color: '#16623a',
    backgroundColor: '#dcf3e5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
  },
  note: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  error: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.error },
});
