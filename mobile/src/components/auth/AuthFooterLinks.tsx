import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

type Props = {
  onNeedHelp?: () => void;
  onContactAdmin?: () => void;
  onPrivacyPolicy?: () => void;
  variant?: 'dark' | 'light';
};

export function AuthFooterLinks({ onNeedHelp, onContactAdmin, onPrivacyPolicy, variant = 'dark' }: Props) {
  const isLight = variant === 'light';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <FooterLink
          label="Need Help?"
          onPress={onNeedHelp ?? (() => Linking.openURL('mailto:support@amraledairy.com'))}
          isLight={isLight}
        />
        <Text style={[styles.sep, isLight ? styles.sepLight : styles.sepDark]}>·</Text>
        <FooterLink
          label="Contact Admin"
          onPress={onContactAdmin ?? (() => Linking.openURL('tel:+918206882688'))}
          isLight={isLight}
        />
        <Text style={[styles.sep, isLight ? styles.sepLight : styles.sepDark]}>·</Text>
        <FooterLink
          label="Privacy Policy"
          onPress={onPrivacyPolicy ?? (() => Linking.openURL('https://amraledairy.com/privacy'))}
          isLight={isLight}
        />
      </View>
    </View>
  );
}

function FooterLink({ label, onPress, isLight }: { label: string; onPress: () => void; isLight: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Text style={[styles.link, isLight ? styles.linkLight : styles.linkDark]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  link: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  linkLight: { color: amraleColors.textMuted },
  linkDark: { color: amraleColors.whiteMuted },
  sep: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
  },
  sepLight: { color: amraleColors.textSubtle },
  sepDark: { color: amraleColors.whiteSubtle },
  pressed: { opacity: 0.75 },
});
