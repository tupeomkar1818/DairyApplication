import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { isoDateToDob, toIsoYmdFromFlexibleDate } from '@/src/components/admin/customerFormDates';
import type {
  CustomerSubscriptionHistoryRowDto,
  CustomerSubscriptionPlanHistoryMemoDto,
} from '@/src/domain/customers/dtos';
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

export type CustomerSubscriptionHistoryTableProps = {
  rows: CustomerSubscriptionHistoryRowDto[];
  isMobile: boolean;
  scheme: 'light' | 'dark' | null | undefined;
  textMain: object;
  textSub: object;
  sectionCardStyle: object;
};

export function CustomerSubscriptionHistoryTable({
  rows,
  isMobile,
  scheme,
  textMain,
  textSub,
  sectionCardStyle,
}: CustomerSubscriptionHistoryTableProps) {
  const t = useStrings('subscriptionEditor');
  const common = useStrings('common');
  const header = [
    t.historyTable.type,
    common.fields.product,
    t.fields.packSize,
    t.fields.qty,
    t.fields.pricePerDelivery,
    t.history.issueDate,
    t.historyTable.start,
    t.historyTable.end,
    t.historyTable.deliveredLast,
    t.historyTable.qtyDelivered,
    t.historyTable.times,
    common.fields.amount,
  ];

  const hasRows = rows.length > 0;

  if (!hasRows) {
    return (
      <Card style={sectionCardStyle} mode="elevated">
        <Card.Content style={styles.cardInner}>
          <Text variant="titleSmall" style={[styles.bold, textMain]}>
            {t.history.title}
          </Text>
          <Text variant="bodySmall" style={[textSub, { marginTop: 6 }]}>
            {t.historyTable.empty}
          </Text>
        </Card.Content>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Card style={sectionCardStyle} mode="elevated">
        <Card.Content style={styles.cardInner}>
          <Text variant="titleSmall" style={[styles.bold, textMain]}>
            {t.history.title}
          </Text>
          {hasRows ? (
            <>
              <Text variant="bodySmall" style={[textSub, { marginBottom: 10 }]}>
                {t.historyTable.mobileBlurb}
              </Text>
              <View style={styles.cardStack}>
                {rows.map((r) => (
                  <View
                    key={r.id}
                    style={[
                      styles.mobileCard,
                      {
                        borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,0.35)',
                        backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(148,163,184,0.06)',
                      },
                    ]}
                  >
                    <Text variant="labelLarge" style={[textMain, styles.bold]} numberOfLines={2}>
                      {r.productName}
                    </Text>
                    <Text variant="bodySmall" style={textSub}>
                      {lineKindLabel(r.lineKind)} · {r.packSizeLabel} · {t.daySheet.qty(r.quantity)}
                    </Text>
                    <Text variant="bodySmall" style={textSub}>
                      {t.historyTable.priceLine(money(r.pricePerDelivery))}
                    </Text>
                    <Text variant="bodySmall" style={textSub}>
                      {t.historyTable.datesLine(
                        fmtBoundary(r.subscriptionIssueDate),
                        fmtBoundary(r.subscriptionStartDate),
                        fmtBoundary(r.subscriptionEndDate),
                      )}
                    </Text>
                    <Text variant="bodySmall" style={textSub}>
                      {t.historyTable.deliveryLine(fmtYmd(r.lastDeliveredDateYmd), r.totalQuantityDelivered, r.deliveryOccurrenceCount)}
                    </Text>
                    <Text variant="titleSmall" style={[textMain, styles.bold, { marginTop: 4 }]}>
                      {t.history.amountValue(money(r.calculatedAmount))}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={sectionCardStyle} mode="elevated">
      <Card.Content style={styles.cardInner}>
        <Text variant="titleSmall" style={[styles.bold, textMain]}>
          {t.history.title}
        </Text>
        {hasRows ? (
          <>
            <Text variant="bodySmall" style={[textSub, { marginBottom: 10 }]}>
              {t.historyTable.desktopBlurb}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
              <View style={styles.flexTable}>
                <View style={[styles.flexTr, styles.flexHeader]}>
                  {header.map((h, i) => (
                    <Text
                      key={`col-${i}`}
                      variant="labelSmall"
                      style={[styles.flexTh, i === 1 ? styles.flexThProduct : null, textSub]}
                      numberOfLines={3}
                    >
                      {h}
                    </Text>
                  ))}
                </View>
                {rows.map((r) => (
                  <View key={r.id} style={styles.flexTr}>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={2}>
                      {lineKindLabel(r.lineKind)}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, styles.flexTdProduct, textMain]} numberOfLines={2}>
                      {r.productName}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={2}>
                      {r.packSizeLabel}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                      {String(r.quantity)}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                      {money(r.pricePerDelivery)}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                      {fmtBoundary(r.subscriptionIssueDate)}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                      {fmtBoundary(r.subscriptionStartDate)}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                      {fmtBoundary(r.subscriptionEndDate)}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                      {fmtYmd(r.lastDeliveredDateYmd)}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                      {String(r.totalQuantityDelivered)}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                      {String(r.deliveryOccurrenceCount)}
                    </Text>
                    <Text variant="bodySmall" style={[styles.flexTd, textMain, styles.bold]} numberOfLines={1}>
                      {money(r.calculatedAmount)}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '900' },
  cardInner: { gap: 8 },
  cardStack: { gap: 10 },
  mobileCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  flexTable: { minWidth: 1180 },
  flexTr: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148,163,184,0.35)' },
  flexHeader: { borderBottomWidth: 1, paddingBottom: 6, marginBottom: 4 },
  flexTh: { width: 76, paddingRight: 6, paddingVertical: 4 },
  flexThProduct: { width: 112 },
  flexTd: { width: 76, paddingRight: 6, paddingVertical: 6 },
  flexTdProduct: { width: 112 },
});
