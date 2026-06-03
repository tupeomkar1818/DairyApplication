import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { router } from 'expo-router';
import { Menu } from 'react-native-paper';

import {
  customerAddressLine,
  customerListStatus,
  customerStatusBadgeColors,
  formatCustomerMobile,
} from '@/src/components/admin/customerListUtils';
import { DeleteCustomerConfirmDialog } from '@/src/components/admin/DeleteCustomerConfirmDialog';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { useCustomers, useDeleteCustomer } from '@/src/hooks/customers';
import {
  amraleColors,
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyGradient,
  dairyTactileColors,
  primaryButtonElevation,
  tactileCardElevation,
} from '@/src/theme/dairyTactile';
import { formFieldAttrs } from '@/src/theme/platformStyles';

type CustomerListSectionProps = {
  bottomInset?: number;
};

function stopNestedPress(e: GestureResponderEvent) {
  if (Platform.OS === 'web') {
    e.stopPropagation?.();
  }
}

function squishPressed(pressed: boolean) {
  return pressed ? styles.squishPressed : undefined;
}

type CustomerListCardProps = {
  customer: CustomerResponse;
  onDeletePress: (customer: CustomerResponse) => void;
};

const CustomerListCard = React.memo(function CustomerListCard({
  customer: c,
  onDeletePress,
}: CustomerListCardProps) {
  const status = customerListStatus(c);
  const badge = customerStatusBadgeColors(status.tone);
  const isDimmed = c.status === 'Inactive';

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(admin)/customers-detail', params: { id: c.id } })}
      style={({ pressed }) => [styles.card, isDimmed && styles.cardDimmed, squishPressed(pressed)]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.nameCol}>
          <View style={styles.nameRow}>
            <Text style={[styles.customerName, isDimmed && styles.textDimmed]} numberOfLines={1}>
              {c.name}
            </Text>
            <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.fg }]}>
              <Text style={[styles.badgeText, { color: badge.fg }]}>{status.label}</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={(e) => {
            stopNestedPress(e);
            router.push({ pathname: '/(admin)/customers-edit', params: { id: c.id } });
          }}
          style={({ pressed }) => [styles.editBtn, squishPressed(pressed)]}
          hitSlop={8}
          accessibilityLabel={`Edit ${c.name}`}
        >
          <MaterialCommunityIcons name="pencil-outline" size={20} color={dairyTactileColors.onSurfaceVariant} />
        </Pressable>
      </View>

      <View style={styles.infoRow}>
        <MaterialCommunityIcons name="map-marker-outline" size={18} color={dairyTactileColors.outline} />
        <Text style={[styles.infoText, isDimmed && styles.textDimmed]} numberOfLines={2}>
          {customerAddressLine(c)}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <MaterialCommunityIcons name="phone-outline" size={18} color={dairyTactileColors.outline} />
        <Text style={[styles.infoText, isDimmed && styles.textDimmed]} numberOfLines={1}>
          {formatCustomerMobile(c.mobile)}
        </Text>
      </View>

      <View style={styles.footerRow}>
        <Pressable
          onPress={(e) => {
            stopNestedPress(e);
            const tel = (c.mobile ?? '').trim();
            if (!tel) return;
            Linking.openURL(`tel:${tel}`);
          }}
          style={({ pressed }) => [styles.callBtnOuter, squishPressed(pressed)]}
          accessibilityLabel={`Call ${c.name}`}
        >
          <LinearGradient
            colors={[...dairyGradient.colors]}
            start={dairyGradient.start}
            end={dairyGradient.end}
            style={styles.callBtnGradient}
          >
            <MaterialCommunityIcons name="phone" size={18} color={dairyTactileColors.onPrimary} />
            <Text style={styles.callBtnText}>Call Now</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={(e) => {
            stopNestedPress(e);
            onDeletePress(c);
          }}
          style={({ pressed }) => [styles.deleteBtn, squishPressed(pressed)]}
          accessibilityLabel={`Delete ${c.name}`}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={22} color={dairyTactileColors.error} />
        </Pressable>
      </View>
    </Pressable>
  );
});

