import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { toDdMmYyyyFromFlexibleDate } from '@/src/components/admin/customerFormDates';
import type { CustomerFormTab } from '@/src/components/admin/customerFormShared';
import {
  DetailCardAction,
  DetailInfo,
  DetailInfoGrid,
  DetailSectionCard,
  DetailStatusPill,
} from '@/src/components/shared/detailUi';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { Dictionary } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleRadius, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';

/**
 * Overview tab. It uses the same three sections — and shows every field — as the Add / Edit Customer form, and each
 * section's Edit link opens the form at that section, so details and form always line up.
 */
export type CustomerDetailOverviewProps = {
  customer: CustomerResponse;
  /** Resolved from the delivery-boy record when available. */
  assignedDeliveryBoy: string;
  deliveryRoute: string;
  billingType: string;
  addressTags: string[];
  onEditSection?: (section: CustomerFormTab) => void;
  /** Tablets/desktops: fields sit in two columns inside each section. */
  wide?: boolean;
};

function textOrDash(value: string | null | undefined): string {
  const t = String(value ?? '').trim();
  return t || '—';
}

function mobileOrDash(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return textOrDash(value);
}

function billingDayLabel(c: CustomerResponse, t: Dictionary['customers']['overview']): string {
  if (c.billingType === 'Prepaid') return t.notApplicablePrepaid;
  const day = Number(c.billingCycleDate);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? t.dayOfMonth(day) : t.monthEnd;
}

function CustomerDetailOverviewInner({
  customer: c,
  assignedDeliveryBoy,
  deliveryRoute,
  billingType,
  addressTags,
  onEditSection,
  wide = false,
}: CustomerDetailOverviewProps) {
  const strings = useStrings('customers');
  const t = strings.overview;
  const appAllowed = c.appAccessEnabled !== false;
  const active = c.status === 'Active';
  const editAction = (section: CustomerFormTab) =>
    onEditSection ? <DetailCardAction label={t.edit} icon="pencil-outline" onPress={() => onEditSection(section)} /> : undefined;

  return (
    <View style={styles.root}>
      <DetailSectionCard title={t.basicInfo} icon="account-outline" right={editAction('basic')}>
        <DetailInfoGrid>
          <DetailInfo label={t.fullName} value={textOrDash(c.name)} wide={wide} />
          <DetailInfo label={t.mobile} value={mobileOrDash(c.mobile)} wide={wide} />
          <DetailInfo label={t.alternateMobile} value={mobileOrDash(c.alternateMobile)} wide={wide} />
          <DetailInfo label={t.dateOfBirth} value={textOrDash(toDdMmYyyyFromFlexibleDate(c.dateOfBirth))} wide={wide} />
          <DetailInfo label={t.appAccess} wide={wide}>
            <DetailStatusPill
              tone={appAllowed ? 'green' : 'red'}
              icon={appAllowed ? 'check-circle' : 'close-circle'}
              label={appAllowed ? t.allowed : t.blocked}
            />
          </DetailInfo>
          <DetailInfo label={t.customerStatus} wide={wide}>
            <DetailStatusPill
              tone={active ? 'blue' : 'gray'}
              icon={active ? 'check-decagram' : 'pause-circle-outline'}
              label={strings.customerStatus[c.status] ?? c.status}
            />
          </DetailInfo>
        </DetailInfoGrid>
      </DetailSectionCard>

      <DetailSectionCard title={t.address} icon="map-marker-outline" right={editAction('address')}>
        <DetailInfoGrid>
          <DetailInfo label={t.fullAddress} wide={wide} full>
            <Text style={[styles.addressValue, !c.address?.trim() && styles.addressValueEmpty]} numberOfLines={5}>
              {textOrDash(c.address)}
            </Text>
            {addressTags.length ? (
              <View style={styles.tagRow}>
                {addressTags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </DetailInfo>
          <DetailInfo label={t.houseFlat} value={textOrDash(c.houseFlatNumber)} wide={wide} />
          <DetailInfo label={t.society} value={textOrDash(c.societyName)} wide={wide} />
          <DetailInfo label={t.street} value={textOrDash(c.streetArea)} wide={wide} />
          <DetailInfo label={t.landmark} value={textOrDash(c.landmark)} wide={wide} />
          <DetailInfo label={t.city} value={textOrDash(c.city)} wide={wide} />
          <DetailInfo label={t.pincode} value={textOrDash(c.pincode)} wide={wide} />
          <DetailInfo label={t.deliveryBoy} value={textOrDash(assignedDeliveryBoy)} wide={wide} />
          <DetailInfo label={t.route} value={textOrDash(deliveryRoute)} wide={wide} />
        </DetailInfoGrid>
      </DetailSectionCard>

      <DetailSectionCard title={t.billing} icon="credit-card-outline" right={editAction('billing')}>
        <DetailInfoGrid>
          <DetailInfo label={t.billingType} value={textOrDash(billingType)} wide={wide} accent />
          <DetailInfo label={t.billingDay} value={billingDayLabel(c, t)} wide={wide} />
        </DetailInfoGrid>
      </DetailSectionCard>
    </View>
  );
}

export const CustomerDetailOverview = memo(CustomerDetailOverviewInner);

const styles = StyleSheet.create({
  root: { gap: amraleSpacing.cardGap },
  addressValue: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    lineHeight: 21,
    color: dairyTactileColors.onSurface,
  },
  addressValueEmpty: { color: dairyTactileColors.outline, fontFamily: amraleTypography.fontFamily.regular },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: amraleRadius.sm,
    borderWidth: 1,
    borderColor: dairyTactileColors.primaryContainer,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
  },
  tagText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
    color: dairyTactileColors.primaryContainer,
    textTransform: 'uppercase',
  },
});
