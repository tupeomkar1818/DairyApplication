import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

type Props = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  children: ReactNode;
};

export function ProfileSectionCard({ icon, title, children }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name={icon} size={18} color={amraleColors.blue} />
        <Text style={styles.title}>{title}</Text>
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
    borderColor: 'rgba(53, 81, 161, 0.08)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 12,
    color: amraleColors.blue,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
});
