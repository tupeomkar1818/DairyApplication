import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { isoDateToDob, toIsoYmdFromFlexibleDate } from '@/src/components/admin/customerFormDates';
import {
  SubscriptionEmptyBox,
  SubscriptionTactileCard,
  SubscriptionTactileSection,
} from '@/src/components/admin/customerSubscriptionTactileUi';
import type { CustomerSubscriptionHistoryRowDto } from '@/src/domain/customers/dtos';
import {
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyTactileColors,
  tactileCardElevation,
} from '@/src/theme/dairyTactile';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { formatDay } from '@/src/utils/format';

function fmtBoundary(value: string | undefined): string {
  if (!value?.trim()) return '—';
  const ymd = toIsoYmdFromFlexibleDate(value);
  if (ymd) {
    const dob = isoDateToDob(ymd);
    if (dob) return dob;
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const localYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return formatDay(localYmd, { year: true });
  }
  return value.trim();
}

function fmtYmd(ymd: string | undefined): string {
  if (!ymd) return '—';
  const dob = isoDateToDob(ymd);
  return dob || ymd;
}

function money(v: number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${Math.round(n)}`;
}

function lineKindLabel(k: CustomerSubscriptionHistoryRowDto['lineKind']): string {
  const t = strings('subscriptionEditor').history;
  return k === 'add_on_product' ? t.kindAddOn : t.kindBasic;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function HistoryProductCard({ row }: { row: CustomerSubscriptionHistoryRowDto }) {
  const t = useStrings('subscriptionEditor');
  return (
    <View style={styles.productCard}>
      <Text style={styles.productName} numberOfLines={2}>
        {row.productName}
      </Text>
      <Text style={styles.metaLine}>
        {lineKindLabel(row.lineKind)} · {row.packSizeLabel} · {t.daySheet.qty(row.quantity)}
      </Text>
      <View style={styles.fieldGrid}>
        <Field label={t.fields.pricePerDelivery} value={money(row.pricePerDelivery)} />
        <Field label={t.history.timesDelivered} value={String(row.deliveryOccurrenceCount)} />
        <Field label={t.history.quantityDelivered} value={String(row.totalQuantityDelivered)} />
        <Field label={t.history.lastDelivery} value={fmtYmd(row.lastDeliveredDateYmd)} />
        <Field label={t.history.issueDate} value={fmtBoundary(row.subscriptionIssueDate)} />
        <Field label={t.fields.startDate} value={fmtBoundary(row.subscriptionStartDate)} />
        <Field label={t.fields.endDate} value={fmtBoundary(row.subscriptionEndDate)} />
      </View>
      <Text style={styles.amountLine}>{t.history.amountValue(money(row.calculatedAmount))}</Text>
    </View>
  );
}

function CustomerSubscriptionHistoryCardsInner({
  rows,
  monthLabel,
  monthTotal,
}: {
  rows: CustomerSubscriptionHistoryRowDto[];
  /** Month the figures cover, e.g. "Sep 2026" — the same month the section below uses. */
  monthLabel?: string;
  /** Sum of the rows' amounts, so the tab reconciles with that month's bill. */
  monthTotal?: number;
}) {
  const t = useStrings('subscriptionEditor').history;
  const title = monthLabel ? t.titleForMonth(monthLabel) : t.title;
  return (
    <SubscriptionTactileSection title={title} subtitle={rows.length ? t.blurb : undefined}>
      {rows.length ? (
        <View style={styles.cardStack}>
          {rows.map((r) => (
            <HistoryProductCard key={r.id} row={r} />
          ))}
          {monthTotal !== undefined ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel} numberOfLines={2}>
                {monthLabel ? t.totalDeliveredIn(monthLabel) : t.totalDelivered}
              </Text>
              <Text style={styles.totalValue}>{money(monthTotal)}</Text>
            </View>
          ) : null}
          <Text style={styles.footnote}>{t.footnote}</Text>
        </View>
      ) : (
        <SubscriptionTactileCard>
          <SubscriptionEmptyBox
            message={monthLabel ? t.emptyForMonth(monthLabel) : t.empty}
          />
        </SubscriptionTactileCard>
      )}
    </SubscriptionTactileSection>
  );
}

export const CustomerSubscriptionHistoryCards = memo(CustomerSubscriptionHistoryCardsInner);

const styles = StyleSheet.create({
  /** Two columns of labelled values inside a plan card; one column on narrow phones. */
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8, marginTop: 4 },
  field: { flexGrow: 1, flexShrink: 1, flexBasis: 130, minWidth: 0, gap: 2 },
  fieldLabel: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: dairyTactileColors.onSurfaceVariant,
  },
  fieldValue: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 14,
    lineHeight: 19,
    color: dairyTactileColors.onSurface,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.md,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
  },
  totalLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
  },
  totalValue: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    lineHeight: 21,
    color: dairyTactileColors.primaryContainer,
  },
  footnote: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: dairyTactileColors.onSurfaceVariant,
  },
  // Wrapping grid: 1 card per row on phones/tablet portrait, 2–3 per row on laptops/desktops.
  cardStack: { flexDirection: 'row', flexWrap: 'wrap', gap: amraleSpacing.cardGap },
  productCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 340,
    minWidth: 0,
    maxWidth: '100%',
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    ...tactileCardElevation(),
    gap: 6,
  },
  productName: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
    color: dairyTactileColors.onSurface,
  },
  metaLine: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
  },
  detailLine: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onSurfaceVariant,
  },
  amountLine: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: dairyTactileColors.onSurface,
    marginTop: 4,
  },
});
