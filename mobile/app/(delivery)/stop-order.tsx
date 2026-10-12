import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { shiftYmd, todayYmd } from '@/src/components/admin/dashboardMetrics';
import {
  canMarkDeliveryDay,
  deliveryDayOrToday,
  lastVisibleDeliveryDay,
  orderCutoffLabel,
} from '@/src/components/delivery/deliveryWindow';
import { DELIVERY_APP_MISSED_REASON } from '@/src/components/delivery/markDayStatus';
import { buildStopOrder, type StopOrder } from '@/src/components/delivery/stopOrder';
import { DetailStatusPill, type DetailPillTone } from '@/src/components/shared/detailUi';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { directionsUrl, formatCustomerAddress } from '@/src/domain/customers/location';
import { useMarkDeliveryDay } from '@/src/hooks/delivery/useMarkDeliveryDay';
import { useMyCustomers } from '@/src/hooks/delivery/useMyDeliveryBoy';
import { useSaveDoorPin } from '@/src/hooks/delivery/useSaveDoorPin';
import { customerCutoffFor } from '@/src/domain/customers/daySchedule';
import { useNow } from '@/src/hooks/useNow';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay, formatTime } from '@/src/utils/format';
import { storedText } from '@/src/i18n/storedText';

const STATUS_TONE: Record<StopOrder['status'], DetailPillTone> = {
  Delivered: 'green',
  'Not delivered': 'red',
  Pending: 'amber',
};

const SUCCESS = '#15803D';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?';
}

