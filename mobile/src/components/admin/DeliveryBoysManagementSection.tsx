import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { Button, Card, Dialog, Menu, Portal, Text, TextInput } from 'react-native-paper';
import { router } from 'expo-router';

import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import { useDeleteDeliveryBoy, useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { computeListCardWidth, useResponsiveLayout } from '@/src/utils/responsiveLayout';

const COLORS = {
  primary: '#2563EB',
  secondary: '#60A5FA',
  text: '#1E293B',
};

function routeLabel(routeName: string | undefined): string {
  const s = (routeName ?? '').trim();
  return s ? s : '—';
}

export function DeliveryBoysManagementSection() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { width, listColumns, isMobile } = useResponsiveLayout();

  const deliveryBoys = useDeliveryBoys();
  const del = useDeleteDeliveryBoy();

  const [query, setQuery] = useState('');
  const [nameSort, setNameSort] = useState<'asc' | 'desc'>('asc');
  const [nameSortMenuOpen, setNameSortMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryBoyResponse | null>(null);

  const columns = listColumns;

  const cardWidth = useMemo(() => computeListCardWidth(width, columns), [columns, width]);

  const sectionCard = isDark ? styles.sectionCardDark : styles.sectionCardLight;
  const textMain = isDark ? styles.textOnDark : styles.textOnLight;
  const textSub = isDark ? styles.subtleOnDark : styles.subtleOnLight;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = deliveryBoys.data?.items ?? [];
    if (!q) return items;
    return items.filter((b) => `${b.fullName ?? ''} ${b.mobileNumber ?? ''}`.toLowerCase().includes(q));
  }, [deliveryBoys.data?.items, query]);

  const sortedDeliveryBoys = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      const an = (a.fullName ?? '').trim().toLowerCase();
      const bn = (b.fullName ?? '').trim().toLowerCase();
      const cmp = an.localeCompare(bn);
      return nameSort === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [filtered, nameSort]);

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    await del.mutateAsync({ id: deleteTarget.id });
    setConfirmOpen(false);
    setDeleteTarget(null);
  }

  return (
    <>
      <FlatList
        data={sortedDeliveryBoys}
        key={columns}
        numColumns={columns}
        keyExtractor={(b) => b.id}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        contentContainerStyle={[styles.container, styles.containerCentered]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={Math.min(12, sortedDeliveryBoys.length)}
        windowSize={9}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={24}
        ListHeaderComponent={
          <View style={styles.controlsRow}>
            <TextInput
              mode="outlined"
              placeholder="Search delivery boy name or mobile number"
              value={query}
              onChangeText={setQuery}
              style={[styles.search, sectionCard]}
              left={<TextInput.Icon icon="magnify" />}
              dense
            />

            <Menu
              visible={nameSortMenuOpen}
              onDismiss={() => setNameSortMenuOpen(false)}
              anchor={
                <Pressable
                  onPress={() => setNameSortMenuOpen(true)}
                  style={({ pressed }) => [styles.chip, sectionCard, pressed && styles.pressed]}
                >
                  <MaterialCommunityIcons name="sort" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  <Text variant="labelLarge" style={textMain}>
                    {nameSort === 'asc' ? 'Name (A to Z)' : 'Name (Z to A)'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
                </Pressable>
              }
            >
              <Menu.Item
                title="Name (A to Z)"
                onPress={() => {
                  setNameSort('asc');
                  setNameSortMenuOpen(false);
                }}
              />
              <Menu.Item
                title="Name (Z to A)"
                onPress={() => {
                  setNameSort('desc');
                  setNameSortMenuOpen(false);
                }}
              />
            </Menu>

            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addGradient}
            >
              <Pressable
                onPress={() => router.push('/(admin)/delivery-add')}
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="plus" size={18} color="white" />
                <Text variant="labelLarge" style={styles.addText}>
                  Add Delivery Boy
                </Text>
              </Pressable>
            </LinearGradient>

            {sortedDeliveryBoys.length === 0 ? (
              <View style={styles.emptyState}>
                <Text variant="bodyMedium" style={isDark ? styles.textOnDark : styles.textOnLight}>
                  No delivery boys found.
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: b }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/(admin)/delivery-detail', params: { id: b.id } })}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Card style={[styles.deliveryCard, sectionCard, { width: cardWidth }]} mode="elevated">
              <Card.Content style={styles.cardBody}>
                <View style={styles.badgeRow}>
                  <View style={[styles.statusBadge, b.status === 'Active' ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                    <Text variant="labelSmall" style={styles.statusBadgeText}>
                      {b.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.inlineRow}>
                  <Text variant="titleSmall" style={[styles.name, textMain]} numberOfLines={1}>
                    {b.fullName}
                  </Text>
                  <Text variant="bodySmall" style={[textSub, styles.sep]}>
                    {' | '}
                  </Text>
                  <Text variant="bodySmall" style={[textSub, styles.routeInline]} numberOfLines={1}>
                    {routeLabel(b.primaryRouteName)}
                  </Text>
                  <Text variant="bodySmall" style={[textSub, styles.sep]}>
                    {' | '}
                  </Text>
                  <Text variant="bodySmall" style={[textSub, styles.mobileInline]} numberOfLines={1}>
                    {b.mobileNumber ?? '—'}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      const tel = (b.mobileNumber ?? '').trim();
                      if (!tel) return;
                      Linking.openURL(`tel:${tel}`);
                    }}
                    style={({ pressed }) => [styles.actionIconBtn, styles.callBtn, pressed && styles.pressed]}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons name="phone" size={16} color="white" />
                  </Pressable>

                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/(admin)/delivery-edit', params: { id: b.id } });
                    }}
                    style={({ pressed }) => [styles.actionIconBtn, styles.neutralBtn, pressed && styles.pressed]}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  </Pressable>

                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(b);
                      setConfirmOpen(true);
                    }}
                    style={({ pressed }) => [styles.actionIconBtn, styles.neutralBtn, pressed && styles.pressed]}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  </Pressable>
                </View>
              </Card.Content>
            </Card>
          </Pressable>
        )}
      />

      <Portal>
        <Dialog
          visible={confirmOpen}
          onDismiss={() => {
            if (del.isPending) return;
            setConfirmOpen(false);
            setDeleteTarget(null);
          }}
          style={[isDark ? styles.dialogDark : styles.dialogLight, isMobile && styles.dialogMobile]}
        >
          <Dialog.Title>Delete delivery boy?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={isDark ? styles.textOnDark : styles.textOnLight}>
              {deleteTarget ? `Are you sure you want to delete "${deleteTarget.fullName}"?` : 'Are you sure?'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setConfirmOpen(false);
                setDeleteTarget(null);
              }}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button onPress={onConfirmDelete} loading={del.isPending} disabled={del.isPending} textColor="#B91C1C">
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 24, gap: 12 },
  containerCentered: { width: '100%', maxWidth: 1200, alignSelf: 'center' },

  controlsRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 0, flexGrow: 1 },

  sectionCardLight: { backgroundColor: 'white', borderColor: 'rgba(37,99,235,0.10)' },
  sectionCardDark: { backgroundColor: 'rgba(15,23,42,0.70)', borderColor: 'rgba(255,255,255,0.10)' },

  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
  subtleOnLight: { color: 'rgba(30,41,59,0.70)' },
  subtleOnDark: { color: 'rgba(255,255,255,0.78)' },

  addGradient: { borderRadius: 16 },
  addBtn: { height: 56, paddingHorizontal: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  addText: { color: 'white', fontWeight: '900' },
  chip: { height: 56, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },

  gridRow: { gap: 12 },
  emptyState: { width: '100%', paddingVertical: 36, alignItems: 'center', justifyContent: 'center' },

  deliveryCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  cardBody: { paddingVertical: 10, paddingHorizontal: 14, height: 102, justifyContent: 'space-between' },

  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeActive: { backgroundColor: 'rgba(34,197,94,0.90)' },
  statusBadgeInactive: { backgroundColor: 'rgba(239,68,68,0.90)' },
  statusBadgeText: { color: 'white', fontWeight: '900', fontSize: 11, lineHeight: 13 },

  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 0, flexWrap: 'wrap', flexShrink: 1 },
  sep: { fontSize: 12, lineHeight: 16, opacity: 0.55 },
  name: { fontWeight: '800', fontSize: 16, lineHeight: 20, flexShrink: 1, minWidth: 0 },
  routeInline: { fontSize: 13, lineHeight: 16, opacity: 0.85, flexShrink: 1, minWidth: 0 },
  mobileInline: { fontSize: 13, lineHeight: 16, opacity: 0.85, flexShrink: 0 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-start', marginTop: 2 },
  actionIconBtn: { width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  callBtn: { backgroundColor: 'rgba(34,197,94,0.96)' },
  neutralBtn: { backgroundColor: 'rgba(148,163,184,0.16)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)' },

  dialogLight: { backgroundColor: '#FFFFFF', borderRadius: 16 },
  dialogDark: { backgroundColor: '#0F172A', borderRadius: 16 },
  dialogMobile: { alignSelf: 'center', width: '92%', maxWidth: 420 },
});
