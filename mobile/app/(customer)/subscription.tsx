import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { daysInMonth, shiftMonth } from '@/src/components/admin/customerSubscriptionMonthUtils';
import { shiftYmd, todayYmd } from '@/src/components/admin/dashboardMetrics';
import {
  DayLockedError,
  nextOrderableDayYmd,
  setPlanQuantityForDays,
  skipDays,
  SubscriptionDateError,
} from '@/src/components/customer/customerActions';
import {
  CustomerCard,
  CustomerChoiceChips,
  CustomerDateField,
  CustomerLoading,
  CustomerNotLinked,
  CustomerPrimaryButton,
  CustomerScreen,
  CustomerSecondaryButton,
  CustomerSheet,
  CustomerStateBlock,
  CustomerStepper,
  dayLabel,
  money,
  useCustomerLayout,
} from '@/src/components/customer/customerUi';
import { AddSubscriptionSheet } from '@/src/components/customer/AddSubscriptionSheet';
import { buildMyDayRow } from '@/src/components/customer/myDays';
import { subscribableProducts } from '@/src/components/customer/productPicking';
import {
  buildSubscriptionCards,
  changeDailyQuantity,
  changeEndDate,
  describeDayChange,
  describeDayChangeDates,
  lastArrangedDayYmd,
  removeDayChange,
  stopSubscription,
  type SubscriptionCard,
  type SubscriptionCardStatus,
} from '@/src/components/customer/subscriptionActions';
import { MAX_DAY_QUANTITY } from '@/src/domain/customers/daySchedule';
import { ContactDairyNote } from '@/src/components/customer/ContactDairyNote';
import { useNow } from '@/src/hooks/useNow';
import { notifyDaysSkipped, notifyQuantityChanged, notifySubscriptionEnded } from '@/src/domain/notifications/events';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useProducts } from '@/src/hooks/products';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';
import { formatMonth } from '@/src/utils/format';

type Sheet =
  | { kind: 'daily'; planId: string }
  | { kind: 'days'; planId: string }
  | { kind: 'end'; planId: string }
  | { kind: 'stop'; planId: string }
  | { kind: 'pause' }
  | null;

/** Pause lengths in days; each label is `customer.subscription.pausePresets[key]`, read at render. */
const PAUSE_PRESETS = ['1', '3', '7', '30'] as const;

const STATUS_TONE: Record<SubscriptionCardStatus, { bg: string; fg: string }> = {
  active: { bg: 'rgba(22, 163, 74, 0.12)', fg: '#15803D' },
  starts: { bg: 'rgba(37, 99, 235, 0.12)', fg: amraleColors.blue },
  offToday: { bg: 'rgba(100, 116, 139, 0.14)', fg: amraleColors.textMuted },
  ending: { bg: 'rgba(217, 119, 6, 0.14)', fg: '#B45309' },
  ended: { bg: 'rgba(100, 116, 139, 0.14)', fg: amraleColors.textMuted },
};

function endOfMonth(yyyyMm: string): string {
  return `${yyyyMm}-${String(daysInMonth(yyyyMm)).padStart(2, '0')}`;
}

/** "September" — from the month itself, not by picking apart a formatted date (locales order day and month differently). */
function monthName(yyyyMm: string): string {
  return formatMonth(yyyyMm).split(' ')[0] ?? yyyyMm;
}

