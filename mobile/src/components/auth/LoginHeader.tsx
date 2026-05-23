import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

export function LoginHeader() {
  return (
    <View style={styles.bar}>
      <View style={styles.brandRow}>
        <MaterialCommunityIcons name="tractor" size={22} color={amraleColors.blue} />
        <Text style={styles.brand}>Amrale Dairy</Text>
      </View>
      <Pressable
        onPress={() => Linking.openURL('mailto:support@amraledairy.com')}
        style={({ pressed }) => [styles.helpBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Help"
      >
        <MaterialCommunityIcons name="help-circle-outline" size={26} color={amraleColors.blue} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 17,
    color: amraleColors.text,
  },
  helpBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  pressed: { opacity: 0.8 },
});
