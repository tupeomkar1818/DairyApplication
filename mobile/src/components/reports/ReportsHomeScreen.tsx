import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { ScreenHeader } from '@/src/components/shared/ScreenHeader';
import { reportSections, type ReportAudience, type ReportDefinition } from '@/src/domain/reports/catalog';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Where back goes, and which dictionary entries head the list. */
const COPY: Record<ReportAudience, { title: 'adminTitle' | 'myTitle'; intro: 'adminIntro' | 'deliveryIntro' | 'customerIntro'; home: string }> = {
  admin: { title: 'adminTitle', intro: 'adminIntro', home: '/(admin)' },
  delivery: { title: 'myTitle', intro: 'deliveryIntro', home: '/(delivery)' },
  customer: { title: 'myTitle', intro: 'customerIntro', home: '/(customer)' },
};

const ROUTE: Record<ReportAudience, string> = {
  admin: '/(admin)/report',
  delivery: '/(delivery)/report',
  customer: '/(customer)/report',
};

export function ReportsHomeScreen({ audience }: { audience: ReportAudience }) {
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const { width } = useWindowDimensions();
  const t = useStrings('reports');
  const copy = COPY[audience];
  // Two cards a row from tablet width, three on a laptop.
  const columns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  const open = (r: ReportDefinition) => router.push({ pathname: ROUTE[audience] as never, params: { id: r.id } });
  const back = () => (router.canGoBack() ? router.back() : router.replace(copy.home as never));

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t.home[copy.title]} onBack={back} paddingTop={headerPaddingTop} />
      <ScrollView contentContainerStyle={{ paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }}>
        <ResponsiveContainer style={styles.body}>
          <Text style={styles.intro}>{t.home[copy.intro]}</Text>
          {reportSections(audience).map(({ section, reports }) => (
            <View key={section} style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {t.sections[section]}
              </Text>
              <View style={styles.grid}>
                {reports.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => open(r)}
                    style={({ pressed }) => [
                      styles.card,
                      { flexBasis: columns === 1 ? '100%' : columns === 2 ? '48%' : '31%' },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.title}. ${r.description}`}
                  >
                    <View style={styles.icon}>
                      <MaterialCommunityIcons name={r.icon as IconName} size={22} color={amraleColors.blue} />
                    </View>
                    <View style={styles.text}>
                      <Text style={styles.title}>{r.title}</Text>
                      <Text style={styles.description} numberOfLines={3}>
                        {r.description}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: 18 },
  intro: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: amraleColors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexGrow: 1,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    backgroundColor: amraleColors.white,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(53, 81, 161, 0.08)',
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  description: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: amraleColors.textMuted },
  pressed: { opacity: 0.88 },
});
