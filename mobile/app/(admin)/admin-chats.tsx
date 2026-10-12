import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CustomerCard,
  CustomerCardHeader,
  CustomerLoading,
  CustomerScreen,
  CustomerStateBlock,
} from '@/src/components/customer/customerUi';
import { conversationSummaries } from '@/src/domain/chat/chat';
import { useChat } from '@/src/hooks/chat/useChat';
import { useCustomers } from '@/src/hooks/customers';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';
import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import { formatRelativeDay, formatTime } from '@/src/utils/format';

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return ymd === todayYmd() ? formatTime(iso) : formatRelativeDay(ymd);
}

/** Every customer conversation, newest first, and a way to start one with any customer. */
export default function AdminChatsScreen() {
  const chat = useChat();
  const customers = useCustomers();
  const t = useStrings('admin').chats;
  const [search, setSearch] = useState('');

  const items = useMemo(() => customers.data?.items ?? [], [customers.data?.items]);
  const summaries = useMemo(() => conversationSummaries(chat.all), [chat.all]);
  const q = search.trim().toLowerCase();
  const matches = (c: { name: string; mobile?: string }) => !q || c.name.toLowerCase().includes(q) || String(c.mobile ?? '').includes(q);

  const conversations = summaries
    .map((s) => ({ summary: s, customer: items.find((c) => c.id === s.customerId) }))
    .filter(({ summary, customer }) => matches({ name: customer?.name ?? summary.last.senderName ?? t.customerFallback, mobile: customer?.mobile }));
  const withChat = new Set(summaries.map((s) => s.customerId));
  const startable = items.filter((c) => !withChat.has(c.id) && matches(c));
  const totalUnread = summaries.reduce((sum, s) => sum + s.unreadForAdmin, 0);

  const open = (customerId: string) => router.push({ pathname: '/(admin)/admin-chat', params: { customerId } });

  return (
    <CustomerScreen title={t.title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/(admin)'))}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t.searchPlaceholder}
        placeholderTextColor={amraleColors.textSubtle}
        style={styles.search}
        accessibilityLabel={t.searchA11y}
      />

      {chat.isLoading || customers.isLoading ? (
        <CustomerLoading />
      ) : (
        <>
          {conversations.length ? (
            <CustomerCard style={styles.listCard}>
              <CustomerCardHeader
                icon="chat-processing-outline"
                title={totalUnread ? t.conversationsUnread(totalUnread) : t.conversations}
              />
              {conversations.map(({ summary, customer }) => {
                const name = customer?.name ?? summary.last.senderName ?? t.customerFallback;
                const unread = summary.unreadForAdmin;
                return (
                  <Pressable
                    key={summary.customerId}
                    onPress={() => open(summary.customerId)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t.rowA11y(name, unread, summary.last.text)}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(name)}</Text>
                    </View>
                    <View style={styles.rowText}>
                      <View style={styles.rowTop}>
                        <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={[styles.when, unread > 0 && styles.whenUnread]}>{whenLabel(summary.last.createdAt)}</Text>
                      </View>
                      <View style={styles.rowTop}>
                        <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
                          {summary.last.from === 'admin' ? t.you(summary.last.text) : summary.last.text}
                        </Text>
                        {unread ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </CustomerCard>
          ) : !q ? (
            <CustomerStateBlock
              icon="chat-outline"
              title={t.emptyTitle}
              text={t.emptyText}
            />
          ) : null}

          {startable.length ? (
            <CustomerCard style={styles.listCard}>
              <CustomerCardHeader icon="account-plus-outline" title={t.startTitle} />
              {startable.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => open(c.id)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t.startA11y(c.name)}
                >
                  <View style={[styles.avatar, styles.avatarMuted]}>
                    <Text style={[styles.avatarText, styles.avatarTextMuted]}>{initials(c.name)}</Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.preview} numberOfLines={1}>
                      {[c.mobile, c.societyName].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chat-plus-outline" size={22} color={amraleColors.blue} />
                </Pressable>
              ))}
            </CustomerCard>
          ) : null}

          {q && conversations.length === 0 && startable.length === 0 ? (
            <CustomerStateBlock icon="account-search-outline" title={t.noMatch} />
          ) : null}
        </>
      )}
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    color: amraleColors.text,
  },
  listCard: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dairyTactileColors.surfaceContainer,
  },
  avatarMuted: { backgroundColor: '#eef1f5' },
  avatarText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.blue },
  avatarTextMuted: { color: amraleColors.textMuted },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  nameUnread: { fontFamily: amraleTypography.fontFamily.bold },
  when: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },
  whenUnread: { fontFamily: amraleTypography.fontFamily.semiBold, color: amraleColors.blue },
  preview: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  previewUnread: { fontFamily: amraleTypography.fontFamily.semiBold, color: amraleColors.text },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.blue,
  },
  badgeText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 11, color: amraleColors.white },
  pressed: { opacity: 0.85 },
});
