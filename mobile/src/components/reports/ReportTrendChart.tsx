import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatReportValue } from '@/src/domain/reports/format';
import type { ReportTrend } from '@/src/domain/reports/model';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * A plain bar chart drawn with views (no chart library): one bar per day, week or month, the highest labelled.
 * It scrolls sideways when there are more bars than fit, so bars never get thinner than a finger.
 */

const CHART_HEIGHT = 140;
const BAR_WIDTH = 18;
const BAR_GAP = 8;

export function ReportTrendChart({ trend }: { trend: ReportTrend }) {
  const t = useStrings('reports');
  const max = Math.max(0, ...trend.points.map((p) => p.value));
  if (trend.points.length < 2 || max <= 0) return null;

  const kind = trend.kind === 'money' ? 'money' : trend.kind === 'quantity' ? 'quantity' : 'number';
  const total = trend.points.reduce((s, p) => s + p.value, 0);
  const peak = trend.points.find((p) => p.value === max)!;
  // Label roughly every sixth bar so the axis stays readable.
  const labelEvery = Math.max(1, Math.ceil(trend.points.length / 6));

  return (
    <View style={styles.card} accessible accessibilityLabel={t.trend.a11y(trend.title, formatReportValue(max, kind), peak.label)}>
      <View style={styles.header}>
        <Text style={styles.title}>{trend.title}</Text>
        <Text style={styles.meta}>{t.trend.highest(formatReportValue(max, kind), peak.label)}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View>
          <View style={[styles.bars, { height: CHART_HEIGHT }]}>
            {trend.points.map((p, i) => (
              <View key={`${p.label}-${i}`} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(p.value > 0 ? 3 : 0, Math.round((p.value / max) * CHART_HEIGHT)) },
                    p.value === max && styles.barPeak,
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.axis}>
            {trend.points.map((p, i) => (
              <View key={`${p.label}-${i}`} style={styles.axisSlot}>
                {i % labelEvery === 0 ? (
                  <Text style={styles.axisLabel} numberOfLines={1}>
                    {p.label}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      {trend.kind !== 'quantity' || total > 0 ? (
        <Text style={styles.footer}>{t.trend.total(formatReportValue(Math.round(total * 100) / 100, kind))}</Text>
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
    gap: 10,
  },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 8, rowGap: 2 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  meta: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  scroll: { paddingRight: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: BAR_GAP },
  barSlot: { width: BAR_WIDTH, height: '100%', justifyContent: 'flex-end' },
  bar: { width: BAR_WIDTH, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: 'rgba(53, 81, 161, 0.45)' },
  barPeak: { backgroundColor: amraleColors.blue },
  axis: { flexDirection: 'row', gap: BAR_GAP, marginTop: 6 },
  axisSlot: { width: BAR_WIDTH, overflow: 'visible' },
  axisLabel: { width: 56, fontFamily: amraleTypography.fontFamily.regular, fontSize: 10, color: amraleColors.textSubtle },
  footer: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
});
