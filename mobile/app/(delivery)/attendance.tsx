import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { shiftMonth } from '@/src/components/admin/customerSubscriptionMonthUtils';
import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import { deliveryMonthLabel } from '@/src/components/delivery/deliveryWindow';
import { useDeliveryLayout } from '@/src/components/delivery/layout';
import {
  buildMyAttendanceDays,
  formatRupees,
  summarizeMyAttendance,
  type MyAttendanceDay,
} from '@/src/components/delivery/mySalary';
import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { DetailStatusPill, type DetailPillTone } from '@/src/components/shared/detailUi';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { useMyDeliveryBoy } from '@/src/hooks/delivery/useMyDeliveryBoy';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';

type DayFilter = 'all' | 'present' | 'absent' | 'notMarked';

const FILTERS: DayFilter[] = ['all', 'present', 'absent', 'notMarked'];

/** A day's status in the app language; an unknown stored status is shown as it is. */
function statusLabel(status: string): string {
  const labels: Record<string, string> = strings('delivery').attendanceStatus;
  return labels[status] ?? status;
}

/** "Route cover (Sagar), Route cover (Amit)" as built by the salary memo, in the app language. */
function coverNoteLabel(note: string): string {
  const t = strings('delivery').attendance;
  return note.replace(/Route cover \(([^)]*)\)/g, (_, name: string) => t.routeCover(name));
}

function toneFor(status: string): DetailPillTone {
  if (status === 'Present') return 'green';
  if (status === 'Absent') return 'red';
  if (status === 'Not marked') return 'gray';
  return 'blue';
}

function dayLabel(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime())
    ? ymd
    : formatDay(ymd, { weekday: true });
}

/** The month the boy joined; earlier months have nothing to show. */
function joiningMonth(joiningDate: string | undefined): string | null {
  const m = String(joiningDate ?? '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

export default function MyAttendanceScreen() {
  const t = useStrings('delivery');
  const common = useStrings('common');
  const params = useLocalSearchParams<{ month?: string }>();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const layout = useDeliveryLayout({ minCardWidth: 300 });
  const { boy, allBoys, isLoading, isError, refetch } = useMyDeliveryBoy();

  const thisMonth = useMemo(() => todayYmd().slice(0, 7), []);
  const [month, setMonth] = useState<string>(
    /^\d{4}-\d{2}$/.test(params.month ?? '') && (params.month as string) <= thisMonth
      ? (params.month as string)
      : thisMonth,
  );
  const [filter, setFilter] = useState<DayFilter>('all');

  const oldestMonth = joiningMonth(boy?.joiningDate);
  const days = useMemo(() => buildMyAttendanceDays(boy as never, allBoys as never, month), [allBoys, boy, month]);
  const summary = useMemo(() => summarizeMyAttendance(days), [days]);

  const counts: Record<DayFilter, number> = {
    all: days.length,
    present: summary.present,
    absent: summary.absent,
    notMarked: summary.notMarked,
  };

  const shown = useMemo<MyAttendanceDay[]>(() => {
    switch (filter) {
      case 'present':
        return days.filter((d) => d.status === 'Present');
      case 'absent':
        return days.filter((d) => d.status === 'Absent');
      case 'notMarked':
        return days.filter((d) => d.status === 'Not marked');
      default:
        return days;
    }
  }, [days, filter]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(delivery)');
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <ResponsiveContainer variant={layout.isWide ? 'list' : 'form'} style={styles.appBarRow}>
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
            {t.attendance.title}
          </Text>
        </ResponsiveContainer>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer variant={layout.isWide ? 'list' : 'form'} style={styles.body}>
          <PeriodStepper
            label={deliveryMonthLabel(month)}
            hint={month === thisMonth ? common.dates.thisMonth : undefined}
            onPrev={() => setMonth(shiftMonth(month, -1))}
            onNext={() => setMonth(shiftMonth(month, 1))}
            prevDisabled={!!oldestMonth && month <= oldestMonth}
            nextDisabled={month === thisMonth}
            prevLabel={t.previousMonth}
            nextLabel={t.nextMonth}
          />

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={amraleColors.blue} size="large" />
            </View>
          ) : isError ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="cloud-alert-outline" size={40} color={amraleColors.textSubtle} />
              <Text style={styles.emptyTitle}>{t.attendance.couldNotLoad}</Text>
              <Pressable onPress={refetch} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
                <Text style={styles.primaryBtnText}>{t.retry}</Text>
              </Pressable>
            </View>
          ) : !boy ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="account-question-outline" size={40} color={amraleColors.textSubtle} />
              <Text style={styles.emptyTitle}>{t.notLinked.title}</Text>
              <Text style={styles.emptyText}>{t.notLinked.text}</Text>
            </View>
          ) : (
            <>
              <View style={styles.filterRow}>
                {FILTERS.map((key) => {
                  const selected = filter === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setFilter(key)}
                      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t.attendance.filters[key]}</Text>
                      <Text style={[styles.chipCount, selected && styles.chipCountSelected]}>{counts[key]}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.note}>{t.attendance.note}</Text>

              {shown.length ? (
                <View style={layout.columns > 1 ? styles.dayGrid : styles.card}>
                  {shown.map((d, index) => (
                    <View
                      key={d.dateYmd}
                      style={
                        layout.columns > 1
                          ? [styles.dayRow, styles.dayCard, { width: layout.cardWidth }]
                          : [styles.dayRow, index > 0 && styles.dayRowDivided]
                      }
                    >
                      <View style={styles.dayText}>
                        <Text style={styles.dayDate}>{dayLabel(d.dateYmd)}</Text>
                        {d.coverNote ? (
                          <Text style={styles.dayHint} numberOfLines={2}>
                            {coverNoteLabel(d.coverNote)}
                          </Text>
                        ) : d.coveredByName ? (
                          <Text style={styles.dayHint} numberOfLines={2}>
                            {t.attendance.routeRunBy(d.coveredByName)}
                          </Text>
                        ) : null}
                      </View>
                      <DetailStatusPill tone={toneFor(d.status)} label={statusLabel(d.status)} />
                      <Text style={[styles.dayAmount, d.earned <= 0 && styles.dayAmountZero]}>
                        {formatRupees(d.earned)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.centered}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={amraleColors.textSubtle} />
                  <Text style={styles.emptyTitle}>{counts.all ? t.noFilterMatch : t.attendance.noDaysTitle}</Text>
                  <Text style={styles.emptyText}>{counts.all ? t.attendance.filterEmptyText : t.attendance.noDaysText}</Text>
                </View>
              )}
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
  appBarTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.blue,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: 12 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  chipSelected: { backgroundColor: amraleColors.blue, borderColor: amraleColors.blue },
  chipText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.text },
  chipTextSelected: { color: amraleColors.white },
  chipCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    color: amraleColors.textMuted,
    backgroundColor: amraleColors.inputBgLight,
  },
  chipCountSelected: { color: amraleColors.white, backgroundColor: 'rgba(255, 255, 255, 0.22)' },

  note: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: amraleColors.textSubtle,
  },

  card: {
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
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  dayCard: {
    paddingHorizontal: 14,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
  },
  dayRowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: amraleColors.inputBorderLight },
  dayText: { flex: 1, minWidth: 0 },
  dayDate: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  dayHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  dayAmount: {
    minWidth: 62,
    textAlign: 'right',
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 14,
    color: amraleColors.text,
  },
  dayAmountZero: { color: amraleColors.textSubtle },

  centered: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
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
});
