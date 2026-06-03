import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import {
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyTactileColors,
  tactileCardElevation,
} from '@/src/theme/dairyTactile';

export type CustomerDetailOverviewProps = {
  displayId: string;
  fullName: string;
  mobile: string;
  appAccess: 'Allowed' | 'Blocked';
  status: string;
  address: string;
  addressTags: string[];
  assignedDeliveryBoy: string;
  deliveryRoute: string;
  billingType: string;
};

function IconTile({ name }: { name: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <View style={styles.iconTile}>
      <MaterialCommunityIcons name={name} size={20} color={dairyTactileColors.primaryContainer} />
    </View>
  );
}

function FieldCard({
  icon,
  label,
  value,
  lines = 2,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  lines?: number;
}) {
  return (
    <View style={styles.fieldCard}>
      <IconTile name={icon} />
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue} numberOfLines={lines}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MiniStatusCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={[styles.fieldCard, styles.miniCard]}>
      <Text style={styles.miniLabel}>{label}</Text>
      {children}
    </View>
  );
}

function CustomerDetailOverviewInner({
  displayId,
  fullName,
  mobile,
  appAccess,
  status,
  address,
  addressTags,
  assignedDeliveryBoy,
  deliveryRoute,
  billingType,
}: CustomerDetailOverviewProps) {
  const appAllowed = appAccess === 'Allowed';

  return (
    <View style={styles.root}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.sectionId}>ID: {displayId}</Text>
      </View>
      <Text style={styles.sectionBlurb}>Snapshot across Subscription, Billing, Payments, and Delivery.</Text>

      <FieldCard icon="account-outline" label="FULL NAME" value={fullName} lines={2} />
      <FieldCard icon="cellphone" label="MOBILE NUMBER" value={mobile} />

      <View style={styles.splitRow}>
        <MiniStatusCard label="App Access">
          <View style={styles.statusValueRow}>
            <MaterialCommunityIcons
              name={appAllowed ? 'check-circle' : 'close-circle'}
              size={18}
              color={appAllowed ? '#16A34A' : dairyTactileColors.error}
            />
            <Text style={[styles.statusValueText, appAllowed ? styles.textSuccess : styles.textDanger]}>{appAccess}</Text>
          </View>
        </MiniStatusCard>
        <MiniStatusCard label="Status">
          <View style={styles.statusValueRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusValueText}>{status}</Text>
          </View>
        </MiniStatusCard>
      </View>

      <View style={styles.fieldCard}>
        <IconTile name="map-marker-outline" />
        <View style={styles.fieldBody}>
          <Text style={styles.fieldLabel}>FULL ADDRESS</Text>
          <Text style={styles.fieldValue} numberOfLines={5}>
            {address}
          </Text>
          {addressTags.length > 0 ? (
            <View style={styles.tagRow}>
              {addressTags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.summaryCard}>
        <SummaryRow icon="truck-outline" label="Assigned Delivery" value={assignedDeliveryBoy} />
        <View style={styles.summaryDivider} />
        <SummaryRow icon="routes" label="Delivery Route" value={deliveryRoute} />
        <View style={styles.summaryDivider} />
        <SummaryRow icon="wallet-outline" label="Billing Type" value={billingType} valueAccent />
      </View>
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  valueAccent,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  valueAccent?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <MaterialCommunityIcons name={icon} size={20} color={dairyTactileColors.onSurfaceVariant} />
      <View style={styles.summaryTextCol}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={[styles.summaryValue, valueAccent ? styles.summaryValueAccent : null]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export const CustomerDetailOverview = memo(CustomerDetailOverviewInner);

const styles = StyleSheet.create({
  root: { gap: amraleSpacing.cardGap },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: amraleSpacing.sm,
  },
  sectionTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: dairyTactileColors.onSurface,
  },
  sectionId: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: dairyTactileColors.onSurfaceVariant,
  },
  sectionBlurb: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
    marginTop: -4,
    marginBottom: 4,
  },
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: amraleSpacing.md,
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    ...tactileCardElevation(),
  },
  miniCard: { flex: 1, minWidth: 0, flexDirection: 'column', gap: 8 },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: amraleRadius.md,
    backgroundColor: dairyTactileColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldBody: { flex: 1, minWidth: 0, gap: 4 },
  fieldLabel: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: dairyTactileColors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: dairyTactileColors.onSurface,
  },
  miniLabel: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
  },
  splitRow: { flexDirection: 'row', gap: amraleSpacing.cardGap },
  statusValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusValueText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: dairyTactileColors.onSurface,
  },
  textSuccess: { color: '#16A34A' },
  textDanger: { color: dairyTactileColors.error },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: dairyTactileColors.primaryContainer,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
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
  summaryCard: {
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    ...tactileCardElevation(),
    gap: 0,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  summaryTextCol: { flex: 1, minWidth: 0, gap: 2 },
  summaryLabel: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
  },
  summaryValue: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: dairyTactileColors.onSurface,
  },
  summaryValueAccent: { color: dairyTactileColors.primaryContainer },
  summaryDivider: { height: 1, backgroundColor: dairyTactileColors.outlineVariant, opacity: 0.65 },
});
