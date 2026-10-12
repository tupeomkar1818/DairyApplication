import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LANGUAGES, setLanguage } from '@/src/i18n/language';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * English | मराठी. Each name is written in its own script, so a reader who cannot read the current language still
 * finds theirs. The choice applies to the whole app at once and is remembered on this phone.
 */
export function LanguageToggle({ tone = 'light' }: { /** `onDark` on the blue sign-in header, `light` on cards. */ tone?: 'light' | 'onDark' }) {
  const lang = useLanguage();
  const t = useStrings('common');
  const dark = tone === 'onDark';

  return (
    <View style={[styles.track, dark ? styles.trackDark : styles.trackLight]} accessibilityRole="radiogroup" accessibilityLabel={t.language.title}>
      {LANGUAGES.map((l) => {
        const selected = l.code === lang;
        return (
          <Pressable
            key={l.code}
            onPress={() => setLanguage(l.code)}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLanguage={l.code === 'mr' ? 'mr-IN' : 'en-IN'}
            style={({ pressed }) => [
              styles.option,
              selected && (dark ? styles.optionSelectedDark : styles.optionSelectedLight),
              pressed && !selected && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                dark ? styles.labelDark : styles.labelLight,
                selected && (dark ? styles.labelSelectedDark : styles.labelSelectedLight),
              ]}
            >
              {l.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignSelf: 'flex-start', padding: 3, borderRadius: 999, gap: 2 },
  trackLight: { backgroundColor: amraleColors.inputBgLight, borderWidth: 1, borderColor: amraleColors.inputBorderLight },
  trackDark: { backgroundColor: 'rgba(255, 255, 255, 0.14)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.28)' },
  option: { minHeight: 36, minWidth: 76, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  optionSelectedLight: { backgroundColor: amraleColors.blue },
  optionSelectedDark: { backgroundColor: amraleColors.white },
  pressed: { opacity: 0.7 },
  // No fixed line height: Devanagari needs room above and below the letters.
  label: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14 },
  labelLight: { color: amraleColors.textMuted },
  labelDark: { color: amraleColors.white },
  labelSelectedLight: { color: amraleColors.white },
  labelSelectedDark: { color: amraleColors.blue },
});
