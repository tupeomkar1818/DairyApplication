import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { cleanChatText, groupByDay, MAX_CHAT_MESSAGE_LENGTH } from '@/src/domain/chat/chat';
import type { ChatAuthor, ChatMessage } from '@/src/domain/chat/entities';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';
import { formatRelativeDay, formatTime } from '@/src/utils/format';

/**
 * The chat screen for both apps: the conversation with day separators, and a message box pinned to the bottom.
 * `viewer` decides which bubbles are "mine" (right, blue) and which are the other side's.
 */
export function ChatThread({
  title,
  subtitle,
  onBack,
  headerRight,
  messages,
  viewer,
  isLoading,
  onSend,
  sending,
  emptyTitle,
  emptyText,
  starters,
  initialDraft,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  headerRight?: ReactNode;
  messages: readonly ChatMessage[];
  viewer: ChatAuthor;
  isLoading?: boolean;
  /** Resolves once the message is saved; rejects to keep the text in the box. */
  onSend: (text: string) => Promise<void>;
  sending?: boolean;
  emptyTitle: string;
  emptyText: string;
  /** One-tap first messages shown while the conversation is empty. */
  starters?: readonly string[];
  /** Text already in the box when the screen opens, e.g. "I'd like to change my order for Thu, 17 Sep." */
  initialDraft?: string;
}) {
  const { headerPaddingTop, bottom } = useScreenSafeInsets();
  const lang = useLanguage();
  const inbox = useStrings('inbox');
  const t = inbox.chat;
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState(initialDraft ?? '');
  const [error, setError] = useState<string | null>(null);

  async function submit(text: string) {
    const clean = cleanChatText(text);
    if (!clean.ok) {
      setError(clean.message);
      return;
    }
    setError(null);
    try {
      await onSend(clean.text);
      setDraft('');
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setError(t.sendFailed);
    }
  }

  const days = groupByDay(messages);
  const canSend = draft.trim().length > 0 && !sending;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <ResponsiveContainer variant="form" style={styles.appBarRow}>
          <Pressable
            onPress={onBack}
            hitSlop={6}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.goBack}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={amraleColors.blue} />
          </Pressable>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name={viewer === 'customer' ? 'storefront-outline' : 'account-outline'} size={20} color={amraleColors.blue} />
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {headerRight}
        </ResponsiveContainer>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        <ResponsiveContainer variant="form" style={styles.body}>
          {isLoading ? (
            <ActivityIndicator color={amraleColors.blue} style={styles.loading} />
          ) : messages.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="chat-outline" size={40} color={amraleColors.textSubtle} />
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyText}>{emptyText}</Text>
              {starters?.length ? (
                <View style={styles.starters}>
                  {starters.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => void submit(s)}
                      disabled={sending}
                      style={({ pressed }) => [styles.starter, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={t.sendStarter(s)}
                    >
                      <Text style={styles.starterText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            days.map((day) => (
              <View key={day.dayYmd} style={styles.day}>
                <View style={styles.dayChip}>
                  <Text style={styles.dayChipText}>{formatRelativeDay(day.dayYmd, undefined, lang)}</Text>
                </View>
                {day.messages.map((m) => {
                  const mine = m.from === viewer;
                  return (
                    <View key={m.id} style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                        {!mine && viewer === 'customer' ? <Text style={styles.sender}>{inbox.dairyName}</Text> : null}
                        <Text style={[styles.text, mine && styles.textMine]} selectable>
                          {m.text}
                        </Text>
                        <View style={styles.metaRow}>
                          <Text style={[styles.time, mine && styles.timeMine]}>{formatTime(m.createdAt, lang)}</Text>
                          {mine ? (
                            <MaterialCommunityIcons
                              name={m.readAt ? 'check-all' : 'check'}
                              size={14}
                              color={m.readAt ? '#9fe0ff' : 'rgba(255,255,255,0.75)'}
                              accessibilityLabel={m.readAt ? t.seen : t.sent}
                            />
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ResponsiveContainer>
      </ScrollView>

      <View style={[styles.composerBar, { paddingBottom: amraleSpacing.sm + bottom }]}>
        <ResponsiveContainer variant="form" style={styles.composerInner}>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                if (error) setError(null);
              }}
              placeholder={t.placeholder}
              placeholderTextColor={amraleColors.textSubtle}
              multiline
              maxLength={MAX_CHAT_MESSAGE_LENGTH}
              style={styles.input}
              accessibilityLabel={t.messageLabel}
              onKeyPress={(e) => {
                // Web: Enter sends, Shift+Enter makes a new line.
                const native = e.nativeEvent as { key: string; shiftKey?: boolean };
                if (Platform.OS === 'web' && native.key === 'Enter' && !native.shiftKey) {
                  (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                  if (canSend) void submit(draft);
                }
              }}
            />
            <Pressable
              onPress={() => void submit(draft)}
              disabled={!canSend}
              style={({ pressed }) => [styles.sendBtn, !canSend && styles.sendDisabled, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.sendLabel}
            >
              {sending ? (
                <ActivityIndicator color={amraleColors.white} size="small" />
              ) : (
                <MaterialCommunityIcons name="send" size={20} color={amraleColors.white} />
              )}
            </Pressable>
          </View>
        </ResponsiveContainer>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  flex: { flex: 1 },
  appBar: {
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.sm,
    backgroundColor: amraleColors.white,
    borderBottomWidth: 1,
    borderBottomColor: dairyTactileColors.outlineVariant,
  },
  appBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 44, height: 44, marginLeft: -10, borderRadius: amraleRadius.md, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dairyTactileColors.surfaceContainer,
  },
  titleCol: { flex: 1, minWidth: 0 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 17, color: amraleColors.text },
  subtitle: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },

  scrollContent: { flexGrow: 1, paddingHorizontal: amraleSpacing.md, paddingVertical: amraleSpacing.md },
  body: { gap: amraleSpacing.md },
  loading: { marginTop: 40 },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  emptyText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted, textAlign: 'center' },
  starters: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
  starter: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
  },
  starterText: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, color: amraleColors.blue },

  day: { gap: 6 },
  dayChip: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
    backgroundColor: dairyTactileColors.surfaceContainer,
    marginBottom: 4,
  },
  dayChipText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: amraleColors.textMuted },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderRadius: 16, gap: 2 },
  bubbleMine: { backgroundColor: amraleColors.blue, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    borderBottomLeftRadius: 4,
  },
  sender: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: amraleColors.blue },
  text: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 15, lineHeight: 21, color: amraleColors.text },
  textMine: { color: amraleColors.white },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  time: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 11, color: amraleColors.textSubtle },
  timeMine: { color: 'rgba(255,255,255,0.8)' },

  composerBar: {
    paddingHorizontal: amraleSpacing.md,
    paddingTop: amraleSpacing.sm,
    backgroundColor: amraleColors.white,
    borderTopWidth: 1,
    borderTopColor: dairyTactileColors.outlineVariant,
  },
  composerInner: { gap: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.inputBgLight,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.blue,
  },
  sendDisabled: { opacity: 0.45 },
  error: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: amraleColors.error },
  pressed: { opacity: 0.85 },
});
