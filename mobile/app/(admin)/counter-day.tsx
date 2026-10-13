import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DairyTactileScreenBackground } from '@/src/components/shared/DairyTactileScreenBackground';
import { useCounterDay, useCounterSales } from '@/src/hooks/counter';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * What the counter took today.
 *
 * Kept apart from the subscription money on purpose. The round and the counter are two trades, and one figure for
 * both would hide which of them is paying for the dairy.
 */
export default function CounterDayScreen() {
  const t = useStrings('counter');
  const c = useStrings('common');
  const day = useCounterDay();
  const sales = useCounterSales();

  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <DairyTactileScreenBackground>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={c.actions.back} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={amraleColors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t.day.title}</Text>
          <Text style={styles.subtitle}>{t.day.subtitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {day.isPending ? (
          <ActivityIndicator color={amraleColors.blue} style={{ paddingVertical: 32 }} />
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>{t.day.total}</Text>
              <Text style={styles.heroValue}>{money(day.data?.total ?? 0)}</Text>
              <Text style={styles.heroSub}>
                {t.day.sales}: {day.data?.sales ?? 0}
              </Text>
            </View>

            <View style={styles.splitRow}>
              <View style={styles.splitCard}>
                <MaterialCommunityIcons name="cash" size={20} color={amraleColors.blue} />
                <Text style={styles.splitLabel}>{t.day.cash}</Text>
                <Text style={styles.splitValue}>{money(day.data?.cash ?? 0)}</Text>
              </View>
              <View style={styles.splitCard}>
                <MaterialCommunityIcons name="qrcode" size={20} color={amraleColors.blue} />
                <Text style={styles.splitLabel}>{t.day.upi}</Text>
                <Text style={styles.splitValue}>{money(day.data?.upi ?? 0)}</Text>
              </View>
            </View>

            <Text style={styles.note}>{t.day.separate}</Text>

            {!day.data?.sales ? (
              <Text style={styles.empty}>{t.day.none}</Text>
            ) : (
              <>
                <Text style={styles.sectionTitle}>{t.day.byDesk}</Text>
                {day.data.byDesk.map((row) => (
                  <View key={`${row.deskUserId ?? row.name}`} style={styles.row}>
                    <Text style={styles.rowName}>{row.name || '—'}</Text>
                    <Text style={styles.rowMeta}>{row.sales}</Text>
                    <Text style={styles.rowValue}>{money(row.total)}</Text>
                  </View>
                ))}

                <Text style={styles.sectionTitle}>{t.day.byProduct}</Text>
                {day.data.byProduct.map((row) => (
                  <View key={`${row.productName}:${row.packLabel}`} style={styles.row}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {row.productName} {row.packLabel}
                    </Text>
                    <Text style={styles.rowMeta}>×{row.quantity}</Text>
                    <Text style={styles.rowValue}>{money(row.total)}</Text>
                  </View>
                ))}

                <Text style={styles.sectionTitle}>{t.day.openFull}</Text>
                {(sales.data?.items ?? []).map((sale) => (
                  <View key={sale.id} style={styles.row}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      #{sale.saleNo} {sale.soldByName ? `· ${sale.soldByName}` : ''}
                    </Text>
                    <Text style={styles.rowMeta}>{sale.paidBy}</Text>
                    <Text style={styles.rowValue}>{money(sale.total)}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </DairyTactileScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: amraleSpacing.md,
    paddingTop: amraleSpacing.lg,
    paddingBottom: amraleSpacing.sm,
  },
  backBtn: { padding: 4 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 20, color: amraleColors.text },
  subtitle: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  body: { padding: amraleSpacing.lg, gap: 12, paddingBottom: 48 },

  hero: {
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.blue,
    padding: 18,
    gap: 2,
  },
  heroLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  heroValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 34, color: amraleColors.white },
  heroSub: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: 'rgba(255,255,255,0.85)' },

  splitRow: { flexDirection: 'row', gap: 10 },
  splitCard: {
    flex: 1,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
    padding: 14,
    gap: 2,
  },
  splitLabel: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  splitValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },

  note: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },
  empty: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted, paddingVertical: 16 },
  sectionTitle: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: amraleColors.text,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: amraleColors.inputBorderLight,
  },
  rowName: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, color: amraleColors.text },
  rowMeta: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  rowValue: { minWidth: 76, textAlign: 'right', fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
});
