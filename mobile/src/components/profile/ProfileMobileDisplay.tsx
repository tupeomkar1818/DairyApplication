import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';

import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

type Props = {
  mobileFormatted: string;
};

export function ProfileMobileDisplay({ mobileFormatted }: Props) {
  return (
    <View style={styles.box}>
      <MaterialCommunityIcons name="cellphone" size={20} color={amraleColors.blue} />
      <Text style={styles.value}>{mobileFormatted}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: amraleColors.inputBgLight,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
  },
  value: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 16,
    color: amraleColors.text,
    flex: 1,
  },
});
