import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Menu } from 'react-native-paper';

import {
  customerAddressLine,
  customerInitials,
  customerListStatus,
  customerStatusBadgeColors,
  formatCustomerMobile,
} from '@/src/components/admin/customerListUtils';
import { DeleteCustomerConfirmDialog } from '@/src/components/admin/DeleteCustomerConfirmDialog';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { useCustomers, useDeleteCustomer } from '@/src/hooks/customers';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

type CustomerListSectionProps = {
  bottomInset?: number;
  onAddCustomer: () => void;
  onEditCustomer: (customer: CustomerResponse) => void;
};

export function CustomerListSection({ bottomInset = 0, onAddCustomer, onEditCustomer }: CustomerListSectionProps) {
  const customers = useCustomers();
  const del = useDeleteCustomer();

  const [query, setQuery] = useState('');
  const [nameSort, setNameSort] = useState<'asc' | 'desc'>('asc');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerResponse | null>(null);

  const all = customers.data?.items ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = all;
    if (q) {
      items = items.filter((c) =>
        `${c.name} ${c.mobile} ${c.address} ${c.societyName ?? ''} ${c.houseFlatNumber ?? ''}`
          .toLowerCase()
          .includes(q),
      );
    }
    items = [...items].sort((a, b) => {
      const cmp = (a.name ?? '').trim().localeCompare((b.name ?? '').trim());
      return nameSort === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [all, nameSort, query]);

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

          <Pressable onPress={onAddCustomer} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="account-plus-outline" size={18} color={amraleColors.white} />
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
        renderItem={({ item: c }) => {
          const status = customerListStatus(c);
          const badge = customerStatusBadgeColors(status.tone);
          const isDimmed = c.status === 'Inactive';

          return (
            <Pressable
              onPress={() => router.push({ pathname: '/(admin)/customers-detail', params: { id: c.id } })}
              style={({ pressed }) => [styles.card, isDimmed && styles.cardDimmed, pressed && styles.pressed]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{customerInitials(c.name)}</Text>
                </View>

                <View style={styles.nameCol}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.customerName, isDimmed && styles.textDimmed]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.fg }]}>{status.label}</Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={() => onEditCustomer(c)}
                  style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                  hitSlop={8}
                  accessibilityLabel={`Edit ${c.name}`}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={20} color={amraleColors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={18} color={amraleColors.textSubtle} />
                <Text style={[styles.infoText, isDimmed && styles.textDimmed]} numberOfLines={2}>
                  {customerAddressLine(c)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="phone-outline" size={18} color={amraleColors.textSubtle} />
                <Text style={[styles.infoText, isDimmed && styles.textDimmed]} numberOfLines={1}>
                  {formatCustomerMobile(c.mobile)}
                </Text>
              </View>

              <View style={styles.footerRow}>
                <Pressable
                  onPress={() => {
                    const tel = (c.mobile ?? '').trim();
                    if (!tel) return;
                    Linking.openURL(`tel:${tel}`);
                  }}
                  style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
                  accessibilityLabel={`Call ${c.name}`}
                >
                  <MaterialCommunityIcons name="phone" size={18} color={amraleColors.white} />
                  <Text style={styles.callBtnText}>Call Now</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setDeleteTarget(c);
                    setConfirmOpen(true);
                  }}
                  style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                  accessibilityLabel={`Delete ${c.name}`}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color={amraleColors.error} />
                </Pressable>
              </View>
            </Pressable>
          );
        }}
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
}

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
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.xl,
    gap: 12,
  },
  card: {
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.06)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  cardDimmed: { opacity: 0.78 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: amraleColors.inputBgLight,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    color: amraleColors.blue,
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
    fontSize: 16,
    color: amraleColors.text,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
  },
  badgeText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  editBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 14,
    lineHeight: 20,
    color: amraleColors.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.blue,
    shadowColor: amraleColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  callBtnText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    color: amraleColors.white,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: amraleRadius.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textDimmed: { color: amraleColors.textSubtle },
  pressed: { opacity: 0.88 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    color: amraleColors.textMuted,
  },
});
