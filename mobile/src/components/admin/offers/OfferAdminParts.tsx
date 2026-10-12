import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { DetailStatusPill, type DetailPillTone } from '@/src/components/shared/detailUi';
import type { OfferKind } from '@/src/domain/offers/entities';
import type { OfferStatus } from '@/src/domain/offers/offers';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';
import { useResponsiveDialogStyle } from '@/src/utils/responsiveLayout';

/** Small pieces the offers list, form and detail share. */

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const OFFER_KIND_ICONS: Record<OfferKind, IconName> = {
  price: 'tag-outline',
  combo: 'gift-outline',
  bill: 'receipt-text-outline',
  subscription: 'calendar-star',
};

const STATUS_LOOK: Record<OfferStatus, { tone: DetailPillTone; icon: IconName }> = {
  live: { tone: 'green', icon: 'circle-medium' },
  scheduled: { tone: 'blue', icon: 'clock-outline' },
  ended: { tone: 'gray', icon: 'flag-checkered' },
};

export function OfferStatusPill({ status }: { status: OfferStatus }) {
  const t = useStrings('offers');
  const look = STATUS_LOOK[status];
  return <DetailStatusPill tone={look.tone} icon={look.icon} label={t.status[status]} />;
}

/** The offer's poster, or nothing when it has none or the picture cannot be read. */
export function OfferPoster({ uri, height = 160 }: { uri?: string; height?: number }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return null;
  return (
    <Image
      key={uri}
      source={{ uri }}
      style={[styles.poster, { height }]}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

/** Label/value rows (kind details, dates …) that wrap long values under the label on narrow phones. */
export function OfferInfoRows({ rows }: { rows: readonly { label: string; value: string }[] }) {
  return (
    <View>
      {rows.map((r, i) => (
        <View key={`${r.label}-${i}`} style={[styles.row, i > 0 && styles.rowBorder]}>
          <Text style={styles.rowLabel}>{r.label}</Text>
          <Text style={styles.rowValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** A short explanation box (locked fields, the website file). */
export function OfferNotice({ icon, title, text, children }: { icon: IconName; title?: string; text: string; children?: ReactNode }) {
  return (
    <View style={styles.notice}>
      <MaterialCommunityIcons name={icon} size={20} color={amraleColors.blue} />
      <View style={styles.noticeText}>
        {title ? <Text style={styles.noticeTitle}>{title}</Text> : null}
        <Text style={styles.noticeBody}>{text}</Text>
        {children}
      </View>
    </View>
  );
}

/** Yes/no question before ending or deleting an offer. */
export function OfferConfirmDialog({
  visible,
  title,
  text,
  confirmLabel,
  danger,
  busy,
  error,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const tc = useStrings('common');
  const dialogStyle = useResponsiveDialogStyle(420);
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={busy ? undefined : onDismiss} style={[styles.dialog, dialogStyle]}>
        <Dialog.Title style={styles.dialogTitle}>{title}</Dialog.Title>
        <Dialog.Content style={styles.dialogContent}>
          <Text style={styles.dialogText}>{text}</Text>
          {error ? <Text style={styles.dialogError}>{error}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={busy}>
            {tc.actions.cancel}
          </Button>
          <Button onPress={onConfirm} loading={busy} disabled={busy} textColor={danger ? amraleColors.error : amraleColors.blue}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  poster: { width: '100%', borderRadius: amraleRadius.md, backgroundColor: amraleColors.inputBgLight },
  row: { paddingVertical: 8, gap: 2 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: amraleColors.inputBorderLight },
  rowLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  rowValue: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: 'rgba(0, 85, 199, 0.07)',
  },
  noticeText: { flex: 1, minWidth: 0, gap: 4 },
  noticeTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.text },
  noticeBody: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 19, color: amraleColors.textMuted },
  dialog: { backgroundColor: amraleColors.white, borderRadius: amraleRadius.lg },
  dialogTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },
  dialogContent: { gap: 10 },
  dialogText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 21, color: amraleColors.textMuted },
  dialogError: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.error },
});
