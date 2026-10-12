import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

type Props = {
  onNeedHelp: () => void;
  onContactAdmin: () => void;
  onPrivacyPolicy: () => void;
  variant?: 'dark' | 'light';
};

export function AuthFooterLinks({ onNeedHelp, onContactAdmin, onPrivacyPolicy, variant = 'dark' }: Props) {
  const t = useStrings('auth');
  const isLight = variant === 'light';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <FooterLink
          label={t.footer.needHelp}
          onPress={onNeedHelp}
          isLight={isLight}
        />
        <Text style={[styles.sep, isLight ? styles.sepLight : styles.sepDark]}>·</Text>
        <FooterLink
          label={t.footer.contactAdmin}
          onPress={onContactAdmin}
          isLight={isLight}
        />
        <Text style={[styles.sep, isLight ? styles.sepLight : styles.sepDark]}>·</Text>
        <FooterLink
          label={t.footer.privacyPolicy}
          onPress={onPrivacyPolicy}
          isLight={isLight}
        />
      </View>
    </View>
  );
}

function FooterLink({ label, onPress, isLight }: { label: string; onPress: () => void; isLight: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ left: 4, right: 4 }}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
    >
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
    columnGap: 6,
    rowGap: 0,
  },
  /** ≥44px tall touch target around the 13px link text. */
  linkBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 2,
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
