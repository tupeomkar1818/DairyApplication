import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dayChangesForMonth } from '@/src/components/admin/customerDayChanges';
import { DetailSectionCard, DetailStatusPill } from '@/src/components/shared/detailUi';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';

function dayLabel(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? ymd : formatDay(ymd);
}

/**
 * The customer's skips and quantity changes in the selected month, on the admin's Subscription tab — the days the
 * round and the bill differ from the plain subscription, and whether the customer or the dairy made the change.
 */
export function CustomerDayChangesCard({ customer, month }: { customer: CustomerResponse; month: string }) {
  const t = useStrings('customers').dayChanges;
  const lang = useLanguage();
  // Labels are built in the current language, so a language change rebuilds them.
  const rows = useMemo(() => dayChangesForMonth(customer, month), [customer, month, lang]);

  return (
    <DetailSectionCard title={t.title} icon="calendar-edit" style={styles.card}>
      {rows.length === 0 ? (
        <Text style={styles.empty}>{t.empty}</Text>
      ) : (
        rows.map((row, index) => (
          <View key={row.id} style={[styles.row, index > 0 && styles.rowDivided]}>
            <View style={styles.dates}>
              <Text style={styles.dateText}>
                {row.fromYmd === row.toYmd ? dayLabel(row.fromYmd) : `${dayLabel(row.fromYmd)} – ${dayLabel(row.toYmd)}`}
              </Text>
              <Text style={styles.byText}>{row.createdBy === 'admin' ? t.byDairy : t.byCustomer}</Text>
            </View>
            <View style={styles.what}>
              <Text style={styles.product} numberOfLines={2}>
                {row.productLabel}
              </Text>
              <DetailStatusPill tone={row.kind === 'skip' ? 'gray' : 'blue'} label={row.changeLabel} />
            </View>
          </View>
        ))
      )}
    </DetailSectionCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: amraleSpacing.md },
  empty: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: amraleColors.inputBorderLight },
  dates: { minWidth: 120, flexShrink: 0 },
  dateText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  byText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },
  what: { flex: 1, minWidth: 160, gap: 6, alignItems: 'flex-start' },
  product: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, color: amraleColors.text },
});
