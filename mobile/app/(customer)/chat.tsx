import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';

import { ChatThread } from '@/src/components/chat/ChatThread';
import { CustomerLoading, CustomerNotLinked, CustomerScreen } from '@/src/components/customer/customerUi';
import { chatStarters, conversationFor, unreadFor } from '@/src/domain/chat/chat';
import { notifyChatMessage } from '@/src/domain/notifications/events';
import { useChat } from '@/src/hooks/chat/useChat';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';

/** The customer's chat with the dairy. */
export default function CustomerChatScreen() {
  const { customer, isLoading } = useMyCustomer();
  const chat = useChat();
  const lang = useLanguage();
  const inbox = useStrings('inbox');
  const t = inbox.chat;
  // Screens that cannot make a change themselves (a day closed at 9 pm) open the chat with the request written.
  const params = useLocalSearchParams<{ message?: string }>();

  const messages = useMemo(() => (customer ? conversationFor(chat.all, customer.id) : []), [chat.all, customer]);
  const unread = customer ? unreadFor(messages, 'customer').length : 0;
  const starters = useMemo(() => chatStarters(lang), [lang]);

  // Opening the chat is reading it: the dairy's replies are marked seen.
  const { markRead } = chat;
  const markingRef = useRef(false);
  useEffect(() => {
    if (!customer || unread === 0 || markingRef.current) return;
    markingRef.current = true;
    markRead.mutate({ customerId: customer.id, reader: 'customer' }, { onSettled: () => (markingRef.current = false) });
  }, [customer, markRead, unread]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(customer)'));

  if (isLoading || !customer) {
    return (
      <CustomerScreen title={t.screenTitle} onBack={goBack}>
        {isLoading ? <CustomerLoading /> : <CustomerNotLinked />}
      </CustomerScreen>
    );
  }

  return (
    <ChatThread
      title={inbox.dairyName}
      subtitle={t.customerSubtitle}
      onBack={goBack}
      viewer="customer"
      messages={messages}
      isLoading={chat.isLoading}
      sending={chat.send.isPending}
      emptyTitle={t.customerEmptyTitle}
      emptyText={t.customerEmptyText}
      starters={starters}
      initialDraft={typeof params.message === 'string' ? params.message.slice(0, 500) : undefined}
      onSend={async (text) => {
        await chat.send.mutateAsync({ customerId: customer.id, from: 'customer', text, senderName: customer.name });
        notifyChatMessage({ customerId: customer.id, customerName: customer.name, from: 'customer', text });
      }}
    />
  );
}
