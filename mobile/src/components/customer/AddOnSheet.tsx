import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DayLockedError, placeAddOnOrder, setAddOnItems } from '@/src/components/customer/customerActions';
import { findPendingOfferOrder } from '@/src/components/customer/offers/offerCards';
import {
  CustomerPrimaryButton,
  CustomerSheet,
  CustomerStepper,
  dayLabel,
  money,
} from '@/src/components/customer/customerUi';
import { ChosenProduct, PackOptions, ProductList } from '@/src/components/customer/ProductPickers';
import { addOnItemCount } from '@/src/domain/customers/addOns';
import { MAX_DAY_QUANTITY } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse, UpdateCustomerRequest } from '@/src/domain/customers/dtos';
import { notifyOrderPlaced } from '@/src/domain/notifications/events';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductPack } from '@/src/domain/products/entities';
import { orderablePacks, packPrice } from '@/src/domain/products/packs';
import { offerText, priceOfferForPack } from '@/src/domain/offers/offers';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';
import { ContactDairyNote } from '@/src/components/customer/ContactDairyNote';

/**
 * Adding a one-off product to a day from My days: choose the product, its pack and how many — it comes with that
 * day's delivery and is billed once delivered. Adding the same pack again for the same day adds to that order.
 */
export function AddOnSheet({
  visible,
  customer,
  products,
  dayYmd,
  saving,
  onSave,
  onClose,
  onDone,
}: {
  visible: boolean;
  customer: CustomerResponse;
  products: readonly ProductResponse[];
  dayYmd: string;
  saving: boolean;
  onSave: (patch: UpdateCustomerRequest) => Promise<void>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useStrings('customer').addOn;
  const offerWords = useStrings('offers');
  const lang = useLanguage();
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [pack, setPack] = useState<ProductPack | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    choose(null);
    setQuantity(1);
    setError(null);
  }, [visible, dayYmd]);

  function choose(next: ProductResponse | null) {
    setProduct(next);
    setPack(next ? orderablePacks(next)[0] ?? null : null);
    setError(null);
  }

  const [lockedByCutoff, setLockedByCutoff] = useState(false);
  const offers = useOffers();

  /** The best offer price this customer has on a pack for the day, when it is below the pack's price. */
  function dealFor(p: ProductResponse, pk: ProductPack) {
    const deal = priceOfferForPack(offers.all, customer, { packId: pk.id, productName: p.name, packLabel: pk.label }, dayYmd);
    return deal && deal.item.offerPrice < packPrice(pk) ? deal : null;
  }

  const deal = product && pack ? dealFor(product, pack) : null;
  const unitPrice = pack ? (deal ? Math.round(deal.item.offerPrice) : packPrice(pack)) : 0;
  // Only an order at the same price (same offer, or none) is added to; another price stays a line of its own.
  const existing =
    product && pack
      ? findPendingOfferOrder(customer, dayYmd, {
          offerId: deal?.offer.id ?? null,
          packId: pack.id,
          productName: product.name,
          packLabel: pack.label,
        })
      : null;

  async function save() {
    if (!product || !pack) return;
    setError(null);
    try {
      const { extraOrders } = existing
        ? setAddOnItems(customer, existing.id, addOnItemCount(existing) + quantity)
        : placeAddOnOrder(customer, { product, pack, numberOfItems: quantity, dateYmd: dayYmd, offers: offers.all });
      await onSave({ extraOrders });
      const itemLabel = `${product.name} · ${pack.label}${quantity > 1 ? ` × ${quantity}` : ''}`;
      notifyOrderPlaced({
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        itemLabel,
        dateYmd: dayYmd,
        extraOrders,
      });
      onDone(t.added(itemLabel, dayLabel(dayYmd, { weekday: true })));
    } catch (err) {
      setError(err instanceof DayLockedError ? err.message : t.error);
      setLockedByCutoff(err instanceof DayLockedError && err.contactAdmin);
    }
  }

  return (
    <CustomerSheet
      visible={visible}
      title={product ? t.titleHowMany : t.titleAdd}
      subtitle={t.subtitle(dayLabel(dayYmd, { weekday: true }))}
      onClose={onClose}
    >
      {!product ? (
        <ProductList products={products} onPick={choose} emptyText={t.empty} />
      ) : (
        <>
          <ChosenProduct product={product} onChange={() => choose(null)} />
          <PackOptions
            product={product}
            value={pack}
            onChange={setPack}
            offerPrice={(pk) => {
              const d = dealFor(product, pk);
              return d ? d.item.offerPrice : null;
            }}
          />
          <CustomerStepper label={t.howMany} value={quantity} onChange={setQuantity} min={1} max={MAX_DAY_QUANTITY} />
          {existing ? (
            <Text style={styles.note}>{t.alreadyOrdered(addOnItemCount(existing))}</Text>
          ) : null}
          {pack ? (
            <View style={styles.totalRow}>
              <Text style={styles.total}>{money(unitPrice * quantity)}</Text>
              {deal ? (
                <Text style={styles.saveTag}>{offerWords.save(money((packPrice(pack) - unitPrice) * quantity))}</Text>
              ) : null}
            </View>
          ) : null}
          {deal ? (
            <Text style={styles.note}>{offerWords.billLine(offerText(deal.offer.title, lang))}</Text>
          ) : null}
          {error && lockedByCutoff ? (
            <ContactDairyNote dayYmd={dayYmd} message={error} onBeforeNavigate={onClose} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}
          <CustomerPrimaryButton
            label={t.addFor(dayLabel(dayYmd))}
            icon="basket-plus-outline"
            onPress={() => void save()}
            busy={saving}
            disabled={!pack}
          />
        </>
      )}
    </CustomerSheet>
  );
}

const styles = StyleSheet.create({
  totalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  total: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.blue },
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
  note: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: amraleColors.textMuted },
  error: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.error },
});
