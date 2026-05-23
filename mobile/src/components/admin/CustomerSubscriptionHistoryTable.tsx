import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { isoDateToDob, toIsoYmdFromFlexibleDate } from '@/src/components/admin/customerFormDates';
import type {
  CustomerSubscriptionHistoryRowDto,
  CustomerSubscriptionPlanHistoryMemoDto,
} from '@/src/domain/customers/dtos';

function fmtBoundary(value: string | undefined): string {
  if (!value?.trim()) return '—';
  const ymd = toIsoYmdFromFlexibleDate(value);
  if (ymd) {
    const dob = isoDateToDob(ymd);
    if (dob) return dob;
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
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
  return k === 'add_on_product' ? 'Add-on' : 'Basic';
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
  const header = [
    'Type',
    'Product',
    'Pack / size',
    'Qty',
    'Price / delivery',
    'Issue date',
    'Start',
    'End',
    'Delivered (last)',
    'Qty delivered',
    'Times',
    'Amount',
  ];

  const hasRows = rows.length > 0;

  if (!hasRows) {
    return (
      <Card style={sectionCardStyle} mode="elevated">
        <Card.Content style={styles.cardInner}>
          <Text variant="titleSmall" style={[styles.bold, textMain]}>
            Subscription history
          </Text>
          <Text variant="bodySmall" style={[textSub, { marginTop: 6 }]}>
            No subscription plan lines yet. Add basic milk lines under Basic subscription details; delivery counts use saved day orders on the
            calendar and delivered rows on the customer profile when present.
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
            Subscription history
          </Text>
          {hasRows ? (
            <>
              <Text variant="bodySmall" style={[textSub, { marginBottom: 10 }]}>
                Amount = times delivered × price per delivery (plan line total), using calendar and delivery records—not subscription date edits alone. If the same
                subscription line (matching product, pack, and schedule) was closed and reopened, each day is counted once on the segment with the latest start date.
                Issue date is when the line was recorded in the system.
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
                      {lineKindLabel(r.lineKind)} · {r.packSizeLabel} · Qty {r.quantity}
                    </Text>
                    <Text variant="bodySmall" style={textSub}>
                      Price / delivery {money(r.pricePerDelivery)}
                    </Text>
                    <Text variant="bodySmall" style={textSub}>
                      Issue {fmtBoundary(r.subscriptionIssueDate)} · Start {fmtBoundary(r.subscriptionStartDate)} · End{' '}
                      {fmtBoundary(r.subscriptionEndDate)}
                    </Text>
                    <Text variant="bodySmall" style={textSub}>
                      Last delivery {fmtYmd(r.lastDeliveredDateYmd)} · Qty delivered {r.totalQuantityDelivered} · Times{' '}
                      {r.deliveryOccurrenceCount}
                    </Text>
                    <Text variant="titleSmall" style={[textMain, styles.bold, { marginTop: 4 }]}>
                      Amount {money(r.calculatedAmount)}
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
          Subscription history
        </Text>
        {hasRows ? (
          <>
            <Text variant="bodySmall" style={[textSub, { marginBottom: 10 }]}>
              Amount = times delivered × price per delivery. Issue date is system record time for the line; last delivery uses calendar day orders or
              profile deliveries.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
              <View style={styles.flexTable}>
                <View style={[styles.flexTr, styles.flexHeader]}>
                  {header.map((h, i) => (
                    <Text
                      key={h}
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
