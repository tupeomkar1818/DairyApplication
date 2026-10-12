import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ChatThread } from '@/src/components/chat/ChatThread';
import { conversationFor, unreadFor } from '@/src/domain/chat/chat';
import { notifyChatMessage } from '@/src/domain/notifications/events';
import { useChat } from '@/src/hooks/chat/useChat';
import { useCustomers } from '@/src/hooks/customers';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

/** The dairy's chat with one customer. */
export default function AdminChatScreen() {
  const { customerId = '' } = useLocalSearchParams<{ customerId?: string }>();
  const customers = useCustomers();
  const chat = useChat();
  const t = useStrings('admin');

  const customer = customers.data?.items.find((c) => c.id === customerId) ?? null;
  const messages = useMemo(() => conversationFor(chat.all, customerId), [chat.all, customerId]);
  const unread = unreadFor(messages, 'admin').length;

  // Opening the conversation marks the customer's messages seen.
  const { markRead } = chat;
  const markingRef = useRef(false);
  useEffect(() => {
    if (!customerId || unread === 0 || markingRef.current) return;
    markingRef.current = true;
    markRead.mutate({ customerId, reader: 'admin' }, { onSettled: () => (markingRef.current = false) });
  }, [customerId, markRead, unread]);

  const name = customer?.name ?? messages.find((m) => m.from === 'customer')?.senderName ?? t.chats.customerFallback;

  return (
    <ChatThread
      title={name}
      subtitle={[customer?.mobile, customer?.societyName].filter(Boolean).join(' · ') || undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/admin-chats'))}
      headerRight={
        customer ? (
          <Pressable
            onPress={() => router.push({ pathname: '/(admin)/customers-detail', params: { id: customer.id } })}
            hitSlop={6}
            style={({ pressed }) => [styles.profileLink, pressed && styles.pressed]}
            accessibilityRole="link"
          >
            <Text style={styles.profileLinkText}>{t.chat.profile}</Text>
          </Pressable>
        ) : null
      }
      viewer="admin"
      messages={messages}
      isLoading={chat.isLoading || customers.isLoading}
      sending={chat.send.isPending}
      emptyTitle={t.chat.emptyTitle(name.split(' ')[0] ?? name)}
      emptyText={t.chat.emptyText}
      onSend={async (text) => {
        await chat.send.mutateAsync({ customerId, from: 'admin', text, senderName: 'Amrale Dairy' });
        notifyChatMessage({ customerId, customerName: name, from: 'admin', text });
      }}
    />
  );
}

const styles = StyleSheet.create({
  profileLink: { paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' },
  profileLinkText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.blue },
  pressed: { opacity: 0.8 },
});
