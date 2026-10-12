import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { Button, Dialog, Portal } from 'react-native-paper';

import { ADMIN_LIST_GAP, ADMIN_LIST_PAD, useAdminListGrid } from '@/src/components/admin/AdminListScreenLayout';
import {
  AdminListControls,
  AdminListEmptyState,
  AdminListErrorState,
  AdminListIconButton,
  adminListCardStyles as cardStyles,
  type AdminListSortOption,
} from '@/src/components/shared/adminListUi';
import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import { useDeleteDeliveryBoy, useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { useResponsiveDialogStyle } from '@/src/utils/responsiveLayout';

type SortBy = 'name_asc' | 'name_desc' | 'route_asc' | 'salary_desc';
type StatusFilter = 'all' | 'Active' | 'Inactive';

/** Sort choices; labels are looked up in the current language when the list renders. */
function sortOptions(): AdminListSortOption<SortBy>[] {
  const s = strings('deliveryBoys').list.sort;
  return [
    { key: 'name_asc', label: s.nameAsc, short: s.nameAscShort, icon: 'sort-alphabetical-ascending' },
    { key: 'name_desc', label: s.nameDesc, short: s.nameDescShort, icon: 'sort-alphabetical-descending' },
    { key: 'route_asc', label: s.routeAsc, short: s.routeAscShort, icon: 'routes' },
    { key: 'salary_desc', label: s.salaryDesc, short: s.salaryDescShort, icon: 'sort-numeric-descending' },
  ];
}

const STATUS_FILTERS: StatusFilter[] = ['all', 'Active', 'Inactive'];

function statusFilterLabel(key: StatusFilter): string {
  const states = strings('common').states;
  return key === 'all' ? states.all : key === 'Active' ? states.active : states.inactive;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : '')).toUpperCase();
}

function routeLabel(routeName: string | undefined): string {
  return (routeName ?? '').trim() || strings('deliveryBoys').list.noRoute;
}

