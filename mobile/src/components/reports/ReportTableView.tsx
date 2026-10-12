import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatReportValue } from '@/src/domain/reports/format';
import type { ReportCell, ReportColumn, ReportTable } from '@/src/domain/reports/model';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * One report table. Wide screens get a real table (scrolling sideways when the columns do not fit); phones get one
 * card per row with its values under their labels, so nothing is cut off. Long tables show a page at a time.
 */

const PAGE = 50;

const NUMERIC = new Set(['money', 'number', 'percent', 'quantity']);

function columnWidth(c: ReportColumn): number {
  if (c.primary) return 200;
  if (c.kind === 'date') return 112;
  if (NUMERIC.has(c.kind)) return 110;
  return 150;
}

function hasValue(v: ReportCell | undefined): boolean {
  return v !== null && v !== undefined && v !== '';
}

export function ReportTableView({ table, wide }: { table: ReportTable; wide: boolean }) {
  const t = useStrings('reports');
  const totalWord = useStrings('common').fields.total;
  const [limit, setLimit] = useState(PAGE);
  const rows = table.rows.slice(0, limit);
  const hidden = table.rows.length - rows.length;
  const primary = table.columns.find((c) => c.primary) ?? table.columns[0]!;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {table.title}
        </Text>
        {table.rows.length ? <Text style={styles.count}>{t.table.rows(table.rows.length)}</Text> : null}
      </View>
      {table.note ? <Text style={styles.note}>{table.note}</Text> : null}

      {table.rows.length === 0 ? (
        <Text style={styles.empty}>{table.emptyText}</Text>
      ) : wide ? (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}>
          <View style={styles.table}>
            <View style={[styles.tr, styles.thRow]}>
              {table.columns.map((c) => (
                <Text
                  key={c.key}
                  style={[styles.th, { width: columnWidth(c) }, NUMERIC.has(c.kind) && styles.num]}
                  numberOfLines={2}
                >
                  {c.label}
                </Text>
              ))}
            </View>
            {rows.map((row, i) => (
              <View key={i} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                {table.columns.map((c) => (
                  <Text
                    key={c.key}
                    style={[styles.td, { width: columnWidth(c) }, NUMERIC.has(c.kind) && styles.num, c.primary && styles.tdPrimary]}
                  >
                    {formatReportValue(row[c.key], c.kind)}
                  </Text>
                ))}
              </View>
            ))}
            {table.totals && hidden === 0 ? (
              <View style={[styles.tr, styles.totalRow]}>
                {table.columns.map((c, i) => {
                  const v = table.totals![c.key];
                  return (
                    <Text key={c.key} style={[styles.td, styles.totalText, { width: columnWidth(c) }, NUMERIC.has(c.kind) && styles.num]}>
                      {i === 0 && !hasValue(v) ? totalWord : hasValue(v) ? formatReportValue(v, c.kind) : ''}
                    </Text>
                  );
                })}
              </View>
            ) : null}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.cards}>
          {rows.map((row, i) => (
            <View key={i} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{formatReportValue(row[primary.key], primary.kind)}</Text>
              <View style={styles.pairs}>
                {table.columns
                  .filter((c) => c.key !== primary.key && hasValue(row[c.key]))
                  .map((c) => (
                    <View key={c.key} style={styles.pair}>
                      <Text style={styles.pairLabel} numberOfLines={1}>
                        {c.label}
                      </Text>
                      <Text style={[styles.pairValue, NUMERIC.has(c.kind) && styles.pairValueStrong]}>
                        {formatReportValue(row[c.key], c.kind)}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          ))}
          {table.totals && hidden === 0 ? (
            <View style={[styles.rowCard, styles.totalCard]}>
              <Text style={styles.rowTitle}>{totalWord}</Text>
              <View style={styles.pairs}>
                {table.columns
                  .filter((c) => c.key !== primary.key && hasValue(table.totals![c.key]))
                  .map((c) => (
                    <View key={c.key} style={styles.pair}>
                      <Text style={styles.pairLabel} numberOfLines={1}>
                        {c.label}
                      </Text>
                      <Text style={[styles.pairValue, styles.pairValueStrong]}>{formatReportValue(table.totals![c.key], c.kind)}</Text>
                    </View>
                  ))}
              </View>
            </View>
          ) : null}
        </View>
      )}

      {hidden > 0 ? (
        <Pressable
          onPress={() => setLimit((n) => n + PAGE)}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.moreText}>{t.table.showMore(Math.min(PAGE, hidden), hidden)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    padding: 14,
    gap: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  count: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textSubtle },
  note: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: amraleColors.textMuted },
  empty: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted, paddingVertical: 12 },

  tableScroll: { flexGrow: 1 },
  table: { flexGrow: 1 },
  tr: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: 'rgba(53, 81, 161, 0.06)' },
  trAlt: { backgroundColor: 'rgba(53, 81, 161, 0.025)' },
  thRow: { backgroundColor: amraleColors.inputBgLight, borderBottomColor: amraleColors.inputBorderLight },
  th: { paddingHorizontal: 8, paddingVertical: 8, fontFamily: amraleTypography.fontFamily.bold, fontSize: 12, color: amraleColors.blue },
  td: { paddingHorizontal: 8, paddingVertical: 8, fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.text },
  tdPrimary: { fontFamily: amraleTypography.fontFamily.semiBold },
  num: { textAlign: 'right' },
  totalRow: { backgroundColor: 'rgba(53, 81, 161, 0.06)', borderBottomWidth: 0 },
  totalText: { fontFamily: amraleTypography.fontFamily.bold },

  cards: { gap: 8 },
  rowCard: { borderRadius: amraleRadius.md, backgroundColor: amraleColors.inputBgLight, padding: 12, gap: 6 },
  totalCard: { backgroundColor: 'rgba(53, 81, 161, 0.08)' },
  rowTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  pairs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6 },
  pair: { minWidth: 120, flexGrow: 1, flexBasis: '40%' },
  pairLabel: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  pairValue: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, color: amraleColors.text },
  pairValueStrong: { fontFamily: amraleTypography.fontFamily.semiBold },

  more: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  moreText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.blue },
  pressed: { opacity: 0.8 },
});
