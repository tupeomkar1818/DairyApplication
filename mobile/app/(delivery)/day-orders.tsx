import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { startTransition, useDeferredValue, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { Button, Card, Dialog, Portal, Text } from 'react-native-paper';

import { toIsoYmdFromFlexibleDate } from '@/src/components/admin/customerFormDates';
import { monthLabel, shiftMonth, subscriptionPlanActiveOnDateYmd, planLineTotal } from '@/src/components/admin/customerSubscriptionMonthUtils';
import { useCustomers, useUpdateCustomer } from '@/src/hooks/customers/useCustomers';
import { loadDailyProductOrderLines } from '@/src/infrastructure/customerDailyProductOrdersStore';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';

const COLORS = {
  primary: '#2563EB',
  bg: '#F8FAFC',
  text: '#1E293B',
};

function monthKeyNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(yyyyMm: string): number {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return 31;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return new Date(y, mo, 0).getDate();
}

function ymdsForMonth(yyyyMm: string): string[] {
  const dim = daysInMonth(yyyyMm);
  const out: string[] = [];
  for (let d = 1; d <= dim; d += 1) out.push(`${yyyyMm}-${String(d).padStart(2, '0')}`);
  return out;
}

function fmtDateLabel(ymd: string): string {
  const d = new Date(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function newDeliveryId(): string {
  return `del_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export default function DeliveryDayOrdersScreen() {
  const scheme = useColorScheme();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const { width, height } = useWindowDimensions();
  const customers = useCustomers();
  const updateCustomer = useUpdateCustomer();

  const monthKey = useMemo(() => monthKeyNow(), []);
  const [month, setMonth] = useState<string>(monthKey);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const dialogW = Math.max(280, Math.min(width - 24, 720));
  const dialogMaxH = Math.max(240, Math.min(Math.round(height * 0.76), height - 140));

  const sectionCard = scheme === 'dark' ? styles.cardDark : styles.cardLight;
  const textMain = scheme === 'dark' ? styles.textOnDark : styles.textOnLight;
  const textSub = scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight;

  const items = useMemo(() => customers.data?.items ?? [], [customers.data?.items]);
  const deferredItems = useDeferredValue(items);

  const monthDays = useMemo(() => ymdsForMonth(month), [month]);

  const dayTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const ymd of monthDays) {
      let total = 0;
      for (const c of deferredItems) {
        for (const p of c.subscriptionPlans ?? []) {
          if (!subscriptionPlanActiveOnDateYmd(p as any, ymd)) continue;
          total += Math.round(planLineTotal(p as any));
        }
      }
      map.set(ymd, total);
    }
    return map;
  }, [deferredItems, monthDays]);

  const dayOrdersModel = useMemo(() => {
    const ymd = selectedDay;
    if (!ymd) return [];
    return deferredItems.map((c) => {
      const plans = (c.subscriptionPlans ?? []).filter((p) => subscriptionPlanActiveOnDateYmd(p as any, ymd));
      const plannedTotal = plans.reduce((s, p) => s + Math.round(planLineTotal(p as any)), 0);
      const deliveredForDay = (c.deliveries ?? []).some((d) => String(d.deliveryDate ?? '').slice(0, 10) === ymd && d.status === 'Delivered');
      const missedForDay = (c.deliveries ?? []).some((d) => String(d.deliveryDate ?? '').slice(0, 10) === ymd && d.status === 'Missed');
      const status = deliveredForDay && !missedForDay ? 'Delivered' : missedForDay && !deliveredForDay ? 'Not delivered' : deliveredForDay ? 'Mixed' : '—';
      return { customer: c, plans, plannedTotal, status };
    });
  }, [deferredItems, selectedDay]);

  async function setCustomerDayStatus(customerId: string, ymd: string, next: 'Delivered' | 'Missed') {
    const c = items.find((x) => x.id === customerId);
    if (!c) return;
    const plans = (c.subscriptionPlans ?? []).filter((p) => subscriptionPlanActiveOnDateYmd(p as any, ymd));
    const now = new Date().toISOString();

    // Include add-on products saved for the day (for “all orders of the day”)
    const addonLines = await loadDailyProductOrderLines(customerId);
    const addonsForDay = addonLines.filter((l) => l.dateYmd === ymd);

    const wanted = [
      ...plans.map((p) => ({ productName: p.productName, quantityLabel: p.quantityLabel })),
      ...addonsForDay.map((a) => ({ productName: a.productName, quantityLabel: a.quantityLabel })),
    ];

    const prev = c.deliveries ?? [];
    const nextList = [...prev];

    for (const w of wanted) {
      const existingIdx = nextList.findIndex(
        (d) =>
          String(d.deliveryDate ?? '').slice(0, 10) === ymd &&
          String(d.productName ?? '').trim() === String(w.productName ?? '').trim() &&
          String(d.quantityLabel ?? '').trim() === String(w.quantityLabel ?? '').trim(),
      );
      const base = existingIdx >= 0 ? nextList[existingIdx]! : null;
      const row = {
        id: base?.id ?? newDeliveryId(),
        deliveryDate: ymd,
        productName: String(w.productName ?? '').trim(),
        quantityLabel: String(w.quantityLabel ?? '').trim(),
        deliveryBoyName: base?.deliveryBoyName,
        status: next,
        missedReason: next === 'Missed' ? base?.missedReason ?? 'Marked not delivered by delivery app' : undefined,
        rescheduledDate: base?.rescheduledDate,
        notes: base?.notes,
        createdAt: base?.createdAt ?? now,
        updatedAt: now,
      };
      if (existingIdx >= 0) nextList[existingIdx] = row as any;
      else nextList.push(row as any);
    }

    await updateCustomer.mutateAsync({ id: c.id, data: { deliveries: nextList } });
  }

  return (
    <View style={[styles.bg, scheme === 'dark' ? styles.bgDark : styles.bgLight]}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <Text variant="titleLarge" style={textMain}>
          Day Orders
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
          <Card.Content style={{ gap: 10 }}>
            <Text variant="titleSmall" style={[styles.bold, textMain]}>
              Month-wise totals
            </Text>
            <View style={styles.monthNavRow}>
              <Pressable
                onPress={() =>
                  startTransition(() => {
                    setMonth(shiftMonth(month, -1));
                  })
                }
                style={({ pressed }) => [styles.monthNavBtn, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
              </Pressable>
              <View style={styles.monthNavCenter}>
                <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                  {monthLabel(month)}
                </Text>
                <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                  {month}
                </Text>
              </View>
              <Pressable
                disabled={month >= monthKey}
                onPress={() =>
                  startTransition(() => {
                    setMonth(shiftMonth(month, 1));
                  })
                }
                style={({ pressed }) => [styles.monthNavBtn, month >= monthKey ? styles.disabled : null, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="chevron-right" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
              </Pressable>
            </View>

            <View style={{ gap: 8 }}>
              {monthDays.map((ymd) => (
                <Pressable
                  key={ymd}
                  onPress={() =>
                    startTransition(() => {
                      setSelectedDay(ymd);
                    })
                  }
                  style={({ pressed }) => [styles.dayRow, pressed && styles.pressed]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyMedium" style={[styles.bold, textMain]} numberOfLines={1}>
                      {fmtDateLabel(ymd)}
                    </Text>
                    <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                      {ymd}
                    </Text>
                  </View>
                  <Text variant="titleSmall" style={[styles.bold, textMain]}>
                    ₹{Math.round(dayTotals.get(ymd) ?? 0)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      <Portal>
        <Dialog
          visible={!!selectedDay}
          onDismiss={() => setSelectedDay(null)}
          style={[styles.dialogSurface, { maxWidth: dialogW, width: dialogW }]}
        >
          <Dialog.Title>{selectedDay ? fmtDateLabel(selectedDay) : 'Day'}</Dialog.Title>
          <Dialog.Content style={{ maxHeight: dialogMaxH }}>
            <ScrollView nestedScrollEnabled contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              {dayOrdersModel.map((row) => (
                <View key={row.customer.id} style={[styles.customerRow, sectionCard]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyMedium" style={[styles.bold, textMain]} numberOfLines={1}>
                      {row.customer.name}
                    </Text>
                    <Text variant="bodySmall" style={textSub} numberOfLines={2}>
                      {row.plans.length ? row.plans.map((p) => `${p.productName} ${p.quantityLabel}`).join(' · ') : 'No subscription line today'}
                    </Text>
                    <Text variant="bodySmall" style={[textSub, { marginTop: 4 }]}>
                      Planned total: ₹{Math.round(row.plannedTotal)} · Status: {row.status}
                    </Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    <Button
                      compact
                      mode="contained"
                      disabled={!selectedDay || updateCustomer.isPending}
                      onPress={() => void setCustomerDayStatus(row.customer.id, selectedDay!, 'Delivered')}
                    >
                      Delivered
                    </Button>
                    <Button
                      compact
                      mode="outlined"
                      disabled={!selectedDay || updateCustomer.isPending}
                      onPress={() => void setCustomerDayStatus(row.customer.id, selectedDay!, 'Missed')}
                    >
                      Not delivered
                    </Button>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSelectedDay(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgLight: { backgroundColor: COLORS.bg },
  bgDark: { backgroundColor: '#0B1220' },

  appBar: { paddingHorizontal: 16, paddingBottom: 12 },
  container: { padding: 16, paddingBottom: 24 },

  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardLight: { backgroundColor: 'white', borderColor: 'rgba(37,99,235,0.10)' },
  cardDark: { backgroundColor: 'rgba(15,23,42,0.70)', borderColor: 'rgba(255,255,255,0.10)' },

  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
  subtleOnLight: { color: 'rgba(30,41,59,0.70)' },
  subtleOnDark: { color: 'rgba(255,255,255,0.78)' },
  bold: { fontWeight: '900' },

  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  monthNavBtn: { width: 44, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', backgroundColor: 'rgba(148,163,184,0.06)' },
  monthNavCenter: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },

  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)' },

  customerRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)' },

  dialogSurface: { borderRadius: 16 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
});

