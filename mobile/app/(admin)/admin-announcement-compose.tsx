import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AnnouncementCard } from '@/src/components/announcements/AnnouncementCard';
import { AnnouncementMedia } from '@/src/components/announcements/AnnouncementMedia';
import { ANNOUNCEMENT_LOOK } from '@/src/components/announcements/announcementLook';
import { pickAnnouncementMedia } from '@/src/components/announcements/pickAnnouncementMedia';
import { uploadPicture } from '@/src/infrastructure/uploadPicture';
import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import {
  CustomerCard,
  CustomerCardHeader,
  CustomerChoiceChips,
  CustomerPrimaryButton,
  CustomerScreen,
  CustomerSecondaryButton,
} from '@/src/components/customer/customerUi';
import { ProfileField } from '@/src/components/profile/ProfileField';
import {
  ANNOUNCEMENT_TEMPLATES,
  birthdaysOn,
  mediaFromLink,
  personalize,
  recipientIds,
} from '@/src/domain/announcements/announcements';
import {
  ANNOUNCEMENT_CATEGORIES,
  type Announcement,
  type AnnouncementCategory,
  type AnnouncementMedia as Media,
} from '@/src/domain/announcements/entities';
import { notifyAnnouncementSent } from '@/src/domain/notifications/events';
import { useAnnouncements } from '@/src/hooks/announcements/useAnnouncements';
import { useCustomers } from '@/src/hooks/customers';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';

type AudienceChoice = 'all' | 'chosen';

const AUDIENCE_CHOICES: readonly AudienceChoice[] = ['all', 'chosen'];

