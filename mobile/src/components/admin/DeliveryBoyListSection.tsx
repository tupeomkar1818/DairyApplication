import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput, Tooltip } from 'react-native-paper';
import { router } from 'expo-router';

import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import { useDeleteDeliveryBoy, useDeliveryBoys } from '@/src/hooks/deliveryBoys';

const COLORS = {
  primary: '#2563EB',
  accent: '#22C55E',
  text: '#1E293B',
  muted: '#64748B',
};

function formatJoiningDate(iso: string | undefined): string {
  if (!iso) return '—';
  const s = String(iso).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

function formatINR(amount: unknown): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n);
  const s = String(Math.max(0, rounded));
  return `₹${s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function attendanceBadge(status: unknown): { label: string; bg: string; text: string } {
  const st = typeof status === 'string' ? status : '';
  switch (st) {
    case 'Present':
      return { label: 'Present', bg: 'rgba(34,197,94,0.95)', text: '#FFFFFF' };
    case 'Late Arrival':
      return { label: 'Late Arrival', bg: 'rgba(245,158,11,0.95)', text: '#111827' };
    case 'Absent':
      return { label: 'Absent', bg: 'rgba(239,68,68,0.95)', text: '#FFFFFF' };
    case 'On Leave':
      return { label: 'On Leave', bg: 'rgba(59,130,246,0.95)', text: '#FFFFFF' };
    case 'Paid Leave':
    case 'Unpaid Leave':
      return { label: st, bg: 'rgba(59,130,246,0.95)', text: '#FFFFFF' };
    default:
      return { label: st || '—', bg: 'rgba(148,163,184,0.35)', text: '#0F172A' };
  }
}

function MaybeTooltip({ title, children }: { title: string; children: React.ReactElement<any> }) {
  if (Platform.OS !== 'web') return children;
  return <Tooltip title={title}>{children as any}</Tooltip>;
}

export type DeliveryBoyListSectionProps = {
  /** Horizontal inset from screen edges (should match parent scroll padding). */
  horizontalPadding?: number;
  /** Cap content width on very wide screens so cards stay balanced. */
  maxContentWidth?: number;
};

export function DeliveryBoyListSection({ horizontalPadding = 16, maxContentWidth = 1200 }: DeliveryBoyListSectionProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { width: windowWidth } = useWindowDimensions();

  const deliveryBoys = useDeliveryBoys();
  const del = useDeleteDeliveryBoy();

  const [query, setQuery] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryBoyResponse | null>(null);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  const columns = useMemo(() => {
    if (windowWidth >= 1024) return 3;
    if (windowWidth >= 768) return 2;
    return 1;
  }, [windowWidth]);

  const contentWidth = useMemo(() => {
    const raw = Math.max(0, windowWidth - horizontalPadding * 2);
    return Math.min(raw, maxContentWidth);
  }, [windowWidth, horizontalPadding, maxContentWidth]);

  const gap = 14;
  const cardWidth = useMemo(() => {
    if (columns <= 1) return contentWidth;
    return Math.floor((contentWidth - gap * (columns - 1)) / columns);
  }, [columns, contentWidth]);

  const cardSurface = isDark ? styles.cardDark : styles.cardLight;
  const textMain = isDark ? styles.textOnDark : styles.textOnLight;
  const textSub = isDark ? styles.subtleOnDark : styles.subtleOnLight;
  const searchOutline = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(226,232,240,0.98)';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = deliveryBoys.data?.items ?? [];
    if (!q) return items;
    return items.filter((b) => `${b.fullName} ${b.mobileNumber} ${b.primaryRouteName}`.toLowerCase().includes(q));
  }, [deliveryBoys.data?.items, query]);

  React.useEffect(() => {
    const t = setInterval(() => {
      deliveryBoys.refetch();
    }, 5000);
    return () => clearInterval(t);
  }, [deliveryBoys]);

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

  return (
    <View style={[styles.root, { paddingHorizontal: horizontalPadding, paddingTop: 16 }]}>
      <View style={[styles.inner, { width: contentWidth }]}>
        <View style={[styles.toolbar, isMobile ? styles.toolbarMobile : styles.toolbarDesktop]}>
          <TextInput
            mode="outlined"
            placeholder="Search delivery boy"
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, isMobile && styles.searchInputMobile]}
            contentStyle={styles.searchContent}
            outlineStyle={styles.searchOutline}
            outlineColor={searchOutline}
            activeOutlineColor={COLORS.primary}
            left={<TextInput.Icon icon="magnify" />}
            dense
          />
          <Button
            mode="contained"
            icon="plus"
            onPress={() => router.push('/(admin)/delivery-add')}
            buttonColor={COLORS.primary}
            style={[styles.addButton, isMobile && styles.addButtonMobile]}
            contentStyle={styles.addButtonContent}
            labelStyle={styles.addButtonLabel}
          >
            Add Delivery Boy
          </Button>
        </View>

        <View style={[styles.grid, { gap, marginTop: isTablet ? 18 : 20 }]}>
          {filtered.length === 0 ? (
            <View style={[styles.emptyState, { width: contentWidth }]}>
              <Text variant="bodyMedium" style={textSub}>
                {query.trim()
                  ? 'No delivery boys match your search.'
                  : (deliveryBoys.data?.items?.length ?? 0) === 0
                    ? 'No delivery boys yet. Add one to get started.'
                    : 'No delivery boys match your search.'}
              </Text>
            </View>
          ) : null}

          {filtered.map((b) => (
            <View key={b.id} style={[styles.card, cardSurface, columns === 1 ? { width: '100%' } : { width: cardWidth }]}>
              <View style={styles.cardInner}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.headerLeft}>
                    <Text variant="titleMedium" style={[styles.name, textMain]} numberOfLines={1}>
                      {b.fullName}
                    </Text>
                    <Text variant="bodySmall" style={[styles.mobileValue, textSub]} numberOfLines={1}>
                      {b.mobileNumber?.trim() ? b.mobileNumber : '—'}
                    </Text>
                  </View>

                  <View style={[styles.badge, b.status === 'Active' ? styles.badgeActive : styles.badgeInactive]}>
                    <Text variant="labelSmall" style={styles.badgeText}>
                      {b.status === 'Active' ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeRow}>
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={16}
                    color={isDark ? 'rgba(226,232,240,0.88)' : COLORS.primary}
                  />
                  <Text variant="bodyMedium" style={[styles.routeText, textSub]} numberOfLines={1}>
                    {b.primaryRouteName?.trim() ? b.primaryRouteName : '—'}
                  </Text>
                </View>

                <View style={styles.details}>
                  <View style={styles.kvRow}>
                    <MaterialCommunityIcons name="calendar" size={16} color={isDark ? 'rgba(226,232,240,0.72)' : COLORS.muted} />
                    <View style={styles.kvText}>
                      <Text variant="labelSmall" style={styles.kvLabel}>
                        Joining Date
                      </Text>
                      <Text variant="bodyMedium" style={[styles.kvValue, textMain]} numberOfLines={1}>
                        {formatJoiningDate(b.joiningDate)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.kvRow}>
                    <MaterialCommunityIcons name="account-clock" size={16} color={isDark ? 'rgba(226,232,240,0.72)' : COLORS.muted} />
                    <View style={styles.kvText}>
                      <Text variant="labelSmall" style={styles.kvLabel}>
                        Attendance Status
                      </Text>
                      <View
                        style={[
                          styles.attendanceBadge,
                          {
                            backgroundColor: attendanceBadge(b.currentAttendanceStatus).bg,
                          },
                        ]}
                      >
                        <Text
                          variant="labelSmall"
                          style={[
                            styles.attendanceText,
                            {
                              color: attendanceBadge(b.currentAttendanceStatus).text,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {attendanceBadge(b.currentAttendanceStatus).label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.kvRow}>
                    <MaterialCommunityIcons name="cash-multiple" size={16} color={isDark ? 'rgba(226,232,240,0.72)' : COLORS.muted} />
                    <View style={styles.kvText}>
                      <Text variant="labelSmall" style={styles.kvLabel}>
                        Salary Type
                      </Text>
                      <Text variant="bodyMedium" style={[styles.kvValue, textMain]} numberOfLines={1}>
                        {b.salaryType ?? 'Fixed Monthly Salary'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.kvRow}>
                    <MaterialCommunityIcons name="currency-inr" size={16} color={isDark ? 'rgba(226,232,240,0.72)' : COLORS.muted} />
                    <View style={styles.kvText}>
                      <Text variant="labelSmall" style={styles.kvLabel}>
                        Monthly Salary
                      </Text>
                      <Text variant="bodyMedium" style={[styles.kvValue, textMain]} numberOfLines={1}>
                        {formatINR((b as any).monthlySalary)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <MaybeTooltip title="Call">
                    <Pressable
                      onPress={() => {
                        const tel = (b.mobileNumber ?? '').trim();
                        if (!tel) return;
                        Linking.openURL(`tel:${tel}`);
                      }}
                      style={({ pressed }) => [styles.actionBtn, styles.actionCall, pressed && styles.pressed]}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Call"
                    >
                      <MaterialCommunityIcons name="phone" size={18} color="#FFFFFF" />
                    </Pressable>
                  </MaybeTooltip>

                  <MaybeTooltip title="View">
                    <Pressable
                      onPress={() => router.push({ pathname: '/(admin)/delivery-detail', params: { id: b.id } })}
                      style={({ pressed }) => [styles.actionBtn, styles.actionView, pressed && styles.pressed, isDark && styles.actionViewDark]}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="View"
                    >
                      <MaterialCommunityIcons name="eye-outline" size={18} color={isDark ? '#E2E8F0' : COLORS.muted} />
                    </Pressable>
                  </MaybeTooltip>

                  <MaybeTooltip title="Edit">
                    <Pressable
                      onPress={() => router.push({ pathname: '/(admin)/delivery-edit', params: { id: b.id } })}
                      style={({ pressed }) => [styles.actionBtn, styles.actionEdit, pressed && styles.pressed]}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Edit"
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={18} color="#FFFFFF" />
                    </Pressable>
                  </MaybeTooltip>

                  <MaybeTooltip title="Delete">
                    <Pressable
                      onPress={() => {
                        setDeleteTarget(b);
                        setConfirmOpen(true);
                      }}
                      style={({ pressed }) => [styles.actionBtn, styles.actionDelete, pressed && styles.pressed]}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Delete"
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FFFFFF" />
                    </Pressable>
                  </MaybeTooltip>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Portal>
        <Dialog
          visible={confirmOpen}
          onDismiss={() => {
            if (del.isPending) return;
            setConfirmOpen(false);
            setDeleteTarget(null);
          }}
          style={isDark ? styles.dialogDark : styles.dialogLight}
        >
          <Dialog.Title>Delete delivery boy?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={textSub}>
              {deleteTarget ? `Are you sure you want to delete "${deleteTarget.fullName}"?` : 'Are you sure you want to delete this delivery boy?'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  inner: { alignSelf: 'center' },
  toolbar: { gap: 12 },
  toolbarDesktop: { flexDirection: 'row', alignItems: 'center' },
  toolbarMobile: { flexDirection: 'column', alignItems: 'stretch' },
  searchInput: { flex: 1, minWidth: 0, backgroundColor: 'transparent' },
  searchInputMobile: { width: '100%', flex: 0 },
  searchContent: { minHeight: 48 },
  searchOutline: { borderRadius: 12 },
  addButton: {
    borderRadius: 12,
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  addButtonMobile: { width: '100%' },
  addButtonContent: { height: 48 },
  addButtonLabel: { fontWeight: '700', fontSize: 15 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  emptyState: { paddingVertical: 28, alignItems: 'center' },

  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    overflow: 'hidden',
  },
  cardLight: { backgroundColor: '#FFFFFF', borderColor: 'rgba(15,23,42,0.08)' },
  cardDark: { backgroundColor: 'rgba(22,30,50,0.94)', borderColor: 'rgba(255,255,255,0.1)' },
  cardInner: { padding: 16 },

  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  headerLeft: { flex: 1, minWidth: 0 },
  mobileValue: { marginTop: 4, fontWeight: '700', opacity: 0.9 },

  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  routeText: { flex: 1, fontWeight: '700' },

  details: { gap: 10, marginTop: 14 },
  kvRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kvText: { flex: 1, minWidth: 0 },
  kvLabel: { fontSize: 11, fontWeight: '800', opacity: 0.68 },
  kvValue: { fontWeight: '900' },

  attendanceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  attendanceText: { fontWeight: '900', fontSize: 12 },

  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeActive: { backgroundColor: 'rgba(34,197,94,0.92)' },
  badgeInactive: { backgroundColor: 'rgba(239,68,68,0.88)' },
  badgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },

  name: { fontWeight: '700', marginTop: 2 },

  fieldRow: { gap: 2 },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.35 },
  fieldValue: { fontSize: 14, lineHeight: 20 },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.35)',
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCall: { backgroundColor: COLORS.accent },
  actionView: { backgroundColor: 'rgba(226,232,240,0.85)' },
  actionViewDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  actionEdit: { backgroundColor: COLORS.primary },
  actionDelete: { backgroundColor: 'rgba(239,68,68,0.95)' },
  actionNeutral: { backgroundColor: 'rgba(226,232,240,0.85)' },
  actionNeutralDark: { backgroundColor: 'rgba(255,255,255,0.08)' },

  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },

  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(248,250,252,0.98)' },
  subtleOnLight: { color: 'rgba(71,85,105,0.82)' },
  subtleOnDark: { color: 'rgba(148,163,184,0.9)' },

  dialogLight: { backgroundColor: '#FFFFFF', borderRadius: 16 },
  dialogDark: { backgroundColor: '#0F172A', borderRadius: 16 },
});
