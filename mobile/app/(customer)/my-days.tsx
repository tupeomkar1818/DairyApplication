import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { monthLabel, shiftMonth } from '@/src/components/admin/customerSubscriptionMonthUtils';
import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import {
  cancelAddOnOrder,
  DayLockedError,
  setPlanQuantityForDays,
  skipDays,
  unskipDay,
} from '@/src/components/customer/customerActions';
import {
  CustomerCard,
  CustomerLoading,
  CustomerNotLinked,
  CustomerScreen,
  CustomerStateBlock,
  dayLabel,
  money,
  useCustomerLayout,
} from '@/src/components/customer/customerUi';
import { buildMyDayRows, type MyDayLine, type MyDayRow, type MyDayState } from '@/src/components/customer/myDays';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { addOnLabel } from '@/src/domain/customers/addOns';
import { MAX_DAY_QUANTITY, orderCutoffLabel } from '@/src/domain/customers/daySchedule';
import {
  notifyDayResumed,
  notifyDaysSkipped,
  notifyOrderCancelled,
  notifyQuantityChanged,
} from '@/src/domain/notifications/events';
import { AddOnSheet } from '@/src/components/customer/AddOnSheet';
import { addOnProducts } from '@/src/components/customer/productPicking';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useNow } from '@/src/hooks/useNow';
import { ContactDairyNote } from '@/src/components/customer/ContactDairyNote';
import { useProducts } from '@/src/hooks/products';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';
import { offerText } from '@/src/domain/offers/offers';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

const GAP = 12;
const MIN_CARD = 300;

