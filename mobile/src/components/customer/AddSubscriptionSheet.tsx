import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import {
  nextOrderableDayYmd,
  subscribeToProduct,
  SubscriptionDateError,
  validateSubscriptionDates,
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
import { ChosenProduct, PackOptions, ProductList } from '@/src/components/customer/ProductPickers';
import { overlappingSubscription } from '@/src/components/customer/productPicking';
import { dayEditabilityForCustomer, MAX_DAY_QUANTITY } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse, UpdateCustomerRequest } from '@/src/domain/customers/dtos';
import { notifySubscriptionStarted } from '@/src/domain/notifications/events';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductPack } from '@/src/domain/products/entities';
import { orderablePacks, packPrice } from '@/src/domain/products/packs';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * Adding a subscription from My subscription: choose the product, its pack and how many a day, then the days it
 * runs — from a start date until a chosen last day, or until the customer stops it.
 */
export function AddSubscriptionSheet({
  visible,
  customer,
  products,
  initialProductId,
  saving,
  onSave,
  onClose,
  onDone,
}: {
  visible: boolean;
  customer: CustomerResponse;
  /** Products the customer may subscribe to. */
  products: readonly ProductResponse[];
  /** Opens straight on this product (e.g. "Subscribe again"). */
  initialProductId?: string;
  saving: boolean;
  onSave: (patch: UpdateCustomerRequest) => Promise<void>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useStrings('customer').addSubscription;
  const firstDay = nextOrderableDayYmd(customer);
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [pack, setPack] = useState<ProductPack | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [startYmd, setStartYmd] = useState(firstDay);
  const [ends, setEnds] = useState<'open' | 'until'>('open');
  const [endYmd, setEndYmd] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A fresh form every time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const initial = initialProductId ? products.find((p) => p.id === initialProductId) ?? null : null;
    choose(initial);
    setQuantity(1);
    setStartYmd(nextOrderableDayYmd(customer));
    setEnds('open');
    setEndYmd('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialProductId]);

  function choose(next: ProductResponse | null) {
    setProduct(next);
    setPack(next ? orderablePacks(next)[0] ?? null : null);
    setError(null);
  }

  async function save() {
    if (!product || !pack) return;
    setError(null);
    const end = ends === 'until' ? endYmd : undefined;
    try {
      if (ends === 'until' && !endYmd) throw new SubscriptionDateError(t.chooseLastDay);
      validateSubscriptionDates(startYmd, end);
      if (!dayEditabilityForCustomer(customer, startYmd).editable) {
        throw new SubscriptionDateError(t.earliestStart(dayLabel(firstDay, { weekday: true })));
      }
      const clash = overlappingSubscription(customer, product, pack, startYmd, end);
      if (clash) {
        throw new SubscriptionDateError(t.alreadyGet(`${product.name} · ${pack.label}`));
      }

      const { subscriptionPlans } = subscribeToProduct(customer, {
        product,
        pack,
        numberOfItems: quantity,
        startYmd,
        endYmd: end,
      });
      await onSave({ subscriptionPlans });
      const itemLabel = `${product.name} · ${pack.label}${quantity > 1 ? ` × ${quantity}` : ''}`;
      notifySubscriptionStarted({
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        itemLabel: t.itemDaily(itemLabel),
        startYmd,
      });
      onDone(
        end
          ? t.doneRange(itemLabel, dayLabel(startYmd), dayLabel(end))
          : t.doneFrom(itemLabel, dayLabel(startYmd, { weekday: true })),
      );
    } catch (err) {
      setError(err instanceof SubscriptionDateError ? err.message : t.error);
    }
  }

  return (
    <CustomerSheet
      visible={visible}
      title={product ? t.titleDetails : t.titleAdd}
      subtitle={product ? undefined : t.subtitle}
      onClose={onClose}
    >
      {!product ? (
        <ProductList products={products} onPick={choose} emptyText={t.empty} />
      ) : (
        <>
          <ChosenProduct product={product} onChange={initialProductId ? undefined : () => choose(null)} />
          <PackOptions product={product} value={pack} onChange={setPack} />
          <CustomerStepper label={t.howManyEveryDay} value={quantity} onChange={setQuantity} min={1} max={MAX_DAY_QUANTITY} />
          <CustomerDateField label={t.startDate} fieldName="add-sub-start" value={startYmd} onChange={setStartYmd} />
          <CustomerChoiceChips
            label={t.ends}
            options={[
              { key: 'open', label: t.untilIStop },
              { key: 'until', label: t.onADate },
            ]}
            value={ends}
            onChange={setEnds}
          />
          {ends === 'until' ? (
            <CustomerDateField label={t.lastDay} fieldName="add-sub-end" value={endYmd} onChange={setEndYmd} />
          ) : null}
          {pack ? <Text style={styles.total}>{t.perDay(money(packPrice(pack) * quantity))}</Text> : null}
          <Text style={styles.note}>{t.note}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <CustomerPrimaryButton label={t.start} icon="check" onPress={() => void save()} busy={saving} disabled={!pack} />
        </>
      )}
    </CustomerSheet>
  );
}

const styles = StyleSheet.create({
  total: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.blue },
  note: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: amraleColors.textMuted },
  error: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.error },
});
