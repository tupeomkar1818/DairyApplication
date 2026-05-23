import React from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { MonthTrendPoint } from '@/src/domain/deliveryBoys/deliveryBoyPeriodSummary';

type Props = {
  title: string;
  points: MonthTrendPoint[];
  valueSuffix?: string;
};

export function SimpleTrendBars({ title, points, valueSuffix = '' }: Props) {
  const scheme = useColorScheme();
  const max = Math.max(1, ...points.map((p) => p.value));
  const bar = scheme === 'dark' ? '#60A5FA' : '#2563EB';
  const textMain = scheme === 'dark' ? styles.tDark : styles.tLight;
  const sub = scheme === 'dark' ? styles.sDark : styles.sLight;

  return (
    <View style={[styles.card, scheme === 'dark' ? styles.cardDark : styles.cardLight]}>
      <Text variant="titleSmall" style={[styles.title, textMain]}>
        {title}
      </Text>
      <View style={styles.chart}>
        {points.map((p) => {
          const h = Math.round((p.value / max) * 72);
          return (
            <View key={p.monthKey} style={styles.col}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: Math.max(4, h), backgroundColor: bar }]} />
              </View>
              <Text variant="labelSmall" style={[sub, styles.lbl]} numberOfLines={1}>
                {p.shortLabel}
              </Text>
              <Text variant="labelSmall" style={[textMain, styles.val]} numberOfLines={1}>
                {p.value}
                {valueSuffix}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 12, marginTop: 10 },
  cardLight: { backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.25)' },
  cardDark: { backgroundColor: 'rgba(15,23,42,0.55)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)' },
  title: { fontWeight: '800', marginBottom: 8 },
  tLight: { color: '#1E293B' },
  tDark: { color: 'rgba(255,255,255,0.94)' },
  sLight: { color: 'rgba(30,41,59,0.55)' },
  sDark: { color: 'rgba(255,255,255,0.55)' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, minHeight: 100 },
  col: { flex: 1, alignItems: 'center', minWidth: 36 },
  barTrack: { width: '70%', height: 76, justifyContent: 'flex-end', alignItems: 'center' },
  barFill: { width: '100%', borderRadius: 6 },
  lbl: { marginTop: 4, fontSize: 10 },
  val: { fontSize: 10, fontWeight: '700' },
});