export default function CustomerMyDaysScreen() {
  const t = useStrings('customer').myDays;
  const shell = useStrings('customer').shell;
  const c = useStrings('common');
  const { customer, isLoading, isError, refetch, save, isSaving } = useMyCustomer();
  const { isWide } = useCustomerLayout();
  const { width, contentMaxWidth } = useResponsiveLayout();

  // Ticks while open, so a day closes at 9 pm on screen without reopening it.
  const now = useNow();
  const today = todayYmd(now);
  // Opened at a month by a link (e.g. a notification about a day); My days can show months ahead too.
  const params = useLocalSearchParams<{ month?: string }>();
  const [month, setMonth] = useState<string>(() =>
    /^\d{4}-\d{2}$/.test(params.month ?? '') ? (params.month as string) : today.slice(0, 7),
  );
  const [error, setError] = useState<string | null>(null);
  /** The day a refused change was for, when the cut-off refused it — the dairy can still change that day. */
  const [lockedDay, setLockedDay] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** The day the add-a-product sheet is open for. */
  const [addDay, setAddDay] = useState<string | null>(null);
  const products = useProducts();

  // Rows carry wording (why a day is locked), so they are rebuilt when the language (`t`) changes.
  const rows = useMemo(
    () => (customer ? buildMyDayRows(customer, month, today, now) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` stands in for the language
    [customer, month, today, now, t],
  );

  const inner = Math.max(0, Math.min(width, isWide ? contentMaxWidth : 720) - 32);
  const columns = isWide ? Math.max(1, Math.min(3, Math.floor((inner + GAP) / (MIN_CARD + GAP)))) : 1;
  const cardWidth = Math.floor((inner - GAP * (columns - 1)) / columns);

  function failed(err: unknown, fallback: string, ymd?: string) {
    setError(err instanceof DayLockedError ? err.message : fallback);
    setLockedDay(err instanceof DayLockedError && err.contactAdmin ? (ymd ?? null) : null);
  }

  async function onSkipDay(row: MyDayRow) {
    if (!customer) return;
    setError(null);
    try {
      const { subscriptionExceptions } = skipDays(customer, { fromYmd: row.ymd });
      await save({ subscriptionExceptions });
      notifyDaysSkipped({
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        fromYmd: row.ymd,
        toYmd: row.ymd,
      });
    } catch (err) {
      failed(err, t.errors.day, row.ymd);
    }
  }

  async function onUnskipDay(row: MyDayRow) {
    if (!customer || !row.wholeDaySkipId) return;
    setError(null);
    try {
      const { subscriptionExceptions } = unskipDay(customer, row.wholeDaySkipId);
      await save({ subscriptionExceptions });
      notifyDayResumed({
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        fromYmd: row.ymd,
        toYmd: row.ymd,
      });
    } catch (err) {
      failed(err, t.errors.day, row.ymd);
    }
  }

  async function onQuantity(row: MyDayRow, line: MyDayLine, next: number) {
    if (!customer) return;
    setError(null);
    try {
      const { subscriptionExceptions } = setPlanQuantityForDays(customer, {
        planId: line.planId,
        fromYmd: row.ymd,
        numberOfItems: next,
      });
      await save({ subscriptionExceptions });
      notifyQuantityChanged({
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        itemLabel: [line.productName, line.packLabel].filter(Boolean).join(' · '),
        fromYmd: row.ymd,
        toYmd: row.ymd,
        numberOfItems: next,
        usual: line.usual,
      });
    } catch (err) {
      failed(err, t.errors.quantity, row.ymd);
    }
  }

  async function onCancelOrder(row: MyDayRow, orderId: string) {
    if (!customer) return;
    setError(null);
    try {
      const { extraOrders, order } = cancelAddOnOrder(customer, orderId);
      await save({ extraOrders });
      if (order) {
        notifyOrderCancelled({
          customerId: customer.id,
          customerName: customer.name,
          deliveryBoyId: customer.assignedDeliveryBoyId,
          itemLabel: addOnLabel(order),
          dateYmd: row.ymd,
          extraOrders,
        });
      }
    } catch (err) {
      failed(err, t.errors.cancel, row.ymd);
    }
  }

  return (
    <CustomerScreen title={t.title}>
      <PeriodStepper
        label={monthLabel(month)}
        hint={month === today.slice(0, 7) ? c.dates.thisMonth : undefined}
        onPrev={() => setMonth(shiftMonth(month, -1))}
        onNext={() => setMonth(shiftMonth(month, 1))}
        prevLabel={t.prevMonth}
        nextLabel={t.nextMonth}
      />

      <Text style={styles.note}>{t.note(orderCutoffLabel())}</Text>

      {message ? (
        <Text style={styles.success} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      {error && lockedDay ? (
        <ContactDairyNote dayYmd={lockedDay} message={error} />
      ) : error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {isLoading ? (
        <CustomerLoading />
      ) : isError ? (
        <CustomerStateBlock icon="cloud-alert-outline" title={t.loadError} actionLabel={shell.retry} onAction={refetch} />
      ) : !customer ? (
        <CustomerNotLinked />
      ) : rows.length === 0 ? (
        <CustomerStateBlock icon="calendar-blank-outline" title={t.emptyMonth} />
      ) : (
        <View style={[styles.grid, columns > 1 && styles.gridWide]}>
          {rows.map((row) => (
            <DayCard
              key={row.ymd}
              row={row}
              width={columns > 1 ? cardWidth : undefined}
              busy={isSaving}
              onSkipDay={() => void onSkipDay(row)}
              onUnskipDay={() => void onUnskipDay(row)}
              onQuantity={(line, next) => void onQuantity(row, line, next)}
              onCancelOrder={(orderId) => void onCancelOrder(row, orderId)}
              onAddProduct={() => {
                setError(null);
                setMessage(null);
                setAddDay(row.ymd);
              }}
            />
          ))}
        </View>
      )}

      {customer ? (
        <AddOnSheet
          visible={!!addDay}
          customer={customer}
          products={addOnProducts(products.data?.items ?? [])}
          dayYmd={addDay ?? today}
          saving={isSaving}
          onSave={save}
          onClose={() => setAddDay(null)}
          onDone={(text) => {
            setAddDay(null);
            setMessage(text);
          }}
        />
      ) : null}
    </CustomerScreen>
  );
}

function DayCard({
  row,
  width,
  busy,
  onSkipDay,
  onUnskipDay,
  onQuantity,
  onCancelOrder,
  onAddProduct,
}: {
  row: MyDayRow;
  width?: number;
  busy: boolean;
  onSkipDay: () => void;
  onUnskipDay: () => void;
  onQuantity: (line: MyDayLine, next: number) => void;
  onCancelOrder: (orderId: string) => void;
  onAddProduct: () => void;
}) {
  const t = useStrings('customer').myDays;
  const offerWords = useStrings('offers');
  const lang = useLanguage();
  const done = row.state === 'delivered' || row.state === 'missed';
  // Quantities can be changed on an open day that is not skipped as a whole.
  const canChangeLines = row.editable && !done && !row.wholeDaySkipId;

  return (
    <CustomerCard style={width ? { width } : undefined}>
      <View style={styles.dayTop}>
        <Text style={styles.dayDate}>{dayLabel(row.ymd, { weekday: true })}</Text>
        <Text style={[styles.statePill, stateStyle(row.state)]}>{t.state[row.state]}</Text>
      </View>

      {row.lines.map((line) => (
        <View key={line.planId} style={styles.lineRow}>
          <View style={styles.lineText}>
            <Text style={[styles.lineName, line.quantity === 0 && styles.lineOff]} numberOfLines={2}>
              {[line.productName, line.packLabel].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.lineHint}>
              {row.wholeDaySkipId
                ? t.skippedThisDay
                : line.changed
                  ? t.usually(line.usual, money(line.unitPrice))
                  : t.each(money(line.unitPrice))}
            </Text>
          </View>

          {canChangeLines ? (
            <View style={styles.stepper}>
              <Pressable
                onPress={() => onQuantity(line, line.quantity - 1)}
                disabled={busy || line.quantity <= 0}
                hitSlop={4}
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed, (busy || line.quantity <= 0) && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel={t.oneLess(line.productName, dayLabel(row.ymd))}
              >
                <MaterialCommunityIcons name="minus" size={16} color={amraleColors.text} />
              </Pressable>
              <Text style={[styles.stepValue, line.changed && styles.stepValueChanged]}>{line.quantity}</Text>
              <Pressable
                onPress={() => onQuantity(line, line.quantity + 1)}
                disabled={busy || line.quantity >= MAX_DAY_QUANTITY}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && styles.pressed,
                  (busy || line.quantity >= MAX_DAY_QUANTITY) && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t.oneMore(line.productName, dayLabel(row.ymd))}
              >
                <MaterialCommunityIcons name="plus" size={16} color={amraleColors.text} />
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.qtyStatic, line.quantity === 0 && styles.lineOff]}>{`× ${line.quantity}`}</Text>
          )}
        </View>
      ))}

      {row.addOns.map((o) => (
        <View key={o.id} style={styles.addOnRow}>
          <MaterialCommunityIcons name="basket-plus-outline" size={14} color={amraleColors.textSubtle} />
          <Text style={styles.addOnText} numberOfLines={3}>
            {addOnLabel(o, lang)}
          </Text>
          {o.offer ? <Text style={styles.offerTag}>{offerWords.offer}</Text> : null}
          {row.editable && o.status === 'Pending' ? (
            <Pressable
              onPress={() => onCancelOrder(o.id)}
              disabled={busy}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t.cancelA11y(
                o.comboItems?.length ? offerText(o.offer?.title, lang) || o.productName : o.productName,
                dayLabel(row.ymd),
              )}
            >
              <Text style={styles.cancelText}>{t.cancel}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {row.state === 'nothing' ? <Text style={styles.lineHint}>{t.nothingPlanned}</Text> : null}

      {row.amount > 0 ? (
        <Text style={styles.amount}>
          {row.state === 'delivered' ? t.amountForDay(money(row.amount)) : t.amountIfDelivered(money(row.amount))}
        </Text>
      ) : null}

      {!done ? (
        <View style={styles.actions}>
          {row.wholeDaySkipId ? (
            <Pressable
              onPress={onUnskipDay}
              disabled={!row.editable || busy}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed, !row.editable && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={t.resumeA11y(dayLabel(row.ymd))}
            >
              <MaterialCommunityIcons name="undo-variant" size={16} color={amraleColors.blue} />
              <Text style={styles.actionText}>{t.deliverAfterAll}</Text>
            </Pressable>
          ) : row.lines.length ? (
            <Pressable
              onPress={onSkipDay}
              disabled={!row.editable || busy}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed, !row.editable && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={t.skipA11y(dayLabel(row.ymd))}
            >
              <MaterialCommunityIcons name="calendar-remove-outline" size={16} color={amraleColors.blue} />
              <Text style={styles.actionText}>{t.skip}</Text>
            </Pressable>
          ) : null}

          {row.editable ? (
            <Pressable
              onPress={onAddProduct}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.addA11y(dayLabel(row.ymd))}
            >
              <MaterialCommunityIcons name="plus" size={16} color={amraleColors.blue} />
              <Text style={styles.actionText}>{t.addProduct}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {row.lockedReason && !done && row.contactAdmin ? (
        <ContactDairyNote dayYmd={row.ymd} compact />
      ) : row.lockedReason && !done && row.state !== 'nothing' ? (
        <Text style={styles.locked}>{row.lockedReason}</Text>
      ) : null}
    </CustomerCard>
  );
}

function stateStyle(state: MyDayState) {
  switch (state) {
    case 'delivered':
      return styles.stateGreen;
    case 'missed':
      return styles.stateRed;
    case 'planned':
      return styles.stateBlue;
    case 'extras':
      return styles.stateAmber;
    default:
      return styles.stateGray;
  }
}

const styles = StyleSheet.create({
  note: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: amraleColors.textSubtle,
  },
  error: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.error },
  success: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: '#15803D' },

  grid: { gap: GAP },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },

  dayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dayDate: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  statePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 12,
  },
  stateGreen: { backgroundColor: 'rgba(22, 163, 74, 0.12)', color: '#15803D' },
  stateRed: { backgroundColor: 'rgba(220, 38, 38, 0.12)', color: '#B91C1C' },
  stateBlue: { backgroundColor: 'rgba(37, 99, 235, 0.12)', color: amraleColors.blue },
  stateAmber: { backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#B45309' },
  stateGray: { backgroundColor: 'rgba(100, 116, 139, 0.12)', color: amraleColors.textMuted },

  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  lineText: { flex: 1, minWidth: 0 },
  lineName: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  lineOff: { color: amraleColors.textSubtle, textDecorationLine: 'line-through' },
  lineHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },
  qtyStatic: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.text },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: amraleRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  stepValue: {
    minWidth: 24,
    textAlign: 'center',
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.text,
  },
  stepValueChanged: { color: amraleColors.blue },

  addOnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addOnText: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  offerTag: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    color: '#a3246b',
    backgroundColor: '#fbe3f0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
  },
  cancelText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.error },
  amount: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  actionText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue },
  locked: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
});
