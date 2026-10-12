import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import { router } from 'expo-router';

import { ADMIN_LIST_GAP, useAdminListGrid } from '@/src/components/admin/AdminListScreenLayout';
import {
  customerAddressLine,
  customerInitials,
  customerListStatus,
  customerStatusBadgeColors,
  formatCustomerMobile,
} from '@/src/components/admin/customerListUtils';
import { DeleteCustomerConfirmDialog } from '@/src/components/admin/DeleteCustomerConfirmDialog';
import {
  AdminListControls,
  AdminListEmptyState,
  AdminListErrorState,
  AdminListIconButton,
  adminListCardStyles as cardStyles,
  type AdminListSortOption,
} from '@/src/components/shared/adminListUi';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { useCustomers, useDeleteCustomer } from '@/src/hooks/customers';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

type SortBy = 'name_asc' | 'name_desc' | 'route_asc';
type StatusFilter = 'all' | 'Active' | 'Inactive';

/** Status chips in order; each label is looked up in the current language at render. */
const STATUS_FILTERS: { key: StatusFilter; labelKey: 'all' | 'active' | 'inactive' }[] = [
  { key: 'all', labelKey: 'all' },
  { key: 'Active', labelKey: 'active' },
  { key: 'Inactive', labelKey: 'inactive' },
];

