import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import {
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyGradient,
  dairyTactileColors,
  primaryButtonElevation,
  tactileCardElevation,
} from '@/src/theme/dairyTactile';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';

export function SubscriptionTactileSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={uiStyles.section}>
      <Text style={uiStyles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={uiStyles.sectionSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function SubscriptionMonthPickerBar({
  monthLabelText,
  monthKeyText,
  prevDisabled,
  nextDisabled,
  onPrev,
  onNext,
  onOpenPicker,
}: {
  monthLabelText: string;
  monthKeyText: string;
  prevDisabled: boolean;
  nextDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenPicker: () => void;
}) {
  const t = useStrings('subscriptionEditor');
  return (
    <View style={uiStyles.monthBar}>
      <Pressable
        disabled={prevDisabled}
        onPress={onPrev}
        style={({ pressed }) => [uiStyles.monthNavBtn, prevDisabled && uiStyles.monthNavBtnDisabled, pressed && uiStyles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t.tactile.previousMonth}
      >
        <MaterialCommunityIcons name="chevron-left" size={24} color={dairyTactileColors.onSurface} />
      </Pressable>
      <Pressable onPress={onOpenPicker} style={({ pressed }) => [uiStyles.monthCenter, pressed && uiStyles.pressed]} accessibilityRole="button">
        <Text style={uiStyles.monthLabel}>{monthLabelText}</Text>
        <Text style={uiStyles.monthKey}>{monthKeyText}</Text>
      </Pressable>
      <Pressable
        disabled={nextDisabled}
        onPress={onNext}
        style={({ pressed }) => [uiStyles.monthNavBtn, nextDisabled && uiStyles.monthNavBtnDisabled, pressed && uiStyles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t.tactile.nextMonth}
      >
        <MaterialCommunityIcons name="chevron-right" size={24} color={dairyTactileColors.onSurface} />
      </Pressable>
    </View>
  );
}

export function SubscriptionEmptyBox({ message }: { message: string }) {
  return (
    <View style={uiStyles.emptyBox}>
      <Text style={uiStyles.emptyText}>{message}</Text>
    </View>
  );
}

export function SubscriptionTactileCard({ children }: { children: ReactNode }) {
  return <View style={uiStyles.tactileCard}>{children}</View>;
}

export function SubscriptionBillingFooter({
  estimatedTotalLabel,
  billingCycleLabel,
  onViewDetailedBill,
}: {
  estimatedTotalLabel: string;
  billingCycleLabel: string;
  onViewDetailedBill: () => void;
}) {
  const t = useStrings('subscriptionEditor');
  return (
    <View style={uiStyles.footerWrap}>
      <View style={uiStyles.footerSummary}>
        <View style={uiStyles.footerRow}>
          <Text style={uiStyles.footerLabel}>{t.tactile.estimatedMonthlyTotal}</Text>
          <Text style={uiStyles.footerTotal}>{estimatedTotalLabel}</Text>
        </View>
        <Text style={uiStyles.footerCycle}>{t.tactile.billingCycle(billingCycleLabel)}</Text>
      </View>
      <Pressable onPress={onViewDetailedBill} style={({ pressed }) => [uiStyles.viewBillWrap, pressed && uiStyles.pressed]} accessibilityRole="button">
        <LinearGradient
          colors={[...dairyGradient.colors]}
          start={dairyGradient.start}
          end={dairyGradient.end}
          style={[uiStyles.viewBillBtn, primaryButtonElevation()]}
        >
          <MaterialCommunityIcons name="file-document-outline" size={20} color={dairyTactileColors.onPrimary} />
          <Text style={uiStyles.viewBillText}>{t.tactile.viewDetailedBill}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export function subscriptionBillingCycleLabel(yyyyMm: string): string {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyyMm;
  const yyyy = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return yyyyMm;
  const dim = new Date(yyyy, mo, 0).getDate();
  const monthName = strings('common').dates.monthsLong[mo - 1]!;
  return strings('subscriptionEditor').billingCycleRange(monthName, dim);
}

const uiStyles = StyleSheet.create({
  section: { gap: amraleSpacing.cardGap },
  sectionTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: dairyTactileColors.onSurface,
  },
  sectionSubtitle: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
  },
  tactileCard: {
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    ...tactileCardElevation(),
    gap: amraleSpacing.sm,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainer,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
  },
  monthNavBtn: {
    width: 44,
    height: 44,
    borderRadius: amraleRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavBtnDisabled: { opacity: 0.4 },
  monthCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 0 },
  monthLabel: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: dairyTactileColors.onSurface,
  },
  monthKey: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: dairyTactileColors.onSurfaceVariant,
  },
  emptyBox: {
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
  },
  emptyText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: dairyTactileColors.onSurfaceVariant,
    textAlign: 'center',
  },
  footerWrap: {
    gap: amraleSpacing.md,
    marginTop: amraleSpacing.sm,
  },
  footerSummary: {
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainer,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    gap: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerLabel: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: dairyTactileColors.onSurfaceVariant,
    flex: 1,
  },
  footerTotal: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: dairyTactileColors.onSurface,
  },
  footerCycle: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
  },
  /** CTA stays a centered pill on tablets/desktops instead of an edge-to-edge bar. */
  viewBillWrap: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  viewBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: amraleRadius.pill,
    paddingHorizontal: amraleSpacing.lg,
  },
  viewBillText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: dairyTactileColors.onPrimary,
  },
  pressed: { opacity: 0.88 },
});
