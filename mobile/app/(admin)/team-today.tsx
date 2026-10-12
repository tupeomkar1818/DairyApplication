import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ADMIN_LIST_GAP, AdminListScreenLayout, useAdminListGrid } from '@/src/components/admin/AdminListScreenLayout';
import {
  buildTeamTodayEntries,
  filterTeamEntries,
  shiftYmd,
  todayYmd,
  type TeamBucket,
  type TeamEntry,
} from '@/src/components/admin/dashboardMetrics';
import {
  AdminListControls,
  AdminListEmptyState,
  AdminListErrorState,
  AdminListIconButton,
  adminListCardStyles as cardStyles,
} from '@/src/components/shared/adminListUi';
import { DetailStatusPill, type DetailPillTone } from '@/src/components/shared/detailUi';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';

/** Labels: `admin.teamToday.buckets`. */
const BUCKETS: TeamBucket[] = ['all', 'present', 'absent', 'unmarked'];

const STATUS_TONE: Record<TeamEntry['status'], DetailPillTone> = {
  Present: 'green',
  Absent: 'red',
  'Not marked': 'amber',
};

function isBucket(value: string | undefined): value is TeamBucket {
  return value === 'all' || value === 'present' || value === 'absent' || value === 'unmarked';
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : '')).toUpperCase();
}

function mobileLabel(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return mobile.trim() || strings('admin').teamToday.noMobile;
}

/** "Wed, 16 Sep 2026" for a yyyy-mm-dd day. */
function dayLabel(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime())
    ? ymd
    : formatDay(ymd, { weekday: true, year: true });
}