/** One customer's order for a day, opened from a stop on the run sheet. */
export default function DeliveryStopOrderScreen() {
  const t = useStrings('delivery');
  const common = useStrings('common');
  const offerWords = useStrings('offers');
  const params = useLocalSearchParams<{ customerId?: string; date?: string }>();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const { boy, customers, actorName, isLoading, isError, refetch } = useMyCustomers();

  const today = useMemo(() => todayYmd(), []);
  const now = useNow();
  const tomorrow = useMemo(() => lastVisibleDeliveryDay(today), [today]);
  const [ymd, setYmd] = useState(() => deliveryDayOrToday(params.date, today));
  const isToday = ymd === today;
  const isTomorrow = ymd === tomorrow;
  const canMark = canMarkDeliveryDay(ymd, today);
  const cutoffLabel = orderCutoffLabel();

  // Only this delivery boy's own customers open here — a link to someone else's stop shows "not on your route".
  const customer = useMemo(() => customers.find((c) => c.id === params.customerId) ?? null, [customers, params.customerId]);
  const order = useMemo(() => (customer ? buildStopOrder(customer, ymd) : null), [customer, ymd]);
  const { mark, busyCustomerId, error } = useMarkDeliveryDay({ actorName, today });
  const [mapNote, setMapNote] = useState<string | null>(null);
  const doorPin = useSaveDoorPin();

  const busy = !!customer && busyCustomerId === customer.id;
  const address = customer ? formatCustomerAddress(customer) : '';
  const instructions = customer
    ? [customer.specialDeliveryInstructions, customer.preferredDeliveryNotes].map((s) => String(s ?? '').trim()).filter(Boolean)
    : [];
  const phones = customer
    ? [customer.mobile, customer.alternateMobile].map((s) => String(s ?? '').trim()).filter(Boolean)
    : [];

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/(delivery)/run', params: { date: ymd } });
  }

  function openDirections() {
    const url = customer ? directionsUrl(customer) : null;
    if (!url) {
      setMapNote(t.noMapLocation);
      return;
    }
    setMapNote(null);
    void Linking.openURL(url).catch(() => setMapNote(t.mapsFailed));
  }

  const dayName = isToday ? common.dates.today : isTomorrow ? common.dates.tomorrow : formatDay(ymd, { weekday: true });

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <ResponsiveContainer variant="form" style={styles.appBarRow}>
          <Pressable
            onPress={goBack}
            hitSlop={6}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.goBack}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={amraleColors.blue} />
          </Pressable>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {t.stopOrder.title}
          </Text>
        </ResponsiveContainer>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer variant="form" style={styles.body}>
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={amraleColors.blue} size="large" />
            </View>
          ) : isError ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="cloud-alert-outline" size={40} color={amraleColors.textSubtle} />
              <Text style={styles.emptyTitle}>{t.stopOrder.couldNotLoad}</Text>
              <Pressable onPress={refetch} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
                <Text style={styles.primaryBtnText}>{t.retry}</Text>
              </Pressable>
            </View>
          ) : !boy || !customer || !order ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="account-search-outline" size={40} color={amraleColors.textSubtle} />
              <Text style={styles.emptyTitle}>{t.stopOrder.notOnRouteTitle}</Text>
              <Text style={styles.emptyText}>{t.stopOrder.notOnRouteText}</Text>
              <Pressable onPress={goBack} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
                <Text style={styles.primaryBtnText}>{t.stopOrder.backToRun}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.personRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(customer.name)}</Text>
                  </View>
                  <View style={styles.personText}>
                    <Text style={styles.personName} numberOfLines={2}>
                      {customer.name}
                    </Text>
                    <Text style={styles.personMeta} numberOfLines={1}>
                      {[
                        customer.routeName?.trim() || t.stopOrder.noRoute,
                        t.stopOrder.deliveryTime[customer.deliveryTime] ?? `${customer.deliveryTime} delivery`,
                      ].join(' · ')}
                    </Text>
                  </View>
                  <DetailStatusPill tone={STATUS_TONE[order.status]} label={t.stopStatus[order.status]} />
                </View>

                <View style={styles.metaLine}>
                  <MaterialCommunityIcons name="map-marker-outline" size={16} color={amraleColors.textSubtle} />
                  <Text style={styles.metaText} selectable>
                    {address || t.noAddress}
                  </Text>
                </View>

                <View style={styles.contactRow}>
                  <Pressable
                    onPress={openDirections}
                    style={({ pressed }) => [styles.directionsBtn, pressed && styles.pressed]}
                    accessibilityRole="link"
                    accessibilityLabel={t.directionsA11y(customer.name)}
                  >
                    <MaterialCommunityIcons name="directions" size={18} color={amraleColors.blue} />
                    <Text style={styles.directionsText}>{t.directions}</Text>
                  </Pressable>
                  {phones.map((tel, i) => (
                    <Pressable
                      key={tel}
                      onPress={() => void Linking.openURL(`tel:${tel}`)}
                      style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={i ? t.stopOrder.callOtherA11y(customer.name) : t.stopOrder.callA11y(customer.name)}
                    >
                      <MaterialCommunityIcons name="phone" size={18} color={SUCCESS} />
                      <Text style={styles.callText}>{i ? t.stopOrder.otherNumber : t.stopOrder.call}</Text>
                    </Pressable>
                  ))}
                </View>
                {doorPin.canPin ? (
                  <Pressable
                    onPress={() => {
                      setMapNote(null);
                      void doorPin.pin(customer);
                    }}
                    disabled={doorPin.savingFor !== null}
                    style={({ pressed }) => [
                      styles.pinBtn,
                      doorPin.armedFor === customer.id && styles.pinBtnArmed,
                      pressed && styles.pressed,
                      doorPin.savingFor !== null && styles.disabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t.stopOrder.pinA11y(customer.name)}
                  >
                    {doorPin.savingFor === customer.id ? (
                      <ActivityIndicator size="small" color={amraleColors.blue} />
                    ) : (
                      <MaterialCommunityIcons name="crosshairs-gps" size={18} color={amraleColors.blue} />
                    )}
                    <Text style={styles.pinBtnText} numberOfLines={1}>
                      {doorPin.armedFor === customer.id
                        ? t.stopOrder.pinConfirm
                        : customer.geoLocation
                          ? t.stopOrder.pinUpdate
                          : t.stopOrder.pinFirst}
                    </Text>
                    {customer.geoLocation && doorPin.armedFor !== customer.id ? (
                      <View style={styles.pinBadge}>
                        <MaterialCommunityIcons name="map-marker-check" size={12} color="#16623a" />
                        <Text style={styles.pinBadgeText}>{t.stopOrder.pinned}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                ) : null}
                {mapNote || doorPin.note ? <Text style={styles.noteText}>{mapNote ?? doorPin.note}</Text> : null}
              </View>

              {instructions.length ? (
                <View style={styles.instructions}>
                  <MaterialCommunityIcons name="message-alert-outline" size={18} color="#8a5300" />
                  <View style={styles.instructionsText}>
                    <Text style={styles.instructionsTitle}>{t.stopOrder.instructionsTitle}</Text>
                    {instructions.map((line) => (
                      <Text key={line} style={styles.instructionsBody}>
                        {line}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : null}

              <PeriodStepper
                label={dayName}
                hint={isToday || isTomorrow ? formatDay(ymd, { weekday: true }) : t.tapForToday}
                onPrev={() => setYmd(shiftYmd(ymd, -1))}
                onNext={() => setYmd(shiftYmd(ymd, 1))}
                nextDisabled={ymd >= tomorrow}
                onPressLabel={isToday ? undefined : () => setYmd(today)}
                prevLabel={t.previousDay}
                nextLabel={t.nextDay}
              />

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="package-variant-closed" size={20} color={amraleColors.blue} />
                  <Text style={styles.cardTitle}>{t.stopOrder.toDeliver}</Text>
                  {order.totalPacks ? <Text style={styles.cardCount}>{t.units.packs(order.totalPacks)}</Text> : null}
                </View>

                {order.lines.length ? (
                  order.lines.map((line) => (
                    <View key={line.key} style={styles.lineRow}>
                      <View style={[styles.lineIcon, line.kind === 'extra' && styles.lineIconExtra]}>
                        <MaterialCommunityIcons
                          name={line.kind === 'extra' ? 'basket-plus-outline' : 'autorenew'}
                          size={18}
                          color={line.kind === 'extra' ? '#8a5300' : amraleColors.blue}
                        />
                      </View>
                      <View style={styles.lineText}>
                        <Text style={styles.lineName} numberOfLines={2}>
                          {line.productName}
                        </Text>
                        <Text style={styles.lineSub} numberOfLines={2}>
                          {[
                            line.comboPacks ? offerWords.kinds.combo : line.packLabel,
                            line.kind === 'extra'
                              ? line.placedBy === 'admin'
                                ? t.stopOrder.extraByDairy
                                : t.stopOrder.extra
                              : t.stopOrder.subscription,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        {line.usualCount ? (
                          <Text style={styles.lineChanged}>{t.stopOrder.changedForDay(line.usualCount)}</Text>
                        ) : null}
                        {line.comboPacks?.length ? (
                          <View style={styles.comboBox}>
                            <Text style={styles.comboTitle}>{offerWords.combo.contains}</Text>
                            {line.comboPacks.map((p) => (
                              <Text key={`${p.productName}|${p.packLabel}`} style={styles.comboLine}>
                                {`${[p.productName, p.packLabel].filter(Boolean).join(' · ')} × ${p.count}`}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.lineCount}>{`× ${line.count}`}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyOrder}>
                    <MaterialCommunityIcons name="calendar-remove-outline" size={32} color={amraleColors.textSubtle} />
                    <Text style={styles.emptyTitle}>
                      {isToday ? t.stopOrder.noOrderToday : isTomorrow ? t.stopOrder.noOrderTomorrow : t.stopOrder.noOrderOnDay}
                    </Text>
                    <Text style={styles.emptyText}>{t.stopOrder.noOrderText}</Text>
                  </View>
                )}

                {order.skipped.length ? (
                  <View style={styles.skipBox}>
                    <Text style={styles.skipTitle}>{t.stopOrder.pausedTitle}</Text>
                    {order.skipped.map((s) => (
                      <Text key={s.key} style={styles.skipLine}>
                        {`${[s.productName, s.packLabel].filter(Boolean).join(' · ')}${s.reason ? ` (${storedText(s.reason)})` : ''}`}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>

              {order.mark ? (
                <View style={[styles.markBox, order.mark.status === 'Delivered' ? styles.markDone : styles.markMissed]}>
                  <MaterialCommunityIcons
                    name={order.mark.status === 'Delivered' ? 'check-circle' : 'close-circle'}
                    size={20}
                    color={order.mark.status === 'Delivered' ? SUCCESS : amraleColors.error}
                  />
                  <Text style={styles.markText}>
                    {t.stopOrder.markSummary(
                      t.stopStatus[order.mark.status],
                      order.mark.at ? formatTime(order.mark.at) : '',
                      order.mark.by ?? '',
                    )}
                    {order.mark.reason
                      ? `\n${t.stopOrder.reason(
                          order.mark.reason === DELIVERY_APP_MISSED_REASON ? t.stopOrder.deliveryAppReason : storedText(order.mark.reason),
                        )}`
                      : ''}
                  </Text>
                </View>
              ) : null}

              {order.lines.length && !canMark ? (
                <View style={styles.planNote}>
                  <MaterialCommunityIcons name="calendar-clock" size={18} color={amraleColors.blue} />
                  <Text style={styles.planNoteText}>
                    {now >= customerCutoffFor(ymd) ? t.stopOrder.planFinal(cutoffLabel) : t.stopOrder.planOpen(cutoffLabel)}
                  </Text>
                </View>
              ) : null}

              {error ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}

              {order.lines.length && canMark ? (
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => void mark(customer, ymd, 'Delivered')}
                    disabled={busy}
                    style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed, busy && styles.disabled]}
                    accessibilityRole="button"
                    accessibilityLabel={t.stopOrder.markDeliveredA11y(customer.name)}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={amraleColors.white} />
                    ) : (
                      <MaterialCommunityIcons name="check" size={18} color={amraleColors.white} />
                    )}
                    <Text style={styles.doneBtnText}>
                      {order.status === 'Delivered' ? t.stopOrder.delivered : t.stopOrder.deliveredPacks(order.totalPacks)}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void mark(customer, ymd, 'Missed')}
                    disabled={busy}
                    style={({ pressed }) => [styles.missBtn, pressed && styles.pressed, busy && styles.disabled]}
                    accessibilityRole="button"
                    accessibilityLabel={t.stopOrder.markMissedA11y(customer.name)}
                  >
                    <Text style={styles.missBtnText}>{t.stopOrder.notDelivered}</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  appBar: {
    paddingBottom: amraleSpacing.sm,
    backgroundColor: amraleColors.white,
    borderBottomWidth: 1,
    borderBottomColor: amraleColors.inputBorderLight,
  },
  appBarRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: amraleSpacing.md },
  appBarTitle: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.blue },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: 12 },

  card: {
    gap: 10,
    padding: 14,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  cardCount: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3efff',
  },
  avatarText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 17, color: amraleColors.blue },
  personText: { flex: 1, minWidth: 0 },
  personName: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },
  personMeta: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },

  metaLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: amraleColors.text,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  directionsBtn: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: '#e3efff',
  },
  directionsText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.blue },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.md,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  callText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: SUCCESS },
  noteText: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: '#0b4fae' },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  pinBtnArmed: { borderColor: amraleColors.blue, backgroundColor: '#e3efff' },
  pinBtnText: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.blue },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: amraleRadius.pill,
    backgroundColor: '#dcf3e5',
  },
  pinBadgeText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 11, color: '#16623a' },

  instructions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: '#fff4e0',
    borderWidth: 1,
    borderColor: '#f6d9a6',
  },
  instructionsText: { flex: 1, minWidth: 0, gap: 2 },
  instructionsTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: '#8a5300' },
  instructionsBody: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: '#5c3a00' },

  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: amraleColors.inputBorderLight,
  },
  lineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3efff',
  },
  lineIconExtra: { backgroundColor: '#fff4e0' },
  lineText: { flex: 1, minWidth: 0 },
  lineName: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  lineSub: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  lineChanged: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: '#8a5300' },
  comboBox: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 2,
    borderRadius: amraleRadius.md,
    backgroundColor: '#fff4e0',
  },
  comboTitle: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: '#8a5300' },
  comboLine: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, lineHeight: 20, color: amraleColors.text },
  lineCount: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 20, color: amraleColors.blue },

  emptyOrder: { alignItems: 'center', gap: 4, paddingVertical: 16 },
  skipBox: { gap: 2, padding: 10, borderRadius: amraleRadius.md, backgroundColor: amraleColors.surface },
  skipTitle: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.textMuted },
  skipLine: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    color: amraleColors.textMuted,
    textDecorationLine: 'line-through',
  },

  markBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: amraleRadius.md },
  markDone: { backgroundColor: 'rgba(22, 163, 74, 0.1)' },
  markMissed: { backgroundColor: 'rgba(220, 38, 38, 0.08)' },
  markText: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, lineHeight: 20, color: amraleColors.text },

  planNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: '#e3efff',
  },
  planNoteText: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, lineHeight: 18, color: '#0b4fae' },
  errorText: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.error },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneBtn: {
    flexGrow: 1.4,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.blue,
  },
  doneBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.white },
  missBtn: {
    flexGrow: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  missBtnText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },

  centered: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text, textAlign: 'center' },
  emptyText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted, textAlign: 'center' },
  primaryBtn: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: amraleRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.blue,
  },
  primaryBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.white },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
});
