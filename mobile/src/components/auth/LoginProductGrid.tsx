import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';

import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

const PRODUCTS = [
  { label: 'Milk', icon: 'water' as const },
  { label: 'Shrikhand', icon: 'ice-cream' as const },
  { label: 'Paneer', icon: 'view-grid' as const },
  { label: 'Curd', icon: 'silverware-fork-knife' as const },
] as const;

export function LoginProductGrid() {
  return (
    <View style={styles.grid}>
      {PRODUCTS.map((p) => (
        <View key={p.label} style={styles.tile}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name={p.icon} size={22} color={amraleColors.blue} />
          </View>
          <Text style={styles.label}>{p.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
    marginTop: amraleSpacing.lg,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.xl,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    shadowColor: amraleColors.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: amraleColors.inputBgLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 14,
    color: amraleColors.text,
  },
});