export default function CustomerSubscriptionScreen() {
  // `t` changes with the language, so memos that build text list it in their deps.
  const t = useStrings('customer').subscription;
  const shell = useStrings('customer').shell;
  const c = useStrings('common');
  const { customer, isLoading, isError, refetch, save, isSaving } = useMyCustomer();
  const products = useProducts();
  const { isWide } = useCustomerLayout();

  // Ticks while open: at 9 pm tomorrow closes and the first day that can change moves on.
  const now = useNow();
  const today = todayYmd(now);
  const firstOpenDay = useMemo(() => (customer ? nextOrderableDayYmd(customer, now) : shiftYmd(today, 1)), [customer, now, today]);
  const lastArranged = useMemo(() => (customer ? lastArrangedDayYmd(customer, now) : today), [customer, now, today]);
  const tomorrow = shiftYmd(today, 1);
  /** Tomorrow is past its cut-off (not already delivered): only the dairy can change it now. */
  const tomorrowClosed =
    firstOpenDay > tomorrow && !(customer?.deliveries ?? []).some((d) => String(d.deliveryDate ?? '').slice(0, 10) === tomorrow);

  const cards = useMemo(
    () => (customer ? buildSubscriptionCards(customer, today, firstOpenDay) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` stands in for the language of the card labels
    [customer, firstOpenDay, today, t],
  );
  const nextDay = useMemo(() => (customer ? buildMyDayRow(customer, firstOpenDay) : null), [customer, firstOpenDay]);

  const subscribable = useMemo(() => subscribableProducts(products.data?.items ?? []), [products.data?.items]);
  const [addOpen, setAddOpen] = useState(false);
  const [addProductId, setAddProductId] = useState<string | undefined>(undefined);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  /** The last error came from the cut-off, so the dairy is the one to ask. */
  const [errorNeedsDairy, setErrorNeedsDairy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Sheet fields, reset each time a sheet opens.
  const [quantity, setQuantity] = useState(1);
  const [fromYmd, setFromYmd] = useState('');
  const [toYmd, setToYmd] = useState('');
  const [endChoice, setEndChoice] = useState<string>('open');
  const [pickedEnd, setPickedEnd] = useState('');

  const sheetCard = sheet && 'planId' in sheet ? cards.find((c) => c.plan.id === sheet.planId) ?? null : null;

  function openSheet(next: NonNullable<Sheet>, card?: SubscriptionCard) {
    setSheetError(null);
    setMessage(null);
    setPageError(null);
    setQuantity(card?.usual ?? 1);
    setFromYmd(firstOpenDay);
    setToYmd('');
    setEndChoice(card && !card.endYmd ? 'open' : 'pick');
    setPickedEnd(card?.endYmd ?? '');
    setSheet(next);
  }

  function closeWith(text: string) {
    setSheet(null);
    setMessage(text);
  }

  function failed(err: unknown, fallback: string) {
    setSheetError(err instanceof DayLockedError || err instanceof SubscriptionDateError ? err.message : fallback);
    setErrorNeedsDairy(err instanceof DayLockedError && err.contactAdmin);
  }

  async function saveDailyQuantity(card: SubscriptionCard) {
    if (!customer) return;
    try {
      const res = changeDailyQuantity(customer, { planId: card.plan.id, numberOfItems: quantity });
      await save({
        subscriptionPlans: res.subscriptionPlans,
        subscriptionExceptions: res.subscriptionExceptions,
        deliveries: res.deliveries,
      });
      notifyQuantityChanged({
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        itemLabel: card.label,
        fromYmd: res.fromYmd,
        toYmd: card.endYmd ?? res.fromYmd,
        numberOfItems: quantity,
        usual: card.usual,
      });
      closeWith(t.saved.dailyQuantity(card.label, quantity, dayLabel(res.fromYmd, { weekday: true })));
    } catch (err) {
      failed(err, t.errors.quantity);
    }
  }

  async function saveSomeDays(card: SubscriptionCard) {
    if (!customer) return;
    const to = toYmd || fromYmd;
    try {
      if (to < fromYmd) throw new SubscriptionDateError(t.errors.lastBeforeFirst);
      const { subscriptionExceptions } = setPlanQuantityForDays(customer, {
        planId: card.plan.id,
        fromYmd,
        toYmd: to,
        numberOfItems: quantity,
      });
      await save({ subscriptionExceptions });
      notifyQuantityChanged({
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        itemLabel: card.label,
        fromYmd,
        toYmd: to,
        numberOfItems: quantity,
        usual: card.usual,
      });
      const range = fromYmd === to ? dayLabel(fromYmd, { weekday: true }) : `${dayLabel(fromYmd)} – ${dayLabel(to)}`;
      closeWith(quantity === 0 ? t.saved.noneOnDays(card.label, range) : t.saved.someDays(card.label, quantity, range));
    } catch (err) {
      failed(err, t.errors.days);
    }
  }

  function chosenEnd(): string | undefined {
    if (endChoice === 'open') return undefined;
    if (endChoice === 'pick') return pickedEnd;
    return endChoice;
  }

  async function saveEndDate(card: SubscriptionCard) {
    if (!customer) return;
    const end = chosenEnd();
    try {
      if (endChoice === 'pick' && !pickedEnd) throw new SubscriptionDateError(t.errors.chooseLastDay);
      const { subscriptionPlans } = changeEndDate(customer, { planId: card.plan.id, endYmd: end });
      await save({ subscriptionPlans });
      if (end) {
        notifySubscriptionEnded({
          customerId: customer.id,
          customerName: customer.name,
          deliveryBoyId: customer.assignedDeliveryBoyId,
          itemLabel: card.label,
          lastYmd: end,
        });
      }
      closeWith(end ? t.saved.runsUntil(card.label, dayLabel(end, { weekday: true })) : t.saved.runsUntilStopped(card.label));
    } catch (err) {
      failed(err, t.errors.endDate);
    }
  }

  async function confirmStop(card: SubscriptionCard) {
    if (!customer) return;
    try {
      const { subscriptionPlans, lastDayYmd } = stopSubscription(customer, { planId: card.plan.id });
      await save({ subscriptionPlans });
      notifySubscriptionEnded({
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        itemLabel: card.label,
        lastYmd: lastDayYmd ?? todayYmd(),
      });
      closeWith(
        lastDayYmd
          ? t.saved.stopsAfter(card.label, dayLabel(lastDayYmd, { weekday: true }))
          : t.saved.cancelled(card.label),
      );
    } catch (err) {
      failed(err, t.errors.stop);
    }
  }

  async function savePause() {
    if (!customer) return;
    const to = toYmd || fromYmd;
    try {
      if (to < fromYmd) throw new SubscriptionDateError(t.errors.lastBeforeFirst);
      const { subscriptionExceptions } = skipDays(customer, { fromYmd, toYmd: to, reason: 'Paused from the app' });
      await save({ subscriptionExceptions });
      notifyDaysSkipped({
        customerId: customer.id,
        customerName: customer.name,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        fromYmd,
        toYmd: to,
      });
      closeWith(
        fromYmd === to ? t.saved.pausedOn(dayLabel(fromYmd, { weekday: true })) : t.saved.pausedRange(dayLabel(fromYmd), dayLabel(to)),
      );
    } catch (err) {
      failed(err, t.errors.pause);
    }
  }

  async function undoChange(exceptionId: string) {
    if (!customer) return;
    setMessage(null);
    setPageError(null);
    try {
      const { subscriptionExceptions } = removeDayChange(customer, { exceptionId });
      await save({ subscriptionExceptions });
      setMessage(t.saved.undone);
    } catch (err) {
      setPageError(err instanceof DayLockedError ? err.message : t.errors.undo);
      setErrorNeedsDairy(err instanceof DayLockedError && err.contactAdmin);
    }
  }

  function openAddSubscription(productId?: string) {
    setMessage(null);
    setPageError(null);
    setAddProductId(productId);
    setAddOpen(true);
  }

  function subscribeAgain(card: SubscriptionCard) {
    const product = subscribable.find((p) => p.name === card.plan.productName);
    openAddSubscription(product?.id);
  }

  const endPresets = useMemo(() => {
    const month = firstOpenDay.slice(0, 7);
    const words = t.endPresets;
    const options: { key: string; label: string }[] = [{ key: 'open', label: words.noEnd }];
    const thisMonthEnd = endOfMonth(month);
    if (thisMonthEnd >= lastArranged) options.push({ key: thisMonthEnd, label: words.endOf(monthName(month)) });
    const nextMonth = shiftMonth(month, 1);
    options.push({ key: endOfMonth(nextMonth), label: words.endOf(monthName(nextMonth)) });
    options.push({ key: endOfMonth(shiftMonth(month, 3)), label: words.threeMonths });
    options.push({ key: 'pick', label: words.pick });
    return options;
  }, [firstOpenDay, lastArranged, t]);

  const activeCards = cards.filter((c) => c.status !== 'ended');

  return (
    <CustomerScreen title={t.title}>
      {isLoading ? (
        <CustomerLoading />
      ) : isError ? (
        <CustomerStateBlock icon="cloud-alert-outline" title={t.loadError} actionLabel={shell.retry} onAction={refetch} />
      ) : !customer ? (
        <CustomerNotLinked />
      ) : (
        <>
          {message ? (
            <View style={styles.banner}>
              <MaterialCommunityIcons name="check-circle" size={18} color="#15803D" />
              <Text style={styles.bannerText}>{message}</Text>
            </View>
          ) : null}
          {pageError && errorNeedsDairy ? (
            <ContactDairyNote message={pageError} />
          ) : pageError ? (
            <Text style={styles.error}>{pageError}</Text>
          ) : null}

          {activeCards.length && nextDay ? (
            <CustomerCard>
              <View style={styles.nextHead}>
                <View style={styles.nextTitles}>
                  <Text style={styles.nextLabel}>{t.next.label}</Text>
                  <Text style={styles.nextDay}>{dayLabel(firstOpenDay, { weekday: true })}</Text>
                </View>
                <Text style={styles.nextAmount}>{money(nextDay.amount)}</Text>
              </View>
              <Text style={styles.nextItems} numberOfLines={3}>
                {nextDay.lines.filter((l) => l.quantity > 0).length || nextDay.addOns.length
                  ? [
                      ...nextDay.lines.filter((l) => l.quantity > 0).map((l) => `${l.productName} × ${l.quantity}`),
                      ...nextDay.addOns.map((o) => o.productName),
                    ].join(', ')
                  : t.next.nothing}
              </Text>
              <View style={styles.nextActions}>
                <CustomerSecondaryButton
                  label={t.next.planDays}
                  onPress={() => router.push('/(customer)/my-days')}
                  style={styles.flexBtn}
                />
                <CustomerSecondaryButton label={t.next.goingAway} onPress={() => openSheet({ kind: 'pause' })} style={styles.flexBtn} />
              </View>
              {tomorrowClosed ? <ContactDairyNote dayYmd={tomorrow} compact /> : null}
            </CustomerCard>
          ) : null}

          {cards.length === 0 ? (
            <CustomerStateBlock
              icon="cow"
              title={t.empty.title}
              text={t.empty.text}
              actionLabel={t.addSubscription}
              onAction={() => openAddSubscription()}
            />
          ) : (
            <View style={[styles.cardList, isWide && styles.cardListWide]}>
              {cards.map((card) => (
                <SubscriptionProductCard
                  key={card.plan.id}
                  card={card}
                  wide={isWide}
                  busy={isSaving}
                  onDaily={() => openSheet({ kind: 'daily', planId: card.plan.id }, card)}
                  onSomeDays={() => openSheet({ kind: 'days', planId: card.plan.id }, card)}
                  onEndDate={() => openSheet({ kind: 'end', planId: card.plan.id }, card)}
                  onStop={() => openSheet({ kind: 'stop', planId: card.plan.id }, card)}
                  onUndo={(id) => void undoChange(id)}
                  onSubscribeAgain={() => subscribeAgain(card)}
                />
              ))}
            </View>
          )}

          {activeCards.length ? (
            <Pressable
              onPress={() => openAddSubscription()}
              style={({ pressed }) => [styles.addMore, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.addSubscription}
            >
              <MaterialCommunityIcons name="plus" size={18} color={amraleColors.blue} />
              <Text style={styles.addMoreText}>{t.addSubscription}</Text>
            </Pressable>
          ) : null}
        </>
      )}

      {customer ? (
        <AddSubscriptionSheet
          visible={addOpen}
          customer={customer}
          products={subscribable}
          initialProductId={addProductId}
          saving={isSaving}
          onSave={save}
          onClose={() => setAddOpen(false)}
          onDone={(text) => {
            setAddOpen(false);
            setMessage(text);
          }}
        />
      ) : null}

      {/* ── Daily quantity ── */}
      <CustomerSheet
        visible={sheet?.kind === 'daily' && !!sheetCard}
        title={t.daily.title}
        subtitle={sheetCard?.label}
        onClose={() => setSheet(null)}
      >
        {sheetCard ? (
          <>
            <CustomerStepper label={t.daily.stepper(sheetCard.usual)} value={quantity} onChange={setQuantity} min={1} max={MAX_DAY_QUANTITY} />
            <Text style={styles.sheetNote}>{t.daily.note(dayLabel(firstOpenDay, { weekday: true }), sheetCard.usual)}</Text>
            <Text style={styles.sheetTotal}>{t.daily.perDay(money(sheetCard.unitPrice * quantity))}</Text>
            {sheetError && errorNeedsDairy ? (
              <ContactDairyNote message={sheetError} onBeforeNavigate={() => setSheet(null)} />
            ) : sheetError ? (
              <Text style={styles.error}>{sheetError}</Text>
            ) : null}
            <CustomerPrimaryButton
              label={c.actions.save}
              icon="check"
              onPress={() => void saveDailyQuantity(sheetCard)}
              busy={isSaving}
              disabled={quantity === sheetCard.usual}
            />
          </>
        ) : null}
      </CustomerSheet>

      {/* ── Some days ── */}
      <CustomerSheet
        visible={sheet?.kind === 'days' && !!sheetCard}
        title={t.someDays.title}
        subtitle={sheetCard?.label}
        onClose={() => setSheet(null)}
      >
        {sheetCard ? (
          <>
            <CustomerDateField label={t.someDays.firstDay} fieldName="days-from" value={fromYmd} onChange={setFromYmd} />
            <CustomerDateField label={t.someDays.lastDay} fieldName="days-to" value={toYmd} onChange={setToYmd} />
            <CustomerStepper label={t.someDays.stepper(sheetCard.usual)} value={quantity} onChange={setQuantity} min={0} max={MAX_DAY_QUANTITY} />
            <Text style={styles.sheetNote}>{t.someDays.note}</Text>
            {sheetError && errorNeedsDairy ? (
              <ContactDairyNote message={sheetError} onBeforeNavigate={() => setSheet(null)} />
            ) : sheetError ? (
              <Text style={styles.error}>{sheetError}</Text>
            ) : null}
            <CustomerPrimaryButton label={c.actions.save} icon="check" onPress={() => void saveSomeDays(sheetCard)} busy={isSaving} />
          </>
        ) : null}
      </CustomerSheet>

      {/* ── End date ── */}
      <CustomerSheet
        visible={sheet?.kind === 'end' && !!sheetCard}
        title={t.endDate.title}
        subtitle={sheetCard ? `${sheetCard.label} · ${sheetCard.datesLabel}` : undefined}
        onClose={() => setSheet(null)}
      >
        {sheetCard ? (
          <>
            <CustomerChoiceChips label={t.endDate.runsUntil} options={endPresets} value={endChoice} onChange={setEndChoice} />
            {endChoice === 'pick' ? (
              <CustomerDateField label={t.endDate.lastDay} fieldName="end-date" value={pickedEnd} onChange={setPickedEnd} />
            ) : null}
            {sheetError && errorNeedsDairy ? (
              <ContactDairyNote message={sheetError} onBeforeNavigate={() => setSheet(null)} />
            ) : sheetError ? (
              <Text style={styles.error}>{sheetError}</Text>
            ) : null}
            <CustomerPrimaryButton label={c.actions.save} icon="check" onPress={() => void saveEndDate(sheetCard)} busy={isSaving} />
          </>
        ) : null}
      </CustomerSheet>

      {/* ── Stop ── */}
      <CustomerSheet
        visible={sheet?.kind === 'stop' && !!sheetCard}
        title={sheetCard ? t.stop.title(String(sheetCard.plan.productName ?? '')) : t.stop.titleFallback}
        subtitle={sheetCard?.label}
        onClose={() => setSheet(null)}
      >
        {sheetCard ? (
          <>
            <Text style={styles.sheetText}>
              {sheetCard.startYmd > lastArranged
                ? t.stop.notStarted
                : t.stop.arranged(dayLabel(lastArranged, { weekday: true }))}
            </Text>
            <Text style={styles.sheetNote}>{t.stop.hint}</Text>
            {sheetError && errorNeedsDairy ? (
              <ContactDairyNote message={sheetError} onBeforeNavigate={() => setSheet(null)} />
            ) : sheetError ? (
              <Text style={styles.error}>{sheetError}</Text>
            ) : null}
            <View style={styles.sheetButtons}>
              <CustomerSecondaryButton label={t.stop.keep} onPress={() => setSheet(null)} style={styles.flexBtn} />
              <CustomerSecondaryButton
                label={t.stop.stop}
                tone="danger"
                onPress={() => void confirmStop(sheetCard)}
                disabled={isSaving}
                style={styles.flexBtn}
              />
            </View>
          </>
        ) : null}
      </CustomerSheet>

      {/* ── Going away ── */}
      <CustomerSheet
        visible={sheet?.kind === 'pause'}
        title={t.pause.title}
        subtitle={t.pause.subtitle}
        onClose={() => setSheet(null)}
      >
        <CustomerDateField label={t.pause.firstDay} fieldName="pause-from" value={fromYmd} onChange={setFromYmd} />
        <CustomerChoiceChips
          label={t.pause.for}
          options={PAUSE_PRESETS.map((key) => ({ key, label: t.pausePresets[key] }))}
          value={PAUSE_PRESETS.find((key) => shiftYmd(fromYmd, Number(key) - 1) === (toYmd || fromYmd)) ?? ''}
          onChange={(days) => setToYmd(shiftYmd(fromYmd, Number(days) - 1))}
        />
        <CustomerDateField label={t.pause.lastDay} fieldName="pause-to" value={toYmd} onChange={setToYmd} />
        <Text style={styles.sheetNote}>{t.pause.note}</Text>
        {sheetError && errorNeedsDairy ? (
              <ContactDairyNote message={sheetError} onBeforeNavigate={() => setSheet(null)} />
            ) : sheetError ? (
              <Text style={styles.error}>{sheetError}</Text>
            ) : null}
        <CustomerPrimaryButton
          label={toYmd && toYmd !== fromYmd ? t.pause.buttonRange(dayLabel(fromYmd), dayLabel(toYmd)) : t.pause.button(dayLabel(fromYmd))}
          icon="pause"
          onPress={() => void savePause()}
          busy={isSaving}
        />
      </CustomerSheet>
    </CustomerScreen>
  );
}

function SubscriptionProductCard({
  card,
  wide,
  busy,
  onDaily,
  onSomeDays,
  onEndDate,
  onStop,
  onUndo,
  onSubscribeAgain,
}: {
  card: SubscriptionCard;
  wide: boolean;
  busy: boolean;
  onDaily: () => void;
  onSomeDays: () => void;
  onEndDate: () => void;
  onStop: () => void;
  onUndo: (exceptionId: string) => void;
  onSubscribeAgain: () => void;
}) {
  const t = useStrings('customer').subscription.card;
  const tone = STATUS_TONE[card.status];
  const ended = card.status === 'ended';
  const shown = card.upcoming.slice(0, 3);
  const more = card.upcoming.length - shown.length;

  return (
    <CustomerCard style={[wide && styles.cardHalf, ended && styles.cardEnded]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {card.label}
        </Text>
        <Text style={[styles.statusPill, { backgroundColor: tone.bg, color: tone.fg }]}>{card.statusLabel}</Text>
      </View>

      <Text style={styles.cardPrice}>
        {t.perDay(card.usual, money(card.unitPrice))}
        <Text style={styles.cardPriceStrong}>{t.dailyValue(money(card.dailyValue))}</Text>
      </Text>
      <View style={styles.datesRow}>
        <MaterialCommunityIcons name="calendar-range" size={15} color={amraleColors.textSubtle} />
        <Text style={styles.datesText}>{card.datesLabel}</Text>
      </View>

      {card.status === 'ending' ? (
        <Pressable onPress={onEndDate} style={({ pressed }) => [styles.endingBanner, pressed && styles.pressed]} accessibilityRole="button">
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#B45309" />
          <Text style={styles.endingText}>{t.ending}</Text>
        </Pressable>
      ) : null}

      {shown.length ? (
        <View style={styles.changes}>
          <Text style={styles.changesTitle}>{t.comingUp}</Text>
          {shown.map((ex) => (
            <View key={ex.id} style={styles.changeRow}>
              <Text style={styles.changeDates}>{describeDayChangeDates(ex)}</Text>
              <Text style={styles.changeWhat} numberOfLines={1}>
                {describeDayChange(ex, card.usual)}
              </Text>
              <Pressable
                onPress={() => onUndo(ex.id)}
                disabled={busy}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t.undoA11y(describeDayChange(ex, card.usual), describeDayChangeDates(ex))}
              >
                <Text style={styles.undoText}>{t.undo}</Text>
              </Pressable>
            </View>
          ))}
          {more > 0 ? <Text style={styles.changeMore}>{t.more(more)}</Text> : null}
        </View>
      ) : null}

      {ended ? (
        <CustomerPrimaryButton label={t.subscribeAgain} icon="refresh" onPress={onSubscribeAgain} />
      ) : (
        <View style={styles.actionGrid}>
          <ActionTile icon="numeric" label={t.actions.daily} onPress={onDaily} />
          <ActionTile icon="calendar-edit" label={t.actions.someDays} onPress={onSomeDays} />
          <ActionTile icon="calendar-end" label={t.actions.endDate} onPress={onEndDate} />
          <ActionTile icon="stop-circle-outline" label={t.actions.stop} onPress={onStop} danger />
        </View>
      )}
    </CustomerCard>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? amraleColors.error : amraleColors.blue;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name={icon} size={18} color={color} />
      <Text style={[styles.actionTileText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
  },
  bannerText: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: '#15803D' },
  error: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.error },

  nextHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nextTitles: { flex: 1, minWidth: 0 },
  nextLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  nextDay: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 17, color: amraleColors.text },
  nextAmount: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 17, color: amraleColors.blue },
  nextItems: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: amraleColors.textMuted },
  nextActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  flexBtn: { flexGrow: 1, flexBasis: 140, minHeight: 44 },

  cardList: { gap: 12 },
  cardListWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  cardHalf: { flexGrow: 1, flexBasis: 380, maxWidth: '100%' },
  cardEnded: { opacity: 0.85 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 12,
  },
  cardPrice: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  cardPriceStrong: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 13, color: amraleColors.blue },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  datesText: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.text },

  endingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: amraleRadius.md,
    backgroundColor: 'rgba(217, 119, 6, 0.10)',
  },
  endingText: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: '#B45309' },

  changes: {
    gap: 4,
    padding: 10,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
  },
  changesTitle: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: amraleColors.textMuted },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  changeDates: { width: 110, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.text },
  changeWhat: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  undoText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue },
  changeMore: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionTile: {
    flexGrow: 1,
    flexBasis: 130,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  actionTileText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13 },

  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: amraleColors.blue,
  },
  addMoreText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.blue },

  sheetText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 15, lineHeight: 21, color: amraleColors.text },
  sheetNote: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: amraleColors.textMuted },
  sheetTotal: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.blue },
  sheetButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pressed: { opacity: 0.88 },
});