const CustomerListCard = React.memo(function CustomerListCard({
  customer: c,
  onDeletePress,
  cellStyle,
}: {
  customer: CustomerResponse;
  onDeletePress: (customer: CustomerResponse) => void;
  cellStyle?: ViewStyle;
}) {
  const t = useStrings('customers').list;
  const status = customerListStatus(c);
  const badge = customerStatusBadgeColors(status.tone);
  const isDimmed = c.status === 'Inactive';
  const tel = (c.mobile ?? '').trim();

  return (
    // The whole card opens the customer details; the call/edit/delete buttons inside handle their own taps.
    <Pressable
      onPress={() => router.push({ pathname: '/(admin)/customers-detail', params: { id: c.id } })}
      style={({ pressed }) => [
        cardStyles.card,
        cardStyles.cardRow,
        cellStyle,
        isDimmed && cardStyles.cardDimmed,
        pressed && cardStyles.cardPressed,
      ]}
      // No `button` role: on web that renders a <button>, and the action buttons inside would be invalid nested buttons.
      accessibilityLabel={t.viewDetailsFor(c.name)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{customerInitials(c.name ?? '')}</Text>
      </View>

      <View style={styles.body}>
        <View style={cardStyles.nameRow}>
          <Text style={cardStyles.name} numberOfLines={3}>
            {c.name}
          </Text>
          <View style={[cardStyles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[cardStyles.badgeText, { color: badge.fg }]}>{status.label}</Text>
          </View>
        </View>

        <View style={cardStyles.metaLine}>
          <MaterialCommunityIcons name="map-marker-outline" size={14} color={amraleColors.textSubtle} />
          <Text style={cardStyles.metaText} numberOfLines={2}>
            {customerAddressLine(c)}
          </Text>
        </View>
        <View style={cardStyles.metaLine}>
          <MaterialCommunityIcons name="phone-outline" size={14} color={amraleColors.textSubtle} />
          <Text style={cardStyles.metaText} numberOfLines={1}>
            {formatCustomerMobile(c.mobile ?? '')}
          </Text>
        </View>
        <View style={cardStyles.metaLine}>
          <MaterialCommunityIcons name="routes" size={14} color={amraleColors.textSubtle} />
          <Text style={cardStyles.metaText} numberOfLines={2}>
            {(c.routeName ?? '').trim() || t.noRoute}
          </Text>
        </View>
      </View>

      <View style={cardStyles.iconCol}>
        <AdminListIconButton
          icon="phone"
          tone="green"
          label={t.callName(c.name)}
          disabled={!tel}
          onPress={() => {
            if (!tel) return;
            void Linking.openURL(`tel:${tel}`);
          }}
        />
        <AdminListIconButton
          icon="pencil-outline"
          tone="blue"
          label={t.editName(c.name)}
          onPress={() => router.push({ pathname: '/(admin)/customers-edit', params: { id: c.id } })}
        />
        <AdminListIconButton icon="trash-can-outline" tone="red" label={t.deleteName(c.name)} onPress={() => onDeletePress(c)} />
      </View>
    </Pressable>
  );
});

export const CustomerListSection = React.memo(function CustomerListSection({ bottomInset = 0 }: { bottomInset?: number }) {
  const t = useStrings('customers').list;
  const customers = useCustomers();
  const del = useDeleteCustomer();
  const grid = useAdminListGrid();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name_asc');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const all = customers.data?.items ?? [];
  const deferredQuery = useDeferredValue(query);
  const activeCount = useMemo(() => all.filter((c) => c.status !== 'Inactive').length, [all]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    let items = all;

    if (statusFilter === 'Active') items = items.filter((c) => c.status !== 'Inactive');
    if (statusFilter === 'Inactive') items = items.filter((c) => c.status === 'Inactive');
    if (q) {
      items = items.filter((c) =>
        `${c.name} ${c.mobile} ${c.address} ${c.societyName ?? ''} ${c.houseFlatNumber ?? ''} ${c.routeName ?? ''}`
          .toLowerCase()
          .includes(q),
      );
    }

    switch (sortBy) {
      case 'name_desc':
        return [...items].sort((a, b) => (b.name ?? '').trim().localeCompare((a.name ?? '').trim()));
      case 'route_asc':
        return [...items].sort((a, b) => (a.routeName ?? '').localeCompare(b.routeName ?? ''));
      case 'name_asc':
      default:
        return [...items].sort((a, b) => (a.name ?? '').trim().localeCompare((b.name ?? '').trim()));
    }
  }, [all, deferredQuery, sortBy, statusFilter]);

  const sortOptions = useMemo<AdminListSortOption<SortBy>[]>(
    () => [
      { key: 'name_asc', label: t.sort.nameAsc, short: t.sort.nameAscShort, icon: 'sort-alphabetical-ascending' },
      { key: 'name_desc', label: t.sort.nameDesc, short: t.sort.nameDescShort, icon: 'sort-alphabetical-descending' },
      { key: 'route_asc', label: t.sort.routeAsc, short: t.sort.routeAscShort, icon: 'routes' },
    ],
    // `t` is a different object per language, so the labels follow a language change.
    [t],
  );

  const isFiltering = query.trim() !== '' || statusFilter !== 'all';
  const summaryText = isFiltering ? t.showing(filtered.length, all.length) : t.summary(all.length, activeCount);

  const onDeletePress = useCallback((c: CustomerResponse) => {
    setDeleteTarget(c);
    setDeleteError(null);
    setConfirmOpen(true);
  }, []);

  function clearFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await del.mutateAsync({ id: deleteTarget.id });
      setConfirmOpen(false);
      setDeleteTarget(null);
    } catch (e) {
      // Keep the dialog open and say why, instead of silently doing nothing.
      setDeleteError(
        e instanceof Error && e.message ? t.couldNotDeleteReason(e.message) : t.couldNotDelete,
      );
    }
  }

  const renderItem = useCallback(
    ({ item }: { item: CustomerResponse }) => (
      <CustomerListCard customer={item} onDeletePress={onDeletePress} cellStyle={grid.cellStyle} />
    ),
    [onDeletePress, grid.cellStyle],
  );

  if (customers.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={amraleColors.blue} size="large" />
      </View>
    );
  }

  if (customers.isError && !all.length) {
    return <AdminListErrorState title={t.loadError} onRetry={() => void customers.refetch()} />;
  }

  return (
    <View style={styles.wrap}>
      <AdminListControls
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={t.searchPlaceholder}
        searchFieldName="customer-search"
        sortOptions={sortOptions}
        sortBy={sortBy}
        onSortChange={setSortBy}
        chips={STATUS_FILTERS.map(({ key, labelKey }) => ({
          key,
          label: t.filters[labelKey],
          count: key === 'all' ? all.length : key === 'Active' ? activeCount : all.length - activeCount,
        }))}
        activeChip={statusFilter}
        onChipChange={setStatusFilter}
        summaryText={summaryText}
        addLabel={t.addCustomer}
        onAdd={() => router.push('/(admin)/customers-add')}
        isMobile={grid.isMobile}
        containerStyle={grid.containerStyle}
      />

      <FlatList
        data={filtered}
        key={grid.columns}
        numColumns={grid.columns}
        columnWrapperStyle={grid.columns > 1 ? styles.gridRow : undefined}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.listContent, grid.containerStyle, { paddingBottom: amraleSpacing.xl + bottomInset }]}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <AdminListEmptyState
            icon={all.length ? 'filter-off-outline' : 'account-group-outline'}
            title={all.length ? t.noMatchTitle : t.emptyTitle}
            text={all.length ? t.noMatchText : t.emptyText}
            actionLabel={all.length ? t.clearFilters : t.addCustomer}
            onAction={all.length ? clearFilters : () => router.push('/(admin)/customers-add')}
          />
        }
        renderItem={renderItem}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
      />

      <DeleteCustomerConfirmDialog
        visible={confirmOpen && !!deleteTarget}
        customerName={deleteTarget?.name ?? ''}
        loading={del.isPending}
        errorMessage={deleteError}
        onDismiss={() => {
          if (del.isPending) return;
          setConfirmOpen(false);
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={onConfirmDelete}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: amraleSpacing.lg },
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
