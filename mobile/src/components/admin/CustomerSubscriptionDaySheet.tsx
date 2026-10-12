import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, Text } from 'react-native-paper';

import {
  formatSubscriptionPlanAsOrderExample,
  frequencyLabel,
  planStatusLabel,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import type { CustomerDailyProductOrderLineDto, CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import {
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyGradient,
  dairyTactileColors,
  primaryButtonElevation,
} from '@/src/theme/dairyTactile';
import { useStrings } from '@/src/i18n/useStrings';
import { formatDay } from '@/src/utils/format';

function fmtDayHeader(ymd: string): string {
  return formatDay(ymd, { weekday: true, year: true });
}

function SectionHeading({
  icon,
  title,
  trailing,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  trailing?: string;
}) {
  return (
    <View style={styles.sectionHeadingRow}>
      <View style={styles.sectionHeadingLeft}>
        <MaterialCommunityIcons name={icon} size={20} color={dairyTactileColors.primaryContainer} />
        <Text style={styles.sectionHeadingText}>{title}</Text>
      </View>
      {trailing ? <Text style={styles.sectionTrailing}>{trailing}</Text> : null}
    </View>
  );
}

function SubscriptionEmptyState({ dayLabel }: { dayLabel: string }) {
  const t = useStrings('subscriptionEditor');
  return (
    <View style={styles.subscriptionEmpty}>
      <MaterialCommunityIcons name="package-variant" size={36} color={dairyTactileColors.outline} style={{ opacity: 0.55 }} />
      <Text style={styles.emptyTitle}>{t.daySheet.noActiveSubscriptions}</Text>
      <Text style={styles.emptySubtitle}>{t.daySheet.noLinesForDay(dayLabel)}</Text>
    </View>
  );
}

function SubscriptionPlanRow({ plan }: { plan: CustomerSubscriptionPlanDto }) {
  return (
    <View style={styles.planRow}>
      <Text style={styles.planRowTitle} numberOfLines={2}>
        {plan.productName}
      </Text>
      <Text style={styles.planRowMeta} numberOfLines={3}>
        {formatSubscriptionPlanAsOrderExample(plan)} · {frequencyLabel(plan.frequency)} · {planStatusLabel(plan.status)}
      </Text>
    </View>
  );
}

export type CustomerSubscriptionDaySheetProps = {
  visible: boolean;
  onClose: () => void;
  selectedDayYmd: string | null;
  profilePlans: CustomerSubscriptionPlanDto[];
  addonLines: CustomerDailyProductOrderLineDto[];
  hasSubscriptionLines: boolean;
  maxWidth: number;
  scrollMaxHeight: number;
  addonSectionFooter: ReactNode;
  onEditAddon: (lineId: string) => void;
  onRemoveAddon: (lineId: string, productName: string) => void;
  addonFormActive: boolean;
};

export function CustomerSubscriptionDaySheet({
  visible,
  onClose,
  selectedDayYmd,
  profilePlans,
  addonLines,
  hasSubscriptionLines,
  maxWidth,
  scrollMaxHeight,
  addonSectionFooter,
  onEditAddon,
  onRemoveAddon,
  addonFormActive,
}: CustomerSubscriptionDaySheetProps) {
  const t = useStrings('subscriptionEditor');
  const common = useStrings('common');
  const dayLabel = selectedDayYmd ? fmtDayHeader(selectedDayYmd) : t.daySheet.thisDay;
  const addonCountLabel = t.daySheet.itemCount(addonLines.length);

  return (
      <Dialog visible={visible} onDismiss={onClose} style={[styles.dialogSurface, { maxWidth, width: maxWidth }]}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerDate}>{selectedDayYmd ? fmtDayHeader(selectedDayYmd) : t.daySheet.day}</Text>
              <Text style={styles.headerSubtitle}>{t.daySheet.scheduledDetails}</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={common.actions.close}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="close" size={22} color={dairyTactileColors.onSurfaceVariant} />
            </Pressable>
          </View>

          <View style={styles.headerDivider} />

          <ScrollView
            style={{ maxHeight: scrollMaxHeight }}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            {...(Platform.OS === 'android' ? { persistentScrollbar: true } : {})}
          >
            <View style={styles.infoBanner}>
              <MaterialCommunityIcons name="information" size={20} color={dairyTactileColors.primaryContainer} />
              <Text style={styles.infoText}>{t.daySheet.info}</Text>
            </View>

            <View style={styles.section}>
              <SectionHeading icon="calendar-refresh" title={t.daySheet.subscriptionProducts} />
              {profilePlans.length ? (
                <View style={styles.planList}>
                  {profilePlans.map((p, i) => (
                    <SubscriptionPlanRow key={`${p.productName}_${i}`} plan={p} />
                  ))}
                </View>
              ) : (
                <SubscriptionEmptyState dayLabel={dayLabel} />
              )}
            </View>

            <View style={styles.section}>
              <SectionHeading icon="plus-box-outline" title={t.daySheet.addOnProducts} trailing={addonCountLabel} />
              {addonLines.length ? (
                <View style={styles.addonListBox}>
                  {addonLines.map((line) => (
                    <View key={line.id} style={styles.addonRow}>
                      <View style={styles.addonRowText}>
                        <Text style={styles.addonRowTitle} numberOfLines={2}>
                          {line.productName}
                        </Text>
                        <Text style={styles.addonRowMeta} numberOfLines={2}>
                          {line.quantityLabel}
                          {line.unitType ? ` (${line.unitType})` : ''} · {t.daySheet.qty(line.quantity)}
                        </Text>
                      </View>
                      <View style={styles.addonRowActions}>
                        <Pressable
                          disabled={addonFormActive}
                          onPress={() => onEditAddon(line.id)}
                          style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
                        >
                          <Text style={styles.linkBtnText}>{common.actions.edit}</Text>
                        </Pressable>
                        <Pressable
                          disabled={addonFormActive}
                          onPress={() => onRemoveAddon(line.id, line.productName)}
                          style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
                        >
                          <Text style={[styles.linkBtnText, styles.linkBtnDanger]}>{common.actions.delete}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.addonEmptyBox}>
                  <Text style={styles.addonEmptyText}>
                    {hasSubscriptionLines ? t.daySheet.noAddOnsYet : t.daySheet.noSubscriptionDay}
                  </Text>
                </View>
              )}
              {addonSectionFooter}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.footerCloseBtn, pressed && styles.pressed]} accessibilityRole="button">
              <Text style={styles.footerCloseText}>{common.actions.close}</Text>
            </Pressable>
          </View>
        </View>
      </Dialog>
  );
}

/** Pill CTA matching mockup — add add-on when no form is open */
export function DaySheetAddAddonButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const t = useStrings('subscriptionEditor');
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.addAddonWrap, disabled && styles.addAddonDisabled, pressed && !disabled && styles.pressed]}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={disabled ? ['#94A3B8', '#94A3B8'] : [...dairyGradient.colors]}
        start={dairyGradient.start}
        end={dairyGradient.end}
        style={[styles.addAddonBtn, primaryButtonElevation()]}
      >
        <MaterialCommunityIcons name="plus" size={20} color={dairyTactileColors.onPrimary} />
        <Text style={styles.addAddonBtnText}>{t.tab.addAddOnProduct}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dialogSurface: {
    alignSelf: 'center',
    borderRadius: amraleRadius.xl,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    // The caller's `maxWidth` already leaves a side gutter (window − 32); a margin on top would push it off-screen.
    marginHorizontal: 0,
    padding: 0,
    overflow: 'hidden',
  },
  sheet: { overflow: 'hidden', borderRadius: amraleRadius.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: amraleSpacing.lg,
    paddingTop: amraleSpacing.lg,
    paddingBottom: amraleSpacing.md,
    gap: amraleSpacing.sm,
  },
  headerTextCol: { flex: 1, minWidth: 0, gap: 4 },
  headerDate: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    color: dairyTactileColors.onSurface,
  },
  headerSubtitle: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    color: dairyTactileColors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: amraleRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dairyTactileColors.surfaceContainer,
  },
  headerDivider: {
    height: 1,
    backgroundColor: dairyTactileColors.outlineVariant,
    marginHorizontal: amraleSpacing.lg,
  },
  scrollContent: {
    paddingHorizontal: amraleSpacing.lg,
    paddingTop: amraleSpacing.md,
    paddingBottom: amraleSpacing.md,
    gap: amraleSpacing.lg,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainer,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
  },
  infoText: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: dairyTactileColors.onSurfaceVariant,
  },
  section: { gap: amraleSpacing.sm },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionHeadingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  sectionHeadingText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    color: dairyTactileColors.onSurface,
    textTransform: 'uppercase',
  },
  sectionTrailing: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: dairyTactileColors.onSurfaceVariant,
  },
  subscriptionEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: amraleSpacing.xl,
    paddingHorizontal: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: dairyTactileColors.outlineVariant,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: dairyTactileColors.onSurface,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
    textAlign: 'center',
  },
  planList: {
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
    overflow: 'hidden',
  },
  planRow: {
    padding: amraleSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dairyTactileColors.outlineVariant,
    gap: 4,
  },
  planRowTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: dairyTactileColors.onSurface,
  },
  planRowMeta: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
  },
  addonListBox: {
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
    overflow: 'hidden',
  },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    padding: amraleSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dairyTactileColors.outlineVariant,
  },
  addonRowText: { flex: 1, minWidth: 0, gap: 2 },
  addonRowTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: dairyTactileColors.onSurface,
  },
  addonRowMeta: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
  },
  addonRowActions: { flexDirection: 'row', flexShrink: 0, gap: 4 },
  linkBtn: { paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' },
  linkBtnText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: dairyTactileColors.primaryContainer,
  },
  linkBtnDanger: { color: dairyTactileColors.error },
  addonEmptyBox: {
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
  },
  addonEmptyText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: dairyTactileColors.onSurfaceVariant,
    textAlign: 'center',
  },
  addAddonWrap: { marginTop: amraleSpacing.sm },
  addAddonDisabled: { opacity: 0.55 },
  addAddonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: amraleRadius.pill,
    paddingHorizontal: amraleSpacing.lg,
  },
  addAddonBtnText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: dairyTactileColors.onPrimary,
  },
  footer: {
    paddingHorizontal: amraleSpacing.lg,
    paddingVertical: amraleSpacing.sm,
    backgroundColor: dairyTactileColors.surfaceContainer,
    borderTopWidth: 1,
    borderTopColor: dairyTactileColors.outlineVariant,
    alignItems: 'flex-end',
  },
  footerCloseBtn: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  footerCloseText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: dairyTactileColors.primaryContainer,
  },
  pressed: { opacity: 0.88 },
});