export default function AdminTeamTodayScreen() {
  const params = useLocalSearchParams<{ bucket?: string; date?: string }>();
  const deliveryBoys = useDeliveryBoys();
  const grid = useAdminListGrid();
  const t = useStrings('admin');
  const tc = useStrings('common');
  /** Stored attendance words ("Half Day") shown in the app language; unknown values as stored. */
  const attendanceLabel = (status: string) => (t.teamToday.attendance as Record<string, string>)[status] ?? status;

  const [bucket, setBucket] = useState<TeamBucket>(isBucket(params.bucket) ? params.bucket : 'all');
  const [query, setQuery] = useState('');

  const today = useMemo(() => todayYmd(), []);
  // Earlier days can be reviewed with the stepper or opened by link (?date=).
  const [ymd, setYmd] = useState<string>(
    /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') && (params.date as string) <= today ? (params.date as string) : today,
  );
  const isToday = ymd === today;
  const entries = useMemo(() => buildTeamTodayEntries(deliveryBoys.data?.items ?? [], ymd), [deliveryBoys.data?.items, ymd]);

  const counts = useMemo(
    () => ({
      all: entries.length,
      present: filterTeamEntries(entries, 'present').length,
      absent: filterTeamEntries(entries, 'absent').length,
      unmarked: filterTeamEntries(entries, 'unmarked').length,
    }),
    [entries],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inBucket = filterTeamEntries(entries, bucket);
    if (!q) return inBucket;
    return inBucket.filter((e) => `${e.name} ${e.mobile} ${e.route}`.toLowerCase().includes(q));
  }, [entries, bucket, query]);

  const summaryText = query.trim()
    ? t.lists.showing(rows.length, filterTeamEntries(entries, bucket).length)
    : t.teamToday.summary(counts.present, counts.absent, counts.unmarked);

  return (
    <AdminListScreenLayout title={t.teamToday.title}>
      {({ bottomInset }) => {
        if (deliveryBoys.isLoading) {
          return (
            <View style={styles.loading}>
              <ActivityIndicator color={amraleColors.blue} size="large" />
            </View>
          );
        }

        if (deliveryBoys.isError && !deliveryBoys.data) {
          return <AdminListErrorState title={t.teamToday.loadError} onRetry={() => void deliveryBoys.refetch()} />;
        }

        return (
          <View style={styles.wrap}>
            <View style={[styles.stepper, grid.containerStyle]}>
              <PeriodStepper
                label={isToday ? tc.dates.today : dayLabel(ymd)}
                hint={isToday ? dayLabel(ymd) : t.lists.tapForToday}
                onPrev={() => setYmd(shiftYmd(ymd, -1))}
                onNext={() => setYmd(shiftYmd(ymd, 1))}
                nextDisabled={isToday}
                onPressLabel={isToday ? undefined : () => setYmd(today)}
                prevLabel={t.lists.previousDay}
                nextLabel={t.lists.nextDay}
              />
            </View>

            <AdminListControls
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder={t.lists.searchPlaceholder}
              searchFieldName="team-today-search"
              chips={BUCKETS.map((key) => ({ key, label: t.teamToday.buckets[key], count: counts[key] }))}
              activeChip={bucket}
              onChipChange={setBucket}
              summaryText={summaryText}
              isMobile={grid.isMobile}
              containerStyle={grid.containerStyle}
            />

            <FlatList
              data={rows}
              key={grid.columns}
              numColumns={grid.columns}
              columnWrapperStyle={grid.columns > 1 ? styles.gridRow : undefined}
              keyExtractor={(e) => e.boyId}
              contentContainerStyle={[styles.listContent, grid.containerStyle, { paddingBottom: amraleSpacing.xl + bottomInset }]}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <AdminListEmptyState
                  icon={query.trim() ? 'filter-off-outline' : 'account-hard-hat-outline'}
                  title={query.trim() ? t.teamToday.noMatchTitle : t.teamToday.empty[bucket].title}
                  text={query.trim() ? t.lists.tryDifferent : t.teamToday.empty[bucket].text}
                  actionLabel={query.trim() ? t.lists.clearSearch : t.lists.backToDashboard}
                  onAction={query.trim() ? () => setQuery('') : () => router.replace('/(admin)')}
                />
              }
              renderItem={({ item }) => {
                const tel = item.mobile.trim();
                return (
                  // Opens the delivery boy's Attendance tab, where today can be marked.
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/(admin)/delivery-detail', params: { id: item.boyId, tab: 'attendance' } })
                    }
                    style={({ pressed }) => [cardStyles.card, cardStyles.cardRow, grid.cellStyle, pressed && cardStyles.cardPressed]}
                    accessibilityLabel={t.lists.openA11y(item.name)}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initialsOf(item.name)}</Text>
                    </View>

                    <View style={styles.body}>
                      <View style={cardStyles.nameRow}>
                        <Text style={cardStyles.name} numberOfLines={3}>
                          {item.name}
                        </Text>
                        <DetailStatusPill
                          tone={STATUS_TONE[item.status]}
                          label={attendanceLabel(item.rawStatus && item.status === 'Present' ? item.rawStatus : item.status)}
                        />
                      </View>

                      <View style={cardStyles.metaLine}>
                        <MaterialCommunityIcons name="routes" size={14} color={amraleColors.textSubtle} />
                        <Text style={cardStyles.metaText} numberOfLines={2}>
                          {item.route || t.lists.noRoute}
                        </Text>
                      </View>
                      <View style={cardStyles.metaLine}>
                        <MaterialCommunityIcons name="phone-outline" size={14} color={amraleColors.textSubtle} />
                        <Text style={cardStyles.metaText} numberOfLines={1}>
                          {mobileLabel(item.mobile)}
                        </Text>
                      </View>
                    </View>

                    <AdminListIconButton
                      icon="phone"
                      tone="green"
                      label={t.teamToday.callA11y(item.name)}
                      disabled={!tel}
                      onPress={() => {
                        if (!tel) return;
                        void Linking.openURL(`tel:${tel}`);
                      }}
                    />
                  </Pressable>
                );
              }}
            />
          </View>
        );
      }}
    </AdminListScreenLayout>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  stepper: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: amraleSpacing.lg },
  list: { flex: 1 },
  listContent: { paddingHorizontal: amraleSpacing.md, paddingBottom: amraleSpacing.xl, gap: ADMIN_LIST_GAP },
  gridRow: { gap: ADMIN_LIST_GAP },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.inputBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.blue },
  body: { flex: 1, minWidth: 0, gap: 4 },
});