export const CustomerListSection = React.memo(function CustomerListSection({ bottomInset = 0 }: CustomerListSectionProps) {
  const customers = useCustomers();
  const del = useDeleteCustomer();

  const [query, setQuery] = useState('');
  const [nameSort, setNameSort] = useState<'asc' | 'desc'>('asc');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerResponse | null>(null);

  const allItems = customers.data?.items;
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const items = allItems ?? [];
    const q = deferredQuery.trim().toLowerCase();
    let next = items;
    if (q) {
      next = items.filter((c) =>
        `${c.name} ${c.mobile} ${c.address} ${c.societyName ?? ''} ${c.houseFlatNumber ?? ''}`
          .toLowerCase()
          .includes(q),
      );
    }
    return [...next].sort((a, b) => {
      const cmp = (a.name ?? '').trim().localeCompare((b.name ?? '').trim());
      return nameSort === 'asc' ? cmp : -cmp;
    });
  }, [allItems, deferredQuery, nameSort]);

  const onDeletePress = useCallback((c: CustomerResponse) => {
    setDeleteTarget(c);
    setConfirmOpen(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: CustomerResponse }) => <CustomerListCard customer={item} onDeletePress={onDeletePress} />,
    [onDeletePress],
  );

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync({ id: deleteTarget.id });
      setConfirmOpen(false);
      setDeleteTarget(null);
    } catch {
      // keep dialog open
    }
  }

  if (customers.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={amraleColors.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={amraleColors.textSubtle} />
          <TextInput
            {...formFieldAttrs('customer-search', { autoComplete: 'off' })}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, phone or address..."
            placeholderTextColor={amraleColors.textSubtle}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.actionRow}>
          <Menu
            visible={sortMenuOpen}
            onDismiss={() => setSortMenuOpen(false)}
            anchor={
              <Pressable
                onPress={() => setSortMenuOpen(true)}
                style={({ pressed }) => [styles.pillBtn, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="sort-alphabetical-ascending" size={18} color={amraleColors.blue} />
                <Text style={styles.pillBtnText}>{nameSort === 'asc' ? 'A to Z' : 'Z to A'}</Text>
              </Pressable>
            }
          >
            <Menu.Item
              title="A to Z"
              onPress={() => {
                setNameSort('asc');
                setSortMenuOpen(false);
              }}
            />
            <Menu.Item
              title="Z to A"
              onPress={() => {
                setNameSort('desc');
                setSortMenuOpen(false);
              }}
            />
          </Menu>

          <Pressable
            onPress={() => router.push('/(admin)/customers-add')}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="plus" size={18} color={amraleColors.white} />
            <Text style={styles.addBtnText}>Add Customer</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: amraleSpacing.xl + bottomInset }]}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No customers match your search.</Text>
          </View>
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
        onDismiss={() => {
          if (del.isPending) return;
          setConfirmOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={onConfirmDelete}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  controls: {
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.sm,
    gap: amraleSpacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
    paddingVertical: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  pillBtnText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: amraleColors.text,
  },
  addBtn: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.blue,
    shadowColor: amraleColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  addBtnText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 13,
    color: amraleColors.white,
  },
  pressed: { opacity: 0.88 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.xl,
    gap: 12,
  },
  card: {
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderRadius: amraleRadius.lg,
    padding: amraleSpacing.sm + 2,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 85, 199, 0.06)',
    ...tactileCardElevation(),
  },
  cardDimmed: { opacity: 0.82 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  customerName: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: amraleTypography.bodyMd.fontSize,
    lineHeight: amraleTypography.bodyMd.lineHeight,
    color: dairyTactileColors.onSurface,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: amraleTypography.caption.fontSize,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dairyTactileColors.surfaceContainerLow,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 2,
  },
  infoText: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: amraleTypography.labelMd.fontSize,
    lineHeight: amraleTypography.labelMd.lineHeight,
    color: dairyTactileColors.onSurfaceVariant,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  callBtnOuter: {
    flex: 1,
    borderRadius: amraleRadius.lg,
    overflow: 'hidden',
    ...primaryButtonElevation(),
  },
  callBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  callBtnText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: amraleTypography.bodyMd.fontSize,
    color: dairyTactileColors.onPrimary,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: amraleRadius.md,
    backgroundColor: dairyTactileColors.errorContainer,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textDimmed: { color: dairyTactileColors.outline },
  squishPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.95 }],
  },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    color: amraleColors.textMuted,
  },
});