function newId(): string {
  return `ann_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/** Write a message to customers — a wish, a notice, a payment or delivery message — with a picture or a video. */
export default function AdminAnnouncementComposeScreen() {
  const customers = useCustomers();
  const announcements = useAnnouncements();
  const today = useMemo(() => todayYmd(), []);
  const t = useStrings('admin').compose;
  const tc = useStrings('common');
  const categoryOptions = ANNOUNCEMENT_CATEGORIES.map((c) => ({ key: c, label: t.categories[c] }));
  const audienceOptions = AUDIENCE_CHOICES.map((key) => ({ key, label: t.audience[key] }));

  const [category, setCategory] = useState<AnnouncementCategory>('Festival');
  const [title, setTitle] = useState(ANNOUNCEMENT_TEMPLATES.Festival.title);
  const [message, setMessage] = useState(ANNOUNCEMENT_TEMPLATES.Festival.message);
  const [media, setMedia] = useState<Media | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [audience, setAudience] = useState<AudienceChoice>('all');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allCustomers = useMemo(() => customers.data?.items ?? [], [customers.data?.items]);
  const activeCustomers = useMemo(() => allCustomers.filter((c) => c.status !== 'Inactive'), [allCustomers]);
  const birthdays = useMemo(() => birthdaysOn(allCustomers, today), [allCustomers, today]);

  const visibleCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allCustomers.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || String(c.mobile ?? '').includes(q) || String(c.societyName ?? '').toLowerCase().includes(q),
    );
  }, [allCustomers, search]);

  /** Switching kind swaps in its template, unless the admin already wrote their own words. */
  function chooseCategory(next: AnnouncementCategory) {
    const current = ANNOUNCEMENT_TEMPLATES[category];
    if (title === current.title) setTitle(ANNOUNCEMENT_TEMPLATES[next].title);
    if (message === current.message) setMessage(ANNOUNCEMENT_TEMPLATES[next].message);
    if (next === 'Birthday' && birthdays.length) {
      setAudience('chosen');
      setChosen(new Set(birthdays.map((c) => c.id)));
    }
    setCategory(next);
  }

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function attach(kind: 'image' | 'video') {
    setError(null);
    setMediaBusy(true);
    try {
      const picked = await pickAnnouncementMedia(kind);
      // With the dairy’s server it goes up once and the message keeps its address, so every customer sees it.
      if (picked.ok) setMedia({ ...picked.media, uri: await uploadPicture(picked.media.uri) });
      else if (!('cancelled' in picked)) setError(picked.message);
    } catch {
      setError(t.errors.mediaFailed);
    } finally {
      setMediaBusy(false);
    }
  }

  function useLink() {
    const fromLink = mediaFromLink(link);
    if (!fromLink) {
      setError(t.errors.linkInvalid);
      return;
    }
    setError(null);
    setMedia(fromLink);
    setLinkOpen(false);
    setLink('');
  }

  const recipients = audience === 'all' ? activeCustomers : allCustomers.filter((c) => chosen.has(c.id));
  const previewName = recipients[0]?.name ?? t.customerFallback;

  async function send() {
    setError(null);
    if (!title.trim()) return setError(t.errors.titleRequired);
    if (!message.trim()) return setError(t.errors.messageRequired);
    if (audience === 'chosen' && chosen.size === 0) return setError(t.errors.chooseCustomer);

    const nowIso = new Date().toISOString();
    const announcement: Announcement = {
      id: newId(),
      category,
      title: title.trim(),
      message: message.trim(),
      media: media ?? undefined,
      audience: audience === 'all' ? { kind: 'all' } : { kind: 'customers', customerIds: Array.from(chosen) },
      source: 'admin',
      senderName: 'Amrale Dairy',
      readBy: {},
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    try {
      await announcements.send.mutateAsync(announcement);
    } catch {
      setError(
        media ? t.errors.mediaTooLarge : t.errors.sendFailed,
      );
      return;
    }
    const ids = recipientIds(announcement.audience, activeCustomers.map((c) => c.id));
    notifyAnnouncementSent({
      announcement,
      recipients: ids.map((id) => ({ id, name: allCustomers.find((c) => c.id === id)?.name })),
    });
    router.replace({ pathname: '/(admin)/admin-announcements', params: { sent: String(ids.length) } });
  }

  const draftForPreview: Announcement = {
    id: 'preview',
    category,
    title,
    message,
    media: media ?? undefined,
    audience: { kind: 'all' },
    source: 'admin',
    readBy: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <CustomerScreen
      title={t.title}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/admin-announcements'))}
    >
      <CustomerCard style={styles.gap}>
        <CustomerCardHeader icon={ANNOUNCEMENT_LOOK[category].icon} title={t.aboutTitle} />
        <CustomerChoiceChips options={categoryOptions} value={category} onChange={chooseCategory} />
        <ProfileField label={t.titleLabel} value={title} onChangeText={setTitle} placeholder={t.titlePlaceholder} />
        <ProfileField
          label={t.messageLabel}
          value={message}
          onChangeText={setMessage}
          multiline
          placeholder={t.messagePlaceholder}
          style={styles.messageInput}
        />
        <Text style={styles.hint}>{t.nameHint}</Text>
      </CustomerCard>

      <CustomerCard style={styles.gap}>
        <CustomerCardHeader icon="image-multiple-outline" title={t.mediaTitle} />
        {media ? (
          <>
            <AnnouncementMedia media={media} height={200} />
            <CustomerSecondaryButton label={media.kind === 'image' ? t.removePicture : t.removeVideo} tone="danger" onPress={() => setMedia(null)} />
          </>
        ) : (
          <>
            <View style={styles.mediaRow}>
              <MediaButton icon="image-plus" label={t.addPicture} onPress={() => void attach('image')} disabled={mediaBusy} />
              <MediaButton icon="video-plus-outline" label={t.addVideo} onPress={() => void attach('video')} disabled={mediaBusy} />
              <MediaButton icon="link-variant" label={t.pasteLink} onPress={() => setLinkOpen((o) => !o)} disabled={mediaBusy} />
            </View>
            {linkOpen ? (
              <View style={styles.gap}>
                <ProfileField
                  label={t.linkLabel}
                  value={link}
                  onChangeText={setLink}
                  placeholder={t.linkPlaceholder}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <CustomerPrimaryButton label={t.useLink} icon="check" onPress={useLink} />
              </View>
            ) : null}
            <Text style={styles.hint}>{t.uploadHint}</Text>
          </>
        )}
      </CustomerCard>

      <CustomerCard style={styles.gap}>
        <CustomerCardHeader icon="account-group-outline" title={t.sendTo} />
        <CustomerChoiceChips options={audienceOptions} value={audience} onChange={setAudience} />
        {audience === 'all' ? (
          <Text style={styles.hint}>{t.allActive(activeCustomers.length)}</Text>
        ) : (
          <>
            {birthdays.length ? (
              <Pressable
                onPress={() => setChosen((prev) => new Set([...prev, ...birthdays.map((c) => c.id)]))}
                style={({ pressed }) => [styles.birthdayBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="cake-variant-outline" size={18} color="#a3246b" />
                <Text style={styles.birthdayText}>{t.addBirthdays(birthdays.map((c) => c.name).join(', '))}</Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>{t.noBirthdays}</Text>
            )}
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t.searchPlaceholder}
              placeholderTextColor={amraleColors.textSubtle}
              style={styles.search}
              accessibilityLabel={t.searchA11y}
            />
            <View style={styles.selectRow}>
              <Text style={styles.selectedCount}>{t.selected(chosen.size)}</Text>
              <View style={styles.selectActions}>
                <Pressable onPress={() => setChosen((prev) => new Set([...prev, ...visibleCustomers.map((c) => c.id)]))} hitSlop={6}>
                  <Text style={styles.link}>{t.selectShown}</Text>
                </Pressable>
                <Pressable onPress={() => setChosen(new Set())} hitSlop={6}>
                  <Text style={styles.link}>{tc.actions.clear}</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.customerList}>
              {visibleCustomers.map((c) => {
                const on = chosen.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => toggle(c.id)}
                    style={({ pressed }) => [styles.customerRow, pressed && styles.pressed]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={c.name}
                  >
                    <MaterialCommunityIcons
                      name={on ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={22}
                      color={on ? amraleColors.blue : amraleColors.textSubtle}
                    />
                    <View style={styles.customerText}>
                      <Text style={styles.customerName} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <Text style={styles.customerMeta} numberOfLines={1}>
                        {[c.mobile, c.societyName, c.status === 'Inactive' ? tc.states.inactive : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {visibleCustomers.length === 0 ? <Text style={styles.hint}>{t.noMatch}</Text> : null}
            </View>
          </>
        )}
      </CustomerCard>

      <Text style={styles.previewLabel}>{t.preview(previewName.split(' ')[0] ?? previewName)}</Text>
      <AnnouncementCard
        announcement={draftForPreview}
        title={personalize(title || t.titleLabel, previewName)}
        message={personalize(message || t.messageLabel, previewName)}
        unread
        onPress={() => undefined}
      />

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <CustomerPrimaryButton
        label={recipients.length ? t.sendToCount(recipients.length) : tc.actions.send}
        icon="send"
        onPress={() => void send()}
        busy={announcements.send.isPending}
        disabled={mediaBusy}
      />
    </CustomerScreen>
  );
}

function MediaButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name={icon} size={24} color={amraleColors.blue} />
      <Text style={styles.mediaBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gap: { gap: amraleSpacing.sm },
  messageInput: { minHeight: 110, textAlignVertical: 'top' },
  hint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, lineHeight: 17, color: amraleColors.textMuted },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
  },
  mediaBtnText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue },
  birthdayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: amraleRadius.md,
    backgroundColor: '#fbe3f0',
  },
  birthdayText: { flex: 1, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: '#a3246b' },
  search: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.inputBgLight,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    color: amraleColors.text,
  },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectedCount: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.text },
  selectActions: { flexDirection: 'row', gap: 16 },
  link: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue },
  customerList: { gap: 2 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 6 },
  customerText: { flex: 1, minWidth: 0 },
  customerName: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  customerMeta: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  previewLabel: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.textMuted, marginTop: 4 },
  error: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.error },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