function mobileLabel(mobile: string | undefined): string {
  const digits = (mobile ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return (mobile ?? '').trim() || strings('deliveryBoys').list.noMobile;
}

/** Monthly salary, or the per-day rate for attendance-based boys. */
function salaryLabel(b: DeliveryBoyResponse): string {
  const t = strings('deliveryBoys').list;
  if (b.salaryType === 'Attendance Based Salary') {
    const perDay = Number(b.perDaySalary ?? 0);
    return perDay > 0 ? t.perDayRate(`₹${perDay}`) : t.perDayRateNotSet;
  }
  const monthly = Number(b.monthlySalary ?? 0);
  return monthly > 0 ? t.monthlyRate(`₹${monthly.toLocaleString('en-IN')}`) : t.salaryNotSet;
}

/** Sort value for "Salary (high to low)": per-day rates compare on their monthly equivalent. */
function salarySortValue(b: DeliveryBoyResponse): number {
  if (b.salaryType === 'Attendance Based Salary') return Number(b.perDaySalary ?? 0) * 30;
  return Number(b.monthlySalary ?? 0);
}

function DeliveryBoyCard({
  boy: b,
  cellStyle,
  onDelete,
}: {
  boy: DeliveryBoyResponse;
  cellStyle: ViewStyle | undefined;
  onDelete: (b: DeliveryBoyResponse) => void;
}) {
  // Re-render when the language changes; the label helpers read the current language.
  const t = useStrings('deliveryBoys').list;
  const states = useStrings('common').states;
  const isActive = b.status === 'Active';
  const tel = (b.mobileNumber ?? '').trim();

  return (
    // The whole card opens the delivery boy details; the call/edit/delete buttons inside handle their own taps.
    <Pressable
      onPress={() => router.push({ pathname: '/(admin)/delivery-detail', params: { id: b.id } })}
      style={({ pressed }) => [
        cardStyles.card,
        cellStyle,
        !isActive && cardStyles.cardDimmed,
        pressed && cardStyles.cardPressed,
      ]}
      // No `button` role: on web that renders a <button>, and the action buttons inside would be invalid nested buttons.
      accessibilityLabel={t.viewDetailsFor(b.fullName)}
    >
      {/* Details use the card's full width; the actions sit in a footer row instead of a column that squeezed the text
          to ~130px on small phones. */}
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(b.fullName ?? '')}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name} numberOfLines={2}>
              {b.fullName}
            </Text>
            <View style={[cardStyles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={[cardStyles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
                {(isActive ? states.active : states.inactive).toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={cardStyles.metaLine}>
            <MaterialCommunityIcons name="routes" size={14} color={amraleColors.textSubtle} />
            <Text style={cardStyles.metaText} numberOfLines={2}>
              {routeLabel(b.primaryRouteName)}
            </Text>
          </View>
          <View style={cardStyles.metaLine}>
            <MaterialCommunityIcons name="phone-outline" size={14} color={amraleColors.textSubtle} />
            <Text style={cardStyles.metaText} numberOfLines={1}>
              {mobileLabel(b.mobileNumber)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.salary}>
          <MaterialCommunityIcons name="cash" size={16} color={amraleColors.blue} />
          <Text style={styles.salaryText} numberOfLines={1}>
            {salaryLabel(b)}
          </Text>
        </View>
        <View style={cardStyles.iconRow}>
          <AdminListIconButton
            icon="phone"
            tone="green"
            label={t.callName(b.fullName)}
            disabled={!tel}
            onPress={() => {
              if (!tel) return;
              void Linking.openURL(`tel:${tel}`);
            }}
          />
          <AdminListIconButton
            icon="pencil-outline"
            tone="blue"
            label={t.editName(b.fullName)}
            onPress={() => router.push({ pathname: '/(admin)/delivery-edit', params: { id: b.id } })}
          />
          <AdminListIconButton icon="trash-can-outline" tone="red" label={t.deleteName(b.fullName)} onPress={() => onDelete(b)} />
        </View>
      </View>
    </Pressable>
  );
}

export type DeliveryBoysManagementSectionProps = {
  bottomInset?: number;
};

export function DeliveryBoysManagementSection({ bottomInset = 0 }: DeliveryBoysManagementSectionProps) {
  const t = useStrings('deliveryBoys').list;
  const c = useStrings('common');
  const deliveryBoys = useDeliveryBoys();
  const del = useDeleteDeliveryBoy();
  const grid = useAdminListGrid();
  const dialogStyle = useResponsiveDialogStyle(420);
  // Short windows (a phone held sideways): pinned search and filters would leave room for less than one card, so they
  // scroll away with the list instead.
  const { height: windowHeight } = useWindowDimensions();
  const controlsScroll = windowHeight < 560;

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name_asc');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryBoyResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const all = deliveryBoys.data?.items ?? [];
  const activeCount = useMemo(() => all.filter((b) => b.status === 'Active').length, [all]);
  const statusCounts: Record<StatusFilter, number> = {
    all: all.length,
    Active: activeCount,
    Inactive: all.length - activeCount,
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = all;

    if (statusFilter !== 'all') items = items.filter((b) => b.status === statusFilter);
    if (q) {
      items = items.filter((b) =>
        `${b.fullName ?? ''} ${b.mobileNumber ?? ''} ${b.primaryRouteName ?? ''}`.toLowerCase().includes(q),
      );
    }

    switch (sortBy) {
      case 'name_desc':
        return [...items].sort((a, b) => (b.fullName ?? '').localeCompare(a.fullName ?? ''));
      case 'route_asc':
        return [...items].sort((a, b) => (a.primaryRouteName ?? '').localeCompare(b.primaryRouteName ?? ''));
      case 'salary_desc':
        return [...items].sort((a, b) => salarySortValue(b) - salarySortValue(a));
      case 'name_asc':
      default:
        return [...items].sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? ''));
    }
  }, [all, query, sortBy, statusFilter]);

  const isFiltering = query.trim() !== '' || statusFilter !== 'all';
  const summaryText = isFiltering ? t.showing(filtered.length, all.length) : t.summary(all.length, activeCount);

  function clearFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  function requestDelete(b: DeliveryBoyResponse) {
    setDeleteError(null);
    setDeleteTarget(b);
    setConfirmOpen(true);
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await del.mutateAsync({ id: deleteTarget.id });
      setConfirmOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      // Keep the dialog open and explain why (e.g. the boy is still assigned to customers).
      setDeleteError(err instanceof Error && err.message ? err.message : t.deleteDialog.failed);
    }
  }

  if (deliveryBoys.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={amraleColors.blue} size="large" />
      </View>
    );
  }

  if (deliveryBoys.isError && !all.length) {
    return <AdminListErrorState title={t.loadError} onRetry={() => void deliveryBoys.refetch()} />;
  }

  const controls = (
    <AdminListControls
      searchValue={query}
      onSearchChange={setQuery}
      searchPlaceholder={t.searchPlaceholder}
      searchFieldName="delivery-boy-search"
      sortOptions={sortOptions()}
      sortBy={sortBy}
      onSortChange={setSortBy}
      chips={STATUS_FILTERS.map((key) => ({ key, label: statusFilterLabel(key), count: statusCounts[key] }))}
      activeChip={statusFilter}
      onChipChange={setStatusFilter}
      summaryText={summaryText}
      addLabel={t.add}
      onAdd={() => router.push('/(admin)/delivery-add')}
      isMobile={grid.isMobile}
      containerStyle={grid.containerStyle}
    />
  );

  return (
    <View style={styles.wrap}>
      {controlsScroll ? null : controls}

      <FlatList
        ListHeaderComponent={controlsScroll ? <View style={styles.controlsHeader}>{controls}</View> : undefined}
        data={filtered}
        key={grid.columns}
        numColumns={grid.columns}
        columnWrapperStyle={grid.columns > 1 ? styles.gridRow : undefined}
        keyExtractor={(b) => b.id}
        contentContainerStyle={[styles.listContent, grid.containerStyle, { paddingBottom: amraleSpacing.xl + bottomInset }]}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <AdminListEmptyState
            icon={all.length ? 'filter-off-outline' : 'truck-outline'}
            title={all.length ? t.empty.noMatchTitle : t.empty.noneTitle}
            text={all.length ? t.empty.noMatchText : t.empty.noneText}
            actionLabel={all.length ? t.empty.clearFilters : t.add}
            onAction={all.length ? clearFilters : () => router.push('/(admin)/delivery-add')}
          />
        }
        renderItem={({ item }) => <DeliveryBoyCard boy={item} cellStyle={grid.cellStyle} onDelete={requestDelete} />}
      />

      <Portal>
        <Dialog
          visible={confirmOpen && !!deleteTarget}
          onDismiss={() => {
            if (del.isPending) return;
            setConfirmOpen(false);
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          style={[styles.dialog, dialogStyle]}
        >
          <Dialog.Title style={styles.dialogTitle}>{t.deleteDialog.title}</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogBody}>{deleteTarget ? t.deleteDialog.body(deleteTarget.fullName) : ''}</Text>
            {deleteError ? <Text style={styles.dialogError}>{deleteError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setConfirmOpen(false);
                setDeleteTarget(null);
                setDeleteError(null);
              }}
              disabled={del.isPending}
            >
              {c.actions.cancel}
            </Button>
            <Button onPress={onConfirmDelete} loading={del.isPending} disabled={del.isPending} textColor={amraleColors.error}>
              {c.actions.delete}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: amraleSpacing.lg },


  list: { flex: 1 },
  listContent: { paddingHorizontal: amraleSpacing.md, paddingBottom: amraleSpacing.xl, gap: ADMIN_LIST_GAP },
  gridRow: { gap: ADMIN_LIST_GAP },

  cardTop: { flexGrow: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // Pinned to the bottom, so cards sharing a grid row line their actions up.
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(53, 81, 161, 0.08)',
  },
  salary: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  salaryText: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  controlsHeader: { marginHorizontal: -ADMIN_LIST_PAD },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.inputBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.blue },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  badgeActive: { backgroundColor: 'rgba(37, 117, 252, 0.1)' },
  badgeInactive: { backgroundColor: 'rgba(195, 198, 214, 0.4)' },
  badgeTextActive: { color: amraleColors.blue },
  badgeTextInactive: { color: amraleColors.textMuted },



  dialog: { backgroundColor: amraleColors.white },
  dialogTitle: { fontFamily: amraleTypography.fontFamily.bold, color: amraleColors.text },
  dialogBody: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  dialogError: { marginTop: 10, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.error },

  pressed: { opacity: 0.88 },
});
