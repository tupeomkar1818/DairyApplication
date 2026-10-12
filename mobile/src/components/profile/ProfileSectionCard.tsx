import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { amraleColors, amraleRadius, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';

type Props = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  /** One line on what the section is for. */
  subtitle?: string;
  children: ReactNode;
};

export function ProfileSectionCard({ icon, title, subtitle, children }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={icon} size={18} color={amraleColors.blue} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.xl,
    padding: amraleSpacing.md,
    gap: amraleSpacing.md,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dairyTactileColors.surfaceContainer,
  },
  headerText: { flex: 1, minWidth: 0, gap: 2, paddingTop: 5 },
  title: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.text,
  },
  subtitle: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: amraleColors.textMuted,
  },
});
